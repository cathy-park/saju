/**
 * specialGukguk.ts — 특별격(전왕격·종격) 후보 판정 레이어
 *
 * gukguk.ts의 determineGukguk()(내격 판정)을 대체하지 않는다.
 * 이 파일은 내격 판정이 다루지 못하는 극단적 편중 명식(전왕격·종격)을
 * "후보 + 신뢰도(confidence) + 성립/방해 근거"로 별도 산출하는 추가 레이어다.
 *
 * 전왕격 5종(곡직격·염상격·가색격·종혁격·윤하격)은 동일한 이론 골격을 오행별로
 * 대칭 적용하므로 evaluateJeonwang() 하나를 공유하되, 종격 4종(종왕격·종강격·
 * 종재격·종살격)은 성립 논리 자체가 서로 다르므로(무근 여부, 대상 오행 도출 방식,
 * 치명적 파격 조건이 모두 다름) 각각 독립된 함수로 둔다.
 *
 * confidence는 "점수 합계가 임계값을 넘으면 high"가 아니라,
 * (1) 필수조건(hard condition) 전부 충족 + (2) 치명적 파격조건 없음 + (3) 강한 성립
 * 신호 존재를 모두 만족할 때만 high를 허용하는 게이트 방식이다. 필수조건을 하나라도
 * 충족하지 못하면 애초에 후보로 등록하지 않는다(determineGukguk의 strict null 패턴과 동일).
 */

import type { FiveElKey } from "./element-color";
import {
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
  GENERATES,
  CONTROLS,
  getGenerator,
  getController,
} from "./element-color";
import { JIJANGGAN } from "./evaluations/structureDomainScores";
import type { StrengthResult } from "./interpretSchema";

export type SpecialGukgukCategory = "전왕격" | "종격";
export type SpecialConfidence = "high" | "medium" | "low";

export interface SpecialGukgukCandidate {
  name: string;
  category: SpecialGukgukCategory;
  dominantElement: FiveElKey;
  confidence: SpecialConfidence;
  /** 성립 근거 */
  supportingEvidence: string[];
  /** 방해 근거 */
  opposingEvidence: string[];
  /** 순세 취용 시 적용할 주 용신 오행 */
  recommendedYongshin: FiveElKey;
  /** 순세 취용 시 보조(희신) 오행 — 기존 effectiveYongshinSecondary와 동일한 자리에 매핑 */
  secondaryYongshin?: FiveElKey;
  /** 왜 이 오행 조합을 순세 취용으로 택했는지 */
  yongshinReason: string;
}

// ── 공통 헬퍼 ──────────────────────────────────────────────────────

function hiddenElementsOf(branch: string): FiveElKey[] {
  return (JIJANGGAN[branch] ?? [])
    .map((s) => STEM_TO_ELEMENT[s])
    .filter((el): el is FiveElKey => !!el);
}

/** 지지의 표면(본기) 오행이 el인 지지 목록 */
function surfaceBranchesOf(el: FiveElKey, allBranches: string[]): string[] {
  return allBranches.filter((b) => BRANCH_TO_ELEMENT[b] === el);
}

/** 표면 본기이든 지장간(여기·중기)이든 el 오행이 뿌리내린 지지 목록 — "통근" 판정 */
function rootedBranchesOf(el: FiveElKey, allBranches: string[]): string[] {
  return allBranches.filter(
    (b) => BRANCH_TO_ELEMENT[b] === el || hiddenElementsOf(b).includes(el),
  );
}

/** el 오행에 해당하는 천간 목록 — "투출" 판정 */
function transparentStemsOf(el: FiveElKey, allStems: string[]): string[] {
  return allStems.filter((s) => STEM_TO_ELEMENT[s] === el);
}

function joinOrNone(items: string[]): string {
  return items.length > 0 ? items.join("·") : "없음";
}

