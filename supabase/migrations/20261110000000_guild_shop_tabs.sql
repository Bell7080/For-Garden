-- 길드 상점 탭 셋(주간 · 월간 · 길드 레벨) — 2026-10-28 응태 승인(`docs/guild-plan.md` 3장, 만능 파편은 팔지 않는다).
-- 상품 표의 원본은 `src/core/guild.ts`의 `GUILD_SHOP_PRODUCTS`이고 `tests/unit/guildSql.test.ts`가 이 표와 대조한다.
-- 월간 상품은 따로 센다(`month_purchases` · UTC `YYYY-MM`). 길드 레벨 칸은 그 레벨(`minGuildLevel`)부터 산다.
-- 지급(골드·치즈케이크·화석·드링크·룬)은 여전히 게임 서버(`buyGuildProduct`)가 이 함수가 코인을 깎은 뒤 확정한다.

alter table public.guild_members
  add column if not exists month_purchases jsonb not null default '{}',
  add column if not exists purchase_month_key text not null default '';

create or replace function public.server_guild_month(p_t timestamptz) returns text language sql stable set search_path='' as $$
  select to_char(p_t at time zone 'UTC', 'YYYY-MM');
$$;

create or replace function public.server_guild_products() returns jsonb language sql immutable set search_path='' as $$
  select '[{"productId":"guild-gold","price":20,"limit":5,"refresh":"weekly"},{"productId":"guild-cheesecake","price":20,"limit":5,"refresh":"weekly"},{"productId":"guild-tonic","price":90,"limit":2,"refresh":"weekly"},{"productId":"guild-rune-rare","price":450,"limit":1,"refresh":"weekly"},{"productId":"guild-fossil","price":600,"limit":1,"refresh":"monthly"},{"productId":"guild-supply","price":160,"limit":1,"refresh":"weekly","minGuildLevel":10}]'::jsonb;
$$;

-- 산 수는 상품의 주기(주간·월간) 안에서 센다. 레벨 칸을 가르도록 지금 길드 레벨을 함께 내려 준다.
create or replace function public.server_guild_shop(p_player uuid, p_t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare m public.guild_members; week text := public.server_guild_week(p_t); month text := public.server_guild_month(p_t); lvl integer;
begin
  select * into m from public.guild_members where player_id = p_player;
  select public.server_guild_level(prosperity) into lvl from public.guilds where id = m.guild_id;
  return jsonb_build_object('coin', m.coin, 'guildLevel', coalesce(lvl, 1), 'serverTime', public.server_guild_ms(p_t), 'items', (
    select jsonb_agg(p || jsonb_build_object('bought', case
      when p ->> 'refresh' = 'monthly' then case when m.purchase_month_key = month then coalesce((m.month_purchases ->> (p ->> 'productId'))::integer, 0) else 0 end
      else case when m.purchase_week_key = week then coalesce((m.purchases ->> (p ->> 'productId'))::integer, 0) else 0 end end))
    from jsonb_array_elements(public.server_guild_products()) p));
end $$;

-- 방어진 문(20261108000000) 앞에 상점 두 조작만 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_war;
revoke all on function public.server_guild_call_war(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_war(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); t timestamptz := now(); week text := public.server_guild_week(now()); month text := public.server_guild_month(now());
  m public.guild_members; cached public.guild_receipts; product jsonb; v_level integer; monthly boolean; bought integer; price integer; out jsonb;
begin
  if p_method not in ('getShop','purchase') then
    return public.server_guild_call_war(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);

  if p_method = 'purchase' then
    perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));
    if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
    select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
    if found then
      if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
      return cached.response;
    end if;
  end if;

  -- 주·달이 넘어갔으면 그 주기의 산 수를 비운다.
  select * into m from public.guild_members where player_id = p_player for update;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
  update public.guild_members set last_active_at = t,
    purchases = case when purchase_week_key = week then purchases else '{}'::jsonb end, purchase_week_key = week,
    month_purchases = case when purchase_month_key = month then month_purchases else '{}'::jsonb end, purchase_month_key = month
    where player_id = p_player returning * into m;

  if p_method = 'getShop' then return public.server_guild_shop(p_player, t); end if;

  select p into product from jsonb_array_elements(public.server_guild_products()) p where p ->> 'productId' = args ->> 0;
  if product is null then perform public.server_guild_fail('PRODUCT_NOT_FOUND'); end if;
  select public.server_guild_level(prosperity) into v_level from public.guilds where id = m.guild_id;
  if coalesce((product ->> 'minGuildLevel')::integer, 0) > v_level then perform public.server_guild_fail('GUILD_LEVEL_LOW'); end if;
  monthly := product ->> 'refresh' = 'monthly';
  bought := coalesce(((case when monthly then m.month_purchases else m.purchases end) ->> (args ->> 0))::integer, 0);
  price := (product ->> 'price')::integer;
  if bought >= (product ->> 'limit')::integer then perform public.server_guild_fail('PRODUCT_LIMIT'); end if;
  if m.coin < price then perform public.server_guild_fail('INSUFFICIENT_COINS'); end if;
  if monthly then
    update public.guild_members set coin = coin - price, month_purchases = jsonb_set(month_purchases, array[args ->> 0], to_jsonb(bought + 1)) where player_id = p_player;
  else
    update public.guild_members set coin = coin - price, purchases = jsonb_set(purchases, array[args ->> 0], to_jsonb(bought + 1)) where player_id = p_player;
  end if;
  out := jsonb_build_object('shop', public.server_guild_shop(p_player, t));
  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return out;
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_month(timestamptz) from public, anon, authenticated;
revoke all on function public.server_guild_products() from public, anon, authenticated;
revoke all on function public.server_guild_shop(uuid, timestamptz) from public, anon, authenticated;
