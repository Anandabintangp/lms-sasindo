import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Spinner, Pesan } from './ui.jsx'
import Login from './pages/Login.jsx'
import Beranda from './pages/Beranda.jsx'
import Mahasiswa from './pages/Mahasiswa.jsx'
import Materi from './pages/Materi.jsx'
import Kuis from './pages/Kuis.jsx'
import Tugas from './pages/Tugas.jsx'
import Presensi from './pages/Presensi.jsx'
import Nilai from './pages/Nilai.jsx'
import MataKuliah from './pages/MataKuliah.jsx'

function Lindungi({ children }) {
  const { sesi, profil, memuat, keluar } = useAuth()
  if (memuat) return <div className="mx-auto max-w-md p-10"><Spinner /></div>
  if (!sesi) return <Navigate to="/masuk" replace />
  if (!profil) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-10">
        <Pesan jenis="warn">Akun Anda belum terhubung dengan data mahasiswa/dosen. Daftar ulang dengan kode registrasi, atau hubungi dosen.</Pesan>
        <button className="btn" onClick={keluar}>Keluar</button>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<Login />} />
      <Route element={<Lindungi><Layout /></Lindungi>}>
        <Route index element={<Beranda />} />
        <Route path="mahasiswa" element={<Mahasiswa />} />
        <Route path="materi" element={<Materi />} />
        <Route path="kuis" element={<Kuis />} />
        <Route path="tugas" element={<Tugas />} />
        <Route path="presensi" element={<Presensi />} />
        <Route path="nilai" element={<Nilai />} />
        <Route path="matkul" element={<MataKuliah />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
