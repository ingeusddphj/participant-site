// 응원 보드: 포스트잇 메모판
// <body data-cheer-preview> 이면 가짜 메모로 보여주고 저장하지 않습니다 (시안).
(function () {
  const grid = document.querySelector("[data-cheer]");
  if (!grid) return;
  const PREVIEW = document.body.hasAttribute("data-cheer-preview");
  const MAX = 60;
  const COLORS = [["yellow", "#fff1a8"], ["pink", "#ffd8df"], ["mint", "#cff1df"], ["sky", "#d3e6ff"], ["lilac", "#e5dcff"]];
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

  // 메모마다 고정된 기울기·핀 색 (새로고침해도 같은 모양)
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
    return `<li class="note${isNew ? " is-new" : ""}" data-c="${esc(n.color)}" data-id="${esc(n.id)}" style="--r:${r}deg;--pin:${PINS[h % PINS.length]}"><div class="paper">
      <p class="msg">${esc(n.body)}</p>
      <div class="foot"><span class="by">${esc(n.nickname)}</span><time datetime="${esc(n.created_at)}">${ago(n.created_at)}</time></div>
      <button class="report" type="button" aria-label="이 메모 신고하기" title="신고하기">${ico("flag")}</button>
    </div></li>`;
  }

  let notes = [];
  const limit = Number(grid.dataset.limit || 8);
  function draw(newId) {
    grid.innerHTML = notes.slice(0, limit).map((n) => noteHtml(n, n.id === newId)).join("");
  }

  // ── 가짜 메모 (시안 전용) ──
  const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
  const FAKE = [
    ["면접 보러 가시는 분들\n다 잘 되실 거예요! 긴장 풀고 화이팅", "꽃길만 걷는 해바라기", "yellow", 12],
    ["3개월 만에 서류 합격했어요.\n포기하지 마세요 진짜로", "포기를 모르는 민들레", "pink", 55],
    ["오늘도 이력서 한 줄 고친 나, 칭찬해", "쑥쑥 크는 몬스테라", "mint", 140],
    ["불합격 문자 받아도 그게 끝이 아니더라고요. 다음이 있어요", "비 맞고 큰 수국", "sky", 300],
    ["자소서 첨삭 받고 훨씬 나아졌어요. 상담 꼭 받아보세요", "칭찬받은 라벤더", "lilac", 1500],
    ["같이 준비하는 사람들이 있다는 게 힘이 돼요", "콧노래 부르는 튤립", "yellow", 2900],
    ["첫 출근 했습니다!\n여러분도 곧이에요", "합격 예감 네잎클로버", "mint", 4400],
    ["오늘 하루도 버틴 우리 모두 수고했어요", "오늘도 버틴 선인장", "pink", 8000],
  ].map(([body, nickname, color, m], i) => ({ id: "f" + i, body, nickname, color, created_at: minsAgo(m) }));

  async function load() {
    if (PREVIEW) { notes = FAKE; draw(); return; }
    // (기능 연결 단계에서 Supabase 불러오기를 붙입니다)
  }

  // ── 개인정보·금지어 확인 ──
  const BLOCK = [
    [/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/, "전화번호는 적을 수 없어요."],
    [/\d{6}[\s-]?[1-4]\d{6}/, "주민등록번호는 적을 수 없어요."],
    [/[\w.+-]+@[\w-]+\.[\w.]+/, "이메일 주소는 적을 수 없어요."],
    [/https?:\/\/|www\.|오픈채팅|open\.kakao/i, "링크나 연락 수단은 적을 수 없어요."],
    [/시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|지랄|꺼져/, "다른 분이 상처받을 수 있는 말이 있어요."],
  ];
  // 띄어쓰기로 피해 가는 경우("시 발")도 잡기 위해 공백을 지운 글자도 함께 확인
  const check = (t) => { const flat = t.replace(/\s+/g, ""); for (const [re, msg] of BLOCK) if (re.test(t) || re.test(flat)) return msg; return null; };

  // ── 붙이기 창 ──
  const dlg = document.createElement("dialog");
  dlg.className = "picker cheer-dialog";
  dlg.innerHTML = `<form method="dialog">
    <div class="picker-head"><h2>응원 한 장 붙이기</h2><button class="btn btn-ghost btn-sm" value="cancel" aria-label="닫기">${ico("x")}</button></div>
    <div class="picker-body">
      <div class="nick-row"><span>붙는 이름 <strong data-nick></strong></span><button type="button" class="btn btn-secondary btn-sm" data-reroll>${ico("shuffle")}다른 별명</button></div>
      <textarea class="note-input" data-c="yellow" maxlength="${MAX}" rows="4" placeholder="서로에게 힘이 되는 한마디를 남겨 주세요" aria-label="응원 메모"></textarea>
      <div class="note-meta"><div class="swatches" role="group" aria-label="메모 색">${COLORS.map(([k, v], i) => `<button type="button" data-color="${k}" style="--sw:${v}" aria-pressed="${i === 0}" aria-label="${k}"></button>`).join("")}</div><span class="count"><b>0</b>/${MAX}</span></div>
      <p class="cheer-error" hidden></p>
      <p class="cheer-hint">이름·전화번호 같은 개인정보는 적지 말아 주세요. 붙인 메모는 별명으로만 보이고, 부적절한 메모는 지워질 수 있어요.</p>
    </div>
    <div class="picker-foot"><button class="btn btn-secondary" value="cancel">취소</button><button class="btn" type="button" data-submit>붙이기</button></div>
  </form>`;
  document.body.append(dlg);
  const $ = (s) => dlg.querySelector(s);
  const ta = $("textarea"), err = $(".cheer-error");
  let nick = "", color = "yellow";
  const setNick = (n) => { nick = n; $("[data-nick]").textContent = n; };
  try { const k = localStorage.getItem("cheer-nick"); setNick(k && !/\d/.test(k) ? k : makeNick()); } catch (e) { setNick(makeNick()); }

  $("[data-reroll]").onclick = () => setNick(makeNick());
  dlg.querySelectorAll("[data-color]").forEach((b) => b.onclick = () => {
    color = b.dataset.color; ta.dataset.c = color;
    dlg.querySelectorAll("[data-color]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  });
  ta.oninput = () => { $(".count b").textContent = ta.value.length; err.hidden = true; };

  document.querySelectorAll("[data-cheer-write]").forEach((b) => b.onclick = () => {
    ta.value = ""; ta.oninput(); dlg.showModal(); ta.focus();
  });

  $("[data-submit]").onclick = async () => {
    const body = ta.value.trim();
    const bad = !body ? "한 글자 이상 적어 주세요." : check(body);
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    try { localStorage.setItem("cheer-nick", nick); } catch (e) {}
    const n = { id: "n" + Date.now(), body, nickname: nick, color, created_at: new Date().toISOString() };
    if (PREVIEW) { notes = [n, ...notes]; }
    dlg.close(); draw(n.id); toast("응원을 붙였어요");
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 신고
  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".report"); if (!b) return;
    if (!confirm("이 메모를 신고할까요?\n신고가 여러 번 쌓이면 자동으로 가려져요.")) return;
    toast(PREVIEW ? "신고가 접수됐어요 (시안이라 실제로 접수되진 않아요)" : "신고가 접수됐어요");
  });

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
  }
  window.cheerToast = toast;
  load();
})();
