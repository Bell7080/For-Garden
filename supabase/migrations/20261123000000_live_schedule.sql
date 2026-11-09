-- 운영 일정(live_schedule) — 배너·상품·이벤트를 「언제 여는가」만 서버가 정한다.
-- 무엇이 나오고 얼마인지(풀·확률·가격·보상)는 클라이언트 정의가 그대로 갖는다. 줄이 있는 항목만 그 줄의 기간·켜짐을
-- 따르고, 줄이 없으면 정의에 적힌 기간이다 — 표가 비어 있으면 지금과 똑같이 돈다(src/core/liveSchedule.ts).
--   kind: banner(src/data/banners.ts의 id) · product(상품 id) · event(src/data/events의 id) · lobby(로비 이벤트 카드 id)
--   starts_at·ends_at: null이면 그쪽 끝을 열어 둔다. enabled=false면 기간과 상관없이 닫는다.
-- 공개 설정(get_public_config)이 일정을 함께 준다 — 플레이어에게 보이는 기간이라 비밀이 아니다. 게임 서버는
-- 서비스 롤 전용 server_live_schedule로 1분 캐시해 읽어 연구·구매를 같은 기간으로 받아 준다. 고치는 함수는 어드민 마이그레이션(ops_schedule)이 갖는다.
-- 운영 DB에는 사람이 이 파일을 적용한다.

create table if not exists public.live_schedule (
  kind text not null check (kind in ('banner', 'product', 'event', 'lobby')),
  id text not null check (char_length(id) between 1 and 96),
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  note text not null default '' check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (kind, id),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);
alter table public.live_schedule enable row level security;
revoke all on public.live_schedule from public, anon, authenticated;

create or replace function public.get_public_config()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('maintenance', c.maintenance, 'message', c.maintenance_message, 'ends_at', c.maintenance_ends_at,
    'min_version', c.min_app_version, 'latest_version', c.latest_app_version, 'server_time', now(), 'launch_epoch', c.launch_epoch,
    'schedule', coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'id', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'enabled', s.enabled)
                            order by s.kind, s.id) from public.live_schedule s), '[]'::jsonb))
  from public.app_config c where c.id = 1;
$fn$;

-- 게임 서버가 읽는 길(서비스 롤 전용). 공개 설정과 같은 줄을 같은 모양으로 준다.
create or replace function public.server_live_schedule()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'id', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'enabled', s.enabled)
    order by s.kind, s.id) from public.live_schedule s), '[]'::jsonb);
$fn$;
revoke all on function public.server_live_schedule() from public, anon, authenticated;
grant execute on function public.server_live_schedule() to service_role;
