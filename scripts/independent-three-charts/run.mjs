import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(path.resolve("chatgpt-plugin/node_modules/esbuild"));
const bundle = await build({
  entryPoints: ["scripts/independent-three-charts/engine-entry.ts"],
  write: false,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
  drop: ["console"],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "audit-private-term-function",
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
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const ref = JSON.parse(
  await fs.readFile(
    process.env.ORACLE_JSON ?? "/tmp/saju-independent-oracles.json",
    "utf8",
  ),
);
const reverse =
  process.env.LUNAR_ADAPTER === "checked"
    ? e.lunarToSolarChecked
    : e.lunarToSolar;
const angular = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const result = {
  reference: ref.reference,
  planetary: {
    cases: ref.astronomy.length,
    comparisons: 0,
    maxLongitudeArcsec: {},
    maxLatitudeArcsec: {},
    over60Arcsec: [],
    maxDailySpeedDifference: {},
  },
  houses: {
    cases: ref.houses.length,
    availableBoth: 0,
    unavailableBoth: 0,
    availabilityMismatch: [],
    maxCuspDegrees: 0,
    maxAscendantDegrees: 0,
    maxMidheavenDegrees: 0,
    overPoint01Degrees: [],
  },
  eot: {
    cases: ref.eot.length,
    maxRawErrorMinutes: 0,
    maxRoundedErrorMinutes: 0,
    over1Minute: 0,
    overHalfMinute: 0,
    worst: null,
  },
  solarTerms: {
    cases: ref.solarTerms.length,
    monthBoundaryCases: 0,
    maxTermDifferenceMinutes: 0,
    worst: null,
    instantPillarChanges: 0,
    instantMonthExpectedChangesMissing: [],
    instantYearExpectedChangesMissing: [],
  },
  lunar: {
    cases: ref.lunar.length,
    mismatches: 0,
    errors: 0,
    leapDays: 0,
    leapRoundTrips: 0,
    reverseErrors: 0,
    reverseMismatches: 0,
    dayPillarMismatches: 0,
    reverseSamples: [],
    samples: [],
  },
  stations: { cases: ref.stations.length, signMismatch: [], maxSpeedError: 0 },
};
for (const r of ref.astronomy)
  for (const [body, p] of Object.entries(r.points)) {
    const a = e.calculatePlanet(body, new Date(r.iso));
    const lon = angular(a.longitude, p.longitude) * 3600,
      lat = Math.abs(a.latitude - p.latitude) * 3600;
    result.planetary.comparisons++;
    result.planetary.maxLongitudeArcsec[body] = Math.max(
      result.planetary.maxLongitudeArcsec[body] ?? 0,
      lon,
    );
    result.planetary.maxLatitudeArcsec[body] = Math.max(
      result.planetary.maxLatitudeArcsec[body] ?? 0,
      lat,
    );
    result.planetary.maxDailySpeedDifference[body] = Math.max(
      result.planetary.maxDailySpeedDifference[body] ?? 0,
      Math.abs(a.speedLongitude - p.speedLongitude),
    );
    if (lon > 60 || lat > 60)
      result.planetary.over60Arcsec.push({ body, iso: r.iso, lon, lat });
  }
for (const r of ref.houses) {
  const angles = e.calculateAngles(new Date(r.iso), r.latitude, r.longitude),
    cusps = e.calculatePlacidusCusps(
      angles.ascendant,
      angles.midheaven,
      r.latitude,
      angles.obliquity,
    );
  if (!r.ok && !cusps) {
    result.houses.unavailableBoth++;
    continue;
  }
  if (r.ok !== !!cusps) {
    result.houses.availabilityMismatch.push({
      iso: r.iso,
      latitude: r.latitude,
      longitude: r.longitude,
      reference: r.ok,
      engine: !!cusps,
    });
    continue;
  }
  result.houses.availableBoth++;
  const max = Math.max(...cusps.map((x, i) => angular(x, r.cusps[i])));
  result.houses.maxCuspDegrees = Math.max(result.houses.maxCuspDegrees, max);
  result.houses.maxAscendantDegrees = Math.max(
    result.houses.maxAscendantDegrees,
    angular(angles.ascendant, r.ascendant),
  );
  result.houses.maxMidheavenDegrees = Math.max(
    result.houses.maxMidheavenDegrees,
    angular(angles.midheaven, r.midheaven),
  );
  if (max > 0.01)
    result.houses.overPoint01Degrees.push({
      iso: r.iso,
      latitude: r.latitude,
      longitude: r.longitude,
      max,
    });
}
for (const r of ref.eot) {
  const a = e.equationOfTimeMins(r.year, r.month, r.day),
    raw = Math.abs(a - r.referenceMinutes),
    rounded = Math.abs(Math.round(a) - r.referenceMinutes);
  if (raw > result.eot.maxRawErrorMinutes) {
    result.eot.maxRawErrorMinutes = raw;
    result.eot.worst = { ...r, engineMinutes: a };
  }
  result.eot.maxRoundedErrorMinutes = Math.max(
    result.eot.maxRoundedErrorMinutes,
    rounded,
  );
  if (raw > 1) result.eot.over1Minute++;
  if (raw > 0.5) result.eot.overHalfMinute++;
}
for (const r of ref.solarTerms) {
  if (r.longitude % 30 !== 15) continue;
  result.solarTerms.monthBoundaryCases++;
  const actual = e.findSolarTermDate(r.year, r.longitude),
    diff = Math.abs(Date.parse(r.iso) - actual.getTime()) / 60000;
  if (diff > result.solarTerms.maxTermDifferenceMinutes) {
    result.solarTerms.maxTermDifferenceMinutes = diff;
    result.solarTerms.worst = {
      ...r,
      engine: actual.toISOString(),
      differenceMinutes: diff,
    };
  }
  const inputs = [-60000, 60000].map((offset) => {
    const d = new Date(Date.parse(r.iso) + offset + 9 * 3600000);
    return {
      name: "synthetic",
      gender: "여",
      calendarType: "solar",
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      timeUnknown: false,
      longitude: 135,
    };
  });
  const [a, b] = inputs.map((input) =>
    e.calculateProfileFromBirth(input, { localMeridianOn: false }),
  );
  if (a.computedPillars.month.hangul !== b.computedPillars.month.hangul)
    result.solarTerms.instantPillarChanges++;
  else
    result.solarTerms.instantMonthExpectedChangesMissing.push({
      year: r.year,
      longitude: r.longitude,
      iso: r.iso,
      pillar: a.computedPillars.month.hangul,
    });
  if (
    r.longitude === 315 &&
    a.computedPillars.year.hangul === b.computedPillars.year.hangul
  )
    result.solarTerms.instantYearExpectedChangesMissing.push({
      year: r.year,
      iso: r.iso,
      pillar: a.computedPillars.year.hangul,
    });
}
for (const r of ref.lunar) {
  try {
    const conversion = e.solarToLunar(...r.solar);
    const a = conversion.lunar;
    const wantedDay = r.gapja.match(/(\S{2})日/)[1];
    if (conversion.gapja.dayPillarHanja !== wantedDay)
      result.lunar.dayPillarMismatches++;
    const got = [a.year, a.month, a.day, a.isLeapMonth];
    if (JSON.stringify(got) !== JSON.stringify(r.lunar)) {
      result.lunar.mismatches++;
      if (result.lunar.samples.length < 8)
        result.lunar.samples.push({ ...r, engine: got });
    }
    try {
      const back = reverse(...r.lunar).solar;
      if ([back.year, back.month, back.day].join(",") !== r.solar.join(","))
        result.lunar.reverseMismatches++;
    } catch (error) {
      result.lunar.reverseErrors++;
      if (result.lunar.reverseSamples.length < 6)
        result.lunar.reverseSamples.push({ ...r, error: error.message });
    }
    if (r.lunar[3]) {
      result.lunar.leapDays++;
      if (r.lunar[2] === 1) {
        const a = reverse(...r.lunar).solar;
        if ([a.year, a.month, a.day].join(",") === r.solar.join(","))
          result.lunar.leapRoundTrips++;
      }
    }
  } catch (error) {
    result.lunar.errors++;
    if (result.lunar.samples.length < 8)
      result.lunar.samples.push({ ...r, error: error.message });
  }
}
for (const r of ref.stations) {
  const a = e.calculatePlanet(r.body, new Date(r.iso)),
    error = Math.abs(a.speedLongitude - r.reference.speedLongitude);
  result.stations.maxSpeedError = Math.max(
    result.stations.maxSpeedError,
    error,
  );
  if (a.speedLongitude < 0 !== r.reference.speedLongitude < 0)
    result.stations.signMismatch.push({ ...r, engineSpeed: a.speedLongitude });
}
await fs.writeFile(
  process.env.RESULT_JSON ?? "/tmp/saju-independent-baseline.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    {
      planetary: result.planetary,
      houses: {
        ...result.houses,
        overPoint01Degrees: result.houses.overPoint01Degrees.slice(0, 5),
        availabilityMismatch: result.houses.availabilityMismatch.slice(0, 5),
      },
      eot: result.eot,
      solarTerms: {
        ...result.solarTerms,
        instantMonthExpectedChangesMissing:
          result.solarTerms.instantMonthExpectedChangesMissing.length,
        instantYearExpectedChangesMissing:
          result.solarTerms.instantYearExpectedChangesMissing.length,
      },
      lunar: result.lunar,
      stations: {
        ...result.stations,
        signMismatch: result.stations.signMismatch.slice(0, 5),
        signMismatchCount: result.stations.signMismatch.length,
      },
    },
    null,
    2,
  ),
);
