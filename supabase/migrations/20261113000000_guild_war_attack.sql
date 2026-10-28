-- 길드전 공격·정산 — 전투일(UTC 날 번호가 홀수)에 짝지은 상대 영지의 칸을 3대3으로 친다.
-- 규칙의 원본은 `src/core/guildWarAttack.ts`·`src/core/guildWar.ts`·`src/api/FakeGuildServer.ts`(getWarFront·beginWarAttack·recordWarAttack·settleWars)다.
-- 수는 `server_guild_war_rules` 한 곳에 두고 `tests/unit/guildSql.test.ts`가 TS 표와 대조한다.
--
-- - 매칭은 게으르다: 그 전투일에 길드전을 처음 부르는 순간, 길드원 10명 이상이고 방어덱이 하나라도 선 길드를 점수 순으로 줄 세워
--   이웃과 짝짓는다(지난 회차의 상대는 맞바꿔 피한다). 홀수면 마지막 길드는 부전승이다.
-- - 승패는 게임 서버가 시드에서 다시 굴려 확정한 값만 들어온다(`recordWarAttack`). 이 함수는 입장 기록·국면·첫 격파만 판정한다.
-- - 정산도 게으르다: 끝난 전투일이 남아 있으면 어느 길드 조작이든 먼저 정산한다. 점수 증감과 길드 코인(2026-10-28 응태 승인 —
--   승 30 · 패 15 · 부전승 20, 그날 공격한 길드원만 · 부전승은 전투일 전에 있던 길드원 모두)을 넣는다.
-- 적용 순서: 20261112000000 다음 → 서버 → 클라이언트.

alter table public.guilds
  add column war_score integer check (war_score is null or war_score >= 0),
  add column war_reached_at timestamptz;

-- 매칭을 마친 전투일(짝이 하나도 없던 날도 다시 매칭하지 않도록 남긴다).
create table public.guild_war_days (
  day bigint primary key,
  matched_at timestamptz not null default now()
);
-- 그날의 짝. 해산한 길드도 회차는 남는다(외래 키를 두지 않는다 — 상대가 사라지면 그쪽은 0점이다).
create table public.guild_war_matches (
  day bigint not null,
  guild_a uuid not null,
  guild_b uuid,
  settled boolean not null default false,
  primary key (day, guild_a)
);
create unique index guild_war_matches_b on public.guild_war_matches(day, guild_b) where guild_b is not null;
create index guild_war_matches_open on public.guild_war_matches(day) where not settled;
-- 공격하는 길드가 상대 영지에서 격파한 칸. 칸은 한 번 격파되면 끝이다.
create table public.guild_war_captures (
  day bigint not null,
  attacker uuid not null,
  slot_id text not null check (slot_id ~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$'),
  by_player uuid,
  captured_at timestamptz not null default now(),
  primary key (day, attacker, slot_id)
);
-- 길드원 한 명이 그날 쓴 공격 수. `guild_id`는 공격한 길드다(정산의 코인 대상).
create table public.guild_war_attacks (
  day bigint not null,
  player_id uuid not null,
  guild_id uuid not null,
  used integer not null check (used between 0 and 3),
  primary key (day, player_id)
);
create index guild_war_attacks_guild on public.guild_war_attacks(day, guild_id);
-- 공격 입장 — 결과 확정이 한 번만 지운다(`entry`는 입장의 requestId).
create table public.guild_war_admissions (
  player_id uuid not null,
  request_id text not null,
  day bigint not null,
  slot_id text not null,
  guild_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_id, request_id)
);
-- 길드마다 가장 최근에 끝난 회차 하나.
create table public.guild_war_results (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  day bigint not null,
  opponent_name text,
  outcome text not null check (outcome in ('win','loss','bye','forfeit')),
  my_points integer not null,
  their_points integer not null,
  delta integer not null,
  score_after integer not null
);
-- 회차마다 길드원이 받은 길드 코인(결과 알림의 「받은 코인」이자 중복 지급을 막는 장부).
create table public.guild_war_coins (
  day bigint not null,
  guild_id uuid not null,
  player_id uuid not null,
  coin integer not null check (coin > 0),
  primary key (day, guild_id, player_id)
);

