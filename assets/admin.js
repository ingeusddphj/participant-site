// 관리자 페이지 동작. 권한은 DB(RLS)가 최종적으로 막으므로, 이 화면은 편의를 위한 것입니다.
(function () {
  const cfg = window.SITE_CONFIG || {};
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const views = ["setup", "login", "denied", "admin"];
  const show = (name) => views.forEach((v) => ($("#view-" + v).hidden = v !== name));

  let toastTimer;
  function toast(msg, bad) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 3000);
  }
  function fail(e) {
    console.error(e);
    const msg = String(e && (e.message || e));
    if (/extra/.test(msg) && /column/.test(msg)) return toast("DB 업데이트가 필요해요: supabase/migrations/002_extra.sql 을 실행해 주세요.", true);
    if (/cheers|report_cheer/.test(msg) && /relation|schema|does not exist|find/i.test(msg)) return toast("DB 업데이트가 필요해요: supabase/migrations/003_cheers.sql 을 실행해 주세요.", true);
    if (/exceeded|too large|413/i.test(msg)) return toast("파일이 너무 커요. 50MB 이하로 올려 주세요.", true);
    toast("저장하지 못했어요: " + msg, true);
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { show("setup"); return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const BUCKET = "files";

  // ───────── 로그인 ─────────
  let started = false;
  db.auth.onAuthStateChange((_event, session) => {
    if (!session) { started = false; show("login"); return; }
    if (started) return;
    started = true;
    setTimeout(enter, 0);
  });
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await db.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    btn.disabled = false;
    if (error) toast("이메일 또는 비밀번호가 맞지 않아요.", true);
  });
  $$("[data-logout]").forEach((b) => b.addEventListener("click", () => db.auth.signOut()));

  async function enter() {
    const { data: ok, error } = await db.rpc("is_admin");
    if (error || !ok) { show("denied"); return; }
    show("admin");
    await loadSettings();
    Object.keys(COLLECTIONS).forEach((k) => initCollection(k));
    initResources();
    initJobs();
    initCheers();
  }

  // ───────── 탭 ─────────
  $$("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b === btn));
      $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== btn.dataset.tab));
      window.scrollTo({ top: 0 });
    })
  );

  // ───────── 파일 ─────────
  async function upload(file, folder) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    return { url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path };
  }
  async function removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (list.length) await db.storage.from(BUCKET).remove(list);
  }
  const objectUrl = (file) => (file ? URL.createObjectURL(file) : null);

  // ───────── 사이트 꾸미기 ─────────
  const form = $("#settings-form");
  let saved;        // DB에 저장된 값
  let menus;        // 편집 중인 메뉴 (항목마다 _file: 새로 고른 그림)
  let media;        // { logo: {url, path, file, removed}, hero: {...} }
  let dirty = false;

  function setDirty(on) {
    dirty = on;
    const st = $("#save-status");
    st.textContent = on ? "저장하지 않은 변경 사항이 있어요" : "저장된 상태예요";
    st.classList.toggle("dirty", on);
  }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  async function loadSettings() {
    const { data, error } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return fail(error);
    saved = Object.assign({}, DEFAULT_SETTINGS, data || {});
    saved.extra = Object.assign({}, DEFAULT_SETTINGS.extra, (data && data.extra) || {});
    fillSettings();
  }

  function fillSettings() {
    const s = saved;
    form.elements.site_name.value = s.site_name || "";
    form.elements.greeting.value = s.greeting || "";
    form.elements.lead.value = s.lead || "";
    form.elements.eyebrow.value = s.extra.eyebrow || "";
    form.elements.footer.value = s.extra.footer || "";

    $("#theme-options").innerHTML = Object.entries(THEMES).map(([key, t]) => `
      <label class="theme-card"><input type="radio" name="theme" value="${key}" ${s.theme === key ? "checked" : ""}>
        <span class="sw" style="background:${t.hero}"><i style="background:${t.primary}"></i><i style="background:${t.accent}"></i></span>
        <span class="lb">${esc(t.label)}</span></label>`).join("");
    if (!form.querySelector('[name="theme"]:checked')) form.querySelector('[name="theme"]').checked = true;

    $("#custom-primary-on").checked = !!s.primary_color;
    $("#custom-accent-on").checked = !!s.accent_color;
    $("#custom-primary").value = s.primary_color || THEMES[s.theme]?.primary || "#fbba00";
    $("#custom-accent").value = s.accent_color || THEMES[s.theme]?.accent || "#fbba00";

    menus = normalizeMenus(s.menus).map((m) => ({ ...m }));
    media = {
      logo: { url: s.logo_url, path: s.logo_path, file: null, removed: false },
      hero: { url: s.extra.hero_url, path: s.extra.hero_path, file: null, removed: false },
    };
    renderMedia();
    renderMenus();
    previewColors();
    setDirty(false);
  }

  function currentColors() {
    const theme = form.querySelector('[name="theme"]:checked')?.value || "a";
    return {
      theme,
      primary: $("#custom-primary-on").checked ? $("#custom-primary").value : null,
      accent: $("#custom-accent-on").checked ? $("#custom-accent").value : null,
    };
  }
  function previewColors() {
    const c = currentColors();
    applyColors(document.documentElement, c.theme, c.primary, c.accent);
  }
  form.addEventListener("input", (e) => {
    if (e.target.type === "file") return;
    setDirty(true);
    previewColors();
  });
  form.addEventListener("change", (e) => {
    if (e.target.type === "file") return;
    if (e.target.name === "theme") {
      // 테마를 바꾸면 직접 고르기 색도 그 테마 색으로 맞춰 둠
      const t = THEMES[e.target.value];
      if (!$("#custom-primary-on").checked) $("#custom-primary").value = t.primary;
      if (!$("#custom-accent-on").checked) $("#custom-accent").value = t.accent;
    }
    setDirty(true);
    previewColors();
  });

  // 로고·대표 이미지
  function renderMedia() {
    [["logo", "image"], ["hero", "image"]].forEach(([key, icon]) => {
      const m = media[key];
      const src = m.file ? objectUrl(m.file) : m.removed ? null : m.url;
      $(`#${key}-thumb`).innerHTML = src ? `<img src="${esc(src)}" alt="">` : ico(icon);
      $(`#${key}-remove`).hidden = !src;
    });
  }
  ["logo", "hero"].forEach((key) => {
    $(`#${key}-file`).addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      media[key].file = file;
      media[key].removed = false;
      e.target.value = "";
      renderMedia();
      setDirty(true);
    });
    $(`#${key}-remove`).addEventListener("click", () => {
      media[key].file = null;
      media[key].removed = true;
      renderMedia();
      setDirty(true);
    });
  });

  // 메뉴
  const tileFor = (m) => (m._file ? `<span class="tile is-img"><img src="${esc(objectUrl(m._file))}" alt=""></span>` : menuTile(m));
  function renderMenus() {
    $("#menu-editor").innerHTML = menus.map((m, i) => `
      <div class="menu-item" data-i="${i}">
        <button type="button" class="tile-btn" data-pick aria-label="${esc(m.name)} 아이콘 바꾸기">
          ${tileFor(m)}<span class="edit">${ico("image")}</span>
        </button>
        <input class="input" type="text" data-k="name" value="${esc(m.name)}" aria-label="메뉴 이름" placeholder="메뉴 이름">
        <input class="input" type="text" data-k="desc" value="${esc(m.desc)}" aria-label="설명" placeholder="짧은 설명">
        <div class="opts">
          <label class="switch"><input type="checkbox" data-k="visible" ${m.visible !== false ? "checked" : ""}> 보이기</label>
          <label class="switch"><input type="checkbox" data-k="bottom" ${m.bottom ? "checked" : ""}> 하단 탭</label>
          <span class="move">
            <button type="button" class="btn btn-secondary btn-sm" data-move="-1" aria-label="위로" ${i === 0 ? "disabled" : ""}>${ico("chevron-right", "", "transform:rotate(-90deg)")}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-move="1" aria-label="아래로" ${i === menus.length - 1 ? "disabled" : ""}>${ico("chevron-right", "", "transform:rotate(90deg)")}</button>
          </span>
        </div>
      </div>`).join("");
  }
  $("#menu-editor").addEventListener("input", (e) => {
    const row = e.target.closest("[data-i]");
    const k = e.target.dataset.k;
    if (!row || !k) return;
    const m = menus[+row.dataset.i];
    m[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "bottom" && e.target.checked && menus.filter((x) => x.bottom).length > 5) {
      m.bottom = false;
      e.target.checked = false;
      toast("하단 탭은 5개까지만 넣을 수 있어요.", true);
    }
  });
  $("#menu-editor").addEventListener("click", (e) => {
    const mv = e.target.closest("[data-move]");
    if (mv) {
      const i = +mv.closest("[data-i]").dataset.i;
      const j = i + +mv.dataset.move;
      [menus[i], menus[j]] = [menus[j], menus[i]];
      renderMenus();
      setDirty(true);
      return;
    }
    const pk = e.target.closest("[data-pick]");
    if (pk) openPicker(+pk.closest("[data-i]").dataset.i);
  });

  // 아이콘 고르기 창
  const picker = $("#icon-picker");
  let pickIndex = -1;
  function openPicker(i) {
    pickIndex = i;
    const m = menus[i];
    $("#picker-title").textContent = `'${m.name}' 아이콘`;
    $("#icon-grid").innerHTML = ICON_CHOICES.map(([key, label]) => `
      <button type="button" data-icon="${key}" aria-pressed="${!m.icon_url && !m._file && m.icon_key === key}">${ico(key)}<span>${esc(label)}</span></button>`).join("");
    picker.showModal();
  }
  $("#icon-grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-icon]");
    if (!b) return;
    const m = menus[pickIndex];
    m.icon_key = b.dataset.icon;
    m._file = null;
    m._dropPath = m._dropPath || m.icon_path;  // 저장할 때 예전 그림 지움
    m.icon_url = null;
    m.icon_path = null;
    picker.close();
    renderMenus();
    setDirty(true);
  });
  $("#icon-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const m = menus[pickIndex];
    m._file = file;
    picker.close();
    renderMenus();
    setDirty(true);
  });
  $$("[data-close]", picker).forEach((b) => b.addEventListener("click", () => picker.close()));
  picker.addEventListener("click", (e) => { if (e.target === picker) picker.close(); });

  $("#settings-reset").addEventListener("click", () => {
    if (dirty && !confirm("저장하지 않은 변경 사항을 버릴까요?")) return;
    fillSettings();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const toDelete = [];
    try {
      const c = currentColors();
      const extra = Object.assign({}, saved.extra, {
        eyebrow: form.elements.eyebrow.value.trim(),
        footer: form.elements.footer.value.trim(),
      });
      const update = {
        site_name: form.elements.site_name.value.trim() || DEFAULT_SETTINGS.site_name,
        greeting: form.elements.greeting.value.trim(),
        lead: form.elements.lead.value.trim(),
        theme: c.theme,
        primary_color: c.primary,
        accent_color: c.accent,
        updated_at: new Date().toISOString(),
      };

      // 로고
      if (media.logo.file) {
        const up = await upload(media.logo.file, "logo");
        Object.assign(update, { logo_url: up.url, logo_path: up.path });
        toDelete.push(media.logo.path);
      } else if (media.logo.removed) {
        Object.assign(update, { logo_url: null, logo_path: null });
        toDelete.push(media.logo.path);
      }
      // 대표 이미지
      if (media.hero.file) {
        const up = await upload(media.hero.file, "hero");
        Object.assign(extra, { hero_url: up.url, hero_path: up.path });
        toDelete.push(media.hero.path);
      } else if (media.hero.removed) {
        Object.assign(extra, { hero_url: null, hero_path: null });
        toDelete.push(media.hero.path);
      }
      // 메뉴 그림
      const outMenus = [];
      for (const m of menus) {
        const { _file, _dropPath, ...clean } = m;
        delete clean.icon; // 예전 이모지 값 정리
        if (_file) {
          const up = await upload(_file, "icons");
          toDelete.push(clean.icon_path);
          clean.icon_url = up.url;
          clean.icon_path = up.path;
        }
        if (_dropPath) toDelete.push(_dropPath);
        outMenus.push(clean);
      }
      update.menus = outMenus;
      update.extra = extra;

      const { error } = await db.from("site_settings").update(update).eq("id", 1);
      if (error) throw error;
      await removeFiles(toDelete).catch(() => {});
      try { localStorage.removeItem("site-settings-v2"); } catch (_) {}
      toast("저장했어요. 사이트에 반영됐어요.");
      await loadSettings();
    } catch (err) {
      fail(err);
    } finally {
      btn.disabled = false;
    }
  });

  // ───────── 목록형 콘텐츠 (공지·FAQ·자료실) ─────────
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("ko-KR");
  const COLLECTIONS = {
    notices: {
      label: "공지", title: "공지", desc: "중요 공지는 맨 위에 고정돼요.", icon: "megaphone",
      order: [["pinned", false], ["created_at", false]],
      rowTitle: (r) => (r.pinned ? '<span class="badge badge-accent">고정</span>' : "") + esc(r.title),
      rowSub: (r) => fmtDate(r.created_at),
      fields: [
        { key: "title", label: "제목", type: "text", required: true },
        { key: "body", label: "내용", type: "textarea", required: true },
        { key: "pinned", label: "중요 공지로 맨 위에 고정", type: "switch" },
      ],
    },
    faqs: {
      label: "질문", title: "자주 묻는 질문", desc: "분류별로 묶여서 보여요. 순서 숫자가 작을수록 위에 보여요.", icon: "circle-help",
      order: [["category", true], ["sort_order", true], ["created_at", true]],
      rowTitle: (r) => `<span class="badge badge-neutral">${esc(r.category)}</span>${esc(r.question)}`,
      rowSub: (r) => `순서 ${r.sort_order}`,
      fields: [
        { key: "category", label: "분류", type: "text", required: true, hint: "예: 수당, 출석, 구직활동 인정", list: ["수당", "출석", "구직활동 인정", "기타"] },
        { key: "question", label: "질문", type: "text", required: true },
        { key: "answer", label: "답변", type: "textarea", required: true },
        { key: "sort_order", label: "순서", type: "number", default: 0 },
      ],
    },
  };

  function fieldHtml(f, id) {
    const hint = f.hint ? ` <span class="hint">${esc(f.hint)}</span>` : "";
    const req = f.required ? "required" : "";
    switch (f.type) {
      case "switch":
        return `<div class="field"><label class="switch"><input type="checkbox" name="${f.key}"> ${esc(f.label)}</label></div>`;
      case "textarea":
        return `<label class="field"><span>${esc(f.label)}${hint}</span><textarea name="${f.key}" ${req}></textarea></label>`;
      case "select":
        return `<label class="field"><span>${esc(f.label)}${hint}</span><select name="${f.key}">${f.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
      case "file":
        return `<div class="field"><span>${esc(f.label)}${hint}</span>
          <label class="file-drop">${ico("upload")}<span data-file-label>파일을 골라 주세요</span><input type="file" name="${f.key}"></label></div>`;
      default: {
        const list = f.list ? ` list="${id}-${f.key}-list"` : "";
        const dl = f.list ? `<datalist id="${id}-${f.key}-list">${f.list.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
        return `<label class="field"><span>${esc(f.label)}${hint}</span><input type="${f.type}" name="${f.key}"${list} ${req}>${dl}</label>`;
      }
    }
  }

  function initCollection(table) {
    const c = COLLECTIONS[table];
    const panel = $(`[data-panel="${table}"]`);
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div><h1 class="admin-title">${esc(c.title)}</h1><p class="admin-desc" style="margin:0">${esc(c.desc)}</p></div>
        <button class="btn btn-dark" data-new>＋ 새 ${esc(c.label)}</button>
      </div>
      <form class="panel form-panel" hidden>
        <div class="panel-head"><h2 data-form-title></h2></div>
        <div class="panel-body">
          ${c.fields.map((f) => fieldHtml(f, table)).join("")}
          <div class="row">
            <button class="btn btn-dark" type="submit">저장</button>
            <button class="btn btn-secondary" type="button" data-cancel>취소</button>
          </div>
        </div>
      </form>
      <div data-items><div class="list"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;

    const fm = $("form", panel);
    let editing = null;
    let rows = [];

    const fileInput = fm.querySelector('input[type="file"]');
    if (fileInput) fileInput.addEventListener("change", () => {
      $("[data-file-label]", fm).textContent = fileInput.files[0] ? fileInput.files[0].name : (editing?.file_name || "파일을 골라 주세요");
    });

    function openForm(row) {
      editing = row;
      $("[data-form-title]", fm).textContent = row ? `${c.label} 수정` : `새 ${c.label}`;
      c.fields.forEach((f) => {
        const el = fm.elements[f.key];
        if (f.type === "file") {
          el.value = "";
          el.required = !row;
          $("[data-file-label]", fm).textContent = row?.file_name || "파일을 골라 주세요";
          return;
        }
        const v = row ? row[f.key] : f.default ?? (f.type === "select" ? f.options[0] : "");
        if (f.type === "switch") el.checked = !!v;
        else el.value = v ?? "";
      });
      fm.hidden = false;
      $("[data-new]", panel).hidden = true;
      fm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function closeForm() {
      editing = null;
      fm.hidden = true;
      $("[data-new]", panel).hidden = false;
    }

    async function load() {
      let q = db.from(table).select("*");
      c.order.forEach(([col, asc]) => (q = q.order(col, { ascending: asc })));
      const { data, error } = await q;
      if (error) return fail(error);
      rows = data;
      $("[data-items]", panel).innerHTML = rows.length
        ? `<div class="list admin-list">${rows.map((r, i) => `<div class="list-row">
            <span class="body"><span class="title">${c.rowTitle(r)}</span><span class="sub">${c.rowSub(r)}</span></span>
            <span class="actions">
              <button class="btn btn-secondary btn-sm" data-edit="${i}">수정</button>
              <button class="btn btn-danger btn-sm" data-del="${i}">삭제</button>
            </span></div>`).join("")}</div>`
        : `<div class="list"><div class="empty">${ico(c.icon)}<strong>아직 없어요</strong><p>오른쪽 위 버튼으로 추가하세요.</p></div></div>`;
    }

    $("[data-new]", panel).addEventListener("click", () => openForm(null));
    $("[data-cancel]", panel).addEventListener("click", closeForm);
    $("[data-items]", panel).addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (ed) openForm(rows[+ed.dataset.edit]);
      if (del) {
        const r = rows[+del.dataset.del];
        const name = r.title || r.question;
        if (!confirm(`'${name}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
        const { error } = await db.from(table).delete().eq("id", r.id);
        if (error) return fail(error);
        if (r.file_path) await removeFiles([r.file_path]).catch(() => {});
        toast("삭제했어요.");
        if (editing && editing.id === r.id) closeForm();
        load();
      }
    });

    fm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = fm.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const rec = {};
        let newFile = null;
        c.fields.forEach((f) => {
          const el = fm.elements[f.key];
          if (f.type === "file") newFile = el.files[0] || null;
          else if (f.type === "switch") rec[f.key] = el.checked;
          else if (f.type === "number") rec[f.key] = parseInt(el.value, 10) || 0;
          else rec[f.key] = el.value.trim();
        });
        if (newFile) {
          const up = await upload(newFile, table);
          Object.assign(rec, { file_url: up.url, file_path: up.path, file_name: newFile.name });
        }
        const res = editing
          ? await db.from(table).update(rec).eq("id", editing.id)
          : await db.from(table).insert(rec);
        if (res.error) throw res.error;
        if (newFile && editing && editing.file_path) await removeFiles([editing.file_path]).catch(() => {});
        toast("저장했어요.");
        closeForm();
        load();
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    });

    load();
  }


  // ───────── 자료실 (큰 분류 + 파일 여러 개) ─────────
  const SUB_SUGGEST = ["이력서", "자소서", "면접", "제도", "수당", "출석·일정", "프로그램", "기타"];
  const sizeText = (n) => (!n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);
  const filesOf = (r) => (Array.isArray(r.files) && r.files.length ? r.files : r.file_url ? [{ url: r.file_url, path: r.file_path, name: r.file_name }] : []);

  function initResources() {
    const panel = $('[data-panel="resources"]');
    const sections = () => {
      const list = (saved && saved.extra.resource_sections) || DEFAULT_SETTINGS.extra.resource_sections;
      return list.length ? list : ["취업 준비"];
    };
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div><h1 class="admin-title">자료실</h1><p class="admin-desc" style="margin:0">자료 하나에 파일을 여러 개 붙일 수 있어요 (예: 한글·워드·PDF 버전).</p></div>
        <button class="btn btn-dark" data-new>${ico("plus")}새 자료</button>
      </div>
      <form class="panel form-panel" data-res-form hidden>
        <div class="panel-head"><h2 data-form-title>새 자료</h2></div>
        <div class="panel-body">
          <div class="row" style="align-items:flex-start;gap:12px">
            <label class="field" style="flex:1;min-width:160px"><span>큰 분류</span><select name="section"></select></label>
            <label class="field" style="flex:1;min-width:160px"><span>작은 분류 <span class="hint">자유롭게 (예: 이력서, 수당)</span></span>
              <input type="text" name="category" list="res-sub-list" required><datalist id="res-sub-list"></datalist></label>
          </div>
          <label class="field"><span>자료 이름</span><input type="text" name="title" required></label>
          <label class="field"><span>설명 <span class="hint">선택</span></span><textarea name="description" rows="3" style="min-height:96px"></textarea></label>
          <div class="field"><span>파일 <span class="hint">여러 개를 한 번에 골라도 돼요</span></span>
            <div class="res-files" data-files></div>
            <label class="file-drop">${ico("upload")}<span>파일 추가하기</span><input type="file" name="files" multiple></label>
          </div>
          <label class="field" style="max-width:160px"><span>순서 <span class="hint">작을수록 위</span></span><input type="number" name="sort_order" value="0"></label>
          <div class="row">
            <button class="btn btn-dark" type="submit">저장</button>
            <button class="btn btn-secondary" type="button" data-cancel>취소</button>
          </div>
        </div>
      </form>
      <div data-items><div class="list"><div class="skeleton"></div><div class="skeleton"></div></div></div>
      <form class="panel" data-sections style="margin-top:28px">
        <div class="panel-head"><h2>큰 분류</h2><p>한 줄에 하나씩, 보이는 순서대로 적어 주세요. 참여자 화면 맨 위 탭이 돼요. 이미 자료가 있는 분류 이름을 바꾸면, 그 자료는 수정에서 새 분류를 다시 골라 주세요.</p></div>
        <div class="panel-body">
          <label class="field"><span>큰 분류 목록</span><textarea name="list" rows="4" style="min-height:110px"></textarea></label>
          <button class="btn btn-dark" type="submit">큰 분류 저장</button>
        </div>
      </form>`;

    const fm = $("[data-res-form]", panel);
    const fileBox = $("[data-files]", fm);
    const input = fm.elements.files;
    let rows = [], editing = null, items = [], removed = [];

    function drawFiles() {
      fileBox.innerHTML = items.length
        ? items.map((it, i) => `<div class="res-file">
            ${ico(it.file ? "upload" : "file-text")}
            <span class="nm">${esc(it.name)}<small>${it.file ? "새로 올릴 파일" : "올라가 있는 파일"}${it.size ? " · " + sizeText(it.size) : ""}</small></span>
            <button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" aria-label="${esc(it.name)} 빼기">${ico("x")}</button>
          </div>`).join("")
        : `<p class="res-none">아직 파일이 없어요.</p>`;
    }
    fileBox.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      const [it] = items.splice(+b.dataset.rm, 1);
      if (!it.file && it.path) removed.push(it.path);
      drawFiles();
    });
    input.addEventListener("change", () => {
      [...input.files].forEach((f) => items.push({ file: f, name: f.name, size: f.size }));
      input.value = "";
      drawFiles();
    });

    function openForm(row) {
      editing = row; removed = [];
      items = row ? filesOf(row).map((x) => ({ ...x })) : [];
      $("[data-form-title]", fm).textContent = row ? "자료 수정" : "새 자료";
      const secs = sections().slice();
      if (row && row.section && !secs.includes(row.section)) secs.push(row.section);
      fm.elements.section.innerHTML = secs.map((s) => `<option>${esc(s)}</option>`).join("");
      fm.elements.section.value = row ? row.section : secs[secs.length - 1];
      const subs = [...new Set(SUB_SUGGEST.concat(rows.map((r) => r.category).filter(Boolean)))];
      $("#res-sub-list").innerHTML = subs.map((s) => `<option value="${esc(s)}">`).join("");
      fm.elements.category.value = row ? row.category || "" : "";
      fm.elements.title.value = row ? row.title : "";
      fm.elements.description.value = row ? row.description || "" : "";
      fm.elements.sort_order.value = row ? row.sort_order || 0 : 0;
      drawFiles();
      fm.hidden = false;
      $("[data-new]", panel).hidden = true;
      fm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function closeForm() { editing = null; fm.hidden = true; $("[data-new]", panel).hidden = false; }

    async function load() {
      const { data, error } = await db.from("resources").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) return fail(error);
      rows = data;
      const secs = sections().slice();
      rows.forEach((r) => { if (r.section && !secs.includes(r.section)) secs.push(r.section); });
      const groups = secs.map((s) => [s, rows.filter((r) => (r.section || "취업 준비") === s)]).filter(([, l]) => l.length);
      $("[data-items]", panel).innerHTML = rows.length
        ? groups.map(([s, list]) => `<h2 class="group-title">${esc(s)} <span class="count">${list.length}</span></h2>
            <div class="list admin-list">${list.map((r) => `<div class="list-row">
              <span class="body"><span class="title"><span class="badge badge-neutral">${esc(r.category || "기타")}</span>${esc(r.title)}</span>
              <span class="sub">파일 ${filesOf(r).length}개 · ${new Date(r.created_at).toLocaleDateString("ko-KR")}</span></span>
              <span class="actions"><button class="btn btn-secondary btn-sm" data-edit="${esc(r.id)}">수정</button><button class="btn btn-danger btn-sm" data-del="${esc(r.id)}">삭제</button></span>
            </div>`).join("")}</div>`).join("")
        : `<div class="list"><div class="empty">${ico("folder-open")}<strong>아직 자료가 없어요</strong><p>오른쪽 위 버튼으로 추가하세요.</p></div></div>`;
    }

    $("[data-new]", panel).addEventListener("click", () => openForm(null));
    $("[data-cancel]", panel).addEventListener("click", closeForm);
    $("[data-items]", panel).addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) openForm(rows.find((r) => r.id === ed.dataset.edit));
      if (del) {
        const r = rows.find((x) => x.id === del.dataset.del);
        if (!confirm(`'${r.title}'을(를) 삭제할까요? 붙은 파일도 함께 지워져요. 되돌릴 수 없어요.`)) return;
        const { error } = await db.from("resources").delete().eq("id", r.id);
        if (error) return fail(error);
        await removeFiles(filesOf(r).map((x) => x.path)).catch(() => {});
        toast("삭제했어요.");
        if (editing && editing.id === r.id) closeForm();
        load();
      }
    });

    fm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!items.length) return toast("파일을 하나 이상 붙여 주세요.", true);
      const btn = fm.querySelector('[type="submit"]');
      btn.disabled = true;
      const uploaded = [];
      try {
        const files = [];
        for (const it of items) {
          if (it.file) {
            btn.textContent = `올리는 중… (${files.length + 1}/${items.length})`;
            const up = await upload(it.file, "resources");
            uploaded.push(up.path);
            files.push({ url: up.url, path: up.path, name: it.name, size: it.size });
          } else files.push({ url: it.url, path: it.path, name: it.name, size: it.size });
        }
        const rec = {
          section: fm.elements.section.value,
          category: fm.elements.category.value.trim() || "기타",
          title: fm.elements.title.value.trim(),
          description: fm.elements.description.value.trim() || null,
          sort_order: parseInt(fm.elements.sort_order.value, 10) || 0,
          files,
          // 예전 방식 칸도 첫 파일로 채워 둠
          file_url: files[0].url, file_path: files[0].path, file_name: files[0].name,
        };
        const res = editing ? await db.from("resources").update(rec).eq("id", editing.id) : await db.from("resources").insert(rec);
        if (res.error) throw res.error;
        await removeFiles(removed).catch(() => {});
        toast("저장했어요.");
        closeForm();
        load();
      } catch (err) {
        await removeFiles(uploaded).catch(() => {});
        if (/section|files/.test(String(err && err.message)) && /column/.test(String(err && err.message))) toast("DB 업데이트가 필요해요: supabase/migrations/004_resources_v2.sql 을 실행해 주세요.", true);
        else fail(err);
      } finally {
        btn.disabled = false;
        btn.textContent = "저장";
      }
    });

    const sf = $("[data-sections]", panel);
    sf.elements.list.value = sections().join("\n");
    sf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = sf.querySelector("button");
      btn.disabled = true;
      try {
        const list = [...new Set(sf.elements.list.value.split("\n").map((w) => w.trim()).filter(Boolean))];
        if (!list.length) throw new Error("큰 분류를 하나 이상 적어 주세요.");
        const { data, error: e1 } = await db.from("site_settings").select("extra").eq("id", 1).single();
        if (e1) throw e1;
        const extra = Object.assign({}, data.extra || {}, { resource_sections: list });
        const { error } = await db.from("site_settings").update({ extra }).eq("id", 1);
        if (error) throw error;
        if (saved) saved.extra.resource_sections = list;
        try { localStorage.removeItem("site-settings-v2"); } catch (_) {}
        sf.elements.list.value = list.join("\n");
        toast("큰 분류를 저장했어요.");
        load();
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    });

    load();
  }


  // ───────── 채용정보 (카톡 문구 붙여넣기 → 확인·수정 → 저장) ─────────
  const JOB_CATS = ["대기업", "중견기업", "강소·중소", "외국계", "공공기관", "스타트업"];
  const JOB_EMPS = ["정규직", "계약직", "인턴", "아르바이트", "기타"];

  function initJobs() {
    const panel = $('[data-panel="jobs"]');
    panel.innerHTML = `
      <h1 class="admin-title">채용정보</h1>
      <p class="admin-desc">카톡으로 보내던 문구를 그대로 붙여넣으면 칸이 채워져요. 확인하고 고친 뒤 저장하세요. 마감일이 지난 공고는 사이트에서 저절로 내려가요.</p>
      <div class="panel">
        <div class="panel-head"><h2>카톡 문구로 추가</h2><p>여러 공고를 한꺼번에 붙여도 돼요. 링크 줄 다음 줄에 '기업명/직무/경력/학력/지역/기타/마감' 순서로 적어 주세요 (순서가 조금 달라도 괜찮아요).</p></div>
        <div class="panel-body">
          <textarea class="job-paste" data-paste rows="5" placeholder="https://...&#10;삼성전자/인사노무/신입/서울/대졸/1210"></textarea>
          <div class="row" style="margin-top:12px">
            <button class="btn btn-dark" type="button" data-read>${ico("clipboard-list")}읽기</button>
            <button class="btn btn-secondary" type="button" data-blank>${ico("plus")}직접 입력</button>
          </div>
        </div>
      </div>
      <div data-drafts></div>
      <div class="seg-tabs" role="group" aria-label="보기" style="margin-top:12px">
        <button type="button" data-view="live" aria-pressed="true">진행 중 <b data-n-live></b></button>
        <button type="button" data-view="done" aria-pressed="false">마감·숨김 <b data-n-done></b></button>
      </div>
      <div data-items><div class="list"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;

    const drafts = $("[data-drafts]", panel);
    const list = $("[data-items]", panel);
    let rows = [], view = "live", editingId = null;
    const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const expired = (j) => !j.rolling && j.deadline && new Date(j.deadline + "T00:00:00") < today();
    const opt = (list, v, blank) => (blank ? `<option value="">${blank}</option>` : "") + list.map((x) => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");

    function card(j) {
      return `<div class="job-edit panel">
        <div class="panel-body">
          <div class="job-grid">
            <label class="field span2"><span>링크</span><input type="url" data-k="link" value="${esc(j.link || "")}" placeholder="https://"></label>
            <label class="field"><span>기업명</span><input type="text" data-k="company" value="${esc(j.company || "")}" required></label>
            <label class="field"><span>기업 범주 <span class="hint">모르면 비워 두세요</span></span><select data-k="category">${opt(JOB_CATS, j.category || "", "선택 안 함")}</select></label>
            <label class="field span2"><span>직무</span><input type="text" data-k="role" value="${esc(j.role || "")}" required></label>
            <label class="field"><span>고용형태</span><select data-k="employment">${opt(JOB_EMPS, j.employment || "정규직")}</select></label>
            <label class="field"><span>기간 <span class="hint">개월, 계약직·인턴만</span></span><input type="number" min="1" data-k="months" value="${j.months || ""}"></label>
            <label class="field"><span>경력</span><input type="text" data-k="career" list="job-career" value="${esc(j.career || "")}"></label>
            <label class="field"><span>학력</span><input type="text" data-k="education" list="job-edu" value="${esc(j.education || "")}"></label>
            <label class="field"><span>지역 <span class="hint">예: 서울, 경기 평택</span></span><input type="text" data-k="region" value="${esc(j.region || "")}"></label>
            <label class="field"><span>마감일</span><input type="date" data-k="deadline" value="${esc(j.deadline || "")}"${j.rolling ? " disabled" : ""}></label>
            <label class="field span2"><span>기타 자격요건</span><input type="text" data-k="etc" value="${esc(j.etc || "")}"></label>
            <label class="field"><span>급여 <span class="hint">선택</span></span><input type="text" data-k="salary" value="${esc(j.salary || "")}"></label>
            <div class="field job-switches">
              <label class="switch"><input type="checkbox" data-k="rolling"${j.rolling ? " checked" : ""}> 상시·채용 시 마감</label>
              <label class="switch"><input type="checkbox" data-k="recommend"${j.recommend !== false ? " checked" : ""}> 인재추천 가능</label>
            </div>
          </div>
          <div class="row job-edit-foot">
            <span class="hint" data-src>${esc(j._src || "")}</span>
            <button class="btn btn-ghost btn-sm" type="button" data-drop>${ico("x")}빼기</button>
          </div>
        </div>
      </div>`;
    }
    function readCard(el) {
      const j = {};
      el.querySelectorAll("[data-k]").forEach((f) => {
        const k = f.dataset.k;
        j[k] = f.type === "checkbox" ? f.checked : f.value.trim();
      });
      j.months = j.months ? parseInt(j.months, 10) : null;
      j.category = j.category || null;
      j.deadline = j.rolling ? null : j.deadline || null;
      j.area = regionArea(j.region || "");
      ["link", "career", "education", "region", "etc", "salary"].forEach((k) => (j[k] = j[k] || null));
      return j;
    }
    function showDrafts(jobs, editing) {
      editingId = editing || null;
      drafts.innerHTML = jobs.length ? `
        <div class="drafts-head"><h2>${editing ? "공고 수정" : `확인하고 저장하기 <span class="count">${jobs.length}개</span>`}</h2></div>
        ${jobs.map(card).join("")}
        <div class="row drafts-foot">
          <button class="btn btn-dark" type="button" data-save>${editing ? "수정 저장" : `${jobs.length}개 모두 저장`}</button>
          <button class="btn btn-secondary" type="button" data-cancel-drafts>취소</button>
        </div>` : "";
      if (jobs.length) drafts.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 고용형태를 바꾸면 인재추천도 따라 바뀜 (정규직이면 가능). 직접 다시 바꿀 수 있음
    drafts.addEventListener("change", (e) => {
      if (e.target.dataset.k === "employment") {
        const c = e.target.closest(".job-edit");
        c.querySelector('[data-k="recommend"]').checked = e.target.value === "정규직";
      }
      if (e.target.dataset.k === "rolling") {
        e.target.closest(".job-edit").querySelector('[data-k="deadline"]').disabled = e.target.checked;
      }
    });
    drafts.addEventListener("click", async (e) => {
      if (e.target.closest("[data-drop]")) {
        e.target.closest(".job-edit").remove();
        const left = drafts.querySelectorAll(".job-edit").length;
        if (!left) drafts.innerHTML = "";
        else { const b = $("[data-save]", drafts); if (!editingId) b.textContent = `${left}개 모두 저장`; }
      }
      if (e.target.closest("[data-cancel-drafts]")) { drafts.innerHTML = ""; editingId = null; }
      const sv = e.target.closest("[data-save]");
      if (sv) {
        const cards = [...drafts.querySelectorAll(".job-edit")];
        const recs = cards.map(readCard);
        const bad = recs.findIndex((r) => !r.company || !r.role);
        if (bad >= 0) return toast(`${bad + 1}번째 공고의 기업명·직무를 적어 주세요.`, true);
        sv.disabled = true;
        try {
          const res = editingId
            ? await db.from("jobs").update(recs[0]).eq("id", editingId)
            : await db.from("jobs").insert(recs);
          if (res.error) throw res.error;
          toast(editingId ? "수정했어요." : `${recs.length}개를 저장했어요.`);
          drafts.innerHTML = ""; editingId = null;
          $("[data-paste]", panel).value = "";
          load();
        } catch (err) {
          if (/jobs/.test(String(err && err.message)) && /relation|schema|find|exist/i.test(String(err.message))) toast("DB 준비가 필요해요: supabase/migrations/005_jobs.sql 을 실행해 주세요.", true);
          else fail(err);
        } finally { sv.disabled = false; }
      }
    });

    $("[data-read]", panel).addEventListener("click", () => {
      const text = $("[data-paste]", panel).value;
      const got = parseJobText(text).map((j) => Object.assign(j, { _src: `${j.company}/${j.role}…` }));
      if (!got.length) return toast("읽을 수 있는 공고가 없어요. '기업명/직무/...'처럼 / 로 나눠 주세요.", true);
      showDrafts(got);
    });
    $("[data-blank]", panel).addEventListener("click", () => showDrafts([{ employment: "정규직", recommend: true }]));

    const dl = document.createElement("div");
    dl.innerHTML = `<datalist id="job-career"><option value="신입"><option value="경력무관"><option value="신입·경력"><option value="경력 1년↑"><option value="경력 3년↑"><option value="경력 5년↑"></datalist>
      <datalist id="job-edu"><option value="학력무관"><option value="고졸"><option value="초대졸"><option value="대졸"><option value="석사"><option value="박사"></datalist>`;
    panel.append(dl);

    const dtext = (j) => {
      if (j.rolling || !j.deadline) return "상시";
      const n = Math.round((new Date(j.deadline + "T00:00:00") - today()) / 864e5);
      return n < 0 ? "마감" : n === 0 ? "오늘" : `D-${n}`;
    };
    function render() {
      const live = rows.filter((j) => j.visible && !expired(j));
      const done = rows.filter((j) => !j.visible || expired(j));
      $("[data-n-live]", panel).textContent = live.length || "";
      $("[data-n-done]", panel).textContent = done.length || "";
      const show = view === "live" ? live : done;
      list.innerHTML = show.length
        ? `<div class="list admin-list">${show.map((j) => `<div class="list-row${!j.visible ? " is-hidden" : ""}">
            <span class="job-d">${dtext(j)}</span>
            <span class="body"><span class="title">${!j.visible ? '<span class="badge badge-neutral">숨김</span>' : ""}${esc(j.role)} · ${esc(j.company)}${j.category ? ` <span class="badge badge-neutral">${esc(j.category)}</span>` : ""}</span>
              <span class="sub">${esc([j.employment + (j.months ? ` ${j.months}개월` : ""), j.career, j.education, j.region].filter(Boolean).join(" · "))}${j.recommend ? " · 인재추천 가능" : ""}</span></span>
            <span class="actions">
              <button class="btn btn-secondary btn-sm" data-edit="${esc(j.id)}">수정</button>
              <button class="btn btn-secondary btn-sm" data-hide="${esc(j.id)}">${j.visible ? "숨기기" : "보이기"}</button>
              <button class="btn btn-danger btn-sm" data-del="${esc(j.id)}">삭제</button>
            </span></div>`).join("")}</div>`
        : `<div class="list"><div class="empty">${ico("briefcase")}<strong>${view === "live" ? "진행 중인 공고가 없어요" : "마감되거나 숨긴 공고가 없어요"}</strong>${view === "live" ? "<p>위 칸에 카톡 문구를 붙여넣어 추가하세요.</p>" : ""}</div></div>`;
    }
    async function load() {
      const { data, error } = await db.from("jobs").select("*").order("deadline", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        list.innerHTML = `<div class="list"><div class="empty">${ico("briefcase")}<strong>DB 준비가 필요해요</strong><p>Supabase SQL Editor에서 supabase/migrations/005_jobs.sql 을 실행해 주세요.</p></div></div>`;
        return;
      }
      rows = data;
      render();
    }
    $$("[data-view]", panel).forEach((b) => b.addEventListener("click", () => {
      view = b.dataset.view;
      $$("[data-view]", panel).forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    }));
    list.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]"), hd = e.target.closest("[data-hide]"), del = e.target.closest("[data-del]");
      const id = (ed || hd || del || {}).dataset;
      if (!id) return;
      const j = rows.find((x) => x.id === (id.edit || id.hide || id.del));
      if (ed) showDrafts([j], j.id);
      if (hd) {
        const { error } = await db.from("jobs").update({ visible: !j.visible }).eq("id", j.id);
        if (error) return fail(error);
        j.visible = !j.visible; toast(j.visible ? "다시 보이게 했어요." : "숨겼어요."); render();
      }
      if (del) {
        if (!confirm(`'${j.company} ${j.role}' 공고를 삭제할까요? 되돌릴 수 없어요.`)) return;
        const { error } = await db.from("jobs").delete().eq("id", j.id);
        if (error) return fail(error);
        rows = rows.filter((x) => x !== j); toast("삭제했어요."); render();
      }
    });
    load();
  }

  // ───────── 응원 보드 ─────────
  function initCheers() {
    const panel = $('[data-panel="cheers"]');
    const COLOR = { yellow: "#f9eb9c", pink: "#f6d2d3", mint: "#d2e9d6", sky: "#d3e2ef", lilac: "#e2d9ec" };
    panel.innerHTML = `
      <h1 class="admin-title">응원 보드</h1>
      <p class="admin-desc">참여자들이 붙인 응원 메모예요. 신고가 3번 쌓인 메모는 자동으로 가려져요. 숨긴 메모는 다시 보이게 할 수 있어요.</p>
      <div class="seg-tabs" role="group" aria-label="보기">
        <button type="button" data-filter="all" aria-pressed="true">전체</button>
        <button type="button" data-filter="flag" aria-pressed="false">신고·숨김 <b data-flag-count></b></button>
      </div>
      <div data-items><div class="list"><div class="skeleton"></div><div class="skeleton"></div></div></div>
      <form class="panel" data-banned style="margin-top:24px">
        <div class="panel-head"><h2>금지어</h2><p>한 줄에 하나씩 적어 주세요. 이 말이 들어간 메모는 붙지 않아요. 욕설·전화번호·이메일·링크는 이미 막혀 있어요.</p></div>
        <div class="panel-body">
          <label class="field"><span>추가 금지어</span><textarea name="words" rows="5" placeholder="예: 광고&#10;대출"></textarea></label>
          <button class="btn btn-dark" type="submit">금지어 저장</button>
        </div>
      </form>`;

    let rows = [];
    let filter = "all";
    const list = $("[data-items]", panel);
    const when = (iso) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

    function render() {
      const flagged = rows.filter((r) => r.hidden || r.report_count > 0);
      $("[data-flag-count]", panel).textContent = flagged.length || "";
      const show = filter === "flag" ? flagged : rows;
      list.innerHTML = show.length
        ? `<div class="list admin-list">${show.map((r) => `<div class="list-row${r.hidden ? " is-hidden" : ""}">
            <span class="cheer-dot" style="background:${COLOR[r.color] || COLOR.yellow}"></span>
            <span class="body"><span class="title">${r.hidden ? '<span class="badge badge-neutral">숨김</span>' : ""}${r.report_count ? `<span class="badge badge-danger">신고 ${r.report_count}</span>` : ""}${esc(r.body)}</span>
              <span class="sub">${esc(r.nickname)} · ${when(r.created_at)}</span></span>
            <span class="actions">
              <button class="btn btn-secondary btn-sm" data-toggle="${esc(r.id)}">${r.hidden ? "다시 보이기" : "숨기기"}</button>
              <button class="btn btn-danger btn-sm" data-del="${esc(r.id)}">삭제</button>
            </span></div>`).join("")}</div>`
        : `<div class="list"><div class="empty">${ico("sticky-note")}<strong>${filter === "flag" ? "신고되거나 숨긴 메모가 없어요" : "아직 붙은 응원이 없어요"}</strong></div></div>`;
    }

    async function load() {
      const { data, error } = await db.from("cheers").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) {
        console.error(error);
        list.innerHTML = `<div class="list"><div class="empty">${ico("sticky-note")}<strong>DB 준비가 필요해요</strong><p>Supabase SQL Editor에서 supabase/migrations/003_cheers.sql 을 실행해 주세요.</p></div></div>`;
        return;
      }
      rows = data;
      render();
    }

    $$("[data-filter]", panel).forEach((b) => b.addEventListener("click", () => {
      filter = b.dataset.filter;
      $$("[data-filter]", panel).forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    }));

    list.addEventListener("click", async (e) => {
      const tg = e.target.closest("[data-toggle]");
      const del = e.target.closest("[data-del]");
      if (tg) {
        const r = rows.find((x) => x.id === tg.dataset.toggle);
        const patch = r.hidden ? { hidden: false, report_count: 0 } : { hidden: true };
        const { error } = await db.from("cheers").update(patch).eq("id", r.id);
        if (error) return fail(error);
        Object.assign(r, patch);
        toast(patch.hidden ? "숨겼어요. 사이트에서 안 보여요." : "다시 보이게 했어요.");
        render();
      }
      if (del) {
        const r = rows.find((x) => x.id === del.dataset.del);
        if (!confirm(`'${r.body}' 메모를 삭제할까요? 되돌릴 수 없어요.`)) return;
        const { error } = await db.from("cheers").delete().eq("id", r.id);
        if (error) return fail(error);
        rows = rows.filter((x) => x !== r);
        toast("삭제했어요.");
        render();
      }
    });

    const bf = $("[data-banned]", panel);
    bf.elements.words.value = ((saved && saved.extra.cheer_banned) || []).join("\n");
    bf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = bf.querySelector("button");
      btn.disabled = true;
      try {
        const words = [...new Set(bf.elements.words.value.split(/[\n,]/).map((w) => w.trim()).filter(Boolean))];
        const { data, error: e1 } = await db.from("site_settings").select("extra").eq("id", 1).single();
        if (e1) throw e1;
        const extra = Object.assign({}, data.extra || {}, { cheer_banned: words });
        const { error } = await db.from("site_settings").update({ extra }).eq("id", 1);
        if (error) throw error;
        if (saved) saved.extra.cheer_banned = words;
        try { localStorage.removeItem("site-settings-v2"); } catch (_) {}
        bf.elements.words.value = words.join("\n");
        toast("금지어를 저장했어요.");
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    });

    load();
  }
})();
