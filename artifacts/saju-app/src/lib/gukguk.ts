/**
 * gukguk.ts — 格局 (격국) 판별 + 구조 분석
 *
 * 격국 판별 순서:
 *   1. 월지 지장간 중 四柱 천간에 透出한 간을 찾아 일간과의 十星으로 格局 결정
 *   2. 透出이 없으면 월지 본기(本氣)와 일간의 十星으로 결정
 *   3. 비견/겁재면 → 건록격(建祿格) 또는 양인격(羊刃格) 구분
 */

import { getTenGod } from "./tenGods";
import type { TenGod } from "./tenGods";

// ── 지장간 (地藏干) ──────────────────────────────────────────────
// [여기, (중기,) 본기]  — 본기는 마지막 원소
const JIJANGGAN: Record<string, string[]> = {
  자: ["임", "계"],
  축: ["계", "신", "기"],
  인: ["무", "병", "갑"],
  묘: ["갑", "을"],
  진: ["을", "계", "무"],
  사: ["무", "경", "병"],
  오: ["병", "기", "정"],
  미: ["정", "을", "기"],
  신: ["무", "임", "경"],
  유: ["경", "신"],
  술: ["신", "정", "무"],
  해: ["무", "갑", "임"],
};

// 양인격을 판별하기 위한 양인 지지 (일간별)
const YANGIN_BRANCH: Record<string, string> = {
  갑: "묘", 병: "오", 무: "오", 경: "유", 임: "자",
};

// 격국명 매핑 (십성 → 격국명)
const TG_TO_GUKGUK: Record<TenGod, string> = {
  비견: "건록격",
  겁재: "양인격",
  식신: "식신격",
  상관: "상관격",
  편재: "편재격",
  정재: "정재격",
  편관: "편관격",
  정관: "정관격",
  편인: "편인격",
  정인: "정인격",
};

// 격국 설명
const GUKGUK_DESC: Record<string, string> = {
  식신격:  "식신이 격을 이루어 재능과 표현력이 풍부하며, 의식주 복록이 두텁습니다. 창작·예술·음식 분야와 인연이 깊습니다.",
  상관격:  "상관이 격을 이루어 창의력과 언변이 뛰어나며, 틀을 깨는 능력이 강합니다. 예술·언론·기술 분야에 강합니다.",
  편재격:  "편재가 격을 이루어 사업 감각과 활동력이 뛰어나며, 재물 운용 능력이 강합니다. 무역·사업·금융과 인연이 깊습니다.",
  정재격:  "정재가 격을 이루어 성실하고 신중한 재물 관리 능력이 있습니다. 안정된 직업을 선호하며 꾸준한 축재를 합니다.",
  편관격:  "편관(칠살)이 격을 이루어 추진력과 결단력이 강합니다. 무관·스포츠·경쟁 직군에서 두각을 나타냅니다.",
  정관격:  "정관이 격을 이루어 명예와 규율을 중시합니다. 공직·법조·관리직에서 뛰어난 능력을 발휘합니다.",
  편인격:  "편인(효신)이 격을 이루어 독창적 사고와 직관력이 뛰어납니다. 연구·종교·예술·철학 분야와 인연이 깊습니다.",
  정인격:  "정인이 격을 이루어 학문과 덕망이 높습니다. 교육·학술·상담 분야에 적합하며 신뢰받는 인물이 됩니다.",
  건록격:  "건록격(비견)으로 일간의 기운이 강하며 독립심·자존심이 높습니다. 전문직·자영업에서 능력을 발휘합니다.",
  양인격:  "양인격으로 의지와 추진력이 강하지만 기운이 과할 수 있습니다. 군·의료·스포츠 등 강한 직군이 맞습니다.",
};

// 격국 레벨 (길격/흉격/중성)
const GUKGUK_TONE: Record<string, "길" | "흉" | "중"> = {
  식신격: "길", 정재격: "길", 정관격: "길", 정인격: "길", 건록격: "길",
  상관격: "중", 편재격: "중", 양인격: "중",
  편관격: "흉", 편인격: "중",
};

// 格局 색상
const GUKGUK_COLOR: Record<string, string> = {
  길: "bg-emerald-50 text-emerald-700 border-emerald-200",
  흉: "bg-rose-50 text-rose-700 border-rose-200",
  중: "bg-amber-50 text-amber-700 border-amber-200",
};

export interface GukgukResult {
  name: string;
  description: string;
  tone: "길" | "흉" | "중";
  colorClass: string;
  monthBranch: string;
  transparentStem: string | null;  // 透出 천간 (없으면 본기)
  isTransparent: boolean;          // 透出 여부
}

/**
 * 格局 판별
 * @param dayStem   일간 (예: "갑")
 * @param monthBranch 월지 (예: "인")
 * @param allStems  四柱의 天干 배열 (일간 제외 or 포함 모두 가능)
 */
