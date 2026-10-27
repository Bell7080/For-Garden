-- 실제 PvP: 게스트/0점 포함, 해금된 활성 계정의 서버 저장을 사용한다.
-- 제공자/이메일/양수 점수 조건 없음. 저장된 기본 방어덱도 수동 등록 없이 참가한다.
create index if not exists player_saves_duel_level on public.player_saves (((data->'playerResearch'->>'level')::int));

create function public.server_duel_context(p_player uuid, p_season text, p_level integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare out jsonb;
begin
 perform public.server_require_active(p_player);
 with eligible as materialized (
   select s.player_id, s.revision, s.data,
     case when coalesce(s.data->'duel'->>'seasonId','') in ('',p_season) then coalesce((s.data->'duel'->>'score')::bigint,0)
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
   'ranking',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'displayName',coalesce(nullif(data->'playerCard'->>'nickname',''),'Researcher'),'score',score,'favoriteRelicId',coalesce(data->>'favorite','torika')) order by rank) from ranked where rank<=100),'[]'),
   'records',coalesce((select jsonb_agg(jsonb_build_object('id',player_id,'revision',revision::text,'data',jsonb_build_object(
       'ownedRelicIds',data->'ownedRelicIds','relicProgress',data->'relicProgress','runeInventory',data->'runeInventory',
       'duel',data->'duel','favorite',data->'favorite','playerCard',data->'playerCard'))) from pool),'[]')) into out;
 return out;
end $$;

-- 기존 상태/운영도구/레이드 커밋을 보존하며 양쪽 계정의 revision을 한 트랜잭션에서 확인한다.
alter function public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) rename to server_commit_state_before_duels;
create function public.server_commit_state(p_player uuid,p_expected_revision bigint,p_data jsonb,p_hash text,p_version integer,p_summary jsonb,p_method text,p_request text,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare change jsonb; other uuid; locked uuid; saved public.player_saves; next_data jsonb; result jsonb;
begin
 perform public.server_require_active(p_player);
 for locked in select id from (select p_player id union select (value->>'playerId')::uuid from jsonb_array_elements(coalesce(p_summary->'_duels','[]'))) x order by id loop
   perform pg_advisory_xact_lock(hashtextextended(locked::text,7));
 end loop;
 for change in select value from jsonb_array_elements(coalesce(p_summary->'_duels','[]')) loop
   other:=(change->>'playerId')::uuid;
   if other=p_player or p_method<>'resolveDuel' then raise exception 'invalid_duel_change' using errcode='PT422'; end if;
   perform public.server_require_active(other);
   select * into saved from public.player_saves where player_id=other for update;
   if not found or saved.revision::text is distinct from change->>'expectedRevision' then raise exception 'duel_conflict' using errcode='PT409'; end if;
   next_data:=jsonb_set(saved.data,'{duel}',change->'duel');
   next_data:=jsonb_set(next_data,'{wallet,gems}',to_jsonb(least(9999999,coalesce((saved.data->'wallet'->>'gems')::bigint,0)+(change->>'gems')::bigint)));
   update public.player_saves set data=next_data,data_hash=encode(sha256(convert_to(next_data::text,'UTF8')),'hex'),revision=revision+1,updated_at=now() where player_id=other;
   perform public.server_sync_player_meta(other,next_data,saved.summary);
 end loop;
 result:=public.server_commit_state_before_duels(p_player,p_expected_revision,p_data,p_hash,p_version,p_summary-'_duels',p_method,p_request,p_response);
 return result;
end $$;
revoke all on function public.server_duel_context(uuid,text,integer),public.server_commit_state_before_duels(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb),public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.server_duel_context(uuid,text,integer),public.server_commit_state(uuid,bigint,jsonb,text,integer,jsonb,text,text,jsonb) to service_role;
