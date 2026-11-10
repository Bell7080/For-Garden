-- Read-only. Requires all eight migrations; never runs fixture mutations.
select jsonb_build_object(
'migrations',(select jsonb_agg(jsonb_build_object('name',name,'version',version) order by version) from supabase_migrations.schema_migrations where name in ('ops_moderation','ops_console_v3','ops_console_v4','game_events','ops_analytics','live_schedule','ops_schedule','launch_at')),
'new_table_count',(select count(*) from pg_tables where schemaname='public' and tablename in ('banned_words','player_profile_actions','ops_banners','server_competitive_bans','purchase_records','ops_anomaly_rules','ops_anomaly_acks','game_events','game_call_daily','live_schedule')),
'table_security_failures',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('banned_words','player_profile_actions','ops_banners','server_competitive_bans','purchase_records','ops_anomaly_rules','ops_anomaly_acks','game_events','game_call_daily','live_schedule') and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
'schedule_matches',public.get_public_config()->'schedule'=public.server_live_schedule(),
'launch_at_is_null',public.server_launch_at() is null and public.get_public_config()->'launch_at'='null'::jsonb,
'server_rpc_exposed',has_function_privilege('authenticated','public.server_launch_at()','EXECUTE') or has_function_privilege('anon','public.server_launch_at()','EXECUTE') or has_function_privilege('authenticated','public.server_live_schedule()','EXECUTE'),
'server_service_access',has_function_privilege('service_role','public.server_launch_at()','EXECUTE') and has_function_privilege('service_role','public.server_live_schedule()','EXECUTE'),
'admin_anon_exposed',has_function_privilege('anon','public.admin_list_schedule()','EXECUTE') or has_function_privilege('anon','public.admin_analytics(integer)','EXECUTE'),
'admin_player_route_exists',has_function_privilege('authenticated','public.admin_list_schedule()','EXECUTE') and has_function_privilege('authenticated','public.admin_set_schedule(jsonb)','EXECUTE'),
'schedule_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_list_schedule','admin_set_schedule','admin_clear_schedule') and p.prosrc like '%private.admin_can%')
) as verification;
