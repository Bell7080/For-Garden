-- 상태 폴링은 매칭·초대 변경과 달리 전역 잠금이나 전체 방 정리가 필요 없다.
-- 만료 초대는 서버 코어가 declined로 확정하며 기존 commit의 버전 검사를 그대로 쓴다.
create index if not exists arena_rooms_incoming_active on public.arena_rooms(b)
  where data->>'phase'='invited';

create or replace function public.server_arena_status(p_player uuid,p_room uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.arena_rooms; rating public.arena_ratings; queued timestamptz;
begin
  perform public.server_require_active(p_player);
  if p_room is not null then
    select * into r from public.arena_rooms where id=p_room and p_player in(a,b);
    if not found then raise exception 'ARENA_FORBIDDEN' using errcode='PT403'; end if;
  else
    select m.* into r from public.arena_rooms m join public.arena_seats s on s.room_id=m.id
      where s.player_id=p_player;
  end if;
  select * into rating from public.arena_ratings where player_id=p_player;
  select joined_at into queued from public.arena_queue
    where player_id=p_player and heartbeat>=now()-interval '20 seconds';
  return jsonb_build_object(
    'playerId',p_player,'score',coalesce(rating.score,1000),'wins',coalesce(rating.wins,0),'losses',coalesce(rating.losses,0),'queuedAt',queued,
    'room',case when r.id is null then null else r.data||jsonb_build_object('id',r.id,'version',r.version) end,
    'incoming',coalesce((select jsonb_agg(m.data||jsonb_build_object('id',m.id,'version',m.version))
      from public.arena_rooms m where m.b=p_player and m.data->>'phase'='invited'
      and (m.data->>'deadline')::numeric>=extract(epoch from now())*1000),'[]'::jsonb),
    'records',case when r.id is null or r.data->>'phase' in ('invited','done','declined')
      or (r.data#>'{players,0,roster}' is not null and (coalesce((r.data->>'practice')::boolean,false)=false or r.data->'lease' is not null))
      then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',s.player_id,'data',s.data))
      from public.player_saves s where s.player_id in(r.a,r.b)),'[]'::jsonb) end);
end $$;
revoke all on function public.server_arena_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_arena_status(uuid,uuid) to service_role;
