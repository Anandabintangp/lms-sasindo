-- Mahasiswa hanya melihat mata kuliah yang diikuti (berdasarkan enrollments)
create or replace function ikut_kuliah(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select is_dosen() or exists (select 1 from enrollments e where e.npm = my_npm() and e.course_id = cid and e.status = 'Aktif') $$;
grant execute on function ikut_kuliah(text) to authenticated;

drop policy if exists baca on mata_kuliah;
create policy baca on mata_kuliah for select to authenticated using (ikut_kuliah(course_id));
drop policy if exists baca on kelas;
create policy baca on kelas for select to authenticated using (ikut_kuliah(course_id));
drop policy if exists baca on pertemuan;
create policy baca on pertemuan for select to authenticated using (ikut_kuliah(course_id));
drop policy if exists baca on daftar_tugas;
create policy baca on daftar_tugas for select to authenticated
  using (exists (select 1 from pertemuan p where p.meeting_id = daftar_tugas.meeting_id and ikut_kuliah(p.course_id)));
drop policy if exists baca on materi;
create policy baca on materi for select to authenticated using (dipublikasi and ikut_kuliah(course_id));
drop policy if exists baca on sesi_presensi;
create policy baca on sesi_presensi for select to authenticated using (ikut_kuliah(course_id));

create or replace view soal_publik as
  select s.question_id, s.meeting_id, s.urutan, s.tipe, s.pertanyaan,
         s.opsi_a, s.opsi_b, s.opsi_c, s.opsi_d, s.skor_maks, s.gambar_path
  from soal_quiz s
  join pertemuan p on p.meeting_id = s.meeting_id
  where s.status = 'Aktif' and p.status = 'Aktif' and p.quiz_open and ikut_kuliah(p.course_id);
grant select on soal_publik to authenticated;
