import { describe, expect, it } from "vitest";
import { adaptBirthInputToWestern } from "../index";

describe("BirthInput western adapter", () => {
  it("adapts an explicitly resolved solar birth record", () => {
    expect(adaptBirthInputToWestern({
      name: "박소연", gender: "여", calendarType: "solar",
      year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false,
      latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul",
    })).toEqual({
      ok: true,
      input: {
        localDateTime: "1989-02-16T19:29:00",
        latitude: 37.4563,
        longitude: 126.7052,
        timezone: "Asia/Seoul",
      },
    });
  });

  it("does not guess missing coordinates or timezone", () => {
    expect(adaptBirthInputToWestern({
      name: "박소연", gender: "여", calendarType: "solar",
      year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false,
    })).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });

  it("rejects lunar dates and unknown birth times instead of silently converting them", () => {
    expect(adaptBirthInputToWestern({
      name: "A", gender: "여", calendarType: "lunar",
      year: 1989, month: 1, day: 11, hour: 19, minute: 29, timeUnknown: false,
      latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul",
    })).toMatchObject({ ok: false, errors: [{ code: "UNSUPPORTED_CALENDAR" }] });
    expect(adaptBirthInputToWestern({
      name: "A", gender: "여", calendarType: "solar",
      year: 1989, month: 2, day: 16, timeUnknown: true,
      latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul",
    })).toMatchObject({ ok: false, errors: [{ code: "MISSING_BIRTH_TIME" }] });
  });
});
