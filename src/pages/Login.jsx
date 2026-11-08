import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase, emailDari } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { Pesan, Bidang } from '../ui.jsx'

export default function Login() {
  const { sesi, profil, segarkan } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('masuk')
  const [id, setId] = useState('')
  const [sandi, setSandi] = useState('')
  const [kode, setKode] = useState('')
  const [err, setErr] = useState('')
  const [sibuk, setSibuk] = useState(false)

  if (sesi && profil) return <Navigate to="/" replace />

  const masuk = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailDari(id), password: sandi })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'NPM atau kata sandi salah. Jika lupa, minta dosen mereset kata sandi.' : error.message)
  }

  const kirim = async (e) => {
    e.preventDefault(); setErr(''); setSibuk(true)
    try {
      if (!id.trim() || !sandi) throw new Error('Isi NPM dan kata sandi.')
      if (mode === 'masuk') {
        await masuk()
      } else {
        if (sandi.length < 6) throw new Error('Kata sandi minimal 6 karakter.')
        if (!kode.trim()) throw new Error('Isi kode registrasi dari dosen.')
        // jika akun auth sudah ada (pendaftaran sebelumnya terputus), cukup masuk lalu klaim
        const coba = await supabase.auth.signInWithPassword({ email: emailDari(id), password: sandi })
        if (coba.error) {
          const { data, error } = await supabase.auth.signUp({ email: emailDari(id), password: sandi })
          if (error) throw new Error(error.message)
          if (!data.session) {
            const lagi = await supabase.auth.signInWithPassword({ email: emailDari(id), password: sandi })
            if (lagi.error) throw new Error('Akun dibuat, tetapi masih menunggu konfirmasi email. Hubungi dosen untuk mengaktifkan pendaftaran langsung.')
          }
        }
        const { error: e2 } = await supabase.rpc('klaim_akun', { p_kode: kode, p_npm: id.trim() })
        if (e2) { await supabase.auth.signOut(); throw new Error(e2.message) }
      }
      await segarkan()
      nav('/', { replace: true })
    } catch (e2) { setErr(e2.message) } finally { setSibuk(false) }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-maroon-700 px-8 py-12 text-white md:px-16">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 text-2xl font-bold text-maroon-800">S</div>
        <p className="text-sm uppercase tracking-widest text-gold-400">Universitas Padjadjaran</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">LMS Sastra Indonesia</h1>
        <p className="mt-3 max-w-md text-maroon-100">Materi, kuis, tugas, presensi, dan nilai mata kuliah dalam satu tempat.</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <form onSubmit={kirim} className="card w-full max-w-sm space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm font-semibold">
            {[['masuk', 'Masuk'], ['daftar', 'Daftar']].map(([k, t]) => (
              <button type="button" key={k} onClick={() => { setMode(k); setErr('') }}
                className={`rounded-full py-1.5 ${mode === k ? 'bg-maroon-700 text-white' : 'text-slate-600'}`}>{t}</button>
            ))}
          </div>
          <Bidang label="NPM"><input className="input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" inputMode="text" /></Bidang>
          <Bidang label="Kata sandi"><input className="input" type="password" value={sandi} onChange={(e) => setSandi(e.target.value)} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} /></Bidang>
          {mode === 'daftar' && (
            <Bidang label="Kode registrasi" bantu="Dibagikan dosen di kelas. Satu NPM hanya bisa mendaftar sekali."><input className="input uppercase" value={kode} onChange={(e) => setKode(e.target.value)} /></Bidang>
          )}
          <Pesan jenis="err">{err}</Pesan>
          <button className="btn w-full" disabled={sibuk}>{sibuk ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Buat akun'}</button>
          {mode === 'masuk' && <p className="text-center text-xs text-slate-500">Lupa kata sandi? Minta dosen untuk mereset.</p>}
        </form>
      </div>
    </div>
  )
}
