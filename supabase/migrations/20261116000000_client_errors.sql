-- 게임 클라이언트 오류 자동 수집. 같은 오류는 fingerprint로 한 줄에 묶고 발생 횟수·마지막 시각만 올린다.
-- 쓰기는 report_client_error 함수만(로그인한 계정, 속도 제한·길이 제한·새 오류 종류 상한), 읽기는 운영 직원만.
-- 개인정보·토큰·저장 데이터는 받지 않는다(클라이언트가 보내지 않고, 서버도 길이로 한 번 더 자른다).
-- AI에게 넘겨 고치는 방법은 docs/error-reports.md.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  kind text not null check (kind in ('error','rejection','report')),
  code text check (code is null or char_length(code) <= 64),
  message text not null check (char_length(message) <= 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  build text check (build is null or char_length(build) <= 16),
  platform text check (platform is null or char_length(platform) <= 16),
  scene text check (scene is null or char_length(scene) <= 48),
  context jsonb not null default '{}'::jsonb,
  breadcrumbs jsonb not null default '[]'::jsonb,
  occurrences int not null default 1,
  affected_players int not null default 1,
  last_player_id uuid,
  status text not null default 'open' check (status in ('open','fixed','ignored')),
  note text check (note is null or char_length(note) <= 1000),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists client_errors_status_idx on public.client_errors(status, last_seen desc);
create index if not exists client_errors_count_idx on public.client_errors(occurrences desc);

alter table public.client_errors enable row level security;
create policy client_errors_staff_read on public.client_errors for select to authenticated
  using (private.admin_can(array['owner','operator']));
grant select on public.client_errors to authenticated;

-- 숫자·주소 조각·긴 식별자는 같은 오류의 다른 값이므로 지우고 묶는다.
create or replace function private.client_error_fingerprint(p_code text, p_message text, p_stack text)
returns text language sql immutable set search_path = '' as $fn$
  select md5(
    coalesce(p_code, '') || '|' ||
    left(regexp_replace(regexp_replace(coalesce(p_message, ''), '[0-9a-f]{8}-[0-9a-f-]{27}', '#', 'g'), '[0-9]+', '#', 'g'), 200) || '|' ||
    -- 스택은 위 세 줄의 함수 이름만(줄·열 번호는 빌드마다 바뀐다)
    coalesce((select string_agg(regexp_replace(l, '[0-9]+|https?://\S+|\(.*\)', '#', 'g'), E'\n' order by n)
              from regexp_split_to_table(coalesce(p_stack, ''), E'\n') with ordinality as t(l, n) where n <= 3), '')
  );
$fn$;

create or replace function public.report_client_error(
  p_kind text, p_code text, p_message text, p_stack text, p_version text, p_build text, p_platform text,
  p_scene text, p_context jsonb default '{}'::jsonb, p_breadcrumbs jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  fp text;
  msg text := left(coalesce(nullif(trim(p_message), ''), '(메시지 없음)'), 500);
  stk text := left(p_stack, 4000);
  ctx jsonb := case when jsonb_typeof(p_context) = 'object' and length(p_context::text) <= 3000 then p_context else '{}'::jsonb end;
  crumbs jsonb := case when jsonb_typeof(p_breadcrumbs) = 'array' and length(p_breadcrumbs::text) <= 3000 then p_breadcrumbs else '[]'::jsonb end;
  n int;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_kind not in ('error','rejection','report') then return jsonb_build_object('ok', false, 'error', 'invalid_kind'); end if;
  -- 시간당 30건. 같은 오류가 쏟아져도 이 선에서 멈춘다.
  if private.support_limited('err:' || me, 30) then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  fp := private.client_error_fingerprint(p_code, msg, stk);
  update public.client_errors
     set occurrences = occurrences + 1,
         affected_players = affected_players + case when last_player_id is distinct from me then 1 else 0 end,
         last_player_id = me, last_seen = now(),
         app_version = coalesce(left(p_version, 32), app_version),
         status = case when status = 'fixed' and left(p_version, 32) is distinct from app_version then 'open' else status end
   where fingerprint = fp;
  if found then return jsonb_build_object('ok', true, 'known', true); end if;
  -- 새 오류 종류가 무한히 늘지 않게 상한을 둔다(기존 오류의 횟수는 계속 오른다).
  select count(*) into n from public.client_errors;
  if n >= 5000 then return jsonb_build_object('ok', false, 'error', 'full'); end if;
  insert into public.client_errors(fingerprint, kind, code, message, stack, app_version, build, platform, scene, context, breadcrumbs, last_player_id)
  values (fp, p_kind, left(p_code, 64), msg, stk, left(p_version, 32), left(p_build, 16), left(p_platform, 16), left(p_scene, 48), ctx, crumbs, me)
  on conflict (fingerprint) do update set occurrences = public.client_errors.occurrences + 1, last_seen = now();
  return jsonb_build_object('ok', true, 'known', false);
end $fn$;

create or replace function public.admin_set_client_error_status(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
begin
  if not private.admin_can(array['owner','operator']) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('open','fixed','ignored') then raise exception 'invalid_status'; end if;
  update public.client_errors set status = p_status, note = coalesce(left(p_note, 1000), note) where id = p_id;
  return jsonb_build_object('ok', found);
end $fn$;

revoke all on function private.client_error_fingerprint(text, text, text) from public, anon, authenticated;
revoke all on function public.report_client_error(text, text, text, text, text, text, text, text, jsonb, jsonb),
  public.admin_set_client_error_status(bigint, text, text) from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text, text, text, text, jsonb, jsonb),
  public.admin_set_client_error_status(bigint, text, text) to authenticated;
