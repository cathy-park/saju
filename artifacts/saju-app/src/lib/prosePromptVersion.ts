// 단일 출처(single source of truth) — api/polish-prose.ts의 공유 프롬프트를 바꿀 때마다
// 이 값 하나만 올린다. 사주·자미두수·서양점성술·종합 네 topic이 모두 이 상수를
// promptVersion으로 보내므로, 여기 한 곳만 올리면 네 topic의 캐시(user_id+source_hash+
// prompt_version+topic+section_key로 구분된 ziwei_prose_cache row)가 한꺼번에 무효화된다.
//
// 21단계 이전에는 src/lib/prosePolish.ts(PROSE_PROMPT_VERSION="v3")와
// src/lib/integrated/prompt.ts(INTEGRATED_PROMPT_VERSION="integrated-v1")가 서로 다른
// 상수를 독립적으로 관리했다 — api/polish-prose.ts의 공유 프롬프트를 바꿀 때 한쪽만 올리면
// 다른 쪽은 캐시된 구버전 문장을 계속 반환하는 드리프트 위험이 있었다. 이번 통합으로 그
// 위험을 구조적으로 제거한다(21단계 대표 지시).
//
// v4: 사주·자미두수·서양점성술·종합 4개 topic 계열의 promptVersion을 이 상수 하나로 통합.
export const SHARED_PROSE_PROMPT_VERSION = "v4";

// api/integrated-holistic.ts 전용 프롬프트 버전 — 섹션 하나를 다듬는 위 프롬프트와는 완전히
// 다른 프롬프트(리포트 전체를 하나의 상담문으로 통합)라 별도 상수를 쓴다. 다만 "버전이
// 여러 곳에 흩어져 드리프트되는 문제"를 반복하지 않기 위해 SHARED_PROSE_PROMPT_VERSION과
// 같은 파일에 둔다 — api/integrated-holistic.ts의 프롬프트를 바꿀 때는 이 값만 올리면 된다.
export const INTEGRATED_HOLISTIC_PROMPT_VERSION = "holistic-v1";
