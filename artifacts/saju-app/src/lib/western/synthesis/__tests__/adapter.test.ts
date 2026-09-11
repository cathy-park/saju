import { describe, expect, it } from "vitest";
import { resolveWesternPersonalSynthesisForBirth, resolveWesternRelationshipSynthesisForBirths } from "../personAdapter.js";

const park = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
const hyunwook = { ...park, year: 1995, month: 3, day: 21, hour: 14, minute: 0 };

describe("synthesis birth adapters", () => {
  it("composes existing reports without changing their engines", () => {
    const query = { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul", referenceLocalDateTime: "2026-09-11T12:00:00" };
    const personal = resolveWesternPersonalSynthesisForBirth("park-soyeon", park, query);
    const relationship = resolveWesternRelationshipSynthesisForBirths({ personId: "park-soyeon", birth: park }, { personId: "hyunwook", birth: hyunwook }, query);
    expect(personal.ok && personal.report.schemaVersion).toBe("western-personal-synthesis/v1");
    expect(relationship.ok && relationship.report.schemaVersion).toBe("western-relationship-synthesis/v1");
    expect(relationship.ok && relationship.report.sections.find((section) => section.key === "currentFlow")!.facts.length).toBeGreaterThan(0);
  });

  it("preserves structured location errors", () => {
    const result = resolveWesternPersonalSynthesisForBirth("missing", { ...park, latitude: undefined }, undefined);
    expect(result).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });
});
