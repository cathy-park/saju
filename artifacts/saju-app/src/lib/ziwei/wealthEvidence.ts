// 財帛宮(재물궁) 기준 구조/evidence 추출 — spouseEvidence.ts와 동일한 패턴(본궁+對宮+三方+
// 사화 in scope)을 財帛宮 대상으로 재구현한 것이다. 계산 엔진(buildZiweiChart 등)은 전혀
// 건드리지 않고, 이미 계산된 palaces/sihua 배열에서 財帛宮 삼방사정만 재조합한다.
// 財帛宮의 三方四正: 財帛宮(본궁)-福德宮(對宮, index+6)-命宮·事業宮(三方, index±4) —
// 命宮·財帛宮·事業宮은 서로 4칸씩 떨어진 "命財官" 삼각형을 이룬다(유파 무관 공통 구조).
// 이 파일도 spouseEvidence.ts와 마찬가지로 해석 문장은 만들지 않는다(순수 구조 추출).
import type { Palace, PalaceName, SihuaKind, StarPlacement, ZiweiChart } from "./types";

export interface WealthEvidenceBundle {
  wealthPalace: Palace;
  oppositePalace: Palace;
  trinePalaces: Palace[];
  sanfangSizhengPalaces: Palace[];
  sanfangSizhengStars: { palace: PalaceName; stars: StarPlacement[] }[];
  sihuaInScope: { kind: SihuaKind; star: string; palace: PalaceName }[];
}

function palaceOf(chart: ZiweiChart, name: PalaceName): Palace {
  const p = chart.palaces.find((x) => x.palace === name);
  if (!p) throw new Error(`궁을 찾을 수 없습니다: ${name}`);
  return p;
}

export function extractWealthEvidence(chart: ZiweiChart): WealthEvidenceBundle {
  const wealthPalace = palaceOf(chart, "財帛宮");
  const oppositePalace = palaceOf(chart, wealthPalace.oppositePalace);
  const trinePalaces = wealthPalace.trinePalaces.map((name) => palaceOf(chart, name));
  const sanfangSizhengPalaces = [wealthPalace, oppositePalace, ...trinePalaces];
  const sanfangSizhengStars = sanfangSizhengPalaces.map((p) => ({
    palace: p.palace,
    stars: [...p.majorStars, ...p.minorStars],
  }));
  const sanfangBranches = new Set(sanfangSizhengPalaces.map((p) => p.branch));
  const sihuaInScope = (Object.entries(chart.birthYearTransformations) as [SihuaKind, { star: string; palace: PalaceName }][])
    .filter(([, v]) => sanfangBranches.has(palaceOf(chart, v.palace).branch))
    .map(([kind, v]) => ({ kind, star: v.star, palace: v.palace }));

  return { wealthPalace, oppositePalace, trinePalaces, sanfangSizhengPalaces, sanfangSizhengStars, sihuaInScope };
}
