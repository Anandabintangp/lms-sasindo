import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'
import { useMuat, q, unduhCSV, Judul, Spinner, Pesan, Modal, Bidang } from '../ui.jsx'

const UKURAN = 50

// CSV sederhana: pemisah koma/titik koma/tab, mendukung tanda kutip.
function bacaCSV(teks) {
  const baris = []
  for (const ln of teks.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!ln.trim()) continue
    const sep = ln.includes('\t') ? '\t' : ln.includes(';') && !ln.includes(',') ? ';' : ','
    const sel = []; let cur = ''; let kutip = false
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i]
      if (kutip) { if (c === '"' && ln[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') kutip = false; else cur += c }
      else if (c === '"') kutip = true
      else if (c === sep) { sel.push(cur.trim()); cur = '' }
      else cur += c
    }
    sel.push(cur.trim()); baris.push(sel)
  }
  return baris
}

export default function Mahasiswa() {
  const { profil } = useAuth()
  const { aktif } = useKuliah()
  const [cari, setCari] = useState('')
  const [cariAktif, setCariAktif] = useState('')
  const [kelas, setKelas] = useState('')
  const [hal, setHal] = useState(0)
  const [reset, setReset] = useState(null)
  const [sandi, setSandi] = useState('')
  const [info, setInfo] = useState(null)
  const [impor, setImpor] = useState(null)

  const kls = useMuat(() => (aktif ? q(supabase.from('kelas').select('class_id,nama_kelas,angkatan').eq('course_id', aktif.course_id).order('nama_kelas')) : []), [aktif?.course_id])
  const { data, error, memuat, ulang } = useMuat(async () => {
    if (!aktif) return { baris: [], total: 0, akun: new Set() }
    let sel = supabase.from('enrollments').select('npm,class_id,mahasiswa!inner(nama,angkatan,kelas)', { count: 'exact' }).eq('course_id', aktif.course_id)
    if (kelas) sel = sel.eq('class_id', kelas)
    if (cariAktif) sel = sel.or(`nama.ilike.%${cariAktif}%,npm.ilike.%${cariAktif}%`, { referencedTable: 'mahasiswa' }).not('mahasiswa', 'is', null)
    const r = await sel.order('npm').range(hal * UKURAN, hal * UKURAN + UKURAN - 1)
    if (r.error) throw r.error
    const npms = r.data.map((b) => b.npm)
    const akun = npms.length ? await q(supabase.from('profiles').select('npm').in('npm', npms)) : []
    return { baris: r.data, total: r.count || 0, akun: new Set(akun.map((a) => a.npm)) }
  }, [aktif?.course_id, kelas, cariAktif, hal])
  const hitung = useMuat(async () => {
    if (!aktif) return { mhs: 0, akun: 0 }
    const a = await supabase.from('enrollments').select('npm', { count: 'exact', head: true }).eq('course_id', aktif.course_id)
    const b = await supabase.from('profiles').select('npm', { count: 'exact', head: true }).eq('role', 'mahasiswa')
    return { mhs: a.count || 0, akun: b.count || 0 }
  }, [aktif?.course_id])
  if (profil.role !== 'dosen') return <Navigate to="/" replace />

  const namaKelas = (id) => kls.data?.find((k) => k.class_id === id)?.nama_kelas || ''
  const simpanSandi = async () => {
    try {
      await q(supabase.rpc('dosen_reset_password', { p_npm: reset.npm, p_password: sandi }))
      setInfo({ j: 'ok', t: `Kata sandi ${reset.nama} sudah direset. Sampaikan kata sandi baru kepada mahasiswa.` })
      setReset(null); setSandi('')
    } catch (e) { setInfo({ j: 'err', t: e.message }) }
  }

  const bacaBerkas = async (f) => {
    if (!f) return
    const t = bacaCSV(await f.text())
    const kepala = t[0]?.map((h) => h.toLowerCase()) || []
    const adaKepala = kepala.includes('npm')
    const ix = (n, d) => (adaKepala ? kepala.indexOf(n) : d)
    const baris = (adaKepala ? t.slice(1) : t).map((r) => ({ npm: r[ix('npm', 0)], nama: r[ix('nama', 1)] })).filter((r) => r.npm && r.nama)
    setImpor((s) => ({ ...s, baris, hasil: null }))
  }
  const jalankanImpor = async () => {
    try {
      const { baris, kelasId } = impor
      setImpor((s) => ({ ...s, jalan: true }))
      const kl = kls.data.find((k) => k.class_id === kelasId)
      for (let i = 0; i < baris.length; i += 500) {
        const potong = baris.slice(i, i + 500)
        await q(supabase.from('mahasiswa').upsert(potong.map((r) => ({ npm: r.npm.trim(), nama: r.nama.trim(), angkatan: kl.angkatan || null, kelas: kl.nama_kelas })), { onConflict: 'npm', ignoreDuplicates: true }))
        await q(supabase.from('enrollments').upsert(potong.map((r) => ({ npm: r.npm.trim(), class_id: kelasId, course_id: aktif.course_id, status: 'Aktif' })), { onConflict: 'npm,class_id' }))
      }
      setImpor((s) => ({ ...s, jalan: false, hasil: `${baris.length} mahasiswa didaftarkan ke kelas ${kl.nama_kelas}.` }))
      ulang(); hitung.ulang()
    } catch (e) { setImpor((s) => ({ ...s, jalan: false, hasil: 'Gagal: ' + e.message })) }
  }
  const unduhSemua = async () => {
    let sel = supabase.from('enrollments').select('npm,class_id,mahasiswa(nama,angkatan)').eq('course_id', aktif.course_id).order('npm')
    if (kelas) sel = sel.eq('class_id', kelas)
    const out = []
    for (let i = 0; ; i += 1000) {
      const r = await sel.range(i, i + 999); if (r.error) { setInfo({ j: 'err', t: r.error.message }); return }
      out.push(...r.data); if (r.data.length < 1000) break
    }
    unduhCSV('mahasiswa.csv', [['npm', 'nama', 'angkatan', 'kelas'], ...out.map((b) => [b.npm, b.mahasiswa?.nama, b.mahasiswa?.angkatan, namaKelas(b.class_id)])])
  }
  const halTerakhir = Math.max(0, Math.ceil((data?.total || 0) / UKURAN) - 1)

  return (
    <div>
      <Judul judul="Mahasiswa" sub={aktif ? `${aktif.nama} — daftar peserta, status akun, impor CSV, dan reset kata sandi.` : 'Pilih mata kuliah.'}
        aksi={<>
          <button className="btn-ghost" onClick={unduhSemua} disabled={!aktif}>Unduh CSV</button>
          <button className="btn" onClick={() => setImpor({ kelasId: kls.data?.[0]?.class_id || '', baris: [], hasil: null })} disabled={!kls.data?.length}>Impor CSV</button>
        </>} />
      {!aktif && <Pesan jenis="info">Buat mata kuliah dulu di menu Mata Kuliah.</Pesan>}
      {info && <div className="mb-4"><Pesan jenis={info.j}>{info.t}</Pesan></div>}
      <Pesan jenis="err">{error}</Pesan>
      {aktif && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setHal(0); setCariAktif(cari.trim()) }}>
              <input className="input max-w-xs" placeholder="Cari NPM / nama" value={cari} onChange={(e) => setCari(e.target.value)} />
              <button className="btn-ghost" type="submit">Cari</button>
            </form>
            <select className="input max-w-[12rem]" value={kelas} onChange={(e) => { setKelas(e.target.value); setHal(0) }}>
              <option value="">Semua kelas</option>
              {kls.data?.map((k) => <option key={k.class_id} value={k.class_id}>{k.nama_kelas}{k.angkatan ? ` (${k.angkatan})` : ''}</option>)}
            </select>
            <span className="self-center text-sm text-slate-500">{data?.total ?? '…'} peserta · {hitung.data?.akun ?? '…'} akun mahasiswa aktif (semua mata kuliah)</span>
          </div>
          {memuat && <Spinner />}
          {data && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full">
                <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th><th className="th">Angkatan</th><th className="th">Kelas</th><th className="th">Akun</th><th className="th" /></tr></thead>
                <tbody className="divide-y">
                  {data.baris.map((b) => (
                    <tr key={b.npm + b.class_id}>
                      <td className="td font-mono">{b.npm}</td><td className="td">{b.mahasiswa?.nama}</td><td className="td">{b.mahasiswa?.angkatan}</td><td className="td">{namaKelas(b.class_id)}</td>
                      <td className="td">{data.akun.has(b.npm) ? <span className="text-emerald-700">Aktif</span> : <span className="text-slate-400">Belum daftar</span>}</td>
                      <td className="td text-right">{data.akun.has(b.npm) && <button className="btn-ghost" onClick={() => { setReset({ npm: b.npm, nama: b.mahasiswa?.nama }); setSandi('') }}>Reset sandi</button>}</td>
                    </tr>
                  ))}
                  {!data.baris.length && <tr><td className="td text-slate-500" colSpan={6}>Tidak ada data.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <button className="btn-ghost" disabled={hal === 0} onClick={() => setHal(hal - 1)}>← Sebelumnya</button>
            <span className="text-slate-500">Halaman {hal + 1} dari {halTerakhir + 1}</span>
            <button className="btn-ghost" disabled={hal >= halTerakhir} onClick={() => setHal(hal + 1)}>Berikutnya →</button>
          </div>
        </>
      )}
      {reset && (
        <Modal judul={`Reset kata sandi — ${reset.nama}`} onTutup={() => setReset(null)} lebar="max-w-md">
          <div className="space-y-4">
            <Bidang label="Kata sandi baru" bantu="Minimal 6 karakter. Minta mahasiswa menggantinya setelah masuk.">
              <input className="input" value={sandi} onChange={(e) => setSandi(e.target.value)} />
            </Bidang>
            <button className="btn" onClick={simpanSandi} disabled={sandi.length < 6}>Simpan</button>
          </div>
        </Modal>
      )}
      {impor && (
        <Modal judul="Impor mahasiswa dari CSV" onTutup={() => setImpor(null)} lebar="max-w-lg">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Berkas CSV dengan kolom <b>npm</b> dan <b>nama</b> (baris pertama boleh judul). Mahasiswa yang sudah ada tidak diubah; hanya didaftarkan ke kelas di bawah. Cocok untuk ratusan hingga ribuan baris.</p>
            <Bidang label="Daftarkan ke kelas">
              <select className="input" value={impor.kelasId} onChange={(e) => setImpor({ ...impor, kelasId: e.target.value })}>
                {kls.data?.map((k) => <option key={k.class_id} value={k.class_id}>{k.nama_kelas}{k.angkatan ? ` (angkatan ${k.angkatan})` : ''}</option>)}
              </select>
            </Bidang>
            <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => bacaBerkas(e.target.files[0])} />
            {impor.baris.length > 0 && <Pesan jenis="info">{impor.baris.length} baris terbaca. Contoh: {impor.baris[0].npm} — {impor.baris[0].nama}</Pesan>}
            {impor.hasil && <Pesan jenis={impor.hasil.startsWith('Gagal') ? 'err' : 'ok'}>{impor.hasil}</Pesan>}
            <button className="btn" disabled={!impor.baris.length || impor.jalan} onClick={jalankanImpor}>{impor.jalan ? 'Mengimpor…' : 'Impor'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
