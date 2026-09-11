import { describe, expect, it } from "vitest";
import { resolveWesternRelationshipForBirth } from "../personAdapter.js";

describe("Western relationship birth adapter", () => {
  it("preserves the structured missing-location boundary", () => {
    const result = resolveWesternRelationshipForBirth({ calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false });
    expect(result).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });
});
