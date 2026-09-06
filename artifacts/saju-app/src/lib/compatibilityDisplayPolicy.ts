import type { RelationshipType } from "./storage";

/**
 * [Phase 3 P0] 사용자 화면(Compatibility.tsx)과 클립보드 export(clipboardExport.ts)가
 * 공유하는 단일 source of truth. "같은 화면/내보내기에 서로 다른 산식의 동일 이름 점수가
 * 동시에 뜨는" 위험을 구조적으로 막기 위해, 어떤 목적별 궁합 카드를 노출할지는 반드시
 * 이 함수 하나로만 결정한다.
 *
 * 정책(대표 승인 baseline):
 *  - lover / spouse / interest → 인간관계·연애·결혼 궁합 모두 노출
 *  - friend / family / coworker / other / undefined → 인간관계 궁합만 노출
 *
 * 참고: 이전에는 "두 사람 성별이 다르면 family/coworker에도 연애·결혼 점수를 함께
 * 보여준다"는 별도 확장 정책(genderDiffers)이 있었으나, 이번 Phase 3 전환에서 대표가
 * "friend/family/coworker: Human Compatibility만 표시"를 명시적으로 재확정해 폐기했다.
 */
export interface CompatibilityCardPolicy {
  showHuman: boolean;
  showRomance: boolean;
  showMarriage: boolean;
}

export function getCompatibilityCardPolicy(relType?: RelationshipType): CompatibilityCardPolicy {
  const isRomantic = relType === "lover" || relType === "spouse" || relType === "interest";
  return { showHuman: true, showRomance: isRomantic, showMarriage: isRomantic };
}
