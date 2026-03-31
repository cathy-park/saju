import { applyInterpretationRules } from "../../artifacts/saju-app/src/lib/interpretationRules";

function run(title: string, ctx: Parameters<typeof applyInterpretationRules>[0]) {
  const out = applyInterpretationRules(ctx);
  const fired = out.results.filter((r) => r.fired).map((r) => `${r.ruleId}:${r.ruleName}`);
  console.log("\n##", title);
  console.log("strengthLevel:", ctx.strengthLevel);
  console.log(
    "ratios:",
    Object.fromEntries(Object.entries(ctx.tenGodRatios).map(([k, v]) => [k, Math.round(v * 100) + "%"]))
  );
  console.log("fired:", fired);
}

const baseSeason = {
  season: "환절기" as const,
  seasonElement: "토" as const,
  needsFireBoost: false,
  needsWaterBoost: false,
  adjustmentNote: "test",
};

// 1) 경쟁 에너지 높음 + 재성 약
run("R05 경쟁형 에너지 구조 발동", {
  dayStem: "갑",
  strengthLevel: "중화",
  tenGodRatios: { 비겁: 0.32, 식상: 0.12, 재성: 0.10, 관성: 0.20, 인성: 0.26 },
  seasonalAdjustment: baseSeason,
  effectiveYongshin: "화",
});

// 2) 관성 부족(결핍) 케이스 → R11에서 관성 결핍으로 잡히는지
run("R11 결핍(관성 부족) 발동", {
  dayStem: "갑",
  strengthLevel: "중화",
  tenGodRatios: { 비겁: 0.30, 식상: 0.25, 재성: 0.25, 관성: 0.03, 인성: 0.17 },
  seasonalAdjustment: baseSeason,
  effectiveYongshin: "화",
});

// 3) 극신강이지만 비겁이 강하지 않음 → R09 미발동(과잉 일반화 방지)
run("R09 미발동(강도만 높음, 비겁 약)", {
  dayStem: "갑",
  strengthLevel: "태강",
  tenGodRatios: { 비겁: 0.18, 식상: 0.30, 재성: 0.22, 관성: 0.15, 인성: 0.15 },
  seasonalAdjustment: baseSeason,
  effectiveYongshin: "화",
});

// 4) 극신강 + 비겁 강 → R09 발동
run("R09 발동(강도 높음 + 비겁 강)", {
  dayStem: "갑",
  strengthLevel: "태강",
  tenGodRatios: { 비겁: 0.34, 식상: 0.18, 재성: 0.18, 관성: 0.15, 인성: 0.15 },
  seasonalAdjustment: baseSeason,
  effectiveYongshin: "화",
});

