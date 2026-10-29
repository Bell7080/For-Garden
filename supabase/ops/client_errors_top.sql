-- 열린 오류를 AI에게 그대로 붙여 넣을 수 있는 글로 뽑는다. 읽기 전용(운영 DB의 SQL 편집기에서 실행).
-- 상위 N건을 바꾸려면 limit만 고친다. 고친 뒤에는 admin_set_client_error_status(id, 'fixed', '메모')로 닫는다.
select format(E'## #%s [%s] %s\n- 횟수 %s · 영향 계정 %s · 첫 발생 %s · 마지막 %s\n- 버전 %s · 빌드 %s · 화면 %s\n- 메시지: %s\n- 맥락: %s\n- 최근 조작(초 전, 내용): %s\n- 스택:\n%s\n',
  id, kind, coalesce(code, '-'), occurrences, affected_players, first_seen, last_seen, app_version, build, coalesce(scene, '-'),
  message, context::text, breadcrumbs::text, coalesce(stack, '(없음)')) as report
from public.client_errors
where status = 'open'
order by occurrences desc, last_seen desc
limit 10;
