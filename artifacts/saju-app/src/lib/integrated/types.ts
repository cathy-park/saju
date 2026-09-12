export type IntegratedSystem = "saju" | "ziwei" | "western";
export type IntegratedTheme = "selfDirection" | "emotionProcessing" | "thinkingCommunication" | "actionDrive" | "relationshipNeeds" | "intimacyConflict" | "longTermRelationship" | "careerResponsibility" | "moneyReality" | "growthChange";
export type IntegratedRelationKind = "consensus" | "complement" | "tension";
export type RelationshipEvidenceRole = "dyadic-evidence" | "individual-context";
export type SourceKind = "detail" | "summary" | "operations" | "score";
export type TemporalGranularity = "decade" | "year" | "month" | "instant-window";

export interface TemporalScope { start: string; end: string; timezone: string; granularity: TemporalGranularity; sourcePeriodLabel: string }
export interface IntegratedEvidenceRef { id: string; label: string }
export interface IntegratedSourceFact {
  system: IntegratedSystem; module: string; factId: string; personId?: string; meaning: string;
  evidence: IntegratedEvidenceRef[]; evidenceRole: RelationshipEvidenceRole; sourceKind?: SourceKind;
  temporalScope?: TemporalScope;
}
export interface TaxonomyMapping { ruleId: string; theme: IntegratedTheme; concept: string; direction: string }
export interface IntegratedProvenance extends IntegratedSourceFact { mapping: TaxonomyMapping }
export interface IntegratedSynthesisFact {
  id: string; theme: IntegratedTheme; concept: string; direction: string; meaning: string;
  relationKind: IntegratedRelationKind; sources: IntegratedProvenance[]; sourceSystems: IntegratedSystem[];
  dyadicSystems: IntegratedSystem[]; primaryOwnerSection: IntegratedSectionKey;
}
export type IntegratedSectionKey = "overview" | "coreNature" | "emotionRelationship" | "workCareer" | "moneyReality" | "strengthGrowth" | "currentFlow" | "relationshipCore" | "attractionIntimacy" | "emotionalCommunication" | "conflictAdjustment" | "longTerm";
export interface IntegratedSection { key: IntegratedSectionKey; title: string; text: string; facts: IntegratedSynthesisFact[]; referencedFactIds: string[] }
export interface TimingConvergence { id: string; theme: IntegratedTheme; concept: string; meaning: string; sources: IntegratedProvenance[]; overlap: { start: string; end: string } }
export interface SourceAudit { inputFactCount: number; eligibleFactCount: number; uniqueEvidenceCount: number; excludedFactIds: string[]; dedupedEvidenceIds: string[] }
export interface IntegratedReport { schemaVersion: "integrated-report/v1"; scope: "personal" | "relationship"; subjectId: string; availableSystems: IntegratedSystem[]; missingSystems: IntegratedSystem[]; sections: IntegratedSection[]; timingConvergences: TimingConvergence[]; standaloneFacts: IntegratedProvenance[]; unmappedFacts: IntegratedSourceFact[]; sourceAudit: SourceAudit }
export interface SelectedPeriod { start: string; end: string; timezone: string }
