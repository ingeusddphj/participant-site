// 잡코리아 공고 링크를 받아 기업명·마감일·경력·학력 등을 읽어 주는 기능 (Supabase Edge Function)
// 관리자 페이지 → 채용정보 → "링크로 채우기" 버튼이 이 기능을 부릅니다.
// 설치: Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
//       이름을 fetch-job 으로 하고 이 파일 내용을 그대로 붙여넣은 뒤 Deploy.
// 로그인한 사람(관리자)만 부를 수 있고, 잡코리아 주소만 읽습니다.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
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
