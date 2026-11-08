import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useMuat, q, Judul, Spinner, Pesan, Modal, Bidang } from '../ui.jsx'

export default function Mahasiswa() {
  const { profil } = useAuth()
  const [cari, setCari] = useState('')
  const [kelas, setKelas] = useState('')
  const [reset, setReset] = useState(null)
  const [sandi, setSandi] = useState('')
  const [info, setInfo] = useState(null)
  const { data, error, memuat } = useMuat(async () => {
    const [mhs, akun, kode, kls] = await Promise.all([
      q(supabase.from('mahasiswa').select('npm,nama,kelas,angkatan,status').order('npm').range(0, 999)),
      q(supabase.from('profiles').select('npm').eq('role', 'mahasiswa')),
      q(supabase.from('kode_registrasi').select('kode,role,aktif,class_id,keterangan')),
      q(supabase.from('kelas').select('class_id,nama_kelas')),
    ])
    return { mhs, akun: new Set(akun.map((a) => a.npm)), kode, kls }
  }, [])
  if (profil.role !== 'dosen') return <Navigate to="/" replace />

  const tampil = (data?.mhs || []).filter((m) =>
    (!kelas || m.kelas === kelas) && (!cari || `${m.npm} ${m.nama}`.toLowerCase().includes(cari.toLowerCase())))

  const simpanSandi = async () => {
    try {
      await q(supabase.rpc('dosen_reset_password', { p_npm: reset.npm, p_password: sandi }))
      setInfo({ j: 'ok', t: `Kata sandi ${reset.nama} sudah direset. Sampaikan kata sandi baru kepada mahasiswa.` })
      setReset(null); setSandi('')
    } catch (e) { setInfo({ j: 'err', t: e.message }) }
  }

  return (
    <div>
      <Judul judul="Mahasiswa" sub="Daftar mahasiswa, status akun, dan reset kata sandi." />
      {memuat && <Spinner />}
      <Pesan jenis="err">{error}</Pesan>
      {info && <div className="mb-4"><Pesan jenis={info.j}>{info.t}</Pesan></div>}
      {data && (
        <>
          <section className="card mb-6">
            <h2 className="mb-2 font-bold text-maroon-800">Kode registrasi</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              {data.kode.map((k) => (
                <div key={k.kode} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="font-mono text-base font-bold tracking-wider">{k.kode}</p>
                  <p className="text-xs text-slate-500">{k.role === 'dosen' ? 'Untuk dosen (sekali pakai)' : `Kelas ${k.class_id || ''}`} · {k.aktif ? 'aktif' : 'nonaktif'}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input max-w-xs" placeholder="Cari NPM / nama" value={cari} onChange={(e) => setCari(e.target.value)} />
            <select className="input max-w-[10rem]" value={kelas} onChange={(e) => setKelas(e.target.value)}>
              <option value="">Semua kelas</option>
              {[...new Set(data.mhs.map((m) => m.kelas))].filter(Boolean).map((k) => <option key={k}>{k}</option>)}
            </select>
            <span className="self-center text-sm text-slate-500">{tampil.length} mahasiswa · {data.akun.size} akun aktif</span>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className="th">NPM</th><th className="th">Nama</th><th className="th">Kelas</th><th className="th">Akun</th><th className="th" /></tr></thead>
              <tbody className="divide-y">
                {tampil.map((m) => (
                  <tr key={m.npm}>
                    <td className="td font-mono">{m.npm}</td><td className="td">{m.nama}</td><td className="td">{m.kelas}</td>
                    <td className="td">{data.akun.has(m.npm) ? <span className="text-emerald-700">Aktif</span> : <span className="text-slate-400">Belum daftar</span>}</td>
                    <td className="td text-right">{data.akun.has(m.npm) && <button className="btn-ghost" onClick={() => { setReset(m); setSandi('') }}>Reset sandi</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  )
}
