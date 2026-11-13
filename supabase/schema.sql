-- ============================================================
-- 참여자 페이지 — Supabase 초기 설정
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
--
-- 실행 후, 관리자 이메일은 SQL Editor에서 따로 한 줄 실행하세요
-- (공개 저장소에 이메일이 남지 않도록 이 파일에는 적지 않습니다):
--   insert into public.admins (email) values ('내이메일@example.com');
-- ============================================================

-- ── 관리자 목록 (API로는 아무도 읽거나 쓸 수 없음) ──
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ── 사이트 설정 (한 줄만 존재) ──
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default '취업 준비 함께해요',
  greeting text not null default '반가워요 👋',
  lead text not null default '필요한 메뉴를 눌러 주세요.',
  theme text not null default 'a' check (theme in ('a', 'b', 'c')),
  primary_color text,   -- 직접 고른 주색 (비우면 테마 기본값)
  accent_color text,    -- 직접 고른 포인트색
  logo_url text,
  logo_path text,
  menus jsonb,          -- 메뉴 이름·아이콘·설명·표시 여부·순서
  extra jsonb not null default '{}'::jsonb, -- 배경 이미지, 하단 문구 등 추가 설정
  updated_at timestamptz default now()
);
alter table public.site_settings add column if not exists extra jsonb not null default '{}'::jsonb;
insert into public.site_settings (id) values (1) on conflict do nothing;
alter table public.site_settings enable row level security;

drop policy if exists "settings_read" on public.site_settings;
create policy "settings_read" on public.site_settings for select using (true);
drop policy if exists "settings_admin_update" on public.site_settings;
create policy "settings_admin_update" on public.site_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- ── 공지 ──
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  pinned boolean default false,
  created_at timestamptz default now()
);
alter table public.notices enable row level security;

drop policy if exists "notices_read" on public.notices;
create policy "notices_read" on public.notices for select using (true);
drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert" on public.notices for insert with check (public.is_admin());
drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update" on public.notices for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete" on public.notices for delete using (public.is_admin());

-- ── 자주 묻는 질문 ──
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null default '기타',
  question text not null,
  answer text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.faqs enable row level security;

drop policy if exists "faqs_read" on public.faqs;
create policy "faqs_read" on public.faqs for select using (true);
drop policy if exists "faqs_admin_insert" on public.faqs;
create policy "faqs_admin_insert" on public.faqs for insert with check (public.is_admin());
drop policy if exists "faqs_admin_update" on public.faqs;
create policy "faqs_admin_update" on public.faqs for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "faqs_admin_delete" on public.faqs;
create policy "faqs_admin_delete" on public.faqs for delete using (public.is_admin());

-- ── 자료실 ──
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  category text not null default '기타' check (category in ('이력서', '자소서', '면접', '기타')),
  title text not null,
  description text,
  file_url text not null,
  file_path text,       -- Storage에 올린 파일 경로 (삭제할 때 사용)
  file_name text,       -- 내려받을 때 보일 원래 파일 이름
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.resources enable row level security;

drop policy if exists "resources_read" on public.resources;
create policy "resources_read" on public.resources for select using (true);
drop policy if exists "resources_admin_insert" on public.resources;
create policy "resources_admin_insert" on public.resources for insert with check (public.is_admin());
drop policy if exists "resources_admin_update" on public.resources;
create policy "resources_admin_update" on public.resources for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "resources_admin_delete" on public.resources;
create policy "resources_admin_delete" on public.resources for delete using (public.is_admin());

-- ── 파일 저장소 (자료실 파일, 로고) ──
-- 공개 버킷: 링크를 아는 사람은 내려받을 수 있음. 올리기·지우기는 관리자만.
insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do update set public = true;

drop policy if exists "files_admin_insert" on storage.objects;
create policy "files_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_admin());
drop policy if exists "files_admin_update" on storage.objects;
create policy "files_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'files' and public.is_admin());
drop policy if exists "files_admin_delete" on storage.objects;
create policy "files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.is_admin());
