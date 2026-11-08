import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useMuat, q, Spinner, Pesan, fmtTgl } from '../ui.jsx'

const hitung = async (tabel, f) => {
  let r = supabase.from(tabel).select('*', { count: 'exact', head: true })
  if (f) r = f(r)
  const { count, error } = await r
  if (error) throw error
  return count || 0
}

function Kartu({ to, judul, isi, angka }) {
  return (
    <Link to={to} className="card group block transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-maroon-800 group-hover:text-maroon-600">{judul}</h3>
        {angka !== undefined && <span className="rounded-full bg-gold-400 px-3 py-0.5 text-sm font-bold text-maroon-900">{angka}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-600">{isi}</p>
    </Link>
  )
}

export default function Beranda() {
  const { profil } = useAuth()
  const dosen = profil.role === 'dosen'
  const { data, error, memuat } = useMuat(async () => {
    const mk = (await q(supabase.from('mata_kuliah').select('*').limit(1)))[0]
    if (dosen) {
      const [mhs, akun, kirimKuis, kirimTugas] = await Promise.all([
        hitung('mahasiswa'), hitung('profiles', (r) => r.eq('role', 'mahasiswa')),
        hitung('quiz_submissions'), hitung('tugas'),
      ])
      return { mk, mhs, akun, kirimKuis, kirimTugas }
    }
    const tugas = await q(supabase.from('daftar_tugas').select('judul,deadline').eq('status', 'Aktif').order('deadline'))
    const kuis = await q(supabase.from('pertemuan').select('meeting_id,topik,quiz_ke,quiz_deadline').eq('quiz_open', true).eq('status', 'Aktif'))
    return { mk, tugas, kuis }
  }, [])

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-maroon-700 text-white shadow">
        <div className="border-l-8 border-gold-400 px-8 py-10">
          <p className="text-sm uppercase tracking-widest text-gold-400">{dosen ? 'Ruang Dosen' : 'Ruang Mahasiswa'}</p>
          <h1 className="mt-1 text-3xl font-bold">{data?.mk?.nama || 'Mata Kuliah'}</h1>
          <p className="mt-2 text-maroon-100">{dosen ? 'Kelola materi, kuis, tugas, presensi, dan nilai.' : `Selamat datang, ${profil.nama || profil.npm}.`}</p>
        </div>
      </section>

      {memuat && <Spinner />}
      <Pesan jenis="err">{error}</Pesan>

      {data && dosen && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu to="/mahasiswa" judul="Mahasiswa" angka={`${data.akun}/${data.mhs}`} isi="Akun aktif dari seluruh mahasiswa terdaftar." />
          <Kartu to="/kuis" judul="Kuis" angka={data.kirimKuis} isi="Pengiriman kuis. Nilai esai dapat dikoreksi." />
          <Kartu to="/tugas" judul="Tugas" angka={data.kirimTugas} isi="Berkas tugas yang masuk." />
          <Kartu to="/presensi" judul="Presensi" isi="Buka sesi berkode atau catat manual." />
        </section>
      )}

      {data && !dosen && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kartu to="/materi" judul="Materi" isi="Bahan bacaan dan tautan per pertemuan." />
            <Kartu to="/kuis" judul="Kuis" angka={data.kuis.length} isi="Kuis yang sedang dibuka." />
            <Kartu to="/tugas" judul="Tugas" angka={data.tugas.length} isi="Unggah berkas PDF dan lihat umpan balik." />
            <Kartu to="/presensi" judul="Presensi" isi="Masukkan kode dari dosen saat kelas." />
            <Kartu to="/nilai" judul="Nilai" isi="Rekap kuis, tugas, dan komponen lain." />
          </section>
          {data.tugas.length > 0 && (
            <section className="card">
              <h2 className="mb-3 font-bold text-maroon-800">Tenggat tugas</h2>
              <ul className="divide-y text-sm">
                {data.tugas.map((t) => <li key={t.judul} className="flex justify-between py-2"><span>{t.judul}</span><span className="text-slate-500">{fmtTgl(t.deadline)}</span></li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
