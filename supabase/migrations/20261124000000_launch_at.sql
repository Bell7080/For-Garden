-- 출시 시각(launch_at) — 출시 전과 출시 뒤를 가르는 단 하나의 값(src/core/launchAnchor.ts, 응태 결정 2026-11-10).
--   null(지금): 출시 전. 이벤트·한정 상품·배너를 정의의 끝 날짜로 내리지 않는다(임시 운영 중 판이 비지 않게).
--   값이 있으면: 출시 뒤. 정의의 기간이 그대로 돌고, 시즌 패스·정기 이벤트 교대·결투 시즌이 이 시각이 든 주의 월요일부터 다시 센다.
-- 값은 출시 초기화(supabase/ops/launch_reset.sql)가 채운다. 손으로 고치면 그 순간 모든 주기가 옮겨 가므로 고치지 않는다.
-- 공개 설정(get_public_config)이 함께 준다 — 플레이어에게 보이는 주기라 비밀이 아니다. 게임 서버는 서비스 롤 전용 server_launch_at을 읽는다.
-- 운영 DB에는 사람이 이 파일을 적용한다. 운영 일정 마이그레이션(20261123000000) 다음이다.

alter table public.app_config add column if not exists launch_at timestamptz;

create or replace function public.get_public_config()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('maintenance', c.maintenance, 'message', c.maintenance_message, 'ends_at', c.maintenance_ends_at,
    'min_version', c.min_app_version, 'latest_version', c.latest_app_version, 'server_time', now(), 'launch_epoch', c.launch_epoch,
    'launch_at', c.launch_at,
    'schedule', coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'id', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'enabled', s.enabled)
                            order by s.kind, s.id) from public.live_schedule s), '[]'::jsonb))
  from public.app_config c where c.id = 1;
$fn$;

create or replace function public.server_launch_at()
returns timestamptz language sql stable security definer set search_path = '' as $fn$
  select c.launch_at from public.app_config c where c.id = 1;
$fn$;
revoke all on function public.server_launch_at() from public, anon, authenticated;
grant execute on function public.server_launch_at() to service_role;
