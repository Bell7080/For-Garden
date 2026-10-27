-- 길드 출석을 「한 주 일곱 칸 + 고르는 보상」에서 「일곱 칸 순환」으로 바꾸고, 길드원이 서로 보는 공개 카드를 더한다.
-- 규칙의 원본은 src/core/guild.ts의 GUILD_ATTENDANCE_CYCLE·guildAttendanceView이고, 길드 쪽 몫(부흥도·기여도·코인)을
-- 아래 표가 옮겨 적는다(tests/unit/guildSql.test.ts가 대조한다). 지갑에 드는 몫은 칸 번호를 받은 게임 서버가 정한다.
-- 빠진 날이 있어도 처음으로 돌아가지 않고, 7일차를 찍은 다음 날 1일차로 돌아간다.

alter table public.guild_members
  add column attendance_count smallint not null default 0 check (attendance_count between 0 and 7),
  add column attendance_last date,
  add column card jsonb;
alter table public.guild_attendance alter column choice drop not null;
alter table public.guild_attendance drop constraint if exists guild_attendance_choice_check;
alter table public.guild_attendance add column cycle_day smallint check (cycle_day between 1 and 7);

create or replace function public.server_guild_attendance_cycle() returns jsonb language sql immutable set search_path='' as $$
  select '[{"prosperity":10,"contribution":10,"coin":5},{"prosperity":10,"contribution":10,"coin":5},{"prosperity":10,"contribution":10,"coin":5},{"prosperity":10,"contribution":10,"coin":5},{"prosperity":10,"contribution":10,"coin":5},{"prosperity":10,"contribution":10,"coin":5},{"prosperity":20,"contribution":30,"coin":15}]'::jsonb;
$$;

create or replace function public.server_guild_attendance(p_player uuid, p_t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare today date := (p_t at time zone 'UTC')::date; m public.guild_members; done integer; base integer;
begin
  select * into m from public.guild_members where player_id = p_player;
  done := least(7, greatest(0, coalesce(m.attendance_count, 0)));
  if m.attendance_last = today and done > 0 then
    return jsonb_build_object('filled', done, 'day', done, 'stampedToday', true, 'serverTime', public.server_guild_ms(p_t));
  end if;
  base := case when done >= 7 then 0 else done end;
  return jsonb_build_object('filled', base, 'day', base + 1, 'stampedToday', false, 'serverTime', public.server_guild_ms(p_t));
end $$;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); week text := public.server_guild_week(now()); today date := (now() at time zone 'UTC')::date;
  m public.guild_members; g public.guilds; cached public.guild_receipts; out jsonb; data jsonb;
  a_level integer := coalesce((p_actor ->> 'level')::integer, 1); product jsonb; bought integer; price integer; limit_n integer;
  stamped integer; charged boolean; q text;
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
      card = case when jsonb_typeof(p_actor -> 'card') = 'object' and pg_column_size(p_actor -> 'card') < 2048 then p_actor -> 'card' else card end,
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
        'lastActiveAt', public.server_guild_ms(x.last_active_at), 'isMe', x.player_id = p_player, 'card', x.card)
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
    data := public.server_guild_attendance(p_player, t);
    if (data ->> 'stampedToday')::boolean then perform public.server_guild_fail('ALREADY_STAMPED'); end if;
    stamped := (data ->> 'day')::integer;
    product := public.server_guild_attendance_cycle() -> (stamped - 1);
    update public.guilds set prosperity = prosperity + (product ->> 'prosperity')::integer where id = m.guild_id;
    update public.guild_members set attendance_count = stamped, attendance_last = today,
      contribution_week = contribution_week + (product ->> 'contribution')::integer, contribution_total = contribution_total + (product ->> 'contribution')::integer,
      coin = coin + (product ->> 'coin')::integer where player_id = p_player;
    insert into public.guild_attendance(player_id, day, cycle_day) values (p_player, today, stamped) on conflict do nothing;
    out := jsonb_build_object('attendance', public.server_guild_attendance(p_player, t), 'day', stamped);

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

alter table public.guild_members drop column week_bonus_key;

revoke all on function public.server_guild_attendance_cycle(), public.server_guild_attendance(uuid, timestamptz) from public, anon, authenticated;
