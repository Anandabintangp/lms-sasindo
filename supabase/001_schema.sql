-- LMS Unpad: skema dasar (Semiotika Budaya)
create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'mahasiswa' check (role in ('dosen','mahasiswa')),
  npm text unique
);

create table if not exists mata_kuliah (
  course_id text primary key, nama text not null, kode text, sks int,
  semester text, tahun_akademik text, status text default 'Aktif'
);
create table if not exists kelas (
  class_id text primary key, course_id text references mata_kuliah, nama_kelas text, status text default 'Aktif'
);
create table if not exists mahasiswa (
  npm text primary key, nama text not null, email text, no_hp text,
  angkatan text, kelas text, status text default 'Aktif'
);
create table if not exists enrollments (
  npm text references mahasiswa on delete cascade, class_id text references kelas,
  course_id text references mata_kuliah, status text default 'Aktif',
  primary key (npm, class_id)
);
create table if not exists kode_registrasi (
  kode text primary key, class_id text references kelas, aktif boolean default true
);

create table if not exists pertemuan (
  meeting_id text primary key, course_id text references mata_kuliah, class_id text default 'ALL',
  pertemuan_ke int, topik text, deskripsi text, tanggal date,
  quiz_open boolean default false, assignment_open boolean default false,
  quiz_duration_min int default 30, quiz_deadline timestamptz, assignment_deadline timestamptz,
  max_tab_switch int default 3, tab_penalty_points numeric default 2,
  status text default 'Aktif', quiz_ke int, assessment_type text
);
create table if not exists soal_quiz (
  question_id text primary key, meeting_id text references pertemuan on delete cascade,
  urutan int, tipe text check (tipe in ('Essay','Pilihan Ganda')), pertanyaan text,
  opsi_a text, opsi_b text, opsi_c text, opsi_d text, jawaban_benar text,
  kata_kunci_esai text, skor_maks numeric default 10, status text default 'Aktif', gambar_path text
);
create table if not exists quiz_drafts (
  npm text references mahasiswa on delete cascade, meeting_id text references pertemuan on delete cascade,
  jawaban jsonb default '{}'::jsonb, tab_switch_count int default 0,
  started_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (npm, meeting_id)
);
create table if not exists quiz_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  npm text references mahasiswa, meeting_id text references pertemuan,
  started_at timestamptz, submitted_at timestamptz default now(),
  tab_switch_count int default 0, penalty_total numeric default 0,
  score_before_penalty numeric default 0, final_score numeric default 0,
  status text default 'Submitted', attempt_no int default 1,
  exit_seconds_total int default 0, duration_seconds int,
  unique (npm, meeting_id, attempt_no)
);
create table if not exists respon_quiz (
  response_id uuid primary key default gen_random_uuid(),
  submission_id uuid references quiz_submissions on delete cascade,
  npm text references mahasiswa, meeting_id text references pertemuan,
  question_id text references soal_quiz, tipe_soal text, jawaban text,
  is_correct boolean, auto_score numeric default 0, manual_score numeric,
  final_score numeric generated always as (coalesce(manual_score, auto_score)) stored,
  catatan_dosen text
);
create index if not exists respon_sub_idx on respon_quiz (submission_id);
create index if not exists respon_meeting_idx on respon_quiz (meeting_id, question_id);
create table if not exists quiz_retake_permissions (
  permission_id uuid primary key default gen_random_uuid(),
  npm text references mahasiswa, meeting_id text references pertemuan,
  allowed_at timestamptz default now(), reason text, used_at timestamptz,
  status text default 'Allowed'
);

create table if not exists daftar_tugas (
  assignment_id text primary key, meeting_id text references pertemuan, judul text, instruksi text,
  deadline timestamptz, max_mb int default 5, status text default 'Aktif', tugas_ke int,
  late_grace_days int default 7, late_penalty_per_7_days numeric default 5
);
create table if not exists tugas (
  submission_id uuid primary key default gen_random_uuid(),
  assignment_id text references daftar_tugas, npm text references mahasiswa,
  file_name text, file_path text, submitted_at timestamptz default now(),
  late_days int default 0, late_periods int default 0, late_penalty_points numeric default 0,
  manual_score numeric, feedback text, status text default 'Submitted',
  final_score numeric generated always as (
    case when manual_score is null then null else greatest(0, manual_score - late_penalty_points) end
  ) stored
);
create index if not exists tugas_idx on tugas (assignment_id, npm, submitted_at);
create table if not exists nilai (
  grade_id uuid primary key default gen_random_uuid(),
  course_id text references mata_kuliah, npm text references mahasiswa,
  komponen text, source_id text, nilai numeric, catatan text, updated_at timestamptz default now()
);

