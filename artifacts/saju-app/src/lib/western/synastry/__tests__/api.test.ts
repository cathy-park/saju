import { describe, expect, it } from "vitest";
import handler from "../../../../../api/western-synastry";

const first = { personId: "park-soyeon", birth: { calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" } };
const second = { personId: "hyunwook", birth: { calendarType: "solar", year: 1995, month: 3, day: 21, hour: 14, minute: 0, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" } };
function response() { const state: { status?: number; body?: unknown } = {}; return { state, res: { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; } } }; }

describe("western synastry API", () => {
  it("returns a canonical pair report", async () => {
    const { state, res } = response(); await handler({ method: "POST", headers: {}, body: { first, second } }, res);
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ report: { pairId: "hyunwook~park-soyeon", schemaVersion: "western-synastry/v1" } });
  });
  it("preserves structured missing-time errors", async () => {
    const { state, res } = response(); await handler({ method: "POST", headers: {}, body: { first, second: { ...second, birth: { ...second.birth, timeUnknown: true } } } }, res);
    expect(state.status).toBe(422);
    expect(state.body).toMatchObject({ errors: [{ code: "MISSING_BIRTH_TIME" }] });
  });
});
