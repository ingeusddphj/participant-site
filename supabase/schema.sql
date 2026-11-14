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
  section text not null default '취업 준비', -- 큰 분류 (관리자 페이지에서 목록 편집)
  category text not null default '기타',     -- 작은 분류 (자유 입력)
  title text not null,
  description text,
  files jsonb not null default '[]'::jsonb, -- 첨부 파일 [{url, path, name, size}]
  file_url text,        -- (예전 방식) 첫 파일
  file_path text,       -- Storage에 올린 파일 경로 (삭제할 때 사용)
  file_name text,       -- 내려받을 때 보일 원래 파일 이름
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.resources add column if not exists section text not null default '취업 준비';
alter table public.resources add column if not exists files jsonb not null default '[]'::jsonb;
alter table public.resources drop constraint if exists resources_category_check;
alter table public.resources alter column file_url drop not null;
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

-- ── 응원 보드 (migrations/003_cheers.sql 과 같음) ──
create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 60),
  nickname text not null check (char_length(nickname) between 1 and 30),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'mint', 'sky', 'lilac')),
  hidden boolean not null default false,   -- 관리자가 숨겼거나 신고가 쌓여 가려진 메모
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cheers_created_idx on public.cheers (created_at desc);
alter table public.cheers enable row level security;

grant select, insert on public.cheers to anon, authenticated;
grant update, delete on public.cheers to authenticated;

-- 누구나: 가려지지 않은 메모 읽기, 새 메모 붙이기 / 관리자: 전부 읽기·숨기기·지우기
drop policy if exists "cheers_read" on public.cheers;
create policy "cheers_read" on public.cheers for select using (hidden = false or public.is_admin());
drop policy if exists "cheers_insert" on public.cheers;
create policy "cheers_insert" on public.cheers for insert to anon, authenticated with check (true);
drop policy if exists "cheers_admin_update" on public.cheers;
create policy "cheers_admin_update" on public.cheers for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cheers_admin_delete" on public.cheers;
create policy "cheers_admin_delete" on public.cheers for delete using (public.is_admin());

-- 붙이기 전 검사: 개인정보·링크·금지어·도배 (화면에서 막아도 우회할 수 있어서 DB에서 한 번 더)
create or replace function public.cheers_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  txt text;
  flat text;
  w text;
  words text[] := array['시발','씨발','ㅅㅂ','병신','ㅂㅅ','개새','좆','지랄','꺼져','닥쳐'];
begin
  new.body := btrim(new.body);
  new.nickname := btrim(new.nickname);
  new.hidden := false;
  new.report_count := 0;
  new.created_at := now();

  txt := new.body || ' ' || new.nickname;
  flat := lower(regexp_replace(txt, '\s', '', 'g'));

  if flat ~ '01[016789][.-]?[0-9]{3,4}[.-]?[0-9]{4}' then raise exception 'CHEER_BLOCKED:phone'; end if;
  if flat ~ '[0-9]{6}-?[1-4][0-9]{6}' then raise exception 'CHEER_BLOCKED:rrn'; end if;
  if txt ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+' then raise exception 'CHEER_BLOCKED:email'; end if;
  if flat ~* '(https?://|www\.|open\.kakao|오픈채팅|카톡아이디)' then raise exception 'CHEER_BLOCKED:link'; end if;

  -- 관리자 페이지에서 추가한 금지어 (site_settings.extra.cheer_banned)
  select words || coalesce(array(select jsonb_array_elements_text(extra -> 'cheer_banned')), '{}')
    into words from public.site_settings where id = 1;
  foreach w in array coalesce(words, '{}') loop
    w := lower(regexp_replace(w, '\s', '', 'g'));
    if w <> '' and position(w in flat) > 0 then raise exception 'CHEER_BLOCKED:word'; end if;
  end loop;

  -- 도배 방지: 1분에 전체 10장까지, 같은 글은 하루에 한 번
  if (select count(*) from public.cheers where created_at > now() - interval '1 minute') >= 10 then
    raise exception 'CHEER_BLOCKED:busy';
  end if;
  if exists (select 1 from public.cheers where body = new.body and created_at > now() - interval '1 day') then
    raise exception 'CHEER_BLOCKED:dup';
  end if;
  return new;
end;
$$;

drop trigger if exists cheers_guard on public.cheers;
create trigger cheers_guard before insert on public.cheers
  for each row execute function public.cheers_guard();

-- 신고: 3번 쌓이면 자동으로 가려짐 (관리자 페이지에서 다시 보이게 할 수 있음)
create or replace function public.report_cheer(cheer_id uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.cheers
     set report_count = report_count + 1,
         hidden = hidden or report_count + 1 >= 3
   where id = cheer_id and hidden = false;
$$;
grant execute on function public.report_cheer(uuid) to anon, authenticated;


-- ── 채용정보 (migrations/005_jobs.sql 과 같음) ──
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  link text,                       -- 원문 공고 주소
  company text not null,           -- 기업명
  category text,                   -- 기업 범주 (대기업·중견기업·강소·중소·외국계·공공기관·스타트업)
  role text not null,              -- 직무
  employment text not null default '정규직',  -- 정규직·계약직·인턴·아르바이트·기타
  months int,                      -- 계약직·인턴 기간 (개월)
  career text,                     -- 신입·경력 3년↑·경력무관 …
  education text,                  -- 대졸·석사·학력무관 …
  region text,                     -- 쓴 그대로 (예: 경기 평택)
  area text,                       -- 거르기용: 서울·경기·기타
  etc text,                        -- 기타 자격요건
  salary text,                     -- 급여 (선택)
  deadline date,                   -- 마감일
  rolling boolean not null default false,  -- 상시·채용 시 마감
  recommend boolean not null default true, -- 인재추천 가능
  visible boolean not null default true,   -- 숨기기
  created_at timestamptz not null default now()
);
create index if not exists jobs_deadline_idx on public.jobs (deadline);
alter table public.jobs enable row level security;

grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;

drop policy if exists "jobs_read" on public.jobs;
create policy "jobs_read" on public.jobs for select using (visible or public.is_admin());
drop policy if exists "jobs_admin_insert" on public.jobs;
create policy "jobs_admin_insert" on public.jobs for insert with check (public.is_admin());
drop policy if exists "jobs_admin_update" on public.jobs;
create policy "jobs_admin_update" on public.jobs for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "jobs_admin_delete" on public.jobs;
create policy "jobs_admin_delete" on public.jobs for delete using (public.is_admin());

