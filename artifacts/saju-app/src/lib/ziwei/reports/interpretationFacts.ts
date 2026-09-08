// 夫妻宮 본궁 + 生年四化 + 對宮 + 三方四正 + 보조성의 조합에서 "의미 사실(fact)"을 먼저
// 뽑아내고, 그 facts를 하나의 문장으로 합성하는 중간 레이어. 이전 버전처럼 "별 하나 → 카테고리
// 문장 하나"를 그대로 갖다 붙이지 않는다 — 카테고리(domain)별로 evidence 소스 자체를 다르게
// 두고(대표 지시), 같은 결론을 지지하는 evidence가 많을수록 strength를 높인 뒤, 하나의
// 결합된 문단으로 합성한다.
import type { EvidenceItem, Palace, PalaceName, StarPlacement } from "../types";
import type { SpouseEvidenceBundle } from "../spouseEvidence";
import {
  MAJOR_STAR_MEANINGS, SIHUA_MEANINGS, AUXILIARY_MEANINGS, type Polarity, type StarMeaning,
  MEETING_PATTERN_BY_STAR, MEETING_PATTERN_TEXT, type MeetingPattern,
  CAREER_PATTERN_BY_STAR, CAREER_PATTERN_TEXT, type CareerPattern,
} from "./starInterpretations";
import { type ReportFact, synthesizeText as synthesizeReportText } from "@/lib/reportFacts";

export type InterpretationDomain =
  | "coreImage" | "personality" | "appearance" | "career" | "wealth"
  | "meeting" | "relationship" | "compatibility" | "ageGap";

/** InterpretationFact는 공용 ReportFact(src/lib/reportFacts.ts)에 자미두수 전용 evidence
 * 타입(EvidenceItem)만 꽂은 것이다 — 계산 로직·필드는 전혀 바뀌지 않았다(순수 재배치). */
export type InterpretationFact = ReportFact<EvidenceItem>;

function starEvidence(name: string, palace: PalaceName): EvidenceItem {
  return { type: "star", value: `${name}@${palace}` };
}
function sihuaEvidence(kind: string, star: string, palace: PalaceName): EvidenceItem {
  return { type: "transformation", value: `${kind}(${star})@${palace}` };
}

/** 夫妻宮의 주성(空宮이면 對宮에서 빌려온 주성)과, 실제로 어느 궁에 있었는지. */
export function resolveGoverningMajors(evidence: SpouseEvidenceBundle): {
  stars: StarPlacement[];
  sourcePalace: PalaceName;
  borrowed: boolean;
} {
  if (evidence.spousePalace.majorStars.length > 0) {
    return { stars: evidence.spousePalace.majorStars, sourcePalace: "夫妻宮", borrowed: false };
  }
  return { stars: evidence.oppositePalace.majorStars, sourcePalace: evidence.oppositePalace.palace, borrowed: true };
}

type FactDraft = Omit<InterpretationFact, "id" | "strength">;

/** 같은 domain 안에서 같은 polarity(=같은 결론 방향)를 지지하는 fact가 많을수록 strength가
 * 높아진다 — "단일 별 하나보다 복수 evidence가 같은 결론을 지지할 때 강도를 높인다"는 요구사항. */
function finalize(domain: InterpretationDomain, drafts: FactDraft[]): InterpretationFact[] {
  const countByPolarity: Record<Polarity, number> = { positive: 0, mixed: 0, risk: 0, neutral: 0 };
  for (const d of drafts) countByPolarity[d.polarity]++;
  return drafts.map((d, i) => ({
    id: `${domain}-${i}`,
    strength: countByPolarity[d.polarity],
    ...d,
  }));
}

function push(drafts: FactDraft[], domain: InterpretationDomain, m: StarMeaning | undefined, evidence: EvidenceItem[], borrowed?: boolean) {
  if (!m) return;
  drafts.push({ domain, meaning: m.meaning, polarity: m.polarity, evidence, borrowed });
}

