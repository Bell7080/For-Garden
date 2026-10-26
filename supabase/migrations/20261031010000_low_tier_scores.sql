-- 저티어 발판: 아레나에서 이긴 쪽의 판 시작 RP가 낮으면(브론즈 1,100 미만 ×2 · 실버 1,300 미만 ×1.5) 승리 증감을 키운다.
-- 진 쪽이 잃는 몫은 기본 그대로다. 같은 표는 src/core/arenaStanding.ts의 ARENA_LOW_TIER_WIN이며 arenaStanding.test가 대조한다.
create or replace function public.server_arena_commit(p_player uuid,p_room uuid,p_version integer,p_data jsonb,p_request text,p_fingerprint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.arena_rooms; old public.arena_receipts; winner integer; loser uuid; victor uuid; delta integer; gain integer; sa integer; sb integer; streak integer;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(672391005);
 select * into r from public.arena_rooms where id=p_room and p_player in(a,b) for update;
 if not found then raise exception 'ARENA_FORBIDDEN' using errcode='PT403'; end if;
 select * into old from public.arena_receipts where player_id=p_player and request_id=p_request;
 if found and old.room_id=r.id then
   if old.fingerprint<>p_fingerprint then raise exception 'ARENA_REQUEST_CONFLICT' using errcode='PT409'; end if;
   return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 if r.version<>p_version then return jsonb_build_object('conflict',true,'room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 if r.data->>'phase' in ('done','declined') then return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version)); end if;
 update public.arena_rooms set data=p_data-'version'-'id',version=version+1 where id=r.id returning * into r;
 if r.data->>'phase' in ('done','declined') and not r.settled then
   if (r.data->>'ranked')::boolean and r.data->>'winner' is not null then
     winner:=(r.data->>'winner')::integer; victor:=case when winner=0 then r.a else r.b end; loser:=case when winner=0 then r.b else r.a end;
     insert into public.arena_ratings(player_id) values(r.a),(r.b) on conflict do nothing;
     select score,win_streak+1 into sa,streak from public.arena_ratings where player_id=victor;
     select score into sb from public.arena_ratings where player_id=loser;
     delta:=greatest(8,least(40,round(32*(1-1/(1+power(10.0,(sb-sa)/400.0))))::integer));
     gain:=round(delta*case when sa<1100 then 2 when sa<1300 then 1.5 else 1 end)::integer;
     update public.arena_ratings set score=score+gain+public.server_arena_streak_bonus(streak),wins=wins+1,win_streak=streak,
       best_streak=greatest(best_streak,streak),best_score=greatest(best_score,score+gain+public.server_arena_streak_bonus(streak)) where player_id=victor;
     update public.arena_ratings set score=greatest(0,score-delta),losses=losses+1,win_streak=0 where player_id=loser;
     perform public.server_arena_track_week(victor);
     perform public.server_arena_track_week(loser);
   end if;
   update public.arena_rooms set settled=true where id=r.id;
   delete from public.arena_seats where room_id=r.id;
 end if;
 if p_request is not null then insert into public.arena_receipts values(p_player,p_request,r.id,p_fingerprint) on conflict do nothing; end if;
 return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version));
end $$;
