import { useEffect, useState } from 'react'

export const fmtTgl = (d, jam = true) =>
  d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', ...(jam ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '-'
export const angka = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }))
export const keInputTgl = (iso) => {
  if (!iso) return ''
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const dariInputTgl = (v) => (v ? new Date(v).toISOString() : null)
export const acak = (n = 8) => crypto.randomUUID().replace(/-/g, '').slice(0, n).toUpperCase()

// Menjalankan promise Supabase dan melempar error bila ada.
export async function q(p) { const { data, error } = await p; if (error) throw error; return data }

// Mengambil semua baris (batas bawaan Supabase 1000 baris/permintaan).
export async function ambilSemua(buat) {
  const out = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await buat(i, i + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export function unduhCSV(nama, baris) {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const teks = '﻿' + baris.map((r) => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([teks], { type: 'text/csv;charset=utf-8' }))
  a.download = nama; a.click(); URL.revokeObjectURL(a.href)
}

export function useMuat(fn, deps = []) {
  const [s, setS] = useState({ data: null, error: null, memuat: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let batal = false
    setS((x) => ({ ...x, memuat: true, error: null }))
    fn().then((d) => !batal && setS({ data: d, error: null, memuat: false }))
      .catch((e) => !batal && setS({ data: null, error: e.message || String(e), memuat: false }))
    return () => { batal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { ...s, ulang: () => setN((x) => x + 1) }
}

export function Spinner({ teks = 'Memuat…' }) {
  return <div className="flex items-center gap-3 py-10 text-sm text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-maroon-700 border-t-transparent" />{teks}</div>
}

export function Pesan({ jenis = 'info', children }) {
  if (!children) return null
  const c = { info: 'bg-sky-50 text-sky-900 ring-sky-200', ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200', err: 'bg-red-50 text-red-900 ring-red-200', warn: 'bg-amber-50 text-amber-900 ring-amber-200' }[jenis]
  return <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${c}`}>{children}</div>
}

export function Judul({ judul, sub, aksi }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-4 border-gold-400 pb-3">
      <div>
        <h1 className="text-2xl font-bold text-maroon-800">{judul}</h1>
        {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{aksi}</div>
    </div>
  )
}

export function Modal({ judul, onTutup, children, lebar = 'max-w-2xl' }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [onTutup])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div className={`mt-10 w-full ${lebar} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-maroon-800">{judul}</h2>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={onTutup} aria-label="Tutup">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Bidang({ label, children, bantu }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {bantu && <span className="mt-1 block text-xs text-slate-500">{bantu}</span>}
    </label>
  )
}
