// 잡코리아 공고 링크를 받아 기업명·마감일·경력·학력 등을 읽어 주는 기능 (Supabase Edge Function)
// 관리자 페이지 → 채용정보 → "링크로 채우기" 버튼이 이 기능을 부릅니다.
// 설치: Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
//       함수 이름을 정확히 fetch-job 으로 하고 이 파일 내용을 그대로 붙여넣은 뒤 Deploy.
//       설치 후 함수 설정에서 "Enforce JWT Verification(JWT 확인)"은 꺼 주세요.
//       (관리자인지는 아래 isAdmin 에서 직접 확인합니다)
// 관리자로 로그인한 사람만 쓸 수 있고, 잡코리아 주소만 읽습니다.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// 페이지 안의 검색엔진용 정보(JobPosting)와 요약 문구(meta description)를 꺼냄
function extract(html: string) {
  let posting: Record<string, unknown> | null = null;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1].trim());
      const list = Array.isArray(data) ? data : data["@graph"] || [data];
      const found = list.find((x: Record<string, unknown>) => x && x["@type"] === "JobPosting");
      if (found) { posting = found; break; }
    } catch (_) { /* 다음 블록 */ }
  }
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
    const m = html.match(re);
    return m ? decode(m[1]) : "";
  };
  const p = (posting || {}) as Record<string, any>;
  const loc = Array.isArray(p.jobLocation) ? p.jobLocation[0] : p.jobLocation;
  return {
    company: p.hiringOrganization?.name || "",
    title: p.title || "",
    employmentType: p.employmentType || "",
    validThrough: p.validThrough || "",
    experience: p.experienceRequirements || "",
    education: typeof p.educationRequirements === "string" ? p.educationRequirements : p.educationRequirements?.credentialCategory || "",
    address: loc?.address?.streetAddress || loc?.address?.addressLocality || "",
    summary: meta("description") || meta("og:description"),
    ogTitle: meta("og:title"),
  };
}

// 부른 사람이 관리자인지 확인 (DB의 is_admin 함수에 그 사람의 로그인 정보로 물어봄)
async function isAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey, Authorization: auth, "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await isAdmin(req))) return json({ error: "관리자로 로그인한 상태에서만 쓸 수 있어요. 관리자 페이지를 새로고침하고 다시 해 주세요." }, 401);
    const { url } = await req.json();
    const u = new URL(String(url || ""));
    if (!/(^|\.)jobkorea\.co\.kr$/.test(u.hostname)) return json({ error: "지금은 잡코리아 공고 링크만 읽을 수 있어요." }, 400);
    const res = await fetch(u.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return json({ error: `공고 페이지를 열지 못했어요 (${res.status})` }, 502);
    const info = extract(await res.text());
    if (!info.company && !info.title) return json({ error: "공고 정보를 찾지 못했어요. 마감됐거나 주소가 다를 수 있어요." }, 422);
    return json({ ok: true, ...info });
  } catch (e) {
    return json({ error: "읽는 중 문제가 생겼어요: " + String(e) }, 500);
  }
});
