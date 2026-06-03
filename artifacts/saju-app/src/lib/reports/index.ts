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
  if (relType === "lover" || relType === "spouse") {
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
