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
      if (!data.length) { box.innerHTML = empty("folder-open", "아직 올라온 자료가 없어요", "새 자료가 올라오면 여기에서 받을 수 있어요."); return; }

      // 파일 유형: 확장자 → 이름·색
      const TYPES = {
        hwp: ["한글", "hwp"], hwpx: ["한글", "hwp"], doc: ["워드", "doc"], docx: ["워드", "doc"],
        pdf: ["PDF", "pdf"], xls: ["엑셀", "xls"], xlsx: ["엑셀", "xls"], csv: ["엑셀", "xls"],
        ppt: ["파워포인트", "ppt"], pptx: ["파워포인트", "ppt"], zip: ["압축 파일", "zip"],
        jpg: ["이미지", "img"], jpeg: ["이미지", "img"], png: ["이미지", "img"], txt: ["텍스트", "etc"],
      };
      const extOf = (r) => ((r.file_name || r.file_url || "").split("?")[0].split(".").pop() || "").toLowerCase();
      const typeOf = (r) => { const e = extOf(r); const t = TYPES[e] || ["파일", "etc"]; return { ext: (e || "file").toUpperCase().slice(0, 4), label: t[0], kind: t[1] }; };

      const order = ["이력서", "자소서", "면접", "기타"];
      const cats = order.filter((c) => data.some((r) => r.category === c));
      let current = "전체";

      const row = (r) => {
        const t = typeOf(r);
        const name = r.file_name || decodeURIComponent((r.file_url || "").split("?")[0].split("/").pop() || "파일");
        const href = r.file_name ? `${r.file_url}?download=${encodeURIComponent(r.file_name)}` : r.file_url;
        return `<details class="fold res" id="r-${esc(r.id)}">
          <summary>
            <span class="file-type" data-kind="${t.kind}">${esc(t.ext)}</span>
            <span class="body">
              <span class="title">${isNew(r.created_at) ? '<span class="badge badge-primary">NEW</span>' : ""}${esc(r.title)}</span>
              <span class="sub">${esc(r.category)}<i class="dot"></i>${fmtDate(r.created_at)}</span>
            </span>${ico("chevron-right", "toggle")}
          </summary>
          <div class="fold-body res-body">
            ${r.description ? `<p class="res-desc">${esc(r.description)}</p>` : ""}
            <div class="file-card">
              <span class="file-type" data-kind="${t.kind}">${esc(t.ext)}</span>
              <span class="file-meta"><strong>${esc(name)}</strong><span>${esc(t.label)} 파일 · ${fmtDate(r.created_at)} 올림</span></span>
              <a class="btn btn-dark" href="${esc(href)}" target="_blank" rel="noopener">${ico("download")}<span>받기</span></a>
            </div>
          </div>
        </details>`;
      };

      function draw() {
        const list = current === "전체" ? data : data.filter((r) => r.category === current);
        box.innerHTML = `
          ${cats.length > 1 ? `<div class="chips" role="tablist" aria-label="자료 분류">${["전체", ...cats].map((c) => {
            const n = c === "전체" ? data.length : data.filter((r) => r.category === c).length;
            return `<button type="button" role="tab" data-cat="${esc(c)}" aria-selected="${c === current}">${esc(c)}<span>${n}</span></button>`;
          }).join("")}</div>` : ""}
          <div class="list">${list.map(row).join("")}</div>`;
        box.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { current = b.dataset.cat; draw(); }));
      }
      draw();
      const target = location.hash && document.querySelector(location.hash);
      if (target) { target.open = true; target.scrollIntoView({ block: "center" }); }
    }
  } catch (e) {
    console.error(e);
    box.innerHTML = empty("circle-help", "불러오지 못했어요", "잠시 후 다시 열어 주세요.");
  }
})();