// 계절군(방합) — 특별격 월령 부합 판정의 최소 단위.
// 토는 화토동법·辰戌丑未 사고(四庫) 등 유파차가 커서, 여기서는 진술축미 4개
// 지지 전부를 "계절군 부합"으로 인정하고 왕지 정밀 일치만 미(未)로 단순화한다.
// (명리 유파 간 확정적 정답이 없는 영역이므로 가점 요소로만 사용한다.)
const ELEMENT_SEASON_BRANCHES: Record<FiveElKey, string[]> = {
  목: ["인", "묘", "진"],
  화: ["사", "오", "미"],
  금: ["신", "유", "술"],
  수: ["해", "자", "축"],
  토: ["진", "술", "축", "미"],
};
const ELEMENT_WANG_BRANCH: Record<FiveElKey, string> = {
  목: "묘", 화: "오", 금: "유", 수: "자", 토: "미",
};
// 12운성 장생지(長生) — 계절군(관대~쇠)에는 못 미치지만 해당 오행이 "싹트기 시작하는" 달로,
// 전왕격 후보를 완전히 배제하기엔 이르나 왕지·계절군보다 명백히 약한 근거로 취급한다.
// (토는 화토동법 관례를 따라 화와 같은 인(寅)을 사용 — 유파차가 있는 영역)
const ELEMENT_SAENGJI_BRANCH: Record<FiveElKey, string> = {
  목: "해", 화: "인", 금: "사", 수: "신", 토: "인",
};

type SeasonTier = "왕지" | "계절군" | "생지";

function seasonTierOf(el: FiveElKey, monthBranch: string): SeasonTier | null {
  if (ELEMENT_WANG_BRANCH[el] === monthBranch) return "왕지";
  if (ELEMENT_SEASON_BRANCHES[el].includes(monthBranch)) return "계절군";
  if (ELEMENT_SAENGJI_BRANCH[el] === monthBranch) return "생지";
  return null;
}

// ══════════════════════════════════════════════════════════════════
// 전왕격 5종 (곡직격·염상격·가색격·종혁격·윤하격)
// ══════════════════════════════════════════════════════════════════

interface JeonwangSpec {
  name: string;
  element: FiveElKey;
  dayStems: string[];
}

const JEONWANG_SPECS: JeonwangSpec[] = [
  { name: "곡직격", element: "목", dayStems: ["갑", "을"] },
  { name: "염상격", element: "화", dayStems: ["병", "정"] },
  { name: "가색격", element: "토", dayStems: ["무", "기"] },
  { name: "종혁격", element: "금", dayStems: ["경", "신"] },
  { name: "윤하격", element: "수", dayStems: ["임", "계"] },
];

