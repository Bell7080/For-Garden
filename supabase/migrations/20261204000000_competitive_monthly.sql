-- 결투장·아레나 월간 시즌과 콘텐츠 보상 특수 우편(2026-11-28 응태 요청).
--
-- 무엇이 바뀌나
--   * 결투장: 티어 보상은 매주 우편(그 주 마지막 점수의 티어), 순위 보상은 매달 우편(달 마감 점수 순위). 시즌은 달력의 달.
--   * 아레나: 같은 구조. RP는 달이 바뀌면 시작값 위의 몫을 절반 남겨 다시 선다(src/core/arenaStanding.ts arenaSeasonResetScore).
--   * 모든 콘텐츠 보상 우편에 종류(mails.kind)와 표식(mails.meta: tier·rank·period)이 붙어 우편함이 특수 우편으로 세운다.
--   * 결투 상대 조회(server_duel_context)는 월간 시즌 ID(YYYY-MM)를 받으면 옛 21일 시즌(S#) 점수를 초기화 없이 이번 달로 읽는다.
--
-- 게임 서버는 COMPETITIVE_MONTHLY_ENABLED(src/core/competitiveSeason.ts)가 켜졌을 때만 새 함수들을 부른다 — 이 파일을 먼저
-- 적용해도 꺼져 있는 동안 동작은 그대로다(새 열·새 판 기록만 쌓인다). 표(p_rules)는 게임 서버가 TS 표를 그대로 넘긴다.
-- p_rules.since(YYYY-MM-DD) 앞의 주·달은 새 함수가 정산하지 않는다 — 켜기 전 기간을 예전 규칙과 겹쳐 주지 않는다.

alter table public.mails add column if not exists kind text, add column if not exists meta jsonb;

alter table public.server_competitive_scores drop constraint if exists server_competitive_scores_board_check;
alter table public.server_competitive_scores add constraint server_competitive_scores_board_check
  check(board in('duel','expedition','arena','ancient','duel_month','arena_month'));

alter table public.arena_ratings add column if not exists season text;

-- 우편함이 종류·표식을 함께 읽는다.
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
        'sentAt', m.starts_at, 'expiresAt', m.expires_at, 'kind', m.kind, 'meta', m.meta) order by m.starts_at desc)
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

-- 결투 점수를 주간 판(티어)과 월간 판(순위)에 함께 적는다. 원정은 그대로 주간이다.
create or replace function public.server_track_competitive() returns trigger language plpgsql security definer set search_path='' as $$
declare week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
 score bigint; stamp timestamptz; played boolean; played_month boolean;
begin
 if coalesce((new.data->'playerResearch'->>'level')::int,1)>=6 then
   score:=coalesce((new.data->'duel'->>'score')::bigint,0);
   played:=exists(select 1 from jsonb_array_elements(coalesce(new.data->'duel'->'history','[]')) e where (e->>'at')::timestamptz>=week::timestamptz);
   played_month:=exists(select 1 from jsonb_array_elements(coalesce(new.data->'duel'->'history','[]')) e where (e->>'at')::timestamptz>=month::timestamptz);
   insert into public.server_competitive_scores values('duel',week,new.player_id,score,now(),played)
    on conflict(board,period,player_id) do update set score=excluded.score,played=server_competitive_scores.played or excluded.played,
    achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
   insert into public.server_competitive_scores values('duel_month',month,new.player_id,score,now(),played_month)
    on conflict(board,period,player_id) do update set score=excluded.score,played=server_competitive_scores.played or excluded.played,
    achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
 end if;
 if coalesce(new.data->'expedition'->>'weekKey','')<>'' then
   score:=coalesce((new.data->'expedition'->>'bestScore')::bigint,0);
   stamp:=coalesce(nullif(new.data->'expedition'->>'bestAchievedAt','')::timestamptz,now());
   if score>0 and (new.data->'expedition'->>'weekKey')::date=week then
     insert into public.server_competitive_scores values('expedition',week,new.player_id,score,stamp,true)
      on conflict(board,period,player_id) do update set score=excluded.score,achieved_at=excluded.achieved_at where excluded.score>server_competitive_scores.score;
   end if;
 end if;
 return new;
end $$;

