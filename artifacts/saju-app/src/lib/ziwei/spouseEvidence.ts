// 夫妻宮(부처궁) 기준 구조/evidence 추출 — canonical payload에서 이미 계산된 값만 재조합한다.
// 이 파일은 순수 함수만 담고, 해석 문장(자연어)은 절대 만들지 않는다(대표 지시). LLM 프롬프트
// 단계(2차 확장, ZiweiInterpretationPrompt.ts)가 이 구조체를 그대로 evidence로 받아 쓴다.
import type { Palace, PalaceName, StarPlacement, SihuaKind, ZiweiChart } from "./types";

export interface SpouseEvidenceBundle {
  /** 夫妻宮 본궁. */
  spousePalace: Palace;
  /** 對宮(=事業宮/官祿宮, index+6). 고전 명칭상 官祿宮과 동일 궁이다. */
  oppositePalace: Palace;
  /** 三方(index±4) 두 궁. */
  trinePalaces: Palace[];
  /** 三方四正 전체(본궁+대궁+삼방 2곳) = 4개 궁의 별을 한 번에 모은 목록(중복 제거 없이 궁별 원본 유지). */
  sanfangSizhengPalaces: Palace[];
  sanfangSizhengStars: { palace: PalaceName; stars: StarPlacement[] }[];
  /** 命宮과의 관계 — 命宮은 항상 夫妻宮 기준 -2칸(즉 夫妻宮이 命宮+2칸)이다. */
  mingGongRelation: { mingGongPalace: Palace; offsetFromMingGong: 2 };
  /** 배우자 해석에서 자주 함께 참조하는 궁(대표 지시: 官祿宮·財帛宮·遷移宮 등). 官祿宮은
   * oppositePalace와 동일 궁이라 별도로 다시 담지 않는다 — 財帛宮만 추가로 포함. */
  relatedPalaces: { 財帛宮: Palace };
  /** 夫妻宮·對宮·三方에 들어오는 生年四化 전체(어느 궁에 어느 사화가 있는지). */
  sihuaInScope: { kind: SihuaKind; star: string; palace: PalaceName }[];
}

function palaceOf(chart: ZiweiChart, name: PalaceName): Palace {
  const p = chart.palaces.find((x) => x.palace === name);
  if (!p) throw new Error(`궁을 찾을 수 없습니다: ${name}`);
  return p;
}

export function extractSpouseEvidence(chart: ZiweiChart): SpouseEvidenceBundle {
  const spousePalace = palaceOf(chart, "夫妻宮");
  const oppositePalace = palaceOf(chart, spousePalace.oppositePalace);
  const trinePalaces = spousePalace.trinePalaces.map((name) => palaceOf(chart, name));
  const sanfangSizhengPalaces = [spousePalace, oppositePalace, ...trinePalaces];
  const sanfangSizhengStars = sanfangSizhengPalaces.map((p) => ({
    palace: p.palace,
    stars: [...p.majorStars, ...p.minorStars],
  }));
  const mingGongPalace = palaceOf(chart, "命宮");
  const sanfangBranches = new Set(sanfangSizhengPalaces.map((p) => p.branch));
  const sihuaInScope = (Object.entries(chart.birthYearTransformations) as [SihuaKind, { star: string; palace: PalaceName }][])
    .filter(([, v]) => sanfangBranches.has(palaceOf(chart, v.palace).branch))
    .map(([kind, v]) => ({ kind, star: v.star, palace: v.palace }));

  return {
    spousePalace,
    oppositePalace,
    trinePalaces,
    sanfangSizhengPalaces,
    sanfangSizhengStars,
    mingGongRelation: { mingGongPalace, offsetFromMingGong: 2 },
    relatedPalaces: { 財帛宮: palaceOf(chart, "財帛宮") },
    sihuaInScope,
  };
}
