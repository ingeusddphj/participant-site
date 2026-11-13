# Supabase 연결 방법 (한 번만)

1. https://supabase.com 가입 → **New project**
   - Name: `participant-site`, Region: **Northeast Asia (Seoul)**
   - Database Password는 따로 적어 두기
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용 전체 붙여넣기 → **Run**
3. 같은 SQL Editor에서 관리자 이메일 등록 (본인 이메일로 바꿔서 실행):
   ```sql
   insert into public.admins (email) values ('내이메일@example.com');
   ```
4. **Authentication → Users → Add user → Create new user**
   - 3번과 같은 이메일 + 비밀번호, **Auto Confirm User** 체크
5. **Authentication → Sign In / Providers** → **Allow new users to sign up** 끄기
6. **Project Settings → API Keys** 에서 아래 두 값을 복사해 `assets/config.js`에 넣기
   - Project URL
   - anon public 키 (또는 `sb_publishable_`로 시작하는 키)
   - ⚠️ `service_role` / `secret` 키는 절대 넣지 않기
7. 배포 후 `https://ingeusddphj.github.io/participant-site/admin.html` 에서 로그인