alter table public.guild_war_days enable row level security;
alter table public.guild_war_matches enable row level security;
alter table public.guild_war_captures enable row level security;
alter table public.guild_war_attacks enable row level security;
alter table public.guild_war_admissions enable row level security;
alter table public.guild_war_results enable row level security;
alter table public.guild_war_coins enable row level security;
revoke all on public.guild_war_days, public.guild_war_matches, public.guild_war_captures, public.guild_war_attacks,
  public.guild_war_admissions, public.guild_war_results, public.guild_war_coins from public, anon, authenticated;

-- 길드전의 수 — `GUILD_WAR_MIN_MEMBERS`·`GUILD_WAR_ATTACKS_PER_MEMBER`·`GUILD_WAR_START_SCORE`·`GUILD_WAR_SLOT_SCORE`·
-- `GUILD_WAR_BRANCH_SWEEP_BONUS`·`GUILD_WAR_SCORE`·`GUILD_WAR_COIN`.
create function public.server_guild_war_rules() returns jsonb language sql immutable set search_path='' as $$
  select '{"minMembers":10,"attacksPerMember":3,"startScore":1000,
    "slotScore":{"grunt":30,"elite":100,"boss":300},"sweepBonus":150,
    "score":{"win":25,"loss":-15,"bye":10,"forfeit":-10,"gapStep":50,"gapBonusMax":10},
    "coin":{"win":30,"loss":15,"bye":20,"forfeit":0}}'::jsonb;
$$;

create function public.server_guild_war_day(p_t timestamptz) returns bigint language sql immutable set search_path='' as $$
  select floor(extract(epoch from p_t) / 86400)::bigint;
$$;

-- 상대 영지 — 칸마다 지키는 사람이 있는지, 공격하는 길드가 격파했는지, 지금 칠 수 있는지(`guildWarFront`).
-- 빈 칸은 무너진 것으로 본다. 정예는 그 지부 일반 칸의 절반(올림), 우두머리는 정예 둘이 무너져야 열린다.
create function public.server_guild_war_front_slots(p_attacker uuid, p_defender uuid, p_day bigint)
returns table(slot_id text, slot_branch integer, slot_kind text, slot_ord integer, slot_idx integer, is_defended boolean, is_captured boolean, is_open boolean)
language sql stable set search_path='' as $$
  with g as (select public.server_guild_level(prosperity) as level from public.guilds where id = p_defender),
  s as (
    select b.branch, k.kind, k.ord, i.idx, b.branch || ':' || k.kind || ':' || i.idx as id
    from g, generate_series(1,3) as b(branch),
      (values ('boss',0),('elite',1),('grunt',2)) as k(kind, ord),
      lateral generate_series(0, case k.kind when 'boss' then 0 when 'elite' then 1 else public.server_guild_war_grunts(g.level, b.branch) - 1 end) as i(idx)
  ),
  f as (
    select s.id, s.branch, s.kind, s.ord, s.idx, (d.slot_id is not null) as defended,
      (d.slot_id is not null and exists (select 1 from public.guild_war_captures c where c.day = p_day and c.attacker = p_attacker and c.slot_id = s.id)) as captured
    from s left join public.guild_war_defense d on d.guild_id = p_defender and d.slot_id = s.id
  ),
  b as (
    select f.branch,
      count(*) filter (where f.kind = 'grunt') as grunts,
      count(*) filter (where f.kind = 'grunt' and (f.captured or not f.defended)) as grunts_down,
      count(*) filter (where f.kind = 'elite' and (f.captured or not f.defended)) as elites_down
    from f group by f.branch
  )
  select f.id, f.branch, f.kind, f.ord, f.idx, f.defended, f.captured,
    f.defended and not f.captured and case f.kind
      when 'grunt' then true
      when 'elite' then b.grunts = 0 or b.grunts_down >= ceil(b.grunts / 2.0)
      else b.elites_down >= 2 end
  from f join b on b.branch = f.branch;
$$;

