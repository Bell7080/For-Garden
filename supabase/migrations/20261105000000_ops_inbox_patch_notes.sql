-- 어드민 패치노트(public.patch_notes)를 게임 수신함에 함께 내려 준다.
-- 게임은 이를 우편함의 「패치노트」 탭(첨부 없는 안내, 삭제 불가)으로 세운다. 읽음은 기존 운영 우편 기록(serverJournal.ops)에 남는다.
-- patch_notes 표는 어드민 마이그레이션(20261026000000_recurring_ops)이 만든다. 표가 아직 없으면 빈 목록을 돌려 게임이 멈추지 않는다.
create or replace function public.server_ops_inbox(p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare created timestamptz; notes jsonb := '[]'::jsonb;
begin
  select created_at into created from public.players where id = p_player;
  if created is null then return jsonb_build_object('mails', '[]'::jsonb, 'adjustments', '[]'::jsonb, 'patchNotes', '[]'::jsonb); end if;
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
    'patchNotes', notes);
end $$;

revoke all on function public.server_ops_inbox(uuid) from public, anon, authenticated;
grant execute on function public.server_ops_inbox(uuid) to service_role;