-- 아레나 랭크전 결과를 주간 판(티어)과 월간 판(순위)에 함께 적는다.
create or replace function public.server_arena_track_week(p_player uuid) returns void language plpgsql security definer set search_path='' as $$
declare week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date; s integer;
begin
 select score into s from public.arena_ratings where player_id=p_player;
 insert into public.server_competitive_scores values('arena',week,p_player,greatest(0,coalesce(s,1000)),now(),true)
  on conflict(board,period,player_id) do update set score=excluded.score,played=true,
  achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
 insert into public.server_competitive_scores values('arena_month',month,p_player,greatest(0,coalesce(s,1000)),now(),true)
  on conflict(board,period,player_id) do update set score=excluded.score,played=true,
  achieved_at=case when server_competitive_scores.score<>excluded.score then excluded.achieved_at else server_competitive_scores.achieved_at end;
end $$;

-- 아레나 달 넘김: 시작값(1000) 위의 몫을 절반 남겨 50 단위로 내린다. 시즌이 비어 있던 계정(켜기 전)은 초기화 없이 이번 달을 적는다.
create function public.server_arena_season_reset(p_score integer) returns integer language sql immutable set search_path='' as $$
 select 1000+floor(greatest(0,p_score-1000)*0.5/50)::integer*50;
$$;
create function public.server_arena_roll_season(p_player uuid) returns void language plpgsql security definer set search_path='' as $$
declare month text:=to_char(now() at time zone 'UTC','YYYY-MM');
begin
 update public.arena_ratings set
   score=case when season is null then score else public.server_arena_season_reset(score) end,
   win_streak=case when season is null then win_streak else 0 end,
   season=month
 where player_id=p_player and season is distinct from month;
end $$;

create function public.server_arena_commit_v2(p_player uuid,p_room uuid,p_version integer,p_data jsonb,p_request text,p_fingerprint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ra uuid; rb uuid;
begin
 perform public.server_require_active(p_player);
 select a,b into ra,rb from public.arena_rooms where id=p_room and p_player in(a,b);
 if ra is not null then perform public.server_arena_roll_season(ra); end if;
 if rb is not null then perform public.server_arena_roll_season(rb); end if;
 return public.server_arena_commit(p_player,p_room,p_version,p_data,p_request,p_fingerprint);
end $$;

-- 월간 자리 — 모양은 예전 standing과 같다(weekEndsAt은 달 마감, lastWeek는 지난달). 읽기 전에 달을 넘긴다.
create function public.server_arena_standing_v2(p_player uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare out jsonb; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
begin
 perform public.server_arena_roll_season(p_player);
 with me as(select coalesce(r.score,1000) score,coalesce(r.wins,0) wins,coalesce(r.losses,0) losses,coalesce(r.win_streak,0) streak,
   coalesce(r.best_streak,0) best_streak,coalesce(r.best_score,1000) best_score from (select 1) one left join public.arena_ratings r on r.player_id=p_player),
 ranked as(select c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id) rank
   from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
   where c.board='arena_month' and c.period=month and c.played),
 last as(select c.score,x.rank from public.server_competitive_scores c left join public.server_competitive_results x
   on x.board=c.board and x.period=c.period and x.player_id=c.player_id
   where c.board='arena_month' and c.period=(month-interval '1 month')::date and c.player_id=p_player and c.played)
 select jsonb_build_object('score',me.score,'wins',me.wins,'losses',me.losses,'winStreak',me.streak,'bestStreak',me.best_streak,'bestScore',me.best_score,
   'nextStreakBonus',public.server_arena_streak_bonus(me.streak+1),
   'rank',(select rank from ranked where player_id=p_player),
   'weekEndsAt',to_char((month+interval '1 month')::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'serverTime',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'lastWeek',(select jsonb_build_object('score',score,'rank',rank) from last))
 into out from me;
 return out;
end $$;

create function public.server_arena_ranking_v2(p_player uuid,p_limit integer) returns jsonb
language sql security definer set search_path='' stable as $$
 with ranked as(select c.*,row_number() over(order by score desc,achieved_at,player_id) rank
 from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
 where board='arena_month' and period=(date_trunc('month',now() at time zone 'UTC'))::date and played)
 select jsonb_build_object('rank',(select rank from ranked where player_id=p_player),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'playerId',r.player_id,'displayName',coalesce(nullif(p.nickname,''),'Researcher'),'score',score,'isMe',r.player_id=p_player,'favoriteRelicId',coalesce(s.data->>'favorite','torika')) order by rank)
 from ranked r join public.players p on p.id=r.player_id join public.player_saves s on s.player_id=r.player_id where rank<=greatest(0,least(p_limit,100))),'[]'));
$$;

