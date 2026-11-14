-- ============================================================
-- 응원 보드 (포스트잇 메모)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
-- ============================================================

create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 60),
  nickname text not null check (char_length(nickname) between 1 and 30),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'mint', 'sky', 'lilac')),
  hidden boolean not null default false,   -- 관리자가 숨겼거나 신고가 쌓여 가려진 메모
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cheers_created_idx on public.cheers (created_at desc);
alter table public.cheers enable row level security;

grant select, insert on public.cheers to anon, authenticated;
grant update, delete on public.cheers to authenticated;

-- 누구나: 가려지지 않은 메모 읽기, 새 메모 붙이기 / 관리자: 전부 읽기·숨기기·지우기
drop policy if exists "cheers_read" on public.cheers;
create policy "cheers_read" on public.cheers for select using (hidden = false or public.is_admin());
drop policy if exists "cheers_insert" on public.cheers;
create policy "cheers_insert" on public.cheers for insert to anon, authenticated with check (true);
drop policy if exists "cheers_admin_update" on public.cheers;
create policy "cheers_admin_update" on public.cheers for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cheers_admin_delete" on public.cheers;
create policy "cheers_admin_delete" on public.cheers for delete using (public.is_admin());

-- 붙이기 전 검사: 개인정보·링크·금지어·도배 (화면에서 막아도 우회할 수 있어서 DB에서 한 번 더)
create or replace function public.cheers_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  txt text;
  flat text;
  w text;
  words text[] := array['시발','씨발','ㅅㅂ','병신','ㅂㅅ','개새','좆','지랄','꺼져','닥쳐'];
begin
  new.body := btrim(new.body);
  new.nickname := btrim(new.nickname);
  new.hidden := false;
  new.report_count := 0;
  new.created_at := now();

  txt := new.body || ' ' || new.nickname;
  flat := lower(regexp_replace(txt, '\s', '', 'g'));

  if flat ~ '01[016789][.-]?[0-9]{3,4}[.-]?[0-9]{4}' then raise exception 'CHEER_BLOCKED:phone'; end if;
  if flat ~ '[0-9]{6}-?[1-4][0-9]{6}' then raise exception 'CHEER_BLOCKED:rrn'; end if;
  if txt ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+' then raise exception 'CHEER_BLOCKED:email'; end if;
  if flat ~* '(https?://|www\.|open\.kakao|오픈채팅|카톡아이디)' then raise exception 'CHEER_BLOCKED:link'; end if;

  -- 관리자 페이지에서 추가한 금지어 (site_settings.extra.cheer_banned)
  select words || coalesce(array(select jsonb_array_elements_text(extra -> 'cheer_banned')), '{}')
    into words from public.site_settings where id = 1;
  foreach w in array coalesce(words, '{}') loop
    w := lower(regexp_replace(w, '\s', '', 'g'));
    if w <> '' and position(w in flat) > 0 then raise exception 'CHEER_BLOCKED:word'; end if;
  end loop;

  -- 도배 방지: 1분에 전체 10장까지, 같은 글은 하루에 한 번
  if (select count(*) from public.cheers where created_at > now() - interval '1 minute') >= 10 then
    raise exception 'CHEER_BLOCKED:busy';
  end if;
  if exists (select 1 from public.cheers where body = new.body and created_at > now() - interval '1 day') then
    raise exception 'CHEER_BLOCKED:dup';
  end if;
  return new;
end;
$$;

drop trigger if exists cheers_guard on public.cheers;
create trigger cheers_guard before insert on public.cheers
  for each row execute function public.cheers_guard();

-- 신고: 3번 쌓이면 자동으로 가려짐 (관리자 페이지에서 다시 보이게 할 수 있음)
create or replace function public.report_cheer(cheer_id uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.cheers
     set report_count = report_count + 1,
         hidden = hidden or report_count + 1 >= 3
   where id = cheer_id and hidden = false;
$$;
grant execute on function public.report_cheer(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
