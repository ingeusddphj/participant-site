// 공지·자주 묻는 질문·자료실 목록을 DB에서 불러와 보여 줍니다.
(async function () {
  const page = document.body.dataset.page;
  const box = document.querySelector("[data-list]");
  if (!page || !box) return;

  const empty = (msg) => `<div class="placeholder">${esc(msg)}</div>`;
  if (!window.db) { box.innerHTML = empty("준비 중이에요."); return; }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  try {
    if (page === "notices") {
      const { data, error } = await db.from("notices").select("*")
        .order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      box.innerHTML = data.length
        ? data.map((n) => `<details class="card fold">
            <summary>${n.pinned ? '<span class="tag tag-accent">중요</span> ' : ""}<strong>${esc(n.title)}</strong>
            <span class="meta">${fmtDate(n.created_at)}</span></summary>
            <div class="fold-body">${esc(n.body)}</div></details>`).join("")
        : empty("아직 공지가 없어요.");
    }

    if (page === "faq") {
      const { data, error } = await db.from("faqs").select("*")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      if (!data.length) { box.innerHTML = empty("아직 등록된 질문이 없어요."); return; }
      const groups = {};
      data.forEach((f) => (groups[f.category] = groups[f.category] || []).push(f));
      box.innerHTML = Object.entries(groups).map(([cat, items]) => `
        <h2 class="group-title">${esc(cat)}</h2>
        ${items.map((f) => `<details class="card fold">
          <summary><strong>Q. ${esc(f.question)}</strong></summary>
          <div class="fold-body">${esc(f.answer)}</div></details>`).join("")}`).join("");
    }

    if (page === "resources") {
      const { data, error } = await db.from("resources").select("*")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) { box.innerHTML = empty("아직 올라온 자료가 없어요."); return; }
      const order = ["이력서", "자소서", "면접", "기타"];
      box.innerHTML = order.filter((c) => data.some((r) => r.category === c)).map((cat) => `
        <h2 class="group-title">${esc(cat)}</h2>
        ${data.filter((r) => r.category === cat).map((r) => {
          const href = r.file_name ? `${r.file_url}?download=${encodeURIComponent(r.file_name)}` : r.file_url;
          return `<div class="card">
            <h3>${esc(r.title)}</h3>
            ${r.description ? `<p class="meta">${esc(r.description)}</p>` : ""}
            <a class="btn btn-outline btn-sm" href="${esc(href)}" target="_blank" rel="noopener">내려받기</a>
          </div>`;
        }).join("")}`).join("");
    }
  } catch (e) {
    box.innerHTML = empty("불러오지 못했어요. 잠시 후 다시 열어 주세요.");
    console.error(e);
  }
})();
