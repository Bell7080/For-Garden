-- 유령 게스트 계정 정리(v0.457.0).
-- 게스트(익명) 계정은 기기에 든 토큰이 유일한 열쇠라, 로그아웃(계정 변경)으로 토큰을 버리면 다시 들어갈 길이 없다.
-- 그런데 서버에는 계정이 그대로 남아 친구 추천·검색에 이름 없는 Lv.1로 계속 떴다. 리세마라가 늘면 이런 계정이 쌓인다.
--
-- 이 마이그레이션은
--  ① 게스트가 로그아웃하는 순간 클라이언트가 부르는 `abandon_guest_account` — 곧바로 'deleted'로 감추고(친구·랭킹·검색은
--     모두 status='active'만 읽는다) 계정 삭제 요청 표에 하루 유예로 올린다. 실제 삭제는 이미 도는 pg_cron 작업
--     `purge-deleted-accounts`(purge_deleted_accounts)가 한다. 결제 기록이 있는 게스트는 감추기만 하고 지우지 않는다.
--  ② 토큰을 버린 줄 서버가 모르는 게스트(앱 삭제·브라우저 데이터 삭제)를 위한 `purge_inactive_guests` — 서비스 역할 전용,
--     기본은 미리보기(dry run)이고 예약하지 않는다. 기준 일수는 운영자가 승인한 뒤 손으로 부르거나 예약한다.
--  ③ 길드장이 계정째 지워지면 길드가 주인 없이 남던 구멍 — players 삭제 직전에 후계에게 넘기고, 남은 사람이 없으면 길드를 지운다.
--  ④ 친구 추천은 최근 14일 안에 접속한 계정만 고른다(업계 관행 — 추천은 지금 노는 사람끼리).
--
-- 적용 순서: 20261125000000_device_sessions.sql 다음. 운영 DB에는 아직 적용하지 않았다.

-- ① 게스트 로그아웃 = 계정 포기 ────────────────────────────────────────────────
create or replace function public.abandon_guest_account()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare me uuid := (select auth.uid()); anon boolean; paid boolean;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select is_anonymous into anon from auth.users where id = me;
  -- 연동된 계정은 로그아웃해도 다시 들어올 수 있으니 절대 건드리지 않는다. 판정은 클라이언트가 아니라 auth.users가 한다.
  if anon is not true then return jsonb_build_object('ok', false, 'error', 'not_guest'); end if;
  if exists (select 1 from public.admin_roles where user_id = me) then return jsonb_build_object('ok', false, 'error', 'staff'); end if;
  update public.players set status = 'deleted', deleted_at = now(), deleted_reason = 'guest_logout'
    where id = me and status <> 'deleted';
  paid := exists (select 1 from public.purchase_records where player_id = me);
  if not paid then
    insert into public.account_deletion_requests(user_id, requested_at, purge_after, cancelled_at)
    values (me, now(), now() + interval '1 day', null)
    on conflict (user_id) do update set requested_at = now(), purge_after = least(public.account_deletion_requests.purge_after, now() + interval '1 day'), cancelled_at = null;
  end if;
  return jsonb_build_object('ok', true, 'purge', not paid);
end $fn$;

revoke all on function public.abandon_guest_account() from public, anon;
grant execute on function public.abandon_guest_account() to authenticated;

-- ② 오래 안 들어온 게스트 ─────────────────────────────────────────────────────
-- 보호 조건: 연동 계정·운영진·결제 기록이 있는 계정은 대상이 아니다. 마지막 활동은 가입·로그인·서버 저장 중 가장 늦은 것.
create or replace function public.inactive_guest_candidates(p_days integer)
returns table(user_id uuid, uid bigint, nickname text, level integer, last_active timestamptz)
language sql stable security definer set search_path = '' as $fn$
  select u.id, p.uid, p.nickname, p.level, greatest(u.created_at, u.last_sign_in_at, p.last_seen_at)
  from auth.users u left join public.players p on p.id = u.id
  where u.is_anonymous is true
    and greatest(u.created_at, u.last_sign_in_at, p.last_seen_at) < now() - make_interval(days => p_days)
    and not exists (select 1 from public.admin_roles a where a.user_id = u.id)
    and not exists (select 1 from public.purchase_records r where r.player_id = u.id)
$fn$;

-- p_dry_run이 기본 true라 실수로 불러도 지우지 않는다. 30일보다 짧은 기준은 받지 않는다.
create or replace function public.purge_inactive_guests(p_days integer default 180, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare n integer; uids jsonb;
begin
  if p_days is null or p_days < 30 then raise exception 'days_too_short'; end if;
  select count(*), coalesce(jsonb_agg(c.uid order by c.last_active), '[]'::jsonb) into n, uids from public.inactive_guest_candidates(p_days) c;
  if not p_dry_run then
    delete from auth.users u using public.inactive_guest_candidates(p_days) c where u.id = c.user_id;
  end if;
  return jsonb_build_object('dryRun', p_dry_run, 'days', p_days, 'count', n, 'uids', uids);
end $fn$;

revoke all on function public.inactive_guest_candidates(integer), public.purge_inactive_guests(integer, boolean) from public, anon, authenticated;
grant execute on function public.inactive_guest_candidates(integer), public.purge_inactive_guests(integer, boolean) to service_role;

-- ③ 계정이 지워질 때 길드장 자리 넘기기 ────────────────────────────────────────
-- auth.users 삭제가 players로 이어지는 순간(외래키 연쇄) 먼저 돈다. 후계 순서는 자동 위임(guild_leader_succession)과 같고,
-- 임원이 없으면 길드원까지 내려간다 — 주인이 지워졌으니 아무도 없는 것보다 낫다.
create or replace function private.players_release_guild()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare g uuid; heir uuid;
begin
  select guild_id into g from public.guild_members where player_id = old.id and role = 'leader';
  if g is null then return old; end if;
  perform 1 from public.guilds where id = g for update;
  select player_id into heir from public.guild_members
    where guild_id = g and player_id <> old.id
    order by case role when 'vice' then 3 when 'officer' then 2 else 1 end desc, contribution_total desc, joined_at asc, player_id::text asc
    limit 1;
  if heir is null then
    delete from public.guilds where id = g;
  else
    update public.guild_members set role = 'member' where player_id = old.id;
    update public.guild_members set role = 'leader' where player_id = heir;
  end if;
  return old;
end $fn$;

drop trigger if exists players_release_guild on public.players;
create trigger players_release_guild before delete on public.players for each row execute function private.players_release_guild();

-- ④ 친구 추천은 최근 14일 안에 접속한 계정만 ────────────────────────────────────
-- server_social_call(10KB)을 통째로 옮겨 적지 않고 추천 조건 한 줄만 바꾼다. 원문이 바뀌어 그 줄을 찾지 못하면 멈춘다.
do $patch$
declare src text; old_cond text := $q$p_method='getRecommendations' and e.a is null$q$;
  new_cond text := $q$p_method='getRecommendations' and e.a is null and u.last_seen_at > t - interval '14 days'$q$;
begin
  src := pg_get_functiondef('public.server_social_call(uuid,text,jsonb,text)'::regprocedure);
  if position(new_cond in src) > 0 then return; end if;
  if position(old_cond in src) = 0 then raise exception 'server_social_call: 추천 조건을 찾지 못했습니다'; end if;
  execute replace(src, old_cond, new_cond);
end $patch$;
