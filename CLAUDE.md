# 참여자 페이지 — 작업 노트

국민취업지원제도 참여자(약 100명)용 사이트. 운영자는 직업상담사 1인(비개발자), 개발은 Claude Code.
처음 기획서 전문은 `docs/brief-original.md` (필요할 때만 읽기).

## 원칙
- **비용 0원** (무료 플랜만). **개인정보 최소화**: 참여자 실명·연락처·상담 내용은 사이트 DB에 저장하지 않음
- 내용은 전부 **관리자 페이지(admin.html)에서 상담사가 직접 고칠 수 있게** 만든다
- 사용자는 비개발자: 설명은 쉬운 말, 단계별로. 큰 변경은 시안 먼저 보여 주고 확정 후 구현
- 사이트 주소: https://ingeusddphj.github.io/participant-site/ (GitHub Pages, main에 push하면 1~2분 뒤 반영)

## 구조
- 순수 HTML/CSS/JS + Supabase(supabase-js 2.45.4, 공개 키만). DB 설치 `supabase/schema.sql`, 변경분 `supabase/migrations/00N_*.sql` (사용자가 SQL Editor에서 실행)
- `assets/site.js` 공통 머리글·메뉴·히어로·바로가기 / `pages.js` 공지·FAQ·자료실 / `jobs.js`+`jobparse.js` 채용정보 / `cheer.js`+`cheer.css` 응원 보드 / `admin.js` 관리자 / `defaults.js` 기본값·공용 함수 / `config.js` Supabase 주소·키·Edge Function 이름
- 관리자 권한: `admins` 테이블 + `is_admin()`. 가입 꺼 둠. 추가 설정값은 `site_settings.extra`(jsonb)
- 아이콘: `assets/icons/*.svg` (Lucide). `ico("이름")` / `<span data-ico="이름">`

## 기능 현황 (2026-11-14 기준)
- **메인**: 대표 사진 히어로 → 바로가기(목차형) → 응원 보드 → 최근 공지
- **공지 / FAQ**: 접고 펼치는 목록. FAQ는 분류별, 질문 앞 Q(노랑)·답변 앞 A(옅은 회색)
- **자료실**: 큰 분류(`resources.section`, 목록은 extra.resource_sections) + 작은 분류(category). 자료 하나에 파일 여러 개(`resources.files`). 유형 배지·날짜·NEW
- **응원 보드**: 코르크판 포스트잇. 별명 = 꾸밈말+꽃·식물(숫자 없음). 금지어·개인정보·도배 차단(화면+DB 트리거), 신고 3번 자동 숨김
- **채용정보**:
  - 관리자: 잡코리아 링크 또는 카톡 문구('링크' 줄 + `기업명/직무/경력/(기간)/학력/지역/기타/마감MMDD`) 붙여넣기 → 칸 채워진 편집 상자 → 저장. 카톡 복사 버튼은 관리자 목록에만
  - 잡코리아 읽기: Edge Function 코드 `supabase/functions/fetch-job/index.ts`, **설치 이름은 `clever-processor`**(config.js `jobFetchFunction`). 함수 안에서 is_admin 확인, 잡코리아 주소만. 근무지 여러 곳이면 '첫 지역 등'. 기업명 (주)·㈜는 유지
  - 규칙: 고용형태 미기재=정규직, 정규직이면 인재추천 가능. 기업 범주는 확실할 때만 자동. 상담사 코멘트(jobs.note) 있으면 표시, 카톡 문구엔 제외
  - 참여자: 요약 숫자·거르기·마감 임박순. 마감 후 30일은 '최근 마감된 공고'로 흐리게, 그 뒤 숨김. 상시 공고 유지. 자동 삭제 없음
  - 인재추천 희망 버튼 → 구글폼(extra.recommend_form, 첫 entry에 '기업 · 직무' 자동). 응답은 Apps Script로 상담사 회사 아웃룩에 메일. 개인정보는 구글폼에만
- **보류/미구현**: 상담사에게 보내기, 만족도, 참여 활동(워드클라우드 등)

## 디자인 원칙 (밝고 따뜻한 에디토리얼)
- 이모지 금지. 테두리선 대신 여백·바탕 톤(#f7f6f3/흰)·옅은 그림자. 글자는 먹색 #1c1a17, 인지어스 노랑 #fbba00은 강조에만
- 서체: 제목 마루 부리(MaruBuriBold), 영문 라벨 Instrument Serif 기울임, 본문 프리텐다드 (style.css `--font-head` 등)
- 섹션 제목 = 기울임 영문 라벨 + 명조 제목. 버튼 알약형. 머리글 투명→유리, 휴대폰 하단 탭은 떠 있는 유리 막대
- 사용자가 세련됨을 매우 중시. "템플릿·싸구려" 느낌을 싫어함

## 작업 규칙
- **assets/ 파일을 고치면** `python -X utf8 tools/bump.py` 실행 (모든 HTML의 `?v=` 버전 갱신, GitHub Pages 10분 캐시 대응)
- 화면 확인: `bash tools/preview.sh [페이지들]` → 가짜 DB(`tools/fake-supabase.js`)로 390px·1440px 스크린샷. 확인은 꼭 필요한 만큼만
- 커밋 메시지는 한국어로, push까지 (사용자가 매번 사이트에서 확인함)

## 다음에 할 일
1. **FAQ(·공지) 답변에 이미지 넣기** — 제안만 해 둔 상태, 사용자 확정 대기:
   - 올릴 때 브라우저에서 긴 변 1600px로 자동 압축(200~400KB) → Storage `files`
   - 본문에 `[사진1]` 자리 표시로 배치, 표시 안 한 사진은 맨 아래. 누르면 크게 보기, 사진별 설명 한 줄
   - DB에 images(jsonb) 칸 추가 SQL 필요. 공지에도 넣을지 물어봐야 함
2. PC 메인 바로가기 배치가 "여전히 이상하다"는 의견(구체적 지적은 아직 없음)
3. 상담사에게 보내기(보류 중)

## 사용자 확인 필요
- migrations 003(응원 보드)·004(자료실) 실행 여부 미확인 (005·006은 실행·동작 확인)
- Edge Function(clever-processor)에 '근무지 여러 곳 → 등' 들어간 최신 코드 재배포 여부 미확인
