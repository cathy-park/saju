import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { calculateTransitSnapshot, calculateTransitTimeline } from "../timeline.js";

const natalResult = calculateNatalChart({
  localDateTime: "1989-02-16T19:29:00",
  latitude: 37.4563,
  longitude: 126.7052,
  timezone: "Asia/Seoul",
});
if (!natalResult.ok) throw new Error("golden natal chart failed");
const natal = natalResult.chart;

describe("western transit timeline", () => {
  it("calculates the fixed golden instant against natal points and angles", () => {
    const snapshot = calculateTransitSnapshot(natal, "2026-09-11T12:00:00", "Asia/Seoul");
    expect(snapshot.utcInstant).toBe("2026-09-11T03:00:00.000Z");
    expect(snapshot.points.find((point) => point.id === "jupiter")).toMatchObject({ longitude: expect.closeTo(135.787845, 5), natalHouse: 11 });
    expect(snapshot.activations).toEqual(expect.arrayContaining([
      expect.objectContaining({ transitPointId: "jupiter", natalTargetId: "venus", type: "opposition", orb: expect.closeTo(0.127, 3), applying: true }),
      expect.objectContaining({ transitPointId: "saturn", natalTargetId: "midheaven", type: "sextile", orb: expect.closeTo(1.188, 3), applying: true }),
    ]));
  });

  it("returns a window already active at the query boundary", () => {
    const result = calculateTransitTimeline(natal, { startLocalDate: "2026-09-11", endLocalDate: "2026-09-11", timezone: "Asia/Seoul" });
    const event = result.events.find((item) => item.transitPointId === "jupiter" && item.natalTargetId === "venus" && item.type === "opposition");
    expect(event).toBeDefined();
    expect(event!.windowStart < result.query.startUtcInstant).toBe(true);
    expect(event!.activeAtQueryStart).toBe(true);
    expect(event!.exactHits.length).toBeGreaterThan(0);
    expect(event!.windowEnd).toBeTruthy();
  });

  it("uses the same event identity for day, month, and multi-month queries", () => {
    const ranges = [["2026-09-11", "2026-09-11"], ["2026-09-01", "2026-09-30"], ["2026-08-01", "2026-11-30"]] as const;
    const ids = ranges.map(([startLocalDate, endLocalDate]) => calculateTransitTimeline(natal, { startLocalDate, endLocalDate, timezone: "Asia/Seoul" }).events
      .find((item) => item.transitPointId === "jupiter" && item.natalTargetId === "venus" && item.type === "opposition")?.id);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(1);
  });

  it("does not miss Moon ingress, exact hit, or egress inside one day", () => {
    const result = calculateTransitTimeline(natal, { startLocalDate: "2026-09-11", endLocalDate: "2026-09-11", timezone: "Asia/Seoul" });
    const moonEvents = result.events.filter((event) => event.transitPointId === "moon" && event.exactHits.length > 0);
    expect(moonEvents.length).toBeGreaterThan(0);
    expect(moonEvents.every((event) => event.windowStart < event.exactHits[0] && event.exactHits.at(-1)! < event.windowEnd!)).toBe(true);
  });

  it("groups retrograde exact hits that remain inside one orb window", () => {
    const result = calculateTransitTimeline(natal, { startLocalDate: "2026-01-01", endLocalDate: "2026-12-31", timezone: "Asia/Seoul" });
    const multiHit = result.events.find((event) => event.exactHits.length > 1);
    expect(multiHit).toBeDefined();
    expect(new Set(multiHit!.exactHits).size).toBe(multiHit!.exactHits.length);
    expect(multiHit!.exactHits.every((hit) => hit > multiHit!.windowStart && hit < multiHit!.windowEnd)).toBe(true);
  }, 30_000);
});
