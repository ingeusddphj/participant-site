// 모든 공개 페이지 공통: 사이트 설정(이름·색상·메뉴)을 불러와 머리글·하단 메뉴·메인 타일을 그립니다.
// 내용은 관리자 페이지(admin.html)에서 바꿉니다. 이 파일은 고칠 필요가 없습니다.
(function () {
  const cfg = window.SITE_CONFIG || {};
  window.db =
    cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  const CACHE_KEY = "site-settings-v1";

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function writeCache(s) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function merge(s) {
    const d = window.DEFAULT_SETTINGS;
    const out = Object.assign({}, d, s || {});
    if (!Array.isArray(out.menus) || !out.menus.length) out.menus = d.menus;
    return out;
  }

  function currentPage() {
    const file = location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  let header, nav;

  function render(s) {
    window.applyColors(document.documentElement, s.theme, s.primary_color, s.accent_color);
    const menus = s.menus.filter((m) => m.visible !== false);
    const here = currentPage();

    if (!header) {
      header = document.createElement("header");
      header.className = "site-header";
      document.body.prepend(header);
    }
    const logo = s.logo_url ? `<img class="site-logo" src="${esc(s.logo_url)}" alt="">` : "";
    header.innerHTML = `<div class="inner"><a class="site-title" href="index.html">${logo}${esc(s.site_name)}</a></div>`;

    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "bottom-nav";
      nav.setAttribute("aria-label", "주요 메뉴");
      document.body.append(nav);
    }
    const bottom = menus.filter((m) => m.bottom).slice(0, 5);
    nav.style.setProperty("--cols", bottom.length || 1);
    nav.innerHTML = `<ul>${bottom
      .map((m) => `<li><a href="${esc(m.href)}"${m.href === here ? ' aria-current="page"' : ""}><span class="icon" aria-hidden="true">${esc(m.icon)}</span>${esc(m.name)}</a></li>`)
      .join("")}</ul>`;

    const grid = document.querySelector("[data-menu-grid]");
    if (grid) {
      grid.innerHTML = menus
        .map((m) => `<li><a href="${esc(m.href)}">
          <span class="icon" aria-hidden="true">${esc(m.icon)}</span>
          <span class="name">${esc(m.name)}</span>
          <span class="desc">${esc(m.desc)}</span></a></li>`)
        .join("");
    }
    document.querySelectorAll("[data-setting]").forEach((el) => {
      el.textContent = s[el.dataset.setting] ?? "";
    });

    // 각 메뉴 페이지의 제목·설명도 메뉴 설정을 따름
    const mine = s.menus.find((m) => m.href === here);
    if (mine) {
      const h1 = document.querySelector("[data-page-title]");
      const lead = document.querySelector("[data-page-lead]");
      if (h1) h1.textContent = mine.name;
      if (lead) lead.textContent = mine.desc;
      document.title = `${mine.name} · ${s.site_name}`;
    } else if (here === "index.html") {
      document.title = s.site_name;
    }
  }

  // 1) 저장된 설정으로 바로 그리기 → 2) 최신 설정을 받아 다시 그리기
  render(merge(readCache()));
  if (window.db) {
    window.db.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        writeCache(data);
        render(merge(data));
      }
    });
  }
})();
