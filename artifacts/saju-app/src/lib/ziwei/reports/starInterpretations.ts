// 별/사화/보조성의 "원자적 의미 조각(semantic meaning fragment)" 지식베이스.
// 이전 버전(카테고리별 완성 문장을 그대로 이어붙이던 방식)의 후신 — 여기 담긴 값은 완성된
// 문장이 아니라 interpretationFacts.ts가 InterpretationFact.meaning으로 소비할 짧은 의미
// 조각이다. 실제 문장 합성(여러 fact를 하나의 배우자상으로 엮는 것)은 interpretationFacts.ts의
// synthesizeText()가 담당한다. 이 파일 자체는 "별 이름 → 통설 의미"만 아는 순수 데이터다.
import type { SihuaKind } from "../types";

export type Polarity = "positive" | "mixed" | "risk";
export interface StarMeaning {
  meaning: string;
  polarity: Polarity;
}

export interface StarMeaningSet {
  personality: StarMeaning;
  appearance: StarMeaning;
  career: StarMeaning;
  wealth: StarMeaning;
  relationship: StarMeaning; // 성격과는 다른 결 — "관계가 작동하는 방식"에 초점
  meeting: StarMeaning;      // 이 별이 삼방/대궁에 있을 때 만남 환경에 주는 의미
  compatibilityWell: StarMeaning;
  compatibilityAvoid: StarMeaning;
}

