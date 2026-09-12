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
  it("partner row without birth_place column preserves payload birthplace and midnight", () => {
    const partner = { ...base, birthInput: { ...base.birthInput, birthplace: "서울", hour: 0, minute: 0 }, westernLocation: { placeLabel: "Seoul", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul" } };
    const partnerRow = { id: partner.id, user_id: "u", name: "A", gender: "여", birth_date: "1989-02-16", birth_time: "00:00", calendar_type: "solar", memo: null, saju_payload: partner, created_at: partner.createdAt, updated_at: partner.updatedAt };
    const loaded = dbRowToRecord(partnerRow);
    expect(loaded.birthInput.birthplace).toBe("서울");
    expect(loaded.birthInput.hour).toBe(0);
    expect(loaded.birthInput.minute).toBe(0);
    expect(loaded.westernLocation).toEqual(partner.westernLocation);
  });
});
