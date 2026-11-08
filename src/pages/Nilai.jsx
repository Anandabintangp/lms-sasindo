import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'
import { useMuat, q, Judul, Spinner, Pesan, angka, unduhCSV, ambilSemua } from '../ui.jsx'

const labelKuis = (p) => (p.quiz_ke ? `Kuis ${p.quiz_ke}` : p.topik || p.meeting_id)

// kuis: kiriman terakhir per mahasiswa; tugas: kiriman terbaru per mahasiswa
function susun({ per, subs, daftar, tugas, nilai, mhs }) {
  const kolKuis = per.map((p) => ({ k: 'q:' + p.meeting_id, label: labelKuis(p), id: p.meeting_id }))
  const kolTugas = daftar.map((d, i) => ({ k: 't:' + d.assignment_id, label: d.tugas_ke ? `Tugas ${d.tugas_ke}` : d.judul || `Tugas ${i + 1}`, id: d.assignment_id }))
  const komp = [...new Set(nilai.map((n) => n.komponen))].sort()
  const baris = mhs.map((m) => {
    const sel = {}
    kolKuis.forEach((c) => {
      const s = subs.filter((x) => x.npm === m.npm && x.meeting_id === c.id).sort((a, b) => a.attempt_no - b.attempt_no).pop()
      sel[c.k] = s ? s.final_score : null
    })
    kolTugas.forEach((c) => {
      const t = tugas.filter((x) => x.npm === m.npm && x.assignment_id === c.id).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0]
      sel[c.k] = t ? t.final_score : null
    })
    komp.forEach((k) => { const n = nilai.find((x) => x.npm === m.npm && x.komponen === k); sel['n:' + k] = n ? n.nilai : null })
    return { ...m, sel }
  })
  return { kolKuis, kolTugas, komp, baris }
}

