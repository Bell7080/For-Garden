-- 길드장 자동 위임(v0.377.0). 길드장이 14일(GUILD_LEADER_TRANSFER_DAYS) 접속하지 않으면, 그 길드의 누군가가 길드를 부르는
-- 순간 기여도 1위 임원 이상(부길드장 포함)이 길드장이 되고 예전 길드장은 길드원이 된다. 후계가 없으면 그대로 둔다.
-- 규칙의 원본은 src/core/guild.ts의 guildSuccessor이고 FakeGuildServer가 같은 순서로 판정한다.
-- 앞의 상점 마이그레이션(20261110000000_guild_shop_tabs.sql) 다음에 적용한다 — 그 문을 server_guild_call_shop으로 이름 바꾸고 앞에 선다.

create or replace function public.server_guild_review_leader(p_player uuid, p_t timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare g uuid; leader public.guild_members; heir uuid;
begin
  select guild_id into g from public.guild_members where player_id = p_player;
  if g is null then return; end if;
  -- 같은 길드의 두 호출이 동시에 위임하지 않게 길드 행을 잠근다.
  perform 1 from public.guilds where id = g for update;
  select * into leader from public.guild_members where guild_id = g and role = 'leader';
  if leader.player_id is null or leader.player_id = p_player or leader.last_active_at > p_t - interval '14 days' then return; end if;
  select player_id into heir from public.guild_members
    where guild_id = g and role in ('vice','officer')
    order by contribution_total desc, case role when 'vice' then 2 else 1 end desc, joined_at asc, player_id::text asc
    limit 1;
  if heir is null then return; end if;
  -- 길드장은 한 명뿐이라(guild_members_one_leader) 내리는 쪽이 먼저다.
  update public.guild_members set role = 'member' where player_id = leader.player_id;
  update public.guild_members set role = 'leader' where player_id = heir;
end $$;

alter function public.server_guild_call(uuid, text, jsonb, jsonb, text) rename to server_guild_call_shop;
revoke all on function public.server_guild_call_shop(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call_shop(uuid,text,jsonb,jsonb,text) to service_role;

create or replace function public.server_guild_call(p_player uuid, p_method text, p_actor jsonb, p_args jsonb, p_request text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.server_guild_review_leader(p_player, now());
  return public.server_guild_call_shop(p_player, p_method, p_actor, p_args, p_request);
end $$;

revoke all on function public.server_guild_call(uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.server_guild_call(uuid,text,jsonb,jsonb,text) to service_role;
revoke all on function public.server_guild_review_leader(uuid, timestamptz) from public, anon, authenticated;
