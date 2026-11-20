-- 게임 안 피드백(응원 메시지 포함). 문의 표(support_tickets)에 종류 「feedback」으로 쌓아 운영 콘솔 문의 목록이 그대로 읽는다.
-- 첫 피드백 한 번만 젬 500을 그 계정의 대상 우편으로 보낸다(응태 요청 2026-11-20). 지갑을 직접 고치지 않는다 —
-- 게임은 player_assets를 읽지 않고 우편을 받을 때 서버 경계가 지급한다(쿠폰과 같은 길).

alter table public.support_tickets drop constraint if exists support_tickets_category_check;
alter table public.support_tickets add constraint support_tickets_category_check
  check (category in ('inquiry','bug','report','privacy','feedback','other'));

-- 첫 피드백 보상을 받은 계정. 계정당 한 줄이라 두 번 지급되지 않는다.
create table if not exists public.feedback_rewards (
  player_id uuid primary key,
  ticket_id uuid not null references public.support_tickets(id),
  mail_id uuid,
  rewarded_at timestamptz not null default now()
);
alter table public.feedback_rewards enable row level security;
-- 정책·권한 없음(함수 전용).

create or replace function public.submit_feedback(p_body text, p_version text default null, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare me uuid := (select auth.uid()); p public.players; tid uuid; tno bigint; mid uuid; body text := trim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.players where id = me for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;
  if char_length(body) not between 1 and 2000 then return jsonb_build_object('ok', false, 'error', 'invalid_text'); end if;
  if private.support_limited('feedback:' || me, 5) then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.support_tickets(source, category, subject, body, player_id, app_version, platform)
  values ('game', 'feedback', left('피드백 · ' || regexp_replace(body, '\s+', ' ', 'g'), 100), body, me, left(p_version, 32), left(p_platform, 16))
  returning id, ticket_no into tid, tno;
  if exists (select 1 from public.feedback_rewards where player_id = me) then
    return jsonb_build_object('ok', true, 'ticket_no', tno, 'rewarded', false);
  end if;
  insert into public.mails(title, body, rewards, target_player, expires_at)
  values ('피드백 감사 보상', '소중한 피드백 고마워요! 보내 주신 이야기는 개발자가 한 줄도 빼놓지 않고 읽어요.',
    jsonb_build_array(jsonb_build_object('asset', 'gems', 'amount', 500)), me, now() + interval '30 days')
  returning id into mid;
  insert into public.feedback_rewards(player_id, ticket_id, mail_id) values (me, tid, mid);
  return jsonb_build_object('ok', true, 'ticket_no', tno, 'rewarded', true);
end $fn$;

-- 첫 피드백 보상을 이미 받았는가. 창이 보상 줄을 세울지 고르는 데만 쓴다(지급 판정은 submit_feedback이 한다).
create or replace function public.my_feedback_status()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('rewarded', exists (select 1 from public.feedback_rewards where player_id = (select auth.uid())));
$fn$;

revoke all on function public.submit_feedback(text, text, text), public.my_feedback_status() from public, anon;
grant execute on function public.submit_feedback(text, text, text), public.my_feedback_status() to authenticated;
