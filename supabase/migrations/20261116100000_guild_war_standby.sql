-- 길드전 전원 자동 배치(v0.393.0 · 2026-10-29 응태 요청 — "배치는 기본적으로 자동으로, 간부는 그 배치도를 고친다").
-- 길드원마다 대기 방어덱(`war_standby` — 결투 방어덱, 없으면 가장 센 보유 렐릭 셋)을 게임 서버가 하루 한 번 넣어 두고(`syncWarStandby`),
-- 준비일에 지도를 열 때 · 대기 덱이 들어올 때 · 전투일 매칭 직전에 칸이 없는 길드원을 자동 배치 순서의 빈 칸에 방어 전투력 순으로 세운다.
-- 간부가 칸에서 뺀 길드원은 48시간 동안 다시 채우지 않는다(`war_bench_at`) — 본인이 방어덱을 직접 세우면 풀린다.
-- 규칙의 원본은 `src/api/FakeGuildServer.ts`(autofillWar · syncWarStandby · GUILD_WAR_BENCH_MS)다. 새 표는 없고 열 둘만 더한다.
-- 적용 순서: 20261115000000_guild_war_auto_arrange.sql 다음 → 서버 → 클라이언트.

alter table public.guild_members
  add column war_standby jsonb,
  add column war_bench_at timestamptz;

-- 칸이 없고 쉬는 중이 아닌 대기 덱을 첫 빈 칸부터 방어 전투력 높은 순(같으면 player_id 순)으로 세운다. 칸보다 많은 사람은 빠진다.
create or replace function public.server_guild_war_autofill(p_guild uuid, p_level integer, p_t timestamptz) returns void
language sql set search_path='' as $$
  insert into public.guild_war_defense(guild_id, slot_id, player_id, deck, lineup, placed_at)
  select p_guild, f.slot_id, c.player_id, c.deck, c.lineup, p_t
  from (
    select m.player_id, m.war_standby -> 'deck' as deck, m.war_standby -> 'lineup' as lineup,
      row_number() over (order by (select coalesce(sum((e ->> 'power')::bigint), 0) from jsonb_array_elements(m.war_standby -> 'deck') e) desc,
        m.player_id::text) as rn
    from public.guild_members m
    where m.guild_id = p_guild and m.war_standby is not null
      and (m.war_bench_at is null or m.war_bench_at <= p_t - interval '48 hours')
      and not exists (select 1 from public.guild_war_defense d where d.player_id = m.player_id)
  ) c
  join (
    select o.slot_id, row_number() over (order by o.ord) as rn
    from public.server_guild_war_order(p_level) o
    where not exists (select 1 from public.guild_war_defense d where d.guild_id = p_guild and d.slot_id = o.slot_id)
  ) f on f.rn = c.rn;
$$;
revoke all on function public.server_guild_war_autofill(uuid, integer, timestamptz) from public, anon, authenticated;

-- 자동 배치 문(20261115000000) 앞에 대기 덱·자동 채우기·쉬는 표식을 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_arrange;
revoke all on function public.server_guild_call_arrange(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_arrange(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); m public.guild_members; data jsonb; v_level integer; holder uuid; out jsonb;
begin
  if p_method not in ('syncWarStandby','getWarMap','clearWarSlot','placeWarDefense') then
    return public.server_guild_call_arrange(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);

  if p_method = 'placeWarDefense' then
    -- 본인이 직접 세우면 쉬는 표식이 풀린다(칸·영수증 판정은 예전 문이 한다).
    out := public.server_guild_call_arrange(p_player, p_method, p_actor, p_args, p_request);
    update public.guild_members set war_bench_at = null where player_id = p_player and war_bench_at is not null;
    return out;
  end if;

  if p_method = 'clearWarSlot' then
    select d.player_id into holder from public.guild_war_defense d
      join public.guild_members me on me.guild_id = d.guild_id and me.player_id = p_player
      where d.slot_id = args ->> 0;
    out := public.server_guild_call_arrange(p_player, p_method, p_actor, p_args, p_request);
    -- 뺀 사람은 48시간 동안 자동 배치가 다시 세우지 않는다(본인이 비운 것도 같다 — 곧바로 다시 서면 비운 뜻이 없다).
    if holder is not null then update public.guild_members set war_bench_at = t where player_id = holder; end if;
    return out;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));
  select * into m from public.guild_members where player_id = p_player for update;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
  select public.server_guild_level(prosperity) into v_level from public.guilds where id = m.guild_id;

  if p_method = 'syncWarStandby' then
    data := args -> 0;
    if jsonb_typeof(data) <> 'object' or jsonb_typeof(data -> 'deck') <> 'array' or jsonb_array_length(data -> 'deck') <> 3
      or jsonb_typeof(data -> 'lineup') <> 'array' or jsonb_array_length(data -> 'lineup') <> 3
      or (select count(distinct e ->> 'relicId') from jsonb_array_elements(data -> 'deck') e
          where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'relicId') = 'string' and char_length(e ->> 'relicId') between 1 and 64
            and jsonb_typeof(e -> 'power') = 'number' and (e ->> 'power')::numeric between 0 and 100000000) <> 3 then
      perform public.server_guild_fail('INVALID_REQUEST');
    end if;
    update public.guild_members set war_standby = jsonb_build_object('deck', data -> 'deck', 'lineup', data -> 'lineup') where player_id = p_player;
    if public.server_guild_war_prep(t) then
      perform 1 from public.guilds where id = m.guild_id for update;
      perform public.server_guild_war_autofill(m.guild_id, v_level, t);
    end if;
    return jsonb_build_object('ok', true);
  end if;

  -- getWarMap — 준비일이면 빈 칸을 먼저 채운다.
  if public.server_guild_war_prep(t) then
    perform 1 from public.guilds where id = m.guild_id for update;
    perform public.server_guild_war_autofill(m.guild_id, v_level, t);
  end if;
  return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;

-- 전투일 매칭 직전에 모든 길드의 빈 칸을 채운다 — 지도를 한 번도 열지 않은 길드도 대기 덱이 있으면 매칭에 든다.
alter function public.server_guild_war_match_day(bigint) rename to server_guild_war_match_day_base;
revoke all on function public.server_guild_war_match_day_base(bigint) from public, anon, authenticated;

create or replace function public.server_guild_war_match_day(p_day bigint) returns void language plpgsql set search_path='' as $$
declare g record; t timestamptz := now();
begin
  if exists (select 1 from public.guild_war_days where day = p_day) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild-war', 0));
  if exists (select 1 from public.guild_war_days where day = p_day) then return; end if;
  for g in select id, public.server_guild_level(prosperity) as lv from public.guilds order by id loop
    perform public.server_guild_war_autofill(g.id, g.lv, t);
  end loop;
  perform public.server_guild_war_match_day_base(p_day);
end $$;
revoke all on function public.server_guild_war_match_day(bigint) from public, anon, authenticated;
