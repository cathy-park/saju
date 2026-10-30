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
  logLevel: "silent",
  drop: ["console"],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: process.env.ZIWEI_ALIGN_LUNAR_YEAR
    ? [
        {
          name: "explicit-lunar-year-policy-scenario",
          setup(b) {
            b.onLoad({ filter: /\/ziwei\/lunarConvert\.ts$/ }, async (a) => ({
              loader: "ts",
              contents: (await fs.readFile(a.path, "utf8"))
                .replace(
                  "hanjaToStem(result.gapja.yearPillarHanja)",
                  "STEMS[((result.lunar.year - 1984) % 10 + 10) % 10]",
                )
                .replace(
                  "hanjaToBranch(result.gapja.yearPillarHanja)",
                  "BRANCHES[((result.lunar.year - 1984) % 12 + 12) % 12]",
                ),
            }));
          },
        },
      ]
    : [],
});
const e = await import(
  "data:text/javascript;base64," +
    Buffer.from(b.outputFiles[0].text).toString("base64")
);
const strategies = process.env.ZIWEI_ALIGN_LUNAR_YEAR
  ? ["default"]
  : ["default", "zhongzhou"];
const result = {
  version: "iztro@2.6.3",
  policies: {
    yearDivide: "normal (lunar-year)",
    dayDivide: "current (midnight)",
    fixLeap: false,
  },
  strategies: {},
  night: [],
  annualSamples: [],
};
const mapping = {
  ming: 0,
  shen: 0,
  bureau: 0,
  major: 0,
  minor: 0,
  mutagens: 0,
  decadals: 0,
};
const charDigit = { 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
for (const algorithm of strategies) {
  astro.config({ yearDivide: "normal", dayDivide: "current", algorithm });
  const out = { cases: 0, mismatchedCases: { ...mapping }, samples: {} };
  const note = (k, caseInfo, diff) => {
    out.mismatchedCases[k]++;
    out.samples[k] ??= [];
    if (out.samples[k].length < 6) out.samples[k].push({ caseInfo, diff });
  };
  for (let year = 1998; year <= 2007; year++)
    for (let month = 1; month <= 12; month++)
      for (const day of [1, 15, 29])
        for (let time = 0; time < 12; time++)
          for (const gender of ["남", "여"]) {
            const birth = {
              name: "synthetic",
              gender,
              calendarType: "lunar",
              year,
              month,
              day,
              hour: time * 2,
              minute: 0,
              timeUnknown: false,
            };
            let ours, other;
            try {
              ours = e.buildZiweiChart(birth, e.zhongzhouV1, [2024]);
              other = astro.byLunar(
                `${year}-${month}-${day}`,
                time,
                gender === "남" ? "男" : "女",
                false,
                false,
                "zh-TW",
              );
            } catch (error) {
              (out.errors ??= []).push({ birth, error: error.message });
              continue;
            }
            out.cases++;
            const c = { year, month, day, time, gender };
            if (ours.mingGong.branch !== other.earthlyBranchOfSoulPalace)
              note("ming", c, [
                ours.mingGong.branch,
                other.earthlyBranchOfSoulPalace,
              ]);
            if (ours.shenGong.branch !== other.earthlyBranchOfBodyPalace)
              note("shen", c, [
                ours.shenGong.branch,
                other.earthlyBranchOfBodyPalace,
              ]);
            const bureau = charDigit[other.fiveElementsClass.slice(1, 2)];
            if (ours.fiveElementBureau.number !== bureau)
              note("bureau", c, [
                ours.fiveElementBureau,
                other.fiveElementsClass,
              ]);
            const target = { major: {}, minor: {}, mutagens: {}, decadals: {} };
            for (const p of other.palaces) {
              for (const s of p.majorStars)
                target.major[s.name] = p.earthlyBranch;
              for (const s of [...p.minorStars, ...p.adjectiveStars])
                target.minor[s.name] = p.earthlyBranch;
              for (const s of [
                ...p.majorStars,
                ...p.minorStars,
                ...p.adjectiveStars,
              ])
                if (s.mutagen)
                  target.mutagens["化" + s.mutagen] = {
                    star: s.name,
                    branch: p.earthlyBranch,
                  };
              target.decadals[p.decadal.range.join("-")] = p.earthlyBranch;
            }
            const majorDiff = [],
              minorDiff = [];
            for (const p of ours.palaces) {
              for (const s of p.majorStars)
                if (target.major[s.name] !== p.branch)
                  majorDiff.push([s.name, p.branch, target.major[s.name]]);
              for (const s of p.minorStars)
                if (target.minor[s.name] !== p.branch)
                  minorDiff.push([s.name, p.branch, target.minor[s.name]]);
            }
            if (majorDiff.length) note("major", c, majorDiff);
            if (minorDiff.length) note("minor", c, minorDiff);
            const transforms = Object.fromEntries(
              Object.entries(ours.birthYearTransformations).map(([k, v]) => [
                k,
                {
                  star: v.star,
                  branch: ours.palaces.find((p) => p.palace === v.palace)
                    .branch,
                },
              ]),
            );
            if (
              JSON.stringify(Object.entries(transforms).sort()) !==
              JSON.stringify(Object.entries(target.mutagens).sort())
            )
              note("mutagens", c, [transforms, target.mutagens]);
            const majorPeriods = Object.fromEntries(
              ours.majorPeriods.map((p) => [p.ageRange.join("-"), p.branch]),
            );
            if (
              JSON.stringify(Object.entries(majorPeriods).sort()) !==
              JSON.stringify(Object.entries(target.decadals).sort())
            )
              note("decadals", c, [majorPeriods, target.decadals]);
          }
  result.strategies[algorithm] = out;
  console.log(
    algorithm,
    JSON.stringify({
      cases: out.cases,
      mismatchedCases: out.mismatchedCases,
      errors: out.errors?.length ?? 0,
    }),
  );
}
for (const dayDivide of ["current", "forward"]) {
  astro.config({ dayDivide, algorithm: "default", yearDivide: "normal" });
  for (const time of [0, 12]) {
    const a = astro.bySolar("2000-6-15", time, "女", false, "zh-TW");
    result.night.push({
      dayDivide,
      time,
      lunar: a.lunarDate,
      ming: a.earthlyBranchOfSoulPalace,
      ziwei: a.palaces.find((p) => p.majorStars.some((s) => s.name === "紫微"))
        .earthlyBranch,
    });
  }
}
astro.config({
  dayDivide: "current",
  algorithm: "default",
  yearDivide: "normal",
  horoscopeDivide: "normal",
});
const a = astro.byLunar("2000-5-14", 6, "女", false, false, "zh-TW");
for (const date of ["2024-1-1", "2024-2-4", "2024-2-10", "2024-6-15"]) {
  const h = a.horoscope(date, 6);
  result.annualSamples.push({
    date,
    yearly: h.yearly,
    age: h.age,
    decadal: h.decadal,
  });
}
await fs.writeFile(
  process.env.ZIWEI_RESULT_JSON ?? "/tmp/saju-independent-ziwei.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    { night: result.night, annualSamples: result.annualSamples },
    null,
    2,
  ),
);