function NilaiMhs() {
  const { profil } = useAuth()
  const { aktif } = useKuliah()
  const { data, error, memuat } = useMuat(async () => {
    if (!aktif) return null
    const cid = aktif.course_id
    const [per, subs0, daftar0, tugas0, nilai] = await Promise.all([
      q(supabase.from('pertemuan').select('meeting_id,quiz_ke,topik').eq('course_id', cid).neq('status', 'Dihapus').not('quiz_ke', 'is', null).order('quiz_ke')),
      q(supabase.from('quiz_submissions').select('meeting_id,npm,final_score,attempt_no')),
      q(supabase.from('daftar_tugas').select('assignment_id,judul,tugas_ke,pertemuan!inner(course_id)').eq('pertemuan.course_id', cid).order('tugas_ke')),
      q(supabase.from('tugas').select('assignment_id,npm,final_score,submitted_at')),
      q(supabase.from('nilai').select('komponen,npm,nilai,catatan').eq('course_id', cid)),
    ])
    const idq = new Set(per.map((p) => p.meeting_id)); const idt = new Set(daftar0.map((d) => d.assignment_id))
    return susun({ per, subs: subs0.filter((s) => idq.has(s.meeting_id)), daftar: daftar0, tugas: tugas0.filter((t) => idt.has(t.assignment_id)), nilai, mhs: [{ npm: profil.npm }] })
  }, [aktif?.course_id])
  const baris = data?.baris[0]
  const kolom = data ? [...data.kolKuis, ...data.kolTugas, ...data.komp.map((k) => ({ k: 'n:' + k, label: k }))] : []
  return (
    <div>
      <Judul judul="Nilai" sub="Nilai kuis sudah memperhitungkan pengurang pindah tab; nilai tugas memperhitungkan keterlambatan." />
      {memuat && <Spinner />}<Pesan jenis="err">{error}</Pesan>
      {baris && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kolom.map((c) => (
            <div key={c.k} className="card">
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-maroon-800">{baris.sel[c.k] === null ? <span className="text-base font-normal text-slate-400">belum ada / belum dinilai</span> : angka(baris.sel[c.k])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NilaiDosen() {
  const { aktif } = useKuliah()
  const [baru, setBaru] = useState('')
  const [pesan, setPesan] = useState('')
  const [kelas, setKelas] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    const mk = aktif
    if (!mk) return null
    const cid = mk.course_id
    const enr = await ambilSemua((a, b) => supabase.from('enrollments').select('npm,mahasiswa(nama,kelas)').eq('course_id', cid).order('npm').range(a, b))
    const mhs = enr.map((e) => ({ npm: e.npm, nama: e.mahasiswa?.nama, kelas: e.mahasiswa?.kelas }))
    const per = await q(supabase.from('pertemuan').select('meeting_id,quiz_ke,topik').eq('course_id', cid).neq('status', 'Dihapus').not('quiz_ke', 'is', null).order('quiz_ke'))
    const daftar = await q(supabase.from('daftar_tugas').select('assignment_id,judul,tugas_ke,pertemuan!inner(course_id)').eq('pertemuan.course_id', cid).order('tugas_ke'))
    const idq = per.map((p) => p.meeting_id); const idt = daftar.map((d) => d.assignment_id)
    const subs = idq.length ? await ambilSemua((a, b) => supabase.from('quiz_submissions').select('meeting_id,npm,final_score,attempt_no').in('meeting_id', idq).range(a, b)) : []
    const tugas = idt.length ? await ambilSemua((a, b) => supabase.from('tugas').select('assignment_id,npm,final_score,submitted_at').in('assignment_id', idt).range(a, b)) : []
    const nilai = await ambilSemua((a, b) => supabase.from('nilai').select('*').eq('course_id', cid).range(a, b))
    return { mk, nilai, ...susun({ per, subs, daftar, tugas, nilai, mhs }) }
  }, [aktif?.course_id])

  const simpan = async (npm, komponen, v) => {
    try {
      const ada = data.nilai.find((n) => n.npm === npm && n.komponen === komponen)
      const nilai = v === '' ? null : Number(v)
      if (ada) await q(supabase.from('nilai').update({ nilai, updated_at: new Date().toISOString() }).eq('grade_id', ada.grade_id))
      else if (nilai !== null) await q(supabase.from('nilai').insert({ course_id: data.mk.course_id, npm, komponen, nilai }))
      setPesan(`Tersimpan: ${npm} · ${komponen}`)
    } catch (e) { setPesan(e.message) }
  }
  const tambahKomponen = () => {
    const k = baru.trim()
    if (!k) return
    if (data.komp.includes(k)) return setPesan('Komponen sudah ada.')
    // komponen baru muncul setelah nilai pertama dimasukkan; sediakan baris awal kosong dengan memasukkan 0? -> tidak. Simpan lokal.
    setLokal((l) => [...l, k]); setBaru('')
  }
  const [lokal, setLokal] = useState([])

  if (memuat) return <Spinner />
  if (error) return <Pesan jenis="err">{error}</Pesan>
  if (!data) return <Pesan>Pilih mata kuliah.</Pesan>
  const semuaKomp = [...data.komp, ...lokal.filter((k) => !data.komp.includes(k))]
  const baris = data.baris.filter((b) => !kelas || b.kelas === kelas)
  const kol = [...data.kolKuis, ...data.kolTugas]
  return (
    <div>
      <Judul judul="Nilai" sub="Rekap otomatis dari kuis dan tugas; komponen lain (UTS, UAS, keaktifan, dll.) dapat diisi di sini."
        aksi={<button className="btn-ghost" onClick={() => unduhCSV('rekap-nilai.csv', [['NPM', 'Nama', 'Kelas', ...kol.map((c) => c.label), ...semuaKomp], ...baris.map((b) => [b.npm, b.nama, b.kelas, ...kol.map((c) => b.sel[c.k]), ...semuaKomp.map((k) => b.sel['n:' + k])])])}>Unduh CSV</button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select className="input max-w-[10rem]" value={kelas} onChange={(e) => setKelas(e.target.value)}><option value="">Semua kelas</option>{[...new Set(data.baris.map((b) => b.kelas))].filter(Boolean).map((k) => <option key={k}>{k}</option>)}</select>
        <input className="input max-w-[14rem]" placeholder="Komponen baru, mis. UTS" value={baru} onChange={(e) => setBaru(e.target.value)} />
        <button className="btn-ghost" onClick={tambahKomponen}>+ Kolom</button>
        <span className="text-emerald-700">{pesan}</span>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th>{kol.map((c) => <th key={c.k} className="th">{c.label}</th>)}{semuaKomp.map((k) => <th key={k} className="th">{k}</th>)}</tr></thead>
          <tbody className="divide-y">
            {baris.map((b) => (
              <tr key={b.npm}>
                <td className="td font-mono">{b.npm}</td><td className="td">{b.nama}</td>
                {kol.map((c) => <td key={c.k} className="td">{angka(b.sel[c.k])}</td>)}
                {semuaKomp.map((k) => (
                  <td key={k} className="td"><input type="number" step="0.5" className="input w-20" defaultValue={b.sel['n:' + k] ?? ''} onBlur={(e) => simpan(b.npm, k, e.target.value)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Tugas yang belum dikoreksi dan kuis yang belum dikerjakan ditampilkan “-”. Nilai komponen tersimpan saat kolom ditinggalkan. <button className="underline" onClick={ulang}>Muat ulang</button></p>
    </div>
  )
}

export default function Nilai() {
  const { profil } = useAuth()
  return profil.role === 'dosen' ? <NilaiDosen /> : <NilaiMhs />
}
