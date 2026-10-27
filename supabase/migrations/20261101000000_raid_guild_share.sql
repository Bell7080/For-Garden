-- 레이드 소환 공유 확대: 친구에 더해 같은 길드원도 서로의 소환 레이드를 보고 참여한다.
-- 순위 줄에는 참가자의 프로필 테두리(frameId)를 함께 내려 클라이언트가 프로필 얼굴로 그린다.
-- 규칙: 소환자와 참가자가 친구이거나 같은 길드이면 공유. 기존 참가 기록·월드 레이드는 그대로다.

create or replace function public.server_raid_shared(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.server_are_friends(p_a,p_b)
  or exists(select 1 from public.guild_members x join public.guild_members y on y.guild_id=x.guild_id where x.player_id=p_a and y.player_id=p_b);
$$;
revoke all on function public.server_raid_shared(uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_raid_shared(uuid,uuid) to service_role;

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
       select jsonb_build_object('rank',row_number() over(order by x.damage desc,x.player_id),'playerId',x.player_id,'displayName',coalesce(p.profile->>'displayName','연구원'),'favoriteRelicId',p.profile->'favoriteRelic'->>'relicId','frameId',p.profile->>'frameId','damage',x.damage,'isMe',x.player_id=p_player) v
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

create or replace function public.server_commit_state_before_duels(p_player uuid, p_expected_revision bigint, p_data jsonb,
  p_hash text, p_version integer, p_summary jsonb, p_method text, p_request text, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare change jsonb; raid public.server_raids; member public.server_raid_members; result jsonb; profile jsonb; canonical_uid text;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for change in select value from jsonb_array_elements(coalesce(p_summary->'_raids','[]'::jsonb)) order by value->'instance'->>'id' loop
   select * into raid from public.server_raids where id=change->'instance'->>'id' for update;
   if not found then
     if change->>'expectedRevision' is not null or change->'instance'->>'kind'<>'summon' then raise exception 'raid_conflict' using errcode='PT409'; end if;
     insert into public.server_raids(id,definition,owner_id,ends_at) values(change->'instance'->>'id',change->'instance',p_player,(change->'instance'->>'endsAt')::timestamptz) returning * into raid;
   elsif raid.revision::text is distinct from change->>'expectedRevision' then raise exception 'raid_conflict' using errcode='PT409'; end if;
   if raid.owner_id is not null and raid.owner_id<>p_player and not public.server_raid_shared(p_player,raid.owner_id) and not exists(select 1 from public.server_raid_members where raid_id=raid.id and player_id=p_player) then raise exception 'raid_forbidden' using errcode='PT403'; end if;
   if (change->>'damageDelta')::bigint<0 or (change->>'appliedDelta')::bigint<0 or (change->>'attemptsDelta')::int not between 0 and 1 or raid.damage+(change->>'appliedDelta')::bigint>(change->>'totalHp')::bigint then raise exception 'invalid_raid_delta'; end if;
   insert into public.server_raid_members(raid_id,player_id) values(raid.id,p_player) on conflict do nothing;
   select * into member from public.server_raid_members where raid_id=raid.id and player_id=p_player for update;
   if (change->'instance'->>'settled')::boolean and member.settled and (change->>'damageDelta')::bigint>0 then raise exception 'raid_already_settled'; end if;
   update public.server_raid_members set damage=damage+(change->>'damageDelta')::bigint,applied_damage=applied_damage+(change->>'appliedDelta')::bigint,attempts=attempts+(change->>'attemptsDelta')::integer,settled=(change->'instance'->>'settled')::boolean where raid_id=raid.id and player_id=p_player;
   update public.server_raids set revision=revision+1,damage=damage+(change->>'appliedDelta')::bigint where id=raid.id;
 end loop;
 result:=public.server_commit_state_base(p_player,p_expected_revision,p_data,p_hash,p_version,p_summary-'_raids'-'_profile',p_method,p_request,p_response);
 perform public.server_sync_player_meta(p_player,p_data,p_summary);
 profile:=p_summary->'_profile';
 if profile is not null then
   select uid::text into canonical_uid from public.players where id=p_player;
   profile:=profile||jsonb_build_object('id',p_player,'uid',canonical_uid,'lastActiveAt',floor(extract(epoch from now())*1000));
   insert into public.server_public_profiles(player_id,profile) values(p_player,profile) on conflict(player_id) do update set profile=excluded.profile,updated_at=now();
 end if;
 return result;
end $$;

-- 이름만 바꿔 다시 쓰는 안쪽 본문이라 바깥 껍데기(duels·ledger)와 권한은 그대로다.
revoke all on function public.server_commit_state_before_duels(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.server_commit_state_before_duels(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) to service_role;
