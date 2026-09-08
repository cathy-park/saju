// 事業宮(관록궁/사업궁) 기준 구조/evidence 추출 — spouseEvidence.ts/wealthEvidence.ts와 동일한
// 패턴(본궁+對宮+三方+사화 in scope)을 事業宮 대상으로 재구현한 것이다. 계산 엔진은 건드리지
// 않는다. 事業宮의 三方四正: 事業宮(본궁)-夫妻宮(對宮, index+6)-命宮·財帛宮(三方, index±4).
// 재물(財帛宮 중심) 주제와 命-財-官 삼각형을 공유하지만 본궁이 달라 evidence 소스가 다르다:
// 재물=財帛宮 관점(어떻게 벌고 모으고 운용하나), 커리어=事業宮 관점(어떤 방식으로 일하고
// 어떤 역할/환경에서 성취하나).
import type { Palace, PalaceName, SihuaKind, StarPlacement, ZiweiChart } from "./types";

export interface CareerEvidenceBundle {
  careerPalace: Palace;
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

export function extractCareerEvidence(chart: ZiweiChart): CareerEvidenceBundle {
  const careerPalace = palaceOf(chart, "事業宮");
  const oppositePalace = palaceOf(chart, careerPalace.oppositePalace);
  const trinePalaces = careerPalace.trinePalaces.map((name) => palaceOf(chart, name));
  const sanfangSizhengPalaces = [careerPalace, oppositePalace, ...trinePalaces];
  const sanfangSizhengStars = sanfangSizhengPalaces.map((p) => ({
    palace: p.palace,
    stars: [...p.majorStars, ...p.minorStars],
  }));
  const sanfangBranches = new Set(sanfangSizhengPalaces.map((p) => p.branch));
  const sihuaInScope = (Object.entries(chart.birthYearTransformations) as [SihuaKind, { star: string; palace: PalaceName }][])
    .filter(([, v]) => sanfangBranches.has(palaceOf(chart, v.palace).branch))
    .map(([kind, v]) => ({ kind, star: v.star, palace: v.palace }));

  return { careerPalace, oppositePalace, trinePalaces, sanfangSizhengPalaces, sanfangSizhengStars, sihuaInScope };
}
