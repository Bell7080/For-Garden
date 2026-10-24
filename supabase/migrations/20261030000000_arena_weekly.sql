-- 아레나 연승·최고 RP·주간 순위/티어 보상. 값(연승 보너스·보상표)은 src/core/arenaStanding.ts와 같아야 한다(arenaStanding.test).
alter table public.arena_ratings
  add column win_streak integer not null default 0,
  add column best_streak integer not null default 0,
  add column best_score integer not null default 1000;
update public.arena_ratings set best_score=greatest(best_score,score);

alter table public.server_competitive_scores drop constraint if exists server_competitive_scores_board_check;
alter table public.server_competitive_scores add constraint server_competitive_scores_board_check check(board in('duel','expedition','arena'));

-- 연승 보너스: 2연승부터 연승마다 +2, 최대 +10. 진 쪽이 잃는 RP는 늘지 않는다.
create function public.server_arena_streak_bonus(p_streak integer) returns integer language sql immutable set search_path='' as $$
 select case when p_streak<2 then 0 else least(10,(p_streak-1)*2) end;
$$;

-- 랭크전 결과를 이번 주(월요일 00:00 UTC) 아레나 순위에 적는다. 한 판이라도 한 계정만 순위에 선다.
create function public.server_arena_track_week(p_player uuid) returns void language plpgsql security definer set search_path='' as $$
declare week date:=(date_trunc('week',now() at time zone 'UTC'))::date; s integer;
begin
 select score into s from public.arena_ratings where player_id=p_player;
 insert into public.server_competitive_scores values('arena',week,p_player,greatest(0,coalesce(s,1000)),now(),true)
  on conflict(board,period,player_id) do update set score=excluded.score,played=true,
  achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
end $$;

create or replace function public.server_arena_commit(p_player uuid,p_room uuid,p_version integer,p_data jsonb,p_request text,p_fingerprint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.arena_rooms; old public.arena_receipts; winner integer; loser uuid; victor uuid; delta integer; sa integer; sb integer; streak integer;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(672391005);
 select * into r from public.arena_rooms where id=p_room and p_player in(a,b) for update;
 if not found then raise exception 'ARENA_FORBIDDEN' using errcode='PT403'; end if;
 select * into old from public.arena_receipts where player_id=p_player and request_id=p_request;
 if found and old.room_id=r.id then
   if old.fingerprint<>p_fingerprint then raise exception 'ARENA_REQUEST_CONFLICT' using errcode='PT409'; end if;
   return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 if r.version<>p_version then return jsonb_build_object('conflict',true,'room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 if r.data->>'phase' in ('done','declined') then return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 update public.arena_rooms set data=p_data-'version'-'id',version=version+1 where id=r.id returning * into r;
 if r.data->>'phase' in ('done','declined') and not r.settled then
   if (r.data->>'ranked')::boolean and r.data->>'winner' is not null then
     winner:=(r.data->>'winner')::integer; victor:=case when winner=0 then r.a else r.b end; loser:=case when winner=0 then r.b else r.a end;
     insert into public.arena_ratings(player_id) values(r.a),(r.b) on conflict do nothing;
     select score,win_streak+1 into sa,streak from public.arena_ratings where player_id=victor;
     select score into sb from public.arena_ratings where player_id=loser;
     delta:=greatest(8,least(40,round(32*(1-1/(1+power(10.0,(sb-sa)/400.0))))::integer));
     update public.arena_ratings set score=score+delta+public.server_arena_streak_bonus(streak),wins=wins+1,win_streak=streak,
       best_streak=greatest(best_streak,streak),best_score=greatest(best_score,score+delta+public.server_arena_streak_bonus(streak)) where player_id=victor;
     update public.arena_ratings set score=greatest(0,score-delta),losses=losses+1,win_streak=0 where player_id=loser;
     perform public.server_arena_track_week(victor);
     perform public.server_arena_track_week(loser);
   end if;
   update public.arena_rooms set settled=true where id=r.id;
   delete from public.arena_seats where room_id=r.id;
 end if;
 if p_request is not null then insert into public.arena_receipts values(p_player,p_request,r.id,p_fingerprint) on conflict do nothing; end if;
 return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version));
end $$;

