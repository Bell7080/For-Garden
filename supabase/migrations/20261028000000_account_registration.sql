-- 회원가입 전에도 사용 가능한 서버 전용 속도 제한. 기존 제한 기록 표를 재사용한다.
-- 거절한 재시도는 기록하지 않아 대기 시간이 반복 요청으로 영구 연장되지 않는다.
create function public.server_take_account_rate(p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); n integer; oldest timestamptz; retry integer:=0; span integer; cap integer;
begin
 if length(p_key) not between 8 and 100 then raise exception 'invalid_key'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||p_key,28));
 foreach span in array array[60,3600] loop
   cap:=case when span=60 then 5 else 20 end;
   select count(*),min(at) into n,oldest from public.support_limits where key='account:'||p_key and at>t-make_interval(secs=>span);
   if n>=cap then retry:=greatest(retry,greatest(1,ceil(extract(epoch from oldest+make_interval(secs=>span)-t))::integer)); end if;
 end loop;
 if retry>0 then return jsonb_build_object('allowed',false,'retryAfter',retry); end if;
 insert into public.support_limits(key,at) values('account:'||p_key,t);
 return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;
revoke all on function public.server_take_account_rate(text) from public,anon,authenticated;
grant execute on function public.server_take_account_rate(text) to service_role;

-- 복구의 비밀번호 증명은 Auth가 수행한다. 이 함수는 서버에 정확한 아이디의 UID만 제공한다.
create function public.server_id_account(p_email text) returns jsonb
language sql security definer set search_path='' stable as $$
 select jsonb_build_object('id',u.id) from auth.users u where u.email=p_email
 and p_email ~ '^[a-z][a-z0-9_]{3,19}@id[.]forgarden[.]app$' limit 1;
$$;
revoke all on function public.server_id_account(text) from public,anon,authenticated;
grant execute on function public.server_id_account(text) to service_role;