export function determineGukguk(
  dayStem: string,
  monthBranch: string,
  allStems: string[],
): GukgukResult | null {
  if (!dayStem || !monthBranch) return null;

  const hiddenStems = JIJANGGAN[monthBranch];
  if (!hiddenStems || hiddenStems.length === 0) return null;

  // 格局 투출 체크는 연간·월간·시간만 봐야 함 (일간 제외 — 단 동일 글자가 타 주에 있으면 유지)
  const nonDayStems = (() => {
    const arr = [...allStems];
    const idx = arr.indexOf(dayStem);
    if (idx !== -1) arr.splice(idx, 1);
    return arr;
  })();

  // 1. 透出 확인: 지장간(초기→중기→정기) 중 연간·월간·시간에 있는지 확인
  //    여러 개 투출 시 정기(본기) 우선 → reversed(본기→중기→초기) 순서로 체크
  const reversed = [...hiddenStems].reverse();
  let transparentStem: string | null = null;
  for (const hs of reversed) {
    if (nonDayStems.includes(hs)) {
      transparentStem = hs;
      break;
    }
  }

  // 2. 透出이 없으면 본기 사용
  const targetStem = transparentStem ?? hiddenStems[hiddenStems.length - 1];
  const isTransparent = transparentStem !== null;

  // 3. 일간과의 십성 관계
  const tg = getTenGod(dayStem, targetStem);
  if (!tg) return null;

  // 4. 비견이면 건록격 vs 양인격 구분
  let gukgukName = TG_TO_GUKGUK[tg];
  if (tg === "비견") {
    const yanginBr = YANGIN_BRANCH[dayStem];
    gukgukName = yanginBr === monthBranch ? "양인격" : "건록격";
  }

  const tone = GUKGUK_TONE[gukgukName] ?? "중";
  return {
    name: gukgukName,
    description: GUKGUK_DESC[gukgukName] ?? "",
    tone,
    colorClass: GUKGUK_COLOR[tone],
    monthBranch,
    transparentStem,
    isTransparent,
  };
}

// ── 구조 분석 (成格 패턴) ───────────────────────────────────────

export interface StructurePattern {
  name: string;
  description: string;
  type: "상생" | "상극" | "중성";
}

/**
 * 주요 상생·상극 구조 감지
 * @param dayStem    일간
 * @param allStems   四柱의 天干 배열
 * @param allBranches 四柱의 地支 배열
 * @param monthBranch 월지
 */
export function detectStructurePatterns(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
  monthBranch?: string,
): StructurePattern[] {
  if (!dayStem) return [];

  const patterns: StructurePattern[] = [];
  const all = [...allStems, ...allBranches];

  const has = (tg: TenGod) => all.some((c) => getTenGod(dayStem, c) === tg);

  const hasSiksin  = has("식신");
  const hasSangkwan = has("상관");
  const hasSikSang = hasSiksin || hasSangkwan;
  const hasPyeonJae = has("편재");
  const hasJeongJae = has("정재");
  const hasJae      = hasPyeonJae || hasJeongJae;
  const hasPyeonGwan = has("편관");
  const hasJeongGwan = has("정관");
  const hasGwan      = hasPyeonGwan || hasJeongGwan;
  const hasPyeonIn   = has("편인");
  const hasJeongIn   = has("정인");
  const hasIn        = hasPyeonIn || hasJeongIn;

  // 식신생재 (食神生財): 식상 → 재성
  if (hasSikSang && hasJae) {
    patterns.push({
      name: "식신생재 (食神生財)",
      description: "식상(식신·상관)이 재성을 생하는 구조입니다. 재능과 노력으로 재물을 만드는 힘이 강합니다.",
      type: "상생",
    });
  }

  // 재생관 (財生官): 재성 → 관성
  if (hasJae && hasGwan) {
    patterns.push({
      name: "재생관 (財生官)",
      description: "재성이 관성을 생하는 구조입니다. 재물이 명예와 지위로 이어지며 사회적 성취가 높습니다.",
      type: "상생",
    });
  }

  // 관인상생 (官印相生): 관성 → 인성 → 일간
  if (hasGwan && hasIn) {
    patterns.push({
      name: "관인상생 (官印相生)",
      description: "관성이 인성을 생하고 인성이 일간을 돕는 구조입니다. 학문·덕망으로 명예를 쌓는 형태입니다.",
      type: "상생",
    });
  }

  // 살인상생 (殺印相生): 편관 → 인성 → 일간
  if (hasPyeonGwan && hasIn) {
    patterns.push({
      name: "살인상생 (殺印相生)",
      description: "칠살(편관)의 강한 기운을 인성이 화살(化殺)하여 일간을 돕는 구조입니다. 위기를 기회로 바꾸는 역전의 힘이 있습니다.",
      type: "상생",
    });
  }

  // 식신제살 (食神制殺): 식신 → 편관 제어
  if (hasSiksin && hasPyeonGwan) {
    patterns.push({
      name: "식신제살 (食神制殺)",
      description: "식신이 편관(칠살)을 제어하는 구조입니다. 재주와 능력으로 강한 압박을 극복하는 힘이 있습니다.",
      type: "상극",
    });
  }

  // 인수용신 (印綬用神): 신약 + 인성 → 일간 보호
  if (hasIn && !hasGwan && !hasJae) {
    patterns.push({
      name: "인수보호 (印綬保護)",
      description: "인성이 일간을 직접 돕는 구조입니다. 학문·어머니·보호자의 힘이 강하게 작용합니다.",
      type: "상생",
    });
  }

  return patterns;
}

// 색상 클래스
export const STRUCTURE_TYPE_COLOR: Record<StructurePattern["type"], string> = {
  상생: "bg-emerald-50 text-emerald-700 border-emerald-200",
  상극: "bg-amber-50 text-amber-700 border-amber-200",
  중성: "bg-sky-50 text-sky-700 border-sky-200",
};

// 月支 한자 이름 (UI 표시용)
export const BRANCH_HANJA: Record<string, string> = {
  자: "子", 축: "丑", 인: "寅", 묘: "卯", 진: "辰", 사: "巳",
  오: "午", 미: "未", 신: "申", 유: "酉", 술: "戌", 해: "亥",
};
