-- 원정 주간 순위 보상을 표준 보상 풀로 옮긴다(2026-10-27 응태 요청 — 1,000위 밖도 받는 다양한 보상풀).
-- 예전 server_competitive_rewards는 순위 구간 한 줄(101위 밖)만 알고 원정에는 젬 + 인양 기록 두 가지만 넣었다.
-- v2는 게임 서버가 src/data/expedition.ts의 EXPEDITION_WEEKLY_RANK_POOL을 그대로 넘긴다:
--   p_rules = { duel: [{upTo,gems}], expedition: { ranks:[{upTo,rewards}], percents:[{upToPercent,rewards}], participation:{...} } }
--   rewards = {"gems":…, "salvageRecord":…, "gold":…, "cheesecake":…} — 지갑 키 그대로 우편 첨부가 된다.
-- 1,000위 밖은 그 주 참가자 중 백분율 구간이다(고대 지층 월간과 같은 규칙). 표를 새로 만들지 않는다.
-- 게임 서버는 v2가 없으면 예전 함수로 되돌아가므로 이 파일을 먼저 적용해도, 나중에 적용해도 우편은 끊기지 않는다.

create function public.server_competitive_rewards_v2(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; period_row record; band jsonb; bundle jsonb; attachments jsonb; amount integer; total integer; mid uuid;
 week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for period_row in select distinct board,period from public.server_competitive_scores where player_id=p_player and board in('duel','expedition') and period<week and played loop
   perform pg_advisory_xact_lock(hashtextextended(period_row.board||period_row.period::text,27));
   if not exists(select 1 from public.server_competitive_results where board=period_row.board and period=period_row.period) then
     insert into public.server_competitive_results
       select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
       from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
       where c.board=period_row.board and c.period=period_row.period and c.played;
   end if;
 end loop;
 for row in select x.* from public.server_competitive_results x where player_id=p_player and x.board in('duel','expedition')
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   if row.board='duel' then
     select e into band from jsonb_array_elements(p_rules->'duel') e where (e->>'upTo') is null or (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint nulls last limit 1;
     bundle:=jsonb_build_object('gems',(band->>'gems')::int);
   else
     select count(*) into total from public.server_competitive_results where board='expedition' and period=row.period;
     select e->'rewards' into bundle from jsonb_array_elements(p_rules->'expedition'->'ranks') e where (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint limit 1;
     if bundle is null then
       select e->'rewards' into bundle from jsonb_array_elements(p_rules->'expedition'->'percents') e
        where (e->>'upToPercent')::numeric>=row.rank*100.0/greatest(1,total) order by (e->>'upToPercent')::numeric limit 1;
     end if;
     if bundle is null then bundle:=p_rules->'expedition'->'participation'; end if;
   end if;
   amount:=(bundle->>'gems')::int;
   if amount is null or amount<=0 then raise exception 'invalid_rank_rewards'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('asset',k,'amount',v::int) order by case k when 'gems' then 0 when 'salvageRecord' then 1 when 'gold' then 2 else 3 end),'[]'::jsonb)
     into attachments from jsonb_each_text(bundle) as b(k,v)
     where k in('gems','salvageRecord','gold','cheesecake') and v ~ '^[0-9]+$' and v::int>0;
   insert into public.mails(title,body,rewards,target_player) values(
     case when row.board='duel' then '결투장 주간 순위 보상' else '원정 주간 순위 보상' end,
     row.period::text||' 주간 · '||row.rank::text||'위',
     attachments,p_player) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;

revoke all on function public.server_competitive_rewards_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_competitive_rewards_v2(uuid,jsonb) to service_role;
