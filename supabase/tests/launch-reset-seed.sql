-- 초기화 검증용 표본: 운영자 1명 + 테스트 플레이어 3명, 그리고 모든 초기화 대상 표에 최소 한 줄.
-- tests가 "초기화 목록의 모든 표에 표본이 있었는가"를 확인하므로 새 표를 목록에 더하면 여기에도 한 줄을 더한다.
insert into auth.users(id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', false),
  ('00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000002', true),
  ('00000000-0000-0000-0000-000000000003', true);
insert into auth.identities(user_id) select id from auth.users;
insert into auth.sessions(id, user_id) select gen_random_uuid(), id from auth.users;
insert into auth.refresh_tokens(user_id, session_id) select user_id::text, id from auth.sessions;
insert into auth.one_time_tokens(user_id) select id from auth.users;
insert into auth.flow_state(user_id) select id from auth.users;
insert into auth.audit_log_entries(payload) values ('{"ip":"203.0.113.9"}');
-- 가입 트리거가 players를 만든다(운영자 포함). 운영자 역할:
insert into public.admin_roles(user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'owner');
update public.players set nickname = 'tester' where id = '00000000-0000-0000-0000-000000000001';

insert into public.player_saves(player_id, data, data_hash, save_version) select id, '{"wallet":{"gems":999}}', repeat('a', 64), 1 from public.players;
insert into public.player_assets(player_id, asset, amount) select id, 'gems', 5000 from public.players;
insert into public.asset_ledger(player_id, asset, delta, balance_after, reason) select id, 'gems', 5000, 5000, 'admin_adjust' from public.players;
insert into public.player_adjustments(player_id, asset, delta, note, created_by)
  values ('00000000-0000-0000-0000-000000000001', 'gems', 1, 'launch-reset fixture', '00000000-0000-0000-0000-0000000000a1');
insert into public.mails(id, title, body, rewards) values ('11111111-1111-1111-1111-111111111111', 'test mail', 'body', '[{"asset":"gems","amount":100}]');
insert into public.mail_claims(mail_id, player_id) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001');
insert into public.coupons(id, name, kind, rewards, ends_at, redeemed_count) values ('22222222-2222-2222-2222-222222222222', 'test coupon', 'single', '[]', now() + interval '1 day', 1);
insert into public.coupon_codes(id, coupon_id, code_hash, code_hint, redeemed_by, redeemed_at)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', repeat('b', 64), 'AB..', '00000000-0000-0000-0000-000000000001', now());
insert into public.coupon_redemptions(coupon_id, player_id, code_id) values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
insert into public.coupon_attempts(player_id, ok) values ('00000000-0000-0000-0000-000000000001', true);
insert into public.coupon_web_tickets(token_hash, player_id) values ('reset-fixture-ticket', '00000000-0000-0000-0000-000000000001');
insert into public.request_receipts(player_id, request_id, method, response) values ('00000000-0000-0000-0000-000000000001', 'request-0001', 'x', '{}');
insert into public.support_tickets(id, source, category, subject, body, player_id) values ('44444444-4444-4444-4444-444444444444', 'game', 'bug', 's', 'b', '00000000-0000-0000-0000-000000000001');
insert into public.support_messages(ticket_id, author_kind, body) values ('44444444-4444-4444-4444-444444444444', 'player', 'hello');
insert into public.support_limits(key) values ('player:x');
insert into public.server_public_profiles(player_id, profile) select id, '{}' from public.players;
insert into public.server_friend_edges(a, b, requester, status) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'friend');
insert into public.server_friend_favorites(player_id, friend_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.server_social_wallets(player_id, points) select id, 30 from public.players;
insert into public.server_rate_windows(player_id, bucket, window_at, used) values ('00000000-0000-0000-0000-000000000001', 'all', now(), 3);
insert into public.server_social_receipts(player_id, request_id, fingerprint, response) values ('00000000-0000-0000-0000-000000000001', 'request-0002', 'f', '{}');
insert into public.server_raids(id, definition, ends_at, owner_id) values ('raid-1', '{}', now() + interval '1 day', '00000000-0000-0000-0000-000000000001');
insert into public.server_raid_members(raid_id, player_id, damage) values ('raid-1', '00000000-0000-0000-0000-000000000001', 10);
insert into public.guilds(id, name, name_key, badge, join_mode) values ('55555555-5555-5555-5555-555555555555', 'TestGuild', 'testguild', '{}', 'open');
insert into public.guild_members(player_id, guild_id, role, name) values ('00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'leader', 'tester');
insert into public.guild_requests(guild_id, player_id, actor) values ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000002', '{}');
insert into public.guild_attendance(player_id, day, choice) values ('00000000-0000-0000-0000-000000000001', current_date, 'gold');
insert into public.guild_left(player_id, left_at) values ('00000000-0000-0000-0000-000000000003', now());
insert into public.guild_receipts(player_id, request_id, method, response) values ('00000000-0000-0000-0000-000000000001', 'request-0003', 'createGuild', '{}');
insert into public.guild_war_defense(guild_id, slot_id, player_id, deck, lineup) values ('55555555-5555-5555-5555-555555555555', '1:grunt:0', '00000000-0000-0000-0000-000000000001', '["a","b","c"]', '[{},{},{}]');
insert into public.guild_week_ledger(week, guild_id, player_id, contribution) values ('2026-W43', '55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 10);
insert into public.guild_guard_ledger(day, guild_id, player_id, score) values (20001, '55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 100);
insert into public.guild_rank_results(board, period, guild_id, rank, score) values ('week', '2026-W43', '55555555-5555-5555-5555-555555555555', 1, 10);
insert into public.guild_rank_totals(board, period, total) values ('week', '2026-W43', 1);
insert into public.guild_rank_awards(board, period, player_id, guild_id, rank, amount) values ('week', '2026-W43', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 1, 100);
insert into public.guild_war_days(day) values (20001);
insert into public.guild_war_matches(day, guild_a) values (20001, '55555555-5555-5555-5555-555555555555');
insert into public.guild_war_captures(day, attacker, slot_id, by_player) values (20001, '55555555-5555-5555-5555-555555555555', '1:grunt:0', '00000000-0000-0000-0000-000000000001');
insert into public.guild_war_attacks(day, player_id, guild_id, used) values (20001, '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 1);
insert into public.guild_war_admissions(player_id, request_id, day, slot_id, guild_id) values ('00000000-0000-0000-0000-000000000001', 'war-reset-fixture', 20001, '1:grunt:1', '55555555-5555-5555-5555-555555555555');
insert into public.guild_war_results(guild_id, day, outcome, my_points, their_points, delta, score_after) values ('55555555-5555-5555-5555-555555555555', 20001, 'win', 300, 100, 25, 1025);
insert into public.guild_war_coins(day, guild_id, player_id, coin) values (20001, '55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 30);
insert into public.admin_audit_log(actor, action, target) values ('00000000-0000-0000-0000-0000000000a1', 'player_status', 'players:test');
insert into public.website_registration_limits(fingerprint, bucket) values (repeat('c', 64), now());

-- 보존 대상: 공지, 사전 등록자(실제 사람의 이메일), 운영 설정
insert into public.website_notices(id, slug, category, status) values ('66666666-6666-6666-6666-666666666666', 'hello', 'notice', 'published');
insert into public.website_notice_translations(notice_id, locale, title, body) values ('66666666-6666-6666-6666-666666666666', 'ko', '안녕', '본문');
insert into public.website_preregistrations(email, platform, locale) values ('real.person@example.com', 'both', 'ko');
insert into storage.objects(bucket_id, name) values ('notice-images', 'cover.webp');

-- 경쟁 점수/마감 순위/우편 발송 이력도 초기화 대상이다.
insert into public.server_competitive_scores values ('duel',current_date,'00000000-0000-0000-0000-000000000001',0,now(),true);
insert into public.server_competitive_results values ('duel',current_date,'00000000-0000-0000-0000-000000000001',1);
insert into public.server_competitive_awards values ('duel',current_date,'00000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',1,5000);

-- 실시간 아레나 표도 전부 표본을 가져야 출시 초기화 검증이 실제 삭제를 확인한다.
insert into public.arena_ratings(player_id) values ('00000000-0000-0000-0000-000000000001');
insert into public.arena_rooms(id,a,b,data) values (
  '77777777-7777-7777-7777-777777777777',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '{"phase":"ban"}'
);
insert into public.arena_seats(player_id,room_id) values ('00000000-0000-0000-0000-000000000001','77777777-7777-7777-7777-777777777777');
insert into public.arena_queue(player_id) values ('00000000-0000-0000-0000-000000000003');
insert into public.arena_receipts(player_id,request_id,room_id,fingerprint) values (
  '00000000-0000-0000-0000-000000000001','arena-reset-fixture','77777777-7777-7777-7777-777777777777','[]'
);
