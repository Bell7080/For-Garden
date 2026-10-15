-- 어드민 공지 관리: 공지 확장 칼럼, 역할 판정 함수, 어드민 정책, 감사 로그, 공지 이미지 저장소.
-- 홈페이지의 website_* 테이블(For-Garden-Web/supabase/migrations)이 먼저 적용돼 있어야 한다.
alter table public.website_notices
  add column cover_image text check (cover_image is null or cover_image ~ '^https://'),
  add column pinned boolean not null default false,
  add column template text not null default 'plain' check (template in ('plain','update','event')),
  add column updated_at timestamptz not null default now();

create or replace function public.admin_can(roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles where user_id = (select auth.uid()) and role = any(roles));
$$;
revoke execute on function public.admin_can(text[]) from public, anon;
grant execute on function public.admin_can(text[]) to authenticated;

grant all on public.website_notices, public.website_notice_translations to authenticated;

create policy notices_admin_read on public.website_notices for select to authenticated using (public.is_admin());
create policy notices_admin_write on public.website_notices for all to authenticated
  using (public.admin_can(array['owner','operator'])) with check (public.admin_can(array['owner','operator']));
create policy notice_tr_admin_read on public.website_notice_translations for select to authenticated using (public.is_admin());
create policy notice_tr_admin_write on public.website_notice_translations for all to authenticated
  using (public.admin_can(array['owner','operator'])) with check (public.admin_can(array['owner','operator']));

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  target text not null,
  detail jsonb,
  at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit_notice_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_audit_log(actor, action, target, detail)
  values ((select auth.uid()), tg_op, tg_table_name || ':' || coalesce(to_jsonb(new)->>'slug', to_jsonb(old)->>'slug', to_jsonb(new)->>'notice_id', to_jsonb(old)->>'notice_id'),
          jsonb_build_object('old', to_jsonb(old) - 'body', 'new', to_jsonb(new) - 'body'));
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_notice_change() from public, anon, authenticated;
create trigger audit_notices after insert or update or delete on public.website_notices for each row execute function public.audit_notice_change();
create trigger audit_notice_tr after insert or update or delete on public.website_notice_translations for each row execute function public.audit_notice_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notice-images', 'notice-images', true, 5242880, array['image/webp','image/png','image/jpeg','image/gif']);
create policy notice_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'notice-images' and public.admin_can(array['owner','operator']))
  with check (bucket_id = 'notice-images' and public.admin_can(array['owner','operator']));
