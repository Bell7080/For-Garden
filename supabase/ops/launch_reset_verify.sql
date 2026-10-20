-- 초기화 결과 점검. 읽기 전용이며 launch_reset.sql 실행 직후, 그리고 오픈 직전에 한 번 더 돌린다.
-- 결과 맨 위 한 줄(check = 'ALL')의 ok가 true이고 ok=false인 줄이 하나도 없어야 "테스트 잔재 없음"이다.
-- review 줄은 합격/불합격이 아니라 사람이 눈으로 볼 것(남겨 둔 운영 데이터)이다.
-- 세 목록은 launch_reset.sql과 같아야 하며 tests/unit/launchReset.test.ts가 지킨다.
with
  reset_tables(t) as (values
    ('public.player_saves'), ('public.player_assets'), ('public.player_adjustments'), ('public.asset_ledger'), ('public.mail_claims'),
    ('public.coupon_redemptions'), ('public.coupon_attempts'), ('public.request_receipts'),
    ('public.support_tickets'), ('public.support_messages'), ('public.support_limits'),
    ('public.server_public_profiles'), ('public.server_friend_edges'), ('public.server_friend_favorites'),
    ('public.server_social_wallets'), ('public.server_rate_windows'), ('public.server_social_receipts'),
    ('public.server_competitive_scores'), ('public.server_competitive_results'), ('public.server_competitive_awards'),
    ('public.server_raids'), ('public.server_raid_members'),
    ('public.guilds'), ('public.guild_members'), ('public.guild_requests'), ('public.guild_attendance'),
    ('public.guild_left'), ('public.guild_receipts'), ('public.website_registration_limits')
  ),
  -- players와 admin_audit_log는 비운 뒤 운영자 행/초기화 기록이 새로 들어가므로 따로 본다.
  special_tables(t) as (values
    ('public.players'), ('public.admin_audit_log')
  ),
  ops_tables(t) as (values
    ('public.mails'), ('public.coupons'), ('public.coupon_codes')
  ),
  keep_tables(t) as (values
    ('public.account_login_ids'),
    ('public.admin_roles'), ('public.app_config'), ('public.reward_assets'),
    ('public.website_notices'), ('public.website_notice_translations'), ('public.website_preregistrations')
  ),
  count_of as (
    select t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', t), false, true, '')))[1]::text::bigint as n
    from (select t from reset_tables union all select t from special_tables union all select t from ops_tables union all select t from keep_tables) u
  ),
  admins as (select count(*) as n from auth.users u where exists (select 1 from public.admin_roles a where a.user_id = u.id)),
  doomed_seq as (
    select sn.nspname || '.' || sq.relname as seq, ps.last_value, tn.nspname || '.' || tb.relname as tbl
    from pg_depend d
    join pg_class sq on sq.oid = d.objid and sq.relkind = 'S' join pg_namespace sn on sn.oid = sq.relnamespace
    join pg_class tb on tb.oid = d.refobjid join pg_namespace tn on tn.oid = tb.relnamespace
    join pg_sequences ps on ps.schemaname = sn.nspname and ps.sequencename = sq.relname
    where d.classid = 'pg_class'::regclass and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i')
  ),
  checks as (
    select 'table_empty ' || c.t as "check", c.n = 0 as ok, 'rows=' || c.n as detail
    from count_of c join reset_tables r on r.t = c.t
    union all
    select 'players == admins', (select n from count_of where t = 'public.players') = (select n from admins),
      format('players=%s admins=%s', (select n from count_of where t = 'public.players'), (select n from admins))
    union all
    select 'auth.users == admins', (select count(*) from auth.users) = (select n from admins),
      format('auth.users=%s admins=%s', (select count(*) from auth.users), (select n from admins))
    union all
    select 'uid restarted', coalesce((select max(uid) from public.players), 100000000) = 100000000 + (select n from admins),
      format('max_uid=%s', coalesce((select max(uid) from public.players), 0))
    union all
    select 'sequence_fresh ' || s.seq, s.last_value is null, 'last_value=' || coalesce(s.last_value::text, 'null')
    from doomed_seq s
    where s.tbl in (select t from reset_tables union select t from ops_tables)
    union all
    select 'audit_log has launch_reset record', exists (select 1 from public.admin_audit_log where action = 'launch_reset'),
      format('rows=%s', (select n from count_of where t = 'public.admin_audit_log'))
    union all
    select 'auth leftover ' || x.t, case when to_regclass(x.t) is null then true else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', x.t), false, true, '')))[1]::text::bigint = 0 end, x.t
    from (values ('auth.audit_log_entries'), ('auth.flow_state'), ('auth.one_time_tokens')) x(t)
    union all
    select 'storage only kept buckets', coalesce((select count(*) from storage.objects where bucket_id <> 'notice-images'), 0) = 0,
      'objects outside notice-images=' || coalesce((select count(*) from storage.objects where bucket_id <> 'notice-images'), 0)
    union all
    select 'launch_epoch set', exists (select 1 from public.app_config where id = 1 and launch_epoch <> ''),
      'launch_epoch=' || coalesce((select launch_epoch from public.app_config where id = 1), '')
    union all
    select 'coupon traces cleared', not exists (select 1 from public.coupons where redeemed_count <> 0) and not exists (select 1 from public.coupon_codes where redeemed_by is not null or redeemed_at is not null),
      'coupons/codes with usage marks'
  ),
  reviews as (
    select 'review ' || c.t as "check", null::boolean as ok, 'rows=' || c.n as detail
    from count_of c where c.t in (select t from ops_tables union select t from keep_tables)
    union all
    select 'review maintenance flag', null, 'maintenance=' || coalesce((select maintenance::text from public.app_config where id = 1), '?')
    union all
    select 'review cron jobs', null, case when to_regclass('cron.job') is null then 'no pg_cron' else 'see cron.job' end
  )
select "check", ok, detail from (
  select 0 as ord, 'ALL' as "check", coalesce(bool_and(ok), false) as ok, format('%s checks, %s failed', count(*), count(*) filter (where not ok)) as detail from checks
  union all select 1, "check", ok, detail from checks where not ok
  union all select 2, "check", ok, detail from reviews
  union all select 3, "check", ok, detail from checks where ok
) all_rows order by ord, "check"
