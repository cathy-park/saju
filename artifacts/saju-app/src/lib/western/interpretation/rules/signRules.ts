export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export interface SignRule {
  name: string;
  element: Element;
  modality: Modality;
  style: string;
  concept: string;
}

/** Interpretation-only table. Natal calculation payloads never contain these meanings. */
export const SIGN_RULES: SignRule[] = [
  { name: "Aries", element: "fire", modality: "cardinal", style: "빠르게 방향을 정하고 먼저 움직이는", concept: "initiative" },
  { name: "Taurus", element: "earth", modality: "fixed", style: "검증된 감각과 꾸준한 리듬을 지키는", concept: "stability" },
  { name: "Gemini", element: "air", modality: "mutable", style: "여러 관점을 비교하고 연결하는", concept: "exchange" },
  { name: "Cancer", element: "water", modality: "cardinal", style: "정서적 안전과 소속감을 먼저 살피는", concept: "protection" },
  { name: "Leo", element: "fire", modality: "fixed", style: "자신의 색을 분명하게 드러내는", concept: "expression" },
  { name: "Virgo", element: "earth", modality: "mutable", style: "세부를 점검하고 더 나은 방식을 찾는", concept: "improvement" },
  { name: "Libra", element: "air", modality: "cardinal", style: "관계와 상황의 균형점을 조율하는", concept: "balance" },
  { name: "Scorpio", element: "water", modality: "fixed", style: "표면 아래의 핵심을 끝까지 파고드는", concept: "depth" },
  { name: "Sagittarius", element: "fire", modality: "mutable", style: "경험의 범위를 넓혀 의미를 찾는", concept: "exploration" },
  { name: "Capricorn", element: "earth", modality: "cardinal", style: "장기 기준과 책임 구조를 세우는", concept: "structure" },
  { name: "Aquarius", element: "air", modality: "fixed", style: "관습과 거리를 두고 자기 방식으로 재구성하는", concept: "independence" },
  { name: "Pisces", element: "water", modality: "mutable", style: "미묘한 분위기와 가능성을 직관적으로 받아들이는", concept: "sensitivity" },
];

export const ELEMENT_EMPHASIS: Record<Element, string> = {
  fire: "생각을 행동으로 옮기며 직접 경험해보려는 흐름이 반복됩니다.",
  earth: "현실에서 작동하는 방식과 지속 가능한 결과를 중시하는 흐름이 반복됩니다.",
  air: "관점을 비교하고 개념을 연결해 이해하려는 흐름이 반복됩니다.",
  water: "감정의 맥락과 관계의 미묘한 변화를 살피는 흐름이 반복됩니다.",
};

export const MODALITY_EMPHASIS: Record<Modality, string> = {
  cardinal: "필요한 방향을 먼저 만들고 상황을 움직이려는 태도가 여러 영역에서 확인됩니다.",
  fixed: "한번 납득한 기준과 리듬을 쉽게 바꾸지 않고 밀고 가는 태도가 여러 영역에서 확인됩니다.",
  mutable: "변화한 조건을 빠르게 읽고 방법을 조정하는 태도가 여러 영역에서 확인됩니다.",
};

export function signRuleAt(longitude: number): SignRule {
  return SIGN_RULES[Math.floor((((longitude % 360) + 360) % 360) / 30)];
}
