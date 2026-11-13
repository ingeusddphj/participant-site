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
    resources: {
      label: "자료", title: "자료실", desc: "한글·워드·PDF 파일을 올리면 참여자가 내려받을 수 있어요.", icon: "folder-open",
      order: [["category", true], ["sort_order", true], ["created_at", false]],
      rowTitle: (r) => `<span class="badge badge-neutral">${esc(r.category)}</span>${esc(r.title)}`,
      rowSub: (r) => esc(r.file_name || "파일"),
      fields: [
        { key: "category", label: "분류", type: "select", options: ["이력서", "자소서", "면접", "기타"] },
        { key: "title", label: "자료 이름", type: "text", required: true },
        { key: "description", label: "설명", type: "textarea", hint: "선택" },
        { key: "__file", label: "파일", type: "file", hint: "수정할 때 비워 두면 기존 파일 유지" },
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
})();
