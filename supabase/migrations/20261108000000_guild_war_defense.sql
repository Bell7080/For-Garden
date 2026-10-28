-- 길드전 방어진 지도 — 우리 길드 영지의 칸(지부 셋 × 우두머리 1 · 정예 2 · 일반 N)에 길드원이 방어덱 셋을 세운다.
-- 규칙의 원본은 `src/core/guildWarMap.ts`·`src/core/guildWar.ts`·`src/api/FakeGuildServer.ts`(getWarMap·clearWarSlot·placeWarDefense)다.
-- 덱(렐릭·레벨·돌파·전투력)과 전투 스냅샷은 게임 서버가 보유·성장을 확인해 굳힌 값만 들어온다 — 이 함수는 칸·국면·중복만 판정한다.
-- 길드원 한 명은 한 칸에만 선다. 탈퇴·추방·해산은 길드원 행이 지워지며 칸도 함께 비운다(외래 키 cascade).

create table public.guild_war_defense (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  slot_id text not null check (slot_id ~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$'),
  player_id uuid not null references public.guild_members(player_id) on delete cascade,
  deck jsonb not null check (jsonb_typeof(deck) = 'array' and jsonb_array_length(deck) = 3),
  lineup jsonb not null check (jsonb_typeof(lineup) = 'array' and jsonb_array_length(lineup) = 3),
  placed_at timestamptz not null default now(),
  primary key (guild_id, slot_id)
);
create unique index guild_war_defense_one_slot on public.guild_war_defense(player_id);
alter table public.guild_war_defense enable row level security;
revoke all on public.guild_war_defense from public, anon, authenticated;

-- 레벨별 지부 일반 칸 수(`GUILD_WAR_GRUNTS` — tests/unit/guildSql.test.ts가 대조한다).
create or replace function public.server_guild_war_grunts(p_level integer, p_branch integer) returns integer language sql immutable set search_path='' as $$
  select ((array[[2,1,0],[2,1,1],[3,1,1],[3,2,2],[4,2,2],[4,3,2],[5,3,3],[6,4,3],[6,4,4],[7,4,4]])[least(greatest(p_level,1),10)][p_branch]);
$$;

-- 길드 레벨이 여는 칸인가. 칸 id 모양은 `parseGuildWarSlotId`와 같다.
create or replace function public.server_guild_war_slot_open(p_level integer, p_slot text) returns boolean language plpgsql immutable set search_path='' as $$
declare parts text[];
begin
  if p_slot is null or p_slot !~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$' then return false; end if;
  parts := string_to_array(p_slot, ':');
  return parts[3]::integer < case parts[2] when 'boss' then 1 when 'elite' then 2 else public.server_guild_war_grunts(p_level, parts[1]::integer) end;
end $$;

-- 정비일(UTC 날 번호가 짝수)에만 지도를 고친다(`guildWarPhase`).
create or replace function public.server_guild_war_prep(p_t timestamptz) returns boolean language sql immutable set search_path='' as $$
  select floor(extract(epoch from p_t) / 86400)::bigint % 2 = 0;
$$;

create or replace function public.server_guild_war_map(p_guild uuid, p_player uuid, p_role text, p_t timestamptz) returns jsonb
language sql stable set search_path='' as $$
  with g as (select public.server_guild_level(prosperity) as level from public.guilds where id = p_guild),
  slots as (
    select b.branch, k.kind, k.ord, i.idx, b.branch || ':' || k.kind || ':' || i.idx as id
    from g, generate_series(1,3) as b(branch),
      (values ('boss',0),('elite',1),('grunt',2)) as k(kind, ord),
      lateral generate_series(0, case k.kind when 'boss' then 0 when 'elite' then 1 else public.server_guild_war_grunts(g.level, b.branch) - 1 end) as i(idx)
  )
  select jsonb_build_object(
    'level', (select level from g),
    'phase', case when public.server_guild_war_prep(p_t) then 'prep' else 'battle' end,
    'endsAt', (floor(extract(epoch from p_t) / 86400)::bigint + 1) * 86400000,
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'branch', s.branch, 'kind', s.kind, 'index', s.idx,
        'holder', case when m.player_id is null then null else jsonb_build_object('userId', m.player_id, 'name', m.name, 'level', m.level,
          'avatarRelicId', m.avatar_relic_id, 'frameId', m.frame_id, 'isMe', m.player_id = p_player) end,
        'deck', case when m.player_id is null then '[]'::jsonb else d.deck end,
        'power', case when m.player_id is null then 0 else (select coalesce(sum((e ->> 'power')::bigint), 0) from jsonb_array_elements(d.deck) e) end)
        order by s.branch, s.ord, s.idx)
      from slots s
      left join public.guild_war_defense d on d.guild_id = p_guild and d.slot_id = s.id
      left join public.guild_members m on m.player_id = d.player_id and m.guild_id = p_guild), '[]'::jsonb),
    'mySlotId', (select slot_id from public.guild_war_defense where guild_id = p_guild and player_id = p_player),
    -- 칸 배치 권한(`guildCan(role, "formation")`) — 길드장·부길드장·간부.
    'canArrange', p_role in ('leader','vice','officer'),
    'serverTime', public.server_guild_ms(p_t));
