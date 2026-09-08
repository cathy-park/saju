// 財帛宮 본궁 + 生年四化 + 對宮(福德宮) + 三方(命宮·事業宮)의 조합에서 재물 주제의
// semantic fact를 생성한다. interpretationFacts.ts와 동일한 InterpretationFact 타입 /
// synthesizeText 충돌조정·합성 로직을 그대로 재사용하고, evidence 소스와 domain-specific
// meaning만 재물 주제에 맞게 새로 설계했다(계산 엔진은 건드리지 않음).
import type { EvidenceItem, PalaceName, StarPlacement } from "../types";
import type { WealthEvidenceBundle } from "../wealthEvidence";
import { MAJOR_STAR_MEANINGS, type Polarity, type StarMeaning } from "./starInterpretations";
import type { SihuaKind } from "../types";
import type { InterpretationFact } from "./interpretationFacts";

export type WealthDomain = "coreWealth" | "incomeStyle" | "spendingTendency" | "volatility";

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

function finalize(domain: WealthDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({ id: `${domain}-${i}`, strength: countByPolarity[d.polarity], ...d }));
}

function push(drafts: FactDraft[], domain: WealthDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], prefix?: string) {
  if (!m) return;
  drafts.push({ domain, meaning: prefix ? `${prefix} ${m.meaning}` : m.meaning, polarity: m.polarity, evidence });
}

/** starInterpretations.ts의 SIHUA_MEANINGS.wealth는 "배우자 인연을 통해..." 식으로 배우자
 * 리포트 전용 문맥이 섞여 있어(대표 지시로 지적된 것과 같은 도메인 불일치 문제) 재물 주제에는
 * 그대로 재사용하지 않는다 — 재물 주제 전용으로 새로 정의한다(공용 데이터는 건드리지 않음). */
const WEALTH_TOPIC_SIHUA: Record<SihuaKind, StarMeaning> = {
  化祿: { meaning: "재물이 자연스럽게 따르고 여유가 생기는 흐름", polarity: "positive" },
  化權: { meaning: "재물을 적극적으로 불리거나 주도적으로 운용하려는 흐름", polarity: "mixed" },
  化科: { meaning: "재물 관리가 안정적이고 평판이 따르는 흐름", polarity: "positive" },
  化忌: { meaning: "재물과 관련해 신중해야 할 신호", polarity: "risk" },
};

/** 재물 손실·변수 관련 살성 — 별도 wealth 필드가 없는 보조성만 이 파일 자체에서 재물 관점의
 * 의미를 부여한다(starInterpretations.ts의 공용 데이터는 건드리지 않음 — 이 주제 전용 데이터). */
const WEALTH_RISK_AUX: Record<string, StarMeaning> = {
  擎羊: { meaning: "지출·투자 판단에서 갈등이나 급한 결정이 생기기 쉬운 신호", polarity: "risk" },
  陀羅: { meaning: "재물이 더디게 모이거나 정체되기 쉬운 신호", polarity: "risk" },
  地空: { meaning: "예상치 못한 지출이나 재물 손실에 취약한 신호", polarity: "risk" },
  地劫: { meaning: "예상치 못한 지출이나 재물 손실에 취약한 신호", polarity: "risk" },
};

function resolveWealthStars(evidence: WealthEvidenceBundle): { stars: StarPlacement[]; sourcePalace: PalaceName; borrowed: boolean } {
  if (evidence.wealthPalace.majorStars.length > 0) {
    return { stars: evidence.wealthPalace.majorStars, sourcePalace: "財帛宮", borrowed: false };
  }
  return { stars: evidence.oppositePalace.majorStars, sourcePalace: evidence.oppositePalace.palace, borrowed: true };
}

/** 핵심 재물상 — 財帛宮 본궁 + 사화. */
export function coreWealthFacts(evidence: WealthEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveWealthStars(evidence);
  for (const star of stars) {
    push(drafts, "coreWealth", MAJOR_STAR_MEANINGS[star.name]?.wealth, [starEvidence(star.name, sourcePalace)], borrowed ? "(對宮 借星)" : undefined);
  }
  // 化忌는 "재물 변동성" 섹션 전용이라 여기서는 제외한다(같은 fact가 두 섹션에 겹치지 않도록
  // domain ownership을 분리 — 化祿/化權/化科는 재물의 성격을, 化忌는 변동성만 담당).
  for (const s of evidence.sihuaInScope) {
    if (s.kind === "化忌") continue;
    push(drafts, "coreWealth", WEALTH_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("coreWealth", drafts);
}

/** 수입·소득 패턴 — 三方(命宮·事業宮)의 주성. */
export function incomeStyleFacts(evidence: WealthEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      push(drafts, "incomeStyle", MAJOR_STAR_MEANINGS[star.name]?.wealth, [starEvidence(star.name, p.palace)], `(三方 ${p.palace})`);
    }
  }
  return finalize("incomeStyle", drafts);
}

/** 소비·관리 성향 — 對宮(福德宮, 재물에 대한 욕구·만족 기준을 상징)의 주성. */
export function spendingTendencyFacts(evidence: WealthEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const star of evidence.oppositePalace.majorStars) {
    push(drafts, "spendingTendency", MAJOR_STAR_MEANINGS[star.name]?.wealth, [starEvidence(star.name, evidence.oppositePalace.palace)], `(對宮 ${evidence.oppositePalace.palace})`);
  }
  return finalize("spendingTendency", drafts);
}

/** 재물 변동성 — 化忌(핵심 재물상 섹션과 겹치지 않도록 이 섹션 전용) + 삼방사정 내
 * 살성(擎羊·陀羅·地空·地劫). */
export function wealthVolatilityFacts(evidence: WealthEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const s of evidence.sihuaInScope) {
    if (s.kind !== "化忌") continue;
    push(drafts, "volatility", WEALTH_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const group of evidence.sanfangSizhengStars) {
    for (const star of group.stars) {
      const m = WEALTH_RISK_AUX[star.name];
      if (!m) continue;
      push(drafts, "volatility", m, [starEvidence(star.name, group.palace)], group.palace === "財帛宮" ? undefined : `(${group.palace})`);
    }
  }
  return finalize("volatility", drafts);
}
