-- 순위·명단 한 줄에 플레이어 프로필 얼굴(사진 + 테두리)을 싣는다 — 레이드 기여 · 원정 주간 · 아레나 · 결투 순위.
-- 화면은 이 값으로 상단 줄·친구·길드와 같은 ProfileAvatar를 세우고, 비면 애착 렐릭 얼굴·기본 테두리로 선다.
-- 사진은 보유한 렐릭일 때만 싣는다(저장의 playerCard가 고른 값이라도 갖지 않은 개체면 null). 표·권한은 그대로다 —
-- 같은 이름·인자의 함수를 바꿔 쓰므로 기존 grant가 유지된다. 레이드는 공개 프로필(publicProfile.ts)의 avatarRelicId를 읽고,
-- 목록 공유 범위는 바로 앞 20261101000000_raid_guild_share.sql(친구 또는 같은 길드 — server_raid_shared)을 그대로 따른다.

create or replace function public.server_raid_context(p_player uuid,p_worlds jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare world jsonb; out jsonb;
begin
 perform public.server_require_active(p_player);
 for world in select value from jsonb_array_elements(p_worlds) loop
   insert into public.server_raids(id,definition,ends_at) values(world->>'id',world,(world->>'endsAt')::timestamptz) on conflict do nothing;
 end loop;
 select jsonb_build_object('playerId',p_player,'records',coalesce(jsonb_agg(row_data),'[]'::jsonb)) into out from (
   select jsonb_build_object('revision',r.revision::text,'damage',r.damage,
     'instance',jsonb_strip_nulls(r.definition||jsonb_build_object('myDamage',coalesce(m.damage,0),'appliedDamage',coalesce(m.applied_damage,0),'attemptsUsed',coalesce(m.attempts,0),'settled',coalesce(m.settled,false),'summonedByMe',coalesce(r.owner_id=p_player,false),
       'summonerName',owner.profile->>'displayName')),
     'entries',coalesce((select jsonb_agg(v) from (
       select jsonb_build_object('rank',row_number() over(order by x.damage desc,x.player_id),'playerId',x.player_id,'displayName',coalesce(p.profile->>'displayName','연구원'),'favoriteRelicId',p.profile->'favoriteRelic'->>'relicId','frameId',p.profile->>'frameId','avatarRelicId',p.profile->>'avatarRelicId','damage',x.damage,'isMe',x.player_id=p_player) v
       from public.server_raid_members x left join public.server_public_profiles p on p.player_id=x.player_id where x.raid_id=r.id and x.damage>0 order by x.damage desc,x.player_id limit 100
     ) entries),'[]'::jsonb)) row_data
   from public.server_raids r left join public.server_raid_members m on m.raid_id=r.id and m.player_id=p_player
   left join public.server_public_profiles owner on owner.player_id=r.owner_id
   where (r.owner_id is null or r.owner_id=p_player or public.server_raid_shared(p_player,r.owner_id) or m.player_id is not null)
     and (r.ends_at>now()-interval '48 hours' or coalesce(m.damage,0)>0 and not m.settled)
   order by r.ends_at desc limit 200
 ) records;
 return out;
end $$;

create or replace function public.server_expedition_ranking(p_player uuid,p_week date,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='expedition' and period=p_week and played)
 select jsonb_build_object('rank',(select rank from ranked where player_id=p_player),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'score',score,'achievedAt',achieved_at,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika'),'frameId',s.data->'playerCard'->>'frameId','avatarRelicId',case when coalesce(s.data->'ownedRelicIds','[]'::jsonb) ? (s.data->'playerCard'->>'avatarRelicId') then s.data->'playerCard'->>'avatarRelicId' end) order by rank)
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

create or replace function public.server_arena_ranking(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='arena' and period=(date_trunc('week',now() at time zone 'UTC'))::date and played)
 select jsonb_build_object('rank',(select rank from ranked where player_id=p_player),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'score',score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika'),'frameId',s.data->'playerCard'->>'frameId','avatarRelicId',case when coalesce(s.data->'ownedRelicIds','[]'::jsonb) ? (s.data->'playerCard'->>'avatarRelicId') then s.data->'playerCard'->>'avatarRelicId' end) order by rank)
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

create or replace function public.server_duel_context(p_player uuid, p_season text, p_level integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare out jsonb;
begin
 perform public.server_require_active(p_player);
 with eligible as materialized (
   select s.player_id, s.revision, s.data,
     case when coalesce(s.data->'duel'->>'seasonId','') in ('',p_season) then coalesce((s.data->'duel'->>'score')::bigint,0)
       else floor(coalesce((s.data->'duel'->>'score')::bigint,0)*0.6/100)*100 end as score
   from public.player_saves s join public.players p on p.id=s.player_id and p.status='active'
   where coalesce((s.data->'playerResearch'->>'level')::int,1)>=p_level and jsonb_array_length(coalesce(s.data->'ownedRelicIds','[]'))>=3
 ), mine as (select * from eligible where player_id=p_player),
 wanted as (
   select value #>> '{}' as id from mine,jsonb_array_elements(coalesce(data->'duel'->'candidateIds','[]'))
   union select value->>'target' from mine,jsonb_each(coalesce(data->'serverJournal'->'combat'->'tickets','{}')) where value->>'kind'='duel'
 ), pool as (
   select e.* from eligible e where e.player_id<>p_player
   order by case when e.player_id::text in(select id from wanted) then 0 else 1 end,
     abs(e.score-coalesce((select score from mine),0)), random() limit 60
 ), ranked as (select *,row_number() over(order by score desc,player_id) as rank from eligible)
 select jsonb_build_object('playerId',p_player,
   'rank',coalesce((select rank from ranked where player_id=p_player),1),
   'ranking',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'displayName',coalesce(nullif(data->'playerCard'->>'nickname',''),'Researcher'),'score',score,'favoriteRelicId',coalesce(data->>'favorite','torika'),'frameId',data->'playerCard'->>'frameId','avatarRelicId',case when coalesce(data->'ownedRelicIds','[]'::jsonb) ? (data->'playerCard'->>'avatarRelicId') then data->'playerCard'->>'avatarRelicId' end) order by rank) from ranked where rank<=100),'[]'),
   'records',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'revision',revision::text,'data',jsonb_build_object(
       'ownedRelicIds',data->'ownedRelicIds','relicProgress',data->'relicProgress','runeInventory',data->'runeInventory',
       'duel',data->'duel','favorite',data->'favorite','playerCard',data->'playerCard'))) from pool),'[]')) into out;
 return out;
end $$;

-- 고대 지층 월간 순위(20261103000000_ancient_monthly)도 같은 얼굴을 싣는다. 본문은 그 정의 그대로이고 두 키만 더한다.
create or replace function public.server_ancient_ranking(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='ancient' and period=(date_trunc('month', now() at time zone 'UTC'))::date),
 lines as(select r.rank,jsonb_build_object('rank',r.rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'floor',r.score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika'),'frameId',s.data->'playerCard'->>'frameId','avatarRelicId',case when coalesce(s.data->'ownedRelicIds','[]'::jsonb) ? (s.data->'playerCard'->>'avatarRelicId') then s.data->'playerCard'->>'avatarRelicId' end) doc,r.player_id
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id)
 select jsonb_build_object(
  'me',(select doc from lines where player_id=p_player),
  'entries',coalesce((select jsonb_agg(doc order by rank) from lines where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;
