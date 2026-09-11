import { describe, expect, it } from "vitest";
import type { ReportFact } from "@/lib/reportFacts";
import { calculateNatalChart } from "../../natalChart";
import {
  buildWesternPersonalityReport,
  synthesizeWesternFacts,
  type WesternEvidenceItem,
  type WesternPersonalityFact,
} from "../index";

const result = calculateNatalChart({
  localDateTime: "1989-02-16T19:29:00",
  latitude: 37.4563,
  longitude: 126.7052,
  timezone: "Asia/Seoul",
});
if (!result.ok) throw new Error("Golden chart calculation failed");
const report = buildWesternPersonalityReport(result.chart);

describe("Western personality fact layer", () => {
  it("builds the seven requested sections without filler", () => {
    expect(report.sections.map((section) => section.key)).toEqual([
      "atAGlance", "coreNature", "emotionalInner", "thinkingCommunication",
      "actionDrive", "strengths", "cautions",
    ]);
    for (const section of report.sections) {
      expect(section.facts.length).toBeGreaterThan(0);
      expect(section.facts.length).toBeLessThanOrEqual(4);
      expect(section.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps technical astrology labels in evidence, not main prose", () => {
    const main = report.sections.map((section) => section.text).join(" ");
    expect(main).not.toMatch(/Aquarius|Cancer|Virgo|Taurus|Capricorn|Scorpio|\b\d{1,2}H\b|square|trine|opposition|conjunction|sextile|°/i);
    const evidence = report.sections.flatMap((section) => section.evidence.map((item) => item.label));
    expect(evidence.some((label) => label.includes("Sun Aquarius 6H"))).toBe(true);
    expect(evidence.some((label) => /Venus square Mars orb 0\.293°/.test(label))).toBe(true);
  });

  it("prioritizes actual close aspects and never invents a numeric personality score", () => {
    expect(report).not.toHaveProperty("score");
    expect(JSON.stringify(report)).not.toMatch(/personalityScore|weightedScore|totalScore/);
    const aspectEvidence = report.sections.flatMap((section) => section.evidence)
      .filter((item) => item.kind === "aspect");
    expect(aspectEvidence.some((item) => item.orbBand === "exact")).toBe(true);
    expect(aspectEvidence.every((item) => item.orbBand === "exact" || item.orbBand === "close" || item.orbBand === "supporting")).toBe(true);
  });

  it("does not count one aspect more than once in chart emphasis", () => {
    const emphasizedSources = report.emphasis.flatMap((item) => item.sourceEvidenceIds);
    expect(new Set(emphasizedSources).size).toBe(emphasizedSources.length);
    expect(emphasizedSources.every((id) => !id.startsWith("aspect:"))).toBe(true);
  });

  it("does not repeat the same fact or raw evidence within a section", () => {
    for (const section of report.sections) {
      expect(new Set(section.facts.map((fact) => fact.id)).size).toBe(section.facts.length);
      expect(new Set(section.evidence.map((item) => item.id)).size).toBe(section.evidence.length);
    }
  });

  it("does not reuse one placement or aspect as independent evidence across sections", () => {
    const rawIds = report.sections.flatMap((section) => section.evidence)
      .filter((item) => item.kind === "placement" || item.kind === "aspect")
      .map((item) => item.id);
    expect(new Set(rawIds).size).toBe(rawIds.length);
  });
});

describe("evidence-gated contrast synthesis", () => {
  const evidence: WesternEvidenceItem = { id: "placement:test", kind: "placement", label: "test", sourcePointIds: ["sun"] };
  const fact = (id: string, meaning: string, direction?: "expand" | "contain"): WesternPersonalityFact => ({
    id, domain: "test", meaning, polarity: "neutral", strength: 1, evidence: [evidence],
    ...(direction ? { behavior: { axis: "pace", direction, context: direction === "expand" ? "default" : "context" } } : {}),
  });

  it("uses a contrast only for facts with opposite directions on the same behavior axis", () => {
    expect(synthesizeWesternFacts([fact("a", "범위를 넓혀 움직입니다", "expand"), fact("b", "책임이 걸리면 범위를 좁혀 점검합니다", "contain")]))
      .toBe("기본적으로 범위를 넓혀 움직이지만, 책임이 걸리면 범위를 좁혀 점검합니다.");
  });

  it("does not infer an inner/outer conflict from unrelated neutral facts", () => {
    const facts: ReportFact<WesternEvidenceItem>[] = [fact("a", "새 관점을 찾습니다"), fact("b", "익숙한 리듬을 지킵니다")];
    expect(synthesizeWesternFacts(facts)).not.toMatch(/겉|속|하지만/);
  });
});
