import type { ReportFact } from "@/lib/reportFacts";
import type { PlanetId, WesternNatalChart, WesternPointId } from "../types.js";
import type { OrbBand } from "./rules/aspectRules.js";

export interface WesternEvidenceItem {
  id: string;
  kind: "placement" | "angle" | "aspect" | "emphasis";
  label: string;
  sourcePointIds: WesternPointId[];
  orbBand?: OrbBand;
}

export interface WesternPersonalityFact extends ReportFact<WesternEvidenceItem> {
  concepts?: string[];
  behavior?: { axis: string; direction: "expand" | "contain"; context: "default" | "context" };
}

export type WesternSectionKey = "atAGlance" | "coreNature" | "emotionalInner" | "thinkingCommunication" | "actionDrive" | "strengths" | "cautions";
export interface WesternPersonalitySection { key: WesternSectionKey; title: string; text: string; facts: WesternPersonalityFact[]; evidence: WesternEvidenceItem[]; }
export interface WesternChartEmphasis { id: string; meaning: string; sourceEvidenceIds: string[]; }
export interface WesternPersonalityReport { chart: WesternNatalChart; sections: WesternPersonalitySection[]; emphasis: WesternChartEmphasis[]; }

export const PLANET_LABEL: Record<PlanetId, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
};
