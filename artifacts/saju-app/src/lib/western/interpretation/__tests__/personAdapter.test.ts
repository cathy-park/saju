import { describe, expect, it } from "vitest";
import { resolveWesternPersonalityForBirth } from "../personAdapter";

describe("western personality person adapter", () => {
  it("returns MISSING_LOCATION_CONTEXT when stored birth data has no coordinates/timezone", () => {
    expect(resolveWesternPersonalityForBirth({
      name: "일반 사용자", gender: "여", calendarType: "solar",
      year: 1990, month: 1, day: 1, hour: 12, minute: 0, timeUnknown: false,
    })).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });

  it("uses explicit stored location context without injecting fixture defaults", () => {
    const resolved = resolveWesternPersonalityForBirth({
      name: "박소연", gender: "여", calendarType: "solar",
      year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false,
      latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul",
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.report.chart.normalizedBirth).toMatchObject({ latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
  });
});
