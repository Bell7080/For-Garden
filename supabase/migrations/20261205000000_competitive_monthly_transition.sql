-- 월간 구조를 켜는 순간의 이음매(2026-11-28 — 20261204000000 적용 직후 같은 날).
--
--   * 주간 티어는 since가 든 **주**부터 준다 — 2026-12-01(화)로 켜면 11-30 주가 예전 주간 순위도 새 티어도 받지 못하던 틈을 메운다.
--   * 그보다 앞 주는 예전 규칙(결투장 p_rules.legacyDuel · 아레나 p_rules.legacy)으로 한 번 준다 — 켜는 날 접속하지 않은 계정도
--     지난주 보상을 잃지 않는다. 받았는지는 예전과 같은 판(duel · arena)으로 가려 두 번 주지 않는다.
--   * 원정은 받은 판이 예전과 같아 기간을 자르지 않는다(남은 주는 새 표로 한 번).

create or replace function public.server_competitive_rewards_v3(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; tier jsonb; bundle jsonb; attachments jsonb; total integer; mid uuid; amount integer;
 week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
 since date:=coalesce(nullif(p_rules->>'since','')::date,'2000-01-01'::date); since_week date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 since_week:=(date_trunc('week',since))::date;
 if jsonb_typeof(p_rules->'duelTiers')<>'array' or jsonb_array_length(p_rules->'duelTiers')=0 then raise exception 'invalid_rank_rewards'; end if;

 -- 결투장 주간 티어: 그 주 마지막 점수의 티어. 순위가 아니라 점수라 정산 확정이 필요 없다.
 for row in select c.period,c.score from public.server_competitive_scores c
   where c.board='duel' and c.player_id=p_player and c.played and c.period<week and c.period>=since_week
   and not exists(select 1 from public.server_competitive_awards a where a.board='duel_tier' and a.period=c.period and a.player_id=p_player)
 loop
   select e into tier from jsonb_array_elements(p_rules->'duelTiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
   if tier is null then raise exception 'invalid_rank_rewards'; end if;
   attachments:=private.rank_bundle_attachments(tier-'tier'-'floor');
   amount:=coalesce((tier->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>5000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('결투장 주간 티어 보상',
     row.period::text||' 주간 · '||row.score::text||'점',attachments,p_player,'duelTier',
     jsonb_build_object('tier',tier->>'tier','period',row.period::text,'score',row.score)) returning id into mid;
   insert into public.server_competitive_awards values('duel_tier',row.period,p_player,mid,0,amount);
 end loop;

 -- 켜기 전 주(since가 든 주 앞)의 결투장 주간 순위는 예전 규칙(p_rules.legacyDuel) 그대로 한 번 준다 — 켜는 날 접속하지 않은 계정도 잃지 않는다.
 if jsonb_typeof(p_rules->'legacyDuel')='array' then
   for row in select distinct period from public.server_competitive_scores
     where board='duel' and player_id=p_player and played and period<least(week,since_week) loop
     perform private.settle_competitive_period('duel',row.period);
   end loop;
   for row in select x.* from public.server_competitive_results x where x.board='duel' and x.player_id=p_player and x.period<since_week
     and not exists(select 1 from public.server_competitive_awards a where a.board='duel' and a.period=x.period and a.player_id=p_player)
   loop
     select (e->>'gems')::int into amount from jsonb_array_elements(p_rules->'legacyDuel') e
      where (e->>'upTo') is null or (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint nulls last limit 1;
     if amount is null or amount<=0 or amount>5000 then raise exception 'invalid_rank_rewards'; end if;
     insert into public.mails(title,body,rewards,target_player,kind,meta) values('결투장 주간 순위 보상',
       row.period::text||' 주간 · '||row.rank::text||'위',jsonb_build_array(jsonb_build_object('asset','gems','amount',amount)),p_player,'duelRank',
       jsonb_build_object('rank',row.rank,'period',row.period::text)) returning id into mid;
     insert into public.server_competitive_awards values('duel',row.period,p_player,mid,row.rank,amount);
   end loop;
 end if;

 -- 결투장 월간 순위.
 for row in select distinct period from public.server_competitive_scores
   where board='duel_month' and player_id=p_player and played and period<month and period>=date_trunc('month',since)::date loop
   perform private.settle_competitive_period('duel_month',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='duel_month' and x.player_id=p_player
   and x.period>=date_trunc('month',since)::date
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='duel_month' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'duelMonth',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>20000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('결투장 월간 순위 보상',
     to_char(row.period,'YYYY-MM')||' 월간 · '||row.rank::text||'위',attachments,p_player,'duelRank',
     jsonb_build_object('rank',row.rank,'period',to_char(row.period,'YYYY-MM'))) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;

 -- 원정 주간 순위(예전과 같은 주기, 새 표).
 for row in select distinct period from public.server_competitive_scores
   where board='expedition' and player_id=p_player and played and period<week loop
   perform private.settle_competitive_period('expedition',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='expedition' and x.player_id=p_player
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='expedition' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'expedition',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if amount<=0 or amount>5000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('원정 주간 순위 보상',
     row.period::text||' 주간 · '||row.rank::text||'위',attachments,p_player,'expeditionRank',
     jsonb_build_object('rank',row.rank,'period',row.period::text)) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;

create or replace function public.server_arena_rewards_v2(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; tier jsonb; bundle jsonb; attachments jsonb; total integer; mid uuid; amount integer;
 week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
 since date:=coalesce(nullif(p_rules->>'since','')::date,'2000-01-01'::date); since_week date; band jsonb; emblem integer;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 since_week:=(date_trunc('week',since))::date;
 if jsonb_typeof(p_rules->'tiers')<>'array' or jsonb_array_length(p_rules->'tiers')=0 then raise exception 'invalid_arena_rewards'; end if;

 for row in select c.period,c.score from public.server_competitive_scores c
   where c.board='arena' and c.player_id=p_player and c.played and c.period<week and c.period>=since_week
   and not exists(select 1 from public.server_competitive_awards a where a.board in('arena','arena_tier') and a.period=c.period and a.player_id=p_player)
 loop
   select e into tier from jsonb_array_elements(p_rules->'tiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
   if tier is null then raise exception 'invalid_arena_rewards'; end if;
   attachments:=private.rank_bundle_attachments(tier-'tier'-'floor'); amount:=coalesce((tier->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>5000 then raise exception 'invalid_arena_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('아레나 주간 티어 보상',
     row.period::text||' 주간 · '||row.score::text||' RP',attachments,p_player,'arenaTier',
     jsonb_build_object('tier',tier->>'tier','period',row.period::text,'score',row.score)) returning id into mid;
   insert into public.server_competitive_awards values('arena_tier',row.period,p_player,mid,0,amount);
 end loop;

 -- 켜기 전 주의 아레나 주간 보상은 예전 규칙(p_rules.legacy = { tiers, ranks }) 그대로 한 번 준다.
 if jsonb_typeof(p_rules->'legacy'->'tiers')='array' then
   for row in select distinct period from public.server_competitive_scores
     where board='arena' and player_id=p_player and played and period<least(week,since_week) loop
     perform private.settle_competitive_period('arena',row.period);
   end loop;
   for row in select x.rank,x.period,c.score from public.server_competitive_results x join public.server_competitive_scores c
     on c.board=x.board and c.period=x.period and c.player_id=x.player_id where x.board='arena' and x.player_id=p_player and x.period<since_week
     and not exists(select 1 from public.server_competitive_awards a where a.board in('arena','arena_tier') and a.period=x.period and a.player_id=p_player)
   loop
     select e into tier from jsonb_array_elements(p_rules->'legacy'->'tiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
     select e into band from jsonb_array_elements(coalesce(p_rules->'legacy'->'ranks','[]'::jsonb)) e where (e->>'upTo') is null or (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint nulls last limit 1;
     emblem:=coalesce((tier->>'duelEmblem')::int,0); amount:=coalesce((tier->>'gems')::int,0)+coalesce((band->>'gems')::int,0);
     if tier is null or emblem<0 or amount<0 or emblem>1000 or amount>5000 then raise exception 'invalid_arena_rewards'; end if;
     insert into public.mails(title,body,rewards,target_player,kind,meta) values('아레나 주간 보상',row.period::text||' 주간 · '||row.rank::text||'위 · '||row.score::text||' RP',
       jsonb_build_array(jsonb_build_object('asset','duelEmblem','amount',emblem),jsonb_build_object('asset','gems','amount',amount)),p_player,'arenaTier',
       jsonb_build_object('rank',row.rank,'period',row.period::text,'score',row.score)) returning id into mid;
     insert into public.server_competitive_awards values('arena',row.period,p_player,mid,row.rank,amount);
   end loop;
 end if;

 for row in select distinct period from public.server_competitive_scores
   where board='arena_month' and player_id=p_player and played and period<month and period>=date_trunc('month',since)::date loop
   perform private.settle_competitive_period('arena_month',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='arena_month' and x.player_id=p_player
   and x.period>=date_trunc('month',since)::date
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='arena_month' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'month',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>20000 then raise exception 'invalid_arena_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('아레나 월간 순위 보상',
     to_char(row.period,'YYYY-MM')||' 월간 · '||row.rank::text||'위',attachments,p_player,'arenaRank',
     jsonb_build_object('rank',row.rank,'period',to_char(row.period,'YYYY-MM'))) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;
