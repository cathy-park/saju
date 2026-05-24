/**
 * 박소연 케이스(1989-02-16 19:29 여) 기준 엔진 일관성 검증 리포트.
 * 계산 엔진은 수정하지 않고 buildEngineConsistencyReport만 실행합니다.
 */

import { computeSajuPipeline } from "../../artifacts/saju-app/src/lib/sajuPipeline";
import { countFiveElements, type ComputedPillars, type FiveElementCount } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { calculateLuckCycles, type DaewoonSuOpts } from "../../artifacts/saju-app/src/lib/luckCycles";
import type { FiveElKey } from "../../artifacts/saju-app/src/lib/element-color";
import { getController } from "../../artifacts/saju-app/src/lib/element-color";
import {
  buildEngineConsistencyReport,
  formatEngineConsistencyReportMarkdown,
} from "../../artifacts/saju-app/src/lib/evaluations/engineConsistencyReport";

const JZG: Record<string, string[]> = {
  자: ["임", "계"], 축: ["계", "신", "기"], 인: ["무", "병", "갑"], 묘: ["갑", "을"],
  진: ["을", "계", "무"], 사: ["무", "경", "병"], 오: ["병", "기", "정"], 미: ["정", "을", "기"],
  신: ["무", "임", "경"], 유: ["경", "신"], 술: ["신", "정", "무"], 해: ["무", "갑", "임"],
};
const JZG_W = [0.05, 0.12, 0.00] as const;
const STEM_EL: Record<string, FiveElKey> = {
  갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수",
};

function augmentForYongshin(base: FiveElementCount, branches: string[]): FiveElementCount {
  const result: FiveElementCount = { ...base };
  for (const b of branches) {
    const h = JZG[b] ?? [];
    for (let j = 0; j < h.length; j++) {
      const w = JZG_W[Math.min(j, JZG_W.length - 1)];
      if (w === 0) continue;
      const el = STEM_EL[h[j]];
      if (el) result[el] = (result[el] ?? 0) + w;
    }
  }
  return result;
}

const pillars: ComputedPillars = {
  year: { hangul: "기사", hanja: "" },
  month: { hangul: "병인", hanja: "" },
  day: { hangul: "정미", hanja: "" },
  hour: { hangul: "기유", hanja: "" },
};

const birthInput = {
  gender: "여" as const,
  year: 1989,
  month: 2,
  day: 16,
  hour: 19,
  minute: 29,
  calendarType: "solar" as const,
  timeUnknown: false,
  longitude: 127,
};

const allStems = ["기", "정", "병", "기"];
const allBranches = ["유", "미", "인", "사"];
const fe = countFiveElements(pillars);
const aug = augmentForYongshin(fe, allBranches);

const daewoonSuOpts: DaewoonSuOpts = {
  exactSolarTermBoundaryOn: true,
  trueSolarTimeOn: false,
};
const luckCycles = calculateLuckCycles(birthInput, pillars, daewoonSuOpts);
const y = new Date().getFullYear();
const age = y - birthInput.year;
const dw0 = luckCycles.daewoon[0]?.startAge ?? 0;
const adjustedDw = luckCycles.daewoon.map((entry, i) => ({
  ...entry,
  startAge: dw0 + i * 10,
  endAge: dw0 + i * 10 + 9,
}));
const curDw = adjustedDw.find((e) => age >= e.startAge && age <= e.endAge);
const seunEntry = luckCycles.seun.find((e) => e.year === y);

const pipeline = computeSajuPipeline({
  dayStem: "정",
  monthBranch: "인",
  dayBranch: "미",
  allStems,
  allBranches,
  effectiveFiveElements: fe,
  timingDaewoonHangul: curDw?.ganZhi.hangul,
  timingSeunHangul: seunEntry?.ganZhi.hangul,
});

const report = buildEngineConsistencyReport({
  strengthLevel: pipeline.adjusted.effectiveStrengthLevel,
  gukgukName: pipeline.interpretation.gukguk?.name ?? null,
  yongshinPrimary: pipeline.adjusted.effectiveYongshin,
  yongshinSecondary: pipeline.adjusted.effectiveYongshinSecondary,
  gisin: getController(pipeline.adjusted.effectiveYongshin),
  dayStem: "정",
  dayBranch: "미",
  effectiveFiveElements: fe,
  countsForYongshinRule: aug,
  tenGodGroups: pipeline.base.tenGodGroups,
  evaluations: pipeline.evaluations,
  timingActivation: pipeline.timingActivation,
  timingDaewoonHangul: pipeline.input.timingDaewoonHangul,
  timingSeunHangul: pipeline.input.timingSeunHangul,
  allStems,
  allBranches,
});

console.log("=== 박소연 엔진 일관성 검증 ===");
console.log(`기준일: ${y}년, 만 나이 근사 ${age}세`);
console.log(`현재 대운: ${curDw?.ganZhi.hangul ?? "?"} / 세운: ${seunEntry?.ganZhi.hangul ?? "?"}`);
console.log(`신강약: ${pipeline.adjusted.effectiveStrengthLevel}, 용신: ${pipeline.adjusted.effectiveYongshin}/${pipeline.adjusted.effectiveYongshinSecondary ?? ""}`);
console.log(`격국: ${pipeline.interpretation.gukguk?.name ?? "없음"}`);
console.log("");
console.log(formatEngineConsistencyReportMarkdown(report));
