-- v0.554.0: 표시 이름과 갈려 있던 렐릭 ID를 이름에 맞춘다(응태 결정 2026-11-27).
-- 클라이언트는 저장 v53 마이그레이션(src/state/SaveManager.ts의 RENAMED_RELIC_IDS_V53)이 같은 표로 옮기고,
-- 서버는 저장을 읽을 때 같은 함수를 지난다. 이 파일은 **SQL이 저장을 거치지 않고 직접 읽는 자리**
-- (결투 상대 풀·공개 프로필·길드 얼굴·길드전 덱·아레나 방·공유 레이드·멱등 영수증)를 함께 옮긴다.
-- 규칙은 TS와 같다: 앞뒤가 영숫자·밑줄이 아닌 낱말로 선 옛 ID만 바꾼다. 사람이 적은 글(닉네임 등)은 건드리지 않는다.
-- 되돌리기: supabase/ops/relic_id_rename_down.sql (같은 함수에 거꾸로 된 표를 넘긴다).

create or replace function private.relic_id_rename_pairs(p_reverse boolean default false)
returns table(old_id text, new_id text) language sql immutable as $$
  select case when p_reverse then n else o end, case when p_reverse then o else n end
  from (values
    ('raitia-grass','viria'),('raitia-water','guttia'),('raitia-fire','favia'),('raitia-earth','silia'),('raitia-wind','ventia'),
    ('quetzalcoatlus','koatl'),('spino','spina'),('dodo','dodi'),('carno','kar'),('deina','dei'),
    ('nokan','gigano'),('eunte','argen'),('rex','rexia')
  ) as t(o, n)
  order by length(case when p_reverse then n else o end) desc
$$;

create or replace function private.relic_id_rename_text(p_value text, p_reverse boolean default false)
returns text language plpgsql immutable as $$
declare pair record; result text := p_value;
begin
  if result is null then return null; end if;
  for pair in select * from private.relic_id_rename_pairs(p_reverse) loop
    result := regexp_replace(result, '(?<![A-Za-z0-9_])' || replace(pair.old_id, '-', '\-') || '(?![A-Za-z0-9_])', pair.new_id, 'g');
  end loop;
  return result;
end $$;

-- jsonb는 키와 문자열 값을 걷되 사람이 적은 글이 드는 키 아래는 그대로 둔다(TS의 FREE_TEXT_KEYS와 같다).
create or replace function private.relic_id_rename_jsonb(p_value jsonb, p_reverse boolean default false)
returns jsonb language plpgsql immutable as $$
declare k text; v jsonb; result jsonb;
begin
  if p_value is null then return null; end if;
  case jsonb_typeof(p_value)
    when 'string' then return to_jsonb(private.relic_id_rename_text(p_value #>> '{}', p_reverse));
    when 'array' then
      select coalesce(jsonb_agg(private.relic_id_rename_jsonb(e, p_reverse) order by i), '[]'::jsonb) into result
        from jsonb_array_elements(p_value) with ordinality as a(e, i);
      return result;
    when 'object' then
      result := '{}'::jsonb;
      for k, v in select * from jsonb_each(p_value) loop
        result := result || jsonb_build_object(
          private.relic_id_rename_text(k, p_reverse),
          case when k in ('nickname','bio','intro','introduction','greeting','message','displayName','name','body','text','title','memo') then v
               else private.relic_id_rename_jsonb(v, p_reverse) end);
      end loop;
      return result;
    else return p_value;
  end case;
end $$;

create or replace function private.relic_id_rename_apply(p_reverse boolean default false)
returns jsonb language plpgsql as $$
declare
  pattern text := '(^|[^A-Za-z0-9_])(' || (select string_agg(replace(old_id, '-', '\-'), '|') from private.relic_id_rename_pairs(p_reverse)) || ')([^A-Za-z0-9_]|$)';
  counts jsonb := '{}'::jsonb; n bigint;
begin
  update public.player_saves set data = private.relic_id_rename_jsonb(data, p_reverse) where data::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('player_saves', n);
  update public.server_public_profiles set profile = private.relic_id_rename_jsonb(profile, p_reverse) where profile::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('server_public_profiles', n);
  update public.server_raids set definition = private.relic_id_rename_jsonb(definition, p_reverse) where definition::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('server_raids', n);
  update public.arena_rooms set data = private.relic_id_rename_jsonb(data, p_reverse) where data::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('arena_rooms', n);
  update public.arena_receipts set fingerprint = private.relic_id_rename_jsonb(fingerprint, p_reverse) where fingerprint::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('arena_receipts', n);
  update public.guild_members set avatar_relic_id = private.relic_id_rename_text(avatar_relic_id, p_reverse) where avatar_relic_id ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('guild_members.avatar', n);
  update public.guild_members set card = private.relic_id_rename_jsonb(card, p_reverse) where card::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('guild_members.card', n);
  update public.guild_members set war_standby = private.relic_id_rename_jsonb(war_standby, p_reverse) where war_standby::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('guild_members.war_standby', n);
  update public.guild_war_defense set deck = private.relic_id_rename_jsonb(deck, p_reverse), lineup = private.relic_id_rename_jsonb(lineup, p_reverse)
    where deck::text ~ pattern or lineup::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('guild_war_defense', n);
  update public.request_receipts set response = private.relic_id_rename_jsonb(response, p_reverse) where response::text ~ pattern;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('request_receipts', n);
  return counts;
end $$;

revoke all on function private.relic_id_rename_apply(boolean) from public, anon, authenticated;
select private.relic_id_rename_apply(false);
