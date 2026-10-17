-- 정식 오픈 직전 전체 초기화. 테스트 중 쌓인 모든 플레이어 데이터를 지우고 UID부터 다시 센다.
--
-- ⚠ 되돌릴 수 없다. 운영 DB에 실행하기 전에 docs/launch-reset.md를 처음부터 끝까지 읽는다.
-- 이 파일은 supabase/migrations에 두지 않는다 — 마이그레이션은 모든 환경에 자동으로 같은 순서로 적용되지만
-- 이 스크립트는 "그 DB를 비워도 된다"고 사람이 결정한 한 번의 순간에만 직접 실행한다.
--
-- 쓰는 법: 아래 [실행 값] 네 줄만 고쳐 SQL 편집기(또는 psql)에 통째로 붙여 넣는다. 한 번의 DO 블록이라
-- 전부 한 트랜잭션이다 — 하나라도 실패하면 아무것도 바뀌지 않는다.
--   1) 기본값(dry)으로 먼저 돌린다. 지울 건수를 담은 DRY-RUN 오류가 나고, 실제로는 아무것도 바뀌지 않는다.
--      (지우기까지 실제로 실행한 뒤 되돌리므로 외래키 문제 같은 실패도 이때 드러난다.)
--   2) 숫자를 확인하고 p_mode를 'execute'로, p_confirm과 p_expect_players를 채워 다시 돌린다.
--   3) supabase/ops/launch_reset_verify.sql로 결과를 확인한다.
--
-- ── 무엇을 지우고 무엇을 남기나 ─────────────────────────────────────────────────────────────
-- 모든 표는 아래 세 목록 중 하나에 있어야 한다. 목록에 없는 새 표가 하나라도 있으면 이 스크립트는
-- 아무것도 지우지 않고 멈춘다(UNCLASSIFIED_TABLES). 새 마이그레이션이 표를 만들면 반드시 여기에 분류를 더한다.
--   reset_tables : 플레이어·거래·기록. 전부 비운다. 식별자(UID·티켓 번호·장부 번호)도 처음부터 다시 센다.
--   ops_tables   : 운영자가 만든 우편·쿠폰. 기본은 지운다(p_purge_ops_content). 오픈용으로 미리 준비해 둔 것이 있으면
--                  false로 두면 남기되, 테스트 중 쓰인 흔적(쿠폰 사용 횟수·단일 코드 사용 표시)은 되돌린다.
--   keep_tables  : 운영 설정과 실제 사전 등록자·공지처럼 테스트가 아닌 데이터. 건드리지 않는다.
-- 인증 계정(auth.users)은 admin_roles에 있는 운영자만 남기고 전부 지운다(세션·토큰·연결 계정은 함께 지워진다).
-- 남긴 운영자는 새 players 행을 받는다. 공지 이미지 버킷 말고 다른 저장소 파일이 있으면 멈춘다(저장소 API로 먼저 비운다).
-- 끝에 app_config.launch_epoch를 새 값으로 바꾼다 — 이 값이 달라진 것을 본 클라이언트는 기기에 남은 토큰·저장을 지운다.
--
-- 이 파일의 세 목록은 launch_reset_verify.sql과 같아야 하며 tests/unit/launchReset.test.ts가 지킨다.
do $reset$
declare
  -- ▼▼▼ [실행 값] 실행할 때 이 네 줄만 고친다 ▼▼▼
  p_mode text := 'dry';                  -- 'dry'(기본: 건수만 보고하고 되돌림) | 'execute'(진짜 실행)
  p_confirm text := '';                  -- execute일 때만: 정확히 RESET-FORGARDEN-LAUNCH
  p_expect_players bigint := -1;         -- execute일 때만: 지금 이 DB의 players 행 수(dry 결과에 나온 값). 엉뚱한 DB를 막는다.
  p_purge_ops_content boolean := true;   -- false면 우편·쿠폰 정의를 남긴다(사용 흔적은 되돌림)
  -- ▲▲▲ [실행 값] ▲▲▲

  reset_tables text[] := array[
    'public.players',
    'public.player_saves',
    'public.player_assets',
    'public.asset_ledger',
    'public.mail_claims',
    'public.coupon_redemptions',
    'public.coupon_attempts',
    'public.request_receipts',
    'public.support_tickets',
    'public.support_messages',
    'public.support_limits',
    'public.server_public_profiles',
    'public.server_friend_edges',
    'public.server_friend_favorites',
    'public.server_social_wallets',
    'public.server_rate_windows',
    'public.server_social_receipts',
    'public.server_raids',
    'public.server_raid_members',
    'public.guilds',
    'public.guild_members',
    'public.guild_requests',
    'public.guild_attendance',
    'public.guild_left',
    'public.guild_receipts',
    'public.admin_audit_log',
    'public.website_registration_limits'
  ];
  ops_tables text[] := array[
    'public.mails',
    'public.coupons',
    'public.coupon_codes'
  ];
  keep_tables text[] := array[
    'public.admin_roles',
    'public.app_config',
    'public.reward_assets',
    'public.website_notices',
    'public.website_notice_translations',
    'public.website_preregistrations'
  ];
  keep_buckets text[] := array['notice-images'];
  confirm_phrase constant text := 'RESET-FORGARDEN-LAUNCH';
  system_schemas constant text[] := array['information_schema','auth','storage','extensions','vault','realtime','graphql','graphql_public',
    'pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','net','cron','pgbouncer','_realtime','_analytics','_supavisor','pgtle'];

  all_listed text[];
  doomed text[];
  t text;
  n bigint;
  admins bigint;
  players_before bigint;
  bad text[];
  report text := '';
  epoch text;
