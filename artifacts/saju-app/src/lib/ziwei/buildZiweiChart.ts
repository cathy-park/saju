// 진입점: BirthInput → 완전한 ZiweiChart canonical payload. 이 파일과 그 아래 모든 모듈은
// sajuEngine.ts/compatibilityScore.ts 등 기존 사주 엔진 코드를 전혀 import하지 않는다
// (birth 입력 타입/manseryeok 라이브러리만 공유, 계산 로직은 완전 독립).
import { BRANCHES, PALACE_NAMES, type Branch, type Palace, type PalaceName, type RuleSet, type ZiweiBirthInput, type ZiweiChart } from "./types";
import { toLunarBirth } from "./lunarConvert";
import { computeMingGong, computeShenGong } from "./mingGong";
import { computeFiveElementBureau } from "./fiveElementBureau";
import { computeFourteenMajorStars, computeZiweiPosition, toStarPlacements } from "./ziweiStarPlacement";
import { computeAuxiliaryStars } from "./auxiliaryStars";
import { computeBirthYearSihua } from "./sihua";
import { computeMajorPeriods } from "./majorPeriods";
import { computeAnnualPeriods } from "./annualPeriods";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function buildZiweiChart(
  birth: ZiweiBirthInput,
  ruleSet: RuleSet,
  annualYears: number[] = [],
): ZiweiChart {
  const lunar = toLunarBirth(birth.calendarType, birth.year, birth.month, birth.day, birth.hour);
  const mingGongBranch = computeMingGong(lunar);
  const shenGongBranch = computeShenGong(lunar);
  const bureau = computeFiveElementBureau(lunar.yearStem, mingGongBranch);
  const ziweiBranch = computeZiweiPosition(lunar.day, bureau);
  const { positions: majorPositions } = computeFourteenMajorStars(ziweiBranch);
  const minorPositions = computeAuxiliaryStars(lunar);

  // 12궁 branch 배정: 命宮에서 지지 인덱스 감소 방향(역행)으로 순서대로 배정한다(유파 무관
  // 공통 규칙, windada.com 실계산으로 검증: 命宮辰→兄弟宮卯→夫妻宮寅→...→父母宮巳).
  const mingIndex = BRANCHES.indexOf(mingGongBranch);
  const branchOfPalaceIndex: Branch[] = PALACE_NAMES.map((_, i) => BRANCHES[mod12(mingIndex - i)]);
  const palaceOfBranch = {} as Record<Branch, PalaceName>;
  PALACE_NAMES.forEach((name, i) => { palaceOfBranch[branchOfPalaceIndex[i]] = name; });

  // 사화 대상 별은 14주성뿐 아니라 左輔·右弼·文昌·文曲 같은 보조성도 포함될 수 있으므로
  // (예: 己干 文曲化忌) 둘을 합친 위치표에서 찾는다.
  const sihuaAssignments = computeBirthYearSihua(lunar.yearStem, ruleSet, { ...majorPositions, ...minorPositions });
  const birthYearTransformations = {} as ZiweiChart["birthYearTransformations"];
  for (const a of sihuaAssignments) {
    birthYearTransformations[a.kind] = { star: a.star, palace: palaceOfBranch[a.branch] };
  }

  const palaces: Palace[] = PALACE_NAMES.map((name, i) => {
    const branch = branchOfPalaceIndex[i];
    const oppositePalace = PALACE_NAMES[mod12(i + 6)];
    const trinePalaces = [PALACE_NAMES[mod12(i + 4)], PALACE_NAMES[mod12(i - 4)]];
    const transformations = sihuaAssignments.filter((a) => a.branch === branch).map((a) => a.kind);
    return {
      palace: name,
      branch,
      majorStars: toStarPlacements(majorPositions, branch),
      minorStars: toStarPlacements(minorPositions, branch),
      transformations,
      oppositePalace,
      trinePalaces,
      isShenGong: branch === shenGongBranch,
    };
  });

  const majorPeriods = computeMajorPeriods(mingGongBranch, bureau, lunar.yearStem, birth.gender, palaceOfBranch);
  const annualPeriods = computeAnnualPeriods(annualYears, palaceOfBranch);

  return {
    ruleSet: { school: ruleSet.school, version: ruleSet.version, source: ruleSet.source },
    birth,
    lunarBirth: lunar,
    mingGong: { branch: mingGongBranch },
    shenGong: { branch: shenGongBranch, palace: palaceOfBranch[shenGongBranch] },
    fiveElementBureau: bureau,
    palaces,
    birthYearTransformations,
    majorPeriods,
    annualPeriods,
  };
}
