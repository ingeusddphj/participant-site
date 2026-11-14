// 관리자 페이지에서 아무것도 바꾸지 않았을 때 쓰는 기본값과 공용 함수
window.DEFAULT_SETTINGS = {
  site_name: "취업 준비 함께해요",
  greeting: "취업까지, 상담사가 함께합니다",
  lead: "공지와 채용정보, 서류 자료를 한곳에서 확인하세요.",
  theme: "a",
  primary_color: null,
  accent_color: null,
  logo_url: null,
  extra: {
    eyebrow: "국민취업지원제도 참여자 안내",
    footer: "이 사이트는 참여자 안내를 위해 운영됩니다.\n이름·연락처 등 개인정보는 저장하지 않습니다.",
    hero_url: null,
  },
  menus: [
    { href: "notices.html",   icon_key: "megaphone",       name: "공지",             desc: "일정과 프로그램 안내",    visible: true, bottom: true },
    { href: "jobs.html",      icon_key: "briefcase",       name: "채용정보",         desc: "직무·경력·지역별 공고",   visible: true, bottom: true },
    { href: "resources.html", icon_key: "folder-open",     name: "자료실",           desc: "이력서·자소서·면접 자료", visible: true, bottom: true },
    { href: "board.html",     icon_key: "sticky-note",     name: "응원 보드",        desc: "서로에게 짧은 응원 남기기", visible: true, bottom: true },
    { href: "contact.html",   icon_key: "send",            name: "상담사에게 보내기", desc: "건의·질문·상담요청",      visible: true, bottom: false },
    { href: "faq.html",       icon_key: "circle-help",     name: "자주 묻는 질문",   desc: "수당·출석·구직활동 인정", visible: true, bottom: true },
  ],
};

// 관리자 페이지에서 고를 수 있는 아이콘 (assets/icons/ 안의 파일 이름)
window.ICON_CHOICES = [
  ["megaphone", "공지"], ["bell", "알림"], ["newspaper", "소식"], ["calendar-days", "일정"],
  ["briefcase", "채용"], ["search", "찾기"], ["map-pin", "지역"], ["award", "합격"],
  ["folder-open", "자료"], ["file-text", "문서"], ["clipboard-list", "체크"], ["book-open", "가이드"],
  ["messages-square", "게시판"], ["send", "보내기"], ["phone", "전화"], ["users", "모임"],
  ["circle-help", "질문"], ["lightbulb", "팁"], ["graduation-cap", "교육"], ["heart-handshake", "지원"],
  ["chart-column", "통계"], ["star", "추천"], ["house", "홈"], ["pin", "고정"],
  ["sticky-note", "메모"],
];

window.THEMES = {
  a: { label: "옐로", hero: "#111827", primary: "#fbba00", accent: "#fbba00" },
  b: { label: "블루", hero: "#0c4a6e", primary: "#1888be", accent: "#fbba00" },
  c: { label: "남색", hero: "#1c2532", primary: "#2d3a4b", accent: "#ffb600" },
};

// 화면에 글자를 넣을 때 HTML로 해석되지 않게 막는 함수
window.esc = function (s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};

// 선 아이콘 하나 (주소는 절대 경로로 — CSS 변수 안의 상대 경로는 브라우저마다 다르게 풀림)
const ICON_BASE = new URL("assets/icons/", document.baseURI).href;
const iconUrl = (name) => `url('${ICON_BASE}${String(name || "").replace(/[^a-z0-9-]/g, "")}.svg')`;
window.ico = function (name, cls = "", style = "") {
  return `<span class="ico ${cls}" style="--i:${iconUrl(name)};${style}" aria-hidden="true"></span>`;
};
// HTML에 직접 적은 <span data-ico="이름"> 을 아이콘으로 바꿈
window.hydrateIcons = function (root = document) {
  root.querySelectorAll("[data-ico]").forEach((el) => {
    el.classList.add("ico");
    el.style.setProperty("--i", iconUrl(el.dataset.ico));
    el.setAttribute("aria-hidden", "true");
  });
};
hydrateIcons();

// 메뉴 아이콘 타일: 올린 그림이 있으면 그림, 없으면 선 아이콘
window.menuTile = function (m) {
  if (m.icon_url) return `<span class="tile is-img"><img src="${esc(m.icon_url)}" alt=""></span>`;
  return `<span class="tile">${ico(m.icon_key || "file-text")}</span>`;
};

// 이전 버전 메뉴(이모지 아이콘)를 새 형식으로 맞춤
window.normalizeMenus = function (menus) {
  const defs = window.DEFAULT_SETTINGS.menus;
  const list = Array.isArray(menus) && menus.length ? menus : defs;
  return list.map((m) => {
    const d = defs.find((x) => x.href === m.href) || {};
    // 익명 게시판 → 응원 보드로 바뀜 (이름을 직접 바꾸지 않았다면 새 이름으로)
    if (m.href === "board.html" && m.name === "익명 게시판") m = Object.assign({}, m, { name: d.name, desc: d.desc, icon_key: m.icon_url ? m.icon_key : d.icon_key });
    return Object.assign({}, d, m, { icon_key: m.icon_key || d.icon_key || "file-text" });
  });
};

// 색상 적용 (테마 + 직접 고른 색)
window.applyColors = function (root, theme, primary, accent) {
  root.dataset.theme = theme || "a";
  ["--primary", "--primary-ink", "--on-primary", "--primary-soft", "--accent", "--hero-bg", "--hero-accent", "--on-accent"].forEach((p) => root.style.removeProperty(p));
  const lumOf = (h) => { const x = h.slice(1); const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  if (primary && /^#[0-9a-f]{6}$/i.test(primary)) {
    const hex = primary.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--on-primary", lum > 0.55 ? "#111827" : "#ffffff");
    root.style.setProperty("--primary-ink", lum > 0.55 ? `color-mix(in srgb, ${primary} 45%, #000)` : primary);
    root.style.setProperty("--primary-soft", `color-mix(in srgb, ${primary} 12%, #fff)`);
    root.style.setProperty("--hero-bg", lum > 0.55 ? "#111827" : `color-mix(in srgb, ${primary} 55%, #000)`);
  }
  if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--on-accent", lumOf(accent) > 0.5 ? "#111827" : "#ffffff");
    // 어두운 바탕(히어로) 위에서 안 보이는 강조색이면 주색이나 흰색으로 대신
    if (lumOf(accent) < 0.3) {
      const p = primary && /^#[0-9a-f]{6}$/i.test(primary) && lumOf(primary) > 0.45 ? primary : "#ffffff";
      root.style.setProperty("--hero-accent", p);
    }
  }
};
