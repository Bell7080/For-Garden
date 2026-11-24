-- 알림과 길드 혜택 조회는 회원 정보 갱신이나 소셜 전역 잠금을 거치지 않는다.
create function public.server_pending_friend_count(p_player uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.server_require_active(p_player);
  return (
    select count(*)::integer
    from public.server_friend_edges e
    join public.players requester on requester.id = e.requester and requester.status = 'active'
    where p_player in (e.a, e.b) and e.status = 'pending' and e.requester <> p_player
  );
end;
$$;

create function public.server_guild_read_context(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.server_require_active(p_player);
  return coalesce((
    select jsonb_build_object(
      'level', public.server_guild_level(g.prosperity),
      'attendanceReady', m.attendance_last is distinct from (now() at time zone 'UTC')::date
        or coalesce(m.attendance_count, 0) <= 0
    )
    from public.guild_members m
    join public.guilds g on g.id = m.guild_id
    where m.player_id = p_player
  ), '{"level":0,"attendanceReady":false}'::jsonb);
end;
$$;

revoke all on function public.server_pending_friend_count(uuid), public.server_guild_read_context(uuid) from public, anon, authenticated;
grant execute on function public.server_pending_friend_count(uuid), public.server_guild_read_context(uuid) to service_role;
