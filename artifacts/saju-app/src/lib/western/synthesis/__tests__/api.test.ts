import { describe, expect, it } from "vitest";
import personalHandler from "../../../../../api/western-overview.js";
import relationshipHandler from "../../../../../api/western-relationship-overview.js";

const birth = { calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
const response = () => { const state: { code?: number; body?: unknown } = {}; return { state, res: { status(code: number) { state.code = code; return this; }, json(body: unknown) { state.body = body; } } }; };

describe("western synthesis APIs", () => {
  it("returns personal and relationship comprehensive reports", async () => {
    const personal = response();
    await personalHandler({ method: "POST", headers: {}, body: { personId: "park", birth, query: { startLocalDate: "2026-09-01", endLocalDate: "2026-09-30", timezone: "Asia/Seoul" } } }, personal.res);
    expect(personal.state).toMatchObject({ code: 200, body: { report: { schemaVersion: "western-personal-synthesis/v1" } } });
    const relationship = response();
    await relationshipHandler({ method: "POST", headers: {}, body: { first: { personId: "park", birth }, second: { personId: "hyun", birth: { ...birth, year: 1995, month: 3, day: 21, hour: 14, minute: 0 } } } }, relationship.res);
    expect(relationship.state).toMatchObject({ code: 200, body: { report: { schemaVersion: "western-relationship-synthesis/v1" } } });
  });
});
