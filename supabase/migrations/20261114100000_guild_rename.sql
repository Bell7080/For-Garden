-- 길드 이름 변경(v0.385.0 · 2026-10-28 응태 요청). 길드장만, 젬 2,000(`GUILD_RENAME_GEMS`)은 게임 서버가 지갑에서 뺀다.
-- 이름 규칙(문자·숫자·공백 2~12자)은 DB 정규식이 `\p{L}`을 몰라 게임 서버(`SupabaseGuildBackend.renameGuild`)가 먼저 끝내고,
-- 여기서는 권한·중복·멱등만 판정한다. 새 표·열은 없다.
-- 적용 순서: 20261113000000_guild_war_attack.sql 다음 → 서버 → 클라이언트.

-- 길드전 공격 문(20261113000000) 앞에 이름 변경 하나를 받는 문을 한 겹 더 세운다(본문을 다시 적으면 두 벌이 갈린다).
alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_attack;
revoke all on function public.server_guild_call_attack(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_attack(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  args jsonb := coalesce(p_args, '[]'); m public.guild_members; g public.guilds; cached public.guild_receipts;
  v_name text; v_key text; out jsonb;
begin
  if p_method <> 'renameGuild' then
    return public.server_guild_call_attack(p_player, p_method, p_actor, p_args, p_request);
  end if;
  perform public.server_require_active(p_player);
  -- 이름 중복이 같은 트랜잭션에서 판정되도록 길드 변경과 같은 자물쇠로 줄 세운다.
  perform pg_advisory_xact_lock(hashtextextended('forgarden-guild', 19));
  if p_request is null or p_request !~ '^[A-Za-z0-9_.:-]{8,64}$' then raise exception 'request_id_required' using errcode='PT400'; end if;
  select * into cached from public.guild_receipts where player_id = p_player and request_id = p_request;
  if found then
    if cached.method <> p_method then raise exception 'request_id_conflict' using errcode='PT409'; end if;
    return cached.response;
  end if;

  select * into m from public.guild_members where player_id = p_player;
  if not found then perform public.server_guild_fail('NOT_IN_GUILD'); end if;
  -- 이름도 뱃지처럼 길드의 얼굴이라 같은 권한(길드장)을 쓴다.
  if not public.server_guild_can(m.role, 'badge') then perform public.server_guild_fail('NO_PERMISSION'); end if;
  v_name := args -> 0 ->> 'name'; v_key := args -> 0 ->> 'nameKey';
  if v_name is null or v_key is null or char_length(v_name) not between 2 and 48 or v_key = '' then perform public.server_guild_fail('NAME_INVALID'); end if;
  select * into g from public.guilds where id = m.guild_id for update;
  if g.name = v_name then
    out := jsonb_build_object('changed', false);
  else
    if exists(select 1 from public.guilds where name_key = v_key and id <> g.id) then perform public.server_guild_fail('NAME_TAKEN'); end if;
    update public.guilds set name = v_name, name_key = v_key where id = g.id;
    out := jsonb_build_object('changed', true);
  end if;
  insert into public.guild_receipts(player_id, request_id, method, response) values (p_player, p_request, p_method, out);
  return out;
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