// ── 도메인별 fact 생성기 (evidence 소스를 도메인마다 다르게 둔다) ─────────────

/** 핵심 배우자상 — 본궁 주성 + 사화 + 삼방 주성 + 對宮 주성, 5축을 전부 모아 하나로 합성될
 * 재료를 만든다(acceptance 요구사항: 貪狼/化權/化忌/三方 七殺·破軍/對宮 廉貞이 한 문장으로). */
export function coreImageFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    push(drafts, "coreImage", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  for (const s of evidence.sihuaInScope) {
    push(drafts, "coreImage", SIHUA_MEANINGS[s.kind]?.relationship, [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      push(drafts, "coreImage", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, p.palace)]);
    }
  }
  for (const star of evidence.oppositePalace.majorStars) {
    push(drafts, "coreImage", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, evidence.oppositePalace.palace)]);
  }
  return finalize("coreImage", drafts);
}

/** 성격 — 夫妻宮 본궁 + 生年四化 + 三方(對宮 제외). */
export function personalityFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    push(drafts, "personality", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  for (const s of evidence.sihuaInScope) {
    push(drafts, "personality", SIHUA_MEANINGS[s.kind]?.personality, [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      push(drafts, "personality", MAJOR_STAR_MEANINGS[star.name]?.personality, [starEvidence(star.name, p.palace)]);
    }
  }
  return finalize("personality", drafts);
}

/** 외모·첫인상 — 夫妻宮 중심 + 對宮 보조(대표 지시: 성격/사화/삼방과 분리). */
export function appearanceFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    push(drafts, "appearance", MAJOR_STAR_MEANINGS[star.name]?.appearance, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  if (!borrowed) {
    for (const star of evidence.oppositePalace.majorStars) {
      push(drafts, "appearance", MAJOR_STAR_MEANINGS[star.name]?.appearance, [starEvidence(star.name, evidence.oppositePalace.palace)]);
    }
  }
  return finalize("appearance", drafts);
}

function clusterByPattern<TPattern extends string>(
  palaces: Palace[],
  patternByStar: Record<string, TPattern>,
): Map<TPattern, EvidenceItem[]> {
  const byPattern = new Map<TPattern, EvidenceItem[]>();
  for (const p of palaces) {
    for (const star of [...p.majorStars, ...p.minorStars]) {
      const pattern = patternByStar[star.name];
      if (!pattern) continue;
      const list = byPattern.get(pattern) ?? [];
      list.push(starEvidence(star.name, p.palace));
      byPattern.set(pattern, list);
    }
  }
  return byPattern;
}

/** 직업·사회적 위치 — 夫妻宮 본궁은 그대로 개별 반영하고, 官祿축(對宮)+三方은 별 하나하나를
 * 다 나열하지 않고 2~3개 상위 패턴(전문성/사회적 지위·귀인/도전)으로 압축한다. */
export function careerFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    push(drafts, "career", MAJOR_STAR_MEANINGS[star.name]?.career, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  const byPattern = clusterByPattern<CareerPattern>([evidence.oppositePalace, ...evidence.trinePalaces], CAREER_PATTERN_BY_STAR);
  for (const [pattern, ev] of byPattern) {
    const text = CAREER_PATTERN_TEXT[pattern];
    drafts.push({ domain: "career", meaning: text.meaning, polarity: text.polarity, evidence: ev });
  }
  return finalize("career", drafts);
}

/** 경제 성향 — 배우자 관련 재물 구조(夫妻宮 + 財帛宮 + 사화). */
export function wealthFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    push(drafts, "wealth", MAJOR_STAR_MEANINGS[star.name]?.wealth, [starEvidence(star.name, sourcePalace)], borrowed);
  }
  const caibo = evidence.relatedPalaces.財帛宮;
  for (const star of caibo.majorStars) {
    push(drafts, "wealth", MAJOR_STAR_MEANINGS[star.name]?.wealth, [starEvidence(star.name, "財帛宮")]);
  }
  for (const s of evidence.sihuaInScope) {
    push(drafts, "wealth", SIHUA_MEANINGS[s.kind]?.wealth, [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  return finalize("wealth", drafts);
}

/** 만남 환경 — 遷移/交友/官祿 등 "관계 밖" 궁 근거(현재 evidence bundle에 포함된 對宮=官祿,
 * 三方의 遷移宮·福德宮만 사용 — 交友宮은 spouseEvidence.ts가 아직 추출하지 않아 임의 확장하지
 * 않는다). 夫妻宮 본궁 자체는 "환경"이 아니라 "관계 그 자체"이므로 제외한다. 별 하나하나를 다
 * 나열하지 않고 2~3개 상위 패턴(사교/귀인·조력/로맨틱)으로 압축한다. */
export function meetingFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const byPattern = clusterByPattern<MeetingPattern>([evidence.oppositePalace, ...evidence.trinePalaces], MEETING_PATTERN_BY_STAR);
  for (const [pattern, ev] of byPattern) {
    const text = MEETING_PATTERN_TEXT[pattern];
    drafts.push({ domain: "meeting", meaning: text.meaning, polarity: text.polarity, evidence: ev });
  }
  return finalize("meeting", drafts);
}

/** 연애관계 모습 — 성격/만남과 다른 문구(관계가 "작동하는 방식")로 夫妻宮 사화 + 삼방사정
 * 보조성만 사용한다. 主星 자체의 personality/appearance 문구는 재사용하지 않는다(중복 제거). */
export function relationshipFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  for (const s of evidence.sihuaInScope) {
    push(drafts, "relationship", SIHUA_MEANINGS[s.kind]?.relationship, [sihuaEvidence(s.kind, s.star, s.palace)]);
  }
  for (const group of evidence.sanfangSizhengStars) {
    for (const star of group.stars) {
      push(drafts, "relationship", AUXILIARY_MEANINGS[star.name]?.relationship, [starEvidence(star.name, group.palace)]);
    }
  }
  return finalize("relationship", drafts);
}

