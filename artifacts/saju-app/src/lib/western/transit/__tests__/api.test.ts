import { describe, expect, it } from "vitest";
import handler from "../../../../../api/western-transit";

function response() {
  const state: { status?: number; body?: unknown } = {};
  return { state, res: { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; } } };
}

describe("western transit API", () => {
  it("returns the structured adapter error", async () => {
    const { state, res } = response();
    await handler({ method: "POST", headers: {}, body: { birth: { calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false }, query: { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul" } } }, res);
    expect(state.status).toBe(422);
    expect(state.body).toMatchObject({ errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });
});
