-- 운영 콘솔 v3의 게임 쪽 바탕: 금칙어 · 프로필 강제 초기화 · 공지 팝업 배너 · 랭킹 부정 기록 제외 · 결제 기록.
-- 어드민 RPC는 For-Garden-Admin의 20261120100000_ops_console_v3.sql이 만든다(이 파일을 먼저 적용한다).
-- 게임은 표를 직접 읽지 않고 server_* 함수(서비스 롤 전용)만 부른다.

-- 1) 금칙어 — 닉네임에 들어가면 서버가 거절한다(공백·대소문자 무시, 부분 일치).
create table if not exists public.banned_words (
  word text primary key check (length(word) between 1 and 40 and word = lower(word)),
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.banned_words enable row level security;
revoke all on public.banned_words from public, anon, authenticated;

create or replace function public.server_banned_words()
returns text[] language sql security definer set search_path = '' stable as $$
  select coalesce(array_agg(word order by word), '{}'::text[]) from public.banned_words
$$;
revoke all on function public.server_banned_words() from public, anon, authenticated;
grant execute on function public.server_banned_words() to service_role;

-- 2) 프로필 강제 초기화 — 운영자가 걸어 두면 다음 서버 호출에서 저장의 닉네임/소개를 비우고 한 번 알린다.
create table if not exists public.player_profile_actions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('nickname_reset', 'bio_reset')),
  reason text not null default '' check (length(reason) <= 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists player_profile_actions_pending on public.player_profile_actions (player_id) where applied_at is null;
alter table public.player_profile_actions enable row level security;
revoke all on public.player_profile_actions from public, anon, authenticated;

-- 3) 공지 팝업 배너 — 기간 안에 접속한 플레이어에게 한 번 띄운다(본 기록은 저장의 serverJournal.ops.seenBanners).
create table if not exists public.ops_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 60),
  body text not null check (length(body) <= 600),
  translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);
create index if not exists ops_banners_live on public.ops_banners (starts_at, ends_at) where deleted_at is null;
alter table public.ops_banners enable row level security;
revoke all on public.ops_banners from public, anon, authenticated;

-- 4) 랭킹 부정 기록 제외 — 이 표에 오른 (보드, 기간, 플레이어)는 점수가 다시 들어오지 않는다.
create table if not exists public.server_competitive_bans (
  board text not null,
  period date not null,
  player_id uuid not null references public.players(id) on delete cascade,
  reason text not null default '' check (length(reason) <= 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (board, period, player_id)
);
alter table public.server_competitive_bans enable row level security;
revoke all on public.server_competitive_bans from public, anon, authenticated;

create or replace function private.skip_banned_competitive_score()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.server_competitive_bans b where b.board = new.board and b.period = new.period and b.player_id = new.player_id) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists skip_banned_competitive_score on public.server_competitive_scores;
create trigger skip_banned_competitive_score before insert or update on public.server_competitive_scores
  for each row execute function private.skip_banned_competitive_score();

-- 5) 결제 기록 — 저장의 플랫폼 거래 영수증(serverJournal.receipts의 ["platformTransaction", <거래 ID>])을 표로 옮긴다.
--    게임 코드는 바뀌지 않는다. 환불 표시·회수는 어드민이 한다.
create table if not exists public.purchase_records (
  transaction_id text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  product_id text not null,
  granted jsonb not null default '[]'::jsonb,
  first_bonus boolean not null default false,
  recorded_at timestamptz not null default now(),
  refunded_at timestamptz,
  refund_reason text check (refund_reason is null or length(refund_reason) <= 200),
  refunded_by uuid,
  clawback jsonb
);
create index if not exists purchase_records_player on public.purchase_records (player_id, recorded_at desc);
create index if not exists purchase_records_recent on public.purchase_records (recorded_at desc);
alter table public.purchase_records enable row level security;
revoke all on public.purchase_records from public, anon, authenticated;