-- 격파한 칸의 점수 + 지부 점령 보너스(그 지부에서 직접 격파한 칸이 있을 때만) — `guildWarPoints`.
create function public.server_guild_war_points(p_attacker uuid, p_defender uuid, p_day bigint) returns integer language sql stable set search_path='' as $$
  with f as (select * from public.server_guild_war_front_slots(p_attacker, p_defender, p_day)),
  r as (select public.server_guild_war_rules() as v)
  select (coalesce((select sum(case when f.is_captured then (r.v -> 'slotScore' ->> f.slot_kind)::integer else 0 end) from f, r), 0)
    + (select (r.v ->> 'sweepBonus')::integer from r) * (select count(*) from (
        select f.slot_branch from f group by f.slot_branch having bool_and(f.is_captured or not f.is_defended) and bool_or(f.is_captured)) x))::integer;
$$;

-- 한쪽의 결과 — `guildWarResult`. 도달 시각은 마지막 격파 시각이고, 격파가 없으면 무한대다.
create function public.server_guild_war_outcome(p_points integer, p_attacks integer, p_reached timestamptz, p_their_points integer, p_their_attacks integer, p_their_reached timestamptz)
returns text language sql immutable set search_path='' as $$
  select case
    when p_attacks <= 0 then 'forfeit'
    when p_their_attacks <= 0 then 'win'
    when p_points <> p_their_points then case when p_points > p_their_points then 'win' else 'loss' end
    when coalesce(p_reached, 'infinity'::timestamptz) < coalesce(p_their_reached, 'infinity'::timestamptz) then 'win'
    else 'loss' end;
$$;

-- 회차 뒤 길드전 점수 증감 — `guildWarScoreDelta`.
create function public.server_guild_war_delta(p_outcome text, p_self integer, p_other integer) returns integer language sql immutable set search_path='' as $$
  with r as (select public.server_guild_war_rules() -> 'score' as v),
  gap as (select least((r.v ->> 'gapBonusMax')::integer, floor(abs(p_other - p_self) / (r.v ->> 'gapStep')::numeric)::integer) as steps, r.v from r)
  select case p_outcome
    when 'bye' then (v ->> 'bye')::integer
    when 'forfeit' then (v ->> 'forfeit')::integer
    when 'win' then (v ->> 'win')::integer + case when p_other > p_self then steps else 0 end
    else (v ->> 'loss')::integer - case when p_other < p_self then steps else 0 end end
  from gap;
$$;

-- 길드전 등수 — 점수가 있는 길드끼리, 같은 점수는 먼저 도달한 길드가 위다(`rankGuildWar`).
create function public.server_guild_war_rank(p_guild uuid) returns integer language sql stable set search_path='' as $$
  select x.rank::integer from (
    select g.id, row_number() over (order by g.war_score desc, coalesce(public.server_guild_ms(g.war_reached_at), 0), g.id::text collate "C") as rank
    from public.guilds g where g.war_score is not null) x
  where x.id = p_guild;
$$;

create function public.server_guild_war_met(p_day bigint, p_x uuid, p_y uuid) returns boolean language sql stable set search_path='' as $$
  select p_x is not null and p_y is not null and exists (select 1 from public.guild_war_matches m where m.day = p_day - 2
    and ((m.guild_a = p_x and m.guild_b = p_y) or (m.guild_a = p_y and m.guild_b = p_x)));
$$;

-- 그 전투일의 짝을 정한다(한 번만) — `pairGuildsForWar`.
create function public.server_guild_war_match_day(p_day bigint) returns void language plpgsql set search_path='' as $$
declare r jsonb := public.server_guild_war_rules(); v_order uuid[]; n integer; i integer; j integer; tmp uuid;
begin
  if exists (select 1 from public.guild_war_days where day = p_day) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild-war', 0));
  if exists (select 1 from public.guild_war_days where day = p_day) then return; end if;
  select array_agg(g.id order by coalesce(g.war_score, (r ->> 'startScore')::integer) desc, coalesce(public.server_guild_ms(g.war_reached_at), 0), g.id::text collate "C")
    into v_order
    from public.guilds g
    where (select count(*) from public.guild_members m where m.guild_id = g.id) >= (r ->> 'minMembers')::integer
      and exists (select 1 from public.guild_war_defense d where d.guild_id = g.id);
  n := coalesce(array_length(v_order, 1), 0);
  i := 1;
  while i + 1 <= n loop
    if public.server_guild_war_met(p_day, v_order[i], v_order[i + 1]) then
      j := i + 2;
      if j <= n and not public.server_guild_war_met(p_day, v_order[i + 1], v_order[j]) then
        tmp := v_order[i]; v_order[i] := v_order[j]; v_order[j] := tmp;
      elsif j <= n and not public.server_guild_war_met(p_day, v_order[i], v_order[j]) then
        tmp := v_order[i + 1]; v_order[i + 1] := v_order[j]; v_order[j] := tmp;
      end if;
    end if;
    i := i + 2;
  end loop;
  insert into public.guild_war_days(day) values (p_day);
  i := 1;
  while i <= n loop
    insert into public.guild_war_matches(day, guild_a, guild_b) values (p_day, v_order[i], case when i + 1 <= n then v_order[i + 1] end);
    i := i + 2;
  end loop;
