-- Isolated database only. Never run fixture writes against shared Supabase projects.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $verify$
declare
  owner_id uuid := gen_random_uuid();
  operator_id uuid := gen_random_uuid();
  viewer_id uuid := gen_random_uuid();
  cs_id uuid := gen_random_uuid();
  player_id_ uuid := gen_random_uuid();
  r jsonb; saved jsonb; role_id uuid; stmt text; event_count bigint;
begin
  insert into auth.users(id, is_anonymous) values
    (owner_id, true), (operator_id, true), (viewer_id, true), (cs_id, true), (player_id_, true);
  insert into public.admin_roles(user_id, role) values
    (owner_id, 'owner'), (operator_id, 'operator'), (viewer_id, 'viewer'), (cs_id, 'cs');
  perform set_config('app.ledger_method', 'migration-fixture', true);
  insert into public.player_saves(player_id, data, data_hash, save_version)
    values (player_id_, '{"tutorial":{"completedStepIds":[]},"clearedStageIds":[],"playerResearch":{"level":1},"missions":{"lifetime":{"relic_research_completed":0}}}', repeat('a',64), 1);
  saved := '{"tutorial":{"completedStepIds":["pull"]},"clearedStageIds":["1-5","1-10","ancient:1"],"playerResearch":{"level":3},"missions":{"lifetime":{"relic_research_completed":10}}}';
  update public.player_saves set data = saved where player_id = player_id_;
  if (select count(*) from public.game_events where player_id = player_id_ and kind = 'tutorial_step' and detail = 'pull') <> 1
     or (select count(*) from public.game_events where player_id = player_id_ and kind = 'stage_clear') <> 2
     or exists(select 1 from public.game_events where player_id = player_id_ and detail like 'ancient:%')
     or (select count(*) from public.game_events where player_id = player_id_ and kind = 'player_level') <> 3
     or (select sum(amount) from public.game_events where player_id = player_id_ and kind = 'research') is distinct from 10::bigint
  then raise exception 'analytics trigger lost or duplicated progression'; end if;
  select count(*) into event_count from public.game_events where player_id = player_id_;
  update public.player_saves set data = saved where player_id = player_id_;
  if (select count(*) from public.game_events where player_id = player_id_) <> event_count
     or (select calls from public.game_call_daily where method = 'migration-fixture') is distinct from 3::bigint
  then raise exception 'repeat save duplicated events or call counter failed'; end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  r := public.admin_analytics(30);
  if r->'funnel'->>'stage1_5' <> '1' or r->'funnel'->>'tutorial' <> '1'
     or (r->'research7d'->>'pulls')::int <> 10
    then raise exception 'analytics RPC did not aggregate real fixtures: %', r; end if;
  -- A telemetry constraint failure must not reject a valid save.
  perform set_config('app.ledger_method', repeat('x',65), true);
  update public.player_saves set data = jsonb_set(saved, '{tutorial,completedStepIds}', '["pull","fixture"]') where player_id = player_id_;
  if not (select data->'tutorial'->'completedStepIds' ? 'fixture' from public.player_saves where player_id = player_id_)
     or exists(select 1 from public.game_events where player_id = player_id_ and detail = 'fixture')
    then raise exception 'telemetry failure did not leave save intact'; end if;
  perform set_config('app.ledger_method', 'migration-fixture', true);
  if public.server_live_schedule() <> '[]'::jsonb then raise exception 'unexpected initial schedule'; end if;
  perform public.admin_set_schedule('{"kind":"banner","id":"fixture","enabled":false,"note":"private-operator-note"}');
  if not exists(select 1 from jsonb_array_elements(public.server_live_schedule()) x where x->>'id' = 'fixture' and x->>'enabled' = 'false')
    then raise exception 'server schedule missing override'; end if;
  r := public.get_public_config();
  if r->'schedule' is distinct from public.server_live_schedule() or r::text like '%private-operator-note%'
    then raise exception 'public schedule differs or leaks note'; end if;
  begin
    perform public.admin_set_schedule('{"kind":"banner","id":"fixture","startsAt":"2026-12-02","endsAt":"2026-12-01"}');
    raise exception 'invalid interval accepted';
  exception when raise_exception then if sqlerrm <> 'invalid_period' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', operator_id::text, true);
  perform public.admin_set_schedule('{"kind":"banner","id":"fixture","enabled":true}');
  perform public.admin_clear_schedule('banner', 'fixture');
  if public.server_live_schedule() <> '[]'::jsonb then raise exception 'schedule clear failed'; end if;
  if (select count(*) from public.admin_audit_log where action in ('schedule_set','schedule_clear') and target = 'live_schedule:banner:fixture') <> 3
    then raise exception 'schedule mutations not audited'; end if;

  foreach role_id in array array[viewer_id, cs_id, player_id_] loop
    perform set_config('request.jwt.claim.sub', role_id::text, true);
    if role_id <> player_id_ then perform public.admin_analytics(30); perform public.admin_list_schedule(); end if;
    foreach stmt in array array[
      'select public.admin_set_schedule(''{"kind":"banner","id":"forbidden"}'')',
      'select public.admin_clear_schedule(''banner'',''fixture'')'
    ] loop
      begin execute stmt; raise exception 'unauthorized schedule mutation';
      exception when insufficient_privilege then null; end;
    end loop;
  end loop;
  foreach stmt in array array['select public.admin_analytics(30)', 'select public.admin_list_schedule()'] loop
    begin execute stmt; raise exception 'ordinary player entered admin RPC';
    exception when insufficient_privilege then null; end;
  end loop;
  if has_function_privilege('anon', 'public.admin_analytics(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.server_live_schedule()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.server_live_schedule()', 'EXECUTE')
    then raise exception 'RPC privilege boundary failed'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('game_events','game_call_daily','live_schedule')
      and (not c.relrowsecurity or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        or has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')))
    then raise exception 'new tables exposed'; end if;
end $verify$;
select 'PASS: progression telemetry, repeated saves, fail-open save, analytics aggregation, schedule override/clear/audit, role and RLS boundaries';
rollback;
