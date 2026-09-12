import { describe, expect, it } from "vitest";
import { dbRowToRecord } from "../db";
import type { PersonRecord } from "../storage";

function row(payload: PersonRecord) {
  return { id: payload.id, user_id: "u", name: payload.birthInput.name, gender: payload.birthInput.gender, birth_date: "1989-02-16", birth_time: "19:29", calendar_type: "solar", birth_place: "legacy label", saju_payload: payload, created_at: payload.createdAt, updated_at: payload.updatedAt };
}

const base = { id: "p", birthInput: { name: "A", gender: "여", calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false }, profile: { computedPillars: {}, fiveElementDistribution: {}, solarDate: {}, rawResult: {} } as unknown as PersonRecord["profile"], createdAt: "2026-01-01", updatedAt: "2026-01-01" } satisfies PersonRecord;

describe("westernLocation JSON persistence", () => {
  it("loads legacy payloads without Western location", () => expect(dbRowToRecord(row(base)).westernLocation).toBeUndefined());
  it("round-trips explicit Western location in saju_payload", () => {
    const location = { placeLabel: "Incheon", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul", resolver: { provider: "manual-exact-input", version: "1" } };
    expect(dbRowToRecord(row({ ...base, westernLocation: location })).westernLocation).toEqual(location);
  });
});
