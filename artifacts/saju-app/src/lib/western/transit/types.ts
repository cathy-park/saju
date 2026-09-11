import type { ReportFact } from "@/lib/reportFacts";
import type { AspectType, PlanetId, WesternNatalChart } from "../types.js";

export type TransitTargetId = PlanetId | "ascendant" | "midheaven";
export type TransitRole = "background" | "trigger";
export type TransitPhase = "exact" | "close" | "active";
export type TransitSectionKey = "overview" | "emotionalRelationships" | "workCareer" | "moneyReality" | "actionChange" | "adjustments";

export interface TransitQuery {
  /** Inclusive calendar dates interpreted in `timezone`, never as UTC dates. */
  startLocalDate: string;
  endLocalDate: string;
  timezone: string;
  /** Optional instant used for current orb/applying state inside the range. */
  referenceLocalDateTime?: string;
}

export interface NormalizedTransitQuery extends TransitQuery {
  startUtcInstant: string;
  /** Exclusive local-day boundary after endLocalDate. */
  endUtcInstant: string;
  referenceUtcInstant: string;
}

export interface TransitPoint {
  id: PlanetId;
  longitude: number;
  speedLongitude: number;
  retrograde: boolean;
  /** House crossed in the fixed natal house cusps, not houses at the transit location. */
  natalHouse: number;
}

export interface TransitActivation {
  transitPointId: PlanetId;
  natalTargetId: TransitTargetId;
  type: AspectType;
  orb: number;
  allowedOrb: number;
  applying: boolean;
  role: TransitRole;
}

export interface TransitSnapshot {
  localDateTime: string;
  timezone: string;
  utcInstant: string;
  points: TransitPoint[];
  activations: TransitActivation[];
}

export interface TransitEvent extends TransitActivation {
  id: string;
  natalHouse: number;
  windowStart: string;
  exactHits: string[];
  windowEnd: string;
  activeAtQueryStart: boolean;
  activeAfterQueryEnd: boolean;
  phase: TransitPhase;
  referenceUtcInstant: string;
  transitLongitude: number;
  natalLongitude: number;
  primaryOwnerSection?: TransitSectionKey;
  /** Added by the interpretation report; raw timeline calculation leaves it unset. */
  natalLink?: NatalLink;
}

export interface TransitTimeline {
  schemaVersion: "western-transit/v1";
  engine: WesternNatalChart["engine"];
  natalChart: WesternNatalChart;
  query: NormalizedTransitQuery;
  events: TransitEvent[];
  warnings: string[];
}

export type NatalLink =
  | { kind: "natal-fact"; factIds: string[] }
  | { kind: "structural-context"; context: { target: TransitTargetId; sign: string; house?: number; natalAspectLabels: string[] } }
  | { kind: "technical" };

export interface TransitEvidence {
  eventId: string;
  label: string;
  role: TransitRole;
  phase: TransitPhase;
  natalLink: NatalLink;
  primaryOwnerSection: TransitSectionKey;
}

export interface TransitFact extends ReportFact<TransitEvidence> {
  primaryOwnerSection: TransitSectionKey;
  referencedNatalFactIds: string[];
}

export interface TransitSection {
  key: TransitSectionKey;
  title: string;
  text: string;
  facts: TransitFact[];
  primaryEvidence: TransitEvidence[];
  referencedFactIds: string[];
}

export interface WesternTransitReport {
  timeline: TransitTimeline;
  sections: TransitSection[];
  selectionOrder: readonly ["background", "trigger", "exact", "close", "active", "natal-fact", "structural-context", "technical"];
}
