// 命宮 본궁 + 生年四化 + 對宮(遷移宮) + 三方(財帛宮·事業宮) + 身宮의 조합에서 "타고난 성향"
// 주제의 semantic fact를 생성한다. wealthFacts.ts/careerFacts.ts와 동일한
// InterpretationFact/synthesizeText 재사용 구조이며, evidence 소스와 domain-specific
// meaning만 새로 설계했다(계산 엔진은 건드리지 않음).
//
// 命宮과 身宮의 역할 분리(정통 이론): 命宮=타고난 기질, 身宮=시간이 갈수록 힘이 실리기 쉬운
// 방향·집중 영역(身宮을 "성격 그 자체"로 단정하지 않는다 — 대표 지시).
// 財帛宮·事業宮은 재물/커리어 주제와 같은 궁을 공유하지만, 거기서는 "돈을 어떻게 벌고 쓰는가/
// 어떻게 일하는가"가 초점이고 여기서는 "삶을 대하는 태도"가 초점이라 문구를 재사용하지 않고
// 이 주제 전용으로 새로 정의했다 — 재물/커리어 리뷰에서 지적된 문맥 잔재 문제를 주제 간에도
// 반복하지 않기 위함.
import type { EvidenceItem, PalaceName, SihuaKind, StarPlacement } from "../types";
import type { NatureEvidenceBundle } from "../natureEvidence";
import { MAJOR_STAR_MEANINGS, type Polarity, type StarMeaning } from "./starInterpretations";
import type { InterpretationFact } from "./interpretationFacts";

export type NatureDomain = "coreNature" | "lifeDirection" | "socialImpression" | "lifeAttitude";

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

function finalize(domain: NatureDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({ id: `${domain}-${i}`, strength: countByPolarity[d.polarity], ...d }));
}

function push(drafts: FactDraft[], domain: NatureDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], borrowed?: boolean) {
  if (!m) return;
  drafts.push({ domain, meaning: m.meaning, polarity: m.polarity, evidence, borrowed });
}

/** 타고난 성향 주제 전용 사화 문구 — 배우자/재물/커리어 문맥 잔재 없음. */
const NATURE_TOPIC_SIHUA: Record<SihuaKind, StarMeaning> = {
  化祿: { meaning: "타고나기를 여유 있고 복이 따르는 기질", polarity: "positive" },
  化權: { meaning: "타고나기를 주관이 뚜렷하고 주도적인 기질", polarity: "mixed" },
  化科: { meaning: "타고나기를 차분하고 평판이 따르는 기질", polarity: "positive" },
  化忌: { meaning: "스스로도 갈피를 못 잡고 흔들리기 쉬운 면", polarity: "risk" },
};

/** 身宮 관점 — 身宮은 "성격 그 자체"로 단정하지 않는다(대표 지시). 命宮의 타고난 기질과 달리,
 * "시간이 갈수록 힘이 실리기 쉬운 방향·집중 영역"이라는 잠정적·시간축 표현으로만 서술한다. */