$$;

-- 수호전 문(20261107000000) 앞에 방어진 세 조작만 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_guard;
revoke all on function public.server_guild_call_guard(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_guard(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); m public.guild_members; cached public.guild_receipts;
  data jsonb; v_slot text; v_level integer; holder uuid; out jsonb;
begin
  if p_method not in ('getWarMap','clearWarSlot','placeWarDefense') then
    return public.server_guild_call_guard(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);

  if p_method = 'getWarMap' then
    select * into m from public.guild_members where player_id = p_player;
    if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
  end if;

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

  if p_method = 'clearWarSlot' then
    v_slot := args ->> 0;
    if v_slot is null or v_slot !~ '^[123]:(boss|elite|grunt):[0-9]{1,2}$' then perform public.server_guild_fail('SLOT_INVALID'); end if;
    select player_id into holder from public.guild_war_defense where guild_id = m.guild_id and slot_id = v_slot;
    if not found then perform public.server_guild_fail('SLOT_INVALID'); end if;
    if holder <> p_player and m.role not in ('leader','vice','officer') then perform public.server_guild_fail('NO_PERMISSION'); end if;
    delete from public.guild_war_defense where guild_id = m.guild_id and slot_id = v_slot;
    return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
  end if;

  -- placeWarDefense — 같은 영수증은 위에서 같은 지도를 돌려주었다.
  data := args -> 0;
  if jsonb_typeof(data) <> 'object' then perform public.server_guild_fail('INVALID_REQUEST'); end if;
  v_slot := data ->> 'slotId';
  if not public.server_guild_war_slot_open(v_level, v_slot) then perform public.server_guild_fail('SLOT_INVALID'); end if;
  if jsonb_typeof(data -> 'deck') <> 'array' or jsonb_array_length(data -> 'deck') <> 3
    or jsonb_typeof(data -> 'lineup') <> 'array' or jsonb_array_length(data -> 'lineup') <> 3
    or (select count(distinct e ->> 'relicId') from jsonb_array_elements(data -> 'deck') e
        where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'relicId') = 'string' and char_length(e ->> 'relicId') between 1 and 64
          and jsonb_typeof(e -> 'power') = 'number' and (e ->> 'power')::numeric between 0 and 100000000) <> 3 then
    perform public.server_guild_fail('INVALID_REQUEST');
  end if;
  select player_id into holder from public.guild_war_defense where guild_id = m.guild_id and slot_id = v_slot;
  if found and holder <> p_player then perform public.server_guild_fail('SLOT_TAKEN'); end if;
  delete from public.guild_war_defense where player_id = p_player;
  insert into public.guild_war_defense(guild_id, slot_id, player_id, deck, lineup, placed_at)
    values (m.guild_id, v_slot, p_player, data -> 'deck', data -> 'lineup', t);
  out := jsonb_build_object('slotId', v_slot);
  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return public.server_guild_war_map(m.guild_id, p_player, m.role, t);
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_war_grunts(integer,integer) from public, anon, authenticated;
revoke all on function public.server_guild_war_slot_open(integer,text) from public, anon, authenticated;
revoke all on function public.server_guild_war_prep(timestamptz) from public, anon, authenticated;
revoke all on function public.server_guild_war_map(uuid,uuid,text,timestamptz) from public, anon, authenticated;
