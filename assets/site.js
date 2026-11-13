// 모든 공개 페이지 공통: 사이트 설정(이름·색상·로고·메뉴)을 불러와
// 머리글, 하단 탭, 메인 화면, 페이지 제목, 바닥글을 그립니다.
// 내용은 관리자 페이지(admin.html)에서 바꿉니다. 이 파일은 고칠 필요가 없습니다.
(function () {
  const cfg = window.SITE_CONFIG || {};
  window.db =
    cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  const CACHE_KEY = "site-settings-v2";
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; } };
  const writeCache = (s) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) {} };

  function merge(s) {
    const d = window.DEFAULT_SETTINGS;
    const out = Object.assign({}, d, s || {});
    out.extra = Object.assign({}, d.extra, (s && s.extra) || {});
    out.menus = normalizeMenus(out.menus);
    return out;
  }

  const here = (() => {
    const f = location.pathname.split("/").pop();
    return f === "" ? "index.html" : f;
  })();
  const page = document.body.dataset.page;

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  const header = el("header", "site-header");
  const nav = el("nav", "bottom-nav");
  const footer = el("footer", "site-footer");
  nav.setAttribute("aria-label", "주요 메뉴");
  document.body.prepend(header);
  document.body.append(footer, nav);

  function render(s) {
    applyColors(document.documentElement, s.theme, s.primary_color, s.accent_color);
    const menus = s.menus.filter((m) => m.visible !== false);
    const cur = (m) => (m.href === here ? ' aria-current="page"' : "");

    // 머리글
    const mark = s.logo_url
      ? `<img src="${esc(s.logo_url)}" alt="">`
      : `<span class="brand-mark">${ico("heart-handshake")}</span>`;
    header.innerHTML = `<div class="container">
      <a class="brand" href="index.html">${mark}<span>${esc(s.site_name)}</span></a>
      <nav class="top-nav" aria-label="메뉴">${menus.map((m) => `<a href="${esc(m.href)}"${cur(m)}>${esc(m.name)}</a>`).join("")}</nav>
    </div>`;

    // 하단 탭 (최대 5개)
    const bottom = menus.filter((m) => m.bottom).slice(0, 5);
    nav.style.setProperty("--cols", bottom.length || 1);
    nav.innerHTML = `<ul>${bottom.map((m) => `<li><a href="${esc(m.href)}"${cur(m)}>${
      m.icon_url ? `<img class="nav-img" src="${esc(m.icon_url)}" alt="">` : ico(m.icon_key)
    }${esc(m.name)}</a></li>`).join("")}</ul>`;

    // 바닥글
    footer.innerHTML = `<div class="container">
      <strong>${esc(s.site_name)}</strong>
      <p>${esc(s.extra.footer || "")}</p>
      <p class="copy">© ${new Date().getFullYear()} ${esc(s.site_name)}</p>
    </div>`;

    // 메인 화면
    const hero = document.getElementById("hero");
    if (hero) {
      hero.classList.toggle("has-img", !!s.extra.hero_url);
      hero.style.setProperty("--hero-img", s.extra.hero_url ? `url("${encodeURI(s.extra.hero_url)}")` : "none");
      hero.innerHTML = `<div class="container">
        ${s.extra.eyebrow ? `<p class="eyebrow">${esc(s.extra.eyebrow)}</p>` : ""}
        <h1>${esc(s.greeting)}</h1>
        ${s.lead ? `<p>${esc(s.lead)}</p>` : ""}
      </div>`;
      document.title = s.site_name;
    }
    const grid = document.querySelector("[data-menu-grid]");
    if (grid) {
      grid.innerHTML = menus.map((m) => `<li><a class="quick-card" href="${esc(m.href)}">
        ${menuTile(m)}
        <span class="body"><span class="name">${esc(m.name)}</span><span class="desc">${esc(m.desc)}</span></span>
        ${ico("chevron-right", "chev")}
      </a></li>`).join("");
    }

    // 하위 페이지 제목
    const head = document.getElementById("page-head");
    const mine = s.menus.find((m) => m.href === here);
    if (head && mine) {
      head.innerHTML = `<div class="container">
        <p class="crumbs"><a href="index.html">홈</a>${ico("chevron-right")}<span>${esc(mine.name)}</span></p>
        <div class="page-head-row">${menuTile(mine)}<div><h1>${esc(mine.name)}</h1><p>${esc(mine.desc)}</p></div></div>
      </div>`;
      document.title = `${mine.name} · ${s.site_name}`;
    }
    window.SITE = s;
  }

  render(merge(readCache()));
  if (window.db) {
    window.db.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { writeCache(data); render(merge(data)); }
    });
  }
})();
