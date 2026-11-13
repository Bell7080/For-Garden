-- 한 계정은 한 기기에서만 플레이한다(응태 요청 2026-11-13 — 수집형 RPG의 다중 기기 접속 차단).
-- 앱이 뜰 때마다 클라이언트가 새로 만든 기기 표식을 `session.claim`으로 이 표에 세우고(나중에 접속한 기기가 이긴다),
-- 게임 서버(`src/server/vercelEntry.ts`)는 모든 /api/game 호출의 표식이 여기 적힌 값과 다르면 409 session_replaced로
-- 거절한다. 그래서 밀려난 기기의 조작은 하나도 저장되지 않는다. 표식은 인증 수단이 아니다(인증은 여전히 Bearer 토큰).
-- 이 표가 없거나 함수가 없으면 서버는 막지 않는다 — 적용 전후 어느 쪽이든 배포를 깨지 않는다.
-- 운영 DB에는 사람이 이 파일을 적용한다. 출시 시각 마이그레이션(20261124000000) 다음이다.

create table if not exists public.player_device_sessions (
  player_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null check (session_id ~ '^[a-f0-9]{24,64}$'),
  claimed_at timestamptz not null default now()
);
alter table public.player_device_sessions enable row level security;
-- 정책을 두지 않는다 — 클라이언트는 이 표를 읽지도 쓰지도 못하고, 서비스 롤 함수만 지난다.
revoke all on table public.player_device_sessions from public, anon, authenticated;

create or replace function public.server_claim_device_session(p_player uuid, p_session text)
returns void language sql volatile security definer set search_path = '' as $fn$
  insert into public.player_device_sessions as d (player_id, session_id, claimed_at)
  values (p_player, p_session, now())
  on conflict (player_id) do update set session_id = excluded.session_id, claimed_at = excluded.claimed_at;
$fn$;

create or replace function public.server_device_session(p_player uuid)
returns text language sql stable security definer set search_path = '' as $fn$
  select d.session_id from public.player_device_sessions d where d.player_id = p_player;
$fn$;

revoke all on function public.server_claim_device_session(uuid, text), public.server_device_session(uuid) from public, anon, authenticated;
grant execute on function public.server_claim_device_session(uuid, text), public.server_device_session(uuid) to service_role;
