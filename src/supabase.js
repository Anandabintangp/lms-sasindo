import { createClient } from '@supabase/supabase-js'

// Kunci "publishable" aman berada di sisi klien; keamanan data dijaga oleh RLS di database.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://ajsgrwavnaywwypcpkpx.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_7YsI7Sp2vdSGrX7HlIx4yw_6w71Fe-L'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// Login memakai NPM (atau ID dosen) -> dipetakan ke email sintetis.
export const emailDari = (id) => `${String(id).trim().toLowerCase()}@mhs.sasindo.id`
