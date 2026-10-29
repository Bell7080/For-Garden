-- 길드전 방어진 자동 배치 · 배치 편집(v0.392.0 · 2026-10-29 응태 요청).
-- 방어덱은 이제 칸을 고르지 않고 세운다: `placeWarDefense`의 slotId가 null이면 이미 선 칸에서 덱만 바꾸고, 칸이 없으면 자동 배치
-- 순서(우두머리 → 정예 → 일반, 같은 종류는 번호 → 지부 순 — `guildWarAutoOrder`)의 첫 빈 칸에 선다. 칸을 옮기는 일은 배치
-- 권한(길드장·부길드장·간부)만 한다 — `moveWarSlot`(옮기기 · 서로 바꾸기)과 `autoArrangeWar`(방어 전투력 순으로 다시 세우기).
-- 규칙의 원본은 `src/core/guildWarMap.ts`·`src/api/FakeGuildServer.ts`다. 새 표·열은 없다.
-- 적용 순서: 20261114100000_guild_rename.sql 다음 → 서버 → 클라이언트.

-- 자동 배치 순서 — 레벨이 여는 모든 칸에 0부터 순번을 붙인다.
create or replace function public.server_guild_war_order(p_level integer) returns table(slot_id text, ord integer)
language sql immutable set search_path='' as $$
  select s.id, (row_number() over (order by s.kord, s.idx, s.branch) - 1)::integer
  from (
    select b.branch, k.kord, i.idx, b.branch || ':' || k.kind || ':' || i.idx as id
    from generate_series(1,3) as b(branch),
      (values ('boss',0),('elite',1),('grunt',2)) as k(kind, kord),
      lateral generate_series(0, case k.kind when 'boss' then 0 when 'elite' then 1 else public.server_guild_war_grunts(p_level, b.branch) - 1 end) as i(idx)
  ) s;
$$;
revoke all on function public.server_guild_war_order(integer) from public, anon, authenticated;

-- 이름 변경 문(20261114100000) 앞에 방어진 자동 배치·편집을 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_rename;
revoke all on function public.server_guild_call_rename(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_rename(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); m public.guild_members; cached public.guild_receipts;
  data jsonb; v_level integer; v_slot text; v_from text; v_to text; moving uuid; other uuid; out jsonb;
begin
  -- 칸을 준 배치는 예전 문(빈 칸에만 · 옮겨 서기)이 그대로 받는다.
  if not (p_method in ('moveWarSlot','autoArrangeWar')
      or (p_method = 'placeWarDefense' and jsonb_typeof(args -> 0) = 'object' and coalesce(jsonb_typeof(args -> 0 -> 'slotId'), 'null') = 'null')) then
    return public.server_guild_call_rename(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));

  if p_method = 'placeWarDefense' then
    if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
    select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
    if found then
      if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
      select * into m from public.guild_members where player_id = p_player;
      if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
      return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
    end if;
  end if;

  select * into m from public.guild_members where player_id = p_player for update;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
  perform 1 from public.guilds where id = m.guild_id for update;
  if not public.server_guild_war_prep(t) then perform public.server_guild_fail('WAR_LOCKED'); end if;
  select public.server_guild_level(prosperity) into v_level from public.guilds where id = m.guild_id;

  if p_method = 'placeWarDefense' then
    data := args -> 0;
    if jsonb_typeof(data -> 'deck') <> 'array' or jsonb_array_length(data -> 'deck') <> 3
      or jsonb_typeof(data -> 'lineup') <> 'array' or jsonb_array_length(data -> 'lineup') <> 3
      or (select count(distinct e ->> 'relicId') from jsonb_array_elements(data -> 'deck') e
          where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'relicId') = 'string' and char_length(e ->> 'relicId') between 1 and 64
            and jsonb_typeof(e -> 'power') = 'number' and (e ->> 'power')::numeric between 0 and 100000000) <> 3 then
      perform public.server_guild_fail('INVALID_REQUEST');
    end if;
    -- 이미 선 칸이 지금 레벨에서도 열려 있으면 그 칸에서 덱만 바꾼다. 아니면 자동 배치 순서의 첫 빈 칸이다.
    select d.slot_id into v_slot from public.guild_war_defense d
      where d.guild_id = m.guild_id and d.player_id = p_player and public.server_guild_war_slot_open(v_level, d.slot_id);
    if v_slot is null then
      select o.slot_id into v_slot from public.server_guild_war_order(v_level) o
        where not exists (select 1 from public.guild_war_defense d where d.guild_id = m.guild_id and d.slot_id = o.slot_id and d.player_id <> p_player)
        order by o.ord limit 1;
    end if;
    if v_slot is null then perform public.server_guild_fail('SLOT_FULL'); end if;
    delete from public.guild_war_defense where player_id = p_player;
    insert into public.guild_war_defense(guild_id, slot_id, player_id, deck, lineup, placed_at)
      values (m.guild_id, v_slot, p_player, data -> 'deck', data -> 'lineup', t);
    out := jsonb_build_object('slotId', v_slot);
    insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
    return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
  end if;

  -- 아래 둘은 배치 권한(`guildCan(role, "formation")`)만 — 길드장·부길드장·간부.
  if m.role not in ('leader','vice','officer') then perform public.server_guild_fail('NO_PERMISSION'); end if;

  if p_method = 'moveWarSlot' then
    v_from := args ->> 0; v_to := args ->> 1;
    if v_from is null or v_to is null or v_from = v_to
      or not public.server_guild_war_slot_open(v_level, v_from) or not public.server_guild_war_slot_open(v_level, v_to) then
      perform public.server_guild_fail('SLOT_INVALID');
    end if;
    select player_id into moving from public.guild_war_defense where guild_id = m.guild_id and slot_id = v_from;
    if moving is null then perform public.server_guild_fail('SLOT_INVALID'); end if;
    select player_id into other from public.guild_war_defense where guild_id = m.guild_id and slot_id = v_to;
    -- 기본 키(guild_id, slot_id)가 겹치지 않게 비켜 두었다가 바꾼다.
    update public.guild_war_defense set slot_id = '3:grunt:99' where guild_id = m.guild_id and slot_id = v_from;
    if other is not null then update public.guild_war_defense set slot_id = v_from where guild_id = m.guild_id and slot_id = v_to; end if;
    update public.guild_war_defense set slot_id = v_to where guild_id = m.guild_id and slot_id = '3:grunt:99';
    return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
  end if;

  -- autoArrangeWar — 방어 전투력 높은 순(같으면 player_id 순)으로 자동 배치 순서에 다시 세운다. 칸보다 많은 사람은 빠진다.
  create temporary table if not exists war_plan(player_id uuid, slot_id text, deck jsonb, lineup jsonb, placed_at timestamptz) on commit drop;
  delete from war_plan;
  insert into war_plan(player_id, slot_id, deck, lineup, placed_at)
    select r.player_id, o.slot_id, r.deck, r.lineup, r.placed_at
    from (
      select d.player_id, d.deck, d.lineup, d.placed_at,
        row_number() over (order by (select coalesce(sum((e ->> 'power')::bigint), 0) from jsonb_array_elements(d.deck) e) desc, d.player_id::text) - 1 as rn
      from public.guild_war_defense d where d.guild_id = m.guild_id
    ) r
    join public.server_guild_war_order(v_level) o on o.ord = r.rn;
  delete from public.guild_war_defense where guild_id = m.guild_id;
  insert into public.guild_war_defense(guild_id, slot_id, player_id, deck, lineup, placed_at)
    select m.guild_id, slot_id, player_id, deck, lineup, placed_at from war_plan;
  return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
