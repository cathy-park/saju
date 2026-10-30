import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(path.resolve("chatgpt-plugin/node_modules/esbuild"));
const { astro } = require(
  path.resolve(
    "scripts/independent-three-charts/oracle-node/node_modules/iztro",
  ),
);
const b = await build({
  entryPoints: ["scripts/independent-three-charts/engine-entry.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  drop: ["console"],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
});
const e = await import(
  "data:text/javascript;base64," +
    Buffer.from(b.outputFiles[0].text).toString("base64")
);
astro.config({
  yearDivide: "normal",
  dayDivide: "current",
  ageDivide: "normal",
  horoscopeDivide: "normal",
  algorithm: "default",
});
const ref = astro.byLunar("2000-5-14", 6, "女", false, false, "zh-TW");
const chart = e.buildZiweiChart(
  {
    gender: "여",
    calendarType: "lunar",
    year: 2000,
    month: 5,
    day: 14,
    hour: 12,
  },
  e.zhongzhouV1,
);
const rows = [];
for (const year of [2005, 2006, 2015, 2016, 2025, 2026, 2035, 2036]) {
  const age = year - chart.birth.year,
    period = chart.majorPeriods.find(
      (p) => age >= p.ageRange[0] && age <= p.ageRange[1],
    ),
    virtual = chart.majorPeriods.find(
      (p) => age + 1 >= p.ageRange[0] && age + 1 <= p.ageRange[1],
    ),
    independent = ref.horoscope(`${year}-6-15`, 6);
  rows.push({
    year,
    engineYearDifferenceAge: age,
    engineSelectedBranch: period?.branch ?? null,
    lunarYearInclusiveAgeScenario: age + 1,
    scenarioSelectedBranch: virtual?.branch ?? null,
    independentSelectedBranch: independent.decadal.earthlyBranch,
  });
}
await fs.writeFile(
  "scripts/independent-three-charts/results/timing-age-scenario.json",
  JSON.stringify(
    {
      policy:
        "normal lunar-year inclusive age versus current year difference, mid-year dates",
      rows,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(rows, null, 2));
