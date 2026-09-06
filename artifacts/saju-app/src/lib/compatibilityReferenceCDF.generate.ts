// [P1] Reference CDF 오프라인 생성기 — 런타임에서 절대 import/실행하지 않는다.
// `npx tsx src/lib/compatibilityReferenceCDF.generate.ts`로 수동 실행해
// src/lib/compatibilityReferenceCDF.ts(체크인되는 데이터 모듈)를 재생성한다.
//
// 재현성 계약: 아래 SEED/N/SCORING_MODEL_VERSION이 그대로면 항상 동일한 output이 나와야
// 한다(mulberry32 PRNG는 순수 결정론적). compatibilityScore.ts의 Core/Aux 산식이 바뀌면
// (Phase 3 scoring baseline commit이 바뀌면) SCORING_MODEL_VERSION을 올리고 이 스크립트를
// 다시 실행해 데이터 모듈을 재생성해야 한다 — compatibilityInterpretation.ts의 버전 가드
// 테스트가 이걸 강제한다.
import { writeFileSync } from "fs";
import { calculateProfileFromBirth } from "./sajuEngine";
import type { BirthInput } from "./sajuEngine";
import type { PersonRecord } from "./storage";
import { calculateCompatibilityScore } from "./compatibilityScore";

// [Phase 3 P1] Human dm/mb neutralization으로 Human Compatibility의 friend/coworker 산식이
// 바뀌어(relType-무관 canonical raw relation 사용) phase3-b4f58a4 대비 stale해졌으므로 bump.
const SCORING_MODEL_VERSION = "phase3-human-neutral-v1";
const SEED = 424242;
const N = 20000;
const RELATIONSHIP_TYPE = "lover"; // Human은 relType 무관하게 계산되므로 lover 표본 하나로 3모델 모두 커버.

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
function randInt(a: number, b: number) { return a + Math.floor(rng() * (b - a + 1)); }
function randomBirthInput(name: string): BirthInput {
  return {
    name, gender: rng() < 0.5 ? "남" : "여", calendarType: "solar",
    year: randInt(1950, 2010), month: randInt(1, 12), day: randInt(1, 28),
    hour: randInt(0, 23), minute: randInt(0, 59), timeUnknown: false,
  };
}
function toPersonRecord(name: string, birthInput: BirthInput): PersonRecord {
  const profile = calculateProfileFromBirth(birthInput);
  const now = new Date().toISOString();
  return { id: name, birthInput, profile, createdAt: now, updatedAt: now };
}

const humanScores: number[] = [];
const romanceScores: number[] = [];
const marriageScores: number[] = [];

for (let i = 0; i < N; i++) {
  const p1 = toPersonRecord("A", randomBirthInput("A"));
  const p2 = toPersonRecord("B", randomBirthInput("B"));
  const r = calculateCompatibilityScore(p1, p2, RELATIONSHIP_TYPE as any);
  humanScores.push(r.humanCompatibility.final);
  romanceScores.push(r.romanceCompatibility.final);
  marriageScores.push(r.marriageCompatibility.final);
}

/** score(0~100 정수) → empirical CDF(해당 score 이하 표본 비율, 0~1) 101개 배열. */
function buildCDF(scores: number[]): number[] {
  const counts = new Array(101).fill(0);
  for (const s of scores) {
    const clamped = Math.max(0, Math.min(100, Math.round(s)));
    counts[clamped]++;
  }
  const cdf = new Array(101).fill(0);
  let cumulative = 0;
  for (let score = 0; score <= 100; score++) {
    cumulative += counts[score];
    cdf[score] = cumulative / scores.length;
  }
  return cdf;
}

const humanCDF = buildCDF(humanScores);
const romanceCDF = buildCDF(romanceScores);
const marriageCDF = buildCDF(marriageScores);

const generatedAt = new Date().toISOString();

const fileContent = `// [자동 생성 파일 — 직접 수정 금지]
// src/lib/compatibilityReferenceCDF.generate.ts로 생성됨. 재생성하려면:
//   npx tsx src/lib/compatibilityReferenceCDF.generate.ts
// compatibilityScore.ts의 Core/Aux 산식이 바뀌면(=Phase 3 scoring baseline commit이 바뀌면)
// SCORING_MODEL_VERSION을 올리고 반드시 재생성해야 한다 — compatibilityInterpretation.ts의
// 버전 가드 테스트가 스킵 없이 이를 강제한다.

export const COMPATIBILITY_REFERENCE_CDF_METADATA = {
  scoringModelVersion: "${SCORING_MODEL_VERSION}",
  seed: ${SEED},
  n: ${N},
  // 이 값은 표본을 뽑을 때 쓴 sampling 입력 조건일 뿐, "이 CDF가 lover 관계에만 유효하다"는
  // 뜻이 아니다. Human Compatibility는 relType-invariant(모든 relType에서 humanCompatibility.
  // final이 완전히 동일 — humanNeutralScorer.test.ts로 회귀 고정됨)이므로 HUMAN_SCORE_CDF는
  // friend/coworker 등 어떤 relType에도 동일하게 유효하다. lover를 표본으로 고른 이유는
  // Romance/Marriage 모델이 romantic relType 입력을 요구해 세 모델을 한 번의 표본 생성으로
  // 동시에 커버하기 위함이다.
  relationshipType: "${RELATIONSHIP_TYPE}",
  method: "calculateProfileFromBirth로 생성한 유효 사주 원국 쌍(mulberry32 PRNG, 고정 seed)에 " +
    "calculateCompatibilityScore(lover)를 실제 실행해 humanCompatibility/romanceCompatibility/" +
    "marriageCompatibility.final 표본을 모으고, score 0~100 정수별 누적분포(해당 값 이하 비율)를 계산함.",
  generatedAt: "${generatedAt}",
} as const;

/** index = score(0~100), value = P(score' <= index) — 이 reference 표본 기준 누적분포. */
export const HUMAN_SCORE_CDF: readonly number[] = [
${humanCDF.map((v) => "  " + v.toFixed(6)).join(",\n")}
];

export const ROMANCE_SCORE_CDF: readonly number[] = [
${romanceCDF.map((v) => "  " + v.toFixed(6)).join(",\n")}
];

export const MARRIAGE_SCORE_CDF: readonly number[] = [
${marriageCDF.map((v) => "  " + v.toFixed(6)).join(",\n")}
];
`;

writeFileSync("src/lib/compatibilityReferenceCDF.ts", fileContent);
console.log(`DONE: N=${N}, seed=${SEED}, generatedAt=${generatedAt}`);
console.log(`Human P50=score ${humanCDF.findIndex((v) => v >= 0.5)}, Romance P50=${romanceCDF.findIndex((v) => v >= 0.5)}, Marriage P50=${marriageCDF.findIndex((v) => v >= 0.5)}`);
