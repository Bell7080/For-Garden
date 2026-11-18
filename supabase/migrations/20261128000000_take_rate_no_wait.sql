-- 속도 제한이 공개 프로필 줄을 기다리지 않게 한다(v0.503.1).
--
-- 모든 /api/game 호출은 맨 먼저 server_take_rate를 부른다. 그 안의 「마지막 접속」 갱신이
-- server_public_profiles의 그 플레이어 줄을 잠그는데, 같은 줄을 저장(server_commit_state)도 잠근다.
-- 저장이 몇 초 걸리는 동안 속도 제한이 그 줄을 기다리고, 속도 제한은 이미 server_rate_windows의
-- 「all」 줄을 잡고 있어 그 플레이어의 다음 호출이 전부 줄을 섰다. 줄 선 호출이 PostgREST 연결을
-- 붙잡자 다른 플레이어의 가벼운 조회까지 몇 초씩 밀려 타이틀이 「네트워크 연결」 오류를 띄웠다
-- (운영 2026-11-18 13:15·13:54 UTC).
--
-- 마지막 접속은 60초에 한 번 적는 표시 값이라 이번에 못 적어도 다음 호출이 적는다 — 잠겨 있으면 건너뛴다.
create or replace function public.server_take_rate(p_player uuid, p_bucket text, p_window integer, p_limit integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare t timestamptz:=clock_timestamp(); n integer; w timestamptz;
begin
  perform public.server_require_active(p_player);
  if p_window not between 1 and 3600 or p_limit not between 1 and 1000 or length(p_bucket)>80 then raise exception 'invalid_budget'; end if;
  insert into public.server_rate_windows as old(player_id,bucket,window_at,used) values(p_player,p_bucket,t,1)
  on conflict(player_id,bucket) do update set
    used=case when old.window_at <= t-make_interval(secs=>p_window) then 1 else least(old.used+1,p_limit+1) end,
    window_at=case when old.window_at <= t-make_interval(secs=>p_window) then t else old.window_at end
  returning used,window_at into n,w;
  perform 1 from public.server_public_profiles
   where player_id=p_player and updated_at<t-interval '60 seconds'
   for update skip locked;
  if found then
    update public.server_public_profiles set updated_at=t,profile=profile||jsonb_build_object('lastActiveAt',floor(extract(epoch from t)*1000))
     where player_id=p_player;
  end if;
  return jsonb_build_object('allowed',n<=p_limit,'retryAfter',greatest(1,ceil(extract(epoch from w+make_interval(secs=>p_window)-t))));
end $function$;
