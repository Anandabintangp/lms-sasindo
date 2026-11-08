import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useMuat, q, Judul, Spinner, Pesan, fmtTgl, ambilSemua, unduhCSV } from '../ui.jsx'

const STATUS = ['Hadir', 'Izin', 'Sakit', 'Alpa']

/* ───────────── MAHASISWA ───────────── */
function PresensiMhs() {
  const [kode, setKode] = useState('')
  const [pesan, setPesan] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const { data, error, memuat, ulang } = useMuat(() =>
    q(supabase.from('presensi').select('*, sesi_presensi(pertemuan_ke,tanggal)').order('dicatat_at', { ascending: false })), [])
  const kirim = async (e) => {
    e.preventDefault(); setSibuk(true); setPesan(null)
    try {
      const r = await q(supabase.rpc('checkin_presensi', { p_kode: kode }))
      setPesan({ j: 'ok', t: `Presensi pertemuan ${r.pertemuan_ke} tercatat.` }); setKode(''); ulang()
    } catch (e2) { setPesan({ j: 'err', t: e2.message }) } finally { setSibuk(false) }
  }
  const rekap = STATUS.map((s) => [s, (data || []).filter((p) => p.status === s).length])
  return (
    <div>
      <Judul judul="Presensi" sub="Masukkan kode yang ditampilkan dosen selama sesi kelas berlangsung." />
      <form onSubmit={kirim} className="card mb-6 flex max-w-lg flex-wrap items-end gap-3">
        <label className="flex-1 text-sm"><span className="mb-1 block font-medium">Kode presensi</span>
          <input className="input text-center font-mono text-lg uppercase tracking-widest" maxLength={8} value={kode} onChange={(e) => setKode(e.target.value)} /></label>
        <button className="btn" disabled={sibuk || !kode}>Hadir</button>
      </form>
      {pesan && <div className="mb-4"><Pesan jenis={pesan.j}>{pesan.t}</Pesan></div>}
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>
      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">{rekap.map(([s, n]) => <span key={s} className="rounded-full bg-white px-4 py-1 ring-1 ring-slate-200">{s}: <b>{n}</b></span>)}</div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">Pertemuan</th><th className="th">Tanggal</th><th className="th">Status</th><th className="th">Dicatat</th></tr></thead>
              <tbody className="divide-y">
                {[...data].sort((a, b) => (a.sesi_presensi?.pertemuan_ke || 0) - (b.sesi_presensi?.pertemuan_ke || 0)).map((p) => (
                  <tr key={p.id}><td className="td">{p.sesi_presensi?.pertemuan_ke}</td><td className="td">{fmtTgl(p.sesi_presensi?.tanggal, false)}</td>
                    <td className="td font-semibold">{p.status}</td><td className="td text-slate-500">{p.sumber} · {fmtTgl(p.dicatat_at)}</td></tr>
                ))}
                {!data.length && <tr><td className="td text-slate-500" colSpan={4}>Belum ada catatan presensi.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ───────────── DOSEN ───────────── */
function PresensiDosen() {
  const [kelas, setKelas] = useState('')
  const [ke, setKe] = useState(1)
  const [menit, setMenit] = useState(30)
  const [pesan, setPesan] = useState(null)
  const [tab, setTab] = useState('sesi')

  const dasar = useMuat(async () => {
    const kls = await q(supabase.from('kelas').select('class_id,nama_kelas,course_id').order('class_id'))
    return kls
  }, [])
  const kid = kelas || dasar.data?.[0]?.class_id

  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!kid) return null
    const mhs = await q(supabase.from('enrollments').select('npm, mahasiswa(nama)').eq('class_id', kid).eq('status', 'Aktif').order('npm').range(0, 999))
    const sesi = await q(supabase.from('sesi_presensi').select('*').eq('class_id', kid).order('pertemuan_ke'))
    const kodeRows = sesi.length ? await q(supabase.from('sesi_kode').select('*').in('sesi_id', sesi.map((s) => s.id))) : []
    const ids = sesi.map((s) => s.id)
    const pres = ids.length ? await ambilSemua((a, b) => supabase.from('presensi').select('*').in('sesi_id', ids).range(a, b)) : []
    return { mhs, sesi, kode: Object.fromEntries(kodeRows.map((k) => [k.sesi_id, k.kode])), pres }
  }, [kid])

  const sesiIni = data?.sesi.find((s) => s.pertemuan_ke === Number(ke))
  const masihBuka = sesiIni?.dibuka && (!sesiIni.dibuka_sampai || new Date(sesiIni.dibuka_sampai) > new Date())

  const aksi = async (fn) => { try { await fn(); ulang() } catch (e) { setPesan(e.message) } }
  const buka = () => aksi(async () => { await q(supabase.rpc('buka_sesi_presensi', { p_class: kid, p_ke: Number(ke), p_menit: Number(menit) })) })
  const tutup = () => aksi(async () => { await q(supabase.rpc('tutup_sesi_presensi', { p_sesi: sesiIni.id })) })

  const pastikanSesi = async () => {
    if (sesiIni) return sesiIni.id
    const kl = dasar.data.find((k) => k.class_id === kid)
    const r = await q(supabase.from('sesi_presensi').insert({ course_id: kl.course_id, class_id: kid, pertemuan_ke: Number(ke) }).select('id').single())
    return r.id
  }
  const catat = (npm, status) => aksi(async () => {
    const sid = await pastikanSesi()
    if (!status) await q(supabase.from('presensi').delete().eq('sesi_id', sid).eq('npm', npm))
    else await q(supabase.from('presensi').upsert({ sesi_id: sid, npm, status, sumber: 'Manual' }, { onConflict: 'sesi_id,npm' }))
  })
  const isiAlpa = () => aksi(async () => {
    const sid = await pastikanSesi()
    const sudah = new Set(data.pres.filter((p) => p.sesi_id === sid).map((p) => p.npm))
    const baru = data.mhs.filter((m) => !sudah.has(m.npm)).map((m) => ({ sesi_id: sid, npm: m.npm, status: 'Alpa', sumber: 'Manual' }))
    if (baru.length) await q(supabase.from('presensi').insert(baru))
  })

  const statusDari = (sid, npm) => data.pres.find((p) => p.sesi_id === sid && p.npm === npm)

  const rekap = data?.mhs.map((m) => {
    const mine = data.pres.filter((p) => p.npm === m.npm)
    const c = Object.fromEntries(STATUS.map((s) => [s, mine.filter((p) => p.status === s).length]))
    return { ...m, ...c, persen: data.sesi.length ? Math.round((c.Hadir / data.sesi.length) * 100) : 0 }
  })

  return (
    <div>
      <Judul judul="Presensi" sub="Buka sesi berkode agar mahasiswa check-in sendiri, atau catat manual."
        aksi={<select className="input" value={kid || ''} onChange={(e) => setKelas(e.target.value)}>{dasar.data?.map((k) => <option key={k.class_id} value={k.class_id}>{k.nama_kelas || k.class_id}</option>)}</select>} />
      {(memuat || dasar.memuat) && <Spinner />}<Pesan jenis="err">{error || dasar.error || pesan}</Pesan>
      <div className="mb-4 flex gap-1 border-b">
        {[['sesi', 'Sesi pertemuan'], ['rekap', 'Rekap']].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={`border-b-4 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-gold-400 text-maroon-800' : 'border-transparent text-slate-500'}`}>{t}</button>
        ))}
      </div>
      {data && tab === 'sesi' && (
        <>
          <div className="card mb-5 flex flex-wrap items-end gap-4">
            <label className="text-sm"><span className="mb-1 block font-medium">Pertemuan ke-</span>
              <select className="input w-24" value={ke} onChange={(e) => setKe(Number(e.target.value))}>{Array.from({ length: 16 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Kode berlaku (menit)</span>
              <input type="number" className="input w-28" value={menit} onChange={(e) => setMenit(e.target.value)} /></label>
            {masihBuka
              ? <button className="btn-ghost" onClick={tutup}>Tutup sesi</button>
              : <button className="btn" onClick={buka}>{sesiIni ? 'Buka ulang (kode baru)' : 'Buka sesi'}</button>}
            {masihBuka && (
              <div className="rounded-2xl bg-maroon-700 px-6 py-2 text-center text-white">
                <p className="text-xs text-gold-400">Kode presensi</p>
                <p className="font-mono text-3xl font-bold tracking-[0.3em]">{data.kode[sesiIni.id]}</p>
                <p className="text-xs opacity-80">sampai {fmtTgl(sesiIni.dibuka_sampai)}</p>
              </div>
            )}
            <button className="btn-ghost ml-auto" onClick={isiAlpa}>Isi kosong = Alpa</button>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th><th className="th">Status</th><th className="th">Sumber</th></tr></thead>
              <tbody className="divide-y">
                {data.mhs.map((m) => {
                  const p = sesiIni && statusDari(sesiIni.id, m.npm)
                  return (
                    <tr key={m.npm}>
                      <td className="td font-mono">{m.npm}</td><td className="td">{m.mahasiswa?.nama}</td>
                      <td className="td"><select className="input w-28" value={p?.status || ''} onChange={(e) => catat(m.npm, e.target.value)}><option value="">—</option>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></td>
                      <td className="td text-xs text-slate-500">{p ? p.sumber : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && tab === 'rekap' && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm"><span>{data.sesi.length} pertemuan tercatat</span>
            <button className="btn-ghost" onClick={() => unduhCSV(`rekap-presensi-${kid}.csv`, [['NPM', 'Nama', ...STATUS, '% Hadir'], ...rekap.map((r) => [r.npm, r.mahasiswa?.nama, ...STATUS.map((s) => r[s]), r.persen])])}>Unduh CSV</button></div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th>{STATUS.map((s) => <th key={s} className="th">{s}</th>)}<th className="th">% Hadir</th></tr></thead>
              <tbody className="divide-y">{rekap.map((r) => <tr key={r.npm}><td className="td font-mono">{r.npm}</td><td className="td">{r.mahasiswa?.nama}</td>{STATUS.map((s) => <td key={s} className="td">{r[s]}</td>)}<td className="td font-bold">{r.persen}%</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function Presensi() {
  const { profil } = useAuth()
  return profil.role === 'dosen' ? <PresensiDosen /> : <PresensiMhs />
}