end $$;

-- 한 길드의 회차 결과를 적는다 — 점수, 코인, 최근 결과.
create function public.server_guild_war_apply(p_day bigint, p_self uuid, p_other uuid, p_outcome text, p_mine integer, p_theirs integer, p_score integer, p_other_score integer)
returns void language plpgsql set search_path='' as $$
declare v_delta integer; v_after integer; v_coin integer;
begin
  if not exists (select 1 from public.guilds where id = p_self) then return; end if;
  v_delta := public.server_guild_war_delta(p_outcome, p_score, case when p_other is null then p_score else p_other_score end);
  v_after := greatest(0, p_score + v_delta);
  update public.guilds set
    war_reached_at = case when war_score is distinct from v_after then to_timestamp((p_day + 1) * 86400) else war_reached_at end,
    war_score = v_after
  where id = p_self;
  v_coin := (public.server_guild_war_rules() -> 'coin' ->> p_outcome)::integer;
  if v_coin > 0 then
    with ins as (
      insert into public.guild_war_coins(day, guild_id, player_id, coin)
        select p_day, p_self, m.player_id, v_coin from public.guild_members m
        where m.guild_id = p_self and case when p_outcome = 'bye' then m.joined_at < to_timestamp(p_day * 86400)
          else exists (select 1 from public.guild_war_attacks a where a.day = p_day and a.player_id = m.player_id and a.guild_id = p_self and a.used > 0) end
      on conflict do nothing
      returning player_id)
    update public.guild_members set coin = coin + v_coin where player_id in (select player_id from ins);
  end if;
  insert into public.guild_war_results(guild_id, day, opponent_name, outcome, my_points, their_points, delta, score_after)
    values (p_self, p_day, (select name from public.guilds where id = p_other), p_outcome, p_mine, p_theirs, v_after - p_score, v_after)
  on conflict (guild_id) do update set day = excluded.day, opponent_name = excluded.opponent_name, outcome = excluded.outcome,
    my_points = excluded.my_points, their_points = excluded.their_points, delta = excluded.delta, score_after = excluded.score_after
  where public.guild_war_results.day <= excluded.day;
end $$;

-- 끝난 전투일을 정산한다(날 순서대로 — 점수가 회차를 이어 간다).
create function public.server_guild_war_settle(p_t timestamptz) returns void language plpgsql set search_path='' as $$
declare r jsonb := public.server_guild_war_rules(); v_today bigint := public.server_guild_war_day(p_t); mt public.guild_war_matches;
  pa integer; pb integer; aa integer; ab integer; ra timestamptz; rb timestamptz; sa integer; sb integer;
begin
  if not exists (select 1 from public.guild_war_matches where not settled and day < v_today) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild-war', 0));
  for mt in select * from public.guild_war_matches where not settled and day < v_today order by day, guild_a for update loop
    update public.guild_war_matches set settled = true where day = mt.day and guild_a = mt.guild_a;
    sa := coalesce((select war_score from public.guilds where id = mt.guild_a), (r ->> 'startScore')::integer);
    if mt.guild_b is null then
      perform public.server_guild_war_apply(mt.day, mt.guild_a, null, 'bye', 0, 0, sa, sa);
      continue;
    end if;
    sb := coalesce((select war_score from public.guilds where id = mt.guild_b), (r ->> 'startScore')::integer);
    pa := public.server_guild_war_points(mt.guild_a, mt.guild_b, mt.day);
    pb := public.server_guild_war_points(mt.guild_b, mt.guild_a, mt.day);
    select count(*) into aa from public.guild_war_attacks where day = mt.day and guild_id = mt.guild_a and used > 0;
    select count(*) into ab from public.guild_war_attacks where day = mt.day and guild_id = mt.guild_b and used > 0;
    select max(captured_at) into ra from public.guild_war_captures where day = mt.day and attacker = mt.guild_a;
    select max(captured_at) into rb from public.guild_war_captures where day = mt.day and attacker = mt.guild_b;
    perform public.server_guild_war_apply(mt.day, mt.guild_a, mt.guild_b, public.server_guild_war_outcome(pa, aa, ra, pb, ab, rb), pa, pb, sa, sb);
    perform public.server_guild_war_apply(mt.day, mt.guild_b, mt.guild_a, public.server_guild_war_outcome(pb, ab, rb, pa, aa, ra), pb, pa, sb, sa);
  end loop;
