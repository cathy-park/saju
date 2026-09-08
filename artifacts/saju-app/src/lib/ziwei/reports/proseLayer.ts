// 실제 구현은 src/lib/prosePolish.ts(공용, 사주와 함께 씀)로 옮겼다 — 로직은 전혀 바뀌지
// 않았다(순수 재배치). 기존에 이 파일에서 import하던 7개 자미두수 리포트 페이지가 계속
// 동작하도록 이름만 그대로 재노출한다.
export { PROSE_PROMPT_VERSION, polishStatementText, type PolishResult } from "@/lib/prosePolish";