function evaluateJeonwang(
  spec: JeonwangSpec,
  dayStem: string,
  monthBranch: string | undefined,
  allStems: string[],
  allBranches: string[],
  strengthResult: StrengthResult | undefined,
): SpecialGukgukCandidate | null {
  const el = spec.element;

  // ── 필수조건(hard condition) — 하나라도 불충족이면 후보 자체를 등록하지 않는다 ──
  if (!spec.dayStems.includes(dayStem)) return null;
  const seasonTier = monthBranch ? seasonTierOf(el, monthBranch) : null;
  if (!monthBranch || !seasonTier) return null;
  const surfaceMatch = surfaceBranchesOf(el, allBranches);
  if (surfaceMatch.length < 2) return null;

  const supportingEvidence: string[] = [];
  const opposingEvidence: string[] = [];

  supportingEvidence.push(
    `일간(${dayStem})이 ${el} 오행 자체이며, 월지(${monthBranch})는 ${el} 기준 계절대(${seasonTier})에 해당합니다`,
  );
  supportingEvidence.push(
    `지지 중 ${surfaceMatch.join("·")}(${surfaceMatch.length}개)의 표면 오행이 ${el}입니다`,
  );

  if (seasonTier === "왕지") {
    supportingEvidence.push(`월지(${monthBranch})가 ${el}의 왕지(제왕)에 해당해 계절 부합이 강합니다`);
  } else if (seasonTier === "계절군") {
    opposingEvidence.push(
      `월지(${monthBranch})는 ${el} 계절군에 속하나 왕지(제왕)는 아니어서 계절 부합 강도는 중간 수준입니다`,
    );
  } else {
    opposingEvidence.push(
      `월지(${monthBranch})는 ${el}의 장생지(長生)에 해당해 기운이 싹트는 단계일 뿐, 왕지·계절군보다 부합 강도가 뚜렷이 약합니다`,
    );
  }

  // 생조 세력(인성) — 전왕격을 강화하는 방향
  const generatorEl = getGenerator(el);
  const generatorRooted = rootedBranchesOf(generatorEl, allBranches);
  const generatorTransparent = transparentStemsOf(generatorEl, allStems);
  const hasStrongGeneratorSupport = generatorRooted.length > 0 || generatorTransparent.length > 0;
  if (hasStrongGeneratorSupport) {
    supportingEvidence.push(
      `생조 세력(${generatorEl})이 ${joinOrNone([...generatorTransparent, ...generatorRooted])}에서 확인되어 ${el} 세력을 더 강화합니다`,
    );
  }

  // ── 파격조건(disqualifier) — 반대(극제) 세력의 투출·통근 ──
  const controllerEl = getController(el); // el을 극하는 오행(관살에 해당)
  const controllerTransparent = transparentStemsOf(controllerEl, allStems);
  const controllerRooted = rootedBranchesOf(controllerEl, allBranches);
  const controllerBothTransparentAndRooted = controllerTransparent.length > 0 && controllerRooted.length > 0;
  const controllerAny = controllerTransparent.length > 0 || controllerRooted.length > 0;

  if (controllerBothTransparentAndRooted) {
    opposingEvidence.push(
      `반대 세력(${controllerEl})이 천간에 투출(${controllerTransparent.join("·")})하고 지지에도 뿌리(${controllerRooted.join("·")})를 두고 있어 순수 ${spec.name}으로 보기 어렵습니다(치명적 파격)`,
    );
  } else if (controllerAny) {
    opposingEvidence.push(
      `반대 세력(${controllerEl})이 ${controllerTransparent.length > 0 ? "천간에 투출" : "지지에 통근"}해(${joinOrNone([...controllerTransparent, ...controllerRooted])}) 부분적인 방해 요인이 있습니다`,
    );
  } else {
    supportingEvidence.push(`반대 세력(${controllerEl})이 천간·지지 어디에도 없어 ${el} 기운을 거스르는 요인이 없습니다`);
  }

  // 설기(洩氣) — el이 생하는 오행의 투출 + 기존 강약 엔진의 leakagePenalty
  const outputEl = GENERATES[el];
  const outputTransparent = transparentStemsOf(outputEl, allStems);
  const leakage = strengthResult?.strengthDebug.leakagePenalty ?? 0;
  if (outputTransparent.length > 0) {
    opposingEvidence.push(
      `${el}이 생하는 오행(${outputEl})이 천간에 투출(${outputTransparent.join("·")})해 있어 기운이 설기됩니다`,
    );
  }

  const surfaceCount3Plus = surfaceMatch.length >= 3;
  if (surfaceCount3Plus) {
    supportingEvidence.push(`${el} 지지가 3개 이상으로 세력이 매우 두텁습니다`);
  }

  // ── confidence 게이트 ──────────────────────────────────────────
  // high: 필수조건 충족 + 반대세력(controller) 완전 부재 + 강한 성립 신호(왕지 일치·
  //       지지 3개↑·생조 존재 중 최소 1개) 존재 — 점수 합계가 아니라 "부재+신호" 게이트.
  // medium: 반대세력이 부분적으로만 존재하거나(투출만/통근만), 설기 투출이 있거나,
  //         강한 신호가 없는 경계 케이스, 또는 월지가 생지에 불과한 경우.
  // low: 반대세력이 투출+통근 모두 갖춰 치명적 파격이 있고 강한 신호도 부족한 경우.
  const strongSignalCount = [seasonTier === "왕지", surfaceCount3Plus, hasStrongGeneratorSupport].filter(Boolean).length;

  let confidence: SpecialConfidence;
  if (controllerBothTransparentAndRooted) {
    confidence = strongSignalCount >= 2 ? "medium" : "low";
  } else if (controllerAny || outputTransparent.length > 0) {
    confidence = strongSignalCount >= 1 ? "medium" : "low";
  } else if (strongSignalCount >= 1) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  // 월지가 생지에 불과하면(왕지·계절군 정착 단계에 못 미침) 다른 신호가 아무리 강해도 high는 허용하지 않는다.
  if (seasonTier === "생지" && confidence === "high") {
    confidence = "medium";
  }

  return {
    name: spec.name,
    category: "전왕격",
    dominantElement: el,
    confidence,
    supportingEvidence,
    opposingEvidence,
    recommendedYongshin: el,
    secondaryYongshin: generatorEl,
    yongshinReason: `${spec.name} 순세 취용: 왕한 ${el} 기운을 거스르지 않고, 생조 오행(${generatorEl})으로 세력을 더 북돋는 방향을 용신으로 삼습니다.`,
  };
}

