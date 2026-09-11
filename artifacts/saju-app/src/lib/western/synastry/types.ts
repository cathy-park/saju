import type { ReportFact } from "@/lib/reportFacts";
import type { AspectType, PlanetId, WesternNatalChart } from "../types.js";

export type SynastrySectionKey = "overview" | "attraction" | "emotionalSecurity" | "communication" | "intimacyDesire" | "conflictPatterns" | "longTerm" | "operations";
export type SynastryOrbBand = "exact" | "close" | "supporting";
export type SynastryAngleId = "ascendant" | "descendant" | "midheaven";
export interface SynastrySubject { personId: string; chart: WesternNatalChart }
export interface SynastryPointRef { personId: string; pointId: PlanetId }

export interface CrossAspectEvidence {
  id: string; kind: "cross-aspect"; pairId: string;
  points: [SynastryPointRef, SynastryPointRef];
  type: AspectType; separation: number; orb: number; allowedOrb: number; orbBand: SynastryOrbBand;
  primaryOwnerSection?: SynastrySectionKey;
}
export interface HouseOverlayEvidence {
  id: string; kind: "house-overlay"; pairId: string;
  sourcePersonId: string; sourcePointId: PlanetId; targetPersonId: string; targetHouse: 1 | 4 | 5 | 7 | 8 | 10;
  primaryOwnerSection?: SynastrySectionKey;
}
export interface AngleAspectEvidence {
  id: string; kind: "angle-aspect"; pairId: string;
  sourcePersonId: string; sourcePointId: PlanetId; targetPersonId: string; targetAngleId: SynastryAngleId;
  type: AspectType; separation: number; orb: number; allowedOrb: 3; orbBand: SynastryOrbBand;
  primaryOwnerSection?: SynastrySectionKey;
}
export type SynastryRawEvidence = CrossAspectEvidence | HouseOverlayEvidence | AngleAspectEvidence;
export interface SynastryEvidenceSet { pairId: string; crossAspects: CrossAspectEvidence[]; overlays: HouseOverlayEvidence[]; angleAspects: AngleAspectEvidence[] }

export interface SynastryRulerLink {
  id: string; pairId: string; rulerPersonId: string; rulerPointId: PlanetId; rulerRole: "primary" | "co-ruler";
  targetPersonId: string; targetPointId: PlanetId; crossAspectId: string;
}
export interface NatalFactLink { personId: string; kind: "natal-fact" | "structural-context"; factIds: string[]; context?: { sign: string; house: number; natalAspectLabels: string[] } }
export interface SynastryEvidenceView { id: string; label: string; raw: SynastryRawEvidence; natalLinks: NatalFactLink[]; primaryOwnerSection: SynastrySectionKey }
export interface SynastryFact extends ReportFact<SynastryEvidenceView> { primaryOwnerSection: SynastrySectionKey; concepts: string[] }
export interface SynastrySection { key: SynastrySectionKey; title: string; text: string; facts: SynastryFact[]; primaryEvidence: SynastryEvidenceView[]; referencedFactIds: string[] }
export interface SynastryRulership { sign: string; primaryRuler: PlanetId; coRulers: PlanetId[] }
export interface WesternSynastryReport {
  schemaVersion: "western-synastry/v1"; pairId: string; subjects: [SynastrySubject, SynastrySubject]; evidence: SynastryEvidenceSet;
  rulership: Record<string, SynastryRulership>; rulerLinks: SynastryRulerLink[]; sections: SynastrySection[];
}
