import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { buildWesternPersonalityReport } from "../../interpretation/report.js";
import { buildWesternRelationshipReport } from "../../interpretation/romance/report.js";
import { buildWesternTransitReport } from "../../transit/report.js";
import { buildWesternSynastryReport } from "../../synastry/report.js";
import { buildWesternPersonalSynthesis, buildWesternRelationshipSynthesis } from "../index.js";
import { adaptWesternRelationship } from "@/lib/integrated/adapters";
import { buildIntegratedRelationshipReport } from "@/lib/integrated/report";
import { areasForScope } from "@/lib/integrated/areas";
import { evidenceForArea, systemsForArea } from "@/lib/integrated/presentation";

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

  // 대표 지시 — production 버그(박소연×조용민 궁합에서 Western synastry가 "available system"
  // 으로는 표시되지만 실제 카드/근거에는 전혀 안 나오는 문제) 회귀 테스트. mars-venus 등 4개
  // preferred pattern은 대표성이 높을 때만 우선 채택하는 기준이고, 그 조합이 없는 커플까지
  // synastry evidence "없음" 취급하면 안 된다.
  describe("relationship synastry evidence selection", () => {
    it("A. keeps using the preferred pattern's own evidence when it exists (park × hyunwook)", () => {
      const synastry = buildWesternSynastryReport({ personId: "park-soyeon", chart: park }, { personId: "hyunwook", chart: hyunwook });
      const first = { personId: "park-soyeon", personality, romance };
      const second = { personId: "hyunwook", personality: buildWesternPersonalityReport(hyunwook), romance: buildWesternRelationshipReport(hyunwook) };
      const report = buildWesternRelationshipSynthesis({ first, second, synastry });
      const preferred: Record<string, RegExp> = {
        attractionIntimacy: /mars.*venus|venus.*mars/,
        emotionalCommunication: /mercury.*moon|moon.*mercury/,
        conflictAdjustment: /mars.*mars/,
        longTerm: /saturn.*mars|mars.*saturn/,
      };
      for (const [owner, pattern] of Object.entries(preferred)) {
        const section = report.sections.find((item) => item.key === owner)!;
        const synastryRefs = section.facts.flatMap((fact) => fact.sourceRefs).filter((ref) => ref.module === "synastry");
        expect(synastryRefs.length).toBeGreaterThan(0);
        expect(synastryRefs.every((ref) => pattern.test(ref.factId))).toBe(true);
      }
    });

    it("B. falls back to the domain's actual evidence-bearing fact when no preferred pattern exists (박소연×조용민, production regression fixture)", () => {
      const chartAt = (localDateTime: string, latitude: number, longitude: number) => {
        const result = calculateNatalChart({ localDateTime, latitude, longitude, timezone: "Asia/Seoul" });
        if (!result.ok) throw new Error("production regression chart failed");
        return result.chart;
      };
      const parkSoyeon = chartAt("1989-02-16T19:29:00", 37.456, 126.7052);
      const yongmin = chartAt("1987-11-24T01:20:00", 37.5666791, 126.9782914);
      const synastry = buildWesternSynastryReport({ personId: "park-soyeon", chart: parkSoyeon }, { personId: "yongmin", chart: yongmin });
      const preferred = [/mars.*venus|venus.*mars/, /mercury.*moon|moon.*mercury/, /mars.*mars/, /saturn.*mars|mars.*saturn/];
      const rawSynastryFacts = synastry.sections.filter((s) => s.key !== "overview" && s.key !== "operations").flatMap((s) => s.facts.filter((f) => f.evidence.length > 0));
      expect(rawSynastryFacts.some((fact) => preferred.some((pattern) => pattern.test(fact.id)))).toBe(false); // 전제 확인: 이 커플에는 preferred pattern이 실제로 없다.
      expect(rawSynastryFacts.length).toBeGreaterThan(0); // 그런데도 evidence 있는 synastry fact 자체는 존재한다.

      const first = { personId: "park-soyeon", personality: buildWesternPersonalityReport(parkSoyeon), romance: buildWesternRelationshipReport(parkSoyeon) };
      const second = { personId: "yongmin", personality: buildWesternPersonalityReport(yongmin), romance: buildWesternRelationshipReport(yongmin) };
      const report = buildWesternRelationshipSynthesis({ first, second, synastry });

      // Western relationship synthesis가 비어 있지 않아야 한다 — 근거가 있는 도메인(attraction/
      // emotionalCommunication/longTerm; conflictPatterns는 이 커플 자체에 evidence가 0이라
      // 제외)마다 synastry-module evidence가 실제로 채워진다.
      const withSynastryEvidence = ["attractionIntimacy", "emotionalCommunication", "longTerm"].map((owner) => {
        const section = report.sections.find((item) => item.key === owner)!;
        return section.facts.flatMap((fact) => fact.sourceRefs).filter((ref) => ref.module === "synastry");
      });
      expect(withSynastryEvidence.every((refs) => refs.length > 0)).toBe(true);
      // 근거가 아예 없는 conflictPatterns 도메인까지 억지로 채우지는 않는다(조작 금지).
      const conflictSection = report.sections.find((item) => item.key === "conflictAdjustment")!;
      expect(conflictSection.facts.flatMap((fact) => fact.sourceRefs).some((ref) => ref.module === "synastry")).toBe(false);

      // integrated relationship 리포트까지 이어서, Western이 화면(IntegratedReportView)이 실제로
      // 쓰는 presentation 헬퍼(systemsForArea/evidenceForArea — standaloneFacts까지 포함해서
      // source chip·"왜 이렇게 보나요" 근거를 만드는 함수들)에서 실제로 나타나는지 확인한다.
      // 단일 체계(western만)라도 buildFacts()의 2체계 합의 요건 때문에 standaloneFacts로
      // 빠질 수 있는데, presentation 헬퍼는 그 standaloneFacts까지 읽으므로 이게 실제 production
      // UI 반영 여부를 정확히 반영하는 검증이다.
      const sources = adaptWesternRelationship(report);
      const integrated = buildIntegratedRelationshipReport({ pairId: "park-soyeon~yongmin", sources });
      expect(integrated.availableSystems).toContain("western");
      const westernInStandalone = integrated.standaloneFacts.filter((fact) => fact.system === "western");
      expect(westernInStandalone.length).toBeGreaterThan(0);
      // 자미두수는 individual-context, Western synastry는 direct dyadic evidence로 유지돼야 한다.
      expect(westernInStandalone.every((fact) => fact.evidenceRole === "dyadic-evidence")).toBe(true);

      const relationshipAreaKeys = areasForScope("relationship").map((area) => area.key);
      const systemsAcrossAreas = new Set(relationshipAreaKeys.flatMap((key) => systemsForArea(integrated, key)));
      expect(systemsAcrossAreas.has("western")).toBe(true); // source chip에 서양점성술이 실제로 뜬다.
      const evidenceAcrossAreas = relationshipAreaKeys.flatMap((key) => evidenceForArea(integrated, key));
      expect(evidenceAcrossAreas.some((item) => item.system === "western")).toBe(true); // "왜 이렇게 보나요"에도 뜬다.
    });
  });
});
