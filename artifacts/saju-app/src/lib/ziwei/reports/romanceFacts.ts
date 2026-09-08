// 연애 주제 — "배우자가 어떤 사람인가"(배우자 리포트)가 아니라 "나는 연애를 어떻게 하는가"에
// 초점을 둔다. evidence 소스는 spouseEvidence.ts의 extractSpouseEvidence()를 그대로
// 재사용한다(命宮·夫妻宮·福德宮·생년사화가 이미 다 들어있어 새 evidence 추출 파일이 필요 없음).
// 다만 domain meaning은 배우자 리포트의 personality/relationship/compatibility 필드를 절대
// 재사용하지 않고 이 주제 전용으로 새로 정의했다 — 같은 夫妻宮 별을 보더라도 배우자 리포트는
// "상대가 어떤 사람인지", 이 주제는 "내가 연애할 때 어떻게 행동하는지"로 관점 자체가 달라서다.
import type { EvidenceItem, PalaceName, SihuaKind, StarPlacement } from "../types";
import type { SpouseEvidenceBundle } from "../spouseEvidence";
import { MAJOR_STAR_MEANINGS, type Polarity, type StarMeaning } from "./starInterpretations";
import type { InterpretationFact } from "./interpretationFacts";

export type RomanceDomain = "romanceStyle" | "attractionPoint" | "romanceCaution";

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

function finalize(domain: RomanceDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({ id: `${domain}-${i}`, strength: countByPolarity[d.polarity], ...d }));
}

function push(drafts: FactDraft[], domain: RomanceDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], borrowed?: boolean) {
  if (!m) return;
  drafts.push({ domain, meaning: m.meaning, polarity: m.polarity, evidence, borrowed });
}

/** 命宮 기준 — "연애를 시작하고 이어가는 방식"(성격 일반이 아니라 연애 국면 한정 서술). */
const ROMANCE_STYLE_MEANINGS: Record<string, StarMeaning> = {
  紫微: { meaning: "연애에서도 주도권을 쥐고 리드하려는 편", polarity: "mixed" },
  天機: { meaning: "연애 초반 탐색과 눈치싸움에 공을 들이는 편", polarity: "positive" },
  太陽: { meaning: "먼저 다가가고 적극적으로 표현하는 편", polarity: "positive" },
  武曲: { meaning: "감정 표현은 서투르지만 행동으로 진심을 보이는 편", polarity: "mixed" },
  天同: { meaning: "편안한 흐름을 따라가며 자연스럽게 스며드는 편", polarity: "positive" },
  廉貞: { meaning: "강렬하게 몰입했다가 온도차가 크게 식기도 하는 편", polarity: "mixed" },
  天府: { meaning: "충분히 지켜본 뒤 신중하게 마음을 여는 편", polarity: "positive" },
  太陰: { meaning: "은은하게 다가가며 감정을 천천히 쌓아가는 편", polarity: "positive" },
  貪狼: { meaning: "적극적으로 매력을 어필하고 밀당에도 능한 편", polarity: "positive" },
  巨門: { meaning: "말과 대화로 서로를 탐색하며 다가가는 편", polarity: "mixed" },
  天相: { meaning: "예의와 매너를 갖추고 신중하게 다가가는 편", polarity: "positive" },
  天梁: { meaning: "손윗사람처럼 챙기며 관계를 이끌어가는 편", polarity: "positive" },
  七殺: { meaning: "확신이 서면 직진하는 편", polarity: "positive" },
  破軍: { meaning: "예상 밖의 계기로 갑자기 마음이 움직이는 편", polarity: "mixed" },
};

/** 福德宮(夫妻宮의 三方, 욕구·정서적 기준을 상징) 기준 — "무엇에 끌리는지". */
const ATTRACTION_POINT_MEANINGS: Record<string, StarMeaning> = {
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

/** 연애 주제 전용 사화·살성 문구 — 배우자/재물/커리어/성향 문맥 잔재 없음. "연애에서 반복되기
 * 쉬운 어려움"에 초점. */
const ROMANCE_TOPIC_SIHUA: Record<SihuaKind, StarMeaning> = {
  化祿: { meaning: "연애 자체에서 즐거움과 여유를 느끼는 편", polarity: "positive" },
  化權: { meaning: "연애에서도 주도권을 가지려는 마음이 강해지는 편", polarity: "mixed" },
  化科: { meaning: "연애를 할 때도 체면과 평판을 신경 쓰는 편", polarity: "positive" },
  化忌: { meaning: "연애에서 집착하거나 상대의 마음을 의심하게 되기 쉬운 면", polarity: "risk" },
};
const ROMANCE_RISK_AUX: Record<string, StarMeaning> = {
  擎羊: { meaning: "감정이 격해지면 다투기 쉬운 면", polarity: "risk" },
  陀羅: { meaning: "관계 진전이 더디게 느껴지거나 끌게 되는 면", polarity: "risk" },
  地空: { meaning: "이상만 좇다 현실적인 부분을 놓치기 쉬운 면", polarity: "risk" },
  地劫: { meaning: "이상만 좇다 현실적인 부분을 놓치기 쉬운 면", polarity: "risk" },
};

function resolveMingGongStars(evidence: SpouseEvidenceBundle): { stars: StarPlacement[]; sourcePalace: PalaceName } {
  const mingGong = evidence.mingGongRelation.mingGongPalace;
  return { stars: mingGong.majorStars, sourcePalace: mingGong.palace };
}

/** 연애 스타일 — 命宮 본궁 주성. */
export function romanceStyleFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace } = resolveMingGongStars(evidence);
  for (const star of stars) {
    push(drafts, "romanceStyle", ROMANCE_STYLE_MEANINGS[star.name], [starEvidence(star.name, sourcePalace)]);
  }
  return finalize("romanceStyle", drafts);
}

/** 끌리는 포인트 — 福德宮(夫妻宮의 三方 중 욕구를 상징하는 궁)의 주성. */
export function attractionPointFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const fude = evidence.trinePalaces.find((p) => p.palace === "福德宮");
  if (!fude) return [];
  for (const star of fude.majorStars) {
    push(drafts, "attractionPoint", ATTRACTION_POINT_MEANINGS[star.name], [starEvidence(star.name, fude.palace)]);
  }
  return finalize("attractionPoint", drafts);
}

/** 연애 시 주의할 점 — 夫妻宮 삼방사정 내 사화 + 살성(擎羊·陀羅·地空·地劫). */
export function romanceCautionFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const s of evidence.sihuaInScope) {
    push(drafts, "romanceCaution", ROMANCE_TOPIC_SIHUA[s.kind], [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const group of evidence.sanfangSizhengStars) {
    for (const star of group.stars) {
      const m = ROMANCE_RISK_AUX[star.name];
      if (!m) continue;
      push(drafts, "romanceCaution", m, [starEvidence(star.name, group.palace)]);
    }
  }
  return finalize("romanceCaution", drafts);
}
