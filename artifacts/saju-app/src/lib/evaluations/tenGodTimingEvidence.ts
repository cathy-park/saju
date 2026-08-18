/**
 * 십성 그룹(식상/재성/관성/인성) 단위 대운·세운 timing evidence 공통 로직.
 *
 * careerActivation.ts의 pushGroupEvidence/axisTotal(diminishing-returns 그룹 합산)과 동일한
 * 패턴을 일반화해서 뽑아낸 것이다. officerActivation/careerActivation/wealthActivation은
 * 이미 검증된 상태라 건드리지 않고, examCareerActivation·contractActivation처럼 "여러
 * 십성 그룹을 동시에 다루면서 최종 점수는 도메인마다 다르게 가중해야 하는" 새 모듈들이
 * 이 공통 evidence 함수만 재사용하고 최종 스코어링은 각자 파일에서 따로 한다.
 */

import {
  type FiveElKey,
  GENERATES,
  CONTROLS,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";

export type TenGodGroup = "식상" | "재성" | "관성" | "인성";

/** 일간 기준 4개 십성 그룹의 오행. 식상=일간이 생하는 오행, 재성=일간이 극하는 오행,
 * 관성=일간을 극하는 오행, 인성=일간을 생하는 오행. */
export function tenGodGroupElement(dm: FiveElKey, group: TenGodGroup): FiveElKey {
  if (group === "식상") return GENERATES[dm];
  if (group === "재성") return CONTROLS[dm];
  if (group === "관성") return getController(dm);
  return getGenerator(dm); // 인성
}

export interface TenGodEvidenceFactor<TCategory extends string = string> {
  label: string;
  /** 항상 양수 — activation은 이 값의 절댓값 합, direction은 부호 있는 합 */
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
  category: TCategory;
}

export function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

export function charElement(kind: "천간" | "지지", ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return (kind === "천간" ? STEM_TO_ELEMENT[ch] : BRANCH_TO_ELEMENT[ch]) as FiveElKey | undefined;
}

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * 한 글자(천간 또는 지지)가 특정 십성 그룹에 대해 만드는 evidence를 하나만 push한다
 * (careerActivation.pushGroupEvidence와 동일 우선순위: 생조·극제 > 용신 > 희신·기신 > 등장).
 */
export function pushTenGodGroupEvidence<TCategory extends string>(
  factors: TenGodEvidenceFactor<TCategory>[],
  tag: string,
  category: TCategory,
  el: FiveElKey,
  groupEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
  emphasis: number,
): void {
  const push = (suffix: string, magnitude: number, direction: "우호" | "비우호" | "중립") => {
    const m = Math.round(magnitude * emphasis);
    if (m > 0) factors.push({ label: `${tag} ${suffix}`, magnitude: m, direction, category });
  };
  if (el === getGenerator(groupEl)) { push("생조 구조(순조로운 흐름)", 5, "우호"); return; }
  if (el === getController(groupEl)) { push("극제 구조(충돌·저항)", 6, "비우호"); return; }
  if (el === yongshin) { push("용신 일치", 5, "우호"); return; }
  if (gisin && el === gisin) { push("기신 일치(부담)", 5, "비우호"); return; }
  if (heesin && el === heesin) { push("희신 일치", 3, "우호"); return; }
  if (el === groupEl) push("등장(사건 크기)", 4, "중립");
}

/**
 * 그룹별 category cap 적용 후 diminishing-returns(가장 강한 그룹 100%, 그다음 50%, 25%, ...)
 * 로 axis 합산한다. careerActivation.axisTotal과 동일한 방식이며 그룹 개수만 가변이다.
 */
export function diminishingAxisTotal<TCategory extends string>(
  factors: TenGodEvidenceFactor<TCategory>[],
  signed: boolean,
  categoryCap: number,
  weights: number[] = [1, 0.5, 0.25, 0.125],
): number {
  const byGroup = new Map<TCategory, number>();
  for (const f of factors) {
    const value = signed
      ? f.direction === "우호" ? f.magnitude : f.direction === "비우호" ? -f.magnitude : 0
      : f.magnitude;
    byGroup.set(f.category, (byGroup.get(f.category) ?? 0) + value);
  }
  const capped = [...byGroup.values()].map((v) => Math.max(-categoryCap, Math.min(categoryCap, v)));
  capped.sort((a, b) => Math.abs(b) - Math.abs(a));
  return capped.reduce((sum, v, i) => sum + v * (weights[i] ?? 0), 0);
}