// ══════════════════════════════════════════════════════════════════
// 종격 4종 — 각 격마다 성립 논리가 다르므로 독립 함수로 둔다
// ══════════════════════════════════════════════════════════════════

/** 종왕격: 비겁(일간과 같은 오행) 세력이 압도적이고 관살·재성이 실질적으로 부재 */
function evaluateJongwang(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
): SpecialGukgukCandidate | null {
  const dmEl = STEM_TO_ELEMENT[dayStem];
  if (!dmEl) return null;

  const bigyeopBranches = surfaceBranchesOf(dmEl, allBranches);
  if (bigyeopBranches.length < 3) return null; // 필수조건: 비겁 지지 3개 이상 압도

  const officerEl = getController(dmEl); // 관살
  const wealthEl = CONTROLS[dmEl]; // 재성
  const officerTransparent = transparentStemsOf(officerEl, allStems);
  const officerRooted = rootedBranchesOf(officerEl, allBranches);
  const officerBothTransparentAndRooted = officerTransparent.length > 0 && officerRooted.length > 0;
  if (officerBothTransparentAndRooted) return null; // 필수조건: 관살이 투출+통근 모두 갖추면 애초에 종왕격 후보 아님

  const supportingEvidence: string[] = [
    `비겁(${dmEl}) 지지가 ${bigyeopBranches.join("·")}(${bigyeopBranches.length}개)로 압도적입니다`,
  ];
  const opposingEvidence: string[] = [];

  const officerAny = officerTransparent.length > 0 || officerRooted.length > 0;
  if (officerAny) {
    opposingEvidence.push(
      `관살(${officerEl})이 ${officerTransparent.length > 0 ? "천간에 일부 투출" : "지지에 일부 통근"}해(${joinOrNone([...officerTransparent, ...officerRooted])}) 완전한 종왕격으로 보기는 조심스럽습니다`,
    );
  } else {
    supportingEvidence.push(`관살(${officerEl})이 천간·지지 어디에도 없습니다`);
  }

  const wealthAny = transparentStemsOf(wealthEl, allStems).length > 0 || rootedBranchesOf(wealthEl, allBranches).length > 0;
  if (wealthAny) {
    opposingEvidence.push(`재성(${wealthEl})이 존재해 비겁 세력을 일부 소모합니다`);
  }

  const generatorEl = getGenerator(dmEl); // 인성
  const generatorAny = transparentStemsOf(generatorEl, allStems).length > 0 || rootedBranchesOf(generatorEl, allBranches).length > 0;
  if (generatorAny) {
    // 인성까지 강하면 종강격 쪽이 더 정확한 이름이므로, 종왕격 단독 신뢰도는 낮춘다(중복 후보는 evaluateJonggang이 별도 산출)
    opposingEvidence.push(`인성(${generatorEl})도 함께 강해 순수 종왕격보다 종강격에 더 가까울 수 있습니다`);
  }

  const strongSignal = bigyeopBranches.length >= 4;

  let confidence: SpecialConfidence;
  if (officerAny || wealthAny || generatorAny) {
    confidence = strongSignal ? "medium" : "low";
  } else {
    confidence = strongSignal ? "high" : "medium";
  }

  return {
    name: "종왕격",
    category: "종격",
    dominantElement: dmEl,
    confidence,
    supportingEvidence,
    opposingEvidence,
    recommendedYongshin: dmEl,
    secondaryYongshin: generatorEl,
    yongshinReason: "종왕격 순세 취용: 극도로 강한 비겁 세력을 거스르지 않고, 그 세력 자체(비겁)와 생조 오행(인성)을 용신으로 삼습니다.",
  };
}

