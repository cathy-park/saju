-- 앱 내부 OpenAI 자연어 해석 기능이 완전히 제거됐다(commit 98ae037).
-- 0001_ziwei_prose_layer.sql이 만든 두 테이블은 api/polish-prose.ts 전용 캐시/로그였고,
-- 그 API 자체가 삭제되어 더 이상 어떤 코드에서도 참조하지 않는다(src/, api/ 전체 grep으로
-- ziwei_prose_cache / ziwei_prose_requests_log 참조 0건 확인).
--
-- Supabase 대시보드 → SQL Editor에서 이 파일 내용을 그대로 실행할 것.
drop table if exists public.ziwei_prose_cache;
drop table if exists public.ziwei_prose_requests_log;
