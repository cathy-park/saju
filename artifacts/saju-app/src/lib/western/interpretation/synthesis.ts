import type { ReportFact } from "@/lib/reportFacts";
import type { WesternEvidenceItem, WesternPersonalityFact } from "./types.js";

const clean = (text: string) => text.trim().replace(/[.!?]+$/, "");
const contrastive = (text: string) => {
  const value = clean(text);
  if (value.endsWith("입니다")) return `${value.slice(0, -3)}이지만`;
  if (value.endsWith("합니다")) return `${value.slice(0, -3)}하지만`;
  return `${value}지만`;
};
export function synthesizeWesternFacts(facts: ReportFact<WesternEvidenceItem>[]): string {
  if (facts.length === 0) return "";
  const typed = facts as WesternPersonalityFact[];
  for (let first = 0; first < typed.length; first++) for (let second = first + 1; second < typed.length; second++) {
    const a = typed[first].behavior, b = typed[second].behavior;
    if (!a || !b || a.axis !== b.axis || a.direction === b.direction) continue;
    const base = a.context === "default" ? typed[first] : b.context === "default" ? typed[second] : null;
    const context = base === typed[first] ? typed[second] : typed[first];
    if (base) return `기본적으로 ${contrastive(base.meaning)}, ${clean(context.meaning)}.`;
  }
  return typed.map((fact) => `${clean(fact.meaning)}.`).join(" ");
}
