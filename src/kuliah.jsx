import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'

const Ctx = createContext({ daftar: [], aktif: null, pilih: () => {}, muat: () => {}, memuat: true })
export const useKuliah = () => useContext(Ctx)

// Daftar mata kuliah (dosen: semua; mahasiswa: yang diikuti) dan mata kuliah aktif.
export function KuliahProvider({ children }) {
  const { profil } = useAuth()
  const [daftar, setDaftar] = useState([])
  const [id, setId] = useState(() => { try { return localStorage.getItem('mk_aktif') || '' } catch { return '' } })
  const [memuat, setMemuat] = useState(true)

  const muat = useCallback(async () => {
    if (!profil) { setDaftar([]); setMemuat(false); return }
    let d = []
    if (profil.role === 'dosen') {
      const r = await supabase.from('mata_kuliah').select('*').order('tahun_akademik', { ascending: false }).order('nama')
      d = r.data || []
    } else {
      const r = await supabase.from('enrollments').select('course_id, mata_kuliah(*)').eq('npm', profil.npm).eq('status', 'Aktif')
      const m = new Map()
      ;(r.data || []).forEach((e) => e.mata_kuliah && m.set(e.course_id, e.mata_kuliah))
      d = [...m.values()]
    }
    setDaftar(d); setMemuat(false)
  }, [profil])
  useEffect(() => { muat() }, [muat])

  const aktif = daftar.find((m) => m.course_id === id) || daftar[0] || null
  const pilih = (v) => { setId(v); try { localStorage.setItem('mk_aktif', v) } catch { /* abaikan */ } }
  return <Ctx.Provider value={{ daftar, aktif, pilih, muat, memuat }}>{children}</Ctx.Provider>
}