end $$;

-- 길드전 전선(`GuildWarFrontView`).
create function public.server_guild_war_front(p_guild uuid, p_player uuid, p_t timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare r jsonb := public.server_guild_war_rules(); v_day bigint := public.server_guild_war_day(p_t); v_used integer; base jsonb; last jsonb;
  g public.guilds; og public.guilds; mt public.guild_war_matches; me public.guild_members; v_opp uuid; slots jsonb;
begin
  select * into g from public.guilds where id = p_guild;
  select * into me from public.guild_members where player_id = p_player;
  v_used := coalesce((select used from public.guild_war_attacks where day = v_day and player_id = p_player), 0);
  select jsonb_build_object('day', x.day, 'opponentName', x.opponent_name, 'outcome', x.outcome, 'myPoints', x.my_points, 'theirPoints', x.their_points,
      'delta', x.delta, 'scoreAfter', x.score_after,
      'coin', coalesce((select c.coin from public.guild_war_coins c where c.day = x.day and c.guild_id = p_guild and c.player_id = p_player), 0))
    into last from public.guild_war_results x where x.guild_id = p_guild;
  base := jsonb_build_object('day', v_day, 'phase', case when v_day % 2 = 0 then 'prep' else 'battle' end, 'endsAt', (v_day + 1) * 86400000,
    'status', 'idle', 'opponent', null, 'slots', '[]'::jsonb, 'myPoints', 0, 'theirPoints', 0,
    'attacksLeft', greatest(0, (r ->> 'attacksPerMember')::integer - v_used), 'canAttack', false,
    'warScore', g.war_score, 'warRank', public.server_guild_war_rank(p_guild), 'last', last, 'serverTime', public.server_guild_ms(p_t));
  if v_day % 2 = 0 then return base; end if;
  perform public.server_guild_war_match_day(v_day);
  select * into mt from public.guild_war_matches where day = v_day and (guild_a = p_guild or guild_b = p_guild);
  if not found then return base; end if;
  if mt.guild_b is null then return base || jsonb_build_object('status', 'bye'); end if;
  v_opp := case when mt.guild_a = p_guild then mt.guild_b else mt.guild_a end;
  select * into og from public.guilds where id = v_opp;
  if not found then return base || jsonb_build_object('status', 'bye'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', f.slot_id, 'branch', f.slot_branch, 'kind', f.slot_kind, 'index', f.slot_idx,
      'captured', f.is_captured, 'open', f.is_open,
      'holder', case when m.player_id is null then null else jsonb_build_object('userId', m.player_id, 'name', m.name, 'level', m.level,
        'avatarRelicId', m.avatar_relic_id, 'frameId', m.frame_id, 'isMe', false) end,
      'deck', case when m.player_id is null then '[]'::jsonb else d.deck end,
      'power', case when m.player_id is null then 0 else (select coalesce(sum((e ->> 'power')::bigint), 0) from jsonb_array_elements(d.deck) e) end)
      order by f.slot_branch, f.slot_ord, f.slot_idx), '[]'::jsonb)
    into slots
    from public.server_guild_war_front_slots(p_guild, v_opp, v_day) f
    left join public.guild_war_defense d on d.guild_id = v_opp and d.slot_id = f.slot_id
    left join public.guild_members m on m.player_id = d.player_id and m.guild_id = v_opp;
  return base || jsonb_build_object('status', 'matched',
    'opponent', jsonb_build_object('id', og.id, 'name', og.name, 'badge', og.badge, 'level', public.server_guild_level(og.prosperity),
      'score', coalesce(og.war_score, (r ->> 'startScore')::integer)),
    'slots', slots,
    'myPoints', public.server_guild_war_points(p_guild, v_opp, v_day), 'theirPoints', public.server_guild_war_points(v_opp, p_guild, v_day),
    'canAttack', me.joined_at < to_timestamp(v_day * 86400));
