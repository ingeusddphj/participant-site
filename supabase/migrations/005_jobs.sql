-- ============================================================
-- 채용정보 (상담사가 카톡 문구를 붙여넣어 등록)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
-- ============================================================

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

notify pgrst, 'reload schema';
