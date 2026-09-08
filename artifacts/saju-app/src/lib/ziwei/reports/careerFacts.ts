// 事業宮 본궁 + 生年四化 + 對宮(夫妻宮) + 三方(命宮·財帛宮)의 조합에서 커리어 주제의
// semantic fact를 생성한다. wealthFacts.ts와 동일한 InterpretationFact/synthesizeText
// 재사용 구조이며, evidence 소스와 domain-specific meaning만 커리어 주제에 맞게 새로
// 설계했다(계산 엔진은 건드리지 않음).
//
// 재물과의 역할 분리: 재물(財帛宮 중심)은 "어떻게 벌고·모으고·운용하나", 커리어(事業宮 중심)는
// "어떤 방식으로 일하고·어떤 역할/환경에서 성취하나"에 집중한다 — 그래서 主星은 두 주제 모두
// MAJOR_STAR_MEANINGS의 서로 다른 필드(wealth vs career)를 쓰고, 사화·살성 문구도 재물/배우자
// 주제 문구를 재사용하지 않고 커리어 전용으로 새로 정의했다(직전 재물 주제 리뷰에서 지적된
// "다른 주제 문맥 잔재" 문제를 반복하지 않기 위함).
import type { EvidenceItem, PalaceName, SihuaKind, StarPlacement } from "../types";
import type { CareerEvidenceBundle } from "../careerEvidence";
import { MAJOR_STAR_MEANINGS, type Polarity, type StarMeaning } from "./starInterpretations";
import type { InterpretationFact } from "./interpretationFacts";

export type CareerDomain = "coreCareer" | "workStyle" | "collaborationEnvironment" | "achievementVolatility";

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

function finalize(domain: CareerDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({ id: `${domain}-${i}`, strength: countByPolarity[d.polarity], ...d }));
}

function push(drafts: FactDraft[], domain: CareerDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], prefix?: string) {
  if (!m) return;
  drafts.push({ domain, meaning: prefix ? `${prefix} ${m.meaning}` : m.meaning, polarity: m.polarity, evidence });
}

/** 커리어 주제 전용 사화 문구 — 배우자/재물 문맥("배우자 인연을 통해...", "재물이...") 잔재가
 * 없는지 확인 완료. "성과·역할·평가"라는 커리어 고유 관점으로만 서술한다. */
const CAREER_TOPIC_SIHUA: Record<SihuaKind, StarMeaning> = {
  化祿: { meaning: "일에서 성과와 기회가 자연스럽게 따르는 흐름", polarity: "positive" },
  化權: { meaning: "주도적으로 역할을 맡거나 책임이 커지는 흐름", polarity: "mixed" },
  化科: { meaning: "성과가 인정받고 평판이 쌓이는 흐름", polarity: "positive" },
  化忌: { meaning: "성과나 평가와 관련해 신중해야 할 신호", polarity: "risk" },
};

/** 업무상 변수 관련 살성 — 커리어 관점 전용(재물의 WEALTH_RISK_AUX와 문구를 공유하지 않음). */
const CAREER_RISK_AUX: Record<string, StarMeaning> = {
  擎羊: { meaning: "업무상 마찰이나 급한 결정이 생기기 쉬운 신호", polarity: "risk" },
  陀羅: { meaning: "성과가 더디게 나타나거나 정체되기 쉬운 신호", polarity: "risk" },
  地空: { meaning: "예상치 못한 변수로 계획이 틀어지기 쉬운 신호", polarity: "risk" },
  地劫: { meaning: "예상치 못한 변수로 계획이 틀어지기 쉬운 신호", polarity: "risk" },
};

function resolveCareerStars(evidence: CareerEvidenceBundle): { stars: StarPlacement[]; sourcePalace: PalaceName; borrowed: boolean } {
  if (evidence.careerPalace.majorStars.length > 0) {
    return { stars: evidence.careerPalace.majorStars, sourcePalace: "事業宮", borrowed: false };
  }
  return { stars: evidence.oppositePalace.majorStars, sourcePalace: evidence.oppositePalace.palace, borrowed: true };
}

/** 핵심 커리어상 — 事業宮 본궁 + 사화. */
export function coreCareerFacts(evidence: CareerEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveCareerStars(evidence);
  for (const star of stars) {
    push(drafts, "coreCareer", MAJOR_STAR_MEANINGS[star.name]?.career, [starEvidence(star.name, sourcePalace)], borrowed ? "(對宮 借星)" : undefined);
  }
  // 化忌는 "성취 변동성" 섹션 전용이라 여기서는 제외한다(같은 fact가 두 섹션에 겹치지 않도록
  // domain ownership을 분리 — 재물 주제 리뷰에서 발견한 문제를 커리어에서는 처음부터 방지).
  for (const s of evidence.sihuaInScope) {
    if (s.kind === "化忌") continue;
    push(drafts, "coreCareer", CAREER_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("coreCareer", drafts);
}

/** 일하는 방식 — 三方(命宮·財帛宮)의 주성. */
export function workStyleFacts(evidence: CareerEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      push(drafts, "workStyle", MAJOR_STAR_MEANINGS[star.name]?.career, [starEvidence(star.name, p.palace)], `(三方 ${p.palace})`);
    }
  }
  return finalize("workStyle", drafts);
}

/** 협업·대인 환경 — 對宮(夫妻宮, 사업상 파트너십·대외 협력 관계를 상징)의 주성. */
export function collaborationEnvironmentFacts(evidence: CareerEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const star of evidence.oppositePalace.majorStars) {
    push(drafts, "collaborationEnvironment", MAJOR_STAR_MEANINGS[star.name]?.career, [starEvidence(star.name, evidence.oppositePalace.palace)], `(對宮 ${evidence.oppositePalace.palace})`);
  }
  return finalize("collaborationEnvironment", drafts);
}

/** 성취 변동성 — 化忌(핵심 커리어상 섹션과 겹치지 않도록 이 섹션 전용) + 삼방사정 내
 * 살성(擎羊·陀羅·地空·地劫). */
export function achievementVolatilityFacts(evidence: CareerEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const s of evidence.sihuaInScope) {
    if (s.kind !== "化忌") continue;
    push(drafts, "achievementVolatility", CAREER_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const group of evidence.sanfangSizhengStars) {
    for (const star of group.stars) {
      const m = CAREER_RISK_AUX[star.name];
      if (!m) continue;
      push(drafts, "achievementVolatility", m, [starEvidence(star.name, group.palace)], group.palace === "事業宮" ? undefined : `(${group.palace})`);
    }
  }
  return finalize("achievementVolatility", drafts);
}
