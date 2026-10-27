-- 격리 로컬 DB 전용. 모두 롤백하며 운영 저장·잔액을 변경하지 않는다.
begin;
do $test$
declare
  actor constant uuid := '00000000-0000-0000-0000-000000000001';
  saved public.player_saves; before_count bigint; after_count bigint; result jsonb;
begin
  select * into strict saved from public.player_saves where player_id = actor;
  select count(*) into before_count from public.currency_log where player_id = actor;
  if before_count <> 1 then raise exception 'initial wallet gain missing'; end if;
  if not exists(select 1 from public.currency_log where player_id=actor and asset='gems' and delta=999 and source='initial') then
    raise exception 'initial wallet source or amount mismatch';
  end if;

  perform public.server_commit_state(actor, saved.revision, '{"wallet":{"gems":4999,"stamina":10}}',
    repeat('c',64), 1, '{}', 'claimQuestRewards', 'currency-gain-test', '{}');
  select * into saved from public.player_saves where player_id=actor;
  if not exists(select 1 from public.currency_log where player_id=actor and asset='gems' and delta=4000 and balance_after=4999 and source='claimQuestRewards' and request_id='currency-gain-test') then
    raise exception 'gain source, balance or request mismatch';
  end if;
  if not exists(select 1 from public.currency_log where player_id=actor and asset='stamina' and delta=10) then
    raise exception 'explicit stamina gain missing';
  end if;
  perform public.server_commit_state(actor, saved.revision, '{"wallet":{"gems":4899,"stamina":11}}',
    repeat('d',64), 1, '{}', 'purchaseProduct', 'currency-spend-test', '{}');
  select * into saved from public.player_saves where player_id=actor;
  if not exists(select 1 from public.currency_log where player_id=actor and asset='gems' and delta=-100 and balance_after=4899 and source='purchaseProduct') then
    raise exception 'spend record missing';
  end if;

  -- 미적용 어드민 조정 +1과 자연 회복 스테미나 +1을 같은 조회 호출로 반영한다.
  perform public.server_commit_state(actor, saved.revision, '{"wallet":{"gems":4900,"stamina":12}}',
    repeat('e',64), 1, '{}', 'getPlayerState', 'currency-admin-test', '{}');
  select * into saved from public.player_saves where player_id=actor;
  if not exists(select 1 from public.currency_log where player_id=actor and asset='gems' and delta=1 and source='admin_adjust') then
    raise exception 'admin adjustment not separated';
  end if;
  if exists(select 1 from public.currency_log where player_id=actor and asset='stamina' and request_id='currency-admin-test') then
    raise exception 'natural stamina regeneration must not be logged';
  end if;
  select count(*) into before_count from public.currency_log where player_id=actor;
  perform public.server_commit_state(actor, saved.revision, saved.data, repeat('f',64), 1, '{}', 'getPlayerState', 'currency-noop-test', '{}');
  select * into saved from public.player_saves where player_id=actor;
  select count(*) into after_count from public.currency_log where player_id=actor;
  if before_count <> after_count then raise exception 'unchanged wallet created logs'; end if;
  begin
    perform public.server_commit_state(actor, saved.revision-1, '{"wallet":{"gems":0}}', repeat('a',64),1,'{}','purchaseProduct','currency-conflict-test','{}');
    raise exception 'expected revision conflict';
  exception when sqlstate 'PT409' then null;
  end;
  if exists(select 1 from public.currency_log where request_id='currency-conflict-test') then raise exception 'failed save created logs'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
  result := public.admin_currency_log(actor);
  if jsonb_array_length(result->'rows') <> after_count or (result->>'bigCount7d')::int <> 1 then
    raise exception 'admin history or alert summary mismatch: %',result;
  end if;
  if has_table_privilege('authenticated','public.currency_log','select')
    or has_table_privilege('anon','public.currency_log','select')
    or has_function_privilege('anon','public.admin_currency_log(uuid,text,text,bigint,integer)','execute')
    or has_function_privilege('authenticated','public.server_prune_currency_log(integer)','execute') then
    raise exception 'currency log permission boundary exposed';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.currency_log'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.currency_alert_rules'::regclass) then
    raise exception 'currency tables must enable RLS';
  end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
end $test$;
set local role authenticated;
do $test$
begin
  perform public.admin_currency_log('00000000-0000-0000-0000-000000000001');
  raise exception 'non-admin must not read currency log';
exception when insufficient_privilege then null;
end $test$;
reset role;
rollback;
