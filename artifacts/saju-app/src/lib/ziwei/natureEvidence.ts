// 命宮(명궁) 기준 구조/evidence 추출 — spouseEvidence.ts/wealthEvidence.ts/careerEvidence.ts와
// 동일한 패턴(본궁+對宮+三方+사화 in scope)을 命宮 대상으로 재구현한 것이다. 계산 엔진은
// 건드리지 않는다. 命宮의 三方四正: 命宮(본궁)-遷移宮(對宮, index+6)-財帛宮·事業宮(三方,
// index±4). 命宮은 이미 財帛宮·事業宮과 命財官 삼각형을 이루므로(재물/커리어 주제와 공유),
// 이 주제만의 고유 축은 身宮이다 — 命宮=타고난 기질, 身宮=후천적으로 힘쓰는 방향이라는 정통
// 구분을 evidence에 그대로 반영한다.
import type { Palace, PalaceName, SihuaKind, StarPlacement, ZiweiChart } from "./types";

export interface NatureEvidenceBundle {
  naturePalace: Palace;
  oppositePalace: Palace;
  trinePalaces: Palace[];
  shenGongPalace: Palace;
  sanfangSizhengPalaces: Palace[];
  sanfangSizhengStars: { palace: PalaceName; stars: StarPlacement[] }[];
  sihuaInScope: { kind: SihuaKind; star: string; palace: PalaceName }[];
}

function palaceOf(chart: ZiweiChart, name: PalaceName): Palace {
  const p = chart.palaces.find((x) => x.palace === name);
  if (!p) throw new Error(`궁을 찾을 수 없습니다: ${name}`);
  return p;
}

export function extractNatureEvidence(chart: ZiweiChart): NatureEvidenceBundle {
  const naturePalace = palaceOf(chart, "命宮");
  const oppositePalace = palaceOf(chart, naturePalace.oppositePalace);
  const trinePalaces = naturePalace.trinePalaces.map((name) => palaceOf(chart, name));
  const shenGongPalace = palaceOf(chart, chart.shenGong.palace);
  const sanfangSizhengPalaces = [naturePalace, oppositePalace, ...trinePalaces];
  const sanfangSizhengStars = sanfangSizhengPalaces.map((p) => ({
    palace: p.palace,
    stars: [...p.majorStars, ...p.minorStars],
  }));
  const sanfangBranches = new Set(sanfangSizhengPalaces.map((p) => p.branch));
  const sihuaInScope = (Object.entries(chart.birthYearTransformations) as [SihuaKind, { star: string; palace: PalaceName }][])
    .filter(([, v]) => sanfangBranches.has(palaceOf(chart, v.palace).branch))
    .map(([kind, v]) => ({ kind, star: v.star, palace: v.palace }));

  return { naturePalace, oppositePalace, trinePalaces, shenGongPalace, sanfangSizhengPalaces, sanfangSizhengStars, sihuaInScope };
}