const LIFE_DIRECTION_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "시간이 갈수록 명예와 인정을 얻는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  天機: { meaning: "시간이 갈수록 배우고 이해하는 영역에 집중이 쏠리기 쉬움", polarity: "positive" },
  太陽: { meaning: "시간이 갈수록 베풀고 드러내는 활동에 힘이 실리기 쉬움", polarity: "positive" },
  武曲: { meaning: "시간이 갈수록 실질적 성과를 만드는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  天同: { meaning: "시간이 갈수록 편안함과 조화를 유지하는 쪽에 무게가 실리기 쉬움", polarity: "positive" },
  廉貞: { meaning: "시간이 갈수록 매력과 존재감을 드러내는 쪽에 힘이 쏠리기 쉬움", polarity: "mixed" },
  天府: { meaning: "시간이 갈수록 안정적인 기반을 다지는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  太陰: { meaning: "시간이 갈수록 내면을 돌보고 다듬는 영역에 무게가 실리기 쉬움", polarity: "positive" },
  貪狼: { meaning: "시간이 갈수록 다양한 경험과 관계를 넓히는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  巨門: { meaning: "시간이 갈수록 말과 논리로 표현하는 영역에 집중이 쏠리기 쉬움", polarity: "mixed" },
  天相: { meaning: "시간이 갈수록 주변을 조율하고 돕는 쪽에 무게가 실리기 쉬움", polarity: "positive" },
  天梁: { meaning: "시간이 갈수록 원칙을 지키고 남을 보살피는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  七殺: { meaning: "시간이 갈수록 도전하고 밀어붙이는 쪽에 힘이 실리기 쉬움", polarity: "positive" },
  破軍: { meaning: "시간이 갈수록 틀을 깨고 새로 시작하는 쪽에 힘이 쏠리기 쉬움", polarity: "positive" },
};

/** 對宮(遷移宮) 관점 — "남에게 비치는 인상·대인관계에서 드러나는 모습". */
const SOCIAL_IMPRESSION_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "품위 있고 리더십 있는 사람으로 비치는 편", polarity: "positive" },
  天機: { meaning: "센스 있고 재치 있는 사람으로 비치는 편", polarity: "positive" },
  太陽: { meaning: "밝고 적극적인 사람으로 비치는 편", polarity: "positive" },
  武曲: { meaning: "믿음직하고 실속 있는 사람으로 비치는 편", polarity: "positive" },
  天同: { meaning: "편안하고 부드러운 사람으로 비치는 편", polarity: "positive" },
  廉貞: { meaning: "매력적이지만 종잡기 어려운 사람으로 비치는 편", polarity: "mixed" },
  天府: { meaning: "든든하고 안정적인 사람으로 비치는 편", polarity: "positive" },
  太陰: { meaning: "차분하고 다정한 사람으로 비치는 편", polarity: "positive" },
  貪狼: { meaning: "매력적이고 사교적인 사람으로 비치는 편", polarity: "positive" },
  巨門: { meaning: "똑똑하지만 예민해 보일 수 있는 사람으로 비치는 편", polarity: "mixed" },
  天相: { meaning: "단정하고 신뢰가는 사람으로 비치는 편", polarity: "positive" },
  天梁: { meaning: "믿을 수 있는 어른스러운 사람으로 비치는 편", polarity: "positive" },
  七殺: { meaning: "강렬하고 카리스마 있는 사람으로 비치는 편", polarity: "positive" },
  破軍: { meaning: "독특하고 예측하기 어려운 사람으로 비치는 편", polarity: "mixed" },
};

/** 三方(財帛宮·事業宮) 관점 — "삶을 대하는 태도"(재물/커리어 주제의 wealth/career 필드와는
 * 별개로, 실제 삶에서의 접근 방식에 초점). */
const LIFE_ATTITUDE_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "목표를 세우면 품위 있게 이끌어가는 태도", polarity: "positive" },
  天機: { meaning: "상황을 분석하고 유연하게 대응하는 태도", polarity: "positive" },
  太陽: { meaning: "적극적으로 나서서 해결하는 태도", polarity: "positive" },
  武曲: { meaning: "현실적으로 판단하고 꾸준히 밀어붙이는 태도", polarity: "positive" },
  天同: { meaning: "무리하지 않고 순리대로 풀어가는 태도", polarity: "positive" },
  廉貞: { meaning: "열정적으로 몰입하되 기복이 있는 태도", polarity: "mixed" },
  天府: { meaning: "차분하게 기반을 다지며 나아가는 태도", polarity: "positive" },
  太陰: { meaning: "섬세하게 살피며 신중하게 접근하는 태도", polarity: "positive" },
  貪狼: { meaning: "다재다능하게 여러 방면에 도전하는 태도", polarity: "positive" },
  巨門: { meaning: "논리적으로 파고들되 의심이 많아지는 태도", polarity: "mixed" },
  天相: { meaning: "균형을 잡고 중재하며 나아가는 태도", polarity: "positive" },
  天梁: { meaning: "원칙을 지키며 묵묵히 해내는 태도", polarity: "positive" },
  七殺: { meaning: "정면 돌파하며 밀어붙이는 태도", polarity: "positive" },
  破軍: { meaning: "기존 틀을 깨고 새로 판을 짜는 태도", polarity: "mixed" },
};

function resolveNatureStars(evidence: NatureEvidenceBundle): { stars: StarPlacement[]; sourcePalace: PalaceName; borrowed: boolean } {
  if (evidence.naturePalace.majorStars.length > 0) {
    return { stars: evidence.naturePalace.majorStars, sourcePalace: "命宮", borrowed: false };
  }
  return { stars: evidence.oppositePalace.majorStars, sourcePalace: evidence.oppositePalace.palace, borrowed: true };
}

/** 핵심 성향 — 命宮 본궁 + 사화(化忌 제외, "삶의 태도" 섹션 전용). */
export function coreNatureFacts(evidence: NatureEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveNatureStars(evidence);
  for (const star of stars) {
    push(drafts, "coreNature", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  for (const s of evidence.sihuaInScope) {
    if (s.kind === "化忌") continue;
    push(drafts, "coreNature", NATURE_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("coreNature", drafts);
}

/** 후천적 지향 — 身宮이 위치한 궁의 주성. */
export function lifeDirectionFacts(evidence: NatureEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const star of evidence.shenGongPalace.majorStars) {
    push(drafts, "lifeDirection", LIFE_DIRECTION_MEANINGS[star.name], [starEvidence(star.name, evidence.shenGongPalace.palace)]);
  }
  return finalize("lifeDirection", drafts);
}

/** 대인·외적 인상 — 對宮(遷移宮)의 주성. */
export function socialImpressionFacts(evidence: NatureEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const star of evidence.oppositePalace.majorStars) {
    push(drafts, "socialImpression", SOCIAL_IMPRESSION_MEANINGS[star.name], [starEvidence(star.name, evidence.oppositePalace.palace)]);
  }
  return finalize("socialImpression", drafts);
}

/** 삶의 태도·강점과 약점 — 三方(財帛宮·事業宮)의 주성 + 化忌(핵심 성향 섹션과 겹치지 않도록
 * 이 섹션 전용). */
export function lifeAttitudeFacts(evidence: NatureEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      push(drafts, "lifeAttitude", LIFE_ATTITUDE_MEANINGS[star.name], [starEvidence(star.name, p.palace)]);
    }
  }
  for (const s of evidence.sihuaInScope) {
    if (s.kind !== "化忌") continue;
    push(drafts, "lifeAttitude", NATURE_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("lifeAttitude", drafts);
}
