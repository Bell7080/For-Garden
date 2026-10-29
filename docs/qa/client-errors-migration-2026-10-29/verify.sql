begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $verify$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); key text:='verify.'||gen_random_uuid(); payload jsonb; error_id bigint; calls integer;
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true);
 insert into public.admin_roles(user_id,role) values(b,'operator');
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.report_client_error('report',key,'test 1',null,'0.393.0','qa','web','verify','{}','[]');
  raise exception 'unauthenticated report accepted';
 exception when sqlstate '28000' then null; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 payload:=public.report_client_error('invalid',key,'test 1',null,'0.393.0','qa','web','verify','{}','[]');
 if payload->>'error'<>'invalid_kind' then raise exception 'invalid kind accepted'; end if;
 payload:=public.report_client_error('report',key,'test 1',null,'0.393.0','qa','web','verify','{"mode":"stage"}','[]');
 if payload->>'ok'<>'true' or payload->>'known'<>'false' then raise exception 'first report failed'; end if;
 payload:=public.report_client_error('report',key,'test 2',null,'0.393.0','qa','web','verify','{}','[]');
 if payload->>'known'<>'true' then raise exception 'fingerprint grouping failed'; end if;
 select id into error_id from public.client_errors where code=key and occurrences=2;
 if error_id is null then raise exception 'occurrence counter failed'; end if;
 execute 'set local role authenticated';
 if (select count(*) from public.client_errors where id=error_id)<>0 then raise exception 'regular user read logs'; end if;
 begin
  perform public.admin_set_client_error_status(error_id,'fixed','not authorized');
  raise exception 'regular user changed status';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',b::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.client_errors where id=error_id)<>1 then raise exception 'operator cannot read logs'; end if;
 payload:=public.admin_set_client_error_status(error_id,'fixed','verified');
 if payload->>'ok'<>'true' then raise exception 'operator cannot set status'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.report_client_error('report',key,'test 3',null,'0.393.0','qa','web','verify','{}','[]');
 if (select status from public.client_errors where id=error_id)<>'fixed' then raise exception 'same version reopened fixed error'; end if;
 perform public.report_client_error('report',key,'test 4',null,'0.393.1','qa','web','verify','{}','[]');
 if (select status from public.client_errors where id=error_id)<>'open' then raise exception 'new version did not reopen error'; end if;
 perform public.report_client_error('error',key||'.long',repeat('m',900),repeat('s',5000),repeat('v',60),repeat('b',30),repeat('p',30),repeat('c',80),jsonb_build_object('large',repeat('x',4000)),jsonb_build_array(repeat('y',4000)));
 if not exists(select 1 from public.client_errors where code=key||'.long' and char_length(message)=500 and char_length(stack)=4000 and char_length(app_version)=32 and char_length(build)=16 and char_length(platform)=16 and char_length(scene)=48 and context='{}'::jsonb and breadcrumbs='[]'::jsonb) then raise exception 'field/context bounds failed'; end if;
 select count(*) into calls from public.support_limits sl where sl.key='err:'||a::text and sl.at>now()-interval '1 hour';
 for i in calls+1..30 loop
  payload:=public.report_client_error('report',key,'test 5',null,'0.393.1','qa','web','verify','{}','[]');
  if payload->>'ok'<>'true' then raise exception 'premature rate limit'; end if;
 end loop;
 payload:=public.report_client_error('report',key,'test 6',null,'0.393.1','qa','web','verify','{}','[]');
 if payload->>'error'<>'rate_limited' then raise exception '31st report not limited'; end if;
 if has_function_privilege('anon','public.report_client_error(text,text,text,text,text,text,text,text,jsonb,jsonb)','EXECUTE') or not has_function_privilege('authenticated','public.report_client_error(text,text,text,text,text,text,text,text,jsonb,jsonb)','EXECUTE') then raise exception 'report RPC permissions failed'; end if;
end $verify$;
select 'PASS: auth, grouping, occurrences, ordinary-user RLS and status denial, operator read/status, version reopen, field bounds, 30/hour limit' as verification;
rollback;
