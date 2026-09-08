// 연애 주제 — "배우자가 어떤 사람인가"(배우자 리포트)가 아니라 "나는 연애를 어떻게 하는가"에
// 초점을 둔다. evidence 소스는 spouseEvidence.ts의 extractSpouseEvidence()를 그대로
// 재사용한다(命宮·夫妻宮·對宮(官祿)·福德宮·생년사화가 이미 다 들어있어 새 evidence 추출
// 파일이 필요 없음). 다만 domain meaning은 배우자 리포트(personality/relationship/career/
// meeting 등)의 문구를 절대 재사용하지 않고 이 주제 전용으로 새로 정의했다 — 같은 별·사화를
// 보더라도 배우자 리포트는 "상대가 어떤 사람인지/관계에 무엇이 나타나는지", 이 주제는 "내가
// 연애할 때 어떻게 행동하는지"로 관점(1인칭 행동 묘사) 자체가 다르다.
//
// 4개 축: 끌림(attraction)·표현(expression)·갈등(conflict)·관계 운영(management).
// management는 새로 추가한 축이라 evidence가 실제로 있을 때만 fact를 만든다 — 근거가
// 약하면(對宮이 空宮이고 化祿·化權·化科도 scope에 없으면) 억지로 의미를 끼워 맞추지 않고
// 빈 배열을 반환한다(대표 지시). 다른 축과 달리 borrow/fallback 로직도 두지 않는다.
import type { EvidenceItem, PalaceName, SihuaKind, StarPlacement } from "../types";
import type { SpouseEvidenceBundle } from "../spouseEvidence";
import type { Polarity, StarMeaning } from "./starInterpretations";
import type { InterpretationFact } from "./interpretationFacts";

export type RomanceDomain = "attraction" | "expression" | "conflict" | "management";

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

function finalize(domain: RomanceDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0, neutral: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({ id: `${domain}-${i}`, strength: countByPolarity[d.polarity], ...d }));
}

function push(drafts: FactDraft[], domain: RomanceDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], borrowed?: boolean) {
  if (!m) return;
  drafts.push({ domain, meaning: m.meaning, polarity: m.polarity, evidence, borrowed });
}

/** 福德宮(夫妻宮의 三方, 욕구·정서적 기준을 상징) 기준 — "무엇에 끌리는지". */
const ATTRACTION_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "품위 있고 자기 세계가 뚜렷한 사람에게 끌리는 편", polarity: "positive" },
  天機: { meaning: "대화가 잘 통하고 머리 회전이 빠른 사람에게 끌리는 편", polarity: "positive" },
  太陽: { meaning: "밝고 에너지 넘치는 사람에게 끌리는 편", polarity: "positive" },
  武曲: { meaning: "믿음직하고 현실 감각 있는 사람에게 끌리는 편", polarity: "positive" },
  天同: { meaning: "함께 있으면 편안한 사람에게 끌리는 편", polarity: "positive" },
  廉貞: { meaning: "카리스마 있고 매력적인 사람에게 강하게 끌리는 편", polarity: "mixed" },
  天府: { meaning: "안정감 있고 든든한 사람에게 끌리는 편", polarity: "positive" },
  太陰: { meaning: "섬세하고 다정한 사람에게 끌리는 편", polarity: "positive" },
  貪狼: { meaning: "매력적이고 다재다능한 사람에게 끌리는 편", polarity: "positive" },
  巨門: { meaning: "말이 잘 통하고 솔직한 사람에게 끌리는 편", polarity: "positive" },
  天相: { meaning: "단정하고 신의 있는 사람에게 끌리는 편", polarity: "positive" },
  天梁: { meaning: "듬직하고 배려심 많은 사람에게 끌리는 편", polarity: "positive" },
  七殺: { meaning: "강단 있고 확실한 사람에게 끌리는 편", polarity: "positive" },
  破軍: { meaning: "틀에 갇히지 않는 개성 있는 사람에게 끌리는 편", polarity: "positive" },
};

