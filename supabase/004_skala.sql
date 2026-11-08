-- Skala banyak matkul/angkatan + gambar soal + catatan kelas
alter table kelas add column if not exists angkatan text;
alter table kelas add column if not exists tahun_akademik text;
alter table kelas add column if not exists semester text;

create table if not exists catatan_kelas (
  id uuid primary key default gen_random_uuid(),
  npm text references mahasiswa on delete cascade, course_id text references mata_kuliah, class_id text,
  pertemuan_ke int, tanggal date, penilaian text, catatan text,
  unique (npm, course_id, pertemuan_ke)
);
alter table catatan_kelas enable row level security;
drop policy if exists dosen_semua on catatan_kelas;
create policy dosen_semua on catatan_kelas for all to authenticated using (is_dosen()) with check (is_dosen());

-- bucket gambar soal (publik baca, dosen unggah)
insert into storage.buckets (id,name,public,file_size_limit) values ('soal','soal',true,3145728) on conflict (id) do nothing;
drop policy if exists soal_dosen on storage.objects;
create policy soal_dosen on storage.objects for all to authenticated using (bucket_id='soal' and is_dosen()) with check (bucket_id='soal' and is_dosen());

-- indeks untuk ribuan mahasiswa
create index if not exists ix_mhs_angkatan on mahasiswa(angkatan, kelas);
create index if not exists ix_enr_class on enrollments(class_id);
create index if not exists ix_enr_course on enrollments(course_id, npm);
create index if not exists ix_pert_course on pertemuan(course_id, pertemuan_ke);
create index if not exists ix_soal_mtg on soal_quiz(meeting_id, urutan);
create index if not exists ix_sub_mtg on quiz_submissions(meeting_id, npm);
create index if not exists ix_sub_npm on quiz_submissions(npm);
create index if not exists ix_resp_sub on respon_quiz(submission_id);
create index if not exists ix_resp_mtg on respon_quiz(meeting_id, question_id);
create index if not exists ix_tugas_asg on tugas(assignment_id, npm);
create index if not exists ix_tugas_npm on tugas(npm);
create index if not exists ix_pres_npm on presensi(npm);
create index if not exists ix_nilai_course on nilai(course_id, npm);
