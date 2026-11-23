-- 앱 패키징 보안 점검(2026-11-23) 후속. 새 표는 없다.
--
-- 1) 저장 통째 내려받기를 닫는다. 게임은 이 함수를 부르지 않는다(진행은 /api/game이 가려서 내려 준다).
--    열어 두면 로그인한 계정이 제 저장의 서버 전용 값(전투 씨앗 · 아직 파지 않은 지층 칸)을 그대로 읽는다.
revoke execute on function public.download_my_save() from public, anon, authenticated;

-- 2) 같은 스토어 거래 번호를 다른 계정이 다시 쓰지 못한다.
--    새로 생긴 영수증만 본다 — 이미 저장에 있던 영수증으로 저장이 막히면 그 계정이 통째로 멎는다.
create or replace function private.track_purchase_records()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; tx text; old_receipts jsonb;
begin
  if tg_op = 'UPDATE' and (old.data->'serverJournal'->'receipts') is not distinct from (new.data->'serverJournal'->'receipts') then return new; end if;
  old_receipts := case when tg_op = 'UPDATE' then coalesce(old.data->'serverJournal'->'receipts', '{}'::jsonb) else '{}'::jsonb end;
  for r in select key, value from jsonb_each(coalesce(new.data->'serverJournal'->'receipts', '{}'::jsonb))
           where key like '["platformTransaction",%' loop
    begin
      tx := (r.key::jsonb)->>1;
    exception when others then continue;
    end;
    if tx is null or length(tx) = 0 then continue; end if;
    if not (old_receipts ? r.key) and exists (
      select 1 from public.purchase_records p where p.transaction_id = tx and p.player_id <> new.player_id
    ) then
      raise exception 'PURCHASE_TRANSACTION_REUSED' using errcode = 'P0001';
    end if;
    insert into public.purchase_records(transaction_id, player_id, product_id, granted, first_bonus)
    values (tx, new.player_id, coalesce(r.value->'result'->>'productId', r.value->>'identity', ''),
      coalesce(r.value->'result'->'granted', '[]'::jsonb), coalesce((r.value->'result'->>'firstBonusApplied')::boolean, false))
    on conflict (transaction_id) do nothing;
  end loop;
  return new;
exception when foreign_key_violation then
  return new; -- 계정 행이 아직 없으면(테스트 저장) 기록만 건너뛴다. 저장 자체를 막지 않는다.
end $$;

-- 3) 운영 계정의 2단계 인증. 인증 앱을 등록한 운영 계정은 그 코드를 통과한 세션(aal2)만 운영 권한을 갖는다.
--    아직 등록하지 않은 계정은 예전처럼 지난다 — 등록 전에 잠기지 않게 하려는 것이다.
create or replace function private.admin_mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;
revoke all on function private.admin_mfa_ok() from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles where user_id = (select auth.uid())) and private.admin_mfa_ok();
$$;

create or replace function private.admin_can(roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles where user_id = (select auth.uid()) and role = any(roles)) and private.admin_mfa_ok();
$$;