create or replace function private.track_purchase_records()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; tx text;
begin
  if tg_op = 'UPDATE' and (old.data->'serverJournal'->'receipts') is not distinct from (new.data->'serverJournal'->'receipts') then return new; end if;
  for r in select key, value from jsonb_each(coalesce(new.data->'serverJournal'->'receipts', '{}'::jsonb))
           where key like '["platformTransaction",%' loop
    begin
      tx := (r.key::jsonb)->>1;
    exception when others then continue;
    end;
    if tx is null or length(tx) = 0 then continue; end if;
    insert into public.purchase_records(transaction_id, player_id, product_id, granted, first_bonus)
    values (tx, new.player_id, coalesce(r.value->'result'->>'productId', r.value->>'identity', ''),
      coalesce(r.value->'result'->'granted', '[]'::jsonb), coalesce((r.value->'result'->>'firstBonusApplied')::boolean, false))
    on conflict (transaction_id) do nothing;
  end loop;
  return new;
exception when foreign_key_violation then
  return new; -- 계정 행이 아직 없으면(테스트 저장) 기록만 건너뛴다. 저장 자체를 막지 않는다.
end $$;
drop trigger if exists track_purchase_records on public.player_saves;
create trigger track_purchase_records after insert or update of data on public.player_saves
  for each row execute function private.track_purchase_records();

-- 지금까지의 저장에 이미 남은 영수증도 한 번 옮긴다.
insert into public.purchase_records(transaction_id, player_id, product_id, granted, first_bonus)
select (e.key::jsonb)->>1, s.player_id, coalesce(e.value->'result'->>'productId', e.value->>'identity', ''),
  coalesce(e.value->'result'->'granted', '[]'::jsonb), coalesce((e.value->'result'->>'firstBonusApplied')::boolean, false)
from public.player_saves s
join public.players p on p.id = s.player_id
cross join lateral jsonb_each(coalesce(s.data->'serverJournal'->'receipts', '{}'::jsonb)) e
where e.key like '["platformTransaction",%'
on conflict (transaction_id) do nothing;

-- 6) 게임 수신함에 프로필 초기화·배너를 함께 내려 준다(우편·조정·패치노트는 그대로).
create or replace function public.server_ops_inbox(p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare created timestamptz; notes jsonb := '[]'::jsonb;
begin
  select created_at into created from public.players where id = p_player;
  if created is null then
    return jsonb_build_object('mails', '[]'::jsonb, 'adjustments', '[]'::jsonb, 'patchNotes', '[]'::jsonb, 'profileActions', '[]'::jsonb, 'banners', '[]'::jsonb);
  end if;
  if to_regclass('public.patch_notes') is not null then
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'version', n.version, 'title', n.title, 'releasedAt', n.released_at,
        'items', n.items, 'note', n.note) order by n.released_at desc), '[]'::jsonb)
      from (select * from public.patch_notes where deleted_at is null and released_at <= now() order by released_at desc limit 20) n$q$ into notes;
  end if;
  return jsonb_build_object(
    'mails', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'rewards', m.rewards,
        'sentAt', m.starts_at, 'expiresAt', m.expires_at) order by m.starts_at desc)
      from (select mm.* from public.mails mm
            where private.mail_visible_to(mm, p_player, created)
            order by mm.starts_at desc limit 50) m), '[]'::jsonb),
    'adjustments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'asset', a.asset, 'delta', a.delta, 'note', a.note, 'createdAt', a.created_at) order by a.created_at)
      from (select * from public.player_adjustments where player_id = p_player and applied_at is null order by created_at limit 50) a), '[]'::jsonb),
    'patchNotes', notes,
    'profileActions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'reason', a.reason, 'createdAt', a.created_at) order by a.created_at)
      from (select * from public.player_profile_actions where player_id = p_player and applied_at is null order by created_at limit 10) a), '[]'::jsonb),
    'banners', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'body', b.body, 'translations', b.translations,
        'startsAt', b.starts_at, 'endsAt', b.ends_at) order by b.starts_at)
      from (select * from public.ops_banners where deleted_at is null and starts_at <= now() and ends_at > now() order by starts_at limit 5) b), '[]'::jsonb));
end $$;
revoke all on function public.server_ops_inbox(uuid) from public, anon, authenticated;
grant execute on function public.server_ops_inbox(uuid) to service_role;

create or replace function public.server_profile_actions_ack(p_player uuid, p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.player_profile_actions set applied_at = now()
  where player_id = p_player and applied_at is null and id = any(coalesce(p_ids, '{}'::uuid[]))
$$;
revoke all on function public.server_profile_actions_ack(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.server_profile_actions_ack(uuid, uuid[]) to service_role;
