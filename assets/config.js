// Supabase 연결 정보 — 대시보드 → Project Settings → API 에서 복사
// 이 두 값은 공개되어도 괜찮은 값입니다 (권한은 DB의 RLS 규칙이 지킵니다).
// ⚠️ service_role / secret 키는 절대 여기에 넣지 마세요.
window.SITE_CONFIG = {
  supabaseUrl: "",      // 예: https://abcdefgh.supabase.co
  supabaseAnonKey: "",  // anon public 키 또는 sb_publishable_ 로 시작하는 키
};
