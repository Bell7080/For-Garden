-- 출시 초기화 세대(launch_epoch). supabase/ops/launch_reset.sql이 DB를 비울 때마다 새 값을 새긴다.
-- 클라이언트가 기기에 적어 둔 세대와 다르면 초기화 이전에 남은 토큰·저장·연결 표식을 지운다(src/api/launchEpoch.ts).
-- 빈 문자열은 "아직 한 번도 초기화하지 않음"이다.
alter table public.app_config add column if not exists launch_epoch text not null default '' check (char_length(launch_epoch) <= 64);

create or replace function public.get_public_config()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('maintenance', c.maintenance, 'message', c.maintenance_message, 'ends_at', c.maintenance_ends_at,
    'min_version', c.min_app_version, 'latest_version', c.latest_app_version, 'server_time', now(), 'launch_epoch', c.launch_epoch)
  from public.app_config c where c.id = 1;
$fn$;
