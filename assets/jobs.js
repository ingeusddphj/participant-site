// 채용정보 목록: 요약 숫자 · 거르기 · 한 줄 요약 · 눌러서 펼치기
// window.renderJobs(상자, 공고배열) 로 그립니다. 공고 칸 이름은 jobparse.js 와 같습니다.
(function () {
  const DAY = 864e5;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const dleft = (j) => (j.rolling || !j.deadline ? null : Math.round((new Date(j.deadline + "T00:00:00") - startOfToday()) / DAY));
  const isNew = (j) => j.created_at && Date.now() - new Date(j.created_at).getTime() < 3 * DAY;
  const empText = (j) => `${j.employment || "정규직"}${j.months ? " " + j.months + "개월" : ""}`;
  const empKind = (j) => ({ 정규직: "full", 계약직: "contract", 인턴: "intern" }[j.employment] || "etc");
  const fmt = (iso) => { const d = new Date(iso + "T00:00:00"); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`; };

  function dBadge(j) {
    const n = dleft(j);
    if (n === null) return `<span class="dday is-rolling">상시</span>`;
    if (n === 0) return `<span class="dday is-urgent is-today">오늘<br>마감</span>`;
    return `<span class="dday${n <= 3 ? " is-urgent" : ""}"><small>D-</small>${n}</span>`;
  }

  window.renderJobs = function (box, all, opts = {}) {
    const state = { emp: new Set(), career: new Set(), area: new Set(), cat: "", q: "", rec: false, soon: false, fresh: false };
    const live = () => all.filter((j) => { const n = dleft(j); return n === null || n >= 0; });

    function match(j) {
      if (state.emp.size && !state.emp.has(j.employment || "정규직")) return false;
      if (state.career.size) {
        const c = j.career || "";
        const ok = [...state.career].some((k) => (k === "신입" ? /신입|무관/.test(c) : /경력|무관/.test(c)));
        if (!ok) return false;
      }
      if (state.area.size && !state.area.has(j.area || regionArea(j.region || ""))) return false;
      if (state.cat && j.category !== state.cat) return false;
      if (state.rec && !j.recommend) return false;
      if (state.soon) { const n = dleft(j); if (n === null || n > 7) return false; }
      if (state.fresh && !isNew(j)) return false;
      if (state.q) {
        const hay = [j.company, j.role, j.region, j.etc, j.education, j.career].join(" ").toLowerCase();
        if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    }
    const sort = (a, b) => {
      const x = dleft(a), y = dleft(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    };

    const row = (j, i) => `<details class="fold job" data-i="${i}">
      <summary>
        ${dBadge(j)}
        <span class="body">
          <span class="title"><span class="role">${esc(j.role)}</span><span class="co">${esc(j.company)}</span>${j.category ? `<span class="cat">${esc(j.category)}</span>` : ""}${j.recommend ? '<span class="rec-inline">인재추천 가능</span>' : ""}${isNew(j) ? '<span class="badge badge-primary">NEW</span>' : ""}</span>
          <span class="meta"><span class="emp" data-k="${empKind(j)}">${esc(empText(j))}</span>${[j.career, j.education, j.region].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</span>
        </span>
        ${j.recommend ? `<span class="rec" title="상담사를 통해 추천 지원할 수 있어요">인재추천<b>가능</b></span>` : ""}
        ${ico("chevron-right", "toggle")}
      </summary>
      <div class="fold-body job-body">
        <dl class="job-dl">
          <div><dt>고용형태</dt><dd>${esc(empText(j))}</dd></div>
          <div><dt>경력</dt><dd>${esc(j.career || "-")}</dd></div>
          <div><dt>학력</dt><dd>${esc(j.education || "-")}</dd></div>
          <div><dt>지역</dt><dd>${esc(j.region || "-")}</dd></div>
          ${j.etc ? `<div class="wide"><dt>자격요건</dt><dd>${esc(j.etc)}</dd></div>` : ""}
          ${j.salary ? `<div><dt>급여</dt><dd>${esc(j.salary)}</dd></div>` : ""}
          <div><dt>마감</dt><dd>${j.rolling || !j.deadline ? "채용 시 마감" : esc(fmt(j.deadline))}</dd></div>
        </dl>
        ${j.recommend ? `<p class="rec-note">${ico("heart-handshake")}<span><b>인재추천 가능 공고예요.</b> 지원하고 싶다면 상담사에게 말해 주세요. 추천서를 함께 준비해 드려요.</span></p>` : ""}
        <div class="job-actions">
          ${j.link ? `<a class="btn btn-dark" href="${esc(j.link)}" target="_blank" rel="noopener">원문 공고 보기${ico("arrow-up-right")}</a>` : ""}
          <button class="btn btn-secondary" type="button" data-copy="${i}">${ico("clipboard-list")}카톡용 문구 복사</button>
        </div>
      </div>
    </details>`;

    const chip = (group, val, label = val) => {
      const on = group === "cat" ? state.cat === val : state[group].has(val);
      return `<button type="button" class="fchip" data-g="${group}" data-v="${esc(val)}" aria-pressed="${on}">${esc(label)}</button>`;
    };

    let shown = [];
    function draw() {
      const base = live();
      shown = base.filter(match).sort(sort);
      const cats = [...new Set(base.map((j) => j.category).filter(Boolean))];
      const nFresh = base.filter(isNew).length;
      const nSoon = base.filter((j) => { const n = dleft(j); return n !== null && n <= 7; }).length;
      const nRec = base.filter((j) => j.recommend).length;
      const focus = document.activeElement && document.activeElement.name === "q";
      box.innerHTML = `
        <div class="job-stats">
          <button type="button" data-t="fresh" aria-pressed="${state.fresh}"><b>${nFresh}</b><span>새 공고</span></button>
          <button type="button" data-t="soon" aria-pressed="${state.soon}"><b>${nSoon}</b><span>이번 주 마감</span></button>
          <button type="button" data-t="rec" aria-pressed="${state.rec}"><b>${nRec}</b><span>인재추천 가능</span></button>
        </div>
        <div class="job-filters">
          <label class="job-search">${ico("search")}<input name="q" type="search" placeholder="기업명·직무·지역 검색" value="${esc(state.q)}"></label>
          <div class="fgroup"><span class="flabel">고용형태</span>${chip("emp", "정규직")}${chip("emp", "계약직")}${chip("emp", "인턴")}</div>
          <div class="fgroup"><span class="flabel">경력</span>${chip("career", "신입")}${chip("career", "경력")}</div>
          <div class="fgroup"><span class="flabel">지역</span>${chip("area", "서울")}${chip("area", "경기")}${chip("area", "기타", "그 외")}</div>
          ${cats.length > 1 ? `<div class="fgroup"><span class="flabel">기업</span>${cats.map((c) => chip("cat", c)).join("")}</div>` : ""}
        </div>
        <p class="job-count"><b>${shown.length}</b>개 공고 · 마감 임박순${shown.length !== base.length ? ` <button type="button" class="linkish" data-reset>조건 지우기</button>` : ""}</p>
        ${shown.length ? `<div class="list">${shown.map(row).join("")}</div>`
          : `<div class="list"><div class="empty">${ico("briefcase")}<strong>조건에 맞는 공고가 없어요</strong><p>조건을 줄여 보거나 상담사에게 물어봐 주세요.</p></div></div>`}`;
      if (focus) { const q = box.querySelector('[name="q"]'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    box.addEventListener("click", async (e) => {
      const f = e.target.closest(".fchip"), t = e.target.closest("[data-t]"), c = e.target.closest("[data-copy]");
      if (f) {
        const { g, v } = f.dataset;
        if (g === "cat") state.cat = state.cat === v ? "" : v;
        else state[g].has(v) ? state[g].delete(v) : state[g].add(v);
        draw();
      } else if (t) { state[t.dataset.t] = !state[t.dataset.t]; draw(); }
      else if (e.target.closest("[data-reset]")) {
        Object.assign(state, { emp: new Set(), career: new Set(), area: new Set(), cat: "", q: "", rec: false, soon: false, fresh: false });
        draw();
      } else if (c) {
        const text = jobToKakao(shown[+c.dataset.copy]);
        try { await navigator.clipboard.writeText(text); (opts.toast || alert)("카톡용 문구를 복사했어요"); }
        catch (_) { prompt("아래 문구를 복사해 주세요", text); }
      }
    });
    let timer;
    box.addEventListener("input", (e) => {
      if (e.target.name !== "q") return;
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = e.target.value.trim(); draw(); }, 200);
    });
    draw();
    return { redraw: draw };
  };
})();