begin
  perform set_config('lock_timeout', '15s', true);
  perform set_config('statement_timeout', '10min', true);
  if p_mode not in ('dry', 'execute') then raise exception 'BAD_MODE: p_mode는 dry 또는 execute여야 합니다.'; end if;

  -- ── 1. 분류 점검: 모든 표가 목록에 있고, 목록의 모든 표가 실제로 있고, 한 표가 두 목록에 없다 ──────────────
  all_listed := reset_tables || ops_tables || keep_tables;
  select array_agg(x order by x) into bad from (select x from unnest(all_listed) x group by x having count(*) > 1) d;
  if bad is not null then raise exception 'DUPLICATE_TABLES: 두 목록에 함께 적힌 표가 있습니다: %', bad; end if;

  select array_agg(x order by x) into bad from unnest(all_listed) x where to_regclass(x) is null;
  if bad is not null then raise exception 'MISSING_TABLES: 목록에 적혔지만 DB에 없는 표입니다(마이그레이션이 덜 적용됐거나 이름이 틀림): %', bad; end if;

  select array_agg(s order by s) into bad from (
    select n.nspname || '.' || c.relname as s
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname <> all (system_schemas) and n.nspname not like 'pg\_%' and not c.relispartition
  ) u where s <> all (all_listed);
  if bad is not null then
    raise exception 'UNCLASSIFIED_TABLES: 분류되지 않은 표가 있어 아무것도 지우지 않았습니다. launch_reset.sql(와 verify)의 목록에 reset/ops/keep 중 하나로 더하세요: %', bad;
  end if;

  -- 표에 딸리지 않은 독립 시퀀스는 처음부터 다시 세는 방법이 없으니 사람이 보게 멈춘다.
  select array_agg(s order by s) into bad from (
    select n.nspname || '.' || c.relname as s
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S' and n.nspname <> all (system_schemas) and n.nspname not like 'pg\_%'
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass
                      and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i'))
  ) q;
  if bad is not null then raise exception 'STANDALONE_SEQUENCES: 표에 딸리지 않은 시퀀스가 있어 초기화 대상을 정할 수 없습니다: %', bad; end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'app_config' and column_name = 'launch_epoch') then
    raise exception 'EPOCH_MIGRATION_MISSING: launch_epoch 마이그레이션(20261020000000)을 먼저 적용하세요.';
  end if;

  -- ── 2. 현재 상태와 실행 조건 ───────────────────────────────────────────────────────────
  select count(*) into players_before from public.players;
  select count(*) into admins from auth.users u where exists (select 1 from public.admin_roles a where a.user_id = u.id);
  report := report || format(E'players(지금 행 수) = %s\n', players_before);
  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job' into n;
    if n > 0 then report := report || format(E'경고: pg_cron 작업 %s개가 있습니다. 직접 확인하세요.\n', n); end if;
  end if;

  if p_mode = 'execute' then
    if p_confirm is distinct from confirm_phrase then raise exception 'CONFIRM_REQUIRED: p_confirm에 %를 정확히 적어야 실행됩니다.', confirm_phrase; end if;
    if p_expect_players is distinct from players_before then
      raise exception 'WRONG_DATABASE: p_expect_players(%)가 지금 players 행 수(%)와 다릅니다. 다른 DB에 붙은 것은 아닌지 확인하세요.', p_expect_players, players_before;
    end if;
    if not exists (select 1 from public.app_config where id = 1 and maintenance) then
      raise exception 'MAINTENANCE_REQUIRED: 점검 모드를 먼저 켠 뒤 실행하세요(어드민 > 운영 설정). 접속자가 있는 채로 지우지 않습니다.';
    end if;
  end if;

  -- ── 3. 지우기 전 건수 ──────────────────────────────────────────────────────────────────
  foreach t in array reset_tables || ops_tables loop
    execute format('select count(*) from %s', t) into n;
    report := report || format(E'%s %s = %s\n', case when t = any (ops_tables) and not p_purge_ops_content then '남김' else '삭제' end, t, n);
  end loop;
  select count(*) into n from auth.users u where not exists (select 1 from public.admin_roles a where a.user_id = u.id);
  report := report || format(E'삭제 auth.users(운영자 제외) = %s / 남기는 운영자 = %s\n', n, admins);
  foreach t in array keep_tables loop
    execute format('select count(*) from %s', t) into n;
    report := report || format(E'보존 %s = %s\n', t, n);
  end loop;

  -- ── 4. 저장소 파일: 공지 이미지 말고 남은 것이 있으면 멈춘다(SQL로 지우면 실제 파일이 고아로 남는다) ────────────
  if to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id <> all ($1)' using keep_buckets into n;
    if n > 0 then
      raise exception 'STORAGE_NOT_EMPTY: 보존 버킷(%) 밖에 파일이 %개 있습니다. 저장소 API/대시보드로 먼저 비운 뒤 다시 실행하세요.', keep_buckets, n;
    end if;
  end if;

  -- ── 5. 지우기 ──────────────────────────────────────────────────────────────────────────
  -- CASCADE를 쓰지 않는다: 보존 표가 지울 표를 참조하면 조용히 함께 지워지는 대신 여기서 오류로 멈춘다.
  doomed := reset_tables || case when p_purge_ops_content then ops_tables else array[]::text[] end;
  execute 'truncate table ' || (select string_agg(x::regclass::text, ', ') from unnest(doomed) x) || ' restart identity';

  if not p_purge_ops_content then
    update public.coupons set redeemed_count = 0 where redeemed_count <> 0;
    update public.coupon_codes set redeemed_by = null, redeemed_at = null where redeemed_by is not null or redeemed_at is not null;
  end if;

  -- 계정: 운영자만 남긴다. 세션·리프레시 토큰·연결 계정은 auth.users를 따라 지워진다.
  delete from auth.users u where not exists (select 1 from public.admin_roles a where a.user_id = u.id);
  foreach t in array array['auth.audit_log_entries', 'auth.flow_state', 'auth.one_time_tokens'] loop
    if to_regclass(t) is not null then execute 'delete from ' || t; end if;
  end loop;
  -- 가입 때 players 행을 만드는 트리거는 INSERT에만 걸려 있으므로 남긴 운영자의 행을 직접 다시 만든다.
  insert into public.players (id) select id from auth.users;

  epoch := to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDD"T"HH24MISS') || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  update public.app_config set launch_epoch = epoch, updated_at = now() where id = 1;
  insert into public.admin_audit_log (actor, action, target, detail)
  values (null, 'launch_reset', 'database', jsonb_build_object('mode', p_mode, 'epoch', epoch, 'players_before', players_before, 'purged_ops_content', p_purge_ops_content));

  -- ── 6. 같은 트랜잭션 안에서 결과 확인: 어긋나면 오류로 전체를 되돌린다 ──────────────────────────────────
  select array_agg(x order by x) into bad from unnest(doomed) x
  where x not in ('public.players', 'public.admin_audit_log') and (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', x), false, true, '')))[1]::text::bigint <> 0;
  if bad is not null then raise exception 'VERIFY_FAILED: 비워지지 않은 표: %', bad; end if;
  select count(*) into n from auth.users;
  if n <> admins then raise exception 'VERIFY_FAILED: auth.users가 운영자 수(%)와 다릅니다: %', admins, n; end if;
  select count(*) into n from public.players;
  if n <> admins then raise exception 'VERIFY_FAILED: players가 운영자 수(%)와 다릅니다: %', admins, n; end if;
  select coalesce(max(uid), 100000000) into n from public.players;
  if n <> 100000000 + admins then raise exception 'VERIFY_FAILED: UID가 처음부터 다시 세어지지 않았습니다(max=%).', n; end if;
  select array_agg(s order by s) into bad from (
    select sn.nspname || '.' || sq.relname as s
    from pg_depend d
    join pg_class sq on sq.oid = d.objid and sq.relkind = 'S' join pg_namespace sn on sn.oid = sq.relnamespace
    join pg_class tb on tb.oid = d.refobjid join pg_namespace tn on tn.oid = tb.relnamespace
    join pg_sequences ps on ps.schemaname = sn.nspname and ps.sequencename = sq.relname
    where d.classid = 'pg_class'::regclass and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i')
      and tn.nspname || '.' || tb.relname = any (doomed)
      and tn.nspname || '.' || tb.relname not in ('public.players', 'public.admin_audit_log')
      and ps.last_value is not null
  ) z;
  if bad is not null then raise exception 'VERIFY_FAILED: 번호가 처음으로 돌아가지 않은 시퀀스: %', bad; end if;

  report := report || format(E'새 launch_epoch = %s\n', epoch);
  if p_mode = 'dry' then
    raise exception E'DRY-RUN 완료: 아무것도 바뀌지 않았습니다(이 오류가 되돌림입니다).\n%\n진짜 실행하려면 p_mode := ''execute'', p_confirm := ''%'', p_expect_players := % 로 고쳐 다시 실행하세요.',
      report, confirm_phrase, players_before;
  end if;
  raise notice E'초기화 완료\n%', report;
end
$reset$;
