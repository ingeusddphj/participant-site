// 화면 확인용 가짜 Supabase (tools/preview.sh 가 사용). 실제 사이트에서는 쓰지 않음
(function(){
  const now = new Date().toISOString();
  const DATA = {
    site_settings: [{ id:1, site_name:"인지어스 동대문지사 상담사 전한", greeting:"반갑습니다. 직업상담사 전한입니다.", lead:"필요한 메뉴를 눌러 주세요.", theme:"a", primary_color:null, accent_color:"#1888be", logo_url:"https://bljzmxjrudgejlvkrnbg.supabase.co/storage/v1/object/public/files/logo/1794565396466-2vcf35.png", extra:{ eyebrow:"국민취업지원제도 참여자 안내", footer:"이 사이트는 참여자 안내를 위해 운영됩니다.\n이름·연락처 등 개인정보는 저장하지 않습니다.\nE-Mail : hanjeon@ingeus.com\nTel : 02-6215-7725", hero_url:"https://bljzmxjrudgejlvkrnbg.supabase.co/storage/v1/object/public/files/hero/1794565396666-sl0ip9.png" } }],
    notices: [
      { id:"1", title:"12월 집단상담 프로그램 일정 안내", body:"12월 4일(목) 오후 2시, 3층 교육장에서 진행합니다.\n준비물: 이력서 초안", pinned:true, created_at: now },
      { id:"2", title:"구직활동 인정 기준이 일부 바뀌었어요", body:"자세한 내용은 상담 시간에 안내드릴게요.", pinned:false, created_at: "2026-11-02T00:00:00Z" },
      { id:"3", title:"이력서 클리닉 신청 받습니다", body:"선착순 10명", pinned:false, created_at: "2026-10-28T00:00:00Z" },
    ],
    faqs: [
      { id:"a", category:"수당", question:"구직촉진수당은 언제 들어오나요?", answer:"구직활동 계획을 이행하고 신청하면 보통 14일 이내에 지급돼요.", sort_order:0, created_at: now },
      { id:"b", category:"수당", question:"아르바이트를 해도 수당을 받을 수 있나요?", answer:"소득 기준에 따라 달라요. 상담사에게 먼저 알려 주세요.", sort_order:1, created_at: now },
      { id:"c", category:"출석", question:"상담 날짜를 바꾸고 싶어요", answer:"상담사에게 보내기로 요청해 주세요.", sort_order:0, created_at: now },
    ],
    resources: [
      { id:"r1", section:"취업 준비", category:"이력서", title:"기본 이력서 양식", description:"가장 많이 쓰는 한 장짜리 양식이에요. 편한 프로그램 버전으로 받으세요.", files:[{url:"#",name:"이력서_기본양식.hwp",size:48200},{url:"#",name:"이력서_기본양식.docx",size:39100},{url:"#",name:"이력서_기본양식.pdf",size:212000}], sort_order:0, created_at: now },
      { id:"r2", section:"취업 준비", category:"면접", title:"자주 나오는 면접 질문 50", description:null, files:[{url:"#",name:"면접질문_50선.pdf",size:1830000}], sort_order:0, created_at: "2026-11-03T02:00:00Z" },
      { id:"r3", section:"취업 준비", category:"자소서", title:"자기소개서 작성 가이드", description:"항목별 예시 문장과 피해야 할 표현을 정리했어요.", files:[{url:"#",name:"자소서_가이드.docx",size:88000}], sort_order:0, created_at: "2026-10-21T02:00:00Z" },
      { id:"r4", section:"제도 안내", category:"수당", title:"구직촉진수당 지급 기준 안내", description:"1유형 참여자 수당 지급 요건과 일정 정리", files:[{url:"#",name:"구직촉진수당_안내.pdf",size:540000}], sort_order:0, created_at: "2026-11-10T02:00:00Z" },
      { id:"r5", section:"제도 안내", category:"제도", title:"국민취업지원제도 한눈에 보기", description:null, files:[{url:"#",name:"제도안내_리플릿.pdf",size:2400000}], sort_order:1, created_at: "2026-09-12T02:00:00Z" },
      { id:"r6", section:"운영 안내", category:"출석·일정", title:"12월 상담 일정표", description:null, files:[{url:"#",name:"12월_상담일정.xlsx",size:22000}], sort_order:0, created_at: "2026-11-12T02:00:00Z" },
    ],
    jobs: [
      { id:"j1", link:"https://example.com", company:"삼성전자", category:"대기업", role:"인사노무", employment:"정규직", months:null, career:"신입", education:"대졸", region:"서울", area:"서울", etc:null, deadline:"2026-12-10", rolling:false, recommend:true, visible:true, note:"신입도 직무 교육이 탄탄한 곳이에요. 자소서 같이 준비해요!", created_at: now },
      { id:"j2", link:"https://example.com", company:"한화에어로스페이스", category:"대기업", role:"R&D", employment:"정규직", months:null, career:"신입", education:"석사", region:"경기", area:"경기", etc:"오픽IM2", deadline:"2027-01-10", rolling:false, recommend:true, visible:true, created_at: now },
      { id:"j3", link:"https://example.com", company:"서울교통공사", category:"공공기관", role:"사무행정", employment:"인턴", months:6, career:"신입", education:"고졸", region:"서울 성동구", area:"서울", etc:null, deadline:"2026-11-16", rolling:false, recommend:false, visible:true, created_at: "2026-11-10T00:00:00Z" },
      { id:"j4", link:"https://example.com", company:"○○물류", category:null, role:"물류 운영관리", employment:"계약직", months:12, career:"경력무관", education:"학력무관", region:"경기 평택", area:"경기", etc:"지게차 자격 우대", deadline:null, rolling:true, recommend:false, visible:true, created_at: "2026-11-01T00:00:00Z" },
      { id:"j5", link:"https://example.com", company:"△△상사", category:null, role:"영업지원", employment:"정규직", months:null, career:"신입", education:"대졸", region:"서울 중구", area:"서울", etc:null, deadline:"2026-11-05", rolling:false, recommend:true, visible:true, created_at: "2026-10-20T00:00:00Z" },
    ],
    cheers: [
      ["면접 보러 가시는 분들\n다 잘 되실 거예요! 긴장 풀고 화이팅","꽃길만 걷는 해바라기","yellow",12,0,false],
      ["3개월 만에 서류 합격했어요.\n포기하지 마세요 진짜로","포기를 모르는 민들레","pink",55,0,false],
      ["오늘도 이력서 한 줄 고친 나, 칭찬해","쑥쑥 크는 몬스테라","mint",140,1,false],
      ["불합격 문자 받아도 그게 끝이 아니더라고요. 다음이 있어요","비 맞고 큰 수국","sky",300,0,false],
      ["자소서 첨삭 받고 훨씬 나아졌어요. 상담 꼭 받아보세요","칭찬받은 라벤더","lilac",1500,0,false],
      ["여기 광고 글","멋 부린 장미","yellow",1600,3,true],
      ["같이 준비하는 사람들이 있다는 게 힘이 돼요","콧노래 부르는 튤립","yellow",2900,0,false],
      ["첫 출근 했습니다!\n여러분도 곧이에요","합격 예감 네잎클로버","mint",4400,0,false],
      ["오늘 하루도 버틴 우리 모두 수고했어요","오늘도 버틴 선인장","pink",8000,0,false],
    ].map(([body,nickname,color,m,rc,h],i)=>({id:"c"+i,body,nickname,color,report_count:rc,hidden:h,created_at:new Date(Date.now()-m*60000).toISOString()})),
  };
  function q(table){ const res = { data: DATA[table] || [], error: null };
    const c = { select(){return c}, order(){return c}, limit(){return c}, eq(){return c}, range(){return c}, update(){return c}, delete(){return c},
      insert(o){ const row=Object.assign({id:'n'+Date.now(),created_at:new Date().toISOString()},o); res.data=row; return c }, single(){ return Promise.resolve({data:res.data.length!==undefined?res.data[0]:res.data,error:null}) },
      maybeSingle(){ return Promise.resolve({ data:(DATA[table]||[])[0]||null, error:null }) },
      then(r,j){ return Promise.resolve(res).then(r,j) } }; return c; }
  window.supabase = { createClient(){ return {
    from: q,
    functions: { invoke: () => new Promise((r) => setTimeout(() => r({ data: { company:"㈜한미글로벌건축사사무소", title:"[한미글로벌] 2026년 하반기 신입사원 및 외국인 공개채용", employmentType:"FULL_TIME", validThrough:"2026-11-15T23:50", experience:"신입", education:"대졸 이상", address:"서울 강남구 삼성동 159-9", summary:"경력 : 신입 , 학력 : 대졸↑, 급여 : 회사 내규에 따름, 마감일 : 2026.11.15" }, error: null }), 300)) },
    rpc: () => Promise.resolve({ data: true, error: null }),
    auth: { onAuthStateChange(cb){ setTimeout(()=>cb("SIGNED_IN",{user:{}}),0); }, signOut(){}, signInWithPassword(){} },
    storage: { from(){ return { getPublicUrl(){return {data:{publicUrl:"#"}}} } } },
  }; } };
})();
