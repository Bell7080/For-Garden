-- 계정 이메일이 바뀌어도 아이디 로그인은 동일 UID를 찾는다. 비밀번호는 Auth만 소유한다.
create table public.account_login_ids (
 player_id uuid primary key references auth.users(id) on delete cascade,
 account_id text not null unique check(account_id ~ '^[a-z][a-z0-9_]{3,19}$')
);
alter table public.account_login_ids enable row level security;
revoke all on public.account_login_ids from public,anon,authenticated;
grant all on public.account_login_ids to service_role;
insert into public.account_login_ids(player_id,account_id)
 select id,split_part(email,'@',1) from auth.users
 where email ~ '^[a-z][a-z0-9_]{3,19}@id[.]forgarden[.]app$'
 on conflict do nothing;

create function public.server_set_account_id(p_player uuid,p_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare saved text;
begin
 if p_id !~ '^[a-z][a-z0-9_]{3,19}$' then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('login-id:'||p_id,29));
 select account_id into saved from public.account_login_ids where player_id=p_player;
 if saved is not null then return saved=p_id; end if;
 begin
  insert into public.account_login_ids(player_id,account_id) values(p_player,p_id);
 exception when unique_violation then return false;
 end;
 return true;
end $$;
revoke all on function public.server_set_account_id(uuid,text) from public,anon,authenticated;
grant execute on function public.server_set_account_id(uuid,text) to service_role;

create or replace function public.server_id_account(p_email text) returns jsonb
language sql security definer set search_path='' stable as $$
 select jsonb_build_object('id',u.id,'email',u.email) from auth.users u
 where p_email ~ '^[a-z][a-z0-9_]{3,19}@id[.]forgarden[.]app$'
 and (exists(select 1 from public.account_login_ids a where a.player_id=u.id and a.account_id=split_part(p_email,'@',1))
      or (u.email=p_email and not exists(select 1 from public.account_login_ids a where a.account_id=split_part(p_email,'@',1))))
 limit 1;
$$;
revoke all on function public.server_id_account(text) from public,anon,authenticated;
grant execute on function public.server_id_account(text) to service_role;

-- 본인 표시용이다. 비밀번호 존재 여부/아이디를 다른 UID로 조회할 수 없다.
create function public.account_login_id() returns text
language sql security definer set search_path='' stable as $$
 select a.account_id from public.account_login_ids a join auth.users u on u.id=a.player_id
 where a.player_id=auth.uid() and coalesce(u.encrypted_password,'')<>'';
$$;
revoke all on function public.account_login_id() from public,anon;
grant execute on function public.account_login_id() to authenticated;
