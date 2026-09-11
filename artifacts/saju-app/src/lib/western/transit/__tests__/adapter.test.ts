import { describe, expect, it } from "vitest";
import { resolveWesternTransitForBirth } from "../personAdapter.js";

const query = { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul" };

describe("western transit person adapter", () => {
  it("returns structured missing location context without guessing", () => {
    const result = resolveWesternTransitForBirth({ calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false }, query);
    expect(result).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });

  it("builds a report for an explicitly located birth", () => {
    const result = resolveWesternTransitForBirth({ calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" }, query);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.timeline.events.length).toBeGreaterThan(0);
  });
});
