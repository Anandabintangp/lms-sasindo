import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'
import { useMuat, q, acak, Judul, Spinner, Pesan, Modal, Bidang } from '../ui.jsx'

const MK0 = { nama: '', kode: '', sks: '', semester: 'Ganjil', tahun_akademik: '', status: 'Aktif' }
const KL0 = { nama_kelas: '', angkatan: '' }

export default function MataKuliah() {
  const { profil } = useAuth()
  const { aktif, muat: muatDaftar, pilih } = useKuliah()
  const [formMk, setFormMk] = useState(null)
  const [formKl, setFormKl] = useState(null)
  const [err, setErr] = useState('')
  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!aktif) return { kls: [], kode: [], jml: {} }
    const [kls, kode] = await Promise.all([
      q(supabase.from('kelas').select('*').eq('course_id', aktif.course_id).order('nama_kelas')),
      q(supabase.from('kode_registrasi').select('*').eq('role', 'mahasiswa')),
    ])
    const jml = {}
    await Promise.all(kls.map(async (k) => {
      const { count } = await supabase.from('enrollments').select('npm', { count: 'exact', head: true }).eq('class_id', k.class_id)
      jml[k.class_id] = count || 0
    }))
    return { kls, kode, jml }
  }, [aktif?.course_id])
  if (profil.role !== 'dosen') return <Navigate to="/" replace />

  const jalan = async (fn) => { setErr(''); try { await fn(); ulang() } catch (e) { setErr(e.message) } }
  const simpanMk = () => jalan(async () => {
    const f = formMk
    const isi = { nama: f.nama.trim(), kode: f.kode || null, sks: f.sks ? Number(f.sks) : null, semester: f.semester, tahun_akademik: f.tahun_akademik || null, status: f.status }
    if (f.course_id) await q(supabase.from('mata_kuliah').update(isi).eq('course_id', f.course_id))
    else { const id = 'MK-' + acak(6); await q(supabase.from('mata_kuliah').insert({ course_id: id, ...isi })); pilih(id) }
    setFormMk(null); await muatDaftar()
  })
  const simpanKl = () => jalan(async () => {
    const f = formKl
    const isi = { nama_kelas: f.nama_kelas.trim(), angkatan: f.angkatan || null, tahun_akademik: aktif.tahun_akademik, semester: aktif.semester }
    if (f.class_id) await q(supabase.from('kelas').update(isi).eq('class_id', f.class_id))
    else {
      const cid = 'CLS-' + acak(6)
      await q(supabase.from('kelas').insert({ class_id: cid, course_id: aktif.course_id, status: 'Aktif', ...isi }))
      await q(supabase.from('kode_registrasi').insert({ kode: `${(aktif.kode || 'KLS').replace(/\W/g, '').slice(0, 4).toUpperCase()}-${acak(6)}`, class_id: cid, aktif: true, role: 'mahasiswa' }))
    }
    setFormKl(null)
  })
  const kodeBaru = (cid) => jalan(() => q(supabase.from('kode_registrasi').insert({ kode: `KLS-${acak(6)}`, class_id: cid, aktif: true, role: 'mahasiswa' })))
  const toggle = (k) => jalan(() => q(supabase.from('kode_registrasi').update({ aktif: !k.aktif }).eq('kode', k.kode)))

  return (
    <div>
      <Judul judul="Mata Kuliah & Kelas" sub="Tambah mata kuliah, kelas per angkatan, dan kode registrasi mahasiswa."
        aksi={<button className="btn" onClick={() => setFormMk({ ...MK0 })}>+ Mata kuliah</button>} />
      <Pesan jenis="err">{error || err}</Pesan>
      {!aktif && <Pesan jenis="info">Belum ada mata kuliah. Klik “+ Mata kuliah”.</Pesan>}
      {aktif && (
        <section className="card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-maroon-800">{aktif.nama}</h2>
              <p className="text-sm text-slate-600">{[aktif.kode, aktif.sks && `${aktif.sks} SKS`, aktif.semester, aktif.tahun_akademik, aktif.status].filter(Boolean).join(' · ')}</p>
              <p className="mt-1 text-xs text-slate-500">Ganti mata kuliah aktif lewat pilihan di bilah atas.</p>
            </div>
            <button className="btn-ghost" onClick={() => setFormMk({ ...aktif, sks: aktif.sks ?? '' })}>Ubah</button>
          </div>
        </section>
      )}
      {aktif && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-maroon-800">Kelas</h2>
            <button className="btn-ghost" onClick={() => setFormKl({ ...KL0 })}>+ Kelas</button>
          </div>
          {memuat && <Spinner />}
          <div className="space-y-3">
            {data?.kls.map((k) => (
              <div key={k.class_id} className="rounded-xl p-3 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Kelas {k.nama_kelas} <span className="font-normal text-slate-500">· angkatan {k.angkatan || '-'} · {data.jml[k.class_id] ?? 0} mahasiswa</span></p>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => setFormKl({ ...k, angkatan: k.angkatan || '' })}>Ubah</button>
                    <button className="btn-ghost" onClick={() => kodeBaru(k.class_id)}>+ Kode</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.kode.filter((c) => c.class_id === k.class_id).map((c) => (
                    <button key={c.kode} onClick={() => toggle(c)} title="Klik untuk aktif/nonaktifkan"
                      className={`rounded-lg px-3 py-1 font-mono text-sm ring-1 ${c.aktif ? 'bg-emerald-50 ring-emerald-300' : 'bg-slate-100 text-slate-400 line-through ring-slate-200'}`}>{c.kode}</button>
                  ))}
                </div>
              </div>
            ))}
            {data && !data.kls.length && <p className="text-sm text-slate-500">Belum ada kelas.</p>}
          </div>
        </section>
      )}
      {formMk && (
        <Modal judul={formMk.course_id ? 'Ubah mata kuliah' : 'Mata kuliah baru'} onTutup={() => setFormMk(null)} lebar="max-w-lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Bidang label="Nama"><input className="input" value={formMk.nama} onChange={(e) => setFormMk({ ...formMk, nama: e.target.value })} /></Bidang></div>
            <Bidang label="Kode"><input className="input" value={formMk.kode || ''} onChange={(e) => setFormMk({ ...formMk, kode: e.target.value })} /></Bidang>
            <Bidang label="SKS"><input className="input" type="number" value={formMk.sks} onChange={(e) => setFormMk({ ...formMk, sks: e.target.value })} /></Bidang>
            <Bidang label="Semester"><select className="input" value={formMk.semester || ''} onChange={(e) => setFormMk({ ...formMk, semester: e.target.value })}><option>Ganjil</option><option>Genap</option></select></Bidang>
            <Bidang label="Tahun akademik"><input className="input" placeholder="2026/2027" value={formMk.tahun_akademik || ''} onChange={(e) => setFormMk({ ...formMk, tahun_akademik: e.target.value })} /></Bidang>
            <Bidang label="Status"><select className="input" value={formMk.status || 'Aktif'} onChange={(e) => setFormMk({ ...formMk, status: e.target.value })}><option>Aktif</option><option>Selesai</option></select></Bidang>
          </div>
          <button className="btn mt-5" disabled={!formMk.nama.trim()} onClick={simpanMk}>Simpan</button>
        </Modal>
      )}
      {formKl && (
        <Modal judul={formKl.class_id ? 'Ubah kelas' : 'Kelas baru'} onTutup={() => setFormKl(null)} lebar="max-w-md">
          <div className="space-y-4">
            <Bidang label="Nama kelas" bantu="Mis. A, B, atau Kelas Reguler."><input className="input" value={formKl.nama_kelas} onChange={(e) => setFormKl({ ...formKl, nama_kelas: e.target.value })} /></Bidang>
            <Bidang label="Angkatan"><input className="input" placeholder="2024" value={formKl.angkatan} onChange={(e) => setFormKl({ ...formKl, angkatan: e.target.value })} /></Bidang>
            <button className="btn" disabled={!formKl.nama_kelas.trim()} onClick={simpanKl}>Simpan{formKl.class_id ? '' : ' (kode registrasi dibuat otomatis)'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
