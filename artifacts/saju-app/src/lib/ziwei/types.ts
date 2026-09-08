// 紫微斗數(자미두수) canonical payload 타입 — 기존 사주(bazi) 엔진(sajuEngine.ts/compatibilityScore.ts)과
// 완전히 독립적이다. 이 모듈 트리(src/lib/ziwei/**) 밖의 어떤 사주 계산/점수 로직도 여기서 import하지
// 않으며, 반대로 사주 엔진도 이 모듈을 참조하지 않는다.

export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export type Branch = (typeof BRANCHES)[number];

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export type Stem = (typeof STEMS)[number];

export const PALACE_NAMES = [
  "命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮",
  "遷移宮", "交友宮", "事業宮", "田宅宮", "福德宮", "父母宮",
] as const;
export type PalaceName = (typeof PALACE_NAMES)[number];

export type SihuaKind = "化祿" | "化權" | "化科" | "化忌";

export interface StarPlacement {
  name: string;
  brightness?: string; // 廟旺得利平陷 등 묘왕리함 상태(있으면)
}

export interface Palace {
  palace: PalaceName;
  branch: Branch;
  majorStars: StarPlacement[];
  minorStars: StarPlacement[];
  transformations: SihuaKind[];
  oppositePalace: PalaceName; // 대궁(현재+6칸)
  trinePalaces: PalaceName[]; // 삼방(현재±4칸)
  isShenGong: boolean;
}

export interface RuleSet {
  school: string;
  version: string;
  source: string;
  /** 년간(10干) → 生年四化(化祿/化權/化科/化忌)가 붙는 별 이름. */
  sihuaTable: Record<Stem, { 化祿: string; 化權: string; 化科: string; 化忌: string }>;
}

export interface LunarBirth {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  hourBranch: Branch;
  yearStem: Stem;
  yearBranch: Branch;
}

export interface ZiweiBirthInput {
  name: string;
  gender: "남" | "여";
  calendarType: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  hour: number; // 0~23, 진태양시 보정된 시각(호출부 책임)
  minute?: number;
  birthplace?: string;
}

export interface FiveElementBureau {
  name: string; // 예: "大林木三局"
  element: "水" | "木" | "金" | "土" | "火";
  number: 2 | 3 | 4 | 5 | 6;
}

export interface MajorPeriod {
  ageRange: [number, number];
  palace: PalaceName;
  branch: Branch;
}

export interface AnnualPeriod {
  year: number;
  palace: PalaceName;
  branch: Branch;
}

export interface ZiweiChart {
  ruleSet: { school: string; version: string; source: string };
  birth: ZiweiBirthInput;
  lunarBirth: LunarBirth;
  mingGong: { branch: Branch };
  shenGong: { branch: Branch; palace: PalaceName };
  fiveElementBureau: FiveElementBureau;
  palaces: Palace[];
  birthYearTransformations: Record<SihuaKind, { star: string; palace: PalaceName }>;
  majorPeriods: MajorPeriod[];
  annualPeriods: AnnualPeriod[];
}

export interface EvidenceItem {
  type: "palace" | "star" | "transformation" | "period";
  value: string;
  /** 이 근거가 어느 시간축에서 나왔는지(원국/大限/流年) — 판정·점수 로직과 무관한 표시용
   * metadata다. timingEngine처럼 시기별 근거를 만드는 곳만 채우고, 나머지는 항상 undefined다. */
  source?: "natal" | "major" | "annual";
}

export interface InterpretedStatement {
  text: string;
  evidence: EvidenceItem[];
  confidence: "high" | "medium" | "low";
}
