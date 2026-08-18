import { computeSajuPipeline } from "../../artifacts/saju-app/src/lib/sajuPipeline";
import { countFiveElements, type ComputedPillars } from "../../artifacts/saju-app/src/lib/sajuEngine";

/**
 * 특별격(전왕격·종격) 레이어 회귀/참고 검증 스크립트.
 *
 * 목적:
 *  1. 기존 내격 판정(gukguk)·강도(strengthLevel)·효과용신(effectiveYongshin/secondary)이
 *     high confidence 특별격이 없는 일반 명식에서 전혀 흔들리지 않는지 확인한다.
 *  2. 특별격 게이트가 "항상 medium/low만 나오는" 죽은 코드가 아니라, 극단적으로 편중된
 *     명식에서는 실제로 high까지 도달하는지 확인한다.
 *  3. 박소연(1989-02-16) 케이스는 사용자가 스스로 밝힌 대로 "정답 기준"이 아니라
 *     참고용 회귀 케이스로만 사용한다 — 여기서 나온 confidence로 임계값을 역산하지 않는다.
 */

function toPipelineInput(pillars: ComputedPillars) {
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
  const effectiveFiveElements = countFiveElements(pillars);
  return { dayStem, monthBranch, dayBranch, allStems, allBranches, effectiveFiveElements };
}

function run(label: string, pillars: ComputedPillars, note?: string) {
  const input = toPipelineInput(pillars);
  const result = computeSajuPipeline(input);

  console.log(`\n=== ${label} ===`);
  if (note) console.log(`(${note})`);
  console.log(
    `사주: ${pillars.year?.hangul} / ${pillars.month?.hangul} / ${pillars.day?.hangul} / ${pillars.hour?.hangul}`,
  );
  console.log(`강도(strengthLevel): ${result.adjusted.effectiveStrengthLevel} (score=${result.adjusted.strengthResult.score})`);
  console.log(`내격(gukguk): ${result.interpretation.gukguk?.name ?? "격국 없음"}`);
  console.log(
    `용신(effectiveYongshin/secondary): ${result.adjusted.effectiveYongshin} / ${result.adjusted.effectiveYongshinSecondary ?? "-"}`,
  );
  console.log(`적용된 특별격(순세 취용 여부): ${result.adjusted.appliedSpecialGukguk?.name ?? "없음(억부용신 그대로 사용)"}`);
  console.log(`커리어 활성도: ${result.careerActivation.activationScore} (${result.careerActivation.activationLevel})`);

  if (result.interpretation.specialPatterns.length === 0) {
    console.log("특별격 후보: 없음");
  } else {
    console.log("특별격 후보 목록:");
    for (const c of result.interpretation.specialPatterns) {
      console.log(`  - ${c.name} [${c.category}] confidence=${c.confidence}`);
      console.log(`    성립: ${c.supportingEvidence.join(" / ")}`);
      if (c.opposingEvidence.length > 0) {
        console.log(`    방해: ${c.opposingEvidence.join(" / ")}`);
      }
    }
  }
}

// ── 1) 박소연 1989-02-16 19:29 — 참고용 회귀 케이스(정답 데이터 아님) ──────
// 己巳 / 丙寅 / 丁未 / 己酉. verify-case-19890216.ts와 동일한 사주.
run(
  "박소연 1989-02-16 (己巳/丙寅/丁未/己酉)",
  {
    year: { hangul: "기사", hanja: "" },
    month: { hangul: "병인", hanja: "" },
    day: { hangul: "정미", hanja: "" },
    hour: { hangul: "기유", hanja: "" },
  },
  "참고용 회귀 케이스 — 이 결과로 임계값을 역산하지 않는다",
);

// ── 2) 극단적 염상격 후보 — 전왕격 게이트가 실제로 high까지 도달하는지 확인 ──
// 甲午 / 甲午 / 丙午 / 甲午 — 일간 병(화), 월지 오(화 왕지), 지지 전부 오(화),
// 생조(목:갑) 3개 투출, 반대세력(수) 전무, 설기(토) 전무.
run("합성 케이스 A — 염상격 극단형", {
  year: { hangul: "갑오", hanja: "" },
  month: { hangul: "갑오", hanja: "" },
  day: { hangul: "병오", hanja: "" },
  hour: { hangul: "갑오", hanja: "" },
});

// ── 3) 극단적 종재격 후보 — 종격 게이트가 실제로 high까지 도달하는지 확인 ──
// 壬子 / 辛酉 / 戊子 / 壬子 — 일간 무(토) 무근(자·유 모두 지장간에 토 없음),
// 재성(수) 지지 3개, 식상(금:신) 투출로 식상생재, 비겁·인성(토·화) 전무.
run("합성 케이스 B — 종재격 극단형", {
  year: { hangul: "임자", hanja: "" },
  month: { hangul: "신유", hanja: "" },
  day: { hangul: "무자", hanja: "" },
  hour: { hangul: "임자", hanja: "" },
});

// ── 4) 일반 혼합 오행 명식 — 특별격이 전혀 뜨지 않아야 하는 대조군 ──
run("합성 케이스 C — 일반 혼합 오행(대조군)", {
  year: { hangul: "갑자", hanja: "" },
  month: { hangul: "정묘", hanja: "" },
  day: { hangul: "경오", hanja: "" },
  hour: { hangul: "신사", hanja: "" },
});
