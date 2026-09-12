-- 0002_profiles_email_column.sql이 email 컬럼만 고쳤는데, production profiles 테이블에는
-- full_name 컬럼도 실제로 없어(PostgreSQL 42703 undefined_column, PostgREST 응답은
-- PGRST204) upsertUserProfile()의 POST /rest/v1/profiles?on_conflict=id가 여전히 400으로
-- 실패하고 있다.
--
-- 진단(2026-09-13, production 실제 콘솔/네트워크 응답으로 직접 확인 — 추측 아님):
--   1) 로그인/홈 재진입마다 POST /rest/v1/profiles?on_conflict=id → 400
--   2) 앱이 그대로 노출한 PostgREST 에러: "Could not find the 'full_name' column of
--      'profiles' in the schema cache"
--   3) src/lib/db.ts의 upsertUserProfile()은 id/email/full_name/avatar_url/updated_at
--      5개 필드를 보내는데, 저장소 원본 supabase_schema.sql(4-11행)에는 이 5개 모두
--      컬럼으로 선언돼 있다 — 즉 email 하나만 반영되고 full_name·avatar_url은 아직
--      production에 반영되지 않은 상태로 남아있는 것이 원인이다.
--
-- Supabase 대시보드 → SQL Editor에서 이 파일 내용을 그대로 실행할 것.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
