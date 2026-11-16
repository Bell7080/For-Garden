-- 선물하기(친구에게 결제한 상품을 보내기)의 DB 쪽. 규칙은 `src/core/gifting.ts`가 갖고, 여기서는 주문 표와
-- 두 계정 사이의 불변식만 지킨다. 게임 쪽 스위치(`GIFTING_ENABLED`)가 꺼져 있는 동안은 아무도 이 표를 쓰지 않는다.
--
-- 설계(`docs/gift-system.md` · 결정 D1~D7):
--  · 주문은 두 계정 사이에 걸리므로 저장(player_saves)이 아니라 `gift_orders`가 갖는다.
--  · 게임 호출은 「맥락을 읽고(server_gift_context) → 규칙을 돌리고 → 상태와 주문 변경을 server_commit_state 한 트랜잭션으로 확정」한다.
--    주문 변경은 p_summary의 `_gifts`로 오고, 기대 상태가 DB와 다르면 PT409(저장 충돌)로 거절해 다시 시도하게 한다.
--  · 받는 사람의 지급은 받는 사람이 직접 부른 acceptGift가 **자기 저장**에 한다 — 다른 계정의 저장을 고치지 않는다.
--  · 스토어 환불은 server_apply_store_refund 한 함수로만 들어온다. 받는 쪽은 절대 회수하지 않고(음수 재화 금지),
--    받은 뒤 환불이면 보낸 사람에게 채무·선물 차단·결제 보류를 세운다.

-- ───────── 친구가 된 시각 ─────────
-- 친구 14일 조건을 재려면 수락 시각이 필요하다. 이미 친구인 줄은 이 마이그레이션 시각으로 채운다(오래된 친구로 셈해 주지 않는다).
alter table public.server_friend_edges add column if not exists friend_since timestamptz;
update public.server_friend_edges set friend_since = now() where status = 'friend' and friend_since is null;

create or replace function private.stamp_friend_since()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'friend' and (tg_op = 'INSERT' or old.status is distinct from 'friend') then new.friend_since := now(); end if;
  if new.status <> 'friend' then new.friend_since := null; end if;
  return new;
end $$;
drop trigger if exists stamp_friend_since on public.server_friend_edges;
create trigger stamp_friend_since before insert or update of status on public.server_friend_edges
  for each row execute function private.stamp_friend_since();

-- ───────── 주문 ─────────
create table if not exists public.gift_orders (
  id text primary key check (length(id) between 1 and 80),
  sender_id uuid not null references public.players(id) on delete cascade,
  recipient_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('awaiting_payment','pending','accepted','returned','revoked','lapsed')),
  transaction_id text unique,
  price_krw integer not null check (price_krw > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 규칙 모듈의 GiftOrder 그대로(이름·시각·반환 사유). 위 열은 찾고 지키는 데 쓰는 사본이다.
  data jsonb not null,
  check (sender_id <> recipient_id)
);
create index if not exists gift_orders_sender on public.gift_orders (sender_id, created_at desc);
create index if not exists gift_orders_recipient on public.gift_orders (recipient_id, created_at desc);
alter table public.gift_orders enable row level security;
revoke all on public.gift_orders from public, anon, authenticated;

