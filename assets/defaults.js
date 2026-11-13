// 관리자 페이지에서 아무것도 바꾸지 않았을 때 쓰는 기본값
window.DEFAULT_SETTINGS = {
  site_name: "취업 준비 함께해요",
  greeting: "반가워요 👋",
  lead: "필요한 메뉴를 눌러 주세요.",
  theme: "a",
  primary_color: null,
  accent_color: null,
  logo_url: null,
  menus: [
    { href: "notices.html",   icon: "📢", name: "공지",             desc: "일정과 프로그램 안내",    visible: true, bottom: true },
    { href: "jobs.html",      icon: "💼", name: "채용정보",         desc: "직무·경력·지역별 공고",   visible: true, bottom: true },
    { href: "resources.html", icon: "📂", name: "자료실",           desc: "이력서·자소서·면접 자료", visible: true, bottom: true },
    { href: "board.html",     icon: "💬", name: "익명 게시판",      desc: "고민과 후기 나누기",      visible: true, bottom: true },
    { href: "contact.html",   icon: "✉️", name: "상담사에게 보내기", desc: "건의·질문·상담요청",      visible: true, bottom: true },
    { href: "faq.html",       icon: "❓", name: "자주 묻는 질문",   desc: "수당·출석·구직활동 인정", visible: true, bottom: false },
  ],
};

window.THEMES = {
  a: { label: "A 옐로", primary: "#fbba00", accent: "#1888be" },
  b: { label: "B 블루", primary: "#1888be", accent: "#fbba00" },
  c: { label: "C 남색", primary: "#36414f", accent: "#ffb600" },
};

// 화면에 글자를 넣을 때 HTML로 해석되지 않게 막는 함수
window.esc = function (s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};

// 색상 직접 지정 시 글씨색·진한색·연한색 자동 계산
window.applyColors = function (root, theme, primary, accent) {
  root.dataset.theme = theme || "a";
  const props = ["--primary", "--primary-strong", "--on-primary", "--primary-soft", "--accent"];
  props.forEach((p) => root.style.removeProperty(p));
  if (primary) {
    const hex = primary.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--on-primary", lum > 0.55 ? "#111827" : "#ffffff");
    root.style.setProperty("--primary-strong", lum > 0.55 ? `color-mix(in srgb, ${primary} 45%, #000)` : `color-mix(in srgb, ${primary} 85%, #000)`);
    root.style.setProperty("--primary-soft", `color-mix(in srgb, ${primary} 15%, #fff)`);
  }
  if (accent) root.style.setProperty("--accent", accent);
};
