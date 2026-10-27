begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); stamp timestamptz; payload jsonb; row_a jsonb; row_b jsonb;
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true);
 update public.players set status='suspended' where id=c;
 if public.server_ancient_floor('{"clearedStageIds":["ancient:1","ancient:200","1-10","ancient:garbage"]}')<>200 or public.server_ancient_floor('{}')<>0 then raise exception 'floor extraction failed'; end if;
 insert into public.player_saves(player_id,data,data_hash,save_version) values
 (a,'{"wallet":{"gems":0},"favorite":"torika","clearedStageIds":["ancient:20"]}',repeat('a',64),1),
 (b,'{"wallet":{"gems":0},"favorite":"ella","clearedStageIds":["ancient:30"]}',repeat('b',64),1),
 (c,'{"wallet":{"gems":0},"clearedStageIds":["ancient:200"]}',repeat('c',64),1);
 if not exists(select 1 from public.server_competitive_scores where player_id=a and board='ancient' and period='1970-01-01' and score=20) then raise exception 'insert trigger failed'; end if;
 update public.server_competitive_scores set achieved_at='2001-01-01' where player_id=a and board='ancient';
 update public.player_saves set data=data||'{"other":true}' where player_id=a;
 select achieved_at into stamp from public.server_competitive_scores where player_id=a and board='ancient';
 if stamp<>'2001-01-01'::timestamptz then raise exception 'same-floor timestamp changed'; end if;
 update public.server_competitive_scores set achieved_at='2000-01-01' where player_id=b and board='ancient';
 update public.player_saves set data=jsonb_set(data,'{clearedStageIds}','["ancient:30"]') where player_id=a;
 if not exists(select 1 from public.server_competitive_scores where player_id=a and board='ancient' and score=30 and achieved_at=now()) then raise exception 'advance trigger failed'; end if;
 payload:=public.server_ancient_ranking(a,100);
 select x into row_a from jsonb_array_elements(payload->'entries') x where x->>'playerId'=a::text;
 select x into row_b from jsonb_array_elements(payload->'entries') x where x->>'playerId'=b::text;
 if row_a is null or row_b is null or (row_b->>'rank')::integer >= (row_a->>'rank')::integer then raise exception 'tie order failed'; end if;
 if row_a->>'favoriteRelicId'<>'torika' or payload->'me'->>'playerId'<>a::text then raise exception 'ranking DTO failed'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'entries') x where x->>'playerId'=c::text) then raise exception 'blocked player ranked'; end if;
 payload:=public.server_ancient_ranking(a,0);
 if jsonb_array_length(payload->'entries')<>0 or payload->'me'->>'playerId'<>a::text then raise exception 'limit/me failed'; end if;
 update public.player_saves set data=jsonb_set(data,'{clearedStageIds}','["ancient:10"]') where player_id=a;
 if not exists(select 1 from public.server_competitive_scores where player_id=a and board='ancient' and score=30) then raise exception 'best floor decreased'; end if;
 perform public.server_competitive_rewards(a,'[{"upTo":null,"gems":100,"salvageRecord":1}]');
 if exists(select 1 from public.server_competitive_results where player_id=a and board='ancient') or exists(select 1 from public.server_competitive_awards where player_id=a) then raise exception 'ancient weekly reward created'; end if;
 insert into public.server_competitive_results values('ancient','1970-01-01',a,1);
 insert into public.server_competitive_scores values('duel','1901-01-07',a,1000,now(),true),('expedition','1901-01-07',a,1000,now(),true);
 perform public.server_competitive_rewards(a,'[{"upTo":null,"gems":100,"salvageRecord":1}]');
 if exists(select 1 from public.server_competitive_awards where player_id=a and board='ancient') then raise exception 'existing ancient result awarded'; end if;
 if (select count(*) from public.server_competitive_awards where player_id=a and board in ('duel','expedition'))<>2 then raise exception 'existing weekly rewards regressed'; end if;
 if has_function_privilege('anon','public.server_ancient_ranking(uuid,integer)','EXECUTE') or has_function_privilege('authenticated','public.server_ancient_ranking(uuid,integer)','EXECUTE') or not has_function_privilege('service_role','public.server_ancient_ranking(uuid,integer)','EXECUTE') then raise exception 'ranking privileges failed'; end if;
end $test$;
select 'PASS: trigger, best-floor, tie timestamp, DTO, blocked filtering, limit, no ancient weekly rewards, existing weekly rewards, permissions' as verification;
rollback;
