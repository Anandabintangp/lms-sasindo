import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useMuat, q, Judul, Spinner, Pesan, Modal, Bidang, fmtTgl, angka, keInputTgl, dariInputTgl, acak, ambilSemua, Gambar } from '../ui.jsx'
import { useKuliah } from '../kuliah.jsx'

const namaKuis = (p) => (p.quiz_ke ? `Kuis ${p.quiz_ke}` : p.topik || p.meeting_id)

/* ───────────────────────── MAHASISWA ───────────────────────── */

function Kerjakan({ meeting, onSelesai }) {
  const [mulai, setMulai] = useState(null)
  const [err, setErr] = useState('')
  const [jwb, setJwb] = useState({})
  const [sisa, setSisa] = useState(null)
  const [tab, setTab] = useState(0)
  const [kirim, setKirim] = useState(false)
  const ref = useRef({ jwb: {}, tab: 0, keluarDetik: 0, hilangSejak: null, selesai: false })
  const akhirRef = useRef(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await q(supabase.rpc('mulai_kuis', { p_meeting: meeting.meeting_id }))
        if (r.sudah_kirim) { onSelesai('Kuis ini sudah dikirim.'); return }
        const offset = new Date(r.sekarang).getTime() - Date.now()
        akhirRef.current = new Date(r.started_at).getTime() + r.durasi_menit * 60000 - offset
        ref.current.jwb = r.jawaban || {}; ref.current.tab = r.tab || 0
        setJwb(r.jawaban || {}); setTab(r.tab || 0); setMulai(r)
      } catch (e) { setErr(e.message) }
    })()
  }, [meeting.meeting_id])

  const kirimSekarang = async (otomatis = false) => {
    if (ref.current.selesai) return
    ref.current.selesai = true; setKirim(true)
    try {
      await q(supabase.rpc('kirim_kuis', { p_meeting: meeting.meeting_id, p_jawaban: ref.current.jwb, p_tab: ref.current.tab, p_exit_sec: Math.round(ref.current.keluarDetik) }))
      onSelesai(otomatis ? 'Waktu habis — jawaban Anda terkirim otomatis.' : 'Jawaban terkirim. Terima kasih!')
    } catch (e) { ref.current.selesai = false; setKirim(false); setErr(e.message) }
  }

  useEffect(() => {
    if (!mulai) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((akhirRef.current - Date.now()) / 1000))
      setSisa(s)
      if (s <= 0) kirimSekarang(true)
    }, 1000)
    const simpan = setInterval(() => {
      if (!ref.current.selesai) supabase.rpc('simpan_draft', { p_meeting: meeting.meeting_id, p_jawaban: ref.current.jwb, p_tab: ref.current.tab })
    }, 15000)
    const vis = () => {
      if (document.hidden) { ref.current.hilangSejak = Date.now() }
      else if (ref.current.hilangSejak) {
        ref.current.keluarDetik += (Date.now() - ref.current.hilangSejak) / 1000
        ref.current.hilangSejak = null; ref.current.tab += 1; setTab(ref.current.tab)
        supabase.rpc('simpan_draft', { p_meeting: meeting.meeting_id, p_jawaban: ref.current.jwb, p_tab: ref.current.tab })
      }
    }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); clearInterval(simpan); document.removeEventListener('visibilitychange', vis) }
  }, [mulai])

  const isi = (id, v) => { ref.current.jwb = { ...ref.current.jwb, [id]: v }; setJwb(ref.current.jwb) }
  if (err && !mulai) return <Pesan jenis="err">{err}</Pesan>
  if (!mulai) return <Spinner teks="Menyiapkan kuis…" />
  const mm = String(Math.floor((sisa ?? 0) / 60)).padStart(2, '0'), ss = String((sisa ?? 0) % 60).padStart(2, '0')
  return (
    <div>
      <div className="sticky top-[88px] z-30 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-maroon-700 px-5 py-3 text-white shadow">
        <span className="font-bold">{namaKuis(meeting)}</span>
        <span className="text-sm">Pindah tab: <b>{tab}</b> {meeting.max_tab_switch ? `(batas ${meeting.max_tab_switch}, tiap pelanggaran −${meeting.tab_penalty_points} poin)` : ''}</span>
        <span className={`rounded-full px-4 py-1 font-mono text-lg font-bold ${sisa < 120 ? 'bg-red-500' : 'bg-gold-400 text-maroon-900'}`}>{mm}:{ss}</span>
      </div>
      <Pesan jenis="err">{err}</Pesan>
      <ol className="mt-4 space-y-5">
        {mulai.soal.map((s, i) => (
          <li key={s.question_id} className="card">
            <p className="mb-3 whitespace-pre-wrap font-medium"><span className="mr-2 font-bold text-maroon-700">{i + 1}.</span>{s.pertanyaan} <span className="text-xs text-slate-400">({angka(s.skor_maks)} poin)</span></p>
            <Gambar path={s.gambar_path} />
            {s.tipe === 'Pilihan Ganda' ? (
              <div className="space-y-2">
                {['a', 'b', 'c', 'd'].filter((o) => s['opsi_' + o]).map((o) => (
                  <label key={o} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${jwb[s.question_id] === o.toUpperCase() ? 'border-maroon-700 bg-maroon-50' : 'border-slate-200'}`}>
                    <input type="radio" name={s.question_id} checked={jwb[s.question_id] === o.toUpperCase()} onChange={() => isi(s.question_id, o.toUpperCase())} />
                    <span><b>{o.toUpperCase()}.</b> {s['opsi_' + o]}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea className="input" rows={6} value={jwb[s.question_id] || ''} onChange={(e) => isi(s.question_id, e.target.value)} placeholder="Tulis jawaban Anda…" />
            )}
          </li>
        ))}
      </ol>
      <div className="mt-6 flex justify-end">
        <button className="btn" disabled={kirim} onClick={() => confirm('Kirim jawaban sekarang? Setelah dikirim tidak bisa diubah.') && kirimSekarang(false)}>{kirim ? 'Mengirim…' : 'Kirim jawaban'}</button>
      </div>
    </div>
  )
}

function KuisMhs() {
  const { profil } = useAuth()
  const { aktif: mk } = useKuliah()
  const [aktif, setAktif] = useState(null)
  const [pesan, setPesan] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!mk) return { kuis: [], sub: [], ulangi: new Set() }
    const kuis = await q(supabase.from('pertemuan').select('*').eq('course_id', mk.course_id).eq('quiz_open', true).eq('status', 'Aktif').order('quiz_ke'))
    const sub = await q(supabase.from('quiz_submissions').select('meeting_id,final_score,submitted_at,attempt_no,status').order('attempt_no'))
    const ulangi = await q(supabase.from('quiz_retake_permissions').select('meeting_id').eq('status', 'Allowed'))
    return { kuis, sub, ulangi: new Set(ulangi.map((u) => u.meeting_id)) }
  }, [mk?.course_id])

  if (aktif) return <Kerjakan meeting={aktif} onSelesai={(t) => { setAktif(null); setPesan(t); ulang() }} />
  return (
    <div>
      <Judul judul="Kuis" sub="Kerjakan sekali; jawaban tersimpan otomatis. Berpindah tab/jendela dicatat dan dapat mengurangi nilai." />
      {pesan && <div className="mb-4"><Pesan jenis="ok">{pesan}</Pesan></div>}
      {memuat && <Spinner />}
      <Pesan jenis="err">{error}</Pesan>
      {data && !data.kuis.length && <Pesan>Belum ada kuis yang dibuka.</Pesan>}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.kuis.map((k) => {
          const s = data.sub.filter((x) => x.meeting_id === k.meeting_id).pop()
          const boleh = !s || data.ulangi.has(k.meeting_id)
          return (
            <div key={k.meeting_id} className="card">
              <h3 className="text-lg font-bold text-maroon-800">{namaKuis(k)}</h3>
              <p className="text-sm text-slate-600">{k.topik}</p>
              <p className="mt-2 text-xs text-slate-500">Durasi {k.quiz_duration_min} menit · Batas {fmtTgl(k.quiz_deadline)}</p>
              {s && <p className="mt-2 text-sm">Terkirim {fmtTgl(s.submitted_at)} · Nilai sementara: <b>{angka(s.final_score)}</b></p>}
              <div className="mt-4">{boleh ? <button className="btn" onClick={() => setAktif(k)}>{s ? 'Kerjakan ulang' : 'Mulai kuis'}</button> : <span className="text-sm text-slate-500">Sudah dikerjakan</span>}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── DOSEN ───────────────────────── */

const SOAL_KOSONG = { tipe: 'Pilihan Ganda', pertanyaan: '', opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '', jawaban_benar: '', kata_kunci_esai: '', skor_maks: 10, status: 'Aktif' }

function Pengaturan({ p, onSimpan }) {
  const [f, setF] = useState({ ...p, quiz_deadline: keInputTgl(p.quiz_deadline) })
  const [pesan, setPesan] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const simpan = async () => {
    try {
      await q(supabase.from('pertemuan').update({
        quiz_open: f.quiz_open, quiz_duration_min: Number(f.quiz_duration_min), quiz_deadline: dariInputTgl(f.quiz_deadline),
        max_tab_switch: Number(f.max_tab_switch), tab_penalty_points: Number(f.tab_penalty_points), topik: f.topik,
      }).eq('meeting_id', p.meeting_id))
      setPesan('Tersimpan.'); onSimpan()
    } catch (e) { setPesan(e.message) }
  }
  return (
    <div className="card max-w-2xl space-y-4">
      <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={!!f.quiz_open} onChange={set('quiz_open')} /> Kuis dibuka untuk mahasiswa</label>
      <Bidang label="Topik"><input className="input" value={f.topik || ''} onChange={set('topik')} /></Bidang>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bidang label="Durasi (menit)"><input type="number" className="input" value={f.quiz_duration_min ?? ''} onChange={set('quiz_duration_min')} /></Bidang>
        <Bidang label="Batas pengerjaan"><input type="datetime-local" className="input" value={f.quiz_deadline} onChange={set('quiz_deadline')} /></Bidang>
        <Bidang label="Batas pindah tab"><input type="number" className="input" value={f.max_tab_switch ?? ''} onChange={set('max_tab_switch')} /></Bidang>
        <Bidang label="Pengurang per pindah tab (poin)"><input type="number" step="0.5" className="input" value={f.tab_penalty_points ?? ''} onChange={set('tab_penalty_points')} /></Bidang>
      </div>
      <div className="flex items-center gap-3"><button className="btn" onClick={simpan}>Simpan</button><span className="text-sm text-slate-600">{pesan}</span></div>
    </div>
  )
}

function Soal({ meetingId }) {
  const [edit, setEdit] = useState(null)
  const [pesan, setPesan] = useState('')
  const { data, error, memuat, ulang } = useMuat(() => q(supabase.from('soal_quiz').select('*').eq('meeting_id', meetingId).order('urutan')), [meetingId])
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })
  const unggahGambar = async (f) => {
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { setPesan('Gambar maksimal 3 MB.'); return }
    const path = `${meetingId}/${acak(10)}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`
    const { error: e1 } = await supabase.storage.from('soal').upload(path, f, { contentType: f.type })
    if (e1) { setPesan(e1.message); return }
    setEdit((x) => ({ ...x, gambar_path: path }))
  }
  const simpan = async (e) => {
    e.preventDefault()
    try {
      const baris = { ...edit, meeting_id: meetingId, skor_maks: Number(edit.skor_maks), urutan: Number(edit.urutan || (data.length + 1)) }
      if (!baris.question_id) baris.question_id = 'Q-' + acak(8)
      await q(supabase.from('soal_quiz').upsert(baris))
      setEdit(null); ulang()
    } catch (e2) { setPesan(e2.message) }
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-600">{data?.length || 0} soal · kunci jawaban hanya terlihat oleh dosen.</p><button className="btn" onClick={() => setEdit({ ...SOAL_KOSONG })}>+ Soal</button></div>
      {memuat && <Spinner />}<Pesan jenis="err">{error || pesan}</Pesan>
      <ol className="space-y-3">
        {data?.map((s) => (
          <li key={s.question_id} className={`card ${s.status !== 'Aktif' ? 'opacity-50' : ''}`}>
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">#{s.urutan} · {s.tipe} · {angka(s.skor_maks)} poin{s.status !== 'Aktif' && ' · nonaktif'}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium">{s.pertanyaan}</p>
                <Gambar path={s.gambar_path} className="max-h-40" />
                {s.tipe === 'Pilihan Ganda'
                  ? <p className="mt-1 text-xs text-slate-600">Kunci: <b>{s.jawaban_benar}</b></p>
                  : <p className="mt-1 text-xs text-slate-600">Kata kunci: {s.kata_kunci_esai || '—'}</p>}
              </div>
              <button className="btn-ghost h-fit" onClick={() => setEdit(s)}>Ubah</button>
            </div>
          </li>
        ))}
      </ol>
      {edit && (
        <Modal judul={edit.question_id ? 'Ubah soal' : 'Soal baru'} onTutup={() => setEdit(null)}>
          <form onSubmit={simpan} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Bidang label="Jenis"><select className="input" value={edit.tipe} onChange={set('tipe')}><option>Pilihan Ganda</option><option>Essay</option></select></Bidang>
              <Bidang label="Skor maksimum"><input type="number" step="0.25" className="input" value={edit.skor_maks} onChange={set('skor_maks')} /></Bidang>
              <Bidang label="Urutan"><input type="number" className="input" value={edit.urutan || ''} onChange={set('urutan')} /></Bidang>
            </div>
            <Bidang label="Pertanyaan"><textarea required rows={4} className="input" value={edit.pertanyaan} onChange={set('pertanyaan')} /></Bidang>
            <Bidang label="Gambar (opsional)" bantu="JPG/PNG/WebP, maksimal 3 MB.">
              <Gambar path={edit.gambar_path} className="max-h-40" />
              <input type="file" accept="image/*" onChange={(e) => unggahGambar(e.target.files[0])} />
              {edit.gambar_path && <button type="button" className="btn-ghost mt-2" onClick={() => setEdit({ ...edit, gambar_path: null })}>Hapus gambar</button>}
            </Bidang>
            {edit.tipe === 'Pilihan Ganda' ? (
              <>
                {['a', 'b', 'c', 'd'].map((o) => <Bidang key={o} label={`Opsi ${o.toUpperCase()}`}><input className="input" value={edit['opsi_' + o] || ''} onChange={set('opsi_' + o)} /></Bidang>)}
                <Bidang label="Kunci jawaban"><select className="input" value={edit.jawaban_benar || ''} onChange={set('jawaban_benar')}><option value="">—</option>{['A', 'B', 'C', 'D'].map((x) => <option key={x}>{x}</option>)}</select></Bidang>
              </>
            ) : (
              <Bidang label="Kata kunci penilaian otomatis" bantu="Pisahkan dengan koma. Skor = skor maks × (kata kunci yang muncul ÷ jumlah kata kunci). Dosen tetap bisa mengoreksi manual."><textarea rows={3} className="input" value={edit.kata_kunci_esai || ''} onChange={set('kata_kunci_esai')} /></Bidang>
            )}
            <Bidang label="Status"><select className="input" value={edit.status} onChange={set('status')}><option>Aktif</option><option>Nonaktif</option></select></Bidang>
            <button className="btn">Simpan</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Hasil({ p }) {
  const [pilih, setPilih] = useState(null)
  const [pesan, setPesan] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    const sub = await q(supabase.from('quiz_submissions').select('*, mahasiswa(nama,kelas)').eq('meeting_id', p.meeting_id).order('submitted_at', { ascending: false }))
    return sub
  }, [p.meeting_id])

  const izinkan = async (npm) => {
    if (!confirm(`Izinkan ${npm} mengerjakan ulang?`)) return
    try { await q(supabase.from('quiz_retake_permissions').insert({ npm, meeting_id: p.meeting_id, reason: 'Diizinkan dosen' })); setPesan(`${npm} boleh mengerjakan ulang.`) }
    catch (e) { setPesan(e.message) }
  }
  return (
    <div>
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>{pesan && <div className="mb-3"><Pesan jenis="ok">{pesan}</Pesan></div>}
      {data && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th><th className="th">Dikirim</th><th className="th">Ke-</th><th className="th">Pindah tab</th><th className="th">Sebelum pengurang</th><th className="th">Pengurang</th><th className="th">Nilai</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y">
              {data.map((s) => (
                <tr key={s.submission_id}>
                  <td className="td font-mono">{s.npm}</td><td className="td">{s.mahasiswa?.nama}</td><td className="td">{fmtTgl(s.submitted_at)}</td>
                  <td className="td">{s.attempt_no}</td><td className="td">{s.tab_switch_count}</td><td className="td">{angka(s.score_before_penalty)}</td>
                  <td className="td">{angka(s.penalty_total)}</td><td className="td font-bold">{angka(s.final_score)}</td><td className="td text-xs">{s.status}</td>
                  <td className="td whitespace-nowrap text-right"><button className="btn-ghost mr-1" onClick={() => setPilih(s)}>Jawaban</button><button className="btn-ghost" onClick={() => izinkan(s.npm)}>Izinkan ulang</button></td>
                </tr>
              ))}
              {!data.length && <tr><td className="td text-slate-500" colSpan={10}>Belum ada pengiriman.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {pilih && <Jawaban sub={pilih} onTutup={() => { setPilih(null); ulang() }} />}
    </div>
  )
}

function Jawaban({ sub, onTutup }) {
  const [nilai, setNilai] = useState({})
  const [pesan, setPesan] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    const r = await q(supabase.from('respon_quiz').select('*').eq('submission_id', sub.submission_id))
    const s = await q(supabase.from('soal_quiz').select('question_id,urutan,pertanyaan,gambar_path,jawaban_benar,kata_kunci_esai,skor_maks').eq('meeting_id', sub.meeting_id))
    const peta = Object.fromEntries(s.map((x) => [x.question_id, x]))
    return r.map((x) => ({ ...x, soal: peta[x.question_id] || {} })).sort((a, b) => (a.soal.urutan || 0) - (b.soal.urutan || 0))
  }, [sub.submission_id])

  const simpan = async (r) => {
    try {
      const v = nilai[r.response_id]
      await q(supabase.from('respon_quiz').update({ manual_score: v === '' || v === undefined ? null : Number(v), catatan_dosen: nilai['c' + r.response_id] ?? r.catatan_dosen }).eq('response_id', r.response_id))
      setPesan('Tersimpan; nilai total otomatis dihitung ulang.'); ulang()
    } catch (e) { setPesan(e.message) }
  }
  return (
    <Modal judul={`Jawaban ${sub.npm} — ${sub.mahasiswa?.nama || ''}`} onTutup={onTutup} lebar="max-w-4xl">
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>{pesan && <div className="mb-3"><Pesan jenis="ok">{pesan}</Pesan></div>}
      <ol className="space-y-4">
        {data?.map((r) => (
          <li key={r.response_id} className="rounded-xl border p-4">
            <p className="whitespace-pre-wrap text-sm font-medium">{r.soal.urutan}. {r.soal.pertanyaan}</p>
            <Gambar path={r.soal.gambar_path} className="max-h-40" />
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{r.jawaban || <i className="text-slate-400">(kosong)</i>}</p>
            {r.tipe_soal === 'Pilihan Ganda'
              ? <p className="mt-2 text-xs">Kunci: <b>{r.soal.jawaban_benar}</b> · {r.is_correct ? <span className="text-emerald-700">benar</span> : <span className="text-red-700">salah</span>} · skor {angka(r.final_score)}</p>
              : (
                <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                  <span className="text-xs text-slate-500">Kata kunci: {r.soal.kata_kunci_esai || '—'} · otomatis {angka(r.auto_score)} / {angka(r.soal.skor_maks)}</span>
                  <input type="number" step="0.25" className="input w-24" placeholder="Nilai" defaultValue={r.manual_score ?? ''} onChange={(e) => setNilai({ ...nilai, [r.response_id]: e.target.value })} />
                  <input className="input min-w-[12rem] flex-1" placeholder="Catatan" defaultValue={r.catatan_dosen || ''} onChange={(e) => setNilai({ ...nilai, ['c' + r.response_id]: e.target.value })} />
                  <button className="btn" onClick={() => simpan(r)}>Simpan</button>
                </div>
              )}
          </li>
        ))}
      </ol>
    </Modal>
  )
}

function Distribusi({ p }) {
  const { data, error, memuat } = useMuat(async () => {
    const soal = await q(supabase.from('soal_quiz').select('question_id,urutan,pertanyaan,gambar_path,tipe,jawaban_benar,opsi_a,opsi_b,opsi_c,opsi_d').eq('meeting_id', p.meeting_id).order('urutan'))
    const resp = await ambilSemua((a, b) => supabase.from('respon_quiz').select('question_id,jawaban,is_correct').eq('meeting_id', p.meeting_id).range(a, b))
    return { soal, resp }
  }, [p.meeting_id])
  if (memuat) return <Spinner />
  if (error) return <Pesan jenis="err">{error}</Pesan>
  return (
    <ol className="space-y-4">
      {data.soal.filter((s) => s.tipe === 'Pilihan Ganda').map((s) => {
        const r = data.resp.filter((x) => x.question_id === s.question_id)
        const n = r.length || 1
        return (
          <li key={s.question_id} className="card">
            <p className="mb-2 text-sm font-medium">{s.urutan}. {s.pertanyaan}</p>
            <Gambar path={s.gambar_path} className="max-h-40" />
            {['A', 'B', 'C', 'D'].filter((o) => s['opsi_' + o.toLowerCase()]).map((o) => {
              const c = r.filter((x) => (x.jawaban || '').toUpperCase() === o).length
              return (
                <div key={o} className="mb-1 flex items-center gap-2 text-xs">
                  <span className={`w-5 font-bold ${o === s.jawaban_benar ? 'text-emerald-700' : ''}`}>{o}</span>
                  <div className="h-4 flex-1 rounded bg-slate-100"><div className={`h-4 rounded ${o === s.jawaban_benar ? 'bg-emerald-500' : 'bg-maroon-600/70'}`} style={{ width: `${(c / n) * 100}%` }} /></div>
                  <span className="w-20 text-right">{c} ({Math.round((c / n) * 100)}%)</span>
                </div>
              )
            })}
          </li>
        )
      })}
    </ol>
  )
}

function KuisDosen() {
  const { aktif: mk } = useKuliah()
  const [pilih, setPilih] = useState(null)
  const [tabAktif, setTabAktif] = useState('hasil')
  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!mk) return []
    const per = await q(supabase.from('pertemuan').select('*').eq('course_id', mk.course_id).neq('status', 'Dihapus').order('quiz_ke', { nullsFirst: false }).order('pertemuan_ke'))
    const soal = await ambilSemua((a, b) => supabase.from('soal_quiz').select('meeting_id,pertemuan!inner(course_id)').eq('pertemuan.course_id', mk.course_id).range(a, b))
    const ada = new Set(soal.map((s) => s.meeting_id))
    return per.filter((p) => p.quiz_ke || ada.has(p.meeting_id))
  }, [mk?.course_id])
  const [baruKuis, setBaruKuis] = useState('')
  const buatKuis = async () => {
    try {
      const ke = Math.max(0, ...(data || []).map((x) => x.quiz_ke || 0)) + 1
      const id = 'MTG-' + acak(8)
      await q(supabase.from('pertemuan').insert({ meeting_id: id, course_id: mk.course_id, class_id: 'ALL', pertemuan_ke: ke, topik: baruKuis || `Kuis ${ke}`, quiz_ke: ke, quiz_open: false, status: 'Aktif', assessment_type: 'Kuis' }))
      setBaruKuis(''); await ulang(); setPilih(id); setTabAktif('soal')
    } catch (e) { alert(e.message) }
  }
  const p = data?.find((x) => x.meeting_id === pilih)
  return (
    <div>
      <Judul judul="Kuis" sub="Buka/tutup kuis, kelola soal, lihat hasil dan koreksi esai." />
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>
      {mk && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Topik kuis baru (opsional)" value={baruKuis} onChange={(e) => setBaruKuis(e.target.value)} />
          <button className="btn" onClick={buatKuis}>+ Kuis baru</button>
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-2">
        {data?.map((x) => (
          <button key={x.meeting_id} onClick={() => setPilih(x.meeting_id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${pilih === x.meeting_id ? 'bg-maroon-700 text-white ring-maroon-700' : 'bg-white text-slate-700 ring-slate-300'}`}>
            {namaKuis(x)} {x.quiz_open && <span className="ml-1 text-gold-400">●</span>}
          </button>
        ))}
      </div>
      {p && (
        <>
          <div className="mb-4 flex gap-1 border-b">
            {[['hasil', 'Hasil'], ['analisis', 'Pilihan ganda'], ['soal', 'Soal'], ['atur', 'Pengaturan']].map(([k, t]) => (
              <button key={k} onClick={() => setTabAktif(k)} className={`border-b-4 px-4 py-2 text-sm font-semibold ${tabAktif === k ? 'border-gold-400 text-maroon-800' : 'border-transparent text-slate-500'}`}>{t}</button>
            ))}
          </div>
          {tabAktif === 'hasil' && <Hasil p={p} />}
          {tabAktif === 'analisis' && <Distribusi p={p} />}
          {tabAktif === 'soal' && <Soal meetingId={p.meeting_id} />}
          {tabAktif === 'atur' && <Pengaturan key={p.meeting_id} p={p} onSimpan={ulang} />}
        </>
      )}
      {data && !p && <Pesan>Pilih kuis di atas.</Pesan>}
    </div>
  )
}

export default function Kuis() {
  const { profil } = useAuth()
  return profil.role === 'dosen' ? <KuisDosen /> : <KuisMhs />
}
