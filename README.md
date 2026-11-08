# LMS Sastra Indonesia Unpad

Aplikasi pembelajaran daring (Vite + React + Tailwind) dengan backend Supabase (Postgres, Auth, RLS, Storage),
di-deploy ke GitHub Pages lewat GitHub Actions.

- Peran: **dosen** (materi, kuis, tugas, presensi, nilai, reset sandi) dan **mahasiswa** (materi, kuis, unggah tugas, presensi, nilai).
- Login memakai NPM + kata sandi. Pendaftaran memakai kode registrasi dari dosen.
- Keamanan data memakai Row Level Security; penilaian kuis dan pengurang keterlambatan dihitung di server.

## Menjalankan lokal
```
npm install
npm run dev
```
Variabel opsional (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (kunci *publishable*, bukan *secret*).

## Deploy
Push ke cabang `main`; workflow `.github/workflows/deploy.yml` membangun dan menerbitkan ke GitHub Pages
(Settings → Pages → Source: GitHub Actions).
