import type { PlanetId } from "../../types.js";

export const SIGN_RULERS: Record<string, { primary: PlanetId; coRulers: PlanetId[] }> = {
  Aries: { primary: "mars", coRulers: [] }, Taurus: { primary: "venus", coRulers: [] },
  Gemini: { primary: "mercury", coRulers: [] }, Cancer: { primary: "moon", coRulers: [] },
  Leo: { primary: "sun", coRulers: [] }, Virgo: { primary: "mercury", coRulers: [] },
  Libra: { primary: "venus", coRulers: [] }, Scorpio: { primary: "mars", coRulers: ["pluto"] },
  Sagittarius: { primary: "jupiter", coRulers: [] }, Capricorn: { primary: "saturn", coRulers: [] },
  Aquarius: { primary: "saturn", coRulers: ["uranus"] }, Pisces: { primary: "jupiter", coRulers: ["neptune"] },
};

export const RELATIONSHIP_SIGN_RULES: Record<string, { affection: string; attraction: string; partnership: string }> = {
  Aries: { affection: "감정을 숨기기보다 먼저 표현하는", attraction: "솔직하고 주도적인", partnership: "서로의 의사를 분명히 밝히는" },
  Taurus: { affection: "꾸준한 행동과 감각적 편안함으로 마음을 전하는", attraction: "안정적인 기준과 일관성이 있는", partnership: "신뢰를 천천히 쌓아가는" },
  Gemini: { affection: "대화와 호기심으로 친밀감을 만드는", attraction: "생각을 활발히 주고받는", partnership: "변화를 함께 이야기할 수 있는" },
  Cancer: { affection: "돌봄과 정서적 반응으로 마음을 전하는", attraction: "마음을 세심하게 살피는", partnership: "안전한 소속감을 만드는" },
  Leo: { affection: "마음을 분명하고 따뜻하게 표현하는", attraction: "자기 색과 표현력이 뚜렷한", partnership: "서로를 인정하고 북돋는" },
  Virgo: { affection: "필요를 살피고 실제 도움으로 마음을 전하는", attraction: "세심하고 신뢰할 수 있는", partnership: "생활의 세부를 함께 조율하는" },
  Libra: { affection: "상대의 반응을 살피며 균형 있게 다가가는", attraction: "대화와 예의를 갖춘", partnership: "서로의 몫을 공정하게 조율하는" },
  Scorpio: { affection: "쉽게 열지 않지만 신뢰하면 깊이 몰입하는", attraction: "표면보다 내면의 진실을 나누는", partnership: "강한 신뢰와 경계를 함께 다루는" },
  Sagittarius: { affection: "함께 경험하며 마음의 범위를 넓히는", attraction: "새로운 관점과 경험을 가진", partnership: "성장을 막지 않고 응원하는" },
  Capricorn: { affection: "시간과 책임을 들여 진심을 증명하는", attraction: "자기 삶을 책임 있게 운영하는", partnership: "약속을 현실적인 구조로 만드는" },
  Aquarius: { affection: "친구처럼 생각을 나누고 각자의 개성을 존중하는", attraction: "관습에 얽매이지 않고 자기 관점이 있는", partnership: "가까움과 독립성을 함께 보장하는" },
  Pisces: { affection: "말로 다 설명하지 못한 감정까지 받아들이는", attraction: "공감과 상상력을 나눌 수 있는", partnership: "감정적 공감과 현실적 경계를 갖춘" },
};

export const RULER_HOUSE_RULES: Record<number, string> = {
  1: "관계에서도 주도권과 자기표현", 2: "공유하는 가치와 생활 안정", 3: "일상적인 대화와 이해", 4: "사적인 생활 기반과 정서적 소속",
  5: "즐거움과 창조적인 표현", 6: "생활 습관과 역할 분담", 7: "동등한 협력과 합의", 8: "깊은 신뢰와 공동 책임",
  9: "함께 배우고 관점을 넓히는 경험", 10: "공적인 목표와 책임", 11: "우정과 장기적인 방향", 12: "말없이 회복할 수 있는 내면의 공간",
};

export const RELATIONSHIP_ASPECT_RULES: Record<string, string> = {
  "venus:mars:square": "좋다고 느끼는 방향과 당장 행동하고 싶은 방향이 어긋날 수 있어, 표현의 속도를 맞추는 과정이 필요합니다",
  "venus:pluto:square": "중요한 관계에는 깊은 몰입을 요구하므로, 친밀함과 상대의 경계를 함께 확인해야 합니다",
  "mars:pluto:opposition": "갈등이 시작되면 결론이 날 때까지 밀어붙이기 쉬워, 힘겨루기가 되기 전에 멈출 기준이 필요합니다",
  "moon:saturn:opposition": "정서적 안전을 원하면서도 책임이 걸리면 감정을 뒤로 미룰 수 있어, 필요를 말로 확인하는 과정이 중요합니다",
  "moon:neptune:opposition": "상대의 분위기를 민감하게 받아들이므로, 짐작한 감정과 실제 의사를 구분할 필요가 있습니다",
  "saturn:neptune:conjunction": "공감과 이상을 약속·생활·책임처럼 지속 가능한 형태로 만들 때 관계가 안정됩니다",
  "sun:jupiter:square": "관계가 삶의 범위를 크게 넓힐 수 있지만, 서로의 방향이 자기 기준을 압도하지 않도록 조율해야 합니다",
  "mercury:jupiter:trine": "서로의 생각과 큰 방향을 대화로 연결하는 능력이 장기 관계를 돕습니다",
};