/** 잘 맞는/피해야 할 유형 — 전체 구조(본궁+대궁+삼방 主星, 사화)의 종합. positive/mixed는
 * "잘 맞는" 쪽, risk는 "피해야 할" 쪽으로 report 레이어가 나눈다. */
export function compatibilityFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const drafts: FactDraft[] = [];
  const { stars, sourcePalace } = resolveGoverningMajors(evidence);
  for (const star of stars) {
    const set = MAJOR_STAR_MEANINGS[star.name];
    if (!set) continue;
    drafts.push({ domain: "compatibility", meaning: set.compatibilityWell.meaning, polarity: "positive", evidence: [starEvidence(star.name, sourcePalace)] });
    drafts.push({ domain: "compatibility", meaning: set.compatibilityAvoid.meaning, polarity: "risk", evidence: [starEvidence(star.name, sourcePalace)] });
  }
  for (const p of evidence.trinePalaces) {
    for (const star of p.majorStars) {
      const set = MAJOR_STAR_MEANINGS[star.name];
      if (!set) continue;
      drafts.push({ domain: "compatibility", meaning: set.compatibilityWell.meaning, polarity: "positive", evidence: [starEvidence(star.name, p.palace)] });
      drafts.push({ domain: "compatibility", meaning: set.compatibilityAvoid.meaning, polarity: "risk", evidence: [starEvidence(star.name, p.palace)] });
    }
  }
  return finalize("compatibility", drafts);
}

// ── 문장 합성 ────────────────────────────────────────────────────
// synthesizeText의 실제 구현은 src/lib/reportFacts.ts(공용)로 옮겼다 — 로직·문구는 전혀
// 바뀌지 않았다(순수 재배치). 기존에 이 파일에서 synthesizeText를 import하던 8개 리포트
// 파일이 계속 동작하도록 이름만 그대로 재노출한다.
export const synthesizeText = synthesizeReportText;
