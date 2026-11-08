import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'
import { useMuat, q, Judul, Spinner, Pesan, Modal, Bidang, fmtTgl, angka, keInputTgl, dariInputTgl, acak, ambilSemua } from '../ui.jsx'

async function bukaTugas(t) {
  if (t.drive_url && !t.file_path) return window.open(t.drive_url, '_blank', 'noopener')
  const { data, error } = await supabase.storage.from('tugas').createSignedUrl(t.file_path, 300)
  if (error) return alert(error.message)
  window.open(data.signedUrl, '_blank', 'noopener')
}

/* ───────────── MAHASISWA ───────────── */
function TugasMhs() {
  const { profil } = useAuth()
  const { aktif } = useKuliah()
  const [sibuk, setSibuk] = useState(null)
  const [pesan, setPesan] = useState(null)
  const [berkas, setBerkas] = useState({})
  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!aktif) return { daftar: [], kirim: [] }
    const daftar = await q(supabase.from('daftar_tugas').select('*, pertemuan!inner(course_id)').eq('pertemuan.course_id', aktif.course_id).eq('status', 'Aktif').order('tugas_ke'))
    const kirim = await q(supabase.from('tugas').select('*').order('submitted_at', { ascending: false }))
    return { daftar, kirim }
  }, [aktif?.course_id])

  const unggah = async (d) => {
    const f = berkas[d.assignment_id]
    setPesan(null)
    try {
      if (!f) throw new Error('Pilih berkas PDF terlebih dahulu.')
      if (f.type !== 'application/pdf') throw new Error('Berkas harus berformat PDF.')
      if (f.size > (d.max_mb || 5) * 1024 * 1024) throw new Error(`Ukuran maksimal ${d.max_mb || 5} MB.`)
      setSibuk(d.assignment_id)
      const path = `${profil.npm}/${d.assignment_id}_${Date.now()}.pdf`
      const { error: e1 } = await supabase.storage.from('tugas').upload(path, f, { contentType: 'application/pdf' })
      if (e1) throw e1
      await q(supabase.from('tugas').insert({ assignment_id: d.assignment_id, npm: profil.npm, file_name: f.name, file_path: path }))
      setBerkas({ ...berkas, [d.assignment_id]: null })
      setPesan({ j: 'ok', t: 'Tugas terkirim.' }); ulang()
    } catch (e) { setPesan({ j: 'err', t: e.message }) } finally { setSibuk(null) }
  }

  return (
    <div>
      <Judul judul="Tugas" sub="Unggah berkas PDF. Pengumpulan ulang diperbolehkan; yang dinilai adalah kiriman terbaru." />
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>
      {pesan && <div className="mb-4"><Pesan jenis={pesan.j}>{pesan.t}</Pesan></div>}
      <div className="space-y-5">
        {data?.daftar.map((d) => {
          const riwayat = data.kirim.filter((k) => k.assignment_id === d.assignment_id)
          const telat = d.deadline && new Date() > new Date(d.deadline)
          return (
            <section key={d.assignment_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-maroon-800">{d.judul}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${telat ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>Tenggat {fmtTgl(d.deadline)}</span>
              </div>
              {d.instruksi && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{d.instruksi}</p>}
              <p className="mt-2 text-xs text-slate-500">Keterlambatan lebih dari {d.late_grace_days} hari dikenai −{d.late_penalty_per_7_days} poin per 7 hari.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input type="file" accept="application/pdf" onChange={(e) => setBerkas({ ...berkas, [d.assignment_id]: e.target.files[0] })} />
                <button className="btn" disabled={sibuk === d.assignment_id} onClick={() => unggah(d)}>{sibuk === d.assignment_id ? 'Mengunggah…' : 'Unggah'}</button>
              </div>
              {riwayat.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead><tr><th className="th">Dikirim</th><th className="th">Berkas</th><th className="th">Terlambat</th><th className="th">Nilai</th><th className="th">Umpan balik</th></tr></thead>
                  <tbody className="divide-y">
                    {riwayat.map((k, i) => (
                      <tr key={k.submission_id} className={i ? 'text-slate-400' : ''}>
                        <td className="td">{fmtTgl(k.submitted_at)}</td>
                        <td className="td"><button className="text-maroon-700 underline" onClick={() => bukaTugas(k)}>{k.file_name || 'berkas'}</button></td>
                        <td className="td">{k.late_days ? `${k.late_days} hari${k.late_penalty_points ? ` (−${k.late_penalty_points})` : ''}` : '—'}</td>
                        <td className="td font-bold">{k.final_score === null ? 'Belum dinilai' : angka(k.final_score)}</td>
                        <td className="td whitespace-pre-wrap">{k.feedback || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
        {data && !data.daftar.length && <Pesan>Belum ada tugas aktif.</Pesan>}
      </div>
    </div>
  )
}

/* ───────────── DOSEN ───────────── */
function FormTugas({ awal, mk, onSelesai }) {
  const [f, setF] = useState({ ...awal, deadline: keInputTgl(awal.deadline) })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const simpan = async (e) => {
    e.preventDefault()
    try {
      const isi = {
        judul: f.judul, instruksi: f.instruksi || null, deadline: dariInputTgl(f.deadline), status: f.status,
        late_grace_days: Number(f.late_grace_days), late_penalty_per_7_days: Number(f.late_penalty_per_7_days), max_mb: Number(f.max_mb),
      }
      if (awal.assignment_id) await q(supabase.from('daftar_tugas').update(isi).eq('assignment_id', awal.assignment_id))
      else {
        const mid = 'MTG-TASK-' + acak(8)
        await q(supabase.from('pertemuan').insert({ meeting_id: mid, course_id: mk.course_id, class_id: 'ALL', topik: f.judul, status: 'Aktif', assignment_open: true }))
        await q(supabase.from('daftar_tugas').insert({ assignment_id: 'ASG-' + acak(8), meeting_id: mid, tugas_ke: Number(f.tugas_ke) || null, ...isi }))
      }
      onSelesai()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal judul={awal.assignment_id ? 'Ubah tugas' : 'Tugas baru'} onTutup={() => onSelesai(false)}>
      <form onSubmit={simpan} className="space-y-3">
        <Bidang label="Judul"><input required className="input" value={f.judul || ''} onChange={set('judul')} /></Bidang>
        <Bidang label="Instruksi"><textarea rows={5} className="input" value={f.instruksi || ''} onChange={set('instruksi')} /></Bidang>
        <div className="grid gap-3 sm:grid-cols-2">
          <Bidang label="Tenggat"><input type="datetime-local" className="input" value={f.deadline} onChange={set('deadline')} /></Bidang>
          <Bidang label="Status"><select className="input" value={f.status} onChange={set('status')}><option>Aktif</option><option>Nonaktif</option></select></Bidang>
          <Bidang label="Toleransi terlambat (hari)"><input type="number" className="input" value={f.late_grace_days} onChange={set('late_grace_days')} /></Bidang>
          <Bidang label="Pengurang per 7 hari (poin)"><input type="number" step="0.5" className="input" value={f.late_penalty_per_7_days} onChange={set('late_penalty_per_7_days')} /></Bidang>
          <Bidang label="Ukuran maks. (MB)"><input type="number" className="input" value={f.max_mb} onChange={set('max_mb')} /></Bidang>
          {!awal.assignment_id && <Bidang label="Tugas ke-"><input type="number" className="input" value={f.tugas_ke || ''} onChange={set('tugas_ke')} /></Bidang>}
        </div>
        <Pesan jenis="err">{err}</Pesan>
        <button className="btn">Simpan</button>
      </form>
    </Modal>
  )
}

function Penilaian({ d }) {
  const { aktif } = useKuliah()
  const [semua, setSemua] = useState(false)
  const [edit, setEdit] = useState({})
  const [pesan, setPesan] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    const kirim = await ambilSemua((a, b) => supabase.from('tugas').select('*, mahasiswa(nama,kelas)').eq('assignment_id', d.assignment_id).order('submitted_at', { ascending: false }).range(a, b))
    const enr = await ambilSemua((a, b) => supabase.from('enrollments').select('npm,mahasiswa(nama,kelas)').eq('course_id', aktif.course_id).order('npm').range(a, b))
    const mhs = enr.map((e) => ({ npm: e.npm, nama: e.mahasiswa?.nama, kelas: e.mahasiswa?.kelas }))
    return { kirim, mhs }
  }, [d.assignment_id, aktif?.course_id])

  const simpan = async (t) => {
    try {
      const e = edit[t.submission_id] || {}
      const patch = {}
      if ('nilai' in e) patch.manual_score = e.nilai === '' ? null : Number(e.nilai)
      if ('fb' in e) patch.feedback = e.fb
      if (!Object.keys(patch).length) return
      await q(supabase.from('tugas').update(patch).eq('submission_id', t.submission_id))
      setPesan(`Tersimpan: ${t.npm}`); ulang()
    } catch (e2) { setPesan(e2.message) }
  }

  if (memuat) return <Spinner />
  if (error) return <Pesan jenis="err">{error}</Pesan>
  const terbaru = {}
  data.kirim.forEach((k) => { if (!terbaru[k.npm]) terbaru[k.npm] = k })
  const baris = semua ? data.kirim : Object.values(terbaru)
  const belum = data.mhs.filter((m) => !terbaru[m.npm])
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <span><b>{Object.keys(terbaru).length}</b> mengumpulkan · <b>{belum.length}</b> belum</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan semua kiriman</label>
        <span className="text-emerald-700">{pesan}</span>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th><th className="th">Dikirim</th><th className="th">Terlambat</th><th className="th">Berkas</th><th className="th">Nilai</th><th className="th">Setelah pengurang</th><th className="th">Umpan balik</th><th className="th" /></tr></thead>
          <tbody className="divide-y">
            {baris.map((t) => (
              <tr key={t.submission_id}>
                <td className="td font-mono">{t.npm}</td><td className="td">{t.mahasiswa?.nama}</td><td className="td">{fmtTgl(t.submitted_at)}</td>
                <td className="td">{t.late_days ? `${t.late_days} hr${t.late_penalty_points ? ` (−${t.late_penalty_points})` : ''}` : '—'}</td>
                <td className="td"><button className="text-maroon-700 underline" onClick={() => bukaTugas(t)}>Buka</button></td>
                <td className="td"><input type="number" step="0.5" className="input w-20" defaultValue={t.manual_score ?? ''} onChange={(e) => setEdit({ ...edit, [t.submission_id]: { ...edit[t.submission_id], nilai: e.target.value } })} /></td>
                <td className="td font-bold">{angka(t.final_score)}</td>
                <td className="td"><input className="input min-w-[10rem]" defaultValue={t.feedback || ''} onChange={(e) => setEdit({ ...edit, [t.submission_id]: { ...edit[t.submission_id], fb: e.target.value } })} /></td>
                <td className="td"><button className="btn-ghost" onClick={() => simpan(t)}>Simpan</button></td>
              </tr>
            ))}
            {!baris.length && <tr><td className="td text-slate-500" colSpan={9}>Belum ada kiriman.</td></tr>}
          </tbody>
        </table>
      </div>
      {belum.length > 0 && (
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-maroon-800">Belum mengumpulkan ({belum.length})</summary>
          <p className="mt-2 text-sm text-slate-600">{belum.map((m) => `${m.npm} ${m.nama}`).join(' · ')}</p></details>
      )}
    </div>
  )
}

function TugasDosen() {
  const { aktif } = useKuliah()
  const [pilih, setPilih] = useState(null)
  const [form, setForm] = useState(null)
  const { data, error, memuat, ulang } = useMuat(async () => {
    const mk = aktif
    if (!mk) return { mk: null, daftar: [] }
    const daftar = await q(supabase.from('daftar_tugas').select('*, pertemuan!inner(course_id)').eq('pertemuan.course_id', mk.course_id).order('tugas_ke'))
    return { mk, daftar }
  }, [aktif?.course_id])
  const d = data?.daftar.find((x) => x.assignment_id === pilih)
  return (
    <div>
      <Judul judul="Tugas" sub="Pantau pengumpulan, beri nilai dan umpan balik. Pengurang keterlambatan dihitung otomatis." aksi={<button className="btn" onClick={() => setForm({ status: 'Aktif', late_grace_days: 7, late_penalty_per_7_days: 5, max_mb: 5 })}>+ Tugas</button>} />
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>
      <div className="mb-5 flex flex-wrap gap-2">
        {data?.daftar.map((x) => (
          <button key={x.assignment_id} onClick={() => setPilih(x.assignment_id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${pilih === x.assignment_id ? 'bg-maroon-700 text-white ring-maroon-700' : 'bg-white text-slate-700 ring-slate-300'} ${x.status !== 'Aktif' ? 'opacity-60' : ''}`}>
            {x.judul || x.assignment_id}
          </button>
        ))}
      </div>
      {d && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Tenggat: <b>{fmtTgl(d.deadline)}</b> · Status: <b>{d.status}</b></span>
          <button className="btn-ghost" onClick={() => setForm(d)}>Ubah tugas</button>
        </div>
      )}
      {d && <Penilaian key={d.assignment_id} d={d} />}
      {data && !d && <Pesan>Pilih tugas di atas.</Pesan>}
      {form && <FormTugas awal={form} mk={data.mk} onSelesai={(ok = true) => { setForm(null); if (ok) ulang() }} />}
    </div>
  )
}

export default function Tugas() {
  const { profil } = useAuth()
  return profil.role === 'dosen' ? <TugasDosen /> : <TugasMhs />
}