/** 종강격: 비겁+인성 합세가 압도적이고 관살·재성이 실질적으로 부재 */
function evaluateJonggang(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
): SpecialGukgukCandidate | null {
  const dmEl = STEM_TO_ELEMENT[dayStem];
  if (!dmEl) return null;

  const generatorEl = getGenerator(dmEl); // 인성
  const bigyeopBranches = rootedBranchesOf(dmEl, allBranches);
  const inseongBranches = rootedBranchesOf(generatorEl, allBranches);
  const combinedCount = new Set([...bigyeopBranches, ...inseongBranches]).size;
  if (combinedCount < 3) return null; // 필수조건: 비겁+인성 통근 지지 합계 3개 이상
  if (inseongBranches.length === 0 && transparentStemsOf(generatorEl, allStems).length === 0) return null; // 필수조건: 인성이 명목상으로라도 존재해야 종강격(없으면 종왕격 영역)

  const officerEl = getController(dmEl);
  const wealthEl = CONTROLS[dmEl];
  const officerTransparent = transparentStemsOf(officerEl, allStems);
  const officerRooted = rootedBranchesOf(officerEl, allBranches);
  const officerBothTransparentAndRooted = officerTransparent.length > 0 && officerRooted.length > 0;
  if (officerBothTransparentAndRooted) return null; // 필수조건

  const supportingEvidence: string[] = [
    `비겁(${dmEl})+인성(${generatorEl}) 통근 지지가 ${combinedCount}개로 압도적입니다`,
    `인성(${generatorEl})이 ${joinOrNone([...transparentStemsOf(generatorEl, allStems), ...inseongBranches])}에서 확인됩니다`,
  ];
  const opposingEvidence: string[] = [];

  const officerAny = officerTransparent.length > 0 || officerRooted.length > 0;
  if (officerAny) {
    opposingEvidence.push(`관살(${officerEl})이 부분적으로 존재해(${joinOrNone([...officerTransparent, ...officerRooted])}) 완전한 종강격으로 보기는 조심스럽습니다`);
  } else {
    supportingEvidence.push(`관살(${officerEl})이 천간·지지 어디에도 없습니다`);
  }

  const wealthAny = transparentStemsOf(wealthEl, allStems).length > 0 || rootedBranchesOf(wealthEl, allBranches).length > 0;
  if (wealthAny) opposingEvidence.push(`재성(${wealthEl})이 존재해 세력을 일부 소모합니다`);

  const strongSignal = combinedCount >= 4 && inseongBranches.length > 0;

  let confidence: SpecialConfidence;
  if (officerAny || wealthAny) {
    confidence = strongSignal ? "medium" : "low";
  } else {
    confidence = strongSignal ? "high" : "medium";
  }

  return {
    name: "종강격",
    category: "종격",
    dominantElement: dmEl,
    confidence,
    supportingEvidence,
    opposingEvidence,
    recommendedYongshin: generatorEl,
    secondaryYongshin: dmEl,
    yongshinReason: "종강격 순세 취용: 인성과 비겁이 함께 강한 세력을 거스르지 않고, 인성을 주 용신, 비겁을 보조로 삼습니다.",
  };
}

