import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { solarToLunar } from "@fullstackfamily/manseryeok";
const source = await readFile(
  new URL("../dist/server/index.js", import.meta.url),
  "utf8",
);
const { default: worker } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const birth = {
  birthDate: "2000-06-15",
  birthTime: "19:29",
  birthplace: "서울",
  calendar: "solar",
  gender: "여",
};
async function rpc(name, args = {}, auth = true) {
  const response = await worker.fetch(
    new Request("https://synthetic.invalid/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { "oai-authenticated-user-id": "synthetic-test-only" } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  return { status: response.status, body: await response.json() };
}
test("every bundled snapshot input matches the current app source and provenance hash", async () => {
  const provenance = JSON.parse(
    await readFile(
      new URL("../engine-source/provenance.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(provenance.files.length >= 85);
  for (const file of provenance.files) {
    const original = await readFile(
      new URL(`../../artifacts/saju-app/src/lib/${file.path}`, import.meta.url),
    );
    const snapshot = await readFile(
      new URL(`../engine-source/${file.path}`, import.meta.url),
    );
    assert.deepEqual(snapshot, original, file.path);
    assert.equal(
      createHash("sha256").update(snapshot).digest("hex"),
      file.sha256,
      file.path,
    );
  }
});
test("MCP authentication boundary unchanged", async () =>
  assert.equal((await rpc("three_charts_status", {}, false)).status, 401));
test("candidate identity is visible without birth data", async () => {
  const r = await rpc("three_charts_status");
  assert.equal(r.body.result.structuredContent.version, "0.2.0-candidate");
});
test("real bundled API preserves existing keys and exposes per-system audit in text and structured response", async () => {
  const r = await rpc("calculate_three_charts", birth);
  assert.equal(r.status, 200);
  assert.equal(r.body.result.isError, false);
  const value = r.body.result.structuredContent;
  for (const key of [
    "schemaVersion",
    "status",
    "algorithm",
    "warnings",
    "input",
    "solarDate",
    "lunarDate",
    "saju",
    "ziwei",
    "western",
    "integrated",
    "instructions",
  ])
    assert.ok(key in value, key);
  assert.equal(value.saju.timeAudit.basis, "local-mean");
  assert.deepEqual(value.saju.timeAudit, value.timeAudit.saju);
  assert.equal(value.timeAudit.ziwei.basis, "original-civil");
  assert.equal(value.timeAudit.western.utcInstant, "2000-06-15T10:29:00.000Z");
  assert.equal(
    value.western.chart.normalizedBirth.utcInstant,
    value.timeAudit.western.utcInstant,
  );
  assert.deepEqual(JSON.parse(r.body.result.content[0].text), value);
  assert.ok(
    value.warnings.includes(
      "WESTERN_EPHEMERIS_HOUSES_NOT_INDEPENDENTLY_VALIDATED",
    ),
  );
});
test("API date rollover changes only the saju effective clock", async () => {
  const r = await rpc("calculate_three_charts", {
    ...birth,
    birthTime: "00:05",
  });
  const value = r.body.result.structuredContent;
  assert.equal(r.body.result.isError, false);
  assert.equal(value.solarDate.day, 15);
  assert.equal(value.saju.timeAudit.effectiveSolarDateTime.day, 14);
  assert.equal(value.timeAudit.ziwei.longitudeCorrectionApplied, false);
  assert.equal(value.timeAudit.western.utcInstant, "2000-06-14T15:05:00.000Z");
});
test("ordinary lunar API input uses converted solar date and original civil clock for western chart", async () => {
  const lunar = solarToLunar(2000, 6, 15).lunar;
  assert.equal(lunar.isLeapMonth, false);
  const birthDate = [
    lunar.year,
    String(lunar.month).padStart(2, "0"),
    String(lunar.day).padStart(2, "0"),
  ].join("-");
  const r = await rpc("calculate_three_charts", {
    ...birth,
    calendar: "lunar",
    birthDate,
  });
  const value = r.body.result.structuredContent;
  assert.equal(r.body.result.isError, false);
  assert.deepEqual(value.solarDate, { year: 2000, month: 6, day: 15 });
  assert.equal(value.timeAudit.western.utcInstant, "2000-06-15T10:29:00.000Z");
});
for (const [title, patch, code] of [
  ["invalid solar date", { birthDate: "2001-02-29" }, "INVALID_DATE"],
  ["invalid hour", { birthTime: "24:00" }, "TIME_REQUIRED"],
  [
    "unsupported leap month",
    { calendar: "lunar", leapMonth: true },
    "LEAP_MONTH_UNSUPPORTED",
  ],
  ["missing place", { birthplace: "" }, "INVALID_PLACE"],
  ["ambiguous place", { birthplace: "중구" }, "LOCATION_REQUIRED"],
  [
    "unsupported foreign saju/ziwei timezone",
    {
      latitude: 40,
      longitude: -74,
      timezone: "America/New_York",
      birthplace: "synthetic overseas",
    },
    "SAJU_ZIWEI_TIMEZONE_UNSUPPORTED",
  ],
  [
    "historic Korean DST",
    { birthDate: "1988-06-15" },
    "SAJU_ZIWEI_TIMEZONE_UNSUPPORTED",
  ],
  [
    "nonexistent DST time",
    {
      birthDate: "2000-04-02",
      birthTime: "02:30",
      latitude: 40,
      longitude: -74,
      timezone: "America/New_York",
      birthplace: "synthetic overseas",
    },
    "NONEXISTENT_LOCAL_TIME",
  ],
  [
    "ambiguous DST time",
    {
      birthDate: "2000-10-29",
      birthTime: "01:30",
      latitude: 40,
      longitude: -74,
      timezone: "America/New_York",
      birthplace: "synthetic overseas",
    },
    "AMBIGUOUS_LOCAL_TIME",
  ],
])
  test(title, async () => {
    const r = await rpc("calculate_three_charts", { ...birth, ...patch });
    assert.equal(r.body.result.isError, true);
    assert.equal(r.body.result.structuredContent.error.code, code);
  });
