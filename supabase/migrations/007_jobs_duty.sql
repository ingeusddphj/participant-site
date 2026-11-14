-- ============================================================
-- 채용정보: 직무 분류 칸 추가 (상담사가 고용노동부 분류로 직접 입력, 자동 입력 안 함)
-- Supabase 대시보드 → SQL Editor → 붙여넣고 Run (여러 번 실행해도 안전)
-- ============================================================
alter table public.jobs add column if not exists duty text;
notify pgrst, 'reload schema';
