/**
 * ════════════════════════════════════════════════════════
 *  규칙 기반 해석 엔진 (Rule-Based Interpretation Engine)
 * ════════════════════════════════════════════════════════
 *
 *  구조:
 *    IF (조건들) THEN (해석 텍스트 생성)
 *
 *  각 규칙은 독립적이며 복수 발동 가능.
 *  규칙 추가: RULES 배열에 InterpretRule 객체 추가.
 *
 *  오행·십성 수정 → computeSajuPipeline() 재실행 → 규칙 자동 재평가
 * ════════════════════════════════════════════════════════
 */

import type { FiveElKey } from "./element-color";
import type { StrengthLevel } from "./interpretSchema";
import type { SeasonalAdjustment } from "./sajuPipeline";

// ── Rule context (파이프라인에서 전달받는 입력값) ──────────────────

export interface RuleContext {
  dayStem: string;
  strengthLevel: StrengthLevel;
  tenGodRatios: Record<string, number>;   // group → 0~1
  seasonalAdjustment: SeasonalAdjustment;
  effectiveYongshin: FiveElKey;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  conditions: string[];   // 사람이 읽을 수 있는 조건 설명
  interpretation: string;
  category: "신강약" | "십성" | "조후" | "용신" | "격국" | "궁합";
}

// ── 강도 헬퍼 ─────────────────────────────────────────────────────

const STRONG  = (r: number) => r >= 0.30;
const MEDIUM  = (r: number) => r >= 0.20 && r < 0.30;
const WEAK    = (r: number) => r < 0.15;
const MISSING = (r: number) => r < 0.08;

type StrIdx = ReturnType<typeof getStrIdx>;
function getStrIdx(lv: StrengthLevel): number {
  const map: Record<StrengthLevel, number> = {
    극신약: 0, 태약: 1, 신약: 2, 중화: 3, 신강: 4, 태강: 5, 극신강: 6,
  };
  return map[lv] ?? 3;
}

// ── 규칙 정의 ─────────────────────────────────────────────────────

interface InterpretRule {
  id: string;
  name: string;
  category: RuleResult["category"];
  condition: (ctx: RuleContext) => boolean;
  conditions: (ctx: RuleContext) => string[];
  interpretation: (ctx: RuleContext) => string;
}

