import type { AspectType, PlanetId } from "../../types";

export type OrbBand = "exact" | "close" | "supporting";
export const ORB_BAND_ORDER: Record<OrbBand, number> = { exact: 0, close: 1, supporting: 2 };
export function orbBand(orb: number): OrbBand { return orb <= 1 ? "exact" : orb <= 3 ? "close" : "supporting"; }

export const PLANET_ROLE_RULES: Record<PlanetId, { role: string; action: string }> = {
  sun: { role: "핵심 정체성", action: "자신이 중요하게 여기는 방향을 세웁니다" },
  moon: { role: "감정과 욕구", action: "마음을 안정시키고 필요를 표현합니다" },
  mercury: { role: "사고와 소통", action: "정보를 이해하고 생각을 전달합니다" },
  venus: { role: "가치와 취향", action: "좋고 싫음의 기준을 정하고 관계의 거리를 조절합니다" },
  mars: { role: "행동과 추진력", action: "원하는 것을 향해 힘을 사용합니다" },
  jupiter: { role: "확장과 성장", action: "가능성을 넓히고 경험에서 의미를 찾습니다" },
  saturn: { role: "책임과 제약", action: "기준을 세우고 오래 유지할 구조를 만듭니다" },
  uranus: { role: "변화와 독립성", action: "낡은 방식을 벗어나 새로운 선택지를 만듭니다" },
  neptune: { role: "감수성과 이상", action: "보이지 않는 분위기와 이상을 받아들입니다" },
  pluto: { role: "집중과 변환", action: "핵심 문제를 끝까지 파고들어 바꿉니다" },
};

export const ASPECT_TYPE_RULES: Record<AspectType, { relation: "support" | "tension" | "fusion"; connector: string }> = {
  conjunction: { relation: "fusion", connector: "두 기능이 한 흐름으로 강하게 묶입니다" },
  sextile: { relation: "support", connector: "두 기능이 필요할 때 서로를 보완합니다" },
  square: { relation: "tension", connector: "두 기능이 동시에 작동할 때 우선순위를 조율해야 합니다" },
  trine: { relation: "support", connector: "두 기능이 큰 마찰 없이 자연스럽게 이어집니다" },
  opposition: { relation: "tension", connector: "상황에 따라 두 기능 사이를 오가며 균형을 찾아야 합니다" },
};

export const ASPECT_PAIR_RULES: Partial<Record<`${PlanetId}:${PlanetId}`, Partial<Record<AspectType, string>>>> = {
  "sun:jupiter": { square: "자기 기준을 지키려는 마음과 더 크게 시도하려는 마음이 함께 커져, 범위를 정하는 판단이 중요합니다" },
  "moon:saturn": { opposition: "기본적으로 정서적 안전을 살피지만, 책임이 걸린 상황에서는 감정을 누르고 해야 할 일을 먼저 처리합니다" },
  "mercury:jupiter": { trine: "생각을 전할 때 큰 맥락과 가능성을 자연스럽게 연결합니다" },
  "venus:mars": { square: "좋다고 느끼는 방향과 당장 행동하고 싶은 방향이 어긋날 때 성급한 선택과 뒤늦은 재검토가 번갈아 나타날 수 있습니다" },
  "venus:pluto": { square: "좋고 싫음의 기준이 분명하고, 중요한 대상에는 표면적인 만족보다 깊이 있는 몰입을 요구합니다" },
  "mars:pluto": { opposition: "행동을 시작하면 핵심을 바꿀 때까지 밀어붙이는 힘이 강해, 힘을 쓸 범위를 의식적으로 정하는 편이 좋습니다" },
  "saturn:neptune": { conjunction: "막연한 이상을 현실에서 유지 가능한 구조로 바꾸는 힘이 한 흐름으로 묶입니다" },
  "uranus:neptune": { conjunction: "새로운 가능성을 감지하면 익숙한 방식 밖의 선택지로 구체화하려 합니다" },
};

export function pairKey(a: PlanetId, b: PlanetId): `${PlanetId}:${PlanetId}` {
  const order = Object.keys(PLANET_ROLE_RULES) as PlanetId[];
  return order.indexOf(a) < order.indexOf(b) ? `${a}:${b}` : `${b}:${a}`;
}
