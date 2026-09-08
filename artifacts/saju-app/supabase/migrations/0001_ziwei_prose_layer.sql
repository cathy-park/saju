-- 자미두수 리포트 AI 다듬기(prose layer) 캐시 + rate limit 테이블.
-- 이 파일은 코드 저장소에만 존재하며 아직 실제 Supabase 프로젝트에 적용되지 않았다.
-- Supabase 대시보드의 SQL Editor에서 이 파일 내용을 그대로 실행해야 api/polish-prose.ts가
-- 정상 동작한다(서버 함수는 service_role 키로만 이 테이블에 접근하므로 클라이언트용 RLS
-- 정책은 별도로 추가하지 않는다 — 기본값이 곧 "service_role 외 전면 차단"이다).

create table if not exists public.ziwei_prose_requests_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  requested_at timestamptz not null default now()
);

create index if not exists ziwei_prose_requests_log_user_time_idx
  on public.ziwei_prose_requests_log (user_id, requested_at desc);

alter table public.ziwei_prose_requests_log enable row level security;

create table if not exists public.ziwei_prose_cache (
  user_id uuid not null,
  source_hash text not null,
  prompt_version text not null,
  topic text not null,
  section_key text not null,
  prose text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_hash, prompt_version, topic, section_key)
);

alter table public.ziwei_prose_cache enable row level security;
