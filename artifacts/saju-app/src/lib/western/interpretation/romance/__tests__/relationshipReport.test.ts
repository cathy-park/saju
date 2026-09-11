import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../../natalChart.js";
import { buildWesternRelationshipReport } from "../report.js";

const result = calculateNatalChart({
  localDateTime: "1989-02-16T19:29:00", latitude: 37.4563,
  longitude: 126.7052, timezone: "Asia/Seoul",
});
if (!result.ok) throw new Error("Golden chart calculation failed");
const report = buildWesternRelationshipReport(result.chart);

describe("Western relationship report", () => {
  it("builds the seven requested sections and hides empty filler", () => {
    expect(report.sections.map((section) => section.key)).toEqual([
      "overview", "attraction", "affectionIntimacy", "relationshipNeeds",
      "conflictPatterns", "longTermPartner", "relationshipOperations",
    ]);
    expect(report.sections.every((section) => section.text.length > 0)).toBe(true);
  });

  it("assigns every raw placement, cusp, angle, and aspect to one primary owner", () => {
    const evidence = report.sections.flatMap((section) => section.primaryEvidence);
    expect(evidence.length).toBeGreaterThan(0);
    expect(new Set(evidence.map((item) => item.id)).size).toBe(evidence.length);
    for (const section of report.sections) {
      expect(section.primaryEvidence.every((item) => item.primaryOwnerSection === section.key)).toBe(true);
    }
  });

  it("uses overview and operations as fact references without recollecting raw evidence", () => {
    for (const key of ["overview", "relationshipOperations"] as const) {
      const section = report.sections.find((item) => item.key === key)!;
      expect(section.primaryEvidence).toEqual([]);
      expect(section.referencedFactIds.length).toBeGreaterThan(0);
      expect(section.facts.every((fact) => fact.evidence.length === 0)).toBe(true);
    }
  });

  it("never repeats one aspect under rewritten sentences", () => {
    const aspectIds = report.sections.flatMap((section) => section.primaryEvidence)
      .filter((item) => item.kind === "aspect").map((item) => item.id);
    expect(new Set(aspectIds).size).toBe(aspectIds.length);
    expect(aspectIds.filter((id) => id.includes("venus:mars") || id.includes("mars:venus"))).toHaveLength(1);
    expect(aspectIds.filter((id) => id.includes("saturn:neptune") || id.includes("neptune:saturn"))).toHaveLength(1);
  });

  it("uses traditional Jupiter as Pisces DSC primary ruler and Neptune only as co-ruler", () => {
    expect(report.rulership.seventh).toMatchObject({ sign: "Pisces", primaryRuler: "jupiter", coRulers: ["neptune"] });
    expect(report.rulership.fifth).toMatchObject({ sign: "Capricorn", primaryRuler: "saturn" });
    const longTerm = report.sections.find((section) => section.key === "longTermPartner")!;
    expect(longTerm.primaryEvidence.some((item) => item.id === "placement:jupiter")).toBe(true);
    expect(longTerm.primaryEvidence.some((item) => item.id === "placement:neptune" && item.role === "co-ruler")).toBe(true);
  });

  it("keeps technical labels in evidence and forbidden predictions out of main prose", () => {
    const main = report.sections.map((section) => section.text).join(" ");
    expect(main).not.toMatch(/Aquarius|Pisces|Capricorn|Taurus|\b\d{1,2}H\b|square|trine|opposition|conjunction|°/i);
    expect(main).not.toMatch(/외모|직업|재산|연봉/);
    expect(JSON.stringify(report)).not.toMatch(/romanceScore|compatibilityScore|personalityScore|weightedScore|totalScore/);
    const raw = report.sections.flatMap((section) => section.primaryEvidence.map((item) => item.label));
    expect(raw).toContain("Venus Aquarius 5H");
    expect(raw.some((label) => /Venus square Mars orb 0\.293°/.test(label))).toBe(true);
  });

  it("keeps synthesized sentences grammatically separated without repeated connectors", () => {
    const main = report.sections.map((section) => section.text).join(" ");
    expect(main).not.toMatch(/합니다 서로|함께[^.]{0,40}함께/);
  });
});
