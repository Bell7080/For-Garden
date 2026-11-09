-- 행동 계측(game_events · game_call_daily). 출시 뒤 "어느 관문에서 막혀 나가는가", "튜토리얼을 어디까지 끝내는가",
-- "어떤 콘텐츠가 실제로 돌아가는가"를 보기 위한 기록이다. 결제는 이미 purchase_records가, 재화 증감은 currency_log가 갖는다.
--
-- currency_log와 같은 방식이다 — 호출 지점마다 기록을 심지 않고, 저장 행(player_saves.data)이 바뀌는 순간 앞뒤를 비교해
-- 한 번만 일어나는 일(튜토리얼 칸·관문 첫 클리어·연구원 레벨·연구 횟수)을 남긴다. 어떤 호출이었는지는 server_commit_state가
-- 넘기는 트랜잭션 변수(app.ledger_method)에서 읽는다. 게임 코드는 바뀌지 않는다.
-- 기록이 실패해도 저장은 막지 않는다(예외를 삼키고 저장을 그대로 통과시킨다).
-- 운영 DB에는 사람이 이 파일을 적용한다. 보는 함수는 어드민 마이그레이션(ops_analytics)이 갖는다.

-- ───────── 한 번뿐인 사건 ─────────
create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  player_id uuid not null,                        -- 계정이 사라져도 퍼널 집계가 남도록 FK 없음
  kind text not null check (kind in ('tutorial_step','stage_clear','player_level','research')),
  detail text not null check (char_length(detail) <= 64),   -- 칸 ID · 관문 ID · 레벨 · 연구를 부른 호출
  amount integer not null default 1 check (amount > 0),
  method text check (method is null or char_length(method) <= 64),
  created_at timestamptz not null default now()
);
create index if not exists game_events_kind_idx on public.game_events(kind, detail);
create index if not exists game_events_player_idx on public.game_events(player_id, id desc);
create index if not exists game_events_time_idx on public.game_events(created_at);
alter table public.game_events enable row level security;
revoke all on public.game_events from public, anon, authenticated;     -- 읽기는 어드민 함수만

-- ───────── 호출 수(하루 · 호출 이름) ─────────
-- 상태를 바꾼 게임 호출마다 한 칸을 올린다. 하루 × 호출 종류만큼만 쌓여 계정 수와 무관하다.
create table if not exists public.game_call_daily (
  day date not null,
  method text not null check (char_length(method) <= 64),
  calls bigint not null default 0,
  primary key (day, method)
);
alter table public.game_call_daily enable row level security;
revoke all on public.game_call_daily from public, anon, authenticated;

create or replace function private.json_text_array(p jsonb) returns text[]
language sql immutable set search_path = '' as $fn$
  select coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)), '{}'::text[]);
$fn$;

create or replace function private.log_game_events() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  meth text := nullif(current_setting('app.ledger_method', true), '');
  od jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  nd jsonb := new.data;
  num_re constant text := '^[0-9]+$';
  old_lv int; new_lv int; old_pulls bigint; new_pulls bigint;
begin
  -- 저장 형태가 아닌 행(테스트 등)은 건너뛴다.
  if jsonb_typeof(nd) is distinct from 'object' then return new; end if;

  insert into public.game_events(player_id, kind, detail, method)
  select new.player_id, 'tutorial_step', left(s, 64), meth
    from unnest(private.json_text_array(nd->'tutorial'->'completedStepIds')) s
   where s <> all(private.json_text_array(od->'tutorial'->'completedStepIds'));

  -- 고대 지층은 달마다 초기화되어 같은 층이 다시 깨지므로 퍼널에서 뺀다(층 기록은 순위가 갖는다).
  insert into public.game_events(player_id, kind, detail, method)
  select new.player_id, 'stage_clear', left(s, 64), meth
    from unnest(private.json_text_array(nd->'clearedStageIds')) s
   where s not like 'ancient:%' and s <> all(private.json_text_array(od->'clearedStageIds'));

  new_lv := case when (nd->'playerResearch'->>'level') ~ num_re then (nd->'playerResearch'->>'level')::int end;
  old_lv := case when (od->'playerResearch'->>'level') ~ num_re then (od->'playerResearch'->>'level')::int else 0 end;
  if new_lv is not null and new_lv > old_lv then
    insert into public.game_events(player_id, kind, detail, method)
    select new.player_id, 'player_level', lv::text, meth from generate_series(greatest(old_lv + 1, 1), least(new_lv, old_lv + 100)) lv;
  end if;

  new_pulls := case when (nd->'missions'->'lifetime'->>'relic_research_completed') ~ num_re then (nd->'missions'->'lifetime'->>'relic_research_completed')::bigint end;
  old_pulls := case when (od->'missions'->'lifetime'->>'relic_research_completed') ~ num_re then (od->'missions'->'lifetime'->>'relic_research_completed')::bigint else 0 end;
  if new_pulls is not null and new_pulls > old_pulls and tg_op = 'UPDATE' then
    insert into public.game_events(player_id, kind, detail, amount, method)
    values (new.player_id, 'research', left(coalesce(meth, 'unknown'), 64), least(new_pulls - old_pulls, 1000000)::int, meth);
  end if;

  if meth is not null then
    insert into public.game_call_daily(day, method, calls) values ((now() at time zone 'Asia/Seoul')::date, left(meth, 64), 1)
    on conflict (day, method) do update set calls = public.game_call_daily.calls + 1;
  end if;
  return new;
exception when others then
  return new; -- 계측이 저장을 막으면 안 된다.
end $fn$;

drop trigger if exists log_game_events on public.player_saves;
create trigger log_game_events after insert or update of data on public.player_saves
  for each row execute function private.log_game_events();

revoke all on function private.json_text_array(jsonb), private.log_game_events() from public, anon, authenticated;
