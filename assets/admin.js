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
    toastTimer = setTimeout(() => (t.className = "toast"), 2600);
  }
  const fail = (e) => { console.error(e); toast("저장하지 못했어요: " + (e.message || e), true); };

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { show("setup"); return; }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const BUCKET = "files";

  // ───────── 로그인 ─────────
  let started = false;
  db.auth.onAuthStateChange((_event, session) => {
    if (!session) { started = false; show("login"); return; }
    if (started) return;
    started = true;
    setTimeout(enter, 0); // 콜백 안에서 바로 DB를 부르면 멈출 수 있어 한 박자 늦춤
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await db.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
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
    })
  );

  // ───────── 파일 올리기 ─────────
  async function upload(file, folder) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
  async function removeFile(path) {
    if (path) await db.storage.from(BUCKET).remove([path]);
  }

  // ───────── 사이트 설정 ─────────
  let settings, menus, logo;

  async function loadSettings() {
    const { data, error } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return fail(error);
    settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
    menus = (Array.isArray(settings.menus) && settings.menus.length ? settings.menus : DEFAULT_SETTINGS.menus).map((m) => ({ ...m }));
    logo = { url: settings.logo_url, path: settings.logo_path, file: null, removed: false };

    const form = $("#settings-form");
    ["site_name", "greeting", "lead"].forEach((k) => (form.elements[k].value = settings[k] || ""));

    $("#theme-options").innerHTML = Object.entries(THEMES).map(([key, t]) => `
      <label><input type="radio" name="theme" value="${key}" ${settings.theme === key ? "checked" : ""}>
        <span class="dots"><i style="background:${t.primary}"></i><i style="background:${t.accent}"></i></span>${esc(t.label)}</label>`).join("");

    $("#custom-primary-on").checked = !!settings.primary_color;
    $("#custom-accent-on").checked = !!settings.accent_color;
    if (settings.primary_color) $("#custom-primary").value = settings.primary_color;
    if (settings.accent_color) $("#custom-accent").value = settings.accent_color;

    renderLogo();
    renderMenus();
    previewColors();
  }

  function currentColors() {
    const theme = ($("#settings-form").elements.theme.value) || "a";
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
  $("#settings-form").addEventListener("input", (e) => {
    if (e.target.name === "theme" || e.target.type === "color" || e.target.id?.startsWith("custom-")) previewColors();
  });
  $("#settings-form").addEventListener("change", (e) => {
    if (e.target.name === "theme" || e.target.id?.startsWith("custom-")) previewColors();
  });

  function renderLogo() {
    const src = logo.file ? URL.createObjectURL(logo.file) : logo.removed ? null : logo.url;
    $("#logo-preview").hidden = !src;
    if (src) $("#logo-preview").src = src;
    $("#logo-none").hidden = !!src;
    $("#logo-remove").hidden = !src;
  }
  $("#logo-file").addEventListener("change", (e) => {
    logo.file = e.target.files[0] || null;
    logo.removed = false;
    renderLogo();
  });
  $("#logo-remove").addEventListener("click", () => {
    logo.file = null;
    logo.removed = true;
    $("#logo-file").value = "";
    renderLogo();
  });

  function renderMenus() {
    $("#menu-editor").innerHTML = menus.map((m, i) => `
      <div class="menu-row" data-i="${i}">
        <input type="text" data-k="icon" value="${esc(m.icon)}" aria-label="아이콘" style="text-align:center;font-size:22px">
        <input type="text" data-k="name" value="${esc(m.name)}" aria-label="메뉴 이름">
        <input type="text" data-k="desc" value="${esc(m.desc)}" aria-label="설명" style="grid-column:1/-1">
        <div class="opts">
          <label><input type="checkbox" data-k="visible" ${m.visible !== false ? "checked" : ""}> 보이기</label>
          <label><input type="checkbox" data-k="bottom" ${m.bottom ? "checked" : ""}> 하단 메뉴</label>
          <span class="meta">${esc(m.href)}</span>
          <span class="move">
            <button type="button" class="btn btn-outline mini" data-move="-1" aria-label="위로" ${i === 0 ? "disabled" : ""}>▲</button>
            <button type="button" class="btn btn-outline mini" data-move="1" aria-label="아래로" ${i === menus.length - 1 ? "disabled" : ""}>▼</button>
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
      toast("하단 메뉴는 5개까지만 넣을 수 있어요.", true);
    }
  });
  $("#menu-editor").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-move]");
    if (!btn) return;
    const i = +btn.closest("[data-i]").dataset.i;
    const j = i + +btn.dataset.move;
    [menus[i], menus[j]] = [menus[j], menus[i]];
    renderMenus();
  });

  $("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const c = currentColors();
      const update = {
        site_name: form.elements.site_name.value.trim() || DEFAULT_SETTINGS.site_name,
        greeting: form.elements.greeting.value.trim(),
        lead: form.elements.lead.value.trim(),
        theme: c.theme,
        primary_color: c.primary,
        accent_color: c.accent,
        menus,
        updated_at: new Date().toISOString(),
      };
      const oldPath = logo.path;
      if (logo.file) {
        const up = await upload(logo.file, "logo");
        Object.assign(update, { logo_url: up.url, logo_path: up.path });
      } else if (logo.removed) {
        Object.assign(update, { logo_url: null, logo_path: null });
      }
      const { error } = await db.from("site_settings").update(update).eq("id", 1);
      if (error) throw error;
      if ((logo.file || logo.removed) && oldPath) await removeFile(oldPath);
      try { localStorage.removeItem("site-settings-v1"); } catch (_) {}
      toast("저장했어요. 사이트에 반영됐어요.");
      $("#logo-file").value = "";
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
      label: "공지",
      order: [["pinned", false], ["created_at", false]],
      title: (r) => r.title,
      sub: (r) => (r.pinned ? "📌 상단 고정 · " : "") + fmtDate(r.created_at),
      fields: [
        { key: "title", label: "제목", type: "text", required: true },
        { key: "body", label: "내용", type: "textarea", required: true },
        { key: "pinned", label: "중요 공지로 맨 위에 고정", type: "checkbox" },
      ],
    },
    faqs: {
      label: "질문",
      order: [["sort_order", true], ["created_at", true]],
      title: (r) => "Q. " + r.question,
      sub: (r) => `${r.category} · 순서 ${r.sort_order}`,
      fields: [
        { key: "category", label: "분류", type: "text", required: true, hint: "예: 수당, 출석, 구직활동 인정", list: ["수당", "출석", "구직활동 인정", "기타"] },
        { key: "question", label: "질문", type: "text", required: true },
        { key: "answer", label: "답변", type: "textarea", required: true },
        { key: "sort_order", label: "순서", type: "number", hint: "작은 숫자가 위에 보여요", default: 0 },
      ],
    },
    resources: {
      label: "자료",
      order: [["sort_order", true], ["created_at", false]],
      title: (r) => r.title,
      sub: (r) => `${r.category} · ${r.file_name || "링크"}`,
      fields: [
        { key: "category", label: "분류", type: "select", options: ["이력서", "자소서", "면접", "기타"], required: true },
        { key: "title", label: "자료 이름", type: "text", required: true },
        { key: "description", label: "설명 (선택)", type: "textarea" },
        { key: "__file", label: "파일", type: "file", hint: "한글·워드·PDF 등. 수정할 때 비워 두면 기존 파일 유지" },
        { key: "sort_order", label: "순서", type: "number", hint: "작은 숫자가 위에 보여요", default: 0 },
      ],
    },
  };

  function fieldHtml(f, id) {
    const hint = f.hint ? ` <span class="hint">${esc(f.hint)}</span>` : "";
    if (f.type === "checkbox") return `<label class="check"><input type="checkbox" name="${f.key}"> ${esc(f.label)}</label>`;
    if (f.type === "textarea") return `<label class="field"><span>${esc(f.label)}${hint}</span><textarea name="${f.key}" ${f.required ? "required" : ""}></textarea></label>`;
    if (f.type === "select") return `<label class="field"><span>${esc(f.label)}${hint}</span><select name="${f.key}">${f.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
    if (f.type === "file") return `<label class="field"><span>${esc(f.label)}${hint}</span><input type="file" name="${f.key}"></label>`;
    const list = f.list ? ` list="${id}-${f.key}-list"` : "";
    const dl = f.list ? `<datalist id="${id}-${f.key}-list">${f.list.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
    return `<label class="field"><span>${esc(f.label)}${hint}</span><input type="${f.type}" name="${f.key}"${list} ${f.required ? "required" : ""}>${dl}</label>`;
  }

  function initCollection(table) {
    const c = COLLECTIONS[table];
    const panel = $(`[data-panel="${table}"]`);
    panel.innerHTML = `
      <button class="btn" data-new style="width:100%;margin-bottom:16px">＋ 새 ${c.label} 추가</button>
      <form class="card form-card" hidden>
        <h2></h2>
        ${c.fields.map((f) => fieldHtml(f, table)).join("")}
        <div class="row">
          <button class="btn" type="submit">저장</button>
          <button class="btn btn-outline" type="button" data-cancel>취소</button>
        </div>
      </form>
      <div data-items><div class="placeholder">불러오는 중…</div></div>`;
    const form = $("form", panel);
    let editing = null;
    let rows = [];

    function openForm(row) {
      editing = row;
      $("h2", form).textContent = row ? `${c.label} 수정` : `새 ${c.label}`;
      c.fields.forEach((f) => {
        const el = form.elements[f.key];
        if (f.type === "file") { el.value = ""; el.required = !row; return; }
        const v = row ? row[f.key] : f.default ?? (f.type === "select" ? f.options[0] : "");
        if (f.type === "checkbox") el.checked = !!v;
        else el.value = v ?? "";
      });
      form.hidden = false;
      $("[data-new]", panel).hidden = true;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function closeForm() {
      editing = null;
      form.hidden = true;
      $("[data-new]", panel).hidden = false;
    }

    async function load() {
      let q = db.from(table).select("*");
      c.order.forEach(([col, asc]) => (q = q.order(col, { ascending: asc })));
      const { data, error } = await q;
      if (error) return fail(error);
      rows = data;
      $("[data-items]", panel).innerHTML = rows.length
        ? rows.map((r, i) => `<div class="card item">
            <div class="grow"><strong>${esc(c.title(r))}</strong><span class="meta">${esc(c.sub(r))}</span></div>
            <button class="btn btn-outline mini" data-edit="${i}">수정</button>
            <button class="btn danger mini" data-del="${i}">삭제</button></div>`).join("")
        : `<div class="placeholder">아직 없어요. 위 버튼으로 추가하세요.</div>`;
    }

    $("[data-new]", panel).addEventListener("click", () => openForm(null));
    $("[data-cancel]", panel).addEventListener("click", closeForm);
    $("[data-items]", panel).addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (ed) openForm(rows[+ed.dataset.edit]);
      if (del) {
        const r = rows[+del.dataset.del];
        if (!confirm(`'${c.title(r)}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
        const { error } = await db.from(table).delete().eq("id", r.id);
        if (error) return fail(error);
        if (r.file_path) await removeFile(r.file_path);
        toast("삭제했어요.");
        if (editing && editing.id === r.id) closeForm();
        load();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const rec = {};
        let newFile = null;
        c.fields.forEach((f) => {
          const el = form.elements[f.key];
          if (f.type === "file") newFile = el.files[0] || null;
          else if (f.type === "checkbox") rec[f.key] = el.checked;
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
        if (newFile && editing && editing.file_path) await removeFile(editing.file_path);
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
