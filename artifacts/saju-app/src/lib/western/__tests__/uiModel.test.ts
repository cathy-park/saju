import { describe, expect, it } from "vitest";
import type { PersonRecord } from "../../storage";
import { monthFromSearch, monthRange, nowLocalDateTime, shiftMonth, validateWesternLocation, westernBirthSource, westernRoutes } from "../uiModel";

const person = (westernLocation?: PersonRecord["westernLocation"]): PersonRecord => ({
  id: "person-a",
  birthInput: { name: "A", gender: "여", calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, longitude: 127 },
  profile: {} as PersonRecord["profile"],
  westernLocation,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("western UI model", () => {
  it("uses only explicit Western location context", () => {
    expect(westernBirthSource(person())).toMatchObject({ latitude: undefined, longitude: undefined, timezone: undefined });
    expect(westernBirthSource(person({ placeLabel: "Incheon", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" }))).toMatchObject({ latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
  });

  it("keeps canonical personal and relationship routes separate", () => {
    expect(westernRoutes.personal("a").overview).toBe("/western/a/overview");
    expect(westernRoutes.relationship("a", "b").details).toBe("/western/a/synastry/b/details");
  });

  it("preserves a valid month query and rejects invalid values", () => {
    expect(monthFromSearch("?month=2026-09", "2026-08")).toBe("2026-09");
    expect(monthFromSearch("?month=2026-13", "2026-08")).toBe("2026-08");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });

  it("resolves the current instant to an offset-free local wall time (no hardcoded date)", () => {
    const fixed = new Date("2026-09-12T15:30:05Z"); // KST = UTC+9 → 2026-09-13T00:30:05
    expect(nowLocalDateTime("Asia/Seoul", fixed)).toBe("2026-09-13T00:30:05");
    expect(nowLocalDateTime("America/New_York", fixed)).toBe("2026-09-12T11:30:05");
  });

  it("validates exact coordinates and an IANA timezone without guessing", () => {
    expect(validateWesternLocation({ placeLabel: "Incheon", latitude: 37.4, longitude: 126.7, timezone: "Asia/Seoul" })).toBeNull();
    expect(validateWesternLocation({ placeLabel: "Incheon", latitude: 91, longitude: 126.7, timezone: "Asia/Seoul" })).toContain("위도");
    expect(validateWesternLocation({ placeLabel: "Incheon", latitude: 37.4, longitude: 126.7, timezone: "Seoul" })).toContain("IANA");
  });
});