/** 종재격: 일간 무근무력 + 재성 세력이 압도적, 비겁·인성이 실질적으로 부재 */
function evaluateJongjae(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
): SpecialGukgukCandidate | null {
  const dmEl = STEM_TO_ELEMENT[dayStem];
  if (!dmEl) return null;

  const dmRooted = rootedBranchesOf(dmEl, allBranches);
  if (dmRooted.length > 0) return null; // 필수조건: 일간 무근(통근 없음)이어야 종격 성립 가능

  const wealthEl = CONTROLS[dmEl]; // 재성
  const wealthBranches = surfaceBranchesOf(wealthEl, allBranches);
  if (wealthBranches.length < 2) return null; // 필수조건: 재성 지지 2개 이상

  const generatorEl = getGenerator(dmEl); // 인성
  const generatorTransparent = transparentStemsOf(generatorEl, allStems);
  // 비겁 투출 체크는 일간 자신을 제외해야 한다(일간 자체는 항상 자기 오행과 일치하므로 제외하지 않으면 매번 자기 자신에 걸려 오탐한다)
  const heavenStemsNonDay = allStems.filter((s) => s !== dayStem);
  const bigyeopTransparent = transparentStemsOf(dmEl, heavenStemsNonDay);
  // 필수조건: 일간을 직접 돕는 비겁·인성이 천간에 투출해 있으면 종재격이 깨진다(치명적)
  if (generatorTransparent.length > 0 || bigyeopTransparent.length > 0) return null;

  const supportingEvidence: string[] = [
    `일간(${dayStem}, ${dmEl})이 지지 어디에도 통근하지 못해 무근·무력합니다`,
    `재성(${wealthEl}) 지지가 ${wealthBranches.join("·")}(${wealthBranches.length}개)로 세력을 이룹니다`,
    `일간을 돕는 비겁·인성이 천간에 투출하지 않았습니다`,
  ];
  const opposingEvidence: string[] = [];

  const outputEl = GENERATES[dmEl]; // 식상 — 재성을 생하는 다리
  const outputAny = transparentStemsOf(outputEl, allStems).length > 0 || rootedBranchesOf(outputEl, allBranches).length > 0;
  if (outputAny) {
    supportingEvidence.push(`식상(${outputEl})이 재성을 생하는 흐름(식상생재)이 확인되어 종재격 성립을 뒷받침합니다`);
  }

  const generatorRooted = rootedBranchesOf(generatorEl, allBranches);
  if (generatorRooted.length > 0) {
    opposingEvidence.push(`인성(${generatorEl})이 지지에 미약하게 통근해(${generatorRooted.join("·")}) 완전한 무조(無助)로 보기는 조심스럽습니다`);
  }

  const strongSignal = wealthBranches.length >= 3 && outputAny;

  let confidence: SpecialConfidence;
  if (generatorRooted.length > 0) {
    confidence = strongSignal ? "medium" : "low";
  } else {
    confidence = strongSignal ? "high" : "medium";
  }

  return {
    name: "종재격",
    category: "종격",
    dominantElement: wealthEl,
    confidence,
    supportingEvidence,
    opposingEvidence,
    recommendedYongshin: wealthEl,
    secondaryYongshin: outputEl,
    yongshinReason: "종재격 순세 취용: 일간이 무근이므로 재성을 거스르지 않고 따르며, 재성을 생하는 식상을 보조로 삼아 흐름을 유통시킵니다.",
  };
}

