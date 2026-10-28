begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 week date:=date_trunc('week',now() at time zone 'UTC')::date;
 payload jsonb; entry jsonb; fn record; rid text:='qa-profile-'||gen_random_uuid()::text;
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true);
 update public.players set status='suspended' where id=c;
 insert into public.player_saves(player_id,data,data_hash,save_version) values
 (a,jsonb_build_object('ownedRelicIds',jsonb_build_array('torika','rexia','spina'),'favorite','torika','playerResearch',jsonb_build_object('level',20),'playerCard',jsonb_build_object('nickname','QA A','frameId','frame-test','avatarRelicId','rexia'),'clearedStageIds',jsonb_build_array('ancient:3'),'duel',jsonb_build_object('score',1000,'seasonId','qa-profile-season')),repeat('a',64),1),
 (b,jsonb_build_object('ownedRelicIds',jsonb_build_array('torika','rexia','spina'),'favorite','spina','playerResearch',jsonb_build_object('level',20),'playerCard',jsonb_build_object('nickname','QA B','frameId','frame-basic','avatarRelicId','not-owned'),'clearedStageIds',jsonb_build_array('ancient:2'),'duel',jsonb_build_object('score',900,'seasonId','qa-profile-season')),repeat('b',64),1),
 (c,jsonb_build_object('ownedRelicIds',jsonb_build_array('torika','rexia','spina'),'playerResearch',jsonb_build_object('level',20),'clearedStageIds',jsonb_build_array('ancient:200')),repeat('c',64),1);
 insert into public.server_competitive_scores values
 ('expedition',week,a,20,now(),true),('expedition',week,b,10,now(),true),('expedition',week,c,100,now(),true),
 ('arena',week,a,20,now(),true),('arena',week,b,10,now(),true),('arena',week,c,100,now(),true);
 payload:=public.server_expedition_ranking(a,week,100);
 select x into entry from jsonb_array_elements(payload->'entries') x where x->>'playerId'=a::text;
 if entry->>'avatarRelicId' is distinct from 'rexia' or entry->>'frameId' is distinct from 'frame-test' or entry->>'favoriteRelicId' is distinct from 'torika' then raise exception 'expedition profile missing'; end if;
 select x into entry from jsonb_array_elements(payload->'entries') x where x->>'playerId'=b::text;
 if entry is null or entry->'avatarRelicId' is distinct from 'null'::jsonb then raise exception 'unowned avatar was exposed'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'entries') x where x->>'playerId'=c::text) then raise exception 'suspended player ranked'; end if;
 payload:=public.server_arena_ranking(a,100);
 select x into entry from jsonb_array_elements(payload->'entries') x where x->>'playerId'=a::text;
 if entry->>'avatarRelicId' is distinct from 'rexia' or entry->>'frameId' is distinct from 'frame-test' then raise exception 'arena profile missing'; end if;
 payload:=public.server_ancient_ranking(a,100);
 if payload->'me'->>'avatarRelicId' is distinct from 'rexia' or payload->'me'->>'frameId' is distinct from 'frame-test' then raise exception 'ancient profile missing'; end if;
 payload:=public.server_duel_context(a,'qa-profile-season',1);
 select x into entry from jsonb_array_elements(payload->'ranking') x where x->>'id'=a::text;
 if entry->>'avatarRelicId' is distinct from 'rexia' or entry->>'frameId' is distinct from 'frame-test' then raise exception 'duel profile missing'; end if;
 select x into entry from jsonb_array_elements(payload->'ranking') x where x->>'id'=b::text;
 if entry is null or entry->'avatarRelicId' is distinct from 'null'::jsonb then raise exception 'duel unowned avatar was exposed'; end if;
 insert into public.server_public_profiles(player_id,profile) values(a,jsonb_build_object('displayName','QA A','frameId','frame-test','avatarRelicId','rexia')) on conflict(player_id) do update set profile=excluded.profile;
 insert into public.server_raids(id,definition,owner_id,ends_at) values(rid,jsonb_build_object('id',rid),null,now()+interval '1 hour');
 insert into public.server_raid_members(raid_id,player_id,damage) values(rid,a,50);
 payload:=public.server_raid_context(a,'[]');
 select x into entry from jsonb_array_elements(payload->'records') x where x->'instance'->>'id'=rid;
 if entry is null or entry->'entries'->0->>'avatarRelicId' is distinct from 'rexia' or entry->'entries'->0->>'frameId' is distinct from 'frame-test' then raise exception 'raid profile missing'; end if;
 for fn in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('server_raid_context','server_expedition_ranking','server_arena_ranking','server_duel_context','server_ancient_ranking') loop
  if not fn.prosecdef or has_function_privilege('anon',fn.oid,'execute') or has_function_privilege('authenticated',fn.oid,'execute') or not has_function_privilege('service_role',fn.oid,'execute') then raise exception 'function privileges changed: %',fn.proname; end if;
 end loop;
end $test$;
select 'PASS: raid/expedition/arena/duel/ancient profile fields, unowned-avatar filtering, active-player filtering, permissions; fixtures rolled back' verification;
rollback;