export const MAJOR_STAR_MEANINGS: Record<string, StarMeaningSet> = {
  紫微: {
    personality: { meaning: "자존심이 강하고 명예를 중시하는 리더 기질", polarity: "positive" },
    appearance: { meaning: "단정하고 품위 있는 인상", polarity: "positive" },
    career: { meaning: "사회적 지위가 뚜렷한 관리직 계열", polarity: "positive" },
    wealth: { meaning: "경제적 기반을 갖추려는 의지", polarity: "positive" },
    relationship: { meaning: "존중받고 싶어하며 관계 주도권에 예민한 태도", polarity: "mixed" },
    meeting: { meaning: "격식 있는 자리에서 이어지는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "상대를 세워주고 존중해주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "자존심 대 자존심으로 부딪히는 유형", polarity: "risk" },
  },
  天機: {
    personality: { meaning: "총명하고 생각이 많으며 변화를 즐기는 기질", polarity: "positive" },
    appearance: { meaning: "지적이고 섬세한 인상", polarity: "positive" },
    career: { meaning: "기획·분석 등 머리를 쓰는 직업군", polarity: "positive" },
    wealth: { meaning: "수입원이 여러 갈래로 변화하는 흐름", polarity: "mixed" },
    relationship: { meaning: "대화와 지적 교감을 중시하지만 잔걱정이 늘기 쉬운 태도", polarity: "mixed" },
    meeting: { meaning: "자연스러운 계기나 우연한 만남", polarity: "positive" },
    compatibilityWell: { meaning: "대화가 잘 통하고 생각을 있는 그대로 들어주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "무심하거나 대화를 회피하는 유형", polarity: "risk" },
  },
  太陽: {
    personality: { meaning: "적극적이고 사회활동에 에너지를 많이 쓰는 기질", polarity: "positive" },
    appearance: { meaning: "밝고 시원시원한 인상", polarity: "positive" },
    career: { meaning: "대외활동이 많거나 사람을 상대하는 일", polarity: "positive" },
    wealth: { meaning: "씀씀이가 크고 베푸는 데 아낌없는 태도", polarity: "mixed" },
    relationship: { meaning: "헌신적이지만 바쁜 일상으로 소홀해 보일 수 있는 태도", polarity: "mixed" },
    meeting: { meaning: "일이나 사회활동을 통한 인연", polarity: "positive" },
    compatibilityWell: { meaning: "독립적이고 배우자의 활동을 이해해주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "관심과 시간을 늘 확인받고 싶어하는 유형", polarity: "risk" },
  },
  武曲: {
    personality: { meaning: "현실적이고 재물 감각이 뛰어난 강단 있는 기질", polarity: "positive" },
    appearance: { meaning: "강단 있고 다부진 인상", polarity: "positive" },
    career: { meaning: "금융·사업·실무 관리 등 재물을 직접 다루는 일", polarity: "positive" },
    wealth: { meaning: "재물운이 좋고 절약하는 습관", polarity: "positive" },
    relationship: { meaning: "감정 표현은 서투르지만 행동으로 책임을 다하는 태도", polarity: "mixed" },
    meeting: { meaning: "실무·업무 관계에서 이어지는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "말보다 행동으로 신뢰를 쌓아가는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "다정한 말과 표현을 계속 요구하는 유형", polarity: "risk" },
  },
  天同: {
    personality: { meaning: "온화하고 낙천적이며 편안함을 추구하는 기질", polarity: "positive" },
    appearance: { meaning: "동안이거나 부드러운 인상", polarity: "positive" },
    career: { meaning: "서비스·문화·예술 등 사람을 편안하게 하는 분야", polarity: "positive" },
    wealth: { meaning: "크게 욕심내지 않고 안분지족하는 태도", polarity: "positive" },
    relationship: { meaning: "배려심 많고 다정하지만 갈등을 회피하다 문제가 쌓이는 태도", polarity: "mixed" },
    meeting: { meaning: "편안한 일상 속에서 자연스럽게 이어지는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "편안하고 안정적인 분위기를 함께 만들어가는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "갈등을 정면으로 다뤄야 하는 상황을 계속 만드는 유형", polarity: "risk" },
  },
  廉貞: {
    personality: { meaning: "매력적이고 카리스마 있으며 감정 기복이 있는 기질", polarity: "mixed" },
    appearance: { meaning: "개성 있고 매력적인 인상", polarity: "positive" },
    career: { meaning: "전문직·기획·관리직 등 자기 색이 뚜렷한 일", polarity: "positive" },
    wealth: { meaning: "수입에 기복이 있는 흐름", polarity: "mixed" },
    relationship: { meaning: "열정적으로 다가가지만 소유욕·통제로 이어지기 쉬운 태도", polarity: "risk" },
    meeting: { meaning: "강렬한 인상으로 시작되는 인연", polarity: "mixed" },
    compatibilityWell: { meaning: "신뢰를 주면서도 자유를 존중해주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "서로 의심하고 확인하려 드는 유형", polarity: "risk" },
  },
  天府: {
    personality: { meaning: "신중하고 포용력 있으며 관리 능력이 뛰어난 기질", polarity: "positive" },
    appearance: { meaning: "후덕하고 안정적인 인상", polarity: "positive" },
    career: { meaning: "관리·재무·운영 등 안정적으로 쌓아가는 일", polarity: "positive" },
    wealth: { meaning: "재물을 안정적으로 축적하는 태도", polarity: "positive" },
    relationship: { meaning: "보수적이고 신중하게 관계를 쌓아가는 태도", polarity: "positive" },
    meeting: { meaning: "천천히 신뢰를 확인하며 이어지는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "천천히 신뢰를 쌓아가는 관계를 원하는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "빠른 진전과 확신을 요구하는 유형", polarity: "risk" },
  },
  太陰: {
    personality: { meaning: "섬세하고 감성적이며 내향적인 매력이 있는 기질", polarity: "positive" },
    appearance: { meaning: "부드럽고 단아한 인상", polarity: "positive" },
    career: { meaning: "문화·부동산·서비스 등 섬세함이 필요한 분야", polarity: "positive" },
    wealth: { meaning: "저축형이고 재물 관리를 꼼꼼히 하는 태도", polarity: "positive" },
    relationship: { meaning: "세심하고 다정하지만 감정 기복이 함께 있는 태도", polarity: "mixed" },
    meeting: { meaning: "정서적 교감에서 시작되는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "정서적 교감을 중요하게 여기는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "무심한 언행을 반복하는 유형", polarity: "risk" },
  },
  貪狼: {
    personality: { meaning: "사교적이고 재주가 많으며 매력이 넘치는 기질", polarity: "positive" },
    appearance: { meaning: "매력적이고 개성 있는 인상", polarity: "positive" },
    career: { meaning: "영업·예술 등 대중을 상대하는 분야", polarity: "positive" },
    wealth: { meaning: "크게 벌 기회도 있지만 씀씀이도 큰 흐름", polarity: "mixed" },
    relationship: { meaning: "다양한 매력을 추구하며 연애 경험이 풍부해지기 쉬운 태도", polarity: "mixed" },
    meeting: { meaning: "사교 활동을 통해 폭넓게 이어지는 인연", polarity: "positive" },
    compatibilityWell: { meaning: "서로의 자유와 다양한 관심사를 이해해주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "구속하려 드는 유형", polarity: "risk" },
  },
  巨門: {
    personality: { meaning: "언변이 뛰어나고 분석적이나 의심이 늘 수 있는 기질", polarity: "mixed" },
    appearance: { meaning: "인상이 뚜렷하거나 독특한 매력", polarity: "positive" },
    career: { meaning: "강의·상담·영업·법률 등 말로 풀어가는 일", polarity: "positive" },
    wealth: { meaning: "수입에 기복이 있는 흐름", polarity: "mixed" },
    relationship: { meaning: "말로 인한 오해·구설이 생기기 쉬운 태도", polarity: "risk" },
    meeting: { meaning: "말과 소통을 통해 깊어지는 인연", polarity: "mixed" },
    compatibilityWell: { meaning: "솔직하게 터놓고 이야기할 수 있는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "오해를 방치하고 넘어가는 유형", polarity: "risk" },
  },
  天相: {
    personality: { meaning: "성실하고 신의를 중시하며 중재자 역할을 잘하는 기질", polarity: "positive" },
    appearance: { meaning: "단정하고 온화한 인상", polarity: "positive" },
    career: { meaning: "보좌·서비스·공직 등 사람을 돕는 자리", polarity: "positive" },
    wealth: { meaning: "안정적인 재물 흐름", polarity: "positive" },
    relationship: { meaning: "성실하고 신의 있으나 결단이 필요한 순간엔 우유부단한 태도", polarity: "mixed" },
    meeting: { meaning: "주변의 소개나 중재를 통한 인연", polarity: "positive" },
    compatibilityWell: { meaning: "서로 존중하며 함께 결정해나가는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "빠른 결단을 계속 요구하는 유형", polarity: "risk" },
  },
  天梁: {
    personality: { meaning: "원칙적이고 손윗사람처럼 챙기는 보호자 기질", polarity: "positive" },
    appearance: { meaning: "듬직하고 신뢰가는 인상", polarity: "positive" },
    career: { meaning: "전문직·의료·교육·공직 등 사람을 돌보는 분야", polarity: "positive" },
    wealth: { meaning: "안정적인 재물 흐름", polarity: "positive" },
    relationship: { meaning: "배우자를 챙기고 보호하려 하지만 잔소리로 느껴질 수 있는 태도", polarity: "mixed" },
    meeting: { meaning: "손윗사람이나 인생 선배를 통한 인연", polarity: "positive" },
    compatibilityWell: { meaning: "조언과 관심을 애정으로 받아들이는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "간섭으로 느끼고 거리를 두는 유형", polarity: "risk" },
  },
  七殺: {
    personality: { meaning: "독립적이고 결단력이 강하며 고집이 있는 기질", polarity: "positive" },
    appearance: { meaning: "강렬하고 카리스마 있는 인상", polarity: "positive" },
    career: { meaning: "전문직·사업 등 도전적인 분야", polarity: "positive" },
    wealth: { meaning: "기복이 있어도 뚝심으로 회복하는 흐름", polarity: "mixed" },
    relationship: { meaning: "직진형으로 다가가지만 감정 표현은 서투른 태도", polarity: "mixed" },
    meeting: { meaning: "강렬하고 빠르게 진전되는 인연", polarity: "mixed" },
    compatibilityWell: { meaning: "서로의 독립성을 존중해주는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "고집과 고집이 부딪히는 유형", polarity: "risk" },
  },
  破軍: {
    personality: { meaning: "도전적이고 개척 정신이 강하며 변화를 즐기는 기질", polarity: "positive" },
    appearance: { meaning: "독특하고 강렬한 인상", polarity: "positive" },
    career: { meaning: "창업·개혁적인 분야", polarity: "positive" },
    wealth: { meaning: "기복이 크고 무너져도 다시 일어서는 흐름", polarity: "mixed" },
    relationship: { meaning: "구속받는 것을 싫어하고 관계에서도 새로움을 추구하는 태도", polarity: "mixed" },
    meeting: { meaning: "예상치 못한 계기로 급진전되는 인연", polarity: "mixed" },
    compatibilityWell: { meaning: "함께 변화를 받아들이고 새로운 시도를 즐기는 유형", polarity: "positive" },
    compatibilityAvoid: { meaning: "안정만을 추구하는 유형", polarity: "risk" },
  },
};

export const SIHUA_MEANINGS: Record<
  SihuaKind,
  { personality: StarMeaning; relationship: StarMeaning; wealth: StarMeaning; formalization: StarMeaning }
> = {
  化祿: {
    personality: { meaning: "복이 따르고 여유 있는 성향", polarity: "positive" },
    relationship: { meaning: "관계에 재물·기회 운이 함께 따르는 흐름", polarity: "positive" },
    wealth: { meaning: "배우자 인연을 통해 재물 기회가 따르는 신호", polarity: "positive" },
    formalization: { meaning: "관계가 순조롭게 무르익는 신호", polarity: "positive" },
  },
  化權: {
    personality: { meaning: "주관이 뚜렷하고 주도적인 성향", polarity: "mixed" },
    relationship: { meaning: "관계 주도권을 쥐려는 힘이 강하게 작용", polarity: "mixed" },
    wealth: { meaning: "배우자가 재물 결정을 주도하는 흐름", polarity: "mixed" },
    formalization: { meaning: "관계를 적극적으로 추진하는 힘(단, 그 자체가 공식화를 보장하진 않음)", polarity: "mixed" },
  },
  化科: {
    personality: { meaning: "평판과 체면을 중시하는 차분한 성향", polarity: "positive" },
    relationship: { meaning: "안정적이고 체면을 지키는 관계 흐름", polarity: "positive" },
    wealth: { meaning: "안정적인 재물 관리 흐름", polarity: "positive" },
    formalization: { meaning: "주변에 알리고 인정받는 방향으로 관계가 정리되는 신호", polarity: "positive" },
  },
  化忌: {
    personality: { meaning: "생각이 많고 집착하기 쉬운 면", polarity: "risk" },
    relationship: { meaning: "집착·오해로 이어지기 쉬운 갈등 신호", polarity: "risk" },
    wealth: { meaning: "재물과 관련해 신중해야 할 신호", polarity: "risk" },
    formalization: { meaning: "지연이나 갈등으로 관계 진전이 매끄럽지 않을 수 있는 신호", polarity: "risk" },
  },
};

export interface AuxiliaryMeaningSet {
  meeting?: StarMeaning;
  relationship?: StarMeaning;
  career?: StarMeaning;
}

export const AUXILIARY_MEANINGS: Record<string, AuxiliaryMeaningSet> = {
  左輔: {
    meeting: { meaning: "주변의 도움이나 조력자를 통한 인연", polarity: "positive" },
    relationship: { meaning: "주변의 도움이나 조력자 역할을 하는 사람이 관계에 함께 나타남", polarity: "positive" },
  },
  右弼: {
    meeting: { meaning: "주변의 도움이나 조력자를 통한 인연", polarity: "positive" },
    relationship: { meaning: "주변의 도움이나 조력자 역할을 하는 사람이 관계에 함께 나타남", polarity: "positive" },
  },
  文昌: {
    meeting: { meaning: "학식 있고 반듯한 자리에서의 인연", polarity: "positive" },
    relationship: { meaning: "지적이고 반듯한 매력이 더해지되 문서·계약은 신중해야 하는 면", polarity: "mixed" },
    career: { meaning: "학식·전문성이 요구되는 영역과의 연결", polarity: "positive" },
  },
  文曲: {
    meeting: { meaning: "예술적이고 지적인 자리에서의 인연", polarity: "positive" },
    relationship: { meaning: "지적·예술적 매력이 더해지되 문서·계약은 신중해야 하는 면", polarity: "mixed" },
    career: { meaning: "예술·전문성이 요구되는 영역과의 연결", polarity: "positive" },
  },
  天魁: {
    meeting: { meaning: "귀인의 도움으로 이어지는 인연", polarity: "positive" },
    relationship: { meaning: "사회적으로 도움이 되는 인연일 가능성", polarity: "positive" },
    career: { meaning: "귀인의 도움을 받는 사회적 위치", polarity: "positive" },
  },
  天鉞: {
    meeting: { meaning: "귀인의 도움으로 이어지는 인연", polarity: "positive" },
    relationship: { meaning: "사회적으로 도움이 되는 인연일 가능성", polarity: "positive" },
    career: { meaning: "귀인의 도움을 받는 사회적 위치", polarity: "positive" },
  },
  祿存: {
    meeting: { meaning: "신중하고 안정 지향적인 환경에서의 인연", polarity: "positive" },
    relationship: { meaning: "신중하고 안정 지향적인 색채가 더해지는 면", polarity: "positive" },
  },
  擎羊: {
    meeting: { meaning: "갈등·마찰이 생기기 쉬운 환경", polarity: "risk" },
    relationship: { meaning: "갈등·마찰이 생기기 쉬워 인내가 필요한 면", polarity: "risk" },
  },
  陀羅: {
    meeting: { meaning: "더디게 풀리거나 답답하게 느껴지는 환경", polarity: "risk" },
    relationship: { meaning: "관계가 더디게 풀리거나 답답하게 느껴질 수 있는 면", polarity: "risk" },
  },
  地空: {
    meeting: { meaning: "이상적이고 현실감이 옅어지기 쉬운 환경", polarity: "risk" },
    relationship: { meaning: "이상을 추구하는 색채가 강해져 현실적인 부분을 함께 챙길 필요", polarity: "mixed" },
  },
  地劫: {
    meeting: { meaning: "이상적이고 현실감이 옅어지기 쉬운 환경", polarity: "risk" },
    relationship: { meaning: "이상을 추구하는 색채가 강해져 현실적인 부분을 함께 챙길 필요", polarity: "mixed" },
  },
  紅鸞: {
    meeting: { meaning: "인연·경사와 관련된 로맨틱한 분위기의 환경", polarity: "positive" },
    relationship: { meaning: "인연·경사와 관련된 신호가 함께 있어 로맨틱한 분위기가 형성되기 쉬움", polarity: "positive" },
  },
  天喜: {
    meeting: { meaning: "인연·경사와 관련된 로맨틱한 분위기의 환경", polarity: "positive" },
    relationship: { meaning: "인연·경사와 관련된 신호가 함께 있어 로맨틱한 분위기가 형성되기 쉬움", polarity: "positive" },
  },
};

/** 별이 없을 때(空宮) 對宮의 별을 빌려보는 전통 규칙 — 이때는 확신도를 낮춰 표기한다. */
export const EMPTY_PALACE_NOTE =
  "夫妻宮에 主星이 없는 空宮이라 對宮(사업궁)의 별을 빌려와 참고합니다. 확신도를 낮춰 참고용으로만 보는 것이 좋습니다.";