-- 표준 보상 풀에서 그 자리의 묶음 — src/data/competitiveRewards.ts rankRewardBundle과 같은 규칙.
create function private.rank_pool_bundle(p_pool jsonb,p_rank bigint,p_total bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare bundle jsonb;
begin
 select e->'rewards' into bundle from jsonb_array_elements(p_pool->'ranks') e where (e->>'upTo')::bigint>=p_rank order by (e->>'upTo')::bigint limit 1;
 if bundle is null then
   select e->'rewards' into bundle from jsonb_array_elements(p_pool->'percents') e
    where (e->>'upToPercent')::numeric>=p_rank*100.0/greatest(1,p_total) order by (e->>'upToPercent')::numeric limit 1;
 end if;
 return coalesce(bundle,p_pool->'participation');
end $$;

-- 묶음 → 우편 첨부. 지갑 키 그대로이고 0과 모르는 키는 버린다.
create function private.rank_bundle_attachments(p_bundle jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('asset',k,'amount',v::int)
   order by case k when 'gems' then 0 when 'duelEmblem' then 1 when 'salvageRecord' then 2 when 'gold' then 3 else 4 end),'[]'::jsonb)
 from jsonb_each_text(coalesce(p_bundle,'{}'::jsonb)) as b(k,v)
 where k in('gems','duelEmblem','salvageRecord','gold','cheesecake') and v ~ '^[0-9]+$' and v::int>0;
$$;

-- 닫힌 기간의 순위를 한 번 확정한다(첫 정산이 전체를 굳힌다 — 이후 정지·접속 순서로 남의 순위가 바뀌지 않는다).
create function private.settle_competitive_period(p_board text,p_period date) returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_board||p_period::text,27));
 if not exists(select 1 from public.server_competitive_results where board=p_board and period=p_period) then
   insert into public.server_competitive_results
     select c.board,c.period,c.player_id,row_number() over(order by c.score desc,c.achieved_at,c.player_id)
     from public.server_competitive_scores c join public.players p on p.id=c.player_id and p.status='active'
     where c.board=p_board and c.period=p_period and c.played;
 end if;
end $$;

