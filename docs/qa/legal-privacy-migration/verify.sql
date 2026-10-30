-- Disposable PostgreSQL only when app.legal_verify_purge=1; the default path never purges accounts.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $verify$
declare v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid(); v_due timestamptz; v_result jsonb; v_count integer;
begin
 insert into auth.users(id,is_anonymous) values(v_a,true),(v_b,true);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.record_legal_consent('terms-test','privacy-test',true); raise exception 'unauthenticated consent accepted';
 exception when sqlstate '28000' then null; end;
 perform set_config('request.jwt.claim.sub',v_a::text,true);
 execute 'set local role authenticated';
 v_result:=public.record_legal_consent('terms-test','privacy-test',false);
 if v_result->>'error'<>'age_required' then raise exception 'age guard failed'; end if;
 v_result:=public.record_legal_consent('','privacy-test',true);
 if v_result->>'error'<>'invalid_version' then raise exception 'version guard failed'; end if;
 perform public.record_legal_consent('terms-test','privacy-test',true);
 perform public.record_legal_consent('terms-test','privacy-test',true);
 execute 'reset role';
 if (select count(*) from public.legal_consents where player_id=v_a)<>1 then raise exception 'consent retry duplicated rows'; end if;
 execute 'set local role authenticated';
 v_result:=public.submit_ticket('privacy','verification','privacy request',null,'test','web');
 if v_result->>'ok'<>'true' then raise exception 'privacy support rejected'; end if;
 v_result:=public.request_account_deletion();
 v_due:=(v_result->>'purge_after')::timestamptz;
 if v_due<>now()+interval '7 days' then raise exception 'seven day grace failed'; end if;
 v_result:=public.request_account_deletion();
 if (v_result->>'purge_after')::timestamptz<>v_due then raise exception 'retry extended grace'; end if;
 perform set_config('request.jwt.claim.sub',v_b::text,true);
 v_result:=public.get_account_deletion();
 if v_result->>'pending'<>'false' then raise exception 'other account request visible'; end if;
 perform set_config('request.jwt.claim.sub',v_a::text,true);
 v_result:=public.get_account_deletion();
 if v_result->>'pending'<>'true' then raise exception 'own request missing'; end if;
 perform public.cancel_account_deletion();
 v_result:=public.get_account_deletion();
 if v_result->>'pending'<>'false' then raise exception 'cancellation failed'; end if;
 begin
  perform public.purge_deleted_accounts(); raise exception 'ordinary account can purge';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 if not exists(select 1 from public.account_deletion_requests where user_id=v_a and cancelled_at is not null) then raise exception 'cancel marker missing'; end if;
 v_result:=public.web_submit_ticket('verification@example.invalid','privacy','verification','privacy request',repeat('x',32),null);
 if v_result->>'ok'<>'true' then raise exception 'web privacy support rejected'; end if;
 if coalesce(current_setting('app.legal_verify_purge',true),'')='1' then
  -- This branch is enabled only by local-check.mjs in a disposable container.
  perform public.request_account_deletion();
  update public.account_deletion_requests set purge_after=now()-interval '1 second' where user_id=v_a;
  v_count:=public.purge_deleted_accounts();
  if v_count<>1 or exists(select 1 from auth.users where id=v_a) or exists(select 1 from public.legal_consents where player_id=v_a) or not exists(select 1 from auth.users where id=v_b) then raise exception 'local purge/cascade isolation failed'; end if;
 end if;
end $verify$;
select 'PASS: consent auth/age/version/retry, privacy support, seven-day grace, retry/cancel/own-account scope, purge permissions and isolated-only purge' as verification;
rollback;
