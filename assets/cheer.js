// 응원 보드: 포스트잇 메모판
// 메인 화면(최근 몇 장)과 응원 보드 페이지(전체, 더 보기)에서 함께 씁니다.
// 금지어는 관리자 페이지 → 응원 보드에서 추가합니다. DB(003_cheers.sql)에서도 한 번 더 검사합니다.
(function () {
  const grid = document.querySelector("[data-cheer]");
  if (!grid) return;
  const db = window.db;
  const MAX = 60;
  const PAGE = Number(grid.dataset.limit || 8);
  const PAGED = grid.hasAttribute("data-paged");
  const COLORS = [["yellow", "#f9eb9c", "노랑"], ["pink", "#f6d2d3", "분홍"], ["mint", "#d2e9d6", "민트"], ["sky", "#d3e2ef", "하늘"], ["lilac", "#e2d9ec", "보라"]];
  const PINS = ["#b8322a", "#24303f", "#c8961e", "#2c6e50", "#2f5fb3", "#e8e4dc"];

  // 별명 = 재밌는 꾸밈말 + 꽃·식물 이름 (숫자 없음)
  const ADJ = [
    "꽃길만 걷는", "물 잘 마시는", "햇살 샤워 중인", "뿌리 깊은", "새싹 돋는", "콧노래 부르는",
    "기지개 켜는", "용기 백배", "멋 부린", "꿋꿋한", "반짝반짝", "느긋한", "부지런한", "낭만적인",
    "꽃망울 터진", "흥 많은", "쑥쑥 크는", "바람 타는", "웃음 많은", "튼튼한", "야무진", "근성 있는",
    "합격 예감", "자신감 충전한", "칭찬받은", "씩씩한", "포기를 모르는", "산책 나온", "비 맞고 큰",
    "아침형", "든든한", "눈치 빠른", "열정 가득", "단단해진", "오늘도 버틴", "행운 가득",
  ];
  const PLANT = [
    "해바라기", "민들레", "튤립", "수국", "라벤더", "코스모스", "개나리", "진달래", "벚꽃", "매화",
    "동백꽃", "무궁화", "데이지", "장미", "프리지아", "안개꽃", "선인장", "몬스테라", "고사리",
    "네잎클로버", "대나무", "소나무", "은행나무", "단풍나무", "올리브", "바질", "로즈마리", "다육이",
    "연꽃", "백합", "채송화", "봉선화", "금잔화", "카네이션", "강아지풀", "허브", "새싹", "도토리",
  ];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const makeNick = () => `${pick(ADJ)} ${pick(PLANT)}`;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // 메모마다 고정된 기울기·압정 색 (새로고침해도 같은 모양)
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const ago = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "방금";
    if (m < 60) return `${m}분 전`;
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
    if (m < 2880) return "어제";
    if (m < 10080) return `${Math.floor(m / 1440)}일 전`;
    const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  function noteHtml(n, isNew) {
    const h = hash(n.id);
    const r = ((h % 9) - 4) * 0.6; // -2.4° ~ 2.4°
    const color = COLORS.some(([k]) => k === n.color) ? n.color : "yellow";
    return `<li class="note${isNew ? " is-new" : ""}" data-c="${color}" data-id="${esc(n.id)}" style="--r:${r}deg;--pin:${PINS[h % PINS.length]}"><div class="paper">
      <p class="msg">${esc(n.body)}</p>
      <div class="foot"><span class="by">${esc(n.nickname)}</span><time datetime="${esc(n.created_at)}">${ago(n.created_at)}</time></div>
      <button class="report" type="button" aria-label="이 메모 신고하기" title="신고하기">${ico("flag")}</button>
    </div></li>`;
  }

  // ── 불러오기 ──
  let notes = [];
  const moreBtn = document.querySelector("[data-cheer-more]");
  function draw(newId) {
    if (!notes.length) {
      grid.innerHTML = `<li class="note cheer-first" style="--r:-1.2deg;--pin:#b8322a"><div class="paper">
        <p class="msg">아직 붙은 응원이 없어요.\n첫 번째 응원을 붙여 주세요!</p>
        <div class="foot"><span class="by">응원 보드</span></div></div></li>`;
      return;
    }
    const list = PAGED ? notes : notes.slice(0, PAGE);
    grid.innerHTML = list.map((n) => noteHtml(n, n.id === newId)).join("");
  }
  function showMessage(msg) {
    grid.innerHTML = `<li class="note" style="--r:1deg;--pin:#24303f"><div class="paper"><p class="msg">${esc(msg)}</p></div></li>`;
  }

  async function load(more) {
    if (!db) return showMessage("응원 보드를 불러오지 못했어요.");
    const from = more ? notes.length : 0;
    const { data, error } = await db.from("cheers")
      .select("id,body,nickname,color,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(error);
      return showMessage(/cheers|relation|schema/i.test(error.message) ? "응원 보드를 준비하고 있어요. 곧 열려요!" : "응원 보드를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
    }
    notes = more ? notes.concat(data) : data;
    draw();
    if (moreBtn) moreBtn.hidden = !PAGED || data.length < PAGE;
  }
  if (moreBtn) moreBtn.addEventListener("click", () => load(true));

  // ── 개인정보·금지어 확인 (DB에서도 같은 검사를 합니다) ──
  const BASE_WORDS = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "개새", "좆", "지랄", "꺼져", "닥쳐"];
  const MSG = {
    phone: "전화번호는 적을 수 없어요.",
    rrn: "주민등록번호는 적을 수 없어요.",
    email: "이메일 주소는 적을 수 없어요.",
    link: "링크나 연락 수단은 적을 수 없어요.",
    word: "다른 분이 상처받을 수 있는 말이 있어요.",
    busy: "지금 응원이 많이 붙고 있어요. 1분 뒤에 다시 붙여 주세요.",
    dup: "같은 응원이 이미 붙어 있어요.",
    wait: "방금 붙이셨어요. 30초 뒤에 다시 붙여 주세요.",
  };
  function check(text) {
    const flat = text.replace(/\s+/g, "").toLowerCase();
    if (/01[016789][.-]?\d{3,4}[.-]?\d{4}/.test(flat)) return MSG.phone;
    if (/\d{6}-?[1-4]\d{6}/.test(flat)) return MSG.rrn;
    if (/[\w.%+-]+@[\w-]+\.[\w.]+/.test(text)) return MSG.email;
    if (/https?:\/\/|www\.|open\.kakao|오픈채팅|카톡아이디/i.test(flat)) return MSG.link;
    const extra = (window.SITE && window.SITE.extra && window.SITE.extra.cheer_banned) || [];
    for (const w of BASE_WORDS.concat(extra)) {
      const k = String(w).replace(/\s+/g, "").toLowerCase();
      if (k && flat.includes(k)) return MSG.word;
    }
    return null;
  }

  // ── 붙이기 창 ──
  const dlg = document.createElement("dialog");
  dlg.className = "picker cheer-dialog";
  dlg.innerHTML = `<form method="dialog">
    <div class="picker-head"><h2>응원 한 장 붙이기</h2><button class="btn btn-ghost btn-sm" value="cancel" aria-label="닫기">${ico("x")}</button></div>
    <div class="picker-body">
      <div class="nick-row"><span>붙는 이름 <strong data-nick></strong></span><button type="button" class="btn btn-secondary btn-sm" data-reroll>${ico("shuffle")}다른 별명</button></div>
      <textarea class="note-input" data-c="yellow" maxlength="${MAX}" rows="4" placeholder="서로에게 힘이 되는 한마디를 남겨 주세요" aria-label="응원 메모"></textarea>
      <div class="note-meta"><div class="swatches" role="group" aria-label="메모 색">${COLORS.map(([k, v, label], i) => `<button type="button" data-color="${k}" style="--sw:${v}" aria-pressed="${i === 0}" aria-label="${label}"></button>`).join("")}</div><span class="count"><b>0</b>/${MAX}</span></div>
      <p class="cheer-error" role="alert" hidden></p>
      <p class="cheer-hint">이름·전화번호 같은 개인정보는 적지 말아 주세요. 붙인 메모는 별명으로만 보이고, 부적절한 메모는 지워질 수 있어요.</p>
    </div>
    <div class="picker-foot"><button class="btn btn-secondary" value="cancel">취소</button><button class="btn" type="button" data-submit>붙이기</button></div>
  </form>`;
  document.body.append(dlg);
  const $ = (s) => dlg.querySelector(s);
  const ta = $("textarea"), err = $(".cheer-error"), submit = $("[data-submit]");
  let nick = "", color = "yellow";
  const setNick = (n) => { nick = n; $("[data-nick]").textContent = n; };
  const savedNick = store.get("cheer-nick");
  setNick(savedNick && !/\d/.test(savedNick) ? savedNick : makeNick());

  $("[data-reroll]").onclick = () => setNick(makeNick());
  dlg.querySelectorAll("[data-color]").forEach((b) => b.onclick = () => {
    color = b.dataset.color; ta.dataset.c = color;
    dlg.querySelectorAll("[data-color]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  });
  const showErr = (m) => { err.textContent = m; err.hidden = false; };
  ta.oninput = () => { $(".count b").textContent = ta.value.length; err.hidden = true; };

  document.querySelectorAll("[data-cheer-write]").forEach((b) => b.onclick = () => {
    ta.value = ""; ta.oninput(); dlg.showModal(); ta.focus();
  });

  submit.onclick = async () => {
    const body = ta.value.trim();
    const bad = !body ? "한 글자 이상 적어 주세요." : check(body);
    if (bad) return showErr(bad);
    if (Date.now() - Number(store.get("cheer-last") || 0) < 30000) return showErr(MSG.wait);
    if (!db) return showErr("지금은 붙일 수 없어요. 잠시 후 다시 해 주세요.");
    submit.disabled = true;
    const { data, error } = await db.from("cheers")
      .insert({ body, nickname: nick, color })
      .select("id,body,nickname,color,created_at").single();
    submit.disabled = false;
    if (error) {
      console.error(error);
      const code = (String(error.message).match(/CHEER_BLOCKED:(\w+)/) || [])[1];
      return showErr(MSG[code] || "붙이지 못했어요. 잠시 후 다시 해 주세요.");
    }
    store.set("cheer-nick", nick);
    store.set("cheer-last", String(Date.now()));
    notes = [data, ...notes];
    dlg.close(); draw(data.id); toast("응원을 붙였어요");
    grid.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ── 신고 ──
  grid.addEventListener("click", async (e) => {
    const b = e.target.closest(".report"); if (!b) return;
    const id = b.closest(".note").dataset.id;
    const done = (store.get("cheer-reported") || "").split(",");
    if (done.includes(id)) return toast("이미 신고한 메모예요");
    if (!confirm("이 메모를 신고할까요?\n신고가 3번 쌓이면 자동으로 가려지고, 상담사가 확인해요.")) return;
    const { error } = await db.rpc("report_cheer", { cheer_id: id });
    if (error) { console.error(error); return toast("신고하지 못했어요. 잠시 후 다시 해 주세요."); }
    store.set("cheer-reported", done.concat(id).slice(-200).join(","));
    toast("신고가 접수됐어요");
  });

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
  }
  load();
})();