/** 命宮 기준 — "호감·감정을 어떻게 드러내는지"(연애를 시작하는 방식이 아니라 표현 방식 한정). */
const EXPRESSION_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "품위를 지키면서도 은근히 주도권을 쥐는 방식으로 표현하는 편", polarity: "mixed" },
  天機: { meaning: "말과 눈치로 상대의 반응을 살피며 조심스럽게 표현하는 편", polarity: "positive" },
  太陽: { meaning: "먼저 다가가고 감정을 숨기지 않고 적극적으로 표현하는 편", polarity: "positive" },
  武曲: { meaning: "말보다 행동으로 진심을 보여주는 편", polarity: "mixed" },
  天同: { meaning: "편안한 태도로 자연스럽게 스며들듯 표현하는 편", polarity: "positive" },
  廉貞: { meaning: "강렬하게 몰입해 표현했다가 온도차가 크게 식기도 하는 편", polarity: "mixed" },
  天府: { meaning: "충분히 지켜본 뒤 신중하게 마음을 드러내는 편", polarity: "positive" },
  太陰: { meaning: "은은하고 다정하게, 시간을 들여 감정을 쌓아가며 표현하는 편", polarity: "positive" },
  貪狼: { meaning: "적극적으로 매력을 어필하고 밀당에도 능한 편", polarity: "positive" },
  巨門: { meaning: "대화와 말로 감정을 풀어내며 표현하는 편", polarity: "mixed" },
  天相: { meaning: "예의와 매너를 갖춰 신중하게 표현하는 편", polarity: "positive" },
  天梁: { meaning: "손윗사람처럼 챙기는 태도로 마음을 표현하는 편", polarity: "positive" },
  七殺: { meaning: "확신이 서면 직진하며 감정을 숨기지 않는 편", polarity: "positive" },
  破軍: { meaning: "예상 밖의 계기로 갑자기 감정을 터뜨리듯 표현하는 편", polarity: "mixed" },
};

/** 對宮(官祿宮 축, 夫妻宮의 표출 자리) 기준 — "관계를 어떻게 꾸리고 지속시키는지". management
 * 전용 evidence·meaning이며, 배우자 리포트의 career/meeting 문구와는 관점이 다르다(그쪽은
 * "상대의 직업/어디서 만나는지", 이쪽은 "내가 관계를 운영하는 방식"). */
const MANAGEMENT_OPPOSITE_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "격식 있는 틀을 만들어 관계를 안정적으로 관리해가는 편", polarity: "positive" },
  天機: { meaning: "상황 변화에 맞춰 유연하게 관계를 조율해가는 편", polarity: "positive" },
  太陽: { meaning: "적극적으로 헌신하며 관계를 이끌어가는 편", polarity: "positive" },
  武曲: { meaning: "실질적인 행동과 계획으로 관계를 꾸려가는 편", polarity: "positive" },
  天同: { meaning: "무리하지 않고 편안한 흐름으로 관계를 유지해가는 편", polarity: "positive" },
  廉貞: { meaning: "열정을 쏟아붓다가도 온도차가 크게 날 수 있는 편", polarity: "mixed" },
  天府: { meaning: "안정적인 기반을 다지며 꾸준히 관계를 지켜가는 편", polarity: "positive" },
  太陰: { meaning: "세심하게 챙기며 정서적으로 관계를 돌보는 편", polarity: "positive" },
  貪狼: { meaning: "다양한 자극과 이벤트로 관계에 활력을 불어넣는 편", polarity: "mixed" },
  巨門: { meaning: "대화와 논의로 관계의 방향을 맞춰가는 편", polarity: "mixed" },
  天相: { meaning: "균형과 조율로 관계를 매끄럽게 운영하는 편", polarity: "positive" },
  天梁: { meaning: "책임감 있게 관계를 챙기고 이끄는 편", polarity: "positive" },
  七殺: { meaning: "결단력 있게 관계의 방향을 밀어붙이는 편", polarity: "mixed" },
  破軍: { meaning: "관계에 변화와 새로움을 계속 시도하는 편", polarity: "mixed" },
};

