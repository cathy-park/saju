import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(path.resolve("chatgpt-plugin/node_modules/esbuild"));
const common = {
  entryPoints: ["scripts/independent-three-charts/engine-entry.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  drop: ["console"],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
};
async function load(candidate) {
  const b = await build({
    ...common,
    plugins: [
      {
        name: "compare-baseline-and-candidate",
        setup(b) {
          b.onLoad(
            { filter: /\/(interpretSchema|sajuPipeline)\.ts$/ },
            async (a) => {
              let s = candidate
                ? await fs.readFile(a.path, "utf8")
                : execFileSync(
                    "git",
                    [
                      "show",
                      "db39ddb1d59fbd5fcba3f89de08831f138cc701a:" +
                        path.relative(process.cwd(), a.path),
                    ],
                    { encoding: "utf8" },
                  );
              if (candidate && a.path.endsWith("/interpretSchema.ts"))
                s = s
                  .replace(
                    "  for (const s of allStems) {\n    if (s === dayStem) continue;\n    const sEl",
                    "  const supportingStems = [...allStems];\n  const dayIndex = supportingStems.indexOf(dayStem);\n  if(dayIndex>=0)supportingStems.splice(dayIndex,1);\n  for (const s of supportingStems) {\n    const sEl",
                  )
                  .replace("    if (wc >= oc) {", "    if (wc <= oc) {");
              if (candidate && a.path.endsWith("/sajuPipeline.ts"))
                s = s.replace(
                  "for (let j = 0; j < hiddens.length; j++) {",
                  "for (let j = 0; j < hiddens.length - 1; j++) {",
                );
              if (a.path.endsWith("/sajuPipeline.ts"))
                s += "\nexport {computeBaseStructure};";
              return { contents: s, loader: "ts" };
            },
          );
        },
      },
    ],
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(b.outputFiles[0].text).toString("base64")
  );
}

const [e, c] = await Promise.all([load(false), load(true)]);
const result = {
  scope:
    "documented implementation invariants; not empirical fortune validation",
  baselineExamples: {},
  candidateExamples: {},
  impact: {
    cases: 0,
    scoreChanged: 0,
    levelChanged: 0,
    primaryYongshinChanged: 0,
    secondaryYongshinChanged: 0,
    maxAbsoluteScoreChange: 0,
    examples: [],
  },
};
for (const [name, x] of [
  ["baselineExamples", e],
  ["candidateExamples", c],
]) {
  result[name].onePeer = x.computeStrengthResult(
    "갑",
    "인",
    ["갑", "갑"],
    ["인"],
  );
  result[name].noPeer = x.computeStrengthResult("갑", "인", ["갑"], ["인"]);
  result[name].scarcerWealth = x.computeYongshinFull("갑", "태강", {
    목: 1,
    화: 4,
    토: 1,
    금: 1,
    수: 1,
  });
  result[name].scarcerOutput = x.computeYongshinFull("갑", "태강", {
    목: 1,
    화: 1,
    토: 4,
    금: 1,
    수: 1,
  });
  result[name].twoStemMain = x.computeBaseStructure({
    dayStem: "갑",
    monthBranch: "자",
    allStems: ["갑"],
    allBranches: ["자"],
    effectiveFiveElements: { 목: 1, 화: 0, 토: 0, 금: 0, 수: 1 },
    gender: "여",
  });
}
for (let i = 0; i < 10000; i++) {
  const d = new Date(Date.UTC(1901, 0, 1) + i * 5 * 86400000),
    birth = {
      name: "synthetic",
      gender: i % 2 ? "남" : "여",
      calendarType: "solar",
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: i % 24,
      minute: (i * 7) % 60,
      timeUnknown: false,
      longitude: 127,
    };
  const p = e.calculateProfileFromBirth(birth);
  const { year, month, day, hour } = p.computedPillars;
  const input = {
    dayStem: day.hangul[0],
    monthBranch: month.hangul[1],
    allStems: [year.hangul[0], month.hangul[0], day.hangul[0], hour.hangul[0]],
    allBranches: [
      year.hangul[1],
      month.hangul[1],
      day.hangul[1],
      hour.hangul[1],
    ],
    effectiveFiveElements: p.fiveElementDistribution,
    gender: birth.gender,
  };
  const a = e.computeBaseStructure(input),
    b = c.computeBaseStructure(input),
    r = result.impact;
  r.cases++;
  if (a.strengthScore !== b.strengthScore) r.scoreChanged++;
  if (a.strengthLevel !== b.strengthLevel) r.levelChanged++;
  if (a.yongshinResult.primary !== b.yongshinResult.primary)
    r.primaryYongshinChanged++;
  if (a.yongshinResult.secondary !== b.yongshinResult.secondary)
    r.secondaryYongshinChanged++;
  r.maxAbsoluteScoreChange = Math.max(
    r.maxAbsoluteScoreChange,
    Math.abs(a.strengthScore - b.strengthScore),
  );
  if (
    r.examples.length < 8 &&
    (a.strengthLevel !== b.strengthLevel ||
      a.yongshinResult.primary !== b.yongshinResult.primary)
  )
    r.examples.push({
      birth,
      baseline: {
        score: a.strengthScore,
        level: a.strengthLevel,
        yongshin: a.yongshinResult,
      },
      candidate: {
        score: b.strengthScore,
        level: b.strengthLevel,
        yongshin: b.yongshinResult,
      },
    });
}
await fs.writeFile(
  "/tmp/saju-independent-strength.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    {
      baselinePeerDifference:
        result.baselineExamples.onePeer.score -
        result.baselineExamples.noPeer.score,
      candidatePeerDifference:
        result.candidateExamples.onePeer.score -
        result.candidateExamples.noPeer.score,
      baselineScarce: result.baselineExamples.scarcerWealth,
      candidateScarce: result.candidateExamples.scarcerWealth,
      impact: result.impact,
    },
    null,
    2,
  ),
);