-- ───────── 보낸 사람의 제한 ─────────
-- 받은 뒤 환불이 오면 서는 채무·차단·결제 보류. 푸는 것은 운영 도구(어드민)만 한다.
create table if not exists public.gift_sender_flags (
  player_id uuid primary key references public.players(id) on delete cascade,
  blocked boolean not null default false,
  payment_hold boolean not null default false,
  debt_krw integer not null default 0 check (debt_krw >= 0),
  reason text check (reason is null or length(reason) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.gift_sender_flags enable row level security;
revoke all on public.gift_sender_flags from public, anon, authenticated;

-- ───────── 스토어 환불 수신 ─────────
-- 스토어(Google 무효 구매 · Apple 환불 알림)가 보낸 사건을 한 번씩만 반영한다. 키는 스토어의 사건 id다.
create table if not exists public.store_refund_events (
  event_id text primary key check (length(event_id) between 1 and 200),
  platform text not null check (platform in ('google','apple','test')),
  transaction_id text not null,
  refunded_at timestamptz not null,
  received_at timestamptz not null default now(),
  outcome jsonb not null default '{}'::jsonb
);
create index if not exists store_refund_events_tx on public.store_refund_events (transaction_id);
alter table public.store_refund_events enable row level security;
revoke all on public.store_refund_events from public, anon, authenticated;

-- ───────── 게임 호출의 맥락 ─────────
create or replace function public.server_gift_context(p_player uuid, p_recipient uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sender jsonb; recipients jsonb := '{}'::jsonb; orders jsonb; flags public.gift_sender_flags;
begin
  perform public.server_require_active(p_player);
  select * into flags from public.gift_sender_flags where player_id = p_player;
  sender := jsonb_build_object(
    'guest', coalesce((select is_anonymous from auth.users where id = p_player), true),
    -- 연령 정보는 아직 받지 않는다. 받게 되면 이 자리를 채운다.
    'ageRestricted', false,
    'blocked', coalesce(flags.blocked or flags.payment_hold, false),
    -- 본인 결제: 선물로 쓴 거래를 빼고, 환불되지 않은 가장 오래된 지급 시각.
    'oldestClearedOwnPaymentAt', (select min(r.recorded_at) from public.purchase_records r
      where r.player_id = p_player and r.refunded_at is null
        and not exists (select 1 from public.gift_orders g where g.transaction_id = r.transaction_id)),
    'lastOwnRefundAt', (select max(r.refunded_at) from public.purchase_records r where r.player_id = p_player)
  );
  if p_recipient is not null and p_recipient <> p_player then
    select jsonb_build_object(p_recipient::text, jsonb_build_object(
      'id', p_recipient::text,
      'name', coalesce(p.nickname, p.uid::text),
      'friendSince', e.friend_since,
      'active', p.status = 'active',
      'guest', coalesce(u.is_anonymous, true)))
    into recipients
    from public.players p
    left join auth.users u on u.id = p.id
    left join public.server_friend_edges e
      on e.a = least(p_player, p_recipient) and e.b = greatest(p_player, p_recipient) and e.status = 'friend'
    where p.id = p_recipient;
  end if;
  -- 내가 보내거나 받은 주문, 그리고 받는 쪽 한도를 재는 데 필요한 그 친구의 받은 주문(지난 31일 + 아직 열린 것).
  select coalesce(jsonb_agg(g.data order by g.created_at), '[]'::jsonb) into orders
  from public.gift_orders g
  where (g.sender_id = p_player or g.recipient_id = p_player or (p_recipient is not null and g.recipient_id = p_recipient))
    and (g.created_at > p_now - interval '31 days' or g.status in ('awaiting_payment','pending'));
  return jsonb_build_object('playerId', p_player::text, 'sender', sender, 'recipients', coalesce(recipients, '{}'::jsonb), 'orders', orders);
end $$;

-- ───────── 상태 확정에 주문 변경을 싣는 껍데기 ─────────
do $do$
begin
  if to_regprocedure('public.server_commit_state_before_gifts(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb)') is null then
    alter function public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) rename to server_commit_state_before_gifts;
  end if;
end $do$;

create or replace function public.server_commit_state(p_player uuid, p_expected_revision bigint, p_data jsonb,
  p_hash text, p_version integer, p_summary jsonb, p_method text, p_request text, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare change jsonb; o jsonb; expected text; touched integer;
begin
  for change in select value from jsonb_array_elements(coalesce(p_summary->'_gifts', '[]'::jsonb)) loop
    o := change->'order';
    expected := change->>'expectedStatus';
    -- 주문은 그 주문의 보낸 사람이나 받는 사람의 호출만 바꾼다.
    if (o->>'senderId')::uuid <> p_player and (o->>'recipientId')::uuid <> p_player then
      raise exception 'gift_forbidden' using errcode = 'PT403';
    end if;
    if expected is null then
      -- 새 주문은 보낸 사람만 연다.
      if (o->>'senderId')::uuid <> p_player then raise exception 'gift_forbidden' using errcode = 'PT403'; end if;
      insert into public.gift_orders(id, sender_id, recipient_id, status, transaction_id, price_krw, created_at, data)
      values (o->>'id', (o->>'senderId')::uuid, (o->>'recipientId')::uuid, o->>'status', o->>'transactionId',
              (o->>'priceKrw')::integer, (o->>'createdAt')::timestamptz, o)
      on conflict (id) do nothing;
      get diagnostics touched = row_count;
    else
      -- 누가 어떤 전이를 할 수 있는지는 규칙(`transitionGift`)과 같다: 결제·취소는 보낸 사람, 받기·거절은 받는 사람.
      -- 기한이 지나 사라지거나 돌아오는 정리(lapsed · returned/expired)는 어느 쪽 호출이든 한다.
      if (o->>'status' = 'pending' or (o->>'status' = 'returned' and o->>'returnReason' = 'cancelled'))
         and (o->>'senderId')::uuid <> p_player then
        raise exception 'gift_forbidden' using errcode = 'PT403';
      end if;
      if (o->>'status' = 'accepted' or (o->>'status' = 'returned' and o->>'returnReason' = 'declined'))
         and (o->>'recipientId')::uuid <> p_player then
        raise exception 'gift_forbidden' using errcode = 'PT403';
      end if;
      if o->>'status' not in ('pending','accepted','returned','lapsed') then raise exception 'gift_invalid_transition'; end if;
      update public.gift_orders
         set status = o->>'status', transaction_id = coalesce(transaction_id, o->>'transactionId'), data = o, updated_at = now()
       where id = o->>'id' and status = expected
         and sender_id = (o->>'senderId')::uuid and recipient_id = (o->>'recipientId')::uuid
         and (transaction_id is null or transaction_id = o->>'transactionId');
      get diagnostics touched = row_count;
    end if;
    if touched = 0 then raise exception 'gift_conflict' using errcode = 'PT409'; end if;
  end loop;
  return public.server_commit_state_before_gifts(p_player, p_expected_revision, p_data, p_hash, p_version, p_summary - '_gifts', p_method, p_request, p_response);
end $$;

-- ───────── 스토어 환불 ─────────
-- 규칙은 `giftRefundOutcome`과 같다: 결제 대기 → 소멸, 수령 대기 → 회수(아무도 벌하지 않는다),
-- 받음 → 보낸 사람 채무·차단·결제 보류(받는 쪽은 그대로), 반환됨 → 환불 시각만. 같은 사건은 한 번만 반영한다.
create or replace function public.server_apply_store_refund(p_event_id text, p_platform text, p_transaction text, p_refunded_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.gift_orders; result_json jsonb; next_data jsonb;
begin
  insert into public.store_refund_events(event_id, platform, transaction_id, refunded_at)
  values (p_event_id, p_platform, p_transaction, p_refunded_at)
  on conflict (event_id) do nothing;
  if not found then
    return (select e.outcome || jsonb_build_object('replayed', true) from public.store_refund_events e where e.event_id = p_event_id);
  end if;
  select * into g from public.gift_orders where transaction_id = p_transaction for update;
  if not found then
    -- 선물이 아닌 본인 결제 — 회수는 운영 도구의 환불 처리가 맡는다. 여기서는 환불 시각만 남긴다.
    update public.purchase_records set refunded_at = coalesce(refunded_at, p_refunded_at) where transaction_id = p_transaction;
    result_json := jsonb_build_object('kind', 'purchase');
  elsif g.status = 'pending' then
    next_data := g.data || jsonb_build_object('status', 'revoked', 'resolvedAt', p_refunded_at, 'refundedAt', p_refunded_at);
    update public.gift_orders set status = 'revoked', data = next_data, updated_at = now() where id = g.id;
    result_json := jsonb_build_object('kind', 'gift', 'orderId', g.id, 'result', 'revoked');
  elsif g.status = 'accepted' and (g.data->>'refundedAt') is null then
    update public.gift_orders set data = g.data || jsonb_build_object('refundedAt', p_refunded_at), updated_at = now() where id = g.id;
    insert into public.gift_sender_flags(player_id, blocked, payment_hold, debt_krw, reason, updated_at)
    values (g.sender_id, true, true, g.price_krw, 'refund_after_accept:' || g.id, now())
    on conflict (player_id) do update set blocked = true, payment_hold = true,
      debt_krw = public.gift_sender_flags.debt_krw + excluded.debt_krw, reason = excluded.reason, updated_at = now();
    result_json := jsonb_build_object('kind', 'gift', 'orderId', g.id, 'result', 'sender_debt', 'debtKrw', g.price_krw);
  elsif g.status = 'awaiting_payment' then
    next_data := g.data || jsonb_build_object('status', 'lapsed', 'resolvedAt', p_refunded_at);
    update public.gift_orders set status = 'lapsed', data = next_data, updated_at = now() where id = g.id;
    result_json := jsonb_build_object('kind', 'gift', 'orderId', g.id, 'result', 'lapsed');
  elsif g.status = 'returned' and (g.data->>'refundedAt') is null then
    update public.gift_orders set data = g.data || jsonb_build_object('refundedAt', p_refunded_at), updated_at = now() where id = g.id;
    result_json := jsonb_build_object('kind', 'gift', 'orderId', g.id, 'result', 'returned');
  else
    result_json := jsonb_build_object('kind', 'gift', 'orderId', g.id, 'result', 'unchanged');
  end if;
  update public.store_refund_events set outcome = result_json where event_id = p_event_id;
  return result_json;
end $$;

revoke all on function public.server_gift_context(uuid,uuid,timestamptz),
  public.server_apply_store_refund(text,text,text,timestamptz),
  public.server_commit_state_before_gifts(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb),
  public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.server_gift_context(uuid,uuid,timestamptz),
  public.server_apply_store_refund(text,text,text,timestamptz),
  public.server_commit_state_before_gifts(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb),
  public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) to service_role;