/** 연애 주제 전용 사화 문구 — 化忌(위험)는 conflict로, 나머지(化祿·化權·化科)는 management로
 * 나눈다. 배우자 리포트 SIHUA_MEANINGS.relationship은 "관계에 나타나는 흐름"(3인칭 서술)이고,
 * 여기는 "내가 관계를 대하는 태도"(1인칭 행동)로 문구를 새로 정의했다. */
const CONFLICT_SIHUA: Partial<Record<SihuaKind, StarMeaning>> = {
  化忌: { meaning: "연애에서 집착하거나 상대의 마음을 의심하게 되기 쉬운 면", polarity: "risk" },
};
const CONFLICT_RISK_AUX: Record<string, StarMeaning> = {
  擎羊: { meaning: "감정이 격해지면 다투기 쉬운 면", polarity: "risk" },
  陀羅: { meaning: "관계 진전이 더디게 느껴지거나 갈등을 끌게 되는 면", polarity: "risk" },
  地空: { meaning: "이상만 좇다 현실적인 부분을 놓치기 쉬운 면", polarity: "risk" },
  地劫: { meaning: "이상만 좇다 현실적인 부분을 놓치기 쉬운 면", polarity: "risk" },
};
const MANAGEMENT_SIHUA: Partial<Record<SihuaKind, StarMeaning>> = {
  化祿: { meaning: "관계를 즐겁고 여유 있게 이어가려는 편", polarity: "positive" },
  化權: { meaning: "관계를 주도적으로 이끌고 결정해가려는 편", polarity: "mixed" },
  化科: { meaning: "관계에서도 신뢰와 체면을 지키려 신경 쓰는 편", polarity: "positive" },
};

function resolveMingGongStars(evidence: SpouseEvidenceBundle): { stars: StarPlacement[]; sourcePalace: PalaceName } {
  const mingGong = evidence.mingGongRelation.mingGongPalace;
  return { stars: mingGong.majorStars, sourcePalace: mingGong.palace };
}

/** 끌리는 포인트 — 福德宮(夫妻宮의 三方 중 욕구를 상징하는 궁)의 주성. */
export function attractionFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const fude = evidence.trinePalaces.find((p) => p.palace === "福德宮");
  if (!fude) return [];
  for (const star of fude.majorStars) {
    push(drafts, "attraction", ATTRACTION_MEANINGS[star.name], [starEvidence(star.name, fude.palace)]);
  }
  return finalize("attraction", drafts);
}

/** 표현 방식 — 命宮 본궁 주성. */
export function expressionFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace } = resolveMingGongStars(evidence);
  for (const star of stars) {
    push(drafts, "expression", EXPRESSION_MEANINGS[star.name], [starEvidence(star.name, sourcePalace)]);
  }
  return finalize("expression", drafts);
}

/** 갈등 대응 — 夫妻宮 삼방사정 내 化忌 + 살성(擎羊·陀羅·地空·地劫). 위험(risk) 신호만 다룬다. */
export function conflictFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const s of evidence.sihuaInScope) {
    push(drafts, "conflict", CONFLICT_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const group of evidence.sanfangSizhengStars) {
    for (const star of group.stars) {
      push(drafts, "conflict", CONFLICT_RISK_AUX[star.name], [starEvidence(star.name, group.palace)]);
    }
  }
  return finalize("conflict", drafts);
}

/** 관계 운영 — 對宮(官祿 축) 주성 + 化祿·化權·化科. 둘 다 scope에 없으면(對宮 空宮이고 해당
 * 사화도 없으면) 빈 배열을 반환한다 — 다른 축처럼 命宮/夫妻宮으로 억지로 대체하지 않는다. */
export function managementFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const star of evidence.oppositePalace.majorStars) {
    push(drafts, "management", MANAGEMENT_OPPOSITE_MEANINGS[star.name], [starEvidence(star.name, evidence.oppositePalace.palace)]);
  }
  for (const s of evidence.sihuaInScope) {
    push(drafts, "management", MANAGEMENT_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("management", drafts);
}