-- 화면이 읽는 내 자리. 잠금·정리 없이 읽기만 한다(로비 프로필도 이 값을 읽는다).
create function public.server_arena_standing(p_player uuid) returns jsonb
language sql security definer set search_path='' stable as $$
 with week as(select (date_trunc('week',now() at time zone 'UTC'))::date d),
 me as(select coalesce(r.score,1000) score,coalesce(r.wins,0) wins,coalesce(r.losses,0) losses,coalesce(r.win_streak,0) streak,
   coalesce(r.best_streak,0) best_streak,coalesce(r.best_score,1000) best_score from (select 1) one left join public.arena_ratings r on r.player_id=p_player),
 ranked as(select c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id) rank
   from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active', week
   where c.board='arena' and c.period=week.d and c.played),
 last as(select c.score,x.rank from week, public.server_competitive_scores c left join public.server_competitive_results x
   on x.board=c.board and x.period=c.period and x.player_id=c.player_id where c.board='arena' and c.period=week.d-7 and c.player_id=p_player and c.played)
 select jsonb_build_object('score',me.score,'wins',me.wins,'losses',me.losses,'winStreak',me.streak,'bestStreak',me.best_streak,'bestScore',me.best_score,
   'nextStreakBonus',public.server_arena_streak_bonus(me.streak+1),
   'rank',(select rank from ranked where player_id=p_player),
   'weekEndsAt',to_char(((select d from week)+7)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'serverTime',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'lastWeek',(select jsonb_build_object('score',score,'rank',rank) from last))
 from me;
$$;

create function public.server_arena_ranking(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='arena' and period=(date_trunc('week',now() at time zone 'UTC'))::date and played)
 select jsonb_build_object('rank',(select rank from ranked where player_id=p_player),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'score',score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika')) order by rank)
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

-- 닫힌 주의 아레나 우편 — 마감 RP의 티어 보상 + 순위 보너스. 표(p_rules)는 게임 서버가 arenaStanding.ts에서 넘긴다.
-- {tiers:[{floor,duelEmblem,gems}], ranks:[{upTo,gems}]}
create function public.server_arena_weekly_rewards(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; period_row record; tier jsonb; band jsonb; emblem integer; gems integer; mid uuid; week date:=(date_trunc('week',now() at time zone 'UTC'))::date;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for period_row in select distinct period from public.server_competitive_scores where board='arena' and player_id=p_player and period<week and played loop
   perform pg_advisory_xact_lock(hashtextextended('arena'||period_row.period::text,27));
   if not exists(select 1 from public.server_competitive_results where board='arena' and period=period_row.period) then
     insert into public.server_competitive_results
       select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
       from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
       where c.board='arena' and c.period=period_row.period and c.played;
   end if;
 end loop;
 for row in select x.rank,x.period,c.score from public.server_competitive_results x join public.server_competitive_scores c
   on c.board=x.board and c.period=x.period and c.player_id=x.player_id where x.board='arena' and x.player_id=p_player
   and not exists(select 1 from public.server_competitive_awards a where a.board='arena' and a.period=x.period and a.player_id=p_player)
 loop
   select e into tier from jsonb_array_elements(p_rules->'tiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
   select e into band from jsonb_array_elements(p_rules->'ranks') e where (e->>'upTo') is null or (e->>'upTo')::bigint>=row.rank order by (e->>'upTo')::bigint nulls last limit 1;
   emblem:=coalesce((tier->>'duelEmblem')::int,0); gems:=coalesce((tier->>'gems')::int,0)+coalesce((band->>'gems')::int,0);
   if tier is null or emblem<0 or gems<0 or emblem>1000 or gems>5000 then raise exception 'invalid_arena_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player) values('아레나 주간 보상',row.period::text||' 주간 · '||row.rank::text||'위 · '||row.score::text||' RP',
     jsonb_build_array(jsonb_build_object('asset','duelEmblem','amount',emblem),jsonb_build_object('asset','gems','amount',gems)),p_player) returning id into mid;
   insert into public.server_competitive_awards values('arena',row.period,p_player,mid,row.rank,gems);
 end loop;
end $$;

-- 프로필·길드 카드의 아레나 RP. 한 판이라도 한 계정만 싣고, 공개 카드가 다시 적힐 때마다 지금 값을 덧입힌다.
create function public.server_arena_public_score(p_player uuid) returns integer language sql stable security definer set search_path='' as $$
 select score from public.arena_ratings where player_id=p_player and wins+losses>0;
$$;
create function public.server_arena_profile_inject() returns trigger language plpgsql security definer set search_path='' as $$
declare s integer:=public.server_arena_public_score(new.player_id);
begin
 if jsonb_typeof(new.profile)='object' then
   new.profile:=jsonb_set(new.profile,'{competitiveStats}',coalesce(new.profile->'competitiveStats','{}'::jsonb)-'arenaScore'||case when s is null then '{}'::jsonb else jsonb_build_object('arenaScore',s) end);
 end if;
 return new;
end $$;
create trigger arena_profile_inject before insert or update of profile on public.server_public_profiles for each row execute function public.server_arena_profile_inject();
create function public.server_arena_card_inject() returns trigger language plpgsql security definer set search_path='' as $$
declare s integer:=public.server_arena_public_score(new.player_id);
begin
 if jsonb_typeof(new.card)='object' then new.card:=new.card-'arenaScore'||case when s is null then '{}'::jsonb else jsonb_build_object('arenaScore',s) end; end if;
 return new;
end $$;
create trigger arena_card_inject before insert or update of card on public.guild_members for each row execute function public.server_arena_card_inject();
create function public.server_arena_rating_publish() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.server_public_profiles set profile=profile where player_id=new.player_id;
 update public.guild_members set card=card where player_id=new.player_id and card is not null;
 return new;
end $$;
create trigger arena_rating_publish after update of score,wins,losses on public.arena_ratings for each row execute function public.server_arena_rating_publish();

revoke all on function public.server_arena_streak_bonus(integer),public.server_arena_track_week(uuid),public.server_arena_standing(uuid),public.server_arena_ranking(uuid,integer),
  public.server_arena_weekly_rewards(uuid,jsonb),public.server_arena_public_score(uuid),public.server_arena_profile_inject(),public.server_arena_card_inject(),public.server_arena_rating_publish() from public,anon,authenticated;
grant execute on function public.server_arena_standing(uuid),public.server_arena_ranking(uuid,integer),public.server_arena_weekly_rewards(uuid,jsonb) to service_role;
