-- 20261203000000_relic_id_rename.sql 되돌리기. 클라이언트·서버를 v0.553.x로 되돌린 뒤에만 실행한다
-- (v0.554.0 이후 클라이언트는 새 ID만 안다). 새 ID 낱말을 옛 ID로 되돌린다.
select private.relic_id_rename_apply(true);
