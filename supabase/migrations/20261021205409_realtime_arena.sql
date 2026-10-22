-- Preparation is transactional; battle simulation and roster validation run in the trusted game server.
create table public.arena_ratings(player_id uuid primary key references public.players(id) on delete cascade, score integer not null default 1000, wins integer not null default 0, losses integer not null default 0);
create table public.arena_rooms(id uuid primary key default gen_random_uuid(), a uuid not null references public.players(id) on delete cascade, b uuid not null references public.players(id) on delete cascade, version integer not null default 0, data jsonb not null, settled boolean not null default false, created_at timestamptz not null default now(), check(a<>b));
create index arena_rooms_b on public.arena_rooms(b,created_at desc);
create index arena_rooms_a on public.arena_rooms(a,created_at desc);
create table public.arena_seats(player_id uuid primary key references public.players(id) on delete cascade, room_id uuid not null references public.arena_rooms(id) on delete cascade);
create table public.arena_queue(player_id uuid primary key references public.players(id) on delete cascade, joined_at timestamptz not null default now(), heartbeat timestamptz not null default now());
create table public.arena_receipts(player_id uuid not null references public.players(id) on delete cascade, request_id text not null, room_id uuid references public.arena_rooms(id) on delete cascade, fingerprint jsonb not null, primary key(player_id,request_id));
do $$ declare n text; begin foreach n in array array['arena_ratings','arena_rooms','arena_seats','arena_queue','arena_receipts'] loop execute format('alter table public.%I enable row level security',n); execute format('revoke all on public.%I from public, anon, authenticated',n); end loop; end $$;

