import { describe, expect, it } from "vitest";
import { resolveWesternSynastryForBirths } from "../personAdapter.js";

const located = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };

describe("synastry person adapter", () => {
  it("does not invent angles houses or rulers for unknown birth time", () => {
    const result = resolveWesternSynastryForBirths({ personId: "a", birth: located }, { personId: "b", birth: { ...located, timeUnknown: true } });
    expect(result).toMatchObject({ ok: false, errors: [{ code: "MISSING_BIRTH_TIME" }] });
  });
});
