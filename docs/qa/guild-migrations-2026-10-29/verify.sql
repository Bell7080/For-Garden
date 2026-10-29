begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $verify$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); h uuid:=gen_random_uuid();
 key1 text:=gen_random_uuid()::text; key2 text:=gen_random_uuid()::text; actor jsonb:='{}'; payload jsonb;
 deck1 jsonb:='[{"relicId":"torika","power":100},{"relicId":"ella","power":100},{"relicId":"deina","power":100}]';
 deck2 jsonb:='[{"relicId":"torika","power":200},{"relicId":"ella","power":200},{"relicId":"deina","power":200}]';
 line jsonb:='[{},{},{}]'; slots text[]; lv integer; is_prep boolean:=coalesce(current_setting('app.guild_verify_fixed_prep',true),'')='1' or public.server_guild_war_prep(now());
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true);
 insert into public.guilds(id,name,name_key,badge,join_mode) values(g,'Migration QA',key1,'{}','open'),(h,'Other QA',key2,'{}','open');
 insert into public.guild_members(player_id,guild_id,role,name) values(a,g,'leader','QA leader'),(b,g,'member','QA member'),(c,g,'officer','QA officer');
 payload:=public.server_guild_call(a,'renameGuild',actor,jsonb_build_array(jsonb_build_object('name','Renamed QA','nameKey',key1||'-new')),'verify-rename-01');
 if payload->>'changed'<>'true' or not exists(select 1 from public.guilds where id=g and name='Renamed QA') then raise exception 'rename failed'; end if;
 payload:=public.server_guild_call(a,'renameGuild',actor,jsonb_build_array(jsonb_build_object('name','Renamed QA','nameKey',key1||'-new')),'verify-rename-01');
 if payload->>'changed'<>'true' or (select count(*) from public.guild_receipts where player_id=a and request_id='verify-rename-01')<>1 then raise exception 'rename replay failed'; end if;
 begin
  perform public.server_guild_call(b,'renameGuild',actor,'[{"name":"Unauthorized","nameKey":"bad"}]','verify-rename-02');
  raise exception 'member renamed guild';
 exception when sqlstate 'PT422' then if sqlerrm<>'NO_PERMISSION' then raise; end if; end;
 begin
  perform public.server_guild_call(a,'renameGuild',actor,jsonb_build_array(jsonb_build_object('name','Other QA','nameKey',key2)),'verify-rename-03');
  raise exception 'duplicate name accepted';
 exception when sqlstate 'PT422' then if sqlerrm<>'NAME_TAKEN' then raise; end if; end;
 begin
  perform public.server_guild_call(a,'renameGuild',actor,'[{"name":"Bad request","nameKey":"bad"}]',null);
  raise exception 'missing request id accepted';
 exception when sqlstate 'PT400' then if sqlerrm<>'request_id_required' then raise; end if; end;
 for lv in 1..10 loop
  if exists(select 1 from public.server_guild_war_order(lv) where not public.server_guild_war_slot_open(lv,slot_id)) then raise exception 'closed slot in auto order'; end if;
  select array_agg(slot_id order by ord) into slots from public.server_guild_war_order(lv);
  if slots[1:3]<>array['1:boss:0','2:boss:0','3:boss:0'] or (select count(*)<>count(distinct slot_id) from public.server_guild_war_order(lv)) then raise exception 'auto order failed'; end if;
 end loop;
 if is_prep then
  payload:=public.server_guild_call(a,'placeWarDefense',actor,jsonb_build_array(jsonb_build_object('deck',deck1,'lineup',line)),'verify-place-001');
  if payload->>'mySlotId'<>'1:boss:0' then raise exception 'first auto placement failed'; end if;
  payload:=public.server_guild_call(b,'placeWarDefense',actor,jsonb_build_array(jsonb_build_object('deck',deck2,'lineup',line)),'verify-place-002');
  if payload->>'mySlotId'<>'2:boss:0' then raise exception 'next auto placement failed'; end if;
  payload:=public.server_guild_call(a,'placeWarDefense',actor,jsonb_build_array(jsonb_build_object('deck',deck2,'lineup',line)),'verify-place-003');
  if payload->>'mySlotId'<>'1:boss:0' then raise exception 'existing slot moved'; end if;
  payload:=public.server_guild_call(a,'placeWarDefense',actor,jsonb_build_array(jsonb_build_object('deck',deck2,'lineup',line)),'verify-place-003');
  if payload->>'mySlotId'<>'1:boss:0' then raise exception 'placement replay failed'; end if;
  begin
   perform public.server_guild_call(b,'autoArrangeWar',actor,'[]',null); raise exception 'member auto-arranged';
  exception when sqlstate 'PT422' then if sqlerrm<>'NO_PERMISSION' then raise; end if; end;
  begin
   perform public.server_guild_call(b,'moveWarSlot',actor,'["1:boss:0","2:boss:0"]',null); raise exception 'member moved slots';
  exception when sqlstate 'PT422' then if sqlerrm<>'NO_PERMISSION' then raise; end if; end;
  perform public.server_guild_call(a,'moveWarSlot',actor,'["1:boss:0","2:boss:0"]',null);
  if not exists(select 1 from public.guild_war_defense where player_id=a and slot_id='2:boss:0') or not exists(select 1 from public.guild_war_defense where player_id=b and slot_id='1:boss:0') then raise exception 'slot swap failed'; end if;
  perform public.server_guild_call(c,'moveWarSlot',actor,'["2:boss:0","3:elite:0"]',null);
  if not exists(select 1 from public.guild_war_defense where player_id=a and slot_id='3:elite:0') then raise exception 'officer move failed'; end if;
  update public.guild_war_defense set deck=deck1 where player_id=a;
  perform public.server_guild_call(a,'autoArrangeWar',actor,'[]',null);
  if not exists(select 1 from public.guild_war_defense where player_id=b and slot_id='1:boss:0') or not exists(select 1 from public.guild_war_defense where player_id=a and slot_id='2:boss:0') then raise exception 'power auto-arrangement failed'; end if;
 else
  begin
   perform public.server_guild_call(a,'placeWarDefense',actor,jsonb_build_array(jsonb_build_object('deck',deck1,'lineup',line)),'verify-place-001'); raise exception 'battle placement allowed';
  exception when sqlstate 'PT422' then if sqlerrm<>'WAR_LOCKED' then raise; end if; end;
  begin
   perform public.server_guild_call(a,'autoArrangeWar',actor,'[]',null); raise exception 'battle auto-arrange allowed';
  exception when sqlstate 'PT422' then if sqlerrm<>'WAR_LOCKED' then raise; end if; end;
  begin
   perform public.server_guild_call(a,'moveWarSlot',actor,'["1:boss:0","2:boss:0"]',null); raise exception 'battle movement allowed';
  exception when sqlstate 'PT422' then if sqlerrm<>'WAR_LOCKED' then raise; end if; end;
 end if;
 if has_function_privilege('anon','public.server_guild_call(uuid,text,jsonb,jsonb,text)','EXECUTE') or has_function_privilege('authenticated','public.server_guild_call(uuid,text,jsonb,jsonb,text)','EXECUTE') or not has_function_privilege('service_role','public.server_guild_call(uuid,text,jsonb,jsonb,text)','EXECUTE') then raise exception 'RPC permissions failed'; end if;
end $verify$;
select 'PASS: rename, replay, member rejection, duplicate rejection, request guard, levels 1-10 order, phase-specific placement/movement, RPC permissions' as verification;
rollback;
