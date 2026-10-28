begin;
do $checks$
declare p uuid:=gen_random_uuid(); g uuid; r jsonb; again jsonb; balance integer;
begin
  insert into auth.users(id) values(p);
  insert into public.players(id) values(p) on conflict(id) do nothing;
  insert into public.guilds(name,name_key,badge,join_mode) values('QA Guild Shop','qa-guildshop-'||p::text,'{}','open') returning id into g;
  insert into public.guild_members(player_id,guild_id,role,name,coin) values(p,g,'leader','QA Guild Shop',10000);
  r:=public.server_guild_call(p,'getShop','{}','[]',null);
  if jsonb_array_length(r->'items')<>6 or (r->>'guildLevel')::int<>1 then raise exception 'invalid_shop'; end if;
  r:=public.server_guild_call(p,'purchase','{}','["guild-fossil"]','qa-shop-fossil-1');
  select coin into balance from public.guild_members where player_id=p;
  if balance<>9400 then raise exception 'fossil_price'; end if;
  again:=public.server_guild_call(p,'purchase','{}','["guild-fossil"]','qa-shop-fossil-1');
  if again<>r or (select coin from public.guild_members where player_id=p)<>9400 then raise exception 'idempotency'; end if;
  begin
    perform public.server_guild_call(p,'purchase','{}','["guild-fossil"]','qa-shop-fossil-2');
    raise exception 'monthly_limit_missing';
  exception when sqlstate 'PT422' then if sqlerrm<>'PRODUCT_LIMIT' then raise; end if; end;
  begin
    perform public.server_guild_call(p,'purchase','{}','["guild-supply"]','qa-shop-supply-1');
    raise exception 'level_gate_missing';
  exception when sqlstate 'PT422' then if sqlerrm<>'GUILD_LEVEL_LOW' then raise; end if; end;
  update public.guilds set prosperity=60000 where id=g;
  perform public.server_guild_call(p,'purchase','{}','["guild-supply"]','qa-shop-supply-2');
  perform public.server_guild_call(p,'purchase','{}','["guild-rune-rare"]','qa-shop-rune-1');
  if (select coin from public.guild_members where player_id=p)<>8790 then raise exception 'weekly_prices'; end if;
  begin
    perform public.server_guild_call(p,'purchase','{}','["guild-rune-rare"]','qa-shop-rune-2');
    raise exception 'weekly_limit_missing';
  exception when sqlstate 'PT422' then if sqlerrm<>'PRODUCT_LIMIT' then raise; end if; end;
  update public.guild_members set purchase_week_key='old-week' where player_id=p;
  perform public.server_guild_call(p,'purchase','{}','["guild-rune-rare"]','qa-shop-rune-3');
  if (select (month_purchases->>'guild-fossil')::int from public.guild_members where player_id=p)<>1 then raise exception 'weekly_reset_erased_month'; end if;
  update public.guild_members set purchase_month_key='old-month' where player_id=p;
  perform public.server_guild_call(p,'purchase','{}','["guild-fossil"]','qa-shop-fossil-3');
  if (select (purchases->>'guild-rune-rare')::int from public.guild_members where player_id=p)<>1 then raise exception 'monthly_reset_erased_week'; end if;
  r:=public.server_guild_call(p,'getGuild','{}','[]',null);
  if r->'guild' is null then raise exception 'delegation_failed'; end if;
  begin
    perform public.server_guild_call(p,'purchase','{}','["guild-gold"]','short');
    raise exception 'request_validation_missing';
  exception when sqlstate 'PT400' then null; end;
  update public.guild_members set coin=0 where player_id=p;
  begin
    perform public.server_guild_call(p,'purchase','{}','["guild-gold"]','qa-shop-gold-1');
    raise exception 'balance_check_missing';
  exception when sqlstate 'PT422' then if sqlerrm<>'INSUFFICIENT_COINS' then raise; end if; end;
end $checks$;
rollback;
select 'PASS: six products, prices, monthly/weekly limits, level gate, idempotency, independent resets, delegated guild call, request validation, balance check; all QA fixtures rolled back' as result;