end $$;

-- 길드 요약이 길드전 점수를 싣는다(20261022000000의 본문 그대로, warScore만 열을 읽는다).
create or replace function public.server_guild_summary(p_guild uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id', g.id, 'name', g.name, 'badge', g.badge,
    'level', public.server_guild_level(g.prosperity), 'memberCount', (select count(*) from public.guild_members where guild_id = g.id),
    'capacity', public.server_guild_capacity(public.server_guild_level(g.prosperity)), 'joinMode', g.join_mode,
    'leaderName', coalesce((select name from public.guild_members where guild_id = g.id and role = 'leader'), ''), 'notice', g.notice,
    'prosperity', g.prosperity, 'contributionTotal', coalesce((select sum(contribution_total) from public.guild_members where guild_id = g.id), 0),
    'warScore', g.war_score, 'guardScore', null)
  from public.guilds g where g.id = p_guild;
$$;
revoke all on function public.server_guild_summary(uuid) from public, anon, authenticated;

-- 순위 보상 문(20261112000000) 앞에 길드전 공격 세 조작과 정산을 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_rank;
revoke all on function public.server_guild_call_rank(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_rank(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); r jsonb := public.server_guild_war_rules();
  m public.guild_members; cached public.guild_receipts; mt public.guild_war_matches; og public.guilds;
  v_day bigint; v_slot text; v_opp uuid; v_used integer; v_open boolean; v_lineup jsonb; v_defender text; v_won boolean; v_entry text;
  v_adm uuid; v_captured boolean := false; data jsonb; out jsonb;
begin
  perform public.server_guild_war_settle(t);
  if p_method not in ('getWarFront','beginWarAttack','recordWarAttack') then
    out := public.server_guild_call_rank(p_player, p_method, p_actor, p_args, p_request);
    if p_method = 'getGuild' and jsonb_typeof(out -> 'guild') = 'object' then
      -- 길드 상세(20261019000000)는 길드전 값을 null로 덮는다 — 열과 등수로 다시 적는다.
      out := jsonb_set(jsonb_set(out, '{guild,warScore}', coalesce(to_jsonb((select war_score from public.guilds where id = (out -> 'guild' ->> 'id')::uuid)), 'null'::jsonb)),
        '{guild,warRank}', coalesce(to_jsonb(public.server_guild_war_rank((out -> 'guild' ->> 'id')::uuid)), 'null'::jsonb));
    end if;
    return out;
  end if;
  perform public.server_require_active(p_player);

  if p_method = 'getWarFront' then
    select * into m from public.guild_members where player_id = p_player;
    if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return public.server_guild_war_front(m.guild_id, p_player, t);
  end if;

  if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
  select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
  if found then
    if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
    if p_method = 'beginWarAttack' then return cached.response; end if;
    select * into m from public.guild_members where player_id = p_player;
    if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return jsonb_build_object('captured', cached.response -> 'captured', 'front', public.server_guild_war_front(m.guild_id, p_player, t));
  end if;

  select * into m from public.guild_members where player_id = p_player for update;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;

  if p_method = 'beginWarAttack' then
    v_day := public.server_guild_war_day(t);
    if v_day % 2 = 0 then perform public.server_guild_fail('WAR_LOCKED'); end if;
    v_slot := args ->> 0;
    if v_slot is null or v_slot !~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$' then perform public.server_guild_fail('SLOT_INVALID'); end if;
    perform public.server_guild_war_match_day(v_day);
    select * into mt from public.guild_war_matches where day = v_day and (guild_a = m.guild_id or guild_b = m.guild_id);
    if not found or mt.guild_b is null then perform public.server_guild_fail('WAR_NO_OPPONENT'); end if;
    v_opp := case when mt.guild_a = m.guild_id then mt.guild_b else mt.guild_a end;
    select * into og from public.guilds where id = v_opp;
    if not found then perform public.server_guild_fail('WAR_NO_OPPONENT'); end if;
    if not (m.joined_at < to_timestamp(v_day * 86400)) then perform public.server_guild_fail('WAR_NEW_MEMBER'); end if;
    -- 같은 길드의 공격끼리 줄 세운다 — 격파 판정과 공격 수가 엇갈리지 않게.
    perform 1 from public.guilds where id = m.guild_id for update;
    v_used := coalesce((select used from public.guild_war_attacks where day = v_day and player_id = p_player), 0);
    if v_used >= (r ->> 'attacksPerMember')::integer then perform public.server_guild_fail('WAR_NO_ATTACKS'); end if;
    select f.is_open into v_open from public.server_guild_war_front_slots(m.guild_id, v_opp, v_day) f where f.slot_id = v_slot;
    if not found then perform public.server_guild_fail('SLOT_INVALID'); end if;
    if not v_open then perform public.server_guild_fail('SLOT_CLOSED'); end if;
    select d.lineup, coalesce(dm.name, '') into v_lineup, v_defender
      from public.guild_war_defense d left join public.guild_members dm on dm.player_id = d.player_id
      where d.guild_id = v_opp and d.slot_id = v_slot;
    insert into public.guild_war_attacks(day, player_id, guild_id, used) values (v_day, p_player, m.guild_id, 1)
      on conflict (day, player_id) do update set used = public.guild_war_attacks.used + 1, guild_id = excluded.guild_id;
    insert into public.guild_war_admissions(player_id, request_id, day, slot_id, guild_id) values (p_player, p_request, v_day, v_slot, m.guild_id);
    out := jsonb_build_object('day', v_day, 'slotId', v_slot, 'opponentName', og.name, 'defenderName', v_defender, 'defense', v_lineup,
      'attacksLeft', greatest(0, (r ->> 'attacksPerMember')::integer - v_used - 1));
    insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
    return out;
  end if;

  -- recordWarAttack — 승패는 게임 서버가 다시 굴려 확정한 값이다.
  data := args -> 0;
  if jsonb_typeof(data) <> 'object' or jsonb_typeof(data -> 'day') <> 'number' or jsonb_typeof(data -> 'won') <> 'boolean'
    or jsonb_typeof(data -> 'entry') <> 'string' or coalesce(data ->> 'slotId', '') !~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$' then
    perform public.server_guild_fail('INVALID_REQUEST');
  end if;
  v_day := (data ->> 'day')::bigint; v_slot := data ->> 'slotId'; v_won := (data ->> 'won')::boolean; v_entry := data ->> 'entry';
  delete from public.guild_war_admissions where player_id = p_player and request_id = v_entry and day = v_day and slot_id = v_slot
    returning guild_id into v_adm;
  if not found then perform public.server_guild_fail('WAR_NOT_ENTERED'); end if;
  if v_won and v_adm = m.guild_id then
    -- 정산이 이미 끝났으면(자정을 넘겨 낸 판) 격파는 남기지 않는다 — 끝난 회차의 점수를 바꾸지 않는다.
    select * into mt from public.guild_war_matches where day = v_day and (guild_a = m.guild_id or guild_b = m.guild_id) for update;
    if found and not mt.settled and mt.guild_b is not null then
      insert into public.guild_war_captures(day, attacker, slot_id, by_player, captured_at) values (v_day, m.guild_id, v_slot, p_player, t)
        on conflict do nothing;
      v_captured := found;
    end if;
  end if;
  out := jsonb_build_object('captured', v_captured);
  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return jsonb_build_object('captured', v_captured, 'front', public.server_guild_war_front(m.guild_id, p_player, t));
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_war_rules(), public.server_guild_war_day(timestamptz),
  public.server_guild_war_front_slots(uuid,uuid,bigint), public.server_guild_war_points(uuid,uuid,bigint),
  public.server_guild_war_outcome(integer,integer,timestamptz,integer,integer,timestamptz), public.server_guild_war_delta(text,integer,integer),
  public.server_guild_war_rank(uuid), public.server_guild_war_met(bigint,uuid,uuid), public.server_guild_war_match_day(bigint),
  public.server_guild_war_apply(bigint,uuid,uuid,text,integer,integer,integer,integer), public.server_guild_war_settle(timestamptz),
  public.server_guild_war_front(uuid,uuid,timestamptz)
  from public, anon, authenticated;
