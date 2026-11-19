-- 처리 영수증(`request_receipts`)은 같은 요청의 재전송이 두 번 반영되지 않게 하는 멱등 기록이다.
-- requestId는 요청마다 새로 만든 무작위 값이라 재전송은 몇 분 안에 끝나는데, 지우는 곳이 없어
-- 한 달 만에 3.4만 행·618MB(대부분 TOAST)가 쌓였다(2026-11-18 진단). 사흘이 지난 영수증은 걷는다.
-- 사흘은 앱을 껐다 다시 켜며 밀린 요청을 다시 보내는 경우까지 넉넉히 덮는 값이다.
create or replace function public.purge_request_receipts(p_keep_days integer default 3, p_batch integer default 5000)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer := 0; n integer;
begin
  if p_keep_days < 1 then raise exception 'keep_days_too_small' using errcode = '22023'; end if;
  loop
    delete from public.request_receipts r
      where (r.player_id, r.request_id) in (
        select x.player_id, x.request_id from public.request_receipts x
          where x.created_at < now() - make_interval(days => p_keep_days)
          order by x.created_at limit greatest(p_batch, 1));
    get diagnostics n = row_count;
    removed := removed + n;
    exit when n < greatest(p_batch, 1);
  end loop;
  return removed;
end $$;
revoke all on function public.purge_request_receipts(integer, integer) from public, anon, authenticated;

-- 매일 한 번(UTC 18:40 = 한국 새벽 3:40, 다른 정리 작업과 겹치지 않는 시각) 돈다. pg_cron이 없는 DB는 건너뛴다.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-request-receipts';
    perform cron.schedule('purge-request-receipts', '40 18 * * *', 'select public.purge_request_receipts(3);');
  end if;
end $$;
