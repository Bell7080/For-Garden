-- 닫힌 주의 점수를 덮지 않는 원정/PvP 기록. 월요일 00:00 UTC 마감.
create table public.server_competitive_scores (
 board text not null check(board in('duel','expedition')),period date not null,
 player_id uuid not null references public.players(id) on delete cascade,
 score bigint not null check(score>=0),achieved_at timestamptz not null,played boolean not null,
 primary key(board,period,player_id)
);
create index on public.server_competitive_scores(board,period,score desc,achieved_at,player_id);
create table public.server_competitive_awards (
 board text not null,period date not null,player_id uuid not null references public.players(id) on delete cascade,
 mail_id uuid not null references public.mails(id),rank bigint not null,gems integer not null,
 primary key(board,period,player_id)
);
alter table public.server_competitive_scores enable row level security;
alter table public.server_competitive_awards enable row level security;
revoke all on public.server_competitive_scores,public.server_competitive_awards from public,anon,authenticated;

create function public.server_track_competitive() returns trigger language plpgsql security definer set search_path='' as $$
declare week date:=(date_trunc('week',now() at time zone 'UTC'))::date; score bigint; stamp timestamptz; played boolean;
begin
 if coalesce((new.data->'playerResearch'->>'level')::int,1)>=6 then
   score:=coalesce((new.data->'duel'->>'score')::bigint,0);
   played:=exists(select 1 from jsonb_array_elements(coalesce(new.data->'duel'->'history','[]')) e where (e->>'at')::timestamptz>=week::timestamptz);
   insert into public.server_competitive_scores values('duel',week,new.player_id,score,now(),played)
    on conflict(board,period,player_id) do update set score=excluded.score,played=server_competitive_scores.played or excluded.played,
    achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
 end if;
 if coalesce(new.data->'expedition'->>'weekKey','')<>'' then
   score:=coalesce((new.data->'expedition'->>'bestScore')::bigint,0);
   stamp:=coalesce(nullif(new.data->'expedition'->>'bestAchievedAt','')::timestamptz,now());
   -- 지난 주에 입장한 판을 새 주에 끝내도 마감된 주의 순위를 바꾸지 않는다.
   if score>0 and (new.data->'expedition'->>'weekKey')::date=week then
     insert into public.server_competitive_scores values('expedition',week,new.player_id,score,stamp,true)
      on conflict(board,period,player_id) do update set score=excluded.score,achieved_at=excluded.achieved_at where excluded.score>server_competitive_scores.score;
   end if;
 end if;
 return new;
end $$;
create trigger track_competitive after insert or update of data on public.player_saves for each row execute function public.server_track_competitive();

create function public.server_expedition_ranking(p_player uuid,p_week date,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='expedition' and period=p_week and played)
 select jsonb_build_object('rank',(select rank from ranked where player_id=p_player),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'score',score,'achievedAt',achieved_at,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika')) order by rank)
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

-- 마감 순위는 첫 정산에서 전체를 확정한다. 이후 정지/삭제·접속 순서로 다른 사람의 지급 순위가 달라지지 않는다.
create table public.server_competitive_results (
 board text not null,period date not null,player_id uuid not null references public.players(id) on delete cascade,rank bigint not null,
 primary key(board,period,player_id)
);
alter table public.server_competitive_results enable row level security;
revoke all on public.server_competitive_results from public,anon,authenticated;

-- 접속 시 닫힌 주를 확정한다. 고유 키와 트랜잭션으로 중복 우편을 방지한다.
create function public.server_competitive_rewards(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; period_row record; band jsonb; amount integer; mid uuid; week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for period_row in select distinct board,period from public.server_competitive_scores where player_id=p_player and period<week and played loop
   perform pg_advisory_xact_lock(hashtextextended(period_row.board||period_row.period::text,27));
   if not exists(select 1 from public.server_competitive_results where board=period_row.board and period=period_row.period) then
     insert into public.server_competitive_results
       select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
       from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
       where c.board=period_row.board and c.period=period_row.period and c.played;
   end if;
 end loop;
 for row in select x.* from public.server_competitive_results x where player_id=p_player
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
revoke all on function public.server_track_competitive(),public.server_expedition_ranking(uuid,date,integer),public.server_competitive_rewards(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_expedition_ranking(uuid,date,integer),public.server_competitive_rewards(uuid,jsonb) to service_role;

-- 기존 계정도 다음 플레이/수동 방어덱 등록을 기다리지 않고 현재 주의 기록에 참가한다.
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'duel',(date_trunc('week',now() at time zone 'UTC'))::date,s.player_id,
 coalesce((data->'duel'->>'score')::bigint,0),s.updated_at,
 exists(select 1 from jsonb_array_elements(coalesce(data->'duel'->'history','[]')) e where (e->>'at')::timestamptz>=date_trunc('week',now() at time zone 'UTC'))
 from public.player_saves s where coalesce((data->'playerResearch'->>'level')::int,1)>=6 on conflict do nothing;
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'expedition',(data->'expedition'->>'weekKey')::date,s.player_id,
 (data->'expedition'->>'bestScore')::bigint,(data->'expedition'->>'bestAchievedAt')::timestamptz,true
 from public.player_saves s where coalesce((data->'expedition'->>'bestScore')::bigint,0)>0
 and nullif(data->'expedition'->>'weekKey','')::date=(date_trunc('week',now() at time zone 'UTC'))::date on conflict do nothing;
