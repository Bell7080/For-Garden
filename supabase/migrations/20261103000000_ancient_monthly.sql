-- 고대 지층 월간 순위(2026-10-27 응태 결정 — 예전 "초기화 없음"을 대체한다).
-- 매달 1일 00:00(UTC)에 진행이 1층으로 돌아가고(게임 서버의 rollAncientSeason), 순위는 그 달 한 칸(period = 그 달 1일)에 쌓인다.
-- 점수의 달은 저장의 ancientSeason(`YYYY-MM`)이 정한다 — 아직 넘기지 않은 저장이 새 달 칸에 지난달 층을 올리지 않게.
-- 표를 새로 만들지 않는다(server_competitive_scores/results/awards를 board='ancient'로 쓴다) — 출시 초기화 목록에 이미 들어 있다.

-- 상시 순위 한 칸(1970-01-01)은 더 쓰지 않는다. 정산 대상이 되지 않게 지운다.
delete from public.server_competitive_scores where board = 'ancient' and period = '1970-01-01';

create function public.server_ancient_season_period(p_data jsonb) returns date language sql stable set search_path='' as $$
 select case when coalesce(p_data->>'ancientSeason','') ~ '^[0-9]{4}-[0-9]{2}$' then ((p_data->>'ancientSeason')||'-01')::date
   else (date_trunc('month', now() at time zone 'UTC'))::date end;
$$;

create or replace function public.server_track_ancient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_floor integer:=public.server_ancient_floor(new.data); v_period date:=public.server_ancient_season_period(new.data);
begin
 if v_floor>0 then
   -- 층이 오를 때만 시각을 새로 적는다. 같은 저장을 다시 올려도 먼저 닿은 순서가 바뀌지 않는다.
   insert into public.server_competitive_scores values('ancient',v_period,new.player_id,v_floor,now(),true)
    on conflict(board,period,player_id) do update set score=excluded.score,achieved_at=excluded.achieved_at where excluded.score>server_competitive_scores.score;
 end if;
 return new;
end $$;

-- 이번 달 순위. 함수 모양은 그대로라 게임 서버의 호출을 바꾸지 않는다.
create or replace function public.server_ancient_ranking(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='ancient' and period=(date_trunc('month', now() at time zone 'UTC'))::date),
 lines as(select r.rank,jsonb_build_object('rank',r.rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'floor',r.score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika')) doc,r.player_id
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id)
 select jsonb_build_object(
  'me',(select doc from lines where player_id=p_player),
  'entries',coalesce((select jsonb_agg(doc order by rank) from lines where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

-- 지난달까지의 순위를 한 번 굳히고(server_competitive_results), 이 계정이 받을 몫을 우편 한 통으로 보낸다.
-- 표는 src/data/competitiveRewards.ts의 ANCIENT_MONTHLY_RANK_REWARDS를 게임 서버가 그대로 넘긴다:
--   {ranks:[{upTo,gems}], percents:[{upToPercent,gems}], participation}
-- 1,000위 밖은 순위가 아니라 백분율 구간이다(모든 랭킹 공통 기준) — 몇 명이 오든 아래쪽 몫이 사라지지 않는다.
create function public.server_ancient_monthly_rewards(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; period_row record; amount integer; total integer; mid uuid; month date:=(date_trunc('month', now() at time zone 'UTC'))::date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for period_row in select distinct period from public.server_competitive_scores where player_id=p_player and board='ancient' and period<month and period>'1970-01-01' and played loop
   perform pg_advisory_xact_lock(hashtextextended('ancient'||period_row.period::text,27));
   if not exists(select 1 from public.server_competitive_results where board='ancient' and period=period_row.period) then
     insert into public.server_competitive_results
       select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
       from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
       where c.board='ancient' and c.period=period_row.period and c.played;
   end if;
 end loop;
 for row in select x.* from public.server_competitive_results x where player_id=p_player and x.board='ancient'
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='ancient' and period=row.period;
   select (e->>'gems')::int into amount from jsonb_array_elements(p_rules->'ranks') e where (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint limit 1;
   if amount is null then
     select (e->>'gems')::int into amount from jsonb_array_elements(p_rules->'percents') e
      where (e->>'upToPercent')::numeric>=row.rank*100.0/greatest(1,total) order by (e->>'upToPercent')::numeric limit 1;
   end if;
   if amount is null then amount:=(p_rules->>'participation')::int; end if;
   if amount is null or amount<=0 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player) values(
     '고대 지층 월간 순위 보상', to_char(row.period,'YYYY-MM')||' · '||row.rank::text||'위',
     jsonb_build_array(jsonb_build_object('asset','gems','amount',amount)),p_player) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;

revoke all on function public.server_ancient_season_period(jsonb),public.server_ancient_monthly_rewards(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_ancient_monthly_rewards(uuid,jsonb) to service_role;

-- 이미 지층을 오른 계정도 다음 저장을 기다리지 않고 이번 달 순위에 선다(달 키가 아직 없는 저장은 이번 달로 받아들인다).
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'ancient',public.server_ancient_season_period(s.data),s.player_id,public.server_ancient_floor(s.data),s.updated_at,true
 from public.player_saves s where public.server_ancient_floor(s.data)>0
 on conflict(board,period,player_id) do nothing;
