-- 길드 순위 보상(v0.378.0 · 2026-10-28 응태 승인). 두 가지다.
--   · 길드 주간 순위 — 그 주 길드원 기여도의 합. 매주 월요일 00:00 UTC 마감, 기여도 1 이상인 길드원에게 젬 우편(`server_guild_weekly_rewards`).
--     표는 게임 서버가 넘긴다(src/data/competitiveRewards.ts GUILD_WEEKLY_RANK_REWARDS).
--   · 수호전 일일 길드 순위 — 그날 길드원 최고 점수의 합. 매일 00:00 UTC 마감, 그날 한 판이라도 한 길드원의 행에 길드 코인을 넣는다
--     (`server_guild_settle_guard`). 표는 아래에 옮겨 적었다(GUILD_GUARD_DAILY_RANK_COINS — tests/unit/guildSql.test.ts가 대조한다).
-- 길드원 행의 주간 기여도·수호전 기록은 기간이 바뀌면 게으르게 비워지므로, 마감 뒤에는 지난 값을 읽을 수 없다. 그래서 호출이 끝날 때마다
-- 그 길드원의 값을 장부(guild_week_ledger·guild_guard_ledger)에 적어 두고 정산은 장부만 읽는다. 장부의 guild_id는 외래키가 아니다 —
-- 해산한 길드의 기록도 그 기간의 순위에 남는다. 규칙의 원본은 FakeGuildServer(장부·정산)와 src/core/guildRankRewards.ts(줄 세우기)다.
-- 앞의 길드장 위임 마이그레이션(20261111000000_guild_leader_succession.sql) 다음에 적용한다 — 그 문을 server_guild_call_lead로 이름 바꾸고 앞에 선다.

create table public.guild_week_ledger (
  week text not null, guild_id uuid not null, player_id uuid not null references public.players(id) on delete cascade,
  contribution integer not null check (contribution > 0),
  primary key (week, guild_id, player_id)
);
create index guild_week_ledger_player on public.guild_week_ledger(player_id, week);
create table public.guild_guard_ledger (
  day integer not null, guild_id uuid not null, player_id uuid not null references public.players(id) on delete cascade,
  score integer not null check (score >= 0),
  primary key (day, guild_id, player_id)
);
create index guild_guard_ledger_player on public.guild_guard_ledger(player_id, day);
-- 마감한 기간의 길드 등수(점수가 있는 길드만)와 그 수. 처음 정산하는 사람이 한 번 굳힌다.
create table public.guild_rank_results (
  board text not null check (board in ('week','guard')), period text not null, guild_id uuid not null,
  rank integer not null, score integer not null,
  primary key (board, period, guild_id)
);
create table public.guild_rank_totals (
  board text not null check (board in ('week','guard')), period text not null, total integer not null,
  primary key (board, period)
);
-- 받은 보상 — 한 사람은 한 기간에 한 번만 받는다. 주간은 우편 id를 남긴다.
create table public.guild_rank_awards (
  board text not null check (board in ('week','guard')), period text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  guild_id uuid not null, rank integer, amount integer not null check (amount > 0), mail_id uuid, awarded_at timestamptz not null default now(),
  primary key (board, period, player_id)
);
alter table public.guild_week_ledger enable row level security;
alter table public.guild_guard_ledger enable row level security;
alter table public.guild_rank_results enable row level security;
alter table public.guild_rank_totals enable row level security;
alter table public.guild_rank_awards enable row level security;

-- 가장 최근에 받은 수호전 순위 보상({day, rank, coin}) — 화면이 한 번 알린다.
alter table public.guild_members add column guard_reward jsonb;

-- 표에서 그 자리의 몫(rankRewardGems와 같은 규칙). 등수가 없으면(점수 0) 참여 몫이다.
create function public.server_guild_rank_amount(p_rules jsonb, p_rank integer, p_total integer) returns integer
language plpgsql immutable set search_path='' as $$
declare v integer;
begin
  if p_rank is not null then
    select (e->>'gems')::integer into v from jsonb_array_elements(p_rules->'ranks') e
      where (e->>'upTo')::bigint >= p_rank order by (e->>'upTo')::bigint limit 1;
    if v is null then
      select (e->>'gems')::integer into v from jsonb_array_elements(p_rules->'percents') e
        where (e->>'upToPercent')::numeric >= p_rank * 100.0 / greatest(1, p_total) order by (e->>'upToPercent')::numeric limit 1;
    end if;
  end if;
  v := coalesce(v, (p_rules->>'participation')::integer);
  if v is null or v <= 0 then raise exception 'invalid_rank_rewards'; end if;
  return v;
end $$;

