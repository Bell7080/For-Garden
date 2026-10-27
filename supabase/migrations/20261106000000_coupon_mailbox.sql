-- 쿠폰 보상을 우편함으로 보내고, 홈페이지 쿠폰 페이지가 게임 계정으로 쿠폰을 쓸 수 있게 한다.
--
-- 1) 보상 지급 경로를 바로잡는다. 예전 `redeem_coupon`은 `grant_rewards`로 `player_assets`에 넣었는데,
--    ops_bridge 이후 게임 지갑은 `player_saves`가 갖고 운영 지급은 수신함(`server_ops_inbox`)만 읽는다 —
--    쿠폰을 써도 보상이 게임에 닿지 않았다. 이제 그 계정만 받는 대상 우편 한 통을 만든다.
-- 2) 홈페이지 연동: 게임이 짧게 사는 티켓을 발급하고(`create_coupon_ticket`) 홈페이지 주소에 실어 연다.
--    홈페이지 서버(service_role)가 그 티켓으로 UID·닉네임을 보여 주고 같은 쿠폰 규칙으로 처리한다.
--    UID만 받는 방식은 두지 않는다 — 남의 UID로 한정 코드를 소진시키거나 계정을 바꿔 가며 대입할 수 있다.
begin;

create table if not exists public.coupon_web_tickets (
  token_hash text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
create index if not exists coupon_web_tickets_player_idx on public.coupon_web_tickets(player_id, created_at desc);
alter table public.coupon_web_tickets enable row level security;
-- 정책을 두지 않는다: 플레이어도 운영 화면도 행을 직접 읽지 않고 아래 함수만 지난다.

-- 쿠폰 규칙 한 벌. 게임(로그인 세션)과 홈페이지(티켓)가 같은 함수를 지난다.
create or replace function private.redeem_coupon_for(p_player uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare p public.players; norm text; cd public.coupon_codes; cp public.coupons; fails int;
begin
  select * into p from public.players where id = p_player for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;
  if p.status = 'deleted' or private.is_restricted(p) then return jsonb_build_object('ok', false, 'error', 'account_restricted'); end if;
  select count(*) into fails from public.coupon_attempts where player_id = p_player and not ok and at > now() - interval '10 minutes';
  if fails >= 5 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(norm) not between 4 and 32 then return private.coupon_fail(p_player, 'invalid_code', true); end if;
  select * into cd from public.coupon_codes where code_hash = encode(extensions.digest(norm, 'sha256'), 'hex');
  if not found then return private.coupon_fail(p_player, 'invalid_code', true); end if;
  select * into cp from public.coupons where id = cd.coupon_id for update;
  if cp.status <> 'active' or cp.deleted_at is not null or now() < cp.starts_at or (cp.ends_at is not null and now() >= cp.ends_at) then
    return private.coupon_fail(p_player, 'unavailable', true);
  end if;
  if exists (select 1 from public.coupon_redemptions where coupon_id = cp.id and player_id = p_player) then return private.coupon_fail(p_player, 'already_redeemed', false); end if;
  if cp.kind = 'single' and cd.redeemed_by is not null then return private.coupon_fail(p_player, 'already_used', true); end if;
  if cp.max_redemptions is not null and cp.redeemed_count >= cp.max_redemptions then return private.coupon_fail(p_player, 'exhausted', false); end if;
  if cp.kind = 'single' then
    update public.coupon_codes set redeemed_by = p_player, redeemed_at = now() where id = cd.id;
  end if;
  insert into public.coupon_redemptions(coupon_id, player_id, code_id) values (cp.id, p_player, cd.id);
  update public.coupons set redeemed_count = redeemed_count + 1 where id = cp.id;
  if jsonb_array_length(coalesce(cp.rewards, '[]'::jsonb)) > 0 then
    insert into public.mails(title, body, rewards, target_player, expires_at)
    values (left('쿠폰 보상 · ' || cp.name, 80), left('쿠폰 「' || cp.name || '」 보상이 도착했습니다.', 2000), cp.rewards, p_player, now() + interval '30 days');
  end if;
  insert into public.coupon_attempts(player_id, ok) values (p_player, true);
  return jsonb_build_object('ok', true, 'rewards', cp.rewards, 'name', cp.name);
end $fn$;

create or replace function public.redeem_coupon(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return private.redeem_coupon_for(me, p_code);
end $fn$;

-- 게임이 홈페이지 쿠폰 페이지를 열 때 쓰는 일회성 연결 티켓. 원문은 응답에만 실리고 DB에는 해시만 남는다.
create or replace function public.create_coupon_ticket()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare me uuid := (select auth.uid()); p public.players; token text; until timestamptz := now() + interval '15 minutes';
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.players where id = me;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;
  if p.status = 'deleted' or private.is_restricted(p) then return jsonb_build_object('ok', false, 'error', 'account_restricted'); end if;
  delete from public.coupon_web_tickets where player_id = me
    and (expires_at <= now() or token_hash in (select token_hash from public.coupon_web_tickets where player_id = me order by created_at desc offset 4));
  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.coupon_web_tickets(token_hash, player_id, expires_at) values (encode(extensions.digest(token, 'sha256'), 'hex'), me, until);
  return jsonb_build_object('ok', true, 'ticket', token, 'expires_at', until);
end $fn$;

create or replace function private.coupon_ticket_player(p_ticket text)
returns uuid language plpgsql stable security definer set search_path = '' as $fn$
begin
  return (select t.player_id from public.coupon_web_tickets t
    where t.token_hash = encode(extensions.digest(coalesce(p_ticket, ''), 'sha256'), 'hex') and t.expires_at > now());
end $fn$;

-- 홈페이지 서버 전용: 티켓이 가리키는 계정의 UID·닉네임(확인용 표시).
create or replace function public.server_coupon_ticket_info(p_ticket text)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare who uuid := private.coupon_ticket_player(p_ticket); p public.players;
begin
  if who is null then return jsonb_build_object('ok', false, 'error', 'invalid_ticket'); end if;
  select * into p from public.players where id = who;
  if not found or p.status = 'deleted' then return jsonb_build_object('ok', false, 'error', 'invalid_ticket'); end if;
  return jsonb_build_object('ok', true, 'uid', p.uid::text, 'nickname', p.nickname,
    'expires_at', (select expires_at from public.coupon_web_tickets where player_id = who and token_hash = encode(extensions.digest(p_ticket, 'sha256'), 'hex')));
end $fn$;

-- 홈페이지 서버 전용: 티켓의 계정으로 쿠폰을 쓴다. 티켓은 만료까지 여러 코드에 쓸 수 있다(실패 제한은 계정 단위 그대로).
create or replace function public.server_redeem_coupon_ticket(p_ticket text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare who uuid := private.coupon_ticket_player(p_ticket);
begin
  if who is null then return jsonb_build_object('ok', false, 'error', 'invalid_ticket'); end if;
  return private.redeem_coupon_for(who, p_code);
end $fn$;

revoke all on function private.redeem_coupon_for(uuid, text), private.coupon_ticket_player(text) from public, anon, authenticated;
revoke all on function public.redeem_coupon(text), public.create_coupon_ticket() from public, anon;
grant execute on function public.redeem_coupon(text), public.create_coupon_ticket() to authenticated;
revoke all on function public.server_coupon_ticket_info(text), public.server_redeem_coupon_ticket(text, text) from public, anon, authenticated;
grant execute on function public.server_coupon_ticket_info(text), public.server_redeem_coupon_ticket(text, text) to service_role;

commit;