/** 종살격: 일간 무근무력 + 관살 세력이 압도적, 인성이 실질적으로 부재(통관 불가) */
function evaluateJongsal(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
): SpecialGukgukCandidate | null {
  const dmEl = STEM_TO_ELEMENT[dayStem];
  if (!dmEl) return null;

  const dmRooted = rootedBranchesOf(dmEl, allBranches);
  if (dmRooted.length > 0) return null; // 필수조건: 일간 무근

  const officerEl = getController(dmEl); // 관살
  const officerBranches = surfaceBranchesOf(officerEl, allBranches);
  if (officerBranches.length < 2) return null; // 필수조건: 관살 지지 2개 이상

  const generatorEl = getGenerator(dmEl); // 인성 — 관살의 기운을 일간에 유통시켜 종격을 깨는 통관 역할
  const generatorTransparent = transparentStemsOf(generatorEl, allStems);
  // 필수조건: 인성이 천간에 투출해 관인상생으로 통관되면 종살격이 성립하지 않는다(가장 치명적)
  if (generatorTransparent.length > 0) return null;

  // 비겁 투출 체크는 일간 자신을 제외해야 한다(일간 자체는 항상 자기 오행과 일치하므로 제외하지 않으면 매번 자기 자신에 걸려 오탐한다)
  const heavenStemsNonDay = allStems.filter((s) => s !== dayStem);
  const bigyeopTransparent = transparentStemsOf(dmEl, heavenStemsNonDay);
  if (bigyeopTransparent.length > 0) return null; // 필수조건: 비겁 투출도 종살격을 깨뜨림

  const supportingEvidence: string[] = [
    `일간(${dayStem}, ${dmEl})이 지지 어디에도 통근하지 못해 무근·무력합니다`,
    `관살(${officerEl}) 지지가 ${officerBranches.join("·")}(${officerBranches.length}개)로 세력을 이룹니다`,
    `인성(${generatorEl})이 천간에 투출하지 않아 관인상생으로 통관되지 않습니다`,
  ];
  const opposingEvidence: string[] = [];

  const wealthEl = CONTROLS[dmEl]; // 재성 — 관살을 생하는 다리(재생살)
  const wealthAny = transparentStemsOf(wealthEl, allStems).length > 0 || rootedBranchesOf(wealthEl, allBranches).length > 0;
  if (wealthAny) {
    supportingEvidence.push(`재성(${wealthEl})이 관살을 생하는 흐름(재생살)이 확인되어 종살격 성립을 뒷받침합니다`);
  }

  const generatorRooted = rootedBranchesOf(generatorEl, allBranches);
  if (generatorRooted.length > 0) {
    opposingEvidence.push(`인성(${generatorEl})이 지지에 미약하게 통근해(${generatorRooted.join("·")}) 완전한 종살격으로 보기는 조심스럽습니다`);
  }

  const strongSignal = officerBranches.length >= 3 && wealthAny;

  let confidence: SpecialConfidence;
  if (generatorRooted.length > 0) {
    confidence = strongSignal ? "medium" : "low";
  } else {
    confidence = strongSignal ? "high" : "medium";
  }

  return {
    name: "종살격",
    category: "종격",
    dominantElement: officerEl,
    confidence,
    supportingEvidence,
    opposingEvidence,
    recommendedYongshin: officerEl,
    secondaryYongshin: wealthEl,
    yongshinReason: "종살격 순세 취용: 일간이 무근이므로 관살에 순응하며, 관살을 생조하는 재성을 보조로 삼습니다.",
  };
}

// ══════════════════════════════════════════════════════════════════
// 통합 진입점
// ══════════════════════════════════════════════════════════════════

export function detectSpecialPatterns(
  dayStem: string,
  monthBranch: string | undefined,
  allStems: string[],
  allBranches: string[],
  strengthResult: StrengthResult | undefined,
): SpecialGukgukCandidate[] {
  if (!dayStem) return [];

  const candidates: SpecialGukgukCandidate[] = [];

  for (const spec of JEONWANG_SPECS) {
    const c = evaluateJeonwang(spec, dayStem, monthBranch, allStems, allBranches, strengthResult);
    if (c) candidates.push(c);
  }

  const jongEvaluators = [evaluateJongwang, evaluateJonggang, evaluateJongjae, evaluateJongsal];
  for (const evaluate of jongEvaluators) {
    const c = evaluate(dayStem, allStems, allBranches);
    if (c) candidates.push(c);
  }

  return candidates;
}

/**
 * high confidence 후보 중 하나를 고른다. 정의 순서(전왕격 5종 → 종격 4종)가 우선순위다.
 * 여러 개의 high가 동시에 나오는 경우는 극히 드물지만, 발생 시 가장 먼저 정의된 패턴을 채택한다.
 */
export function pickHighConfidenceCandidate(
  candidates: SpecialGukgukCandidate[],
): SpecialGukgukCandidate | null {
  return candidates.find((c) => c.confidence === "high") ?? null;
}