-- 수호전 일일 길드 순위 표(길드 코인). 칸 이름은 젬 표와 같은 gems다.
create function public.server_guild_guard_rank_coins() returns jsonb language sql immutable set search_path='' as $$
  select '{"ranks":[{"upTo":1,"gems":30},{"upTo":3,"gems":25},{"upTo":10,"gems":20},{"upTo":50,"gems":15},{"upTo":100,"gems":12},{"upTo":1000,"gems":10}],"percents":[{"upToPercent":10,"gems":8},{"upToPercent":30,"gems":6},{"upToPercent":50,"gems":5}],"participation":4}'::jsonb;
$$;

-- 마감한 기간의 길드 등수를 한 번 굳히고 그 수를 돌려준다. 점수가 같으면 길드 id 순이다(rankGuildScores).
create function public.server_guild_rank_freeze(p_board text, p_period text) returns integer
language plpgsql security definer set search_path='' as $$
declare v_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild-rank:' || p_board || ':' || p_period, 31));
  select total into v_total from public.guild_rank_totals where board = p_board and period = p_period;
  if found then return v_total; end if;
  if p_board = 'week' then
    insert into public.guild_rank_results(board, period, guild_id, rank, score)
      select 'week', p_period, s.guild_id, row_number() over (order by s.score desc, s.guild_id::text), s.score
      from (select guild_id, sum(contribution)::integer as score from public.guild_week_ledger where week = p_period group by guild_id) s
      where s.score > 0;
  else
    insert into public.guild_rank_results(board, period, guild_id, rank, score)
      select 'guard', p_period, s.guild_id, row_number() over (order by s.score desc, s.guild_id::text), s.score
      from (select guild_id, sum(score)::integer as score from public.guild_guard_ledger where day = p_period::integer group by guild_id) s
      where s.score > 0;
  end if;
  get diagnostics v_total = row_count;
  insert into public.guild_rank_totals(board, period, total) values (p_board, p_period, v_total);
  return v_total;
end $$;

