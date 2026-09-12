import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { buildWesternTransitReport } from "../report.js";
import { presentTransitFactId, presentTransitSection } from "../presentation.js";

const result = calculateNatalChart({ localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
if (!result.ok) throw new Error("golden natal chart failed");

describe("western transit report", () => {
  const report = buildWesternTransitReport(result.chart, { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul" });

  it("gives every raw transit event exactly one primary owner", () => {
    const owned = report.sections.flatMap((section) => section.primaryEvidence.map((evidence) => [evidence.eventId, section.key] as const));
    expect(new Set(owned.map(([id]) => id)).size).toBe(owned.length);
    expect(owned.every(([id, owner]) => report.timeline.events.find((event) => event.id === id)?.primaryOwnerSection === owner)).toBe(true);
    expect(report.timeline.events.every((event) => event.primaryOwnerSection)).toBe(true);
    expect(report.timeline.events.every((event) => (event as typeof event & { natalLink?: unknown }).natalLink)).toBe(true);
  });

  it("makes overview a deterministic summary without raw evidence", () => {
    const overview = report.sections.find((section) => section.key === "overview")!;
    expect(overview.primaryEvidence).toEqual([]);
    expect(overview.referencedFactIds.length).toBeGreaterThan(0);
  });

  it("uses categorical ordering and keeps standalone fast transits from dominating", () => {
    expect(report.selectionOrder).toEqual(["background", "trigger", "exact", "close", "active", "natal-fact", "structural-context", "technical"]);
    const detailEvidence = report.sections.filter((section) => section.key !== "overview").flatMap((section) => section.primaryEvidence);
    expect(detailEvidence.filter((evidence) => evidence.role === "trigger").length).toBeLessThanOrEqual(detailEvidence.filter((evidence) => evidence.role === "background").length);
    expect("score" in report).toBe(false);
  });

  it("falls back from known natal facts to deterministic structural context", () => {
    const evidence = report.sections.flatMap((section) => section.primaryEvidence);
    expect(evidence.some((item) => item.natalLink.kind === "natal-fact")).toBe(true);
    expect(evidence.some((item) => item.natalLink.kind === "structural-context" && item.natalLink.context?.house)).toBe(true);
  });

  it("presents actual transit roles as user language without internal activation wording", () => {
    const relationship = report.sections.find((section) => section.key === "emotionalRelationships")!;
    const text = presentTransitSection(report, relationship);
    expect(text).toMatch(/관계에서 원하는 만족과 애정 표현|정서적 안정|이상과 현실의 경계/);
    expect(text).not.toMatch(/timing activation|기존 차트에서 확인된|구조를 건드립니다/);
    expect(presentTransitFactId("transit-fact:transit:v1:jupiter:venus:opposition:cycle-1")).toContain("관계에서 원하는 만족과 애정 표현");
  });
});
