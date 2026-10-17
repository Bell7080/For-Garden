-- 초기화 스크립트 검증용 Supabase 뼈대. 격리된 로컬 PostgreSQL 전용이며 운영/테스트 Supabase에서는 실행하지 않는다.
-- 실제 Supabase가 기본으로 갖는 것(역할, auth, storage)과 For-Garden-Web 저장소의 website_* 표를 흉내 낸다.
-- 역할은 클러스터 전체에 하나라 여러 번 만들어도 되게 한다.
do $r$ declare r text; begin foreach r in array array['anon','authenticated','service_role'] loop
  if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
end loop; end $r$;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false);
create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
create table auth.refresh_tokens(id bigserial primary key, user_id text, session_id uuid references auth.sessions(id) on delete cascade);
create table auth.one_time_tokens(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
create table auth.flow_state(id uuid primary key default gen_random_uuid(), user_id uuid);
create table auth.audit_log_entries(id uuid primary key default gen_random_uuid(), payload json);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
-- For-Garden-Web/supabase/migrations/202610160001_website.sql 의 표 정의(함수 제외).
create table public.website_notices (id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{0,100}$'),category text not null check(category in ('notice','development','event')),status text not null default 'draft' check(status in ('draft','published')),published_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.website_notice_translations (notice_id uuid not null references public.website_notices(id) on delete cascade,locale text not null check(locale in ('ko','en','ja')),title text not null check(length(title) between 1 and 200),summary text not null default '',body text not null check(length(body) between 1 and 50000),primary key(notice_id,locale));
create table public.website_preregistrations (id uuid primary key default gen_random_uuid(),email text not null unique,platform text not null check(platform in ('android','ios','both')),locale text not null check(locale in ('ko','en','ja')),consent_version text not null default 'launch-notification-v1',consented_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.website_registration_limits (fingerprint text not null,bucket timestamptz not null,attempts integer not null default 1,primary key(fingerprint,bucket));
