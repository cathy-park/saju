// 보조성(輔佐煞曜) 배치 — 유파 무관 공통 공식만 다룬다. 火星·鈴星는 년지 그룹×시지 조합표가
// 유파마다 버전이 갈리는 항목이라(2026-09-07 감사 보고에서 이미 명시) 단일 데이터 포인트로
// 검증 없이 임의로 채택하지 않고 이번 단계에서는 의도적으로 제외한다(2차 확장 대상).
//
// 아래 11개 별은 windada.com 실계산 결과와 개별 대조해 검증했다(2026-09-07, 박소연+조용민
// 2개 fixture 교차검증 — __tests__/crossValidation*.test.ts 참고):
//   左輔=辰(命宮), 右弼=戌(遷移宮), 文昌=子(財帛宮), 文曲=寅(夫妻宮),
//   天魁=子(財帛宮), 天鉞=申(事業宮), 祿存=午(福德宮), 擎羊=未(田宅宮), 陀羅=巳(父母宮),
//   地空=丑(子女宮), 地劫=酉(交友宮), 紅鸞=戌(遷移宮), 天喜=辰(命宮) [박소연 기준].
import { BRANCHES, type Branch, type LunarBirth, type Stem } from "./types";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
function idx(b: Branch): number {
  return BRANCHES.indexOf(b);
}

/** 左輔:辰궁에서 정월 시작, 생월만큼 순행. 右弼:戌궁에서 정월 시작, 생월만큼 역행. */
export function computeZuoyouChang(month: number): { 左輔: Branch; 右弼: Branch } {
  return {
    左輔: BRANCHES[mod12(idx("辰") + (month - 1))],
    右弼: BRANCHES[mod12(idx("戌") - (month - 1))],
  };
}

/** 文昌:戌궁에서 子시 시작, 생시만큼 역행. 文曲:辰궁에서 子시 시작, 생시만큼 순행. */
export function computeChangqu(hourBranch: Branch): { 文昌: Branch; 文曲: Branch } {
  const h = idx(hourBranch);
  return {
    文昌: BRANCHES[mod12(idx("戌") - h)],
    文曲: BRANCHES[mod12(idx("辰") + h)],
  };
}

/** 天魁·天鉞: 년간 고정표(甲戊庚-丑未, 乙己-子申, 丙丁-亥酉, 壬癸-卯巳, 辛-午寅). */
const KUI_YUE_TABLE: Record<Stem, [Branch, Branch]> = {
  甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  壬: ["卯", "巳"], 癸: ["卯", "巳"],
  辛: ["午", "寅"],
};
export function computeKuiyue(yearStem: Stem): { 天魁: Branch; 天鉞: Branch } {
  const [kui, yue] = KUI_YUE_TABLE[yearStem];
  return { 天魁: kui, 天鉞: yue };
}

/** 祿存: 년간 고정표(甲寅,乙卯,丙戊巳,丁己午,庚申,辛酉,壬亥,癸子). 擎羊=祿存+1, 陀羅=祿存-1. */
const LUCUN_TABLE: Record<Stem, Branch> = {
  甲: "寅", 乙: "卯", 丙: "巳", 戊: "巳", 丁: "午", 己: "午",
  庚: "申", 辛: "酉", 壬: "亥", 癸: "子",
};
export function computeLucunYangTuo(yearStem: Stem): { 祿存: Branch; 擎羊: Branch; 陀羅: Branch } {
  const lucun = LUCUN_TABLE[yearStem];
  const l = idx(lucun);
  return { 祿存: lucun, 擎羊: BRANCHES[mod12(l + 1)], 陀羅: BRANCHES[mod12(l - 1)] };
}

/** 地劫:亥궁에서 子시 시작 생시만큼 순행. 地空:亥궁에서 子시 시작 생시만큼 역행. */
export function computeKongjie(hourBranch: Branch): { 地空: Branch; 地劫: Branch } {
  const h = idx(hourBranch);
  return {
    地劫: BRANCHES[mod12(idx("亥") + h)],
    地空: BRANCHES[mod12(idx("亥") - h)],
  };
}

/** 紅鸞·天喜: 년지 고정공식(卯궁에서 子년 시작, 생년지만큼 역행 = 紅鸞; 天喜=紅鸞의 대궁).
 * 결혼시기 분석(timingEngine.ts)에서 원국/유년 배우자궁과의 중첩을 볼 때 핵심 참조 별이다.
 * 검증: 박소연(巳년)→紅鸞戌/天喜辰, 조용민(卯년)→紅鸞子/天喜午 — 둘 다 windada.com 실계산과 일치. */
export function computeHongluanTianxi(yearBranch: Branch): { 紅鸞: Branch; 天喜: Branch } {
  const hongluanIndex = mod12(idx("卯") - idx(yearBranch));
  return { 紅鸞: BRANCHES[hongluanIndex], 天喜: BRANCHES[mod12(hongluanIndex + 6)] };
}

export function computeAuxiliaryStars(lunar: LunarBirth): Record<string, Branch> {
  return {
    ...computeZuoyouChang(lunar.month),
    ...computeChangqu(lunar.hourBranch),
    ...computeKuiyue(lunar.yearStem),
    ...computeLucunYangTuo(lunar.yearStem),
    ...computeKongjie(lunar.hourBranch),
    ...computeHongluanTianxi(lunar.yearBranch),
  };
}
