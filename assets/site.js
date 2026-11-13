// 공통 머리글·하단 메뉴를 모든 페이지에 넣습니다.
// 메뉴를 바꾸려면 아래 MENUS 배열만 고치면 됩니다.
const SITE_NAME = "취업 준비 함께해요"; // 기관 명칭은 운영 허락 후 변경

const MENUS = [
  { href: "notices.html",   icon: "📢", name: "공지",            desc: "일정과 프로그램 안내",       bottom: true },
  { href: "jobs.html",      icon: "💼", name: "채용정보",        desc: "직무·경력·지역별 공고",      bottom: true },
  { href: "resources.html", icon: "📂", name: "자료실",          desc: "이력서·자소서·면접 자료",    bottom: true },
  { href: "board.html",     icon: "💬", name: "익명 게시판",     desc: "고민과 후기 나누기",         bottom: true },
  { href: "contact.html",   icon: "✉️", name: "상담사에게 보내기", desc: "건의·질문·상담요청",       bottom: true },
  { href: "faq.html",       icon: "❓", name: "자주 묻는 질문",  desc: "수당·출석·구직활동 인정",    bottom: false },
];

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "index.html" : file;
}

function renderHeader() {
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `<div class="inner"><a class="site-title" href="index.html">${SITE_NAME}</a></div>`;
  document.body.prepend(header);
}

function renderBottomNav() {
  const here = currentPage();
  const items = MENUS.filter((m) => m.bottom)
    .map((m) => {
      const current = m.href === here ? ' aria-current="page"' : "";
      return `<li><a href="${m.href}"${current}><span class="icon" aria-hidden="true">${m.icon}</span>${m.name}</a></li>`;
    })
    .join("");
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "주요 메뉴");
  nav.innerHTML = `<ul>${items}</ul>`;
  document.body.append(nav);
}

function renderMenuGrid() {
  const grid = document.querySelector("[data-menu-grid]");
  if (!grid) return;
  grid.innerHTML = MENUS.map(
    (m) => `<li><a href="${m.href}">
      <span class="icon" aria-hidden="true">${m.icon}</span>
      <span class="name">${m.name}</span>
      <span class="desc">${m.desc}</span>
    </a></li>`
  ).join("");
}

renderHeader();
renderBottomNav();
renderMenuGrid();
