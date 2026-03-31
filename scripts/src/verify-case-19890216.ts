import { computeSajuPipeline } from "../../artifacts/saju-app/src/lib/sajuPipeline";
import { countFiveElements, type ComputedPillars } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { computeStrengthResult } from "../../artifacts/saju-app/src/lib/interpretSchema";
import { determineGukguk } from "../../artifacts/saju-app/src/lib/gukguk";
import { computeBranchRelations } from "../../artifacts/saju-app/src/lib/branchRelations";

// Test case (provided pillars are treated as ground-truth)
// 1989-02-16 19:29, female
// year: 기사, month: 병인, day: 정미, hour: 기유
const pillars: ComputedPillars = {
  year: { hangul: "기사", hanja: "" },
  month: { hangul: "병인", hanja: "" },
  day: { hangul: "정미", hanja: "" },
  hour: { hangul: "기유", hanja: "" },
};

const dayStem = pillars.day?.hangul?.[0] ?? "";
const monthBranch = pillars.month?.hangul?.[1];
const dayBranch = pillars.day?.hangul?.[1];

const allStems = [
  pillars.hour?.hangul?.[0],
  pillars.day?.hangul?.[0],
  pillars.month?.hangul?.[0],
  pillars.year?.hangul?.[0],
].filter((c): c is string => !!c);

const allBranches = [
  pillars.hour?.hangul?.[1],
  pillars.day?.hangul?.[1],
  pillars.month?.hangul?.[1],
  pillars.year?.hangul?.[1],
].filter((c): c is string => !!c);

const surfaceFiveElements = countFiveElements(pillars);

const strength = computeStrengthResult(dayStem, monthBranch, allStems, allBranches);
const pipeline = computeSajuPipeline({
  dayStem,
  monthBranch,
  dayBranch,
  allStems,
  allBranches,
  effectiveFiveElements: surfaceFiveElements,
});

const gukguk = monthBranch ? determineGukguk(dayStem, monthBranch, allStems) : null;
const rels = computeBranchRelations(allBranches);

console.log("=== verify-case-19890216 ===");
console.log("pillars:", {
  year: pillars.year?.hangul,
  month: pillars.month?.hangul,
  day: pillars.day?.hangul,
  hour: pillars.hour?.hangul,
  dayStem,
  monthBranch,
});
console.log("");

console.log("[ohaeng(surface count)]", surfaceFiveElements);
console.log("");

console.log("[strength(single source: interpretSchema.computeStrengthResult)]");
console.log("strength score:", strength?.score ?? null);
console.log("strength level:", strength?.level ?? null);
console.log("득령 이유:", strength?.reason.deukryeong ?? null);
console.log("득지 이유:", strength?.reason.deukji ?? null);
console.log("득세 이유:", strength?.reason.deukse ?? null);
console.log("adjustments:", strength?.reason.adjustments ?? null);
console.log("explanation:", strength?.explanation ?? null);
console.log("");

console.log("[격국(gukguk.ts strict: 투출 기반)]");
console.log("method:", "투출 기준 (월지 지장간 → 연/월/시 천간 투출 매칭; 없으면 null)");
console.log("result:", gukguk ? { name: gukguk.name, transparentStem: gukguk.transparentStem } : null);
console.log("근거:", gukguk?.explanation ?? null);
console.log("");

console.log("[structureType(sajuPipeline: 월지 오행 → 십성그룹 매핑)]");
console.log("method:", "월지 기준 (월지 오행 → 십성그룹 → 격국명 단순 매핑)");
console.log("result:", pipeline.interpretation.structureType);
console.log("");

console.log("[yongshin(sajuPipeline: strength-based 억부용신 + 지장간 가중 + 조후 secondary injection)]");
console.log("method:", "강도 기반(억부) + (용신 계산에만) 지장간 가중 + (조건부) 조후 보정은 secondary 주입");
console.log("primary:", pipeline.adjusted.effectiveYongshin);
console.log("secondary:", pipeline.adjusted.effectiveYongshinSecondary ?? null);
console.log("raw yongshinResult:", pipeline.base.yongshinResult);
console.log("");

console.log("[johu/seasonal adjustment(sajuPipeline)]");
console.log("method:", "계절(월지) + 수/화 비율 threshold 기반 (결핍 기준 아님)");
console.log("seasonalAdjustment:", pipeline.adjusted.seasonalAdjustment);
console.log("");

console.log("[branch relations(branchRelations.ts)]");
console.log(
  rels
    .filter((r) => ["형", "해", "원진"].includes(r.type))
    .map((r) => `${r.description}`),
);
console.log("");

console.log("[fallback check]");
console.log("computeStrengthResult is null?:", strength == null);
console.log("strength score is finite?:", strength ? Number.isFinite(strength.score) : null);
console.log("pipeline.strengthResult:", pipeline.adjusted.strengthResult);
console.log("");
console.log("[diagnostics(common struct)]");
console.log(JSON.stringify(pipeline.diagnostics, null, 2));

