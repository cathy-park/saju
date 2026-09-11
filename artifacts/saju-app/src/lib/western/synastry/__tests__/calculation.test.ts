import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../../natalChart.js";
import { calculateSynastryEvidence } from "../calculation.js";
import { resolveSynastryOrb } from "../rules.js";

const aResult = calculateNatalChart({ localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
const bResult = calculateNatalChart({ localDateTime: "1995-03-21T14:00:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
if (!aResult.ok || !bResult.ok) throw new Error("golden charts failed");
const A = { personId: "park-soyeon", chart: aResult.chart }, B = { personId: "hyunwook", chart: bResult.chart };

describe("synastry calculation", () => {
  it("resolves overlapping planet orb rules through one deterministic precedence", () => {
    expect(resolveSynastryOrb("venus", "saturn", "square")).toBe(4);
    expect(resolveSynastryOrb("moon", "pluto", "trine")).toBe(3);
    expect(resolveSynastryOrb("mars", "uranus", "opposition")).toBe(3);
    expect(resolveSynastryOrb("moon", "venus", "sextile")).toBe(4);
    expect(resolveSynastryOrb("moon", "venus", "square")).toBe(6);
  });

  it("keeps cross-aspect identity and orb symmetric when inputs are reversed", () => {
    const forward = calculateSynastryEvidence(A, B), reverse = calculateSynastryEvidence(B, A);
    expect(forward.crossAspects.map((item) => item.id).sort()).toEqual(reverse.crossAspects.map((item) => item.id).sort());
    const moonMercury = forward.crossAspects.find((item) => item.points.some((point) => point.personId === A.personId && point.pointId === "moon") && item.points.some((point) => point.personId === B.personId && point.pointId === "mercury"));
    expect(moonMercury).toMatchObject({ type: "trine", orb: expect.closeTo(0.632, 3) });
  });

  it("preserves directional overlay identity when arguments are reversed", () => {
    const forward = calculateSynastryEvidence(A, B), reverse = calculateSynastryEvidence(B, A);
    expect(forward.overlays.map((item) => item.id).sort()).toEqual(reverse.overlays.map((item) => item.id).sort());
    expect(forward.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePersonId: A.personId, sourcePointId: "sun", targetPersonId: B.personId, targetHouse: 8 }),
      expect.objectContaining({ sourcePersonId: A.personId, sourcePointId: "venus", targetPersonId: B.personId, targetHouse: 7 }),
      expect.objectContaining({ sourcePersonId: B.personId, sourcePointId: "sun", targetPersonId: A.personId, targetHouse: 7 }),
      expect.objectContaining({ sourcePersonId: B.personId, sourcePointId: "neptune", targetPersonId: A.personId, targetHouse: 5 }),
    ]));
  });

  it("includes fourth-house overlays without treating all houses as relevant", () => {
    const fourth = B.chart.houses.find((house) => house.number === 4)!.cuspLongitude;
    const fifth = B.chart.houses.find((house) => house.number === 5)!.cuspLongitude;
    const longitude = fourth < fifth ? (fourth + fifth) / 2 : ((fourth + fifth + 360) / 2) % 360;
    const changedA = { ...A, chart: { ...A.chart, points: A.chart.points.map((point) => point.id === "moon" ? { ...point, longitude } : point) } };
    expect(calculateSynastryEvidence(changedA, B).overlays).toContainEqual(expect.objectContaining({ sourcePersonId: A.personId, sourcePointId: "moon", targetPersonId: B.personId, targetHouse: 4 }));
  });

  it("calculates directional ASC DSC and MC aspects", () => {
    const evidence = calculateSynastryEvidence(A, B);
    expect(evidence.angleAspects).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePersonId: A.personId, sourcePointId: "mercury", targetPersonId: B.personId, targetAngleId: "descendant", type: "conjunction", orb: expect.closeTo(1.886, 3) }),
      expect.objectContaining({ sourcePersonId: B.personId, sourcePointId: "saturn", targetPersonId: A.personId, targetAngleId: "descendant", type: "conjunction", orb: expect.closeTo(2.911, 3) }),
    ]));
  });
});
