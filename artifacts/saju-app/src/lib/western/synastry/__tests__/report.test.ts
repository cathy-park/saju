import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { buildWesternSynastryReport } from "../report.js";

const a = calculateNatalChart({ localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
const b = calculateNatalChart({ localDateTime: "1995-03-21T14:00:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
if (!a.ok || !b.ok) throw new Error("golden charts failed");
const A = { personId: "park-soyeon", chart: a.chart }, B = { personId: "hyunwook", chart: b.chart };

describe("synastry report", () => {
  const report = buildWesternSynastryReport(A, B);

  it("uses planet roles rather than hard/soft aspect type for ownership", () => {
    const sunMoon = report.evidence.crossAspects.find((item) => item.points.some((point) => point.pointId === "sun") && item.points.some((point) => point.pointId === "moon"));
    const venusMars = report.evidence.crossAspects.find((item) => item.points.some((point) => point.pointId === "venus") && item.points.some((point) => point.pointId === "mars"));
    const marsMars = report.evidence.crossAspects.find((item) => item.points.every((point) => point.pointId === "mars"));
    expect(sunMoon).toMatchObject({ type: "square", primaryOwnerSection: "emotionalSecurity" });
    expect(venusMars).toMatchObject({ primaryOwnerSection: "intimacyDesire" });
    expect(marsMars).toMatchObject({ primaryOwnerSection: "conflictPatterns" });
  });

  it("owns every raw evidence once and keeps overview reference-only", () => {
    const primary = report.sections.flatMap((section) => section.primaryEvidence.map((item) => item.id));
    expect(new Set(primary).size).toBe(primary.length);
    const overview = report.sections.find((section) => section.key === "overview")!;
    expect(overview.primaryEvidence).toEqual([]);
    expect(overview.referencedFactIds.length).toBeGreaterThan(0);
  });

  it("uses traditional seventh rulers and only explicit core planets", () => {
    expect(report.rulership).toMatchObject({
      [A.personId]: { sign: "Pisces", primaryRuler: "jupiter" },
      [B.personId]: { sign: "Aquarius", primaryRuler: "saturn", coRulers: ["uranus"] },
    });
    expect(report.rulerLinks.every((link) => ["sun", "moon", "mercury", "venus", "mars"].includes(link.targetPointId))).toBe(true);
    expect(report.rulerLinks.some((link) => link.rulerRole === "primary" && link.rulerPersonId === A.personId)).toBe(true);
    expect(report.rulerLinks.some((link) => link.rulerRole === "primary" && link.rulerPersonId === B.personId)).toBe(true);
  });

  it("preserves symmetric facts and directional evidence under input reversal", () => {
    const reversed = buildWesternSynastryReport(B, A);
    expect(report.pairId).toBe(reversed.pairId);
    expect(report.evidence.crossAspects.map((item) => item.id).sort()).toEqual(reversed.evidence.crossAspects.map((item) => item.id).sort());
    expect(report.evidence.overlays.map((item) => item.id).sort()).toEqual(reversed.evidence.overlays.map((item) => item.id).sort());
    expect(report.sections.map((section) => section.facts.map((fact) => fact.id).sort())).toEqual(reversed.sections.map((section) => section.facts.map((fact) => fact.id).sort()));
  });

  it("produces all eight sections without a compatibility score or event prediction", () => {
    expect(report.sections.map((section) => section.key)).toEqual(["overview", "attraction", "emotionalSecurity", "communication", "intimacyDesire", "conflictPatterns", "longTerm", "operations"]);
    expect("score" in report).toBe(false);
    expect(report.sections.map((section) => section.text).join(" ")).not.toMatch(/결혼 성공|결혼 실패|운명적 상대|배우자감/);
  });

  it("renders natural deterministic Korean instead of role-label concatenation", () => {
    const text = report.sections.map((section) => section.text).join(" ");
    expect(text).not.toMatch(/가치이|대화과|변화과|경계을|기대을|두 사람의 .+과 .+이 실제 상호작용/);
    expect(text).toContain("호감을 표현하는 방식과 욕구를 행동으로 옮기는 방식");
  });
});
