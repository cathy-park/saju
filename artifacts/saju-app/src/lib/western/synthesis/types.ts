import type { WesternPersonalityReport } from "../interpretation/types.js";
import type { WesternRelationshipReport } from "../interpretation/romance/types.js";
import type { WesternTransitReport } from "../transit/types.js";
import type { WesternSynastryReport } from "../synastry/types.js";

export type SynthesisRelationKind = "consensus" | "complement" | "tension";
export type SynthesisSourceModule = "personality" | "romance" | "transit" | "synastry";
export interface SynthesisSourceRef {
  module: SynthesisSourceModule;
  personId?: string;
  pairId?: string;
  factId: string;
  ultimateEvidenceIds: string[];
  linkedNatalFactIds?: string[];
  role?: "primary" | "supporting" | "activation";
}
export interface EvidenceIndependence {
  allEvidenceIds: string[];
  sharedEvidenceIds: string[];
  uniqueEvidenceByFact: Record<string, string[]>;
  allSourcesRetainUniqueEvidence: boolean;
  independentConsensusEligible: boolean;
}
export interface TimingActivation { active: boolean; transitFactIds: string[]; activatedSynthesisFactIds?: string[] }
export interface WesternSynthesisFact {
  id: string;
  meaning: string;
  relationKind?: SynthesisRelationKind;
  timing: TimingActivation;
  sourceRefs: SynthesisSourceRef[];
  independence: EvidenceIndependence;
  primaryOwnerSection: string;
}
export interface WesternSynthesisSection { key: string; title: string; text: string; facts: WesternSynthesisFact[]; primarySourceRefs: SynthesisSourceRef[]; referencedFactIds: string[] }
export interface WesternPersonalSynthesisReport { schemaVersion: "western-personal-synthesis/v1"; personId: string; sections: WesternSynthesisSection[] }
export interface WesternRelationshipSynthesisReport { schemaVersion: "western-relationship-synthesis/v1"; pairId: string; sections: WesternSynthesisSection[] }
export interface PersonalSynthesisInput { personId: string; personality: WesternPersonalityReport; romance: WesternRelationshipReport; transit?: WesternTransitReport }
export interface RelationshipSynthesisSubject { personId: string; personality: WesternPersonalityReport; romance: WesternRelationshipReport; transit?: WesternTransitReport }
export interface RelationshipSynthesisInput { first: RelationshipSynthesisSubject; second: RelationshipSynthesisSubject; synastry: WesternSynastryReport }
