-- ============================================================
-- 채용정보: 상담사 코멘트 칸 추가
-- Supabase 대시보드 → SQL Editor → 붙여넣고 Run (여러 번 실행해도 안전)
-- ============================================================
alter table public.jobs add column if not exists note text;  -- 상담사 코멘트 (선택, 카톡 문구에는 안 들어감)
notify pgrst, 'reload schema';