const RULES: InterpretRule[] = [

  // ── 관성 강 + 인성 약 + 신약 → 압박형 권위 ──────────────────────
  {
    id: "R01",
    name: "압박형 권위 구조",
    category: "십성",
    condition: (ctx) =>
      STRONG(ctx.tenGodRatios["관성"] ?? 0) &&
      WEAK(ctx.tenGodRatios["인성"] ?? 0) &&
      getStrIdx(ctx.strengthLevel) <= 2,
    conditions: (ctx) => [
      `관성 비율 ${Math.round((ctx.tenGodRatios["관성"] ?? 0) * 100)}% (강)`,
      `인성 비율 ${Math.round((ctx.tenGodRatios["인성"] ?? 0) * 100)}% (약)`,
      `일간 강도: ${ctx.strengthLevel} (신약)`,
    ],
    interpretation: () =>
      "관성이 강하지만 인성이 이를 전달해주지 못해, 외부의 압박과 책임이 직접적인 부담으로 작용합니다. 권위나 규범이 동기부여보다는 스트레스 요인이 될 수 있습니다. 인성(학습·멘토)으로 에너지를 보충하는 것이 중요합니다.",
  },

  // ── 재성 강 + 식상 약 → 계획형 재물운 ───────────────────────────
  {
    id: "R02",
    name: "계획형 재물 구조",
    category: "십성",
    condition: (ctx) =>
      STRONG(ctx.tenGodRatios["재성"] ?? 0) &&
      WEAK(ctx.tenGodRatios["식상"] ?? 0),
    conditions: (ctx) => [
      `재성 비율 ${Math.round((ctx.tenGodRatios["재성"] ?? 0) * 100)}% (강)`,
      `식상 비율 ${Math.round((ctx.tenGodRatios["식상"] ?? 0) * 100)}% (약)`,
    ],
    interpretation: () =>
      "재물에 대한 감각과 욕구는 강하지만 이를 표현·실행하는 식상(창의·행동) 기운이 부족합니다. 재물운이 계획과 전략 위주로 작동하며, 실행력을 기르는 것이 재운(財運) 개화의 핵심입니다.",
  },

  // ── 겨울 구조 + 수 강 → 조후용신 화 ────────────────────────────
  {
    id: "R03",
    name: "조후 보정: 화 기운 필요",
    category: "조후",
    condition: (ctx) =>
      ctx.seasonalAdjustment.needsFireBoost,
    conditions: (ctx) => [
      `계절: ${ctx.seasonalAdjustment.season}`,
      `조후 보정 필요: 화(火) 보강`,
    ],
    interpretation: (ctx) =>
      `겨울 구조에 수(水) 기운이 편중되어 있어 한기(寒氣)가 강합니다. 조후용신으로 화(火) 기운이 절실하며, 따뜻한 환경·활동적인 루틴·정열적인 인연이 사주의 한기를 녹여줍니다. 현재 용신(${ctx.effectiveYongshin})과 함께 화 기운을 보조하세요.`,
  },

  // ── 여름 구조 + 화 강 → 조후용신 수 ────────────────────────────
  {
    id: "R04",
    name: "조후 보정: 수 기운 필요",
    category: "조후",
    condition: (ctx) =>
      ctx.seasonalAdjustment.needsWaterBoost,
    conditions: (ctx) => [
      `계절: ${ctx.seasonalAdjustment.season}`,
      `조후 보정 필요: 수(水) 보강`,
    ],
    interpretation: (ctx) =>
      `여름 구조에 화(火) 기운이 편중되어 있어 열기(熱氣)가 과합니다. 조후용신으로 수(水) 기운이 필요하며, 차분한 휴식·감성적인 활동·지혜 계발이 균형을 잡아줍니다. 현재 용신(${ctx.effectiveYongshin})과 함께 수 기운을 보조하세요.`,
  },

  // ── 비겁 강 + 재성 약 → 경쟁형 에너지 ──────────────────────────
  {
    id: "R05",
    name: "경쟁형 에너지 구조",
    category: "십성",
    condition: (ctx) =>
      STRONG(ctx.tenGodRatios["비겁"] ?? 0) &&
      WEAK(ctx.tenGodRatios["재성"] ?? 0),
    conditions: (ctx) => [
      `비겁 비율 ${Math.round((ctx.tenGodRatios["비겁"] ?? 0) * 100)}% (강)`,
      `재성 비율 ${Math.round((ctx.tenGodRatios["재성"] ?? 0) * 100)}% (약)`,
    ],
    interpretation: () =>
      "자아와 독립심이 강하며 경쟁 에너지가 높습니다. 그러나 재성(재물·현실·관계)이 약해 경쟁 에너지가 실제 결과물로 연결되지 못할 수 있습니다. 협력보다는 단독 행동을 선호하는 경향이 있으니, 재물 계획에 파트너나 멘토를 활용하면 효과적입니다.",
  },

  // ── 식상 강 + 인성 약 → 창의형 표현가 ──────────────────────────
  {
    id: "R06",
    name: "창의형 표현가 구조",
    category: "십성",
    condition: (ctx) =>
      STRONG(ctx.tenGodRatios["식상"] ?? 0) &&
      WEAK(ctx.tenGodRatios["인성"] ?? 0),
    conditions: (ctx) => [
      `식상 비율 ${Math.round((ctx.tenGodRatios["식상"] ?? 0) * 100)}% (강)`,
      `인성 비율 ${Math.round((ctx.tenGodRatios["인성"] ?? 0) * 100)}% (약)`,
    ],
    interpretation: () =>
      "창의적 표현력과 행동력이 뛰어나지만 체계적인 학습과 내면의 안정(인성)이 부족할 수 있습니다. 아이디어가 풍부하고 활동적이지만 깊이 있는 사고나 자기관리가 흐트러지기 쉽습니다. 규칙적인 공부나 명상이 에너지를 안정시켜줍니다.",
  },

  // ── 신약 + 관성 강 → 스트레스 과부하 ───────────────────────────
  {
    id: "R07",
    name: "스트레스 과부하 경고",
    category: "신강약",
    condition: (ctx) =>
      getStrIdx(ctx.strengthLevel) <= 2 &&
      STRONG(ctx.tenGodRatios["관성"] ?? 0),
    conditions: (ctx) => [
      `일간 강도: ${ctx.strengthLevel}`,
      `관성 비율 ${Math.round((ctx.tenGodRatios["관성"] ?? 0) * 100)}% (강)`,
    ],
    interpretation: (ctx) =>
      `일간이 ${ctx.strengthLevel} 상태에서 관성(압박·책임)이 강해, 외부 요구와 내면 에너지 사이의 간극이 큽니다. 과로나 번아웃에 주의하세요. 인성(休 기운)이나 비겁(지지·협력)을 통해 에너지를 충전하는 루틴이 필요합니다.`,
  },

  // ── 중화 + 균형 → 다재다능형 ────────────────────────────────────
  {
    id: "R08",
    name: "균형형 다재다능 구조",
    category: "신강약",
    condition: (ctx) => {
      if (ctx.strengthLevel !== "중화") return false;
      const ratios = Object.values(ctx.tenGodRatios);
      const max = Math.max(...ratios);
      const min = Math.min(...ratios);
      return max - min < 0.20; // 최대-최소 차이가 20% 미만 → 균형
    },
    conditions: (ctx) => [
      `일간 강도: ${ctx.strengthLevel} (균형)`,
      "오행 편차 20% 미만",
    ],
    interpretation: () =>
      "일간과 오행이 균형 잡혀 있어 다양한 영역에서 고르게 능력을 발휘할 수 있습니다. 특정 분야에 강렬히 집중하기보다는 협업·기획·조율 역할이 잘 맞습니다. 다재다능하지만 한 분야의 깊이를 키우는 노력이 장기적으로 도움이 됩니다.",
  },

  // ── 극신강 → 독립/사업형 ────────────────────────────────────────
  {
    id: "R09",
    name: "극신강: 독립·사업형 에너지",
    category: "신강약",
    // NOTE: 강도만으로 "조직보다 독립"을 단정하면 과잉 일반화로 보일 수 있어,
    // 비겁(자아/독립) 에너지까지 함께 강할 때만 발동합니다.
    condition: (ctx) =>
      getStrIdx(ctx.strengthLevel) >= 5 &&
      STRONG(ctx.tenGodRatios["비겁"] ?? 0),
    conditions: (ctx) => [
      `일간 강도: ${ctx.strengthLevel} (매우 강)`,
      `비겁 비율 ${Math.round((ctx.tenGodRatios["비겁"] ?? 0) * 100)}% (강)`,
    ],
    interpretation: (ctx) =>
      `일간 에너지가 극도로 강해 조직 생활보다 독립적인 환경이 어울립니다. 자기 주도성이 매우 높아 사업·창업·전문직에서 강점을 발휘합니다. 용신(${ctx.effectiveYongshin})으로 과잉 에너지를 생산적으로 흘려보내는 것이 핵심입니다.`,
  },

  // ── 인성 강 → 학습·내면 탐구형 ─────────────────────────────────
  {
    id: "R10",
    name: "인성 강: 학습·내면 탐구형",
    category: "십성",
    condition: (ctx) => STRONG(ctx.tenGodRatios["인성"] ?? 0),
    conditions: (ctx) => [
      `인성 비율 ${Math.round((ctx.tenGodRatios["인성"] ?? 0) * 100)}% (강)`,
    ],
    interpretation: () =>
      "인성이 강해 학습·연구·직관·모성 기운이 발달해 있습니다. 지식 습득과 내면 탐구에 뛰어나며, 학문·상담·멘토링 분야에서 능력을 발휘합니다. 다만 행동력(식상·재성)이 상대적으로 약해지지 않도록 실행 루틴을 병행하세요.",
  },

  // ── 오행 결핍 원소 존재 → 보완 필요 ────────────────────────────
  {
    id: "R11",
    name: "오행 결핍 보완 필요",
    category: "용신",
    condition: (ctx) => {
      const total = Object.values(ctx.tenGodRatios).reduce((a, b) => a + b, 0) || 1;
      return Object.values(ctx.tenGodRatios).some((v) => v / total < 0.05);
    },
    conditions: (ctx) => {
      const total = Object.values(ctx.tenGodRatios).reduce((a, b) => a + b, 0) || 1;
      const missing = Object.entries(ctx.tenGodRatios)
        .filter(([, v]) => v / total < 0.05)
        .map(([g]) => g);
      return [`결핍 십성 그룹: ${missing.join("·")}`];
    },
    interpretation: (ctx) => {
      const total = Object.values(ctx.tenGodRatios).reduce((a, b) => a + b, 0) || 1;
      const missing = Object.entries(ctx.tenGodRatios)
        .filter(([, v]) => v / total < 0.05)
        .map(([g]) => g);
      return `${missing.join("·")} 기운이 매우 부족합니다. 이 기운이 담당하는 영역(${missing.map(g => ({ 비겁:"독립·의지", 식상:"표현·창의", 재성:"재물·현실", 관성:"명예·규범", 인성:"학습·보호" }[g] ?? g)).join(", ")})에서 공백이 생길 수 있으니 의식적으로 보완하세요.`;
    },
  },
];

// ── 규칙 엔진 실행 ────────────────────────────────────────────────

export interface RuleEngineOutput {
  results: RuleResult[];
  firedCount: number;
}

export function applyInterpretationRules(ctx: RuleContext): RuleEngineOutput {
  const results: RuleResult[] = RULES.map((rule) => {
    const fired = (() => { try { return rule.condition(ctx); } catch { return false; } })();
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      fired,
      conditions: fired ? rule.conditions(ctx) : [],
      interpretation: fired ? rule.interpretation(ctx) : "",
    };
  });

  return {
    results,
    firedCount: results.filter((r) => r.fired).length,
  };
}
