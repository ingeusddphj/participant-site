-- ============================================================
-- 자료실 개편: 큰 분류(section) + 자료 하나에 파일 여러 개(files)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
-- ============================================================

-- 큰 분류 (제도 안내 / 운영 안내 / 취업 준비 …). 기존 자료는 '취업 준비'로
alter table public.resources add column if not exists section text not null default '취업 준비';

-- 첨부 파일 목록: [{ "url", "path", "name", "size" }, …]
alter table public.resources add column if not exists files jsonb not null default '[]'::jsonb;

-- 작은 분류를 자유롭게 쓸 수 있도록 고정 목록 제한을 풂
alter table public.resources drop constraint if exists resources_category_check;

-- 예전 방식(파일 한 개) 자료를 새 목록으로 옮김
alter table public.resources alter column file_url drop not null;
update public.resources
   set files = jsonb_build_array(jsonb_build_object('url', file_url, 'path', file_path, 'name', file_name))
 where files = '[]'::jsonb and file_url is not null;

notify pgrst, 'reload schema';
