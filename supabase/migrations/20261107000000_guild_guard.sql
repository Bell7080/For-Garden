-- 길드 수호전(2단계) — 길드원 행에 오늘(UTC 날짜 번호)의 최고 점수를 남기고, 길드 안·길드 순위 판을 내준다.
-- 규칙의 원본은 `src/core/guildGuard.ts`·`src/api/FakeGuildServer.ts`(getGuard·recordGuard)다.
-- 점수는 게임 서버가 입장 때 굳힌 편성·시드로 다시 굴려 확정한 값만 들어온다(`submitGuildGuard`) — 이 함수는 받은 값을 검증·기록만 한다.
-- 새 표를 만들지 않는다(기존 `guild_members`에 열만 더한다) — 출시 전 초기화 분류는 그 표를 따른다.

alter table public.guild_members
  add column guard_day integer not null default -1,
  add column guard_best integer not null default 0 check (guard_best >= 0),
  add column guard_at timestamptz;

-- 기존 디스패처를 그대로 두고 앞에 수호전 두 조작만 받는 문을 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_base;
revoke all on function public.server_guild_call_base(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_base(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_guard_day(p_t timestamptz) returns integer language sql immutable set search_path='' as $$
  select floor(extract(epoch from p_t) / 86400)::integer;
$$;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); v_day integer := public.server_guild_guard_day(now());
  m public.guild_members; cached public.guild_receipts; data jsonb; out jsonb; v_score integer; v_coin integer; rec_day integer;
begin
  if p_method not in ('getGuard','recordGuard') then
    return public.server_guild_call_base(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);

  if p_method = 'getGuard' then
    select * into m from public.guild_members where player_id = p_player;
    if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
    with ranked as (
      select g.id, g.name, g.badge, public.server_guild_level(g.prosperity) as level,
        coalesce((select sum(x.guard_best) from public.guild_members x where x.guild_id = g.id and x.guard_day = v_day), 0)::integer as score
      from public.guilds g
    ), ordered as (
      select r.*, row_number() over (order by r.score desc, r.name) as rank from ranked r
    )
    select jsonb_build_object(
      'day', v_day, 'serverTime', public.server_guild_ms(t),
      'members', coalesce((select jsonb_agg(jsonb_build_object('rank', y.rank, 'userId', y.player_id, 'name', y.name, 'level', y.level,
          'avatarRelicId', y.avatar_relic_id, 'frameId', y.frame_id, 'score', y.score, 'isMe', y.player_id = p_player) order by y.rank)
        from (select x.*, case when x.guard_day = v_day then x.guard_best else 0 end as score,
            row_number() over (order by case when x.guard_day = v_day then x.guard_best else 0 end desc,
              case when x.guard_day = v_day then x.guard_at end asc nulls last, x.name) as rank
          from public.guild_members x where x.guild_id = m.guild_id) y), '[]'::jsonb),
      'guilds', coalesce((select jsonb_agg(jsonb_build_object('rank', o.rank, 'id', o.id, 'name', o.name, 'badge', o.badge, 'level', o.level,
          'score', o.score, 'isMine', o.id = m.guild_id) order by o.rank) from ordered o where o.rank <= 50), '[]'::jsonb),
      'mine', (select jsonb_build_object('rank', o.rank, 'id', o.id, 'name', o.name, 'badge', o.badge, 'level', o.level, 'score', o.score, 'isMine', true)
        from ordered o where o.id = m.guild_id))
    into out;
    return out;
  end if;

  -- recordGuard — 게임 서버가 다시 굴려 확정한 한 판. 같은 영수증은 같은 답을 돌려준다.
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));
  if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
  select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
  if found then
    if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
    return cached.response;
  end if;
  select * into m from public.guild_members where player_id = p_player for update;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
  data := args -> 0;
  if jsonb_typeof(data) <> 'object' or jsonb_typeof(data -> 'day') <> 'number' or jsonb_typeof(data -> 'score') <> 'number' or jsonb_typeof(data -> 'coin') <> 'number' then
    perform public.server_guild_fail('INVALID_REQUEST');
  end if;
  rec_day := (data ->> 'day')::integer; v_score := (data ->> 'score')::integer; v_coin := (data ->> 'coin')::integer;
  -- 한 판 코인은 5~20(`GUILD_GUARD_COIN`), 날짜는 오늘 또는 자정을 막 넘긴 어제 판만 받는다.
  if v_score < 0 or v_score > 10000000 or v_coin < 0 or v_coin > 20 or rec_day not in (v_day, v_day - 1) then perform public.server_guild_fail('INVALID_REQUEST'); end if;
  if m.guard_day <> rec_day then
    m.guard_day := rec_day; m.guard_best := 0; m.guard_at := null;
  end if;
  if v_score > m.guard_best or m.guard_at is null then
    m.guard_best := greatest(m.guard_best, v_score); m.guard_at := t;
  end if;
  update public.guild_members set guard_day = m.guard_day, guard_best = m.guard_best, guard_at = m.guard_at, coin = coin + v_coin
    where player_id = p_player returning * into m;
  out := jsonb_build_object('best', m.guard_best, 'coin', m.coin);
  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return out;
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_guard_day(timestamptz) from public, anon, authenticated;