-- fungsi bantu
create or replace function is_dosen() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'dosen') $$;
create or replace function my_npm() returns text language sql stable security definer set search_path = public as $$
  select npm from profiles where user_id = auth.uid() $$;

-- soal untuk mahasiswa (tanpa kunci jawaban)
create or replace view soal_publik as
  select s.question_id, s.meeting_id, s.urutan, s.tipe, s.pertanyaan,
         s.opsi_a, s.opsi_b, s.opsi_c, s.opsi_d, s.skor_maks, s.gambar_path
  from soal_quiz s
  join pertemuan p on p.meeting_id = s.meeting_id
  where s.status = 'Aktif' and p.status = 'Aktif' and p.quiz_open;
grant select on soal_publik to authenticated;

-- keamanan baris (RLS)
do $$
declare t text;
begin
  foreach t in array array['profiles','mata_kuliah','kelas','mahasiswa','enrollments','kode_registrasi','pertemuan',
    'soal_quiz','quiz_drafts','quiz_submissions','respon_quiz','quiz_retake_permissions','daftar_tugas','tugas','nilai'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists dosen_semua on %I', t);
    execute format('create policy dosen_semua on %I for all to authenticated using (is_dosen()) with check (is_dosen())', t);
  end loop;
  foreach t in array array['mata_kuliah','kelas','pertemuan','daftar_tugas'] loop
    execute format('drop policy if exists baca on %I', t);
    execute format('create policy baca on %I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['mahasiswa','enrollments','quiz_submissions','respon_quiz','quiz_retake_permissions','tugas','nilai'] loop
    execute format('drop policy if exists milik_sendiri on %I', t);
    execute format('create policy milik_sendiri on %I for select to authenticated using (npm = my_npm())', t);
  end loop;
end $$;
drop policy if exists profil_sendiri on profiles;
create policy profil_sendiri on profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists tugas_kirim on tugas;
create policy tugas_kirim on tugas for insert to authenticated
  with check (npm = my_npm() and exists (select 1 from daftar_tugas d where d.assignment_id = tugas.assignment_id and d.status = 'Aktif'));

-- penghitung keterlambatan tugas (di sisi server)
create or replace function tugas_hitung() returns trigger language plpgsql security definer set search_path = public as $$
declare d daftar_tugas%rowtype;
begin
  if not is_dosen() then
    new.manual_score := null; new.feedback := null; new.status := 'Submitted';
    new.submitted_at := now();
  end if;
  select * into d from daftar_tugas where assignment_id = new.assignment_id;
  if d.deadline is not null and new.submitted_at > d.deadline then
    new.late_days := ceil(extract(epoch from (new.submitted_at - d.deadline)) / 86400.0);
    if new.late_days > d.late_grace_days then
      new.late_periods := ceil((new.late_days - d.late_grace_days) / 7.0);
    else new.late_periods := 0; end if;
    new.late_penalty_points := new.late_periods * d.late_penalty_per_7_days;
  else
    new.late_days := 0; new.late_periods := 0; new.late_penalty_points := 0;
  end if;
  return new;
end $$;
drop trigger if exists trg_tugas_hitung on tugas;
create trigger trg_tugas_hitung before insert on tugas for each row execute function tugas_hitung();

-- kuis: mulai, simpan draft, kirim (skor dihitung di server)
create or replace function mulai_kuis(p_meeting text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_npm text := my_npm(); m pertemuan%rowtype; d quiz_drafts%rowtype; v_boleh boolean;
begin
  if v_npm is null then raise exception 'Bukan akun mahasiswa'; end if;
  select * into m from pertemuan where meeting_id = p_meeting;
  if not found or not m.quiz_open or m.status <> 'Aktif' then raise exception 'Kuis belum dibuka'; end if;
  v_boleh := not exists (select 1 from quiz_submissions where npm = v_npm and meeting_id = p_meeting)
          or exists (select 1 from quiz_retake_permissions where npm = v_npm and meeting_id = p_meeting and status = 'Allowed');
  if not v_boleh then return jsonb_build_object('sudah_kirim', true); end if;
  insert into quiz_drafts (npm, meeting_id) values (v_npm, p_meeting) on conflict do nothing;
  select * into d from quiz_drafts where npm = v_npm and meeting_id = p_meeting;
  return jsonb_build_object('sudah_kirim', false, 'durasi_menit', m.quiz_duration_min,
    'started_at', d.started_at, 'sekarang', now(), 'jawaban', d.jawaban, 'tab', d.tab_switch_count,
    'soal', (select coalesce(jsonb_agg(to_jsonb(s) order by s.urutan), '[]'::jsonb) from soal_publik s where s.meeting_id = p_meeting));
end $$;

create or replace function simpan_draft(p_meeting text, p_jawaban jsonb, p_tab int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  update quiz_drafts set jawaban = p_jawaban, tab_switch_count = greatest(tab_switch_count, p_tab), updated_at = now()
  where npm = my_npm() and meeting_id = p_meeting;
end $$;

create or replace function kirim_kuis(p_meeting text, p_jawaban jsonb, p_tab int default 0, p_exit_sec int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_npm text := my_npm(); m pertemuan%rowtype; v_start timestamptz; v_att int; v_sub uuid := gen_random_uuid();
  q soal_quiz%rowtype; ans text; sc numeric; ok boolean; tot numeric := 0; kws text[]; k text; hits int; nk int;
  pen numeric; fin numeric; st text := 'Submitted';
begin
  if v_npm is null then raise exception 'Bukan akun mahasiswa'; end if;
  select * into m from pertemuan where meeting_id = p_meeting;
  if not found or not m.quiz_open or m.status <> 'Aktif' then raise exception 'Kuis belum dibuka'; end if;
  select coalesce(max(attempt_no), 0) + 1 into v_att from quiz_submissions where npm = v_npm and meeting_id = p_meeting;
  if v_att > 1 and not exists (select 1 from quiz_retake_permissions where npm = v_npm and meeting_id = p_meeting and status = 'Allowed') then
    raise exception 'Kuis sudah pernah dikirim';
  end if;
  select started_at into v_start from quiz_drafts where npm = v_npm and meeting_id = p_meeting;
  v_start := coalesce(v_start, now());
  if now() > v_start + make_interval(mins => m.quiz_duration_min) + interval '60 seconds' then st := 'Lewat waktu'; end if;
  insert into quiz_submissions (submission_id, npm, meeting_id, started_at, attempt_no, tab_switch_count, exit_seconds_total, status)
    values (v_sub, v_npm, p_meeting, v_start, v_att, coalesce(p_tab, 0), coalesce(p_exit_sec, 0), st);
  for q in select * from soal_quiz where meeting_id = p_meeting and status = 'Aktif' order by urutan loop
    ans := coalesce(p_jawaban ->> q.question_id, ''); ok := null; sc := 0;
    if q.tipe = 'Pilihan Ganda' then
      ok := upper(trim(ans)) = upper(trim(coalesce(q.jawaban_benar, '')));
      sc := case when ok then q.skor_maks else 0 end;
    elsif coalesce(q.kata_kunci_esai, '') <> '' then
      select coalesce(array_agg(distinct lower(trim(x))), '{}') into kws
        from unnest(string_to_array(q.kata_kunci_esai, ',')) x where trim(x) <> '';
      nk := coalesce(array_length(kws, 1), 0); hits := 0;
      foreach k in array kws loop if position(k in lower(ans)) > 0 then hits := hits + 1; end if; end loop;
      sc := case when nk > 0 then q.skor_maks * hits / nk else 0 end;
    end if;
    insert into respon_quiz (submission_id, npm, meeting_id, question_id, tipe_soal, jawaban, is_correct, auto_score)
      values (v_sub, v_npm, p_meeting, q.question_id, q.tipe, ans, ok, sc);
    tot := tot + sc;
  end loop;
  pen := coalesce(p_tab, 0) * coalesce(m.tab_penalty_points, 0);
  fin := greatest(0, tot - pen);
  update quiz_submissions set score_before_penalty = tot, penalty_total = pen, final_score = fin,
    duration_seconds = extract(epoch from (now() - v_start))::int where submission_id = v_sub;
  update quiz_retake_permissions set status = 'Used', used_at = now()
    where permission_id in (select permission_id from quiz_retake_permissions
      where npm = v_npm and meeting_id = p_meeting and status = 'Allowed' order by allowed_at limit 1);
  delete from quiz_drafts where npm = v_npm and meeting_id = p_meeting;
  return jsonb_build_object('ok', true, 'status', st);
end $$;

revoke all on function mulai_kuis(text), simpan_draft(text, jsonb, int), kirim_kuis(text, jsonb, int, int) from public, anon;
grant execute on function mulai_kuis(text), simpan_draft(text, jsonb, int), kirim_kuis(text, jsonb, int, int) to authenticated;

-- penyimpanan berkas tugas (privat, PDF maks 5 MB, folder = NPM)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tugas', 'tugas', false, 5242880, array['application/pdf']) on conflict (id) do nothing;
drop policy if exists tugas_unggah on storage.objects;
create policy tugas_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'tugas' and (storage.foldername(name))[1] = my_npm());
drop policy if exists tugas_baca on storage.objects;
create policy tugas_baca on storage.objects for select to authenticated
  using (bucket_id = 'tugas' and ((storage.foldername(name))[1] = my_npm() or is_dosen()));
