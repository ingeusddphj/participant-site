// 메인 화면의 최근 공지, 공지·자주 묻는 질문·자료실 목록을 DB에서 불러와 보여 줍니다.
(async function () {
  const page = document.body.dataset.page;
  const box = document.querySelector("[data-list]");
  if (!box) return;

  const empty = (icon, title, text = "") =>
    `<div class="list"><div class="empty">${ico(icon)}<strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ""}</div></div>`;
  const skeleton = (n) => `<div class="list">${'<div class="skeleton"></div>'.repeat(n)}</div>`;
  box.innerHTML = skeleton(3);

  if (!window.db) { box.innerHTML = empty("clipboard-list", "준비 중이에요"); return; }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const isNew = (iso) => Date.now() - new Date(iso).getTime() < 7 * 864e5;

  try {
    if (page === "home") {
      const { data, error } = await db.from("notices").select("id,title,pinned,created_at")
        .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      box.innerHTML = data.length
        ? `<div class="list">${data.map((n) => `<a class="list-row" href="notices.html#n-${n.id}">
            <span class="body"><span class="title">${n.pinned ? '<span class="badge badge-accent">중요</span>' : ""}${esc(n.title)}</span>
            <span class="sub">${fmtDate(n.created_at)}</span></span>${ico("chevron-right", "chev")}</a>`).join("")}</div>`
        : empty("bell", "새 공지가 없어요");
    }

    if (page === "notices") {
      const { data, error } = await db.from("notices").select("*")
        .order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      box.innerHTML = data.length
        ? `<div class="list">${data.map((n) => `<details class="fold" id="n-${n.id}">
            <summary><span class="body">
              <span class="title">${n.pinned ? '<span class="badge badge-accent">중요</span>' : ""}${isNew(n.created_at) ? '<span class="badge badge-primary">NEW</span>' : ""}${esc(n.title)}</span>
              <span class="sub">${fmtDate(n.created_at)}</span>
            </span>${ico("chevron-right", "toggle")}</summary>
            <div class="fold-body">${esc(n.body)}</div></details>`).join("")}</div>`
        : empty("megaphone", "아직 공지가 없어요", "새 소식이 생기면 여기에 올라와요.");
      const target = location.hash && document.querySelector(location.hash);
      if (target) { target.open = true; target.scrollIntoView({ block: "center" }); }
    }

    if (page === "faq") {
      const { data, error } = await db.from("faqs").select("*")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      if (!data.length) { box.innerHTML = empty("circle-help", "아직 등록된 질문이 없어요", "궁금한 점은 상담사에게 보내기로 물어봐 주세요."); return; }
      const groups = {};
      data.forEach((f) => (groups[f.category] = groups[f.category] || []).push(f));
      box.innerHTML = Object.entries(groups).map(([cat, items]) => `
        <h2 class="group-title">${esc(cat)} <span class="count">${items.length}</span></h2>
        <div class="list">${items.map((f) => `<details class="fold">
          <summary><span class="q-mark">Q</span><span class="body"><span class="title">${esc(f.question)}</span></span>${ico("chevron-right", "toggle")}</summary>
          <div class="fold-body with-q">${esc(f.answer)}</div></details>`).join("")}</div>`).join("");
    }

    if (page === "resources") {
      const { data, error } = await db.from("resources").select("*")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) { box.innerHTML = empty("folder-open", "아직 올라온 자료가 없어요"); return; }
      const order = ["이력서", "자소서", "면접", "기타"];
      box.innerHTML = order.filter((c) => data.some((r) => r.category === c)).map((cat) => {
        const items = data.filter((r) => r.category === cat);
        return `<h2 class="group-title">${esc(cat)} <span class="count">${items.length}</span></h2>
        <div class="list">${items.map((r) => {
          const ext = ((r.file_name || r.file_url).split("?")[0].split(".").pop() || "").toUpperCase().slice(0, 4);
          const href = r.file_name ? `${r.file_url}?download=${encodeURIComponent(r.file_name)}` : r.file_url;
          return `<div class="list-row">
            <span class="file-type">${esc(ext || "FILE")}</span>
            <span class="body"><span class="title">${esc(r.title)}</span>${r.description ? `<span class="sub">${esc(r.description)}</span>` : ""}</span>
            <a class="btn btn-secondary btn-sm" href="${esc(href)}" target="_blank" rel="noopener">${ico("download")}<span>받기</span></a>
          </div>`;
        }).join("")}</div>`;
      }).join("");
    }
  } catch (e) {
    console.error(e);
    box.innerHTML = empty("circle-help", "불러오지 못했어요", "잠시 후 다시 열어 주세요.");
  }
})();
