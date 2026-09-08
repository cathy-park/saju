// 五行局(오행국) 계산 — 命宮의 간지(干支) → 六十甲子 納音五行 → 局數(2/3/4/5/6).
// 유파 무관 공통 데이터(五虎遁訣, 六十甲子納音表는 명리학 전반에서 통용되는 표준 표이며
// 자미두수 유파 간 이견이 없다). sajuEngine.ts의 동일 성격 로직과는 완전히 독립적으로
// 이 파일 안에서 자체 구현한다(공유 코드 없음, "완전 분리" 요구사항 준수).
//
// 검증: 己巳年 命宮=辰 → 五虎遁(己年→寅宮干=丙) → 命宮干支=戊辰 → 納音=大林木(木) → 木三局.
// windada.com 실계산 결과(五行局: 大林木三局)와 정확히 일치(2026-09-07 확인).
import { BRANCHES, STEMS, type Branch, type FiveElementBureau, type Stem } from "./types";

/** 五虎遁訣: 甲己之年丙作首,乙庚之歲戊為頭,丙辛必定尋庚起,丁壬壬寅順水流,戊癸何方發甲寅之上好追求. */
const YEAR_STEM_TO_YIN_PALACE_STEM: Record<Stem, Stem> = {
  甲: "丙", 己: "丙",
  乙: "戊", 庚: "戊",
  丙: "庚", 辛: "庚",
  丁: "壬", 壬: "壬",
  戊: "甲", 癸: "甲",
};

/** 六十甲子 納音(30쌍, index=0..29). 甲子乙丑부터 순서대로 — 표준 통용표(유파 무관, 명리학
 * 전반 공통). [정확한 명칭, 오행] 튜플. index = floor(60갑자순번/2). */
const SIXTY_JIAZI_NAYIN: Array<[string, "水" | "木" | "金" | "土" | "火"]> = [
  ["海中金", "金"], ["爐中火", "火"], ["大林木", "木"], ["路旁土", "土"], ["劍鋒金", "金"],
  ["山頭火", "火"], ["澗下水", "水"], ["城頭土", "土"], ["白蠟金", "金"], ["楊柳木", "木"],
  ["泉中水", "水"], ["屋上土", "土"], ["霹靂火", "火"], ["松柏木", "木"], ["長流水", "水"],
  ["沙中金", "金"], ["山下火", "火"], ["平地木", "木"], ["壁上土", "土"], ["金箔金", "金"],
  ["覆燈火", "火"], ["天河水", "水"], ["大驛土", "土"], ["釵釧金", "金"], ["桑柘木", "木"],
  ["大溪水", "水"], ["沙中土", "土"], ["天上火", "火"], ["石榴木", "木"], ["大海水", "水"],
];

const ELEMENT_TO_BUREAU: Record<"水" | "木" | "金" | "土" | "火", 2 | 3 | 4 | 5 | 6> = {
  水: 2, 木: 3, 金: 4, 土: 5, 火: 6,
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 寅궁 천간과 命宮 지지로부터 命宮의 정확한 간지(干)를 구한다(寅에서부터 순행). */
function mingGongStem(yinPalaceStem: Stem, mingGongBranch: Branch): Stem {
  const yinBranchIndex = BRANCHES.indexOf("寅");
  const mingGongBranchIndex = BRANCHES.indexOf(mingGongBranch);
  const offset = mod(mingGongBranchIndex - yinBranchIndex, 12);
  const yinStemIndex = STEMS.indexOf(yinPalaceStem);
  return STEMS[mod(yinStemIndex + offset, 10)];
}

/** 중국식 60갑자 순번(0~59)을 간지 조합으로부터 CRT(중국인의 나머지 정리)로 구한다. */
function sixtyJiaziIndex(stem: Stem, branch: Branch): number {
  const s = STEMS.indexOf(stem); // 0~9
  const b = BRANCHES.indexOf(branch); // 0~11
  for (let n = 0; n < 60; n++) {
    if (n % 10 === s && n % 12 === b) return n;
  }
  throw new Error(`유효하지 않은 간지 조합: ${stem}${branch}`);
}

export function computeFiveElementBureau(yearStem: Stem, mingGongBranch: Branch): FiveElementBureau {
  const yinPalaceStem = YEAR_STEM_TO_YIN_PALACE_STEM[yearStem];
  const stem = mingGongStem(yinPalaceStem, mingGongBranch);
  const jiaziIndex = sixtyJiaziIndex(stem, mingGongBranch);
  const [nayinName, element] = SIXTY_JIAZI_NAYIN[Math.floor(jiaziIndex / 2)];
  const numeral = { 2: "二", 3: "三", 4: "四", 5: "五", 6: "六" }[ELEMENT_TO_BUREAU[element]];
  return {
    name: `${nayinName}${numeral}局`,
    element,
    number: ELEMENT_TO_BUREAU[element],
  };
}
