begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $verify$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); g uuid:=gen_random_uuid();
 line jsonb:='[{},{},{}]'; deck_a jsonb:='[{"relicId":"torika","power":10},{"relicId":"ella","power":10},{"relicId":"deina","power":10}]';
 deck_b jsonb:='[{"relicId":"torika","power":30},{"relicId":"ella","power":30},{"relicId":"deina","power":30}]';
 deck_c jsonb:='[{"relicId":"torika","power":20},{"relicId":"ella","power":20},{"relicId":"deina","power":20}]';
 payload jsonb; tm timestamptz:=now(); slot_b text;
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true);
 insert into public.guilds(id,name,name_key,badge,join_mode) values(g,'Standby QA',g::text,'{}','open');
 insert into public.guild_members(player_id,guild_id,role,name) values(a,g,'leader','QA leader'),(b,g,'member','QA member'),(c,g,'officer','QA officer');
 begin
  perform public.server_guild_call(a,'syncWarStandby','{}','[{"deck":[],"lineup":[]}]',null);
  raise exception 'invalid standby accepted';
 exception when sqlstate 'PT422' then if sqlerrm<>'INVALID_REQUEST' then raise; end if; end;
 perform public.server_guild_call(a,'syncWarStandby','{}',jsonb_build_array(jsonb_build_object('deck',deck_a,'lineup',line)),null);
 perform public.server_guild_call(b,'syncWarStandby','{}',jsonb_build_array(jsonb_build_object('deck',deck_b,'lineup',line)),null);
 perform public.server_guild_call(c,'syncWarStandby','{}',jsonb_build_array(jsonb_build_object('deck',deck_c,'lineup',line)),null);
 if (select count(*) from public.guild_members where guild_id=g and war_standby is not null)<>3 then raise exception 'standby sync failed'; end if;
 if public.server_guild_war_prep(tm) then
  if (select count(*) from public.guild_war_defense where guild_id=g)<>3 then raise exception 'prep sync did not autofill'; end if;
 else
  if exists(select 1 from public.guild_war_defense where guild_id=g) then raise exception 'battle sync changed defense'; end if;
 end if;
 -- Test the time-parameterized helper on this fixture guild only, independent of the real phase.
 delete from public.guild_war_defense where guild_id=g;
 perform public.server_guild_war_autofill(g,1,tm);
 if not exists(select 1 from public.guild_war_defense where player_id=b and slot_id='1:boss:0') or not exists(select 1 from public.guild_war_defense where player_id=c and slot_id='2:boss:0') or not exists(select 1 from public.guild_war_defense where player_id=a and slot_id='3:boss:0') then raise exception 'power-sorted fill failed'; end if;
 perform public.server_guild_war_autofill(g,1,tm);
 if (select count(*) from public.guild_war_defense where guild_id=g)<>3 then raise exception 'autofill not idempotent'; end if;
 if public.server_guild_war_prep(tm) then
  perform public.server_guild_call(a,'clearWarSlot','{}','["1:boss:0"]',null);
  if (select war_bench_at from public.guild_members where player_id=b) is null then raise exception 'clear did not bench member'; end if;
 else
  delete from public.guild_war_defense where player_id=b;
  update public.guild_members set war_bench_at=tm where player_id=b;
 end if;
 perform public.server_guild_war_autofill(g,1,tm+interval '47 hours');
 if exists(select 1 from public.guild_war_defense where player_id=b) then raise exception 'benched member returned early'; end if;
 perform public.server_guild_war_autofill(g,1,tm+interval '48 hours');
 if not exists(select 1 from public.guild_war_defense where player_id=b and slot_id='1:boss:0') then raise exception '48h expiration did not refill'; end if;
 if public.server_guild_war_prep(tm) then
  perform public.server_guild_call(a,'clearWarSlot','{}','["1:boss:0"]',null);
  perform public.server_guild_call(a,'getWarMap','{}','[]',null);
  if exists(select 1 from public.guild_war_defense where player_id=b) then raise exception 'map refilled bench'; end if;
  payload:=public.server_guild_call(b,'placeWarDefense','{}',jsonb_build_array(jsonb_build_object('deck',deck_b,'lineup',line)),'verify-standby-001');
  if (select war_bench_at from public.guild_members where player_id=b) is not null or not exists(select 1 from public.guild_war_defense where player_id=b) then raise exception 'manual placement did not clear bench'; end if;
  -- Opening a map fills eligible empty slots too, without shifting existing defenders.
  delete from public.guild_war_defense where player_id=b;
  perform public.server_guild_call(a,'getWarMap','{}','[]',null);
  if not exists(select 1 from public.guild_war_defense where player_id=b) or not exists(select 1 from public.guild_war_defense where player_id=a and slot_id='3:boss:0') then raise exception 'map autofill moved holders'; end if;
 else
  begin
   perform public.server_guild_call(b,'placeWarDefense','{}',jsonb_build_array(jsonb_build_object('deck',deck_b,'lineup',line)),'verify-standby-001'); raise exception 'battle placement allowed';
  exception when sqlstate 'PT422' then if sqlerrm<>'WAR_LOCKED' then raise; end if; end;
 end if;
 if coalesce(current_setting('app.guild_verify_match',true),'')='1' then
  -- Isolated database only: the matcher touches all guilds, never run this branch remotely.
  delete from public.guild_war_defense where guild_id=g;
  update public.guild_members set war_bench_at=null where guild_id=g;
  perform public.server_guild_war_match_day(99999);
  if (select count(*) from public.guild_war_defense where guild_id=g)<>3 then raise exception 'matcher did not fill standby members'; end if;
 end if;
 if has_function_privilege('anon','public.server_guild_call(uuid,text,jsonb,jsonb,text)','EXECUTE') or has_function_privilege('authenticated','public.server_guild_call(uuid,text,jsonb,jsonb,text)','EXECUTE') then raise exception 'client direct RPC permission opened'; end if;
end $verify$;
select 'PASS: standby validation/sync, phase gate, power-order fill, no duplicate placement, 47h exclusion/48h return, phase-specific manual placement, permissions' as verification;
rollback;
