import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'

const MENU_DOSEN = [
  ['/', 'Beranda'], ['/mahasiswa', 'Mahasiswa'], ['/materi', 'Materi'], ['/kuis', 'Kuis'],
  ['/tugas', 'Tugas'], ['/presensi', 'Presensi'], ['/nilai', 'Nilai'], ['/matkul', 'Mata Kuliah'],
]
const MENU_MHS = [
  ['/', 'Beranda'], ['/materi', 'Materi'], ['/kuis', 'Kuis'], ['/tugas', 'Tugas'], ['/presensi', 'Presensi'], ['/nilai', 'Nilai'],
]

export function Navbar() {
  const { profil, keluar } = useAuth()
  const [buka, setBuka] = useState(false)
  const { daftar, aktif, pilih } = useKuliah()
  const menu = profil?.role === 'dosen' ? MENU_DOSEN : MENU_MHS
  const kelas = ({ isActive }) =>
    `block border-b-4 px-3 py-3 text-sm font-semibold transition ${isActive ? 'border-gold-400 text-maroon-800' : 'border-transparent text-slate-600 hover:text-maroon-700'}`
  return (
    <header className="sticky top-0 z-40 bg-white shadow">
      <div className="bg-maroon-700 text-xs text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5">
          <span>Universitas Padjadjaran · Fakultas Ilmu Budaya</span>
          <span className="hidden sm:inline">Program Studi Sastra Indonesia</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 py-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon-700 text-lg font-bold text-gold-400">S</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-maroon-800">LMS Sastra Indonesia</span>
            <span className="block text-xs text-slate-500">{profil?.role === 'dosen' ? 'Ruang Dosen' : 'Ruang Mahasiswa'}</span>
          </span>
        </Link>
        {daftar.length > 0 && (
          <select aria-label="Mata kuliah aktif" className="input mx-2 max-w-[14rem] truncate py-1.5 text-xs" value={aktif?.course_id || ''} onChange={(e) => pilih(e.target.value)}>
            {daftar.map((m) => <option key={m.course_id} value={m.course_id}>{m.nama}{m.tahun_akademik ? ` · ${m.tahun_akademik}` : ''}</option>)}
          </select>
        )}
        <button className="rounded-lg border px-3 py-1.5 text-sm md:hidden" onClick={() => setBuka(!buka)}>Menu</button>
        <nav className="hidden items-center md:flex">
          {menu.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={kelas}>{t}</NavLink>)}
          <button onClick={keluar} className="btn-ghost ml-3">Keluar</button>
        </nav>
      </div>
      {buka && (
        <nav className="border-t px-4 pb-3 md:hidden">
          {menu.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={kelas} onClick={() => setBuka(false)}>{t}</NavLink>)}
          <button onClick={keluar} className="btn-ghost mt-2">Keluar</button>
        </nav>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-12 bg-maroon-800 text-sm text-maroon-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="font-semibold text-gold-400">Program Studi Sastra Indonesia · Fakultas Ilmu Budaya · Universitas Padjadjaran</p>
        <p className="mt-1 text-xs opacity-80">Sistem pembelajaran daring mata kuliah. Data tersimpan aman; akses diatur per peran.</p>
      </div>
    </footer>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"><Outlet /></main>
      <Footer />
    </div>
  )
}
