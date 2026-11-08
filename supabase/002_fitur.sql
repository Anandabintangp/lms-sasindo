-- Tambahan: materi, presensi, registrasi, reset sandi
alter table tugas add column if not exists drive_url text;
alter table kode_registrasi add column if not exists role text not null default 'mahasiswa';
alter table kode_registrasi add column if not exists keterangan text;

create table if not exists materi (
  id uuid primary key default gen_random_uuid(),
  course_id text references mata_kuliah, class_id text default 'ALL', pertemuan_ke int,
  judul text not null, deskripsi text, tipe text default 'Tautan' check (tipe in ('Tautan','PDF','Teks')),
  url text, file_path text, dipublikasi boolean default true, created_at timestamptz default now()
);
create table if not exists sesi_presensi (
  id uuid primary key default gen_random_uuid(),
  course_id text references mata_kuliah, class_id text references kelas, pertemuan_ke int not null,
  tanggal date default current_date, dibuka boolean default false, dibuka_sampai timestamptz,
  created_at timestamptz default now(), unique (class_id, pertemuan_ke)
);
create table if not exists sesi_kode (
  sesi_id uuid primary key references sesi_presensi on delete cascade, kode text not null
);
create table if not exists presensi (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid references sesi_presensi on delete cascade, npm text references mahasiswa on delete cascade,
  status text not null check (status in ('Hadir','Izin','Sakit','Alpa')),
  sumber text default 'Manual' check (sumber in ('Manual','Kode')), catatan text,
  dicatat_at timestamptz default now(), unique (sesi_id, npm)
);

do $$
declare t text;
begin
  foreach t in array array['materi','sesi_presensi','sesi_kode','presensi'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists dosen_semua on %I', t);
    execute format('create policy dosen_semua on %I for all to authenticated using (is_dosen()) with check (is_dosen())', t);
  end loop;
end $$;
drop policy if exists baca on materi;
create policy baca on materi for select to authenticated using (dipublikasi);
drop policy if exists baca on sesi_presensi;
create policy baca on sesi_presensi for select to authenticated using (true);
drop policy if exists milik_sendiri on presensi;
create policy milik_sendiri on presensi for select to authenticated using (npm = my_npm());

-- akun: klaim dengan kode registrasi, reset sandi oleh dosen
create or replace function klaim_akun(p_kode text, p_npm text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); k kode_registrasi%rowtype; v_role text;
begin
  if v_uid is null then raise exception 'Harus login'; end if;
  select role into v_role from profiles where user_id = v_uid;
  if found then return jsonb_build_object('role', v_role); end if;
  select * into k from kode_registrasi where upper(kode) = upper(trim(p_kode)) and aktif;
  if not found then raise exception 'Kode registrasi tidak valid'; end if;
  if k.role = 'dosen' then
    insert into profiles (user_id, role) values (v_uid, 'dosen');
    update kode_registrasi set aktif = false where kode = k.kode;
    return jsonb_build_object('role', 'dosen');
  end if;
  if p_npm is null or not exists (select 1 from enrollments e where e.npm = p_npm and e.class_id = k.class_id) then
    raise exception 'NPM tidak terdaftar di kelas ini';
  end if;
  if exists (select 1 from profiles where npm = p_npm) then
    raise exception 'NPM ini sudah punya akun. Minta dosen mereset kata sandi.';
  end if;
  insert into profiles (user_id, role, npm) values (v_uid, 'mahasiswa', p_npm);
  return jsonb_build_object('role', 'mahasiswa');
end $$;

create or replace function dosen_reset_password(p_npm text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not is_dosen() then raise exception 'Hanya dosen'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Kata sandi minimal 6 karakter'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
    where id = (select user_id from profiles where npm = p_npm);
  if not found then raise exception 'Mahasiswa ini belum punya akun'; end if;
end $$;

-- presensi: dosen membuka sesi (kode acak), mahasiswa check-in
create or replace function buka_sesi_presensi(p_class text, p_ke int, p_menit int default 30) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_kode text; v_course text;
begin
  if not is_dosen() then raise exception 'Hanya dosen'; end if;
  select course_id into v_course from kelas where class_id = p_class;
  insert into sesi_presensi (course_id, class_id, pertemuan_ke) values (v_course, p_class, p_ke)
    on conflict (class_id, pertemuan_ke) do nothing;
  select id into v_id from sesi_presensi where class_id = p_class and pertemuan_ke = p_ke;
  v_kode := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into sesi_kode (sesi_id, kode) values (v_id, v_kode) on conflict (sesi_id) do update set kode = excluded.kode;
  update sesi_presensi set dibuka = true, dibuka_sampai = now() + make_interval(mins => p_menit) where id = v_id;
  return v_kode;
end $$;

create or replace function tutup_sesi_presensi(p_sesi uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_dosen() then raise exception 'Hanya dosen'; end if;
  update sesi_presensi set dibuka = false where id = p_sesi;
end $$;

create or replace function checkin_presensi(p_kode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_npm text := my_npm(); s sesi_presensi%rowtype;
begin
  if v_npm is null then raise exception 'Bukan akun mahasiswa'; end if;
  select sp.* into s from sesi_presensi sp join sesi_kode k on k.sesi_id = sp.id
    where upper(k.kode) = upper(trim(p_kode)) and sp.dibuka and (sp.dibuka_sampai is null or now() <= sp.dibuka_sampai)
      and sp.class_id in (select class_id from enrollments where npm = v_npm and status = 'Aktif') limit 1;
  if not found then raise exception 'Kode salah atau sesi presensi sudah ditutup'; end if;
  insert into presensi (sesi_id, npm, status, sumber) values (s.id, v_npm, 'Hadir', 'Kode')
    on conflict (sesi_id, npm) do nothing;
  return jsonb_build_object('ok', true, 'pertemuan_ke', s.pertemuan_ke);
end $$;

-- nilai kuis ikut berubah saat dosen menilai esai
create or replace function hitung_ulang_kuis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update quiz_submissions s set
    score_before_penalty = x.t, final_score = greatest(0, x.t - s.penalty_total)
  from (select coalesce(sum(final_score), 0) t from respon_quiz where submission_id = new.submission_id) x
  where s.submission_id = new.submission_id;
  return new;
end $$;
drop trigger if exists trg_hitung_ulang_kuis on respon_quiz;
create trigger trg_hitung_ulang_kuis after update of manual_score on respon_quiz
  for each row execute function hitung_ulang_kuis();

revoke all on function klaim_akun(text, text), dosen_reset_password(text, text), buka_sesi_presensi(text, int, int),
  tutup_sesi_presensi(uuid), checkin_presensi(text) from public, anon;
grant execute on function klaim_akun(text, text), dosen_reset_password(text, text), buka_sesi_presensi(text, int, int),
  tutup_sesi_presensi(uuid), checkin_presensi(text) to authenticated;

-- penyimpanan materi (privat; dosen unggah, semua yang login boleh baca)
insert into storage.buckets (id, name, public, file_size_limit)
  values ('materi', 'materi', false, 20971520) on conflict (id) do nothing;
drop policy if exists materi_baca on storage.objects;
create policy materi_baca on storage.objects for select to authenticated using (bucket_id = 'materi');
drop policy if exists materi_tulis on storage.objects;
create policy materi_tulis on storage.objects for all to authenticated
  using (bucket_id = 'materi' and is_dosen()) with check (bucket_id = 'materi' and is_dosen());
-- dosen boleh mengunduh berkas tugas mahasiswa sudah diatur di 001
