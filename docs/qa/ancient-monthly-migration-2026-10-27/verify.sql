begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 this_month date:=date_trunc('month',now() at time zone 'UTC')::date;
 prior_month date:=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date;
 other_month date:=(date_trunc('month',now() at time zone 'UTC')-interval '2 months')::date;
 stamp timestamptz; payload jsonb;
 rules jsonb:='{"ranks":[{"upTo":1,"gems":3000},{"upTo":2,"gems":2500}],"percents":[{"upToPercent":50,"gems":300}],"participation":200}';
begin
 if public.server_ancient_season_period('{}')<>this_month
 or public.server_ancient_season_period(jsonb_build_object('ancientSeason',to_char(prior_month,'YYYY-MM')))<>prior_month
 then raise exception 'season period failed'; end if;
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true);
 update public.players set status='suspended' where id=c;
 insert into public.player_saves(player_id,data,data_hash,save_version) values
 (a,jsonb_build_object('favorite','torika','clearedStageIds',jsonb_build_array('ancient:20'),'ancientSeason',to_char(this_month,'YYYY-MM')),repeat('a',64),1),
 (b,jsonb_build_object('favorite','ella','clearedStageIds',jsonb_build_array('ancient:30'),'ancientSeason',to_char(prior_month,'YYYY-MM')),repeat('b',64),1),
 (c,jsonb_build_object('clearedStageIds',jsonb_build_array('ancient:200'),'ancientSeason',to_char(this_month,'YYYY-MM')),repeat('c',64),1);
 if not exists(select 1 from public.server_competitive_scores where player_id=a and board='ancient' and period=this_month and score=20)
 or not exists(select 1 from public.server_competitive_scores where player_id=b and board='ancient' and period=prior_month and score=30)
 or exists(select 1 from public.server_competitive_scores where player_id=b and board='ancient' and period=this_month)
 then raise exception 'season-aware trigger failed'; end if;
 payload:=public.server_ancient_ranking(a,100);
 if payload->'me'->>'playerId'<>a::text or payload->'me'->>'favoriteRelicId'<>'torika'
 or exists(select 1 from jsonb_array_elements(payload->'entries') x where x->>'playerId' in(b::text,c::text))
 then raise exception 'current-month ranking filtering failed'; end if;
 update public.server_competitive_scores set achieved_at='2001-01-01' where player_id=a and board='ancient';
 update public.player_saves set data=data||'{"other":true}' where player_id=a;
 select achieved_at into stamp from public.server_competitive_scores where player_id=a and board='ancient' and period=this_month;
 if stamp<>'2001-01-01'::timestamptz then raise exception 'same-floor timestamp changed'; end if;
 update public.player_saves set data=jsonb_set(data,'{clearedStageIds}','["ancient:40"]') where player_id=a;
 if not exists(select 1 from public.server_competitive_scores where player_id=a and board='ancient' and period=this_month and score=40 and achieved_at=now())
 then raise exception 'advanced-floor trigger failed'; end if;
 update public.player_saves set data=data||jsonb_build_object('ancientSeason',to_char(this_month,'YYYY-MM'),'clearedStageIds',jsonb_build_array('ancient:1')) where player_id=b;
 if not exists(select 1 from public.server_competitive_scores where player_id=b and board='ancient' and period=prior_month and score=30)
 or not exists(select 1 from public.server_competitive_scores where player_id=b and board='ancient' and period=this_month and score=1)
 then raise exception 'monthly reset overwrote prior month'; end if;
 payload:=public.server_ancient_ranking(a,0);
 if jsonb_array_length(payload->'entries')<>0 or payload->'me'->>'playerId'<>a::text then raise exception 'ranking limit failed'; end if;
 insert into public.server_competitive_scores values('ancient',prior_month,a,10,now(),true),('ancient',prior_month,c,200,now(),true);
 perform public.server_competitive_rewards(a,'[{"upTo":null,"gems":100,"salvageRecord":1}]');
 if exists(select 1 from public.server_competitive_results where player_id in(a,b,c) and board='ancient') then raise exception 'weekly rewards included ancient'; end if;
 perform public.server_ancient_monthly_rewards(b,rules);
 perform public.server_ancient_monthly_rewards(a,rules);
 if not exists(select 1 from public.server_competitive_awards where player_id=b and board='ancient' and period=prior_month and gems=3000)
 or not exists(select 1 from public.server_competitive_awards where player_id=a and board='ancient' and period=prior_month and gems=2500)
 or exists(select 1 from public.server_competitive_results where player_id=c and board='ancient')
 or exists(select 1 from public.server_competitive_awards where player_id in(a,b,c) and period=this_month)
 then raise exception 'monthly settlement failed'; end if;
 perform public.server_ancient_monthly_rewards(a,rules);
 if (select count(*) from public.server_competitive_awards where player_id=a and board='ancient')<>1
 or (select count(*) from public.mails where target_player=a)<>1 then raise exception 'duplicate monthly mail'; end if;
 insert into public.server_competitive_results values('ancient',other_month,a,2),('ancient',other_month,b,1);
 perform public.server_ancient_monthly_rewards(a,'{"ranks":[{"upTo":1,"gems":3000}],"percents":[{"upToPercent":100,"gems":400}],"participation":200}');
 if not exists(select 1 from public.server_competitive_awards where player_id=a and board='ancient' and period=other_month and gems=400) then raise exception 'percent reward failed'; end if;
 insert into public.server_competitive_results values('ancient',(other_month-interval '1 month')::date,a,2);
 perform public.server_ancient_monthly_rewards(a,'{"ranks":[{"upTo":1,"gems":3000}],"percents":[{"upToPercent":50,"gems":400}],"participation":200}');
 if not exists(select 1 from public.server_competitive_awards where player_id=a and board='ancient' and period=(other_month-interval '1 month')::date and gems=200) then raise exception 'participation reward failed'; end if;
 if has_function_privilege('anon','public.server_ancient_monthly_rewards(uuid,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.server_ancient_monthly_rewards(uuid,jsonb)','EXECUTE')
 or not has_function_privilege('service_role','public.server_ancient_monthly_rewards(uuid,jsonb)','EXECUTE')
 or has_function_privilege('anon','public.server_ancient_season_period(jsonb)','EXECUTE')
 then raise exception 'function permissions failed'; end if;
end $test$;
select 'PASS: season trigger, month isolation, ranking, timestamps, monthly reset, weekly exclusion, monthly rank rewards, percent rewards, participation rewards, idempotent mail, permissions; all fixtures rolled back' verification;
rollback;
