-- 이번 주 정기 이벤트를 서버(서비스 롤)가 읽는 통로. 편성·콘텐츠 표는 Admin 마이그레이션(recurring_ops)이 소유한다.
-- 그 표가 아직 없는 DB에서도 함수는 만들어지고(plpgsql은 실행할 때 표를 찾는다) 호출하면 이벤트 없음(null)을 돌려준다.
-- 주 경계는 게임의 임무·원정과 같은 UTC 월요일 00:00이다(2026-11-02 결정).
create or replace function public.server_regular_event() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
  if to_regclass('public.event_rotation') is null or to_regclass('public.event_contents') is null then return null; end if;
  execute $q$
    with wk as (select date_trunc('week', (now() at time zone 'UTC'))::date as w)
    select jsonb_build_object('id', c.id, 'kind', c.kind, 'variant', c.variant, 'name', c.name, 'description', c.description,
      'currency', c.currency, 'costPerPlay', c.cost_per_play, 'dailyFreePlays', c.daily_free_plays, 'rewardTable', c.reward_table,
      'weekStart', r.week_start, 'endsAt', ((r.week_start + 7)::timestamp at time zone 'UTC'))
    from wk join public.event_rotation r on r.week_start = wk.w
    join public.event_contents c on c.id = r.content_id and c.enabled and c.deleted_at is null
  $q$ into r;
  return r;
end $$;

revoke all on function public.server_regular_event() from public, anon, authenticated;
grant execute on function public.server_regular_event() to service_role;
