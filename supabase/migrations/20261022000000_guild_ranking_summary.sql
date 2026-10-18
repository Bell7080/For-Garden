-- 길드 순위 줄이 레벨만이 아니라 부흥도·총 기여도·길드전·수호전 점수로 서도록 요약에 그 값을 싣는다.
-- 길드전·수호전은 아직 열리지 않아 점수가 없다(null — 화면은 「-」로 세운다). 규칙의 원본은 src/api/FakeGuildServer.ts의 summary다.
create or replace function public.server_guild_summary(p_guild uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id', g.id, 'name', g.name, 'badge', g.badge,
    'level', public.server_guild_level(g.prosperity), 'memberCount', (select count(*) from public.guild_members where guild_id = g.id),
    'capacity', public.server_guild_capacity(public.server_guild_level(g.prosperity)), 'joinMode', g.join_mode,
    'leaderName', coalesce((select name from public.guild_members where guild_id = g.id and role = 'leader'), ''), 'notice', g.notice,
    'prosperity', g.prosperity, 'contributionTotal', coalesce((select sum(contribution_total) from public.guild_members where guild_id = g.id), 0),
    'warScore', null, 'guardScore', null)
  from public.guilds g where g.id = p_guild;
$$;
revoke all on function public.server_guild_summary(uuid) from public, anon, authenticated;
