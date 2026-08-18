/**
 * latentGukguk.ts — 월령(월지 본기) 기반 "미투출 내격 후보" 읽기 전용 레이어
 *
 * determineGukguk()(내격, gukguk.ts)은 월지 지장간의 천간 투출을 strict 기준으로 삼아,
 * 투출이 없으면 null("격국 없음")을 반환한다. 이 파일은 그 null 케이스를 대체하지 않고,
 * "월지 본기만 놓고 보면 어떤 격 성향인가"를 설명하는 보조 정보만 산출한다.
 *
 * 중요: 이 레이어의 결과는 어떤 downstream 계산(강약·용신·구조 도메인·activation 등)에도
 * 입력되지 않는다. 오직 UI 설명 텍스트로만 소비된다. gukguk(내격) 판정을 절대 덮어쓰지 않는다.
 */

import { getTenGod, type TenGod } from "./tenGods";
import {
  JIJANGGAN,
  YANGIN_BRANCH,
  TG_TO_GUKGUK,
  GUKGUK_DESC,
  GUKGUK_TONE,
  GUKGUK_COLOR,
} from "./gukguk";

export interface LatentGukgukResult {
  /** 월령 후보 격국명 (예: "정관격") */
  name: string;
  description: string;
  tone: "길" | "흉" | "중";
  colorClass: string;
  monthBranch: string;
  /** 월지 지장간의 본기(本氣) */
  ilgiStem: string;
  tenGod: TenGod;
  explanation: string[];
}

/**
 * 월지 본기(本氣) 기준의 격국 성향을 산출한다.
 * determineGukguk()이 이미 확정 격국을 반환하는 경우(투출 있음)에는 호출부에서
 * 이 함수의 결과를 노출하지 않는 것을 전제로 한다(이 함수 자체는 항상 계산은 하되,
 * "언제 보여줄지"는 UI/파이프라인 쪽 정책으로 분리한다).
 */
export function determineLatentGukguk(
  dayStem: string,
  monthBranch: string | undefined,
  allStems: string[],
): LatentGukgukResult | null {
  if (!dayStem || !monthBranch) return null;

  const hiddenStems = JIJANGGAN[monthBranch];
  if (!hiddenStems || hiddenStems.length === 0) return null;

  const ilgiStem = hiddenStems[hiddenStems.length - 1]; // 본기(本氣) = 마지막 원소
  const tg = getTenGod(dayStem, ilgiStem);
  if (!tg) return null;

  let gukgukName = TG_TO_GUKGUK[tg];
  if (tg === "비견") {
    const yanginBr = YANGIN_BRANCH[dayStem];
    gukgukName = yanginBr === monthBranch ? "양인격" : "건록격";
  }

  const heavenStemsNonDay = allStems.filter((s) => s !== dayStem);
  const isTransparent = heavenStemsNonDay.includes(ilgiStem);
  const tone = GUKGUK_TONE[gukgukName] ?? "중";

  const explanation: string[] = [
    `월지(${monthBranch}) 지장간 본기(本氣): ${ilgiStem}`,
    `일간(${dayStem})과 본기(${ilgiStem})의 십성: ${tg} → 월령 후보: ${gukgukName}`,
    isTransparent
      ? `본기(${ilgiStem})가 천간에 투출되어 있어 내격 확정 조건과 겹칩니다`
      : `본기(${ilgiStem})가 천간(연/월/시)에 투출되지 않아 내격으로는 확정되지 않았습니다`,
  ];

  return {
    name: gukgukName,
    description: `${GUKGUK_DESC[gukgukName] ?? ""} (월령 성향 참고용 — 천간 미투출로 내격 확정은 아님)`,
    tone,
    colorClass: GUKGUK_COLOR[tone],
    monthBranch,
    ilgiStem,
    tenGod: tg,
    explanation,
  };
}
