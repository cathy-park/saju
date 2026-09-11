import type { ReportFact } from "@/lib/reportFacts";
import type { PlanetId, WesternNatalChart, WesternPointId } from "../../types.js";
import type { OrbBand } from "../rules/aspectRules.js";

export type RelationshipSectionKey = "overview" | "attraction" | "affectionIntimacy" | "relationshipNeeds" | "conflictPatterns" | "longTermPartner" | "relationshipOperations";
export interface RelationshipEvidence {
  id: string;
  kind: "placement" | "angle" | "cusp" | "aspect";
  label: string;
  sourcePointIds: WesternPointId[];
  primaryOwnerSection: RelationshipSectionKey;
  role?: "primary-ruler" | "co-ruler" | "fifth-ruler";
  orbBand?: OrbBand;
}
export interface RelationshipFact extends ReportFact<RelationshipEvidence> {
  primaryOwnerSection: RelationshipSectionKey;
  concepts: string[];
}
export interface RelationshipSection {
  key: RelationshipSectionKey;
  title: string;
  text: string;
  facts: RelationshipFact[];
  primaryEvidence: RelationshipEvidence[];
  referencedFactIds: string[];
}
export interface HouseRulership { sign: string; primaryRuler: PlanetId; coRulers: PlanetId[]; }
export interface WesternRelationshipReport {
  chart: WesternNatalChart;
  rulership: { fifth: HouseRulership; seventh: HouseRulership };
  sections: RelationshipSection[];
}