create function public.server_arena_context(p_player uuid,p_kind text,p_room uuid,p_target uuid,p_rules jsonb,p_request text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.arena_rooms; old public.arena_receipts; target uuid; own_data jsonb; other_data jsonb; first_side integer; is_ranked boolean; rules jsonb; fp jsonb; queued timestamptz;
begin
 perform public.server_require_active(p_player);
 -- Shared matchmaking lock also prevents simultaneous invite accepts and double seats across instances.
 perform pg_advisory_xact_lock(672391005);
 if p_kind not in ('status','queue','cancel','invite','accept','decline','practice','action','finish') then raise exception 'ARENA_ACTION' using errcode='PT422'; end if;
 fp:=jsonb_build_array(p_kind,p_room,p_target,p_rules);
 select * into old from public.arena_receipts where player_id=p_player and request_id=p_request;
 if found then
   if p_kind not in ('action','finish') and old.fingerprint<>fp then raise exception 'ARENA_REQUEST_CONFLICT' using errcode='PT409'; end if;
   p_room:=old.room_id;
   if p_kind in ('invite','practice','queue','accept','decline') then p_kind:='status'; end if;
 end if;
 insert into public.arena_ratings(player_id) values(p_player) on conflict do nothing;
 -- Expired invitations never occupy a seat indefinitely.
 update public.arena_rooms set data=jsonb_set(data,'{phase}','"declined"'),version=version+1 where data->>'phase'='invited' and (data->>'deadline')::numeric<extract(epoch from now())*1000;
 delete from public.arena_seats s using public.arena_rooms m where m.id=s.room_id and m.data->>'phase' in ('declined','done');
 delete from public.arena_queue where heartbeat<now()-interval '20 seconds';
 if p_room is not null then
   select * into r from public.arena_rooms where id=p_room and p_player in(a,b);
   if not found then raise exception 'ARENA_FORBIDDEN' using errcode='PT403'; end if;
 else
   select m.* into r from public.arena_rooms m join public.arena_seats s on s.room_id=m.id where s.player_id=p_player;
 end if;
 if p_kind in ('invite','practice') and r.id is not null then raise exception 'ARENA_BUSY' using errcode='PT422'; end if;
 if p_kind='cancel' then delete from public.arena_queue where player_id=p_player;
 elsif p_kind in ('accept','decline') then
   if r.id is null or r.b<>p_player or r.data->>'phase'<>'invited' then raise exception 'ARENA_INVITE_EXPIRED' using errcode='PT422'; end if;
   if p_kind='decline' then update public.arena_rooms set data=jsonb_set(data,'{phase}','"declined"'),version=version+1 where id=r.id returning * into r; delete from public.arena_seats where room_id=r.id;
   else
     if exists(select 1 from public.arena_seats where player_id=p_player) then raise exception 'ARENA_BUSY' using errcode='PT422'; end if;
     if not exists(select 1 from public.arena_seats where player_id=r.a and room_id=r.id) then raise exception 'ARENA_INVITE_EXPIRED' using errcode='PT422'; end if;
     insert into public.arena_seats values(p_player,r.id);
     delete from public.arena_queue where player_id in(r.a,r.b);
     update public.arena_rooms set data=jsonb_set(data,'{phase}','"ban"'),version=version+1 where id=r.id returning * into r;
   end if;
 elsif p_kind in ('queue','invite','practice') and r.id is null then
   select data into own_data from public.player_saves where player_id=p_player;
   if coalesce(jsonb_array_length(own_data->'ownedRelicIds'),0)<(case when p_kind='queue' or (p_kind='invite' and (p_rules->>'ban')::boolean) then 4 else 3 end) then raise exception 'ARENA_ROSTER' using errcode='PT422'; end if;
   if p_kind='queue' then
     insert into public.arena_queue(player_id) values(p_player) on conflict(player_id) do update set heartbeat=now();
     select q.player_id into target from public.arena_queue q join public.arena_ratings t on t.player_id=q.player_id
       where q.player_id<>p_player and not exists(select 1 from public.arena_seats s where s.player_id=q.player_id)
       and abs(t.score-(select score from public.arena_ratings where player_id=p_player))<=200+least(1800,extract(epoch from now()-q.joined_at)*20)
       order by q.joined_at limit 1;
   else
     target:=p_target;
     if target is null or target=p_player or not public.server_are_friends(p_player,target) then raise exception 'ARENA_FRIEND_REQUIRED' using errcode='PT422'; end if;
     perform public.server_require_active(target);
     if p_kind='invite' and exists(select 1 from public.arena_seats where player_id=target) then raise exception 'ARENA_BUSY' using errcode='PT422'; end if;
     if p_kind='invite' and exists(select 1 from public.arena_rooms where a=p_player and b=target and created_at>now()-interval '30 seconds') then raise exception 'ARENA_INVITE_COOLDOWN' using errcode='PT429'; end if;
   end if;
   if target is not null then
     select data into other_data from public.player_saves where player_id=target;
     rules:=case when p_kind='queue' then '{"ban":true,"order":"random","placement":"alternate"}'::jsonb when p_kind='practice' then '{"ban":false,"order":"random","placement":"hidden"}'::jsonb else p_rules end;
     if coalesce(jsonb_array_length(other_data->'ownedRelicIds'),0)<(case when (rules->>'ban')::boolean then 4 else 3 end) then raise exception 'ARENA_OPPONENT_ROSTER' using errcode='PT422'; end if;
     first_side:=case rules->>'order' when 'first' then 0 when 'second' then 1 else floor(random()*2)::integer end;
     insert into public.arena_rooms(a,b,data) values(p_player,target,jsonb_build_object('ranked',p_kind='queue','rules',rules,'players',jsonb_build_array(jsonb_build_object('id',p_player,'name',coalesce(own_data->'playerCard'->>'nickname','연구원')),jsonb_build_object('id',target,'name',coalesce(other_data->'playerCard'->>'nickname','연구원'))),
       'phase',case when p_kind='invite' then 'invited' else 'ban' end,'first',first_side,'bans','[null,null]'::jsonb,'picks','[[],[]]'::jsonb,'locked','[false,false]'::jsonb,'deadline',extract(epoch from now()+interval '60 seconds')*1000,'seed',gen_random_uuid()::text,'practice',p_kind='practice')) returning * into r;
     insert into public.arena_seats values(p_player,r.id);
     if p_kind='queue' then insert into public.arena_seats values(target,r.id); end if;
     delete from public.arena_queue where player_id=p_player or (p_kind='queue' and player_id=target);
   end if;
 end if;
 if p_request is not null and p_kind not in ('status','action','finish') and (p_kind<>'queue' or r.id is not null) then insert into public.arena_receipts values(p_player,p_request,r.id,fp) on conflict do nothing; end if;
 select joined_at into queued from public.arena_queue where player_id=p_player;
 return jsonb_build_object('playerId',p_player,'score',(select score from public.arena_ratings where player_id=p_player),'wins',(select wins from public.arena_ratings where player_id=p_player),'losses',(select losses from public.arena_ratings where player_id=p_player),'queuedAt',queued,
   'room',case when r.id is null then null else r.data||jsonb_build_object('id',r.id,'version',r.version) end,
   'incoming',coalesce((select jsonb_agg(m.data||jsonb_build_object('id',m.id,'version',m.version)) from public.arena_rooms m where m.b=p_player and m.data->>'phase'='invited'),'[]'),
   'receiptFingerprint',case when old.request_id is not null and p_kind in ('action','finish') then old.fingerprint else null end,
   'records',case when r.id is null or r.data->>'phase'='invited' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',s.player_id,'data',s.data)) from public.player_saves s where s.player_id in(r.a,r.b)),'[]') end);
end $$;

create function public.server_arena_commit(p_player uuid,p_room uuid,p_version integer,p_data jsonb,p_request text,p_fingerprint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.arena_rooms; old public.arena_receipts; winner integer; loser uuid; victor uuid; delta integer; sa integer; sb integer;
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
     select score into sa from public.arena_ratings where player_id=victor;
     select score into sb from public.arena_ratings where player_id=loser;
     delta:=greatest(8,least(40,round(32*(1-1/(1+power(10.0,(sb-sa)/400.0))))::integer));
     update public.arena_ratings set score=score+delta,wins=wins+1 where player_id=victor;
     update public.arena_ratings set score=greatest(0,score-delta),losses=losses+1 where player_id=loser;
   end if;
   update public.arena_rooms set settled=true where id=r.id;
   delete from public.arena_seats where room_id=r.id;
 end if;
 if p_request is not null then insert into public.arena_receipts values(p_player,p_request,r.id,p_fingerprint) on conflict do nothing; end if;
 return jsonb_build_object('room',r.data||jsonb_build_object('id',r.id,'version',r.version));
end $$;
revoke all on function public.server_arena_context(uuid,text,uuid,uuid,jsonb,text),public.server_arena_commit(uuid,uuid,integer,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.server_arena_context(uuid,text,uuid,uuid,jsonb,text),public.server_arena_commit(uuid,uuid,integer,jsonb,text,jsonb) to service_role;

-- Only an owner's small wakeup counter is exposed to Realtime. Room data stays service-role-only.
create table public.arena_signals(player_id uuid primary key references public.players(id) on delete cascade, version bigint not null default 1);
alter table public.arena_signals enable row level security;
revoke all on public.arena_signals from public,anon,authenticated;
grant select on public.arena_signals to authenticated;
create policy arena_signals_own on public.arena_signals for select to authenticated using(player_id=(select auth.uid()));
create function public.server_arena_signal() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.arena_signals(player_id) values(new.a),(new.b) on conflict(player_id) do update set version=public.arena_signals.version+1;
 return new;
end $$;
revoke all on function public.server_arena_signal() from public,anon,authenticated;
create trigger arena_room_signal after insert or update on public.arena_rooms for each row execute function public.server_arena_signal();
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.arena_signals; end if; end $$;
