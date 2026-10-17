-- 출시 서버 경계: 모든 RPC는 서비스 롤 전용. 친구/대여/공유 체력/요청 예산을 DB에서 확정한다.
create table public.server_public_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.server_friend_edges (
  a uuid not null references public.players(id) on delete cascade,
  b uuid not null references public.players(id) on delete cascade,
  requester uuid not null,
  status text not null check (status in ('pending','friend')),
  requested_at timestamptz not null default now(),
  primary key (a,b), check (a < b), check (requester in (a,b))
);
create index server_friend_edges_b_idx on public.server_friend_edges(b);
create table public.server_friend_favorites (
  player_id uuid not null references public.players(id) on delete cascade,
  friend_id uuid not null references public.players(id) on delete cascade,
  primary key(player_id,friend_id)
);
create table public.server_social_wallets (
  player_id uuid primary key references public.players(id) on delete cascade,
  points bigint not null default 0 check (points >= 0),
  rental_day date not null default current_date,
  rental_uses integer not null default 0 check (rental_uses between 0 and 3)
);
create table public.server_rate_windows (
  player_id uuid not null references public.players(id) on delete cascade,
  bucket text not null, window_at timestamptz not null, used integer not null,
  primary key(player_id,bucket)
);
create table public.server_social_receipts (
  player_id uuid not null references public.players(id) on delete cascade,
  request_id text not null, fingerprint text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key(player_id,request_id)
);
create table public.server_raids (
  id text primary key, definition jsonb not null, revision bigint not null default 1,
  owner_id uuid references public.players(id) on delete set null,
  ends_at timestamptz not null, damage bigint not null default 0 check(damage >= 0)
);
create table public.server_raid_members (
  raid_id text not null references public.server_raids(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  damage bigint not null default 0 check(damage >= 0), applied_damage bigint not null default 0 check(applied_damage >= 0),
  attempts integer not null default 0 check(attempts between 0 and 2), settled boolean not null default false,
  primary key(raid_id,player_id)
);

do $$ declare n text; begin
  foreach n in array array['server_public_profiles','server_friend_edges','server_friend_favorites','server_social_wallets','server_rate_windows','server_social_receipts','server_raids','server_raid_members'] loop
    execute format('alter table public.%I enable row level security',n);
    execute format('revoke all on public.%I from public,anon,authenticated',n);
  end loop;
end $$;

create function public.server_require_active(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.players where id=p_player and status='active') then
    raise exception 'account_blocked' using errcode='PT403';
  end if;
end $$;

create function public.server_player_identity(p_player uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  perform public.server_require_active(p_player);
  return (select jsonb_build_object('uid',uid::text,'createdAt',created_at) from public.players where id=p_player);
end $$;

create function public.server_take_rate(p_player uuid,p_bucket text,p_window integer,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); n integer; w timestamptz;
begin
  perform public.server_require_active(p_player);
  if p_window not between 1 and 3600 or p_limit not between 1 and 1000 or length(p_bucket)>80 then raise exception 'invalid_budget'; end if;
  insert into public.server_rate_windows as old(player_id,bucket,window_at,used) values(p_player,p_bucket,t,1)
  on conflict(player_id,bucket) do update set
    used=case when old.window_at <= t-make_interval(secs=>p_window) then 1 else least(old.used+1,p_limit+1) end,
    window_at=case when old.window_at <= t-make_interval(secs=>p_window) then t else old.window_at end
  returning used,window_at into n,w;
  update public.server_public_profiles set updated_at=t,profile=profile||jsonb_build_object('lastActiveAt',floor(extract(epoch from t)*1000)) where player_id=p_player and updated_at<t-interval '60 seconds';
  return jsonb_build_object('allowed',n<=p_limit,'retryAfter',greatest(1,ceil(extract(epoch from w+make_interval(secs=>p_window)-t))));
end $$;

create function public.server_are_friends(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.server_friend_edges where a=least(p_a,p_b) and b=greatest(p_a,p_b) and status='friend');
$$;

create function public.server_social_call(p_player uuid,p_method text,p_args jsonb,p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare other uuid; edge public.server_friend_edges; out jsonb; data jsonb; args jsonb:=coalesce(p_args,'[]');
  fingerprint text; cached public.server_social_receipts; t timestamptz:=now(); incoming integer; n integer; processed integer:=0; skipped integer:=0; target record; wallet public.server_social_wallets;
begin
  perform public.server_require_active(p_player);
  if p_method not in ('getFriends','getRequests','searchUsers','getRecommendations','sendRequest','cancelRequest','acceptRequest','declineRequest','acceptAllRequests','declineAllRequests','setFavorite','removeFriend','rentFavoriteRelic') then raise exception 'unknown_method' using errcode='PT400'; end if;
  -- 친구 상한/서로 신청/양쪽 포인트를 같은 트랜잭션에 묶는다. 초기 규모에서는 소셜 변경을 전역 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended('forgarden-social',18));
  fingerprint:=jsonb_build_array(p_method,args)::text;
  if p_method not in ('getFriends','getRequests','searchUsers','getRecommendations') then
    if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
    select * into cached from public.server_social_receipts where player_id=p_player and request_id=p_request;
    if found then
      if cached.fingerprint<>fingerprint then raise exception 'request_id_conflict' using errcode='PT409'; end if;
      return cached.response;
    end if;
  end if;
  insert into public.server_social_wallets(player_id) values(p_player) on conflict do nothing;
  if p_method in ('getFriends','getRequests','searchUsers','getRecommendations') then
    if p_method='getFriends' then
      select * into wallet from public.server_social_wallets where player_id=p_player;
      select jsonb_build_object('friends',coalesce(jsonb_agg(p.profile order by p.updated_at desc),'[]'::jsonb)) into data
      from public.server_friend_edges e join public.server_public_profiles p on p.player_id=case when e.a=p_player then e.b else e.a end
      join public.players u on u.id=p.player_id and u.status='active' where p_player in(e.a,e.b) and e.status='friend';
      data:=data||jsonb_build_object('favoriteIds',coalesce((select jsonb_agg(friend_id) from public.server_friend_favorites where player_id=p_player),'[]'::jsonb),'friendPoints',wallet.points,'helperUsesToday',case when wallet.rental_day=(t at time zone 'UTC')::date then wallet.rental_uses else 0 end,'friendLimit',50,'serverTime',floor(extract(epoch from t)*1000));
    elsif p_method='getRequests' then
      select jsonb_build_object('incoming',coalesce(jsonb_agg(jsonb_build_object('profile',p.profile,'requestedAt',floor(extract(epoch from e.requested_at)*1000)) order by e.requested_at desc) filter(where e.requester<>p_player),'[]'::jsonb),
      'outgoing',coalesce(jsonb_agg(jsonb_build_object('profile',p.profile,'requestedAt',floor(extract(epoch from e.requested_at)*1000)) order by e.requested_at desc) filter(where e.requester=p_player),'[]'::jsonb),'requestLimit',30,'serverTime',floor(extract(epoch from t)*1000)) into data
      from public.server_friend_edges e join public.server_public_profiles p on p.player_id=case when e.a=p_player then e.b else e.a end
      join public.players u on u.id=p.player_id and u.status='active' where p_player in(e.a,e.b) and e.status='pending';
    else
      if p_method='searchUsers' and (jsonb_typeof(args->0->'query') is distinct from 'string' or length(trim(args->0->>'query')) not between 1 and 40) then raise exception 'invalid_query' using errcode='PT400'; end if;
      select jsonb_build_object('users',coalesce(jsonb_agg(row_data),'[]'::jsonb),'serverTime',floor(extract(epoch from t)*1000)) into data from (
        select jsonb_build_object('profile',p.profile,'relation',case when e.status='friend' then 'friend' when e.requester=p_player then 'outgoing' when e.status='pending' then 'incoming' else 'none' end) row_data
        from public.server_public_profiles p join public.players u on u.id=p.player_id and u.status='active'
        left join public.server_friend_edges e on e.a=least(p_player,p.player_id) and e.b=greatest(p_player,p.player_id)
        where p.player_id<>p_player and (p_method='getRecommendations' and e.a is null or p_method='searchUsers' and (p.profile->>'uid'=trim(args->0->>'query') or starts_with(lower(p.profile->>'displayName'),lower(trim(args->0->>'query')))))
        order by p.updated_at desc limit 10
      ) rows;
    end if;
  elsif p_method in ('acceptAllRequests','declineAllRequests') then
    for target in select e.requester from public.server_friend_edges e join public.players u on u.id=e.requester and u.status='active' where p_player in(e.a,e.b) and e.status='pending' and e.requester<>p_player order by e.requested_at loop
      if p_method='declineAllRequests' then delete from public.server_friend_edges where a=least(p_player,target.requester) and b=greatest(p_player,target.requester); processed:=processed+1;
      elsif (select count(*) from public.server_friend_edges where status='friend' and p_player in(a,b))>=50 or (select count(*) from public.server_friend_edges where status='friend' and target.requester in(a,b))>=50 then skipped:=skipped+1;
      else update public.server_friend_edges set status='friend' where a=least(p_player,target.requester) and b=greatest(p_player,target.requester); processed:=processed+1; end if;
    end loop;
    data:=jsonb_build_object('processed',processed,'skipped',skipped);
  else
    begin other:=(args->>0)::uuid; exception when others then raise exception 'USER_NOT_FOUND' using errcode='PT422'; end;
    if other=p_player then raise exception 'SELF_REQUEST' using errcode='PT422'; end if;
    if not exists(select 1 from public.server_public_profiles p join public.players u on u.id=p.player_id where p.player_id=other and u.status='active') then raise exception 'USER_NOT_FOUND' using errcode='PT422'; end if;
    select * into edge from public.server_friend_edges where a=least(p_player,other) and b=greatest(p_player,other);
    if p_method in ('sendRequest','acceptRequest') then
      if edge.status='friend' then raise exception 'ALREADY_FRIEND' using errcode='PT422'; end if;
      if p_method='acceptRequest' and (edge.status is distinct from 'pending' or edge.requester=p_player) then raise exception 'REQUEST_NOT_FOUND' using errcode='PT422'; end if;
      if (select count(*) from public.server_friend_edges where status='friend' and p_player in(a,b))>=50 or (select count(*) from public.server_friend_edges where status='friend' and other in(a,b))>=50 then raise exception 'FRIEND_LIMIT' using errcode='PT422'; end if;
      if edge.status='pending' and edge.requester=other then
        update public.server_friend_edges set status='friend' where a=edge.a and b=edge.b;
        data:=case when p_method='sendRequest' then jsonb_build_object('relation','friend') else 'null'::jsonb end;
      else
        if edge.status='pending' then raise exception 'ALREADY_REQUESTED' using errcode='PT422'; end if;
        if (select count(*) from public.server_friend_edges where status='pending' and requester=p_player)>=30 or (select count(*) from public.server_friend_edges where status='pending' and other in(a,b) and requester<>other)>=30 then raise exception 'REQUEST_LIMIT' using errcode='PT422'; end if;
        insert into public.server_friend_edges(a,b,requester,status) values(least(p_player,other),greatest(p_player,other),p_player,'pending');
        data:=jsonb_build_object('relation','outgoing');
      end if;
    elsif p_method in ('cancelRequest','declineRequest') then
      if edge.status is distinct from 'pending' or (p_method='cancelRequest' and edge.requester<>p_player) or (p_method='declineRequest' and edge.requester=p_player) then raise exception 'REQUEST_NOT_FOUND' using errcode='PT422'; end if;
      delete from public.server_friend_edges where a=edge.a and b=edge.b; data:='null';
    else
      if edge.status is distinct from 'friend' then raise exception 'FRIEND_NOT_FOUND' using errcode='PT422'; end if;
      if p_method='removeFriend' then
        delete from public.server_friend_edges where a=edge.a and b=edge.b;
        delete from public.server_friend_favorites where (player_id=p_player and friend_id=other) or (player_id=other and friend_id=p_player); data:='null';
      elsif p_method='setFavorite' then
        if jsonb_typeof(args->1) is distinct from 'boolean' then raise exception 'invalid_args' using errcode='PT400'; end if;
        if (args->>1)::boolean then insert into public.server_friend_favorites values(p_player,other) on conflict do nothing;
        else delete from public.server_friend_favorites where player_id=p_player and friend_id=other; end if; data:='null';
      else
        select * into wallet from public.server_social_wallets where player_id=p_player for update;
        n:=case when wallet.rental_day=(t at time zone 'UTC')::date then wallet.rental_uses else 0 end;
        if n>=3 then raise exception 'DAILY_HELPER_LIMIT' using errcode='PT422'; end if;
        update public.server_social_wallets set points=points+10,rental_day=(t at time zone 'UTC')::date,rental_uses=n+1 where player_id=p_player;
        insert into public.server_social_wallets(player_id,points) values(other,10) on conflict(player_id) do update set points=public.server_social_wallets.points+10;
        data:=jsonb_build_object('friendId',other,'relicId',(select profile->'favoriteRelic'->>'relicId' from public.server_public_profiles where player_id=other),'renterPointsEarned',10,'ownerPointsEarned',10,'friendPoints',wallet.points+10,'remaining',2-n);
      end if;
    end if;
  end if;
  select count(*) into incoming from public.server_friend_edges e join public.players u on u.id=e.requester and u.status='active' where p_player in(e.a,e.b) and e.status='pending' and e.requester<>p_player;
  out:=jsonb_build_object('ok',true,'result',data,'incomingCount',incoming);
  if p_request is not null and p_method not in ('getFriends','getRequests','searchUsers','getRecommendations') then insert into public.server_social_receipts values(p_player,p_request,fingerprint,out,t); end if;
  return out;
end $$;

create or replace function public.server_commit_state_base(p_player uuid, p_expected_revision bigint, p_data jsonb,
  p_hash text, p_version integer, p_summary jsonb, p_method text, p_request text, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.player_saves;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_save' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_player::text, 7));
  select * into r from public.player_saves where player_id = p_player;
  if not found then
    if p_expected_revision is not null then raise exception 'save_conflict' using errcode = 'PT409'; end if;
    insert into public.player_saves(player_id, data, data_hash, save_version, summary)
      values (p_player, p_data, p_hash, p_version, coalesce(p_summary, '{}'::jsonb)) returning * into r;
  else
    if p_expected_revision is distinct from r.revision then raise exception 'save_conflict' using errcode = 'PT409'; end if;
    update public.player_saves set data = p_data, data_hash = p_hash, save_version = p_version,
      summary = coalesce(p_summary, '{}'::jsonb), revision = revision + 1, updated_at = now()
      where player_id = p_player returning * into r;
  end if;
  if p_request is not null then
    insert into public.request_receipts(player_id, request_id, method, response)
      values (p_player, p_request, p_method, coalesce(p_response, '{}'::jsonb) || jsonb_build_object('revision', r.revision::text))
      on conflict (player_id, request_id) do nothing;
  end if;
  return jsonb_build_object('revision', r.revision::text);
end $$;


create function public.server_raid_context(p_player uuid,p_worlds jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare world jsonb; out jsonb;
begin
 perform public.server_require_active(p_player);
 for world in select value from jsonb_array_elements(p_worlds) loop
   insert into public.server_raids(id,definition,ends_at) values(world->>'id',world,(world->>'endsAt')::timestamptz) on conflict do nothing;
 end loop;
 select jsonb_build_object('playerId',p_player,'records',coalesce(jsonb_agg(row_data),'[]'::jsonb)) into out from (
   select jsonb_build_object('revision',r.revision::text,'damage',r.damage,
     'instance',jsonb_strip_nulls(r.definition||jsonb_build_object('myDamage',coalesce(m.damage,0),'appliedDamage',coalesce(m.applied_damage,0),'attemptsUsed',coalesce(m.attempts,0),'settled',coalesce(m.settled,false),'summonedByMe',coalesce(r.owner_id=p_player,false),
       'summonerName',owner.profile->>'displayName')),
     'entries',coalesce((select jsonb_agg(v) from (
       select jsonb_build_object('rank',row_number() over(order by x.damage desc,x.player_id),'playerId',x.player_id,'displayName',coalesce(p.profile->>'displayName','연구원'),'favoriteRelicId',p.profile->'favoriteRelic'->>'relicId','damage',x.damage,'isMe',x.player_id=p_player) v
       from public.server_raid_members x left join public.server_public_profiles p on p.player_id=x.player_id where x.raid_id=r.id and x.damage>0 order by x.damage desc,x.player_id limit 100
     ) entries),'[]'::jsonb)) row_data
   from public.server_raids r left join public.server_raid_members m on m.raid_id=r.id and m.player_id=p_player
   left join public.server_public_profiles owner on owner.player_id=r.owner_id
   where (r.owner_id is null or r.owner_id=p_player or public.server_are_friends(p_player,r.owner_id) or m.player_id is not null)
     and (r.ends_at>now()-interval '48 hours' or coalesce(m.damage,0)>0 and not m.settled)
   order by r.ends_at desc limit 200
 ) records;
 return out;
end $$;

-- 계정 저장·멱등 영수증·공유 레이드 변경이 한 트랜잭션에서 성공하거나 모두 취소된다.
create or replace function public.server_commit_state(p_player uuid,p_expected_revision bigint,p_data jsonb,p_hash text,p_version integer,p_summary jsonb,p_method text,p_request text,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare change jsonb; raid public.server_raids; member public.server_raid_members; result jsonb; profile jsonb; canonical_uid text;
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 for change in select value from jsonb_array_elements(coalesce(p_summary->'_raids','[]'::jsonb)) order by value->'instance'->>'id' loop
   select * into raid from public.server_raids where id=change->'instance'->>'id' for update;
   if not found then
     if change->>'expectedRevision' is not null or change->'instance'->>'kind'<>'summon' then raise exception 'raid_conflict' using errcode='PT409'; end if;
     insert into public.server_raids(id,definition,owner_id,ends_at) values(change->'instance'->>'id',change->'instance',p_player,(change->'instance'->>'endsAt')::timestamptz) returning * into raid;
   elsif raid.revision::text is distinct from change->>'expectedRevision' then raise exception 'raid_conflict' using errcode='PT409'; end if;
   if raid.owner_id is not null and raid.owner_id<>p_player and not public.server_are_friends(p_player,raid.owner_id) and not exists(select 1 from public.server_raid_members where raid_id=raid.id and player_id=p_player) then raise exception 'raid_forbidden' using errcode='PT403'; end if;
   if (change->>'damageDelta')::bigint<0 or (change->>'appliedDelta')::bigint<0 or (change->>'attemptsDelta')::int not between 0 and 1 or raid.damage+(change->>'appliedDelta')::bigint>(change->>'totalHp')::bigint then raise exception 'invalid_raid_delta'; end if;
   insert into public.server_raid_members(raid_id,player_id) values(raid.id,p_player) on conflict do nothing;
   select * into member from public.server_raid_members where raid_id=raid.id and player_id=p_player for update;
   if (change->'instance'->>'settled')::boolean and member.settled and (change->>'damageDelta')::bigint>0 then raise exception 'raid_already_settled'; end if;
   update public.server_raid_members set damage=damage+(change->>'damageDelta')::bigint,applied_damage=applied_damage+(change->>'appliedDelta')::bigint,attempts=attempts+(change->>'attemptsDelta')::integer,settled=(change->'instance'->>'settled')::boolean where raid_id=raid.id and player_id=p_player;
   update public.server_raids set revision=revision+1,damage=damage+(change->>'appliedDelta')::bigint where id=raid.id;
 end loop;
 result:=public.server_commit_state_base(p_player,p_expected_revision,p_data,p_hash,p_version,p_summary-'_raids'-'_profile',p_method,p_request,p_response);
 profile:=p_summary->'_profile';
 if profile is not null then
   select uid::text into canonical_uid from public.players where id=p_player;
   profile:=profile||jsonb_build_object('id',p_player,'uid',canonical_uid,'lastActiveAt',floor(extract(epoch from now())*1000));
   insert into public.server_public_profiles(player_id,profile) values(p_player,profile) on conflict(player_id) do update set profile=excluded.profile,updated_at=now();
 end if;
 return result;
end $$;

revoke all on function public.server_commit_state_base(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb), public.server_require_active(uuid),public.server_player_identity(uuid),public.server_take_rate(uuid,text,integer,integer), public.server_are_friends(uuid,uuid),public.server_social_call(uuid,text,jsonb,text),public.server_raid_context(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_commit_state_base(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb),public.server_require_active(uuid),public.server_player_identity(uuid),public.server_take_rate(uuid,text,integer,integer),public.server_are_friends(uuid,uuid),public.server_social_call(uuid,text,jsonb,text),public.server_raid_context(uuid,jsonb) to service_role;
