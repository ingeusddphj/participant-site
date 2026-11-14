// 카톡으로 보내던 공고 문구를 칸별로 나눠 읽는 함수
// 예)  https://...
//      삼성전자/인사노무/신입/서울/대졸/1210
// 칸의 순서가 아니라 "생김새"로 알아봅니다. 맨 앞 두 칸만 기업명·직무로 봅니다.
(function () {
  const SEOUL = "종로 중구 용산 성동 광진 동대문 중랑 성북 강북 도봉 노원 은평 서대문 마포 양천 강서 구로 금천 영등포 동작 관악 서초 강남 송파 강동".split(" ");
  const GYEONGGI = "수원 성남 분당 판교 의정부 안양 부천 광명 평택 동두천 안산 고양 일산 과천 구리 남양주 오산 시흥 군포 의왕 하남 용인 기흥 수지 파주 이천 안성 김포 화성 동탄 광주 양주 포천 여주 연천 가평 양평".split(" ");
  const PROVINCES = "인천 부산 대구 대전 울산 세종 강원 충북 충남 전북 전남 경북 경남 제주 충청 전라 경상 창원 청주 천안 아산 구미 포항 거제 전국 재택".split(" ");
  const BIG = "삼성 현대 기아 SK 에스케이 LG 엘지 씨제이 지에스 에이치디 롯데 한화 CJ GS 포스코 POSCO 신세계 이마트 두산 HD 한진 대한항공 KT 카카오 네이버 NAVER 쿠팡 효성 LS 코오롱 아모레 농심 대상 하이닉스".split(" ");
  const PUBLIC = /(공사|공단|진흥원|재단|연구원|공기업|기관|청$|시청|구청|도청|센터$|협회|공제회|은행$)/;
  const FOREIGN = /(코리아|Korea|인터내셔널|글로벌|외국계)/i;

  const has = (list, t) => list.some((w) => t.includes(w));

  function regionArea(t) {
    if (/서울/.test(t) || has(SEOUL, t)) return "서울";
    if (/경기/.test(t) || has(GYEONGGI, t)) return "경기";
    return "기타";
  }
  function guessCategory(company) {
    if (PUBLIC.test(company)) return "공공기관";
    if (has(BIG, company)) return "대기업";
    if (FOREIGN.test(company)) return "외국계";
    return "";
  }
  function toDeadline(tok, today) {
    const t = tok.replace(/^~/, "").trim();
    if (/^(상시|수시|채용\s*시|채용시|충원\s*시|마감\s*시)/.test(t)) return { rolling: true };
    let m = t.match(/^(\d{2})(\d{2})$/) || t.match(/^(\d{1,2})[.\-월]\s*(\d{1,2})일?$/);
    if (!m) return null;
    const mo = +m[1], d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    let y = today.getFullYear();
    const cand = new Date(y, mo - 1, d);
    if (cand < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60)) y += 1; // 한참 지난 날짜면 내년
    return { date: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
  }

  function parseLine(line, link, today) {
    const toks = line.split("/").map((s) => s.trim()).filter(Boolean);
    if (toks.length < 2) return null;
    const job = {
      link: link || "", company: toks[0], role: toks[1], category: guessCategory(toks[0]),
      employment: "", months: null, career: "", education: "", region: "", area: "",
      etc: [], deadline: null, rolling: false, salary: "", recommend: null,
    };
    for (const tok of toks.slice(2)) {
      const t = tok.replace(/\s+/g, " ");
      const dl = toDeadline(t, today);
      if (dl && !job.deadline && !job.rolling) { if (dl.rolling) job.rolling = true; else job.deadline = dl.date; continue; }
      const mon = t.match(/(\d+)\s*(개월|달|m\b)/i);
      if (/(정규|계약|인턴|파견|위촉|아르바이트|알바|체험형|전환형)/.test(t) || (/^\d+\s*(개월|달)$/.test(t))) {
        if (/정규/.test(t) && !/전환/.test(t)) job.employment = "정규직";
        else if (/인턴|체험형|전환형/.test(t)) job.employment = "인턴";
        else if (/계약|파견|위촉/.test(t)) job.employment = "계약직";
        else if (/아르바이트|알바/.test(t)) job.employment = "아르바이트";
        if (mon) job.months = +mon[1];
        if (/전환/.test(t)) job.etc.push("정규직 전환형");
        continue;
      }
      if (/(고졸|초대졸|전문대|대졸|학사|석사|박사|학력\s*무관)/.test(t)) {
        job.education = t.replace("학사", "대졸").replace(/학력\s*무관/, "학력무관");
        continue;
      }
      if (/(신입|경력|^무관$|경력\s*무관)/.test(t) && !job.career) {
        job.career = /^무관$/.test(t) ? "경력무관" : t.replace(/\s+/g, " ");
        continue;
      }
      if (/^무관$/.test(t) && job.career && !job.education) { job.education = "학력무관"; continue; }
      if (!job.region && (/(서울|경기)/.test(t) || has(SEOUL, t) || has(GYEONGGI, t) || has(PROVINCES, t) || /^[가-힣]{1,4}(시|군)$/.test(t))) {
        job.region = t; job.area = regionArea(t);
        continue;
      }
      if (/(연봉|월급|급여|시급|만원|협의)/.test(t)) { job.salary = t; continue; }
      job.etc.push(t);
    }
    if (!job.employment) job.employment = "정규직";
    job.recommend = job.employment === "정규직";
    job.etc = job.etc.join(", ");
    return job;
  }

  window.parseJobText = function (text, today = new Date()) {
    const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    let link = "";
    for (const line of lines) {
      const url = line.match(/https?:\/\/\S+/);
      const rest = url ? line.replace(url[0], "").trim() : line;
      if (url && !rest.includes("/")) {
        // 링크만 있는 줄: 바로 다음 공고의 링크 (맨 끝에 남으면 마지막 공고에 붙임)
        link = url[0];
        continue;
      }
      const job = parseLine(rest, url ? url[0] : link, today);
      if (job) { out.push(job); link = ""; }
    }
    if (link && out.length && !out[out.length - 1].link) out[out.length - 1].link = link;
    return out;
  };

  // 다시 카톡 문구로: 기업명/직무/경력/(기간)/학력/지역/기타/마감
  window.jobToKakao = function (j) {
    const emp = j.employment && j.employment !== "정규직" ? `${j.employment}${j.months ? " " + j.months + "개월" : ""}` : "";
    const dl = j.rolling ? "상시" : j.deadline ? j.deadline.slice(5).replace("-", "") : "";
    const parts = [j.company, j.role, j.career, emp, j.education, j.region, j.etc, dl].filter(Boolean);
    return (j.link ? j.link + "\n" : "") + parts.join("/");
  };
  window.regionArea = regionArea;
})();
