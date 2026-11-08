import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth.jsx'
import { useKuliah } from '../kuliah.jsx'
import { useMuat, q, Judul, Spinner, Pesan, Modal, Bidang, acak } from '../ui.jsx'

async function bukaBerkas(path) {
  const { data, error } = await supabase.storage.from('materi').createSignedUrl(path, 300)
  if (error) return alert(error.message)
  window.open(data.signedUrl, '_blank', 'noopener')
}

function Daftar({ items, dosen, onUbah }) {
  const kelompok = {}
  items.forEach((m) => { (kelompok[m.pertemuan_ke ?? 0] ||= []).push(m) })
  const kunci = Object.keys(kelompok).sort((a, b) => a - b)
  if (!items.length) return <Pesan>Belum ada materi.</Pesan>
  return (
    <div className="space-y-6">
      {kunci.map((k) => (
        <section key={k}>
          <h2 className="mb-2 font-bold text-maroon-800">{Number(k) ? `Pertemuan ${k}` : 'Umum'}</h2>
          <ul className="card divide-y p-0">
            {kelompok[k].map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.judul} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">{m.tipe}</span>
                    {dosen && !m.dipublikasi && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">draf</span>}</p>
                  {m.deskripsi && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{m.deskripsi}</p>}
                </div>
                <div className="flex gap-2">
                  {m.tipe === 'Tautan' && m.url && <a className="btn-ghost" href={m.url} target="_blank" rel="noreferrer">Buka</a>}
                  {m.tipe === 'PDF' && m.file_path && <button className="btn-ghost" onClick={() => bukaBerkas(m.file_path)}>Buka PDF</button>}
                  {dosen && <>
                    <button className="btn-ghost" onClick={() => onUbah('pub', m)}>{m.dipublikasi ? 'Sembunyikan' : 'Terbitkan'}</button>
                    <button className="btn-ghost text-red-700" onClick={() => onUbah('hapus', m)}>Hapus</button>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function Materi() {
  const { profil } = useAuth()
  const dosen = profil.role === 'dosen'
  const { aktif } = useKuliah()
  const [form, setForm] = useState(null)
  const [pesan, setPesan] = useState(null)
  const { data, error, memuat, ulang } = useMuat(async () => {
    const mk = aktif
    if (!mk) return { mk: null, items: [] }
    const items = await q(supabase.from('materi').select('*').eq('course_id', mk.course_id).order('pertemuan_ke').order('created_at'))
    return { mk, items }
  }, [aktif?.course_id])

  const ubah = async (aksi, m) => {
    try {
      if (aksi === 'pub') await q(supabase.from('materi').update({ dipublikasi: !m.dipublikasi }).eq('id', m.id))
      if (aksi === 'hapus') {
        if (!confirm(`Hapus materi "${m.judul}"?`)) return
        if (m.file_path) await supabase.storage.from('materi').remove([m.file_path])
        await q(supabase.from('materi').delete().eq('id', m.id))
      }
      ulang()
    } catch (e) { setPesan(e.message) }
  }

  const simpan = async (e) => {
    e.preventDefault(); setPesan(null)
    try {
      let file_path = null
      if (form.tipe === 'PDF') {
        if (!form.berkas) throw new Error('Pilih berkas PDF.')
        if (form.berkas.size > 20 * 1024 * 1024) throw new Error('Ukuran maksimal 20 MB.')
        file_path = `${data.mk.course_id}/${acak(10)}.pdf`
        const { error: e1 } = await supabase.storage.from('materi').upload(file_path, form.berkas, { contentType: 'application/pdf' })
        if (e1) throw e1
      }
      await q(supabase.from('materi').insert({
        course_id: data.mk.course_id, judul: form.judul, deskripsi: form.deskripsi || null, tipe: form.tipe,
        pertemuan_ke: form.pertemuan_ke ? Number(form.pertemuan_ke) : null,
        url: form.tipe === 'Tautan' ? form.url : null, file_path, dipublikasi: true,
      }))
      setForm(null); ulang()
    } catch (e2) { setPesan(e2.message) }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <div>
      <Judul judul="Materi" sub="Bahan perkuliahan per pertemuan."
        aksi={dosen && <button className="btn" onClick={() => setForm({ tipe: 'Tautan', judul: '' })}>+ Tambah materi</button>} />
      {memuat && <Spinner />}
      <Pesan jenis="err">{error || pesan}</Pesan>
      {data && <Daftar items={data.items} dosen={dosen} onUbah={ubah} />}
      {form && (
        <Modal judul="Tambah materi" onTutup={() => setForm(null)}>
          <form onSubmit={simpan} className="space-y-4">
            <Bidang label="Judul"><input required className="input" value={form.judul} onChange={set('judul')} /></Bidang>
            <div className="grid gap-4 sm:grid-cols-2">
              <Bidang label="Pertemuan ke-"><input type="number" min="1" max="16" className="input" value={form.pertemuan_ke || ''} onChange={set('pertemuan_ke')} /></Bidang>
              <Bidang label="Jenis">
                <select className="input" value={form.tipe} onChange={set('tipe')}><option>Tautan</option><option>PDF</option><option>Teks</option></select>
              </Bidang>
            </div>
            {form.tipe === 'Tautan' && <Bidang label="Alamat tautan"><input required type="url" className="input" value={form.url || ''} onChange={set('url')} placeholder="https://" /></Bidang>}
            {form.tipe === 'PDF' && <Bidang label="Berkas PDF (maks. 20 MB)"><input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, berkas: e.target.files[0] })} /></Bidang>}
            <Bidang label={form.tipe === 'Teks' ? 'Isi materi' : 'Keterangan (opsional)'}>
              <textarea className="input" rows={form.tipe === 'Teks' ? 8 : 3} required={form.tipe === 'Teks'} value={form.deskripsi || ''} onChange={set('deskripsi')} />
            </Bidang>
            <button className="btn">Simpan</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
