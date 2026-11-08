import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [sesi, setSesi] = useState(null)
  const [profil, setProfil] = useState(null)
  const [memuat, setMemuat] = useState(true)

  const muatProfil = useCallback(async (s) => {
    if (!s) { setProfil(null); return }
    const { data } = await supabase.from('profiles').select('role,npm').eq('user_id', s.user.id).maybeSingle()
    let p = data
    if (p && p.role === 'mahasiswa' && p.npm) {
      const { data: m } = await supabase.from('mahasiswa').select('nama,kelas').eq('npm', p.npm).maybeSingle()
      p = { ...p, nama: m?.nama, kelas: m?.kelas }
    }
    setProfil(p || null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesi(data.session)
      await muatProfil(data.session)
      setMemuat(false)
    })
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesi(s)
      setTimeout(() => muatProfil(s), 0) // hindari deadlock di dalam callback
    })
    return () => l.subscription.unsubscribe()
  }, [muatProfil])

  const keluar = async () => { await supabase.auth.signOut(); setProfil(null) }
  const segarkan = async () => {
    const { data } = await supabase.auth.getSession()
    await muatProfil(data.session)
  }

  return <Ctx.Provider value={{ sesi, profil, memuat, keluar, segarkan }}>{children}</Ctx.Provider>
}
