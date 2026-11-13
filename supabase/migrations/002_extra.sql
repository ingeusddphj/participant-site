-- 002: 사이트 설정에 추가 항목(배경 이미지, 하단 문구 등)을 담을 칸 추가
-- SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
alter table public.site_settings add column if not exists extra jsonb not null default '{}'::jsonb;
