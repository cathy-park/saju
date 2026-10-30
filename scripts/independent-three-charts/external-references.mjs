import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(path.resolve("chatgpt-plugin/node_modules/esbuild"));
const b = await build({
  entryPoints: ["scripts/independent-three-charts/engine-entry.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  drop: ["console"],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "audit-private-term",
      setup(b) {
        b.onLoad({ filter: /\/luckCycles\.ts$/ }, async (a) => ({
          contents:
            (await fs.readFile(a.path, "utf8")) +
            "\nexport {findSolarTermDate};",
          loader: "ts",
        }));
      },
    },
  ],
});
const e = await import(
  "data:text/javascript;base64," +
    Buffer.from(b.outputFiles[0].text).toString("base64")
);
const r = { horizons: [], hko: [], midnight: [] };
const rows = JSON.parse(
  await fs.readFile("/tmp/saju-horizons-reference.json", "utf8"),
);
const body = { 10: "sun", 301: "moon", 199: "mercury" };
for (const row of rows) {
  const data = row.data.result
    .split("$$SOE")[1]
    .split("$$EOE")[0]
    .trim()
    .split("\n");
  for (const line of data) {
    const x = line.trim().split(",");
    const jd = +x[0],
      lon = +x[3],
      lat = +x[4],
      date = new Date((jd - 2440587.5) * 86400000),
      actual = e.calculatePlanet(body[row.body], date);
    r.horizons.push({
      body: body[row.body],
      jd,
      date: date.toISOString(),
      referenceLongitude: lon,
      referenceLatitude: lat,
      longitudeErrorArcsec:
        Math.abs(((actual.longitude - lon + 540) % 360) - 180) * 3600,
      latitudeErrorArcsec: Math.abs(actual.latitude - lat) * 3600,
    });
  }
}
// HKO's published 2024 Hong Kong (UTC+8) minute-resolution instants.
for (const [lon, iso] of [
  [0, "2024-03-20T03:06:00Z"],
  [90, "2024-06-20T20:51:00Z"],
  [180, "2024-09-22T12:44:00Z"],
  [270, "2024-12-21T09:21:00Z"],
]) {
  const actual = e.findSolarTermDate(2024, lon);
  r.hko.push({
    longitude: lon,
    publishedUTC: iso,
    engineUTC: actual.toISOString(),
    absoluteDifferenceSeconds:
      Math.abs(actual.getTime() - Date.parse(iso)) / 1000,
    publishedResolutionSeconds: 60,
  });
}
for (const [day, hour, minute] of [
  [15, 22, 59],
  [15, 23, 0],
  [15, 23, 59],
  [16, 0, 0],
]) {
  const p = e.calculateProfileFromBirth(
    {
      name: "synthetic",
      gender: "여",
      calendarType: "solar",
      year: 2000,
      month: 6,
      day,
      hour,
      minute,
      timeUnknown: false,
      longitude: 135,
    },
    { localMeridianOn: false },
  );
  const z = e.buildZiweiChart(
    { gender: "여", calendarType: "solar", year: 2000, month: 6, day, hour },
    e.zhongzhouV1,
  );
  r.midnight.push({
    day,
    hour,
    minute,
    dayPillar: p.computedPillars.day.hangul,
    hourPillar: p.computedPillars.hour.hangul,
    lunarDay: z.lunarBirth.day,
    hourBranch: z.lunarBirth.hourBranch,
  });
}
const intra = JSON.parse(
  await fs.readFile("/tmp/saju-independent-eot-intraday.json", "utf8"),
);
r.eotIntraday = {
  cases: intra.length,
  maxRawErrorMinutes: 0,
  maxRoundedErrorMinutes: 0,
  maxInstantRawErrorMinutes: 0,
  maxInstantRoundedErrorMinutes: 0,
  worst: null,
};
for (const x of intra) {
  const instant = e.equationOfTimeMins(
    x.year,
    x.month,
    x.day,
    Math.floor(x.kstHour),
    Math.round((x.kstHour % 1) * 60),
  );
  r.eotIntraday.maxInstantRawErrorMinutes = Math.max(
    r.eotIntraday.maxInstantRawErrorMinutes,
    Math.abs(instant - x.referenceMinutes),
  );
  r.eotIntraday.maxInstantRoundedErrorMinutes = Math.max(
    r.eotIntraday.maxInstantRoundedErrorMinutes,
    Math.abs(Math.round(instant) - x.referenceMinutes),
  );
  const actual = e.equationOfTimeMins(x.year, x.month, x.day),
    raw = Math.abs(actual - x.referenceMinutes),
    rounded = Math.abs(Math.round(actual) - x.referenceMinutes);
  if (raw > r.eotIntraday.maxRawErrorMinutes) {
    r.eotIntraday.maxRawErrorMinutes = raw;
    r.eotIntraday.worst = x;
  }
  r.eotIntraday.maxRoundedErrorMinutes = Math.max(
    r.eotIntraday.maxRoundedErrorMinutes,
    rounded,
  );
}
await fs.writeFile(
  "/tmp/saju-independent-external.json",
  JSON.stringify(r, null, 2),
);
console.log(JSON.stringify(r, null, 2));
