-- 초기 뼈대: 플레이어, 관리자 역할, 연결 확인(ping).
-- 모든 테이블은 RLS를 켜고, 쓰기는 이후 서버 함수(RPC/Edge Function)로만 연다.
create table public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  uid bigint generated always as identity (start with 100000001) unique,
  nickname text,
  created_at timestamptz not null default now()
);
alter table public.players enable row level security;
create policy players_select_own on public.players for select to authenticated using (id = (select auth.uid()));

create table public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','operator','cs','viewer')),
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
create policy admin_roles_select_own on public.admin_roles for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles where user_id = (select auth.uid()));
$$;

-- 연결 확인용: 서버 시계 + 로그인 여부
create or replace function public.ping() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('ok', true, 'server_now', now(), 'authenticated', (select auth.uid()) is not null);
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.players (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.ping() to anon, authenticated;
