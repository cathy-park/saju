import type { PersonRecord, RelationshipType } from "../storage";
import type { AnyCompatibilityReport } from "./types";
import { generateLoverReport } from "./LoverReportGenerator";
import { generateCoworkerReport } from "./CoworkerReportGenerator";
import { generateFamilyFriendReport } from "./FamilyFriendReportGenerator";

export function getCompatibilityReport(
  p1: PersonRecord,
  p2: PersonRecord,
  relType?: RelationshipType
): AnyCompatibilityReport {
  // 썸/이성(interest)도 연애 전제 관계라 연인·배우자와 동일하게 LoverReportGenerator를
  // 써야 한다 — 여기서 빠져 있으면 marriageView(결혼 관점 해석)를 전혀 계산하지 않는
  // FamilyFriendReportGenerator로 잘못 라우팅되어, UI(Compatibility.tsx)는 "interest"도
  // 노출 대상으로 이미 처리하고 있는데 정작 내용(marriageView)이 비어 보이는 버그가 있었다.
  if (relType === "lover" || relType === "spouse" || relType === "interest") {
    return generateLoverReport(p1, p2, relType);
  }
  if (relType === "coworker") {
    return generateCoworkerReport(p1, p2);
  }
  
  // family, friend, other, or undefined fallback to family/friend model
  const resolvedType = relType === "family" || relType === "friend" ? relType : "other";
  return generateFamilyFriendReport(p1, p2, resolvedType);
}

export * from "./types";