-- 결투장 주간 티어 · 결투장 월간 순위 · 원정 주간 순위.
-- p_rules = { since, duelTiers:[{tier,floor,duelEmblem,gems}], duelMonth: 풀, expedition: 풀 }
create function public.server_competitive_rewards_v3(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; tier jsonb; bundle jsonb; attachments jsonb; total integer; mid uuid; amount integer;
 week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
 since date:=coalesce(nullif(p_rules->>'since','')::date,'2000-01-01'::date);
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 if jsonb_typeof(p_rules->'duelTiers')<>'array' or jsonb_array_length(p_rules->'duelTiers')=0 then raise exception 'invalid_rank_rewards'; end if;

 -- 결투장 주간 티어: 그 주 마지막 점수의 티어. 순위가 아니라 점수라 정산 확정이 필요 없다.
 for row in select c.period,c.score from public.server_competitive_scores c
   where c.board='duel' and c.player_id=p_player and c.played and c.period<week and c.period>=since
   and not exists(select 1 from public.server_competitive_awards a where a.board='duel_tier' and a.period=c.period and a.player_id=p_player)
 loop
   select e into tier from jsonb_array_elements(p_rules->'duelTiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
   if tier is null then raise exception 'invalid_rank_rewards'; end if;
   attachments:=private.rank_bundle_attachments(tier-'tier'-'floor');
   amount:=coalesce((tier->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>5000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('결투장 주간 티어 보상',
     row.period::text||' 주간 · '||row.score::text||'점',attachments,p_player,'duelTier',
     jsonb_build_object('tier',tier->>'tier','period',row.period::text,'score',row.score)) returning id into mid;
   insert into public.server_competitive_awards values('duel_tier',row.period,p_player,mid,0,amount);
 end loop;

 -- 결투장 월간 순위.
 for row in select distinct period from public.server_competitive_scores
   where board='duel_month' and player_id=p_player and played and period<month and period>=date_trunc('month',since)::date loop
   perform private.settle_competitive_period('duel_month',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='duel_month' and x.player_id=p_player
   and x.period>=date_trunc('month',since)::date
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='duel_month' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'duelMonth',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>20000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('결투장 월간 순위 보상',
     to_char(row.period,'YYYY-MM')||' 월간 · '||row.rank::text||'위',attachments,p_player,'duelRank',
     jsonb_build_object('rank',row.rank,'period',to_char(row.period,'YYYY-MM'))) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;

 -- 원정 주간 순위(예전과 같은 주기, 새 표).
 for row in select distinct period from public.server_competitive_scores
   where board='expedition' and player_id=p_player and played and period<week and period>=since loop
   perform private.settle_competitive_period('expedition',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='expedition' and x.player_id=p_player and x.period>=since
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='expedition' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'expedition',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if amount<=0 or amount>5000 then raise exception 'invalid_rank_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('원정 주간 순위 보상',
     row.period::text||' 주간 · '||row.rank::text||'위',attachments,p_player,'expeditionRank',
     jsonb_build_object('rank',row.rank,'period',row.period::text)) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;

-- 아레나 주간 티어 · 아레나 월간 순위. p_rules = { since, tiers:[{tier,floor,duelEmblem,gems}], month: 풀 }
create function public.server_arena_rewards_v2(p_player uuid,p_rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row record; tier jsonb; bundle jsonb; attachments jsonb; total integer; mid uuid; amount integer;
 week date:=(date_trunc('week',now() at time zone 'UTC'))::date; month date:=(date_trunc('month',now() at time zone 'UTC'))::date;
 since date:=coalesce(nullif(p_rules->>'since','')::date,'2000-01-01'::date);
begin
 perform public.server_require_active(p_player);
 perform pg_advisory_xact_lock(hashtextextended(p_player::text,7));
 if jsonb_typeof(p_rules->'tiers')<>'array' or jsonb_array_length(p_rules->'tiers')=0 then raise exception 'invalid_arena_rewards'; end if;

 for row in select c.period,c.score from public.server_competitive_scores c
   where c.board='arena' and c.player_id=p_player and c.played and c.period<week and c.period>=since
   and not exists(select 1 from public.server_competitive_awards a where a.board in('arena','arena_tier') and a.period=c.period and a.player_id=p_player)
 loop
   select e into tier from jsonb_array_elements(p_rules->'tiers') e where (e->>'floor')::bigint<=row.score order by (e->>'floor')::bigint desc limit 1;
   if tier is null then raise exception 'invalid_arena_rewards'; end if;
   attachments:=private.rank_bundle_attachments(tier-'tier'-'floor'); amount:=coalesce((tier->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>5000 then raise exception 'invalid_arena_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('아레나 주간 티어 보상',
     row.period::text||' 주간 · '||row.score::text||' RP',attachments,p_player,'arenaTier',
     jsonb_build_object('tier',tier->>'tier','period',row.period::text,'score',row.score)) returning id into mid;
   insert into public.server_competitive_awards values('arena_tier',row.period,p_player,mid,0,amount);
 end loop;

 for row in select distinct period from public.server_competitive_scores
   where board='arena_month' and player_id=p_player and played and period<month and period>=date_trunc('month',since)::date loop
   perform private.settle_competitive_period('arena_month',row.period);
 end loop;
 for row in select x.* from public.server_competitive_results x where x.board='arena_month' and x.player_id=p_player
   and x.period>=date_trunc('month',since)::date
   and not exists(select 1 from public.server_competitive_awards a where a.board=x.board and a.period=x.period and a.player_id=p_player)
 loop
   select count(*) into total from public.server_competitive_results where board='arena_month' and period=row.period;
   bundle:=private.rank_pool_bundle(p_rules->'month',row.rank,total);
   attachments:=private.rank_bundle_attachments(bundle); amount:=coalesce((bundle->>'gems')::int,0);
   if jsonb_array_length(attachments)=0 or amount>20000 then raise exception 'invalid_arena_rewards'; end if;
   insert into public.mails(title,body,rewards,target_player,kind,meta) values('아레나 월간 순위 보상',
     to_char(row.period,'YYYY-MM')||' 월간 · '||row.rank::text||'위',attachments,p_player,'arenaRank',
     jsonb_build_object('rank',row.rank,'period',to_char(row.period,'YYYY-MM'))) returning id into mid;
   insert into public.server_competitive_awards values(row.board,row.period,p_player,mid,row.rank,amount);
 end loop;
end $$;

-- 결투 상대 조회: 월간 시즌 ID(YYYY-MM)를 받으면 옛 21일 시즌(S#)은 이번 달로 이어진다(클라이언트 rollDuelPeriods와 같다).
create or replace function public.server_duel_context(p_player uuid, p_season text, p_level integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare out jsonb; monthly boolean:=p_season ~ '^[0-9]{4}-[0-9]{2}$';
begin
 perform public.server_require_active(p_player);
 with eligible as materialized (
   select s.player_id, s.revision, s.data,
     case when coalesce(s.data->'duel'->>'seasonId','') in ('',p_season)
            or (monthly and coalesce(s.data->'duel'->>'seasonId','') ~ '^S[0-9]+$') then coalesce((s.data->'duel'->>'score')::bigint,0)
       else floor(coalesce((s.data->'duel'->>'score')::bigint,0)*0.6/100)*100 end as score
   from public.player_saves s join public.players p on p.id=s.player_id and p.status='active'
   where coalesce((s.data->'playerResearch'->>'level')::int,1)>=p_level and jsonb_array_length(coalesce(s.data->'ownedRelicIds','[]'))>=3
 ), mine as (select * from eligible where player_id=p_player),
 wanted as (
   select value #>> '{}' as id from mine,jsonb_array_elements(coalesce(data->'duel'->'candidateIds','[]'))
   union select value->>'target' from mine,jsonb_each(coalesce(data->'serverJournal'->'combat'->'tickets','{}')) where value->>'kind'='duel'
 ), pool as (
   select e.* from eligible e where e.player_id<>p_player
   order by case when e.player_id::text in(select id from wanted) then 0 else 1 end,
     abs(e.score-coalesce((select score from mine),0)), random() limit 60
 ), ranked as (select *,row_number() over(order by score desc,player_id) as rank from eligible)
 select jsonb_build_object('playerId',p_player,
   'rank',coalesce((select rank from ranked where player_id=p_player),1),
   'ranking',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'displayName',coalesce(nullif(data->'playerCard'->>'nickname',''),'Researcher'),'score',score,'favoriteRelicId',coalesce(data->>'favorite','torika'),'frameId',data->'playerCard'->>'frameId','avatarRelicId',case when coalesce(data->'ownedRelicIds','[]'::jsonb) ? (data->'playerCard'->>'avatarRelicId') then data->'playerCard'->>'avatarRelicId' end) order by rank) from ranked where rank<=100),'[]'),
   'records',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'revision',revision::text,'data',jsonb_build_object(
       'ownedRelicIds',data->'ownedRelicIds','relicProgress',data->'relicProgress','runeInventory',data->'runeInventory',
       'duel',data->'duel','favorite',data->'favorite','playerCard',data->'playerCard'))) from pool),'[]')) into out;
 return out;
end $$;

-- 이번 달 판을 지금 값으로 채워 둔다 — 켜는 날 다음 플레이를 기다리지 않고 순위에 선다.
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'duel_month',(date_trunc('month',now() at time zone 'UTC'))::date,s.player_id,coalesce((data->'duel'->>'score')::bigint,0),s.updated_at,
 exists(select 1 from jsonb_array_elements(coalesce(data->'duel'->'history','[]')) e where (e->>'at')::timestamptz>=date_trunc('month',now() at time zone 'UTC'))
 from public.player_saves s where coalesce((data->'playerResearch'->>'level')::int,1)>=6 on conflict do nothing;
insert into public.server_competitive_scores(board,period,player_id,score,achieved_at,played)
 select 'arena_month',(date_trunc('month',now() at time zone 'UTC'))::date,c.player_id,c.score,c.achieved_at,true
 from public.server_competitive_scores c where c.board='arena' and c.played
 and c.period>=(date_trunc('month',now() at time zone 'UTC'))::date - 6
 and c.period=(select max(period) from public.server_competitive_scores m where m.board='arena' and m.player_id=c.player_id)
 on conflict do nothing;

revoke all on function public.server_arena_season_reset(integer),public.server_arena_roll_season(uuid),
  public.server_arena_commit_v2(uuid,uuid,integer,jsonb,text,jsonb),public.server_arena_standing_v2(uuid),public.server_arena_ranking_v2(uuid,integer),
  private.rank_pool_bundle(jsonb,bigint,bigint),private.rank_bundle_attachments(jsonb),private.settle_competitive_period(text,date),
  public.server_competitive_rewards_v3(uuid,jsonb),public.server_arena_rewards_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_arena_commit_v2(uuid,uuid,integer,jsonb,text,jsonb),public.server_arena_standing_v2(uuid),
  public.server_arena_ranking_v2(uuid,integer),public.server_competitive_rewards_v3(uuid,jsonb),public.server_arena_rewards_v2(uuid,jsonb) to service_role;