-- 호출이 끝날 때마다 그 길드원의 지금 값을 장부에 적는다. 한 기간 안에서는 오르기만 하므로 큰 쪽을 남긴다.
create function public.server_guild_note_ledger(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.guild_members;
begin
  select * into m from public.guild_members where player_id = p_player;
  if not found then return; end if;
  if m.contribution_week > 0 and m.contribution_week_key <> '' then
    insert into public.guild_week_ledger(week, guild_id, player_id, contribution) values (m.contribution_week_key, m.guild_id, p_player, m.contribution_week)
      on conflict (week, guild_id, player_id) do update set contribution = greatest(public.guild_week_ledger.contribution, excluded.contribution);
  end if;
  if m.guard_day >= 0 then
    insert into public.guild_guard_ledger(day, guild_id, player_id, score) values (m.guard_day, m.guild_id, p_player, greatest(0, m.guard_best))
      on conflict (day, guild_id, player_id) do update set score = greatest(public.guild_guard_ledger.score, excluded.score);
  end if;
end $$;

-- 마감된 날의 수호전 순위 보상을 길드원 행의 코인으로 넣는다. 어느 길드에도 없으면 넣을 행이 없어 길드에 들 때까지 미룬다.
create function public.server_guild_settle_guard(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record; v_total integer; v_rank integer; v_amount integer; v_today integer := public.server_guild_guard_day(now());
begin
  if not exists (select 1 from public.guild_members where player_id = p_player) then return; end if;
  for r in select distinct on (l.day) l.day, l.guild_id from public.guild_guard_ledger l
    where l.player_id = p_player and l.day < v_today
      and not exists (select 1 from public.guild_rank_awards a where a.board = 'guard' and a.period = l.day::text and a.player_id = p_player)
    order by l.day, l.score desc, l.guild_id::text
  loop
    v_total := public.server_guild_rank_freeze('guard', r.day::text);
    select rank into v_rank from public.guild_rank_results where board = 'guard' and period = r.day::text and guild_id = r.guild_id;
    v_amount := public.server_guild_rank_amount(public.server_guild_guard_rank_coins(), v_rank, v_total);
    insert into public.guild_rank_awards(board, period, player_id, guild_id, rank, amount) values ('guard', r.day::text, p_player, r.guild_id, v_rank, v_amount);
    update public.guild_members set coin = coin + v_amount,
      guard_reward = case when coalesce((guard_reward->>'day')::integer, -1) < r.day
        then jsonb_build_object('day', r.day, 'rank', coalesce(v_rank, v_total + 1), 'coin', v_amount) else guard_reward end
      where player_id = p_player;
  end loop;
end $$;

-- 마감된 주의 길드 주간 순위 보상 — 우편함을 열 때(opsInbox) 게임 서버가 부른다. 여러 길드에서 기여했으면 가장 크게 기여한 길드의 몫이다.
create function public.server_guild_weekly_rewards(p_player uuid, p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r record; v_total integer; v_rank integer; v_amount integer; mid uuid; v_week text := public.server_guild_week(now());
begin
  perform public.server_require_active(p_player);
  perform pg_advisory_xact_lock(hashtextextended(p_player::text, 33));
  for r in select distinct on (l.week) l.week, l.guild_id from public.guild_week_ledger l
    where l.player_id = p_player and l.week < v_week and l.contribution > 0
      and not exists (select 1 from public.guild_rank_awards a where a.board = 'week' and a.period = l.week and a.player_id = p_player)
    order by l.week, l.contribution desc, l.guild_id::text
  loop
    v_total := public.server_guild_rank_freeze('week', r.week);
    select rank into v_rank from public.guild_rank_results where board = 'week' and period = r.week and guild_id = r.guild_id;
    v_amount := public.server_guild_rank_amount(p_rules, v_rank, v_total);
    insert into public.mails(title, body, rewards, target_player) values (
      '길드 주간 순위 보상', r.week || ' · ' || coalesce(v_rank::text || '위', '참여'),
      jsonb_build_array(jsonb_build_object('asset', 'gems', 'amount', v_amount)), p_player) returning id into mid;
    insert into public.guild_rank_awards(board, period, player_id, guild_id, rank, amount, mail_id) values ('week', r.week, p_player, r.guild_id, v_rank, v_amount, mid);
  end loop;
end $$;

-- 길드 주간 순위(이번 주) — 위 50길드와 내 길드. 등수는 해산한 길드까지 센 장부 순서이고 목록에는 남은 길드만 선다.
create function public.server_guild_ranking(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g uuid; v_week text := public.server_guild_week(now()); out jsonb;
begin
  select guild_id into g from public.guild_members where player_id = p_player;
  with s as (
    select guild_id, sum(contribution)::integer as score from public.guild_week_ledger where week = v_week group by guild_id having sum(contribution) > 0
  ), o as (
    select s.*, row_number() over (order by s.score desc, s.guild_id::text) as rank from s
  )
  select jsonb_build_object('week', v_week, 'serverTime', public.server_guild_ms(now()), 'total', (select count(*) from o),
    'guilds', coalesce((select jsonb_agg(public.server_guild_summary(o.guild_id) || jsonb_build_object('rank', o.rank, 'weekScore', o.score, 'isMine', o.guild_id = g) order by o.rank)
      from o join public.guilds x on x.id = o.guild_id where o.rank <= 50), '[]'::jsonb),
    'mine', case when g is null then null else public.server_guild_summary(g) || jsonb_build_object('rank', (select rank from o where o.guild_id = g),
      'weekScore', coalesce((select score from o where o.guild_id = g), 0), 'isMine', true) end)
  into out;
  return out;
end $$;

alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_lead;
revoke all on function public.server_guild_call_lead(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_lead(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare out jsonb; v_reward jsonb;
begin
  if p_method = 'getRanking' then
    perform public.server_require_active(p_player);
    perform public.server_guild_note_ledger(p_player);
    return public.server_guild_ranking(p_player);
  end if;
  perform public.server_guild_settle_guard(p_player);
  out := public.server_guild_call_lead(p_player, p_method, p_actor, p_args, p_request);
  perform public.server_guild_note_ledger(p_player);
  if p_method = 'getGuild' and jsonb_typeof(out->'me') = 'object' then
    select guard_reward into v_reward from public.guild_members where player_id = p_player;
    out := jsonb_set(out, '{me,guardReward}', coalesce(v_reward, 'null'::jsonb));
  end if;
  return out;
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_rank_amount(jsonb,integer,integer), public.server_guild_guard_rank_coins(), public.server_guild_rank_freeze(text,text),
  public.server_guild_note_ledger(uuid), public.server_guild_settle_guard(uuid), public.server_guild_ranking(uuid), public.server_guild_weekly_rewards(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.server_guild_weekly_rewards(uuid,jsonb) to service_role;

-- 이미 쌓인 이번 주 기여도와 오늘 수호전 기록도 장부에 옮겨 둔다 — 적용한 주·날부터 순위가 끊기지 않는다.
insert into public.guild_week_ledger(week, guild_id, player_id, contribution)
  select contribution_week_key, guild_id, player_id, contribution_week from public.guild_members where contribution_week > 0 and contribution_week_key <> ''
  on conflict do nothing;
insert into public.guild_guard_ledger(day, guild_id, player_id, score)
  select guard_day, guild_id, player_id, greatest(0, guard_best) from public.guild_members where guard_day >= 0
  on conflict do nothing;
