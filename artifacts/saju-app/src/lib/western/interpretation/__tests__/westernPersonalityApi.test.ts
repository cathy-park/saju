import { describe, expect, it } from "vitest";
import handler from "../../../../../api/western-personality";

function response() {
  const state: { status?: number; body?: unknown } = {};
  return { state, res: { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; } } };
}

describe("western personality API", () => {
  it("returns a structured location error instead of guessing", async () => {
    const { state, res } = response();
    await handler({ method: "POST", headers: {}, body: { calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false } }, res);
    expect(state.status).toBe(422);
    expect(state.body).toMatchObject({ errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });

  it("rejects unsupported methods", async () => {
    const { state, res } = response();
    await handler({ method: "GET", headers: {} }, res);
    expect(state.status).toBe(405);
  });
});
