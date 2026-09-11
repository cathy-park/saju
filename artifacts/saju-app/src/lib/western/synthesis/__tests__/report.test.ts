import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { buildWesternPersonalityReport } from "../../interpretation/report.js";
import { buildWesternRelationshipReport } from "../../interpretation/romance/report.js";
import { buildWesternTransitReport } from "../../transit/report.js";
import { buildWesternSynastryReport } from "../../synastry/report.js";
import { buildWesternPersonalSynthesis, buildWesternRelationshipSynthesis } from "../index.js";

const chart = (localDateTime: string) => {
  const result = calculateNatalChart({ localDateTime, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
  if (!result.ok) throw new Error("golden chart failed");
  return result.chart;
};
const park = chart("1989-02-16T19:29:00"), hyunwook = chart("1995-03-21T14:00:00");
const personality = buildWesternPersonalityReport(park), romance = buildWesternRelationshipReport(park);
const transit = buildWesternTransitReport(park, { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul", referenceLocalDateTime: "2026-09-11T12:00:00" });
const approvedTransit = /neptune:uranus:square|saturn:midheaven:sextile|jupiter:pluto:square|jupiter:venus:opposition|jupiter:mars:square|saturn:neptune:square|mercury:mercury:trine|venus:mercury:square/;

describe("western comprehensive synthesis", () => {
  it("separates relation kind from timing activation and excludes summary facts", () => {
    const report = buildWesternPersonalSynthesis({ personId: "park-soyeon", personality, romance, transit });
    const details = report.sections.filter((section) => section.key !== "overview").flatMap((section) => section.facts);
    expect(new Set(details.map((fact) => fact.relationKind).filter(Boolean))).toEqual(new Set(["consensus", "complement", "tension"]));
    expect(details.some((fact) => fact.timing.active && fact.relationKind)).toBe(true);
    expect(details.flatMap((fact) => fact.sourceRefs).map((ref) => ref.factId)).not.toContain("relationship:overview");
    expect(details.flatMap((fact) => fact.sourceRefs).map((ref) => ref.factId)).not.toContain("relationship:operations");
    expect(report.sections.find((section) => section.key === "overview")?.primarySourceRefs).toEqual([]);
  });

  it("uses only the approved September golden transit family", () => {
    const report = buildWesternPersonalSynthesis({ personId: "park-soyeon", personality, romance, transit });
    const ids = report.sections.flatMap((section) => section.facts.flatMap((fact) => fact.timing.transitFactIds));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => /neptune:uranus:square|saturn:midheaven:sextile|jupiter:pluto:square|jupiter:venus:opposition|jupiter:mars:square|saturn:neptune:square|mercury:mercury:trine|venus:mercury:square/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(8);
    expect(ids.join(" ")).not.toMatch(/saturn:moon|mars:mars/);
  });

  it("builds a separate symmetric relationship synthesis without raw evidence duplication", () => {
    const synastry = buildWesternSynastryReport({ personId: "park-soyeon", chart: park }, { personId: "hyunwook", chart: hyunwook });
    const first = { personId: "park-soyeon", personality, romance };
    const second = { personId: "hyunwook", personality: buildWesternPersonalityReport(hyunwook), romance: buildWesternRelationshipReport(hyunwook) };
    const direct = buildWesternRelationshipSynthesis({ first, second, synastry });
    const reversed = buildWesternRelationshipSynthesis({ first: second, second: first, synastry });
    expect(direct.pairId).toBe(reversed.pairId);
    expect(direct.sections.map((section) => section.facts.map((fact) => fact.id))).toEqual(reversed.sections.map((section) => section.facts.map((fact) => fact.id)));
    expect(direct.sections).toHaveLength(6);
    expect(direct.sections.find((section) => section.key === "overview")?.primarySourceRefs).toEqual([]);
    const raw = direct.sections.flatMap((section) => section.primarySourceRefs.flatMap((ref) => ref.ultimateEvidenceIds));
    expect(new Set(raw).size).toBe(raw.length);
  });

  it("includes personal transit in relationship flow only through an actual synastry natal link", () => {
    const synastry = buildWesternSynastryReport({ personId: "park-soyeon", chart: park }, { personId: "hyunwook", chart: hyunwook });
    const first = { personId: "park-soyeon", personality, romance, transit };
    const second = { personId: "hyunwook", personality: buildWesternPersonalityReport(hyunwook), romance: buildWesternRelationshipReport(hyunwook) };
    const report = buildWesternRelationshipSynthesis({ first, second, synastry });
    const current = report.sections.find((section) => section.key === "currentFlow")!;
    expect(current.facts.length).toBeGreaterThan(0);
    expect(current.facts.every((fact) => fact.timing.active && fact.timing.activatedSynthesisFactIds?.length)).toBe(true);
    expect(current.facts.flatMap((fact) => fact.sourceRefs).every((ref) => ref.module === "transit")).toBe(true);
  });
});
