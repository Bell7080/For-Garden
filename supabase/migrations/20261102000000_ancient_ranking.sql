-- 고대 지층 상시 순위. 초기화하지 않으므로(2026-10-26 결정) 기간은 1970-01-01 한 칸에 고정한다.
-- 점수는 저장의 clearedStageIds 중 가장 깊은 `ancient:N`이고, 같은 층이면 먼저 닿은(achieved_at) 사람이 위다.
-- 표를 새로 만들지 않고 server_competitive_scores의 board만 늘린다 — 출시 초기화 목록에 이미 들어 있다.
alter table public.server_competitive_scores drop constraint if exists server_competitive_scores_board_check;
alter table public.server_competitive_scores add constraint server_competitive_scores_board_check check(board in('duel','expedition','arena','ancient'));

create function public.server_ancient_floor(p_data jsonb) returns integer language sql immutable set search_path='' as $$
 select coalesce(max(least(200,(substring(e from '^ancient:([0-9]+)$'))::integer)),0)
 from jsonb_array_elements_text(coalesce(p_data->'clearedStageIds','[]')) e where e ~ '^ancient:[0-9]+$';
$$;

create function public.server_track_ancient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_floor integer:=public.server_ancient_floor(new.data);
begin
 if v_floor>0 then
   -- 층이 오를 때만 시각을 새로 적는다. 같은 저장을 다시 올려도 먼저 닿은 순서가 바뀌지 않는다.
   insert into public.server_competitive_scores values('ancient','1970-01-01',new.player_id,v_floor,now(),true)
    on conflict(board,period,player_id) do update set score=excluded.score,achieved_at=excluded.achieved_at where excluded.score>server_competitive_scores.score;
 end if;
 return new;
end $$;
create trigger track_ancient after insert or update of data on public.player_saves for each row execute function public.server_track_ancient();

create function public.server_ancient_ranking(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='ancient' and period='1970-01-01'),
 lines as(select r.rank,jsonb_build_object('rank',r.rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'floor',r.score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika')) doc,r.player_id
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id)
 select jsonb_build_object(
  'me',(select doc from lines where player_id=p_player),
  'entries',coalesce((select jsonb_agg(doc order by rank) from lines where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

revoke all on function public.server_ancient_floor(jsonb),public.server_track_ancient(),public.server_ancient_ranking(uuid,integer) from public,anon,authenticated;
grant execute on function public.server_ancient_ranking(uuid,integer) to service_role;

-- 이미 지층을 오른 계정도 다음 저장을 기다리지 않고 순위에 선다. 지금까지의 도달 시각은 알 수 없어 저장 시각으로 갈음한다.
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'ancient','1970-01-01',s.player_id,public.server_ancient_floor(s.data),s.updated_at,true
 from public.player_saves s where public.server_ancient_floor(s.data)>0
 on conflict(board,period,player_id) do nothing;

-- 고대 지층은 상시 순위이며 주간 보상이 없다. 기존 주간 정산에서 별도로 제외한다.
-- arena 등 기존 보드의 정산 동작과 서비스 롤 전용 권한은 바꾸지 않는다.
create or replace function public.server_competitive_rewards(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; period_row record; band jsonb; amount integer; mid uuid; week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for period_row in select distinct board,period from public.server_competitive_scores where player_id=p_player and board<>'ancient' and period<week and played loop
   perform pg_advisory_xact_lock(hashtextextended(period_row.board||period_row.period::text,27));
   if not exists(select 1 from public.server_competitive_results where board=period_row.board and period=period_row.period) then
     insert into public.server_competitive_results
       select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
       from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
       where c.board=period_row.board and c.period=period_row.period and c.played;
   end if;
 end loop;
 for row in select x.* from public.server_competitive_results x where player_id=p_player and x.board<>'ancient'
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select e into band from jsonb_array_elements(p_rules) e where (e->>'upTo') is null or (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint nulls last limit 1;
   amount:=(band->>'gems')::int;
   if amount is null or amount<=0 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player) values(
     case when row.board='duel' then '결투장 주간 순위 보상' else '원정 주간 순위 보상' end,
     row.period::text||' 주간 · '||row.rank::text||'위',
     jsonb_build_array(jsonb_build_object('asset','gems','amount',amount)) || case when row.board='expedition' then jsonb_build_array(jsonb_build_object('asset','salvageRecord','amount',(band->>'salvageRecord')::int)) else '[]'::jsonb end,p_player) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;
