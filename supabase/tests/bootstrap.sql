-- 테스트 컨테이너 전용 뼈대. 운영 Supabase에서는 실행하지 않는다.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create table public.players(id uuid primary key references auth.users, uid bigint generated always as identity(start with 100000001),created_at timestamptz default now(),status text not null default 'active');
create table public.player_saves(player_id uuid primary key references public.players,data jsonb,data_hash text,save_version integer,summary jsonb,revision bigint default 1,updated_at timestamptz default now());
create function public.upload_my_save(jsonb,text,integer,jsonb,bigint) returns void language sql as $$select$$;
create function public.remove_my_save(bigint) returns void language sql as $$select$$;
