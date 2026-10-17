-- 길드 1단계: 기본·뱃지·출석·길드 코인 상점.
-- 규칙의 원본은 src/core/guild*.ts이고 이 파일은 같은 규칙을 DB 트랜잭션으로 지킨다(표 값은 tests/unit/guildSql.test.ts가 대조한다).
-- 모든 함수는 서비스 롤만 부른다. 호출자 정보(p_actor)는 서버가 저장된 진행에서 만들어 넘기며 클라이언트의 말이 아니다.

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 48),
  name_key text not null,
  badge jsonb not null,
  join_mode text not null check (join_mode in ('open','approval')),
  notice text not null default '' check (char_length(notice) <= 480),
  prosperity integer not null default 0 check (prosperity >= 0),
  badge_changes integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index guilds_name_key_unique on public.guilds(name_key);

create table public.guild_members (
  player_id uuid primary key references public.players(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  role text not null check (role in ('leader','vice','officer','member')),
  name text not null, level integer not null default 1, avatar_relic_id text not null default '', frame_id text not null default '',
  joined_at timestamptz not null default now(), last_active_at timestamptz not null default now(),
  coin integer not null default 0 check (coin >= 0),
  contribution_week integer not null default 0, contribution_week_key text not null default '', contribution_total integer not null default 0,
  purchases jsonb not null default '{}', purchase_week_key text not null default '', week_bonus_key text not null default ''
);
create index guild_members_guild on public.guild_members(guild_id);
-- 길드장은 길드마다 정확히 한 명이다.
create unique index guild_members_one_leader on public.guild_members(guild_id) where role = 'leader';

create table public.guild_requests (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  actor jsonb not null, requested_at timestamptz not null default now(),
  primary key (guild_id, player_id)
);
create index guild_requests_player on public.guild_requests(player_id);

create table public.guild_attendance (
  player_id uuid not null references public.players(id) on delete cascade,
  day date not null, choice text not null check (choice in ('gold','cheesecake')),
  primary key (player_id, day)
);

create table public.guild_left (player_id uuid primary key references public.players(id) on delete cascade, left_at timestamptz not null);

create table public.guild_receipts (
  player_id uuid not null references public.players(id) on delete cascade,
  request_id text not null, method text not null, response jsonb not null, created_at timestamptz not null default now(),
  primary key (player_id, request_id)
);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_requests enable row level security;
alter table public.guild_attendance enable row level security;
alter table public.guild_left enable row level security;
alter table public.guild_receipts enable row level security;
revoke all on public.guilds, public.guild_members, public.guild_requests, public.guild_attendance, public.guild_left, public.guild_receipts from public, anon, authenticated;

-- ── 표 값 ────────────────────────────────────────────────────────────────────
create function public.server_guild_fail(p_code text) returns void language plpgsql immutable set search_path='' as $$
begin raise exception '%', p_code using errcode='PT422'; end $$;

create function public.server_guild_level(p_prosperity integer) returns integer language sql immutable set search_path='' as $$
  select greatest(1, (select count(*)::integer from unnest(array[0,2500,6000,10500,16000,22500,30000,39000,49000,60000]) as t(v) where v <= p_prosperity));
$$;
create function public.server_guild_capacity(p_level integer) returns integer language sql immutable set search_path='' as $$
  select (array[20,22,24,26,28,30,33,36,38,40])[least(greatest(p_level,1),10)];
$$;
create function public.server_guild_unlock_level() returns integer language sql immutable set search_path='' as $$ select 7; $$;
create function public.server_guild_products() returns jsonb language sql immutable set search_path='' as $$
  select '[{"productId":"guild-gold","price":20,"weeklyLimit":5},{"productId":"guild-cheesecake","price":20,"weeklyLimit":5},{"productId":"guild-tonic","price":90,"weeklyLimit":2}]'::jsonb;
$$;
create function public.server_guild_role_rank(p_role text) returns integer language sql immutable set search_path='' as $$
  select case p_role when 'leader' then 3 when 'vice' then 2 when 'officer' then 1 else 0 end;
$$;
-- 직위가 할 수 있는 일: approve·kick·notice·promote·badge·joinMode·disband
create function public.server_guild_can(p_role text, p_action text) returns boolean language sql immutable set search_path='' as $$
  select case p_role
    when 'leader' then p_action in ('approve','kick','notice','promote','badge','joinMode','disband')
    when 'vice' then p_action in ('approve','kick','notice')
    when 'officer' then p_action in ('approve','notice')
    else false end;
$$;
create function public.server_guild_ms(p_t timestamptz) returns bigint language sql immutable set search_path='' as $$ select floor(extract(epoch from p_t) * 1000)::bigint; $$;
create function public.server_guild_week(p_t timestamptz) returns text language sql immutable set search_path='' as $$ select (date_trunc('week', p_t at time zone 'UTC'))::date::text; $$;

-- ── 응답 조각 ────────────────────────────────────────────────────────────────
create function public.server_guild_summary(p_guild uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id', g.id, 'name', g.name, 'badge', g.badge,
    'level', public.server_guild_level(g.prosperity), 'memberCount', (select count(*) from public.guild_members where guild_id = g.id),
    'capacity', public.server_guild_capacity(public.server_guild_level(g.prosperity)), 'joinMode', g.join_mode,
    'leaderName', coalesce((select name from public.guild_members where guild_id = g.id and role = 'leader'), ''), 'notice', g.notice)
  from public.guilds g where g.id = p_guild;
$$;
create function public.server_guild_detail(p_guild uuid) returns jsonb language sql stable set search_path='' as $$
  select public.server_guild_summary(g.id) || jsonb_build_object('prosperity', g.prosperity, 'createdAt', public.server_guild_ms(g.created_at),
    'warScore', null, 'warRank', null, 'badgeFree', g.badge_changes = 0)
  from public.guilds g where g.id = p_guild;
$$;
create function public.server_guild_state(p_player uuid, p_t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare m public.guild_members; left_at timestamptz; pending integer := 0; requested jsonb;
begin
  select * into m from public.guild_members where player_id = p_player;
  select l.left_at into left_at from public.guild_left l where l.player_id = p_player;
  if found and m.player_id is not null and public.server_guild_can(m.role, 'approve') then
    select count(*) into pending from public.guild_requests where guild_id = m.guild_id;
  end if;
  select coalesce(jsonb_agg(guild_id), '[]'::jsonb) into requested from public.guild_requests where player_id = p_player;
  return jsonb_build_object(
    'guild', case when m.player_id is null then null else public.server_guild_detail(m.guild_id) end,
    'me', case when m.player_id is null then null else jsonb_build_object('role', m.role, 'coin', m.coin,
      'contributionWeek', case when m.contribution_week_key = public.server_guild_week(p_t) then m.contribution_week else 0 end,
      'contributionTotal', m.contribution_total, 'joinedAt', public.server_guild_ms(m.joined_at)) end,
    'leaveCooldownUntil', case when left_at is null then 0 else greatest(0, public.server_guild_ms(left_at) + 86400000) end,
    'pendingRequests', pending, 'requestedGuildIds', requested, 'serverTime', public.server_guild_ms(p_t));
end $$;
create function public.server_guild_attendance(p_player uuid, p_t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare week_start date := public.server_guild_week(p_t)::date; today date := (p_t at time zone 'UTC')::date; m public.guild_members; stamps jsonb := '[]'::jsonb; c text; i integer;
begin
  select * into m from public.guild_members where player_id = p_player;
  for i in 0..6 loop
    select a.choice into c from public.guild_attendance a where a.player_id = p_player and a.day = week_start + i;
    stamps := stamps || to_jsonb(c);
  end loop;
  return jsonb_build_object('weekKey', public.server_guild_week(p_t), 'stamps', stamps, 'todayIndex', today - week_start,
    'stampedToday', (stamps -> (today - week_start)) <> 'null'::jsonb, 'weekBonusClaimed', m.week_bonus_key = public.server_guild_week(p_t), 'serverTime', public.server_guild_ms(p_t));
end $$;
create function public.server_guild_shop(p_player uuid, p_t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare m public.guild_members; week text := public.server_guild_week(p_t);
begin
  select * into m from public.guild_members where player_id = p_player;
  return jsonb_build_object('coin', m.coin, 'serverTime', public.server_guild_ms(p_t), 'items', (
    select jsonb_agg(p || jsonb_build_object('bought', case when m.purchase_week_key = week then coalesce((m.purchases ->> (p ->> 'productId'))::integer, 0) else 0 end))
    from jsonb_array_elements(public.server_guild_products()) p));
end $$;

-- ── 호출 ─────────────────────────────────────────────────────────────────────
-- 가입·탈퇴·직위처럼 길드 구성원을 바꾸는 조작. 디스패처 `server_guild_call`이 전역 잠금을 잡은 뒤 부른다.
create function public.server_guild_members_call(p_player uuid, p_method text, p_actor jsonb, args jsonb, t timestamptz, week text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  m public.guild_members; g public.guilds; target public.guild_members; out jsonb; data jsonb;
  a_level integer := coalesce((p_actor ->> 'level')::integer, 1); gid uuid; cnt integer; role_in text; pid text;
begin
  select * into m from public.guild_members where player_id = p_player;
  if p_method = 'createGuild' then
    data := args -> 0;
    if a_level < public.server_guild_unlock_level() then perform public.server_guild_fail('LEVEL_LOCKED'); end if;
    if m.player_id is not null then perform public.server_guild_fail('ALREADY_IN_GUILD'); end if;
    if exists(select 1 from public.guild_left where player_id = p_player and left_at + interval '24 hours' > t) then perform public.server_guild_fail('LEAVE_COOLDOWN'); end if;
    if jsonb_typeof(data -> 'name') <> 'string' or char_length(data ->> 'name') not between 2 and 48 or (data ->> 'name') ~ '[[:cntrl:]]' then perform public.server_guild_fail('NAME_INVALID'); end if;
    if jsonb_typeof(data -> 'badge') <> 'object' or data ->> 'joinMode' not in ('open','approval') then perform public.server_guild_fail('INVALID_REQUEST'); end if;
    if exists(select 1 from public.guilds where name_key = data ->> 'nameKey') then perform public.server_guild_fail('NAME_TAKEN'); end if;
    insert into public.guilds(name, name_key, badge, join_mode) values (data ->> 'name', data ->> 'nameKey', data -> 'badge', data ->> 'joinMode') returning * into g;
    insert into public.guild_members(player_id, guild_id, role, name, level, avatar_relic_id, frame_id, contribution_week_key, purchase_week_key)
      values (p_player, g.id, 'leader', coalesce(p_actor ->> 'name', ''), a_level, coalesce(p_actor ->> 'avatarRelicId', ''), coalesce(p_actor ->> 'frameId', ''), week, week);
    delete from public.guild_requests where player_id = p_player;
    return public.server_guild_state(p_player, t);

  elsif p_method = 'joinGuild' then
    gid := (args ->> 0)::uuid;
    if a_level < public.server_guild_unlock_level() then perform public.server_guild_fail('LEVEL_LOCKED'); end if;
    if m.player_id is not null then perform public.server_guild_fail('ALREADY_IN_GUILD'); end if;
    if exists(select 1 from public.guild_left where player_id = p_player and left_at + interval '24 hours' > t) then perform public.server_guild_fail('LEAVE_COOLDOWN'); end if;
    select * into g from public.guilds where id = gid for update;
    if not found then perform public.server_guild_fail('GUILD_NOT_FOUND'); end if;
    select count(*) into cnt from public.guild_members where guild_id = g.id;
    if cnt >= public.server_guild_capacity(public.server_guild_level(g.prosperity)) then perform public.server_guild_fail('GUILD_FULL'); end if;
    if g.join_mode = 'open' then
      insert into public.guild_members(player_id, guild_id, role, name, level, avatar_relic_id, frame_id, contribution_week_key, purchase_week_key)
        values (p_player, g.id, 'member', coalesce(p_actor ->> 'name', ''), a_level, coalesce(p_actor ->> 'avatarRelicId', ''), coalesce(p_actor ->> 'frameId', ''), week, week);
      delete from public.guild_requests where player_id = p_player;
      return jsonb_build_object('status', 'joined');
    end if;
    if exists(select 1 from public.guild_requests where guild_id = g.id and player_id = p_player) then perform public.server_guild_fail('REQUEST_EXISTS'); end if;
    -- 신청이 끝없이 쌓이지 않게 한 사람이 걸어 둘 수 있는 수와 길드가 받을 수 있는 수를 제한한다.
    if (select count(*) from public.guild_requests where player_id = p_player) >= 5 or (select count(*) from public.guild_requests where guild_id = g.id) >= 50 then perform public.server_guild_fail('REQUEST_EXISTS'); end if;
    insert into public.guild_requests(guild_id, player_id, actor) values (g.id, p_player, p_actor);
    return jsonb_build_object('status', 'requested');

  elsif p_method = 'cancelJoinRequest' then
    delete from public.guild_requests where guild_id = (args ->> 0)::uuid and player_id = p_player;
    if not found then perform public.server_guild_fail('REQUEST_NOT_FOUND'); end if;
    return 'null'::jsonb;

  elsif p_method in ('leaveGuild','disbandGuild') then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    select count(*) into cnt from public.guild_members where guild_id = m.guild_id;
    if p_method = 'disbandGuild' and not public.server_guild_can(m.role, 'disband') then perform public.server_guild_fail('NO_PERMISSION'); end if;
    if m.role = 'leader' and cnt > 1 then perform public.server_guild_fail('LEADER_CANNOT_LEAVE'); end if;
    if m.role = 'leader' then delete from public.guilds where id = m.guild_id; else delete from public.guild_members where player_id = p_player; end if;
    insert into public.guild_left(player_id, left_at) values (p_player, t) on conflict (player_id) do update set left_at = excluded.left_at;
    return 'null'::jsonb;

  elsif p_method = 'decideJoinRequest' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    if not public.server_guild_can(m.role, 'approve') then perform public.server_guild_fail('NO_PERMISSION'); end if;
    pid := args ->> 0;
    select actor into data from public.guild_requests where guild_id = m.guild_id and player_id = pid::uuid;
    if not found then perform public.server_guild_fail('REQUEST_NOT_FOUND'); end if;
    delete from public.guild_requests where guild_id = m.guild_id and player_id = pid::uuid;
    if (args ->> 1)::boolean is not true then return 'null'::jsonb; end if;
    if exists(select 1 from public.guild_members where player_id = pid::uuid) then return 'null'::jsonb; end if;
    select * into g from public.guilds where id = m.guild_id;
    select count(*) into cnt from public.guild_members where guild_id = g.id;
    if cnt >= public.server_guild_capacity(public.server_guild_level(g.prosperity)) then perform public.server_guild_fail('GUILD_FULL'); end if;
    insert into public.guild_members(player_id, guild_id, role, name, level, avatar_relic_id, frame_id, contribution_week_key, purchase_week_key)
      values (pid::uuid, g.id, 'member', coalesce(data ->> 'name', ''), coalesce((data ->> 'level')::integer, 1), coalesce(data ->> 'avatarRelicId', ''), coalesce(data ->> 'frameId', ''), week, week);
    return 'null'::jsonb;

  elsif p_method = 'kickMember' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    select * into target from public.guild_members where player_id = (args ->> 0)::uuid and guild_id = m.guild_id;
    if not found then perform public.server_guild_fail('MEMBER_NOT_FOUND'); end if;
    if not (public.server_guild_can(m.role, 'kick') and public.server_guild_role_rank(m.role) > public.server_guild_role_rank(target.role)) then perform public.server_guild_fail('NO_PERMISSION'); end if;
    delete from public.guild_members where player_id = target.player_id;
    insert into public.guild_left(player_id, left_at) values (target.player_id, t) on conflict (player_id) do update set left_at = excluded.left_at;
    return 'null'::jsonb;

  elsif p_method = 'setMemberRole' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    if not public.server_guild_can(m.role, 'promote') then perform public.server_guild_fail('NO_PERMISSION'); end if;
    select * into target from public.guild_members where player_id = (args ->> 0)::uuid and guild_id = m.guild_id;
    if not found then perform public.server_guild_fail('MEMBER_NOT_FOUND'); end if;
    role_in := args ->> 1;
    if target.role = 'leader' or role_in not in ('vice','officer','member') then perform public.server_guild_fail('INVALID_TARGET'); end if;
    if target.role <> role_in then
      select count(*) into cnt from public.guild_members where guild_id = m.guild_id and role = role_in;
      if (role_in = 'vice' and cnt >= 2) or (role_in = 'officer' and cnt >= 5) then perform public.server_guild_fail('ROLE_FULL'); end if;
    end if;
    update public.guild_members set role = role_in where player_id = target.player_id;
    return 'null'::jsonb;

  elsif p_method = 'transferLeader' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    if m.role <> 'leader' then perform public.server_guild_fail('NO_PERMISSION'); end if;
    select * into target from public.guild_members where player_id = (args ->> 0)::uuid and guild_id = m.guild_id;
    if not found or target.player_id = p_player then perform public.server_guild_fail('INVALID_TARGET'); end if;
    update public.guild_members set role = 'vice' where player_id = p_player;
    update public.guild_members set role = 'leader' where player_id = target.player_id;
    return 'null'::jsonb;
  end if;
  return null;
end $$;
revoke all on function public.server_guild_members_call(uuid,text,jsonb,jsonb,timestamptz,text) from public, anon, authenticated;

create function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); week text := public.server_guild_week(now()); today date := (now() at time zone 'UTC')::date;
  m public.guild_members; g public.guilds; cached public.guild_receipts; out jsonb; data jsonb;
  a_level integer := coalesce((p_actor ->> 'level')::integer, 1); product jsonb; bought integer; price integer; limit_n integer;
  stamped integer; complete boolean := false; charged boolean; q text;
begin
  perform public.server_require_active(p_player);
  if p_method not in ('getGuild','searchGuilds','getMembers','joinGuild','cancelJoinRequest','leaveGuild','decideJoinRequest','kickMember','setMemberRole','transferLeader','updateGuild','disbandGuild','getAttendance','getShop','createGuild','changeBadge','stampAttendance','purchase') then
    raise exception 'unknown_method' using errcode='PT400';
  end if;
  if p_method not in ('getGuild','searchGuilds','getMembers','getAttendance','getShop') then
    -- 초기 규모에서는 길드 변경을 전역 직렬화한다(정원·직위 상한·이름 중복이 같은 트랜잭션에서 판정된다).
    perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));
  end if;
  if p_method in ('createGuild','changeBadge','stampAttendance','purchase') then
    if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
    select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
    if found then
      if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
      return cached.response;
    end if;
  end if;

  -- 호출마다 이름·레벨·마지막 접속을 최신으로 맞추고 주가 넘어갔으면 주간 값을 비운다.
  select * into m from public.guild_members where player_id = p_player for update;
  if found then
    update public.guild_members set name = coalesce(p_actor ->> 'name', name), level = a_level, avatar_relic_id = coalesce(p_actor ->> 'avatarRelicId', avatar_relic_id),
      frame_id = coalesce(p_actor ->> 'frameId', frame_id), last_active_at = t,
      contribution_week = case when contribution_week_key = week then contribution_week else 0 end, contribution_week_key = week,
      purchases = case when purchase_week_key = week then purchases else '{}'::jsonb end, purchase_week_key = week
      where player_id = p_player returning * into m;
  end if;

  if p_method = 'getGuild' then return public.server_guild_state(p_player, t);

  elsif p_method = 'searchGuilds' then
    q := coalesce(args ->> 0, '');
    return jsonb_build_object('serverTime', public.server_guild_ms(t), 'guilds', coalesce((
      select jsonb_agg(public.server_guild_summary(s.id) order by s.prosperity desc) from (
        select id, prosperity from public.guilds where q = '' or name_key like '%' || replace(replace(q, '%', ''), '_', '') || '%' order by prosperity desc limit 20) s), '[]'::jsonb));

  elsif p_method = 'getMembers' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return jsonb_build_object('serverTime', public.server_guild_ms(t),
      'members', coalesce((select jsonb_agg(jsonb_build_object('userId', x.player_id, 'name', x.name, 'level', x.level, 'role', x.role, 'avatarRelicId', x.avatar_relic_id, 'frameId', x.frame_id,
        'contributionWeek', case when x.contribution_week_key = week then x.contribution_week else 0 end, 'contributionTotal', x.contribution_total,
        'lastActiveAt', public.server_guild_ms(x.last_active_at), 'isMe', x.player_id = p_player)
        order by public.server_guild_role_rank(x.role) desc, x.contribution_total desc, x.joined_at) from public.guild_members x where x.guild_id = m.guild_id), '[]'::jsonb),
      'requests', case when public.server_guild_can(m.role, 'approve') then coalesce((select jsonb_agg(jsonb_build_object('userId', r.player_id, 'name', r.actor ->> 'name',
        'level', coalesce((r.actor ->> 'level')::integer, 1), 'avatarRelicId', coalesce(r.actor ->> 'avatarRelicId', ''), 'frameId', coalesce(r.actor ->> 'frameId', ''),
        'requestedAt', public.server_guild_ms(r.requested_at)) order by r.requested_at) from public.guild_requests r where r.guild_id = m.guild_id), '[]'::jsonb) else '[]'::jsonb end);

  elsif p_method in ('createGuild','joinGuild','cancelJoinRequest','leaveGuild','disbandGuild','decideJoinRequest','kickMember','setMemberRole','transferLeader') then
    out := public.server_guild_members_call(p_player, p_method, p_actor, args, t, week);
    if p_method <> 'createGuild' then return out; end if;

  elsif p_method = 'updateGuild' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    data := args -> 0;
    if data ? 'notice' then
      if not public.server_guild_can(m.role, 'notice') then perform public.server_guild_fail('NO_PERMISSION'); end if;
      if char_length(data ->> 'notice') > 480 then perform public.server_guild_fail('INVALID_REQUEST'); end if;
      update public.guilds set notice = data ->> 'notice' where id = m.guild_id;
    end if;
    if data ? 'joinMode' then
      if not public.server_guild_can(m.role, 'joinMode') then perform public.server_guild_fail('NO_PERMISSION'); end if;
      if data ->> 'joinMode' not in ('open','approval') then perform public.server_guild_fail('INVALID_REQUEST'); end if;
      update public.guilds set join_mode = data ->> 'joinMode' where id = m.guild_id;
      if data ->> 'joinMode' = 'open' then delete from public.guild_requests where guild_id = m.guild_id; end if;
    end if;
    return 'null'::jsonb;

  elsif p_method = 'changeBadge' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    if not public.server_guild_can(m.role, 'badge') then perform public.server_guild_fail('NO_PERMISSION'); end if;
    select * into g from public.guilds where id = m.guild_id for update;
    if jsonb_typeof(args -> 0) <> 'object' then perform public.server_guild_fail('BADGE_INVALID'); end if;
    if g.badge = args -> 0 then out := jsonb_build_object('changed', false, 'charged', false);
    else
      charged := g.badge_changes > 0;
      update public.guilds set badge = args -> 0, badge_changes = badge_changes + 1 where id = g.id;
      out := jsonb_build_object('changed', true, 'charged', charged);
    end if;

  elsif p_method = 'getAttendance' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return public.server_guild_attendance(p_player, t);

  elsif p_method = 'stampAttendance' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    if args ->> 0 not in ('gold','cheesecake') then perform public.server_guild_fail('INVALID_REQUEST'); end if;
    insert into public.guild_attendance(player_id, day, choice) values (p_player, today, args ->> 0) on conflict do nothing;
    if not found then perform public.server_guild_fail('ALREADY_STAMPED'); end if;
    update public.guilds set prosperity = prosperity + 10 where id = m.guild_id;
    update public.guild_members set contribution_week = contribution_week + 10, contribution_total = contribution_total + 10, coin = coin + 5 where player_id = p_player;
    select count(*) into stamped from public.guild_attendance where player_id = p_player and day >= week::date and day < week::date + 7;
    complete := stamped = 7 and m.week_bonus_key <> week;
    if complete then
      update public.guild_members set week_bonus_key = week, contribution_week = contribution_week + 20, contribution_total = contribution_total + 20, coin = coin + 10 where player_id = p_player;
    end if;
    out := jsonb_build_object('attendance', public.server_guild_attendance(p_player, t), 'weekBonus', complete);

  elsif p_method = 'getShop' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    return public.server_guild_shop(p_player, t);

  elsif p_method = 'purchase' then
    if m.player_id is null then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    select p into product from jsonb_array_elements(public.server_guild_products()) p where p ->> 'productId' = args ->> 0;
    if product is null then perform public.server_guild_fail('PRODUCT_NOT_FOUND'); end if;
    bought := coalesce((m.purchases ->> (args ->> 0))::integer, 0);
    price := (product ->> 'price')::integer; limit_n := (product ->> 'weeklyLimit')::integer;
    if bought >= limit_n then perform public.server_guild_fail('PRODUCT_LIMIT'); end if;
    if m.coin < price then perform public.server_guild_fail('INSUFFICIENT_COINS'); end if;
    update public.guild_members set coin = coin - price, purchases = jsonb_set(purchases, array[args ->> 0], to_jsonb(bought + 1)) where player_id = p_player;
    out := jsonb_build_object('shop', public.server_guild_shop(p_player, t));
  end if;

  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return out;
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;

-- 도우미 함수도 PostgREST로 열리지 않게 한다(서비스 롤만 호출한다).
revoke all on function
  public.server_guild_fail(text), public.server_guild_level(integer), public.server_guild_capacity(integer), public.server_guild_unlock_level(),
  public.server_guild_products(), public.server_guild_role_rank(text), public.server_guild_can(text, text), public.server_guild_ms(timestamptz),
  public.server_guild_week(timestamptz), public.server_guild_summary(uuid), public.server_guild_detail(uuid), public.server_guild_state(uuid, timestamptz),
  public.server_guild_attendance(uuid, timestamptz), public.server_guild_shop(uuid, timestamptz)
  from public, anon, authenticated;
