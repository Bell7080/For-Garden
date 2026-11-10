-- Isolated database only; the launch timestamp below is a rolled-back fixture.
begin;
do $verify$
declare r jsonb; fixture timestamptz := '2026-12-01 00:00:00+00';
begin
  if public.server_launch_at() is not null then raise exception 'migration launched the game'; end if;
  r := public.get_public_config();
  if not (r ? 'launch_at') or r->'launch_at' <> 'null'::jsonb
     or not (r ?& array['maintenance','message','ends_at','min_version','latest_version','server_time','launch_epoch','schedule'])
    then raise exception 'public config lost fields or null launch timestamp'; end if;
  update public.app_config set launch_at = fixture where id = 1;
  if public.server_launch_at() is distinct from fixture
     or (public.get_public_config()->>'launch_at')::timestamptz is distinct from fixture
     or public.get_public_config()->'schedule' is distinct from public.server_live_schedule()
    then raise exception 'public/server launch timestamp or schedule differs'; end if;
  if has_function_privilege('anon','public.server_launch_at()','EXECUTE')
     or has_function_privilege('authenticated','public.server_launch_at()','EXECUTE')
     or not has_function_privilege('service_role','public.server_launch_at()','EXECUTE')
    then raise exception 'server launch RPC exposed'; end if;
end $verify$;
select 'PASS: launch migration preserves prelaunch state, config fields and schedule; timestamp RPC restricted to service_role';
rollback;
