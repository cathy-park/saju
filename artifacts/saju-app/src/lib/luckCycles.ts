import type { BirthInput, ComputedPillars } from "./sajuEngine";
import { equationOfTimeMins } from "./sajuEngine";

export const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
export const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const STEMS_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

const YANG_STEMS = new Set(["갑", "병", "무", "경", "임"]);

// ── Solar term calculator for accurate 대운수 ─────────────────────
// Computes sun's ecliptic longitude (degrees) for a given Date (UTC)
// Uses simplified VSOP87 — accurate to ~0.01° for years 1900–2100
function sunLongitudeDeg(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360) + 360) % 360;
  const Mrad = M * Math.PI / 180;
  const C = Math.sin(Mrad) * (1.9146 - 0.004817 * T - 0.000014 * T * T)
          + Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T)
          + Math.sin(3 * Mrad) * 0.00029;
  return ((L0 + C) % 360 + 360) % 360;
}

// 12 month-boundary 절기 (節) — solar longitudes where month pillar changes
// 소한(285)→축, 입춘(315)→인, 경칩(345)→묘, 청명(15)→진,
// 입하(45)→사,  망종(75)→오,  소서(105)→미, 입추(135)→신,
// 백로(165)→유, 한로(195)→술, 입동(225)→해, 대설(255)→자
const JULGGI_LONS = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255] as const;

// Find the date when the sun reaches targetLon (degrees), searching near year.
// FIXED: use Jan 1 (lon ≈ 280°) as reference instead of March equinox (lon ≈ 0°).
// The old March-equinox reference caused 소한/입춘/경칩 (285°/315°/345°) to always
// resolve to the NEXT year, inflating 대운수 to 10 for early-year births.
function findSolarTermDate(year: number, targetLon: number): Date {
  // Compute actual sun longitude on Jan 1 of the target year (KST noon = UTC 03:00)
  const jan1 = new Date(Date.UTC(year, 0, 1, 12));
  const jan1Lon = sunLongitudeDeg(jan1);
  // Forward distance from jan1Lon to targetLon (always positive, 0–360)
  const daysFromJan1 = ((targetLon - jan1Lon + 360) % 360) / 360 * 365.25;
  let d = new Date(jan1.getTime() + daysFromJan1 * 86400000);
  // Newton-Raphson refinement (converges in ~5 iterations)
  for (let i = 0; i < 12; i++) {
    const lon = sunLongitudeDeg(d);
    let diff = targetLon - lon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    d = new Date(d.getTime() + (diff / 360) * 365.25 * 86400000);
  }
  return d;
}

export interface DaewoonSuOpts {
  /**
   * Use actual birth hour/minute (KST→UTC) for solar-term distance.
   * When false, falls back to fixed noon UTC (old, less accurate behaviour).
   * Default: true.
   */
  exactSolarTermBoundaryOn?: boolean;
  /**
   * Add Equation of Time offset to birth moment before computing distance.
   * Requires actual birth time to be meaningful.
   * Default: false.
   */
  trueSolarTimeOn?: boolean;
}

// ── 12 절기(節) 이름 테이블 ──────────────────────────────────────────
const JULGGI_NAMES: Record<number, string> = {
  285: "소한(小寒)", 315: "입춘(立春)", 345: "경칩(驚蟄)",
   15: "청명(淸明)",  45: "입하(立夏)",  75: "망종(芒種)",
  105: "소서(小暑)", 135: "입추(立秋)", 165: "백로(白露)",
  195: "한로(寒露)", 225: "입동(立冬)", 255: "대설(大雪)",
};

/**
 * ═══════════════════════════════════════════════════════════════
 * 대운수 (Daewoon start age) — 범용 표준 알고리즘
 * ═══════════════════════════════════════════════════════════════
 *
 * [방향 결정 — 양남음녀 / 음남양녀 원칙]
 *   순행(Forward): (남성 AND 양년간) OR (여성 AND 음년간)
 *   역행(Backward): (남성 AND 음년간) OR (여성 AND 양년간)
 *   양년간: 갑·병·무·경·임 / 음년간: 을·정·기·신·계
 *
 * [대상 절기 선택]
 *   순행 → 출생 시각 직후(直後) 첫 번째 절기(節)
 *   역행 → 출생 시각 직전(直前) 마지막 절기(節)
 *
 * [절기 탐색 방법 — 핵심]
 *   (출생연도-1)·(출생연도)·(출생연도+1) 각 12절기 = 36개를 모두 계산.
 *   시간순 정렬 후 "출생 이후 첫 번째" 또는 "출생 이전 마지막"을 선택.
 *   → 연도 경계, 소한·입춘·경칩 등 연초 절기 모두 정확 처리.
 *   (구 알고리즘은 3월춘분 기준점 사용 → 소한/입춘/경칩을 다음 해로 오인)
 *
 * [대운수 공식]
 *   diffDays = |절기 일시 − 출생 일시|  (소수점 포함 일 단위)
 *   대운수   = ⌈ diffDays / 3 ⌉         (올림, 최소 1)
 *   (전통 규칙: 3일 = 1년, 올림 적용)
 *
 * [회귀 테스트 — 검증된 기준값]
 *   TC1  1990-01-23 19:29 KST 여 경(양) → 역행 소한  17.8일 → 6
 *   TC2  1990-01-04 12:00 KST 남 경(양) → 순행 소한   1.5일 → 1
 *   TC3  1990-01-07 23:00 KST 여 경(양) → 역행 소한   2.0일 → 1
 *   TC4  2000-04-11 12:00 KST 남 경(양) → 순행 입하  24.1일 → 9
 *   TC5  2004-10-28 12:00 KST 여 갑(양) → 역행 한로  20.2일 → 7
 * ═══════════════════════════════════════════════════════════════
 */
export function calculateDaewoonSu(birthInput: BirthInput, pillars: ComputedPillars, opts?: DaewoonSuOpts): number {
  try {
    // ── 1. 출생 시각을 UTC로 변환 (KST = UTC+9) ──────────────────────
    const useExact = opts?.exactSolarTermBoundaryOn ?? true;
    let hKST = useExact && !birthInput.timeUnknown ? (birthInput.hour   ?? 12) : 12;
    let mKST = useExact && !birthInput.timeUnknown ? (birthInput.minute ?? 0)  : 0;

    // 균시차(Equation of Time) 보정 — 옵션 활성화 시
    if (useExact && !birthInput.timeUnknown && (opts?.trueSolarTimeOn ?? false)) {
      mKST += Math.round(equationOfTimeMins(birthInput.year, birthInput.month, birthInput.day));
    }
    while (mKST < 0)   { mKST += 60; hKST -= 1; }
    while (mKST >= 60) { mKST -= 60; hKST += 1; }

    const birthDate = new Date(Date.UTC(
      birthInput.year, birthInput.month - 1, birthInput.day,
      hKST - 9, mKST,   // KST → UTC (−9h)
    ));

    // ── 2. 방향 결정 (양남음녀 원칙) ────────────────────────────────
    const yearStem = pillars.year?.hangul?.[0];
    if (!yearStem) return 5;
    const isYangYear = YANG_STEMS.has(yearStem);
    const isMale     = birthInput.gender === "남";
    // 순행: (양년간+남) OR (음년간+여)
    // 역행: (음년간+남) OR (양년간+여)
    const isForward  = (isMale && isYangYear) || (!isMale && !isYangYear);

    // ── 3. 출생연도 ±1년 범위의 모든 절기 36개를 시간순 정렬 ────────
    //    → 연도 경계·연초 절기(소한·입춘·경칩) 오인 문제 원천 차단
    const allTerms: { lon: number; name: string; date: Date }[] = [];
    for (const lon of JULGGI_LONS) {
      for (const y of [birthInput.year - 1, birthInput.year, birthInput.year + 1]) {
        allTerms.push({ lon, name: JULGGI_NAMES[lon] ?? String(lon), date: findSolarTermDate(y, lon) });
      }
    }
    allTerms.sort((a, b) => a.date.getTime() - b.date.getTime());

    // ── 4. 방향에 따라 대상 절기 선택 ───────────────────────────────
    let targetTerm: { lon: number; name: string; date: Date } | undefined;
    if (isForward) {
      // 순행: 출생 시각 이후 최초 절기
      targetTerm = allTerms.find(t => t.date.getTime() > birthDate.getTime());
    } else {
      // 역행: 출생 시각 이전 최후 절기
      targetTerm = [...allTerms].reverse().find(t => t.date.getTime() < birthDate.getTime());
    }
    if (!targetTerm) return 5;

    // ── 5. 대운수 계산 ───────────────────────────────────────────────
    // 공식: 대운수 = ⌈ diffDays / 3 ⌉, 최소 1
    // (3일 간격 = 1년 대운, 전통 올림 적용)
    const diffDays = Math.abs(targetTerm.date.getTime() - birthDate.getTime()) / 86400000;
    const su = Math.max(1, Math.ceil(diffDays / 3));

    // ── 디버그 로그 (브라우저 콘솔 F12에서 확인) ─────────────────────
    const kst = 9 * 3600000;
    console.group("🔢 대운수 계산");
    console.log("출생 KST :", new Date(birthDate.getTime() + kst).toISOString().slice(0, 16) + " KST");
    console.log("방향     :", isForward ? "순행(Forward)" : "역행(Backward)",
      `[${isMale ? "남" : "여"}, 년간 ${yearStem}(${isYangYear ? "양" : "음"})]`);
    console.log("대상 절기:", targetTerm.name,
      "→", new Date(targetTerm.date.getTime() + kst).toISOString().slice(0, 16) + " KST");
    console.log("차이     :", diffDays.toFixed(3) + "일");
    console.log("대운수   : ⌈" + diffDays.toFixed(3) + "/3⌉ = ⌈" + (diffDays / 3).toFixed(3) + "⌉ = " + su);
    console.groupEnd();

    return su;
  } catch (e) {
    console.error("대운수 계산 오류:", e);
    return 5;
  }
}

export interface GanZhi {
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  hangul: string;
  hanja: string;
}

function ganZhiFromIndex(idx: number): GanZhi {
  const i = ((idx % 60) + 60) % 60;
  const s = STEMS[i % 10];
  const b = BRANCHES[i % 12];
  return {
    stem: s, branch: b,
    stemHanja: STEMS_HANJA[i % 10], branchHanja: BRANCHES_HANJA[i % 12],
    hangul: s + b, hanja: STEMS_HANJA[i % 10] + BRANCHES_HANJA[i % 12],
  };
}

function ganZhiIndex(stem: string, branch: string): number {
  const si = STEMS.indexOf(stem);
  const bi = BRANCHES.indexOf(branch);
  if (si < 0 || bi < 0) return 0;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === si && i % 12 === bi) return i;
  }
  return 0;
}

export interface DaewoonEntry {
  startAge: number;
  endAge: number;
  ganZhi: GanZhi;
}

export function calculateDaewoon(birthInput: BirthInput, pillars: ComputedPillars, opts?: DaewoonSuOpts): DaewoonEntry[] {
  const monthPillar = pillars.month;
  if (!monthPillar) return [];
  const yearStem = pillars.year?.hangul?.[0];
  if (!yearStem) return [];
  const isYangYear = YANG_STEMS.has(yearStem);
  const isMale = birthInput.gender === "남";
  const isForward = (isMale && isYangYear) || (!isMale && !isYangYear);
  const startIdx = ganZhiIndex(monthPillar.hangul[0], monthPillar.hangul[1]);

  // Calculate proper 대운수 from solar term distance (replaces hardcoded 5)
  const daewoonSu = calculateDaewoonSu(birthInput, pillars, opts);

  const entries: DaewoonEntry[] = [];
  for (let i = 0; i < 10; i++) {
    const offset = isForward ? i + 1 : -(i + 1);
    const ganzhi = ganZhiFromIndex(startIdx + offset);
    const startAge = daewoonSu + i * 10;
    entries.push({ startAge, endAge: startAge + 9, ganZhi: ganzhi });
  }
  return entries;
}

export function getYearGanZhi(year: number): GanZhi {
  const offset = year - 1984;
  return ganZhiFromIndex(((offset % 60) + 60) % 60);
}

export function getMonthGanZhi(year: number, solarMonth: number): GanZhi {
  const yearStemIdx = ((year - 4) % 10 + 10) % 10;
  // Jan=축(1), Feb=인(2), Mar=묘(3), ..., Dec=자(0)
  const monthBranchIdx = solarMonth % 12;
  // Starting stem for 인월 per year stem
  const startStemForInWol = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0][yearStemIdx];
  const offset = (monthBranchIdx - 2 + 12) % 12;
  const monthStemIdx = (startStemForInWol + offset) % 10;
  return {
    stem: STEMS[monthStemIdx], branch: BRANCHES[monthBranchIdx],
    stemHanja: STEMS_HANJA[monthStemIdx], branchHanja: BRANCHES_HANJA[monthBranchIdx],
    hangul: STEMS[monthStemIdx] + BRANCHES[monthBranchIdx],
    hanja: STEMS_HANJA[monthStemIdx] + BRANCHES_HANJA[monthBranchIdx],
  };
}

// Reference: 2000-01-01 = 戊午(무오) = ganzhi index 54
// Verified: 2026-03-30 → index (54+9585)%60 = 39 = 계묘 ✓
export function getDayGanZhi(year: number, month: number, day: number): GanZhi {
  const ref = new Date(2000, 0, 1);
  const target = new Date(year, month - 1, day);
  const diffDays = Math.round((target.getTime() - ref.getTime()) / 86400000);
  return ganZhiFromIndex(54 + diffDays);
}

export interface LuckCycles {
  daewoon: DaewoonEntry[];
  seun: { year: number; ganZhi: GanZhi }[];
  wolun: { year: number; month: number; ganZhi: GanZhi };
  ilun: { year: number; month: number; day: number; ganZhi: GanZhi };
}

export function calculateLuckCycles(birthInput: BirthInput, pillars: ComputedPillars, opts?: DaewoonSuOpts): LuckCycles {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const daewoon = calculateDaewoon(birthInput, pillars, opts);
  const seun = Array.from({ length: 15 }, (_, i) => ({
    year: currentYear - 2 + i,
    ganZhi: getYearGanZhi(currentYear - 2 + i),
  }));
  const wolun = { year: currentYear, month: currentMonth, ganZhi: getMonthGanZhi(currentYear, currentMonth) };
  const ilun = { year: currentYear, month: currentMonth, day: currentDay, ganZhi: getDayGanZhi(currentYear, currentMonth, currentDay) };
  return { daewoon, seun, wolun, ilun };
}

// ── Full Shinsal System ───────────────────────────────────────────

// Branch-based targets from day branch
const DOWHWA_T: Record<string, string> = {
  인: "묘", 오: "묘", 술: "묘",
  해: "자", 묘: "자", 미: "자",
  신: "유", 자: "유", 진: "유",
  사: "오", 유: "오", 축: "오",
};
const YEONGMA_T: Record<string, string> = {
  인: "신", 오: "신", 술: "신",
  신: "인", 자: "인", 진: "인",
  해: "사", 묘: "사", 미: "사",
  사: "해", 유: "해", 축: "해",
};
const HWAGAE_T: Record<string, string> = {
  인: "술", 오: "술", 술: "술",
  해: "미", 묘: "미", 미: "미",
  신: "진", 자: "진", 진: "진",
  사: "축", 유: "축", 축: "축",
};
const JANGSEONG_T: Record<string, string> = {
  인: "오", 오: "오", 술: "오",
  신: "자", 자: "자", 진: "자",
  사: "유", 유: "유", 축: "유",
  해: "묘", 묘: "묘", 미: "묘",
};
const BANAN_T: Record<string, string> = {
  인: "미", 오: "미", 술: "미",
  신: "축", 자: "축", 진: "축",
  해: "진", 묘: "진", 미: "진",
  사: "술", 유: "술", 축: "술",
};
// 겁살 (劫殺)
const GEOBSAL_T: Record<string, string> = {
  인: "해", 오: "해", 술: "해",
  사: "인", 유: "인", 축: "인",
  신: "사", 자: "사", 진: "사",
  해: "신", 묘: "신", 미: "신",
};
// 재살 (災殺)
const JAESAL_T: Record<string, string> = {
  인: "자", 오: "자", 술: "자",
  사: "묘", 유: "묘", 축: "묘",
  신: "오", 자: "오", 진: "오",
  해: "유", 묘: "유", 미: "유",
};
// 천살 (天殺)
const CHEONSAL_T: Record<string, string> = {
  인: "술", 오: "술", 술: "술",
  사: "미", 유: "미", 축: "미",
  신: "진", 자: "진", 진: "진",
  해: "축", 묘: "축", 미: "축",
};
// 지살 (地殺)
const JISAL_T: Record<string, string> = {
  인: "인", 오: "인", 술: "인",
  사: "사", 유: "사", 축: "사",
  신: "신", 자: "신", 진: "신",
  해: "해", 묘: "해", 미: "해",
};
// 망신살 (亡身殺)
const MANGSIN_T: Record<string, string> = {
  인: "신", 오: "신", 술: "신",
  사: "해", 유: "해", 축: "해",
  신: "인", 자: "인", 진: "인",
  해: "사", 묘: "사", 미: "사",
};
// 육해살 (六害殺) — pairs
const YUKHAE_PAIR: Record<string, string> = {
  자: "미", 미: "자",
  축: "오", 오: "축",
  인: "사", 사: "인",
  묘: "진", 진: "묘",
  신: "해", 해: "신",
  유: "술", 술: "유",
};

// Stem-based branch targets from day stem
const CHUNEUL_T: Record<string, string[]> = {
  갑: ["축", "미"], 무: ["축", "미"], 경: ["축", "미"],
  을: ["자", "신"], 기: ["자", "신"],
  병: ["해", "유"], 정: ["해", "유"],
  임: ["사", "묘"], 계: ["사", "묘"],
  신: ["인", "오"],
};
const MUNCHANG_T: Record<string, string> = {
  갑: "사", 을: "오", 병: "신", 정: "유",
  무: "신", 기: "유", 경: "해", 신: "자",
  임: "인", 계: "묘",
};
const MUNGOK_T: Record<string, string> = {
  갑: "해", 을: "자", 병: "인", 정: "묘",
  무: "인", 기: "묘", 경: "사", 신: "오",
  임: "신", 계: "유",
};
const GUMYEO_T: Record<string, string> = {
  갑: "진", 을: "사", 병: "미", 정: "신",
  무: "미", 기: "신", 경: "술", 신: "해",
  임: "축", 계: "인",
};
const YANGIN_T: Record<string, string> = {
  갑: "묘", 병: "오", 무: "오", 경: "유", 임: "자",
};
const HONGYEOM_T: Record<string, string> = {
  갑: "오", 을: "오", 병: "인", 정: "미",
  무: "진", 기: "진", 경: "술", 신: "유",
  임: "자", 계: "신",
};
// 태극귀인 (太極貴人) — from day stem
const TAEGEUK_T: Record<string, string[]> = {
  갑: ["자", "오"], 을: ["자", "오"],
  병: ["묘", "유"], 정: ["묘", "유"],
  무: ["진", "술", "축", "미"], 기: ["진", "술", "축", "미"],
  경: ["인", "해"], 신: ["인", "해"],
  임: ["사", "신"], 계: ["사", "신"],
};

// 고신살 (孤辰殺): isolation star — from day branch 3합 group
const GOSHIN_T: Record<string, string> = {
  인: "사", 오: "사", 술: "사",
  신: "해", 자: "해", 진: "해",
  해: "인", 묘: "인", 미: "인",
  사: "신", 유: "신", 축: "신",
};
// 과숙살 (寡宿殺): widowhood star — from day branch 3합 group
const GWASUK_T: Record<string, string> = {
  인: "축", 오: "축", 술: "축",
  신: "미", 자: "미", 진: "미",
  해: "술", 묘: "술", 미: "술",
  사: "진", 유: "진", 축: "진",
};
// 귀문관살 (鬼門關殺): ghostly gate pairs
const GUIMOON_PAIR: Record<string, string> = {
  자: "유", 유: "자",
  축: "오", 오: "축",
  인: "미", 미: "인",
  묘: "신", 신: "묘",
  진: "해", 해: "진",
  사: "술", 술: "사",
};
// 현침살 (懸針殺): needle stems — 甲辛壬癸
const HYEONCHIM_STEMS = new Set(["갑", "신", "임", "계"]);
// 천복귀인 (天福貴人): from birth month
const CHEONBOK_T: Record<number, string> = {
  1: "인", 2: "축", 3: "자", 4: "해", 5: "술", 6: "유",
  7: "신", 8: "미", 9: "오", 10: "사", 11: "진", 12: "묘",
};

// Pillar-combo based (exact hangul match)
const BAEKHO_SET = new Set(["갑진", "을미", "병술", "정축", "무진", "경진", "신미", "임술", "계축"]);
const GOEGANG_SET = new Set(["경진", "경술", "임진", "무술"]);

// Month-based lookup (천덕귀인): isStem=true → match heavenly stem; false → match earthly branch.
// Months 2 and 4 both map to the Hangul "신" but mean different things:
//   month 2 → 申 (earthly branch 9th = monkey)  → check branch
//   month 4 → 辛 (heavenly stem 8th = metal-yin)  → check stem
// Months 5, 8, 11 reference earthly branches (亥寅巳) that do not collide with stems.
const CHEONDUK_TYPED: Record<number, { char: string; isStem: boolean }> = {
  1:  { char: "정", isStem: true  },
  2:  { char: "신", isStem: false }, // 申 (branch)
  3:  { char: "임", isStem: true  },
  4:  { char: "신", isStem: true  }, // 辛 (stem)
  5:  { char: "해", isStem: false }, // 亥 (branch)
  6:  { char: "갑", isStem: true  },
  7:  { char: "계", isStem: true  },
  8:  { char: "인", isStem: false }, // 寅 (branch)
  9:  { char: "병", isStem: true  },
  10: { char: "을", isStem: true  },
  11: { char: "사", isStem: false }, // 巳 (branch)
  12: { char: "경", isStem: true  },
};
// 월덕귀인: 인오술→병, 해묘미→갑, 신자진→임, 사유축→경
const WOLDUK_BY_GROUP: Record<string, string> = {
  인: "병", 오: "병", 술: "병",
  해: "갑", 묘: "갑", 미: "갑",
  신: "임", 자: "임", 진: "임",
  사: "경", 유: "경", 축: "경",
};

export interface PillarShinsal {
  pillar: string;     // "년주" | "월주" | "일주" | "시주"
  stem: string;
  branch: string;
  stemItems: string[];
  branchItems: string[];
  pillarItems: string[]; // whole-pillar shinsal (백호, 괴강)
}

export function calculateShinsalFull(
  dayStem: string,
  dayBranch: string,
  birthMonth: number,
  pillars: { pillar: string; stem: string; branch: string }[],
  shinsalMode: "conservative" | "default" | "expanded" = "default"
): PillarShinsal[] {
  // 공망 (空亡): void branches from day pillar's 旬 (decade group)
  // 甲子순→술·해, 甲戌순→신·유, 甲申순→오·미,
  // 甲午순→진·사, 甲辰순→인·묘, 甲寅순→자·축
  const dayPillarIdx = ganZhiIndex(dayStem, dayBranch);
  const dayZhun = Math.floor(dayPillarIdx / 10);
  const gongmangBranches = [
    BRANCHES[(10 - dayZhun * 2 + 12) % 12],
    BRANCHES[(11 - dayZhun * 2 + 12) % 12],
  ];

  const dowhwaTarget = DOWHWA_T[dayBranch] ?? "";
  const yeongmaTarget = YEONGMA_T[dayBranch] ?? "";
  const hwagaeTarget = HWAGAE_T[dayBranch] ?? "";
  const jangseongTarget = JANGSEONG_T[dayBranch] ?? "";
  const bananTarget = BANAN_T[dayBranch] ?? "";
  const geobsalTarget = GEOBSAL_T[dayBranch] ?? "";
  const jaesalTarget = JAESAL_T[dayBranch] ?? "";
  const cheonsalTarget = CHEONSAL_T[dayBranch] ?? "";
  const jisalTarget = JISAL_T[dayBranch] ?? "";
  const mangsinsalTarget = MANGSIN_T[dayBranch] ?? "";
  const yukhaePairOf = YUKHAE_PAIR[dayBranch] ?? "";
  const goshinTarget = GOSHIN_T[dayBranch] ?? "";
  const gwasukTarget = GWASUK_T[dayBranch] ?? "";
  const guimoonPairOf = GUIMOON_PAIR[dayBranch] ?? "";
  const cheonbokTarget = CHEONBOK_T[birthMonth] ?? "";

  const chuneulBranches = CHUNEUL_T[dayStem] ?? [];
  const munchangTarget = MUNCHANG_T[dayStem] ?? "";
  const mungokTarget = MUNGOK_T[dayStem] ?? "";
  const gumyeoTarget = GUMYEO_T[dayStem] ?? "";
  const yanginTarget = YANGIN_T[dayStem] ?? "";
  const hongyeomTarget = HONGYEOM_T[dayStem] ?? "";
  const taegeukBranches = TAEGEUK_T[dayStem] ?? [];
  const cheondukEntry = CHEONDUK_TYPED[birthMonth] ?? null;
  const woldukChar = WOLDUK_BY_GROUP[dayBranch] ?? "";

  // Find year branch for 천의성 (year branch +1)
  const yearPillar = pillars.find((p) => p.pillar === "년주");
  const yearBranchIdx = yearPillar ? BRANCHES.indexOf(yearPillar.branch) : -1;
  const cheonuiTarget = yearBranchIdx >= 0 ? BRANCHES[(yearBranchIdx + 1) % 12] : "";

  return pillars.map(({ pillar, stem, branch }) => {
    const branchItems: string[] = [];
    const stemItems: string[] = [];
    const pillarItems: string[] = [];
    const hangul = stem + branch;

    if (branch) {
      // Branch-based (from day branch)
      if (branch === dowhwaTarget) branchItems.push("도화");
      if (branch === hongyeomTarget) branchItems.push("홍염");
      if (branch === yeongmaTarget) branchItems.push("역마");
      if (branch === hwagaeTarget) branchItems.push("화개");
      if (chuneulBranches.includes(branch)) branchItems.push("천을귀인");
      if (branch === munchangTarget) branchItems.push("문창귀인");
      if (branch === mungokTarget) branchItems.push("문곡귀인");
      if (branch === gumyeoTarget) branchItems.push("금여");
      if (branch === yanginTarget) branchItems.push("양인살");
      if (branch === jangseongTarget) branchItems.push("장성살");
      if (branch === bananTarget) branchItems.push("반안살");
      if (branch === geobsalTarget) branchItems.push("겁살");
      if (branch === jaesalTarget) branchItems.push("재살");
      if (branch === cheonsalTarget) branchItems.push("천살");
      if (branch === jisalTarget) branchItems.push("지살");
      if (branch === mangsinsalTarget) branchItems.push("망신살");
      if (taegeukBranches.includes(branch)) branchItems.push("태극귀인");
      if (branch !== dayBranch && branch === yukhaePairOf) branchItems.push("육해살");
      // New additions
      if (goshinTarget && branch === goshinTarget) branchItems.push("고신살");
      if (gwasukTarget && branch === gwasukTarget) branchItems.push("과숙살");
      if (guimoonPairOf && branch !== dayBranch && branch === guimoonPairOf) branchItems.push("귀문관살");
      if (cheonbokTarget && branch === cheonbokTarget) branchItems.push("천복귀인");
      if (cheonuiTarget && branch === cheonuiTarget && pillar !== "년주") branchItems.push("천의성");
      // 천문성 (天門星): 술(戌)·해(亥) 지지에 발동 — 하늘 문이 열리는 기운, 영적 감수성·종교적 직관
      // 보수 모드: 년주·일주에만 적용 (과도발동 방지)
      // 기본 모드: 4개 기둥 모두 적용 (전통 만세력 기준)
      if (branch === "술" || branch === "해") {
        const allowedByMode = shinsalMode === "conservative"
          ? (pillar === "년주" || pillar === "일주")
          : true; // default: all pillars
        if (allowedByMode) branchItems.push("천문성");
      }
      // 공망 (空亡): void branch — day pillar is excluded (it defines the void)
      if (pillar !== "일주" && gongmangBranches.includes(branch)) branchItems.push("공망");
    }

    if (stem) {
      // 천덕귀인: type-aware — stem months check stem only, branch months check branch only
      if (cheondukEntry) {
        if (cheondukEntry.isStem && stem === cheondukEntry.char) stemItems.push("천덕귀인");
        else if (!cheondukEntry.isStem && branch === cheondukEntry.char) branchItems.push("천덕귀인");
      }
      if (stem === woldukChar) stemItems.push("월덕귀인");
      // 현침살: needle strokes in stem
      if (HYEONCHIM_STEMS.has(stem)) stemItems.push("현침살");
    }

    // Pillar-combo based
    if (hangul && BAEKHO_SET.has(hangul)) pillarItems.push("백호살");
    if (hangul && GOEGANG_SET.has(hangul)) pillarItems.push("괴강살");

    return { pillar, stem, branch, stemItems, branchItems, pillarItems };
  });
}

// Legacy interface kept for backward compat
export interface PositionShinsal {
  position: string;
  branch: string;
  items: string[];
}

export function calculateShinsalByPosition(
  dayStem: string,
  dayBranch: string,
  positions: { position: string; branch: string }[]
): PositionShinsal[] {
  const full = calculateShinsalFull(dayStem, dayBranch, 1,
    positions.map(p => ({ pillar: p.position, stem: "", branch: p.branch }))
  );
  return full
    .map(r => ({ position: r.pillar, branch: r.branch, items: r.branchItems }))
    .filter(p => p.items.length > 0);
}

export interface Shinsal {
  name: string;
  branches: string[];
  matched: string[];
}
export function calculateShinsal(dayStem: string, dayBranch: string, allBranches: string[]): Shinsal[] {
  const positions = allBranches.map((b, i) => ({
    position: ["년지", "월지", "일지", "시지"][i] ?? `${i}지`, branch: b,
  }));
  const byPos = calculateShinsalByPosition(dayStem, dayBranch, positions);
  const nameMap: Record<string, Shinsal> = {};
  for (const p of byPos) {
    for (const name of p.items) {
      if (!nameMap[name]) nameMap[name] = { name, branches: [], matched: [] };
      nameMap[name].matched.push(p.branch);
    }
  }
  return Object.values(nameMap);
}

export const ALL_SHINSAL_NAMES: string[] = [
  // 귀인 계열
  "천을귀인", "문창귀인", "문곡귀인", "학당귀인", "천덕귀인", "월덕귀인",
  "태극귀인", "금여", "복성귀인", "국인귀인", "암록", "천관귀인", "천복귀인", "천주귀인",
  "관귀학관",
  // 활동·이동 계열
  "역마", "지살", "천살",
  // 관계·감정 계열
  "도화", "홍염", "망신살",
  // 충돌·위험 계열
  "양인살", "괴강살", "백호살", "겁살",
  // 고립 계열
  "고신살", "과숙살",
  // 성취·보호 계열
  "반안살", "장성살",
  // 기타
  "화개", "육해살", "귀문관살", "현침살", "천의성", "천문성", "재살",
  // 허(虛) 계열
  "공망",
];

export const SHINSAL_GROUPS: { label: string; names: string[] }[] = [
  {
    label: "귀인 계열",
    names: ["천을귀인", "문창귀인", "문곡귀인", "학당귀인", "천덕귀인", "월덕귀인",
            "태극귀인", "금여", "복성귀인", "국인귀인", "암록", "천관귀인", "천복귀인", "천주귀인",
            "관귀학관"],
  },
  {
    label: "활동·이동 계열",
    names: ["역마", "지살", "천살"],
  },
  {
    label: "관계·감정 계열",
    names: ["도화", "홍염", "망신살"],
  },
  {
    label: "충돌·위험 계열",
    names: ["양인살", "괴강살", "백호살", "겁살"],
  },
  {
    label: "고립 계열",
    names: ["고신살", "과숙살"],
  },
  {
    label: "성취·보호 계열",
    names: ["반안살", "장성살"],
  },
  {
    label: "기타",
    names: ["화개", "육해살", "귀문관살", "현침살", "천의성", "천문성", "재살"],
  },
  {
    label: "허(虛) 계열",
    names: ["공망"],
  },
];

export const SHINSAL_DESC: Record<string, string> = {
  // 귀인 계열 — 좋은 기운이지만 과신 금지
  천을귀인: "귀인의 도움이 있으나, 스스로 준비된 상태일 때 발현됩니다",
  문창귀인: "학문·표현력을 높이지만, 과도한 완벽주의로 흐를 수 있습니다",
  문곡귀인: "언변과 지략이 강해지지만, 말보다 실행이 뒷받침돼야 합니다",
  학당귀인: "학습 집중력이 올라가는 시기이나, 지나친 이론 편중에 주의하세요",
  천덕귀인: "보호의 기운이 있으나, 주변 의존도가 높아질 수 있습니다",
  월덕귀인: "재난을 막는 덕운이나, 안일함으로 이어지지 않도록 주의가 필요합니다",
  태극귀인: "전환점이 될 수 있는 귀인 에너지이나, 상황 판단을 신중히 해야 합니다",
  금여: "우아하고 품위 있는 기운이나, 현실적 감각을 잃지 않도록 주의하세요",
  복성귀인: "위기 회복력이 높아지나, 무모한 도전은 자제하는 것이 좋습니다",
  국인귀인: "공적인 도움이 있으나, 관계 의존적이 되지 않도록 독립성을 유지하세요",
  암록: "숨은 기회가 있으나, 적극적으로 탐색하지 않으면 지나칠 수 있습니다",
  천관귀인: "명예 기운이 강해지나, 체면에 집착하면 오히려 역효과를 낼 수 있습니다",
  천복귀인: "복덕의 기운이 있으나, 노력 없는 행운은 오래 지속되기 어렵습니다",
  천주귀인: "귀인 보호의 기운이나, 수동적 자세는 오히려 기회를 놓칠 수 있습니다",
  관귀학관: "학문·관직·명예가 함께 발현되는 귀인으로, 준비된 자에게 빛을 발합니다",
  // 활동·이동 계열 — 활동성과 불안정성이 공존
  역마: "만남과 이동의 기회가 늘어나지만, 정착성이 약해질 수 있어 주의가 필요합니다",
  지살: "이동과 변동이 활발해지나, 섣불리 자리를 옮기면 후회로 이어질 수 있습니다",
  천살: "예기치 않은 변수가 생길 수 있으니 계획에 여유를 두는 것이 좋습니다",
  // 관계·감정 계열 — 매력과 불안정 사이
  도화: "매력과 인기를 높여주지만, 관계의 안정성 및 깊이와는 별개입니다",
  홍염: "정열과 화려함이 강해지나, 감정 기복과 과소비에 주의가 필요합니다",
  망신살: "구설과 실수 가능성이 높아지니, 언행을 신중하게 관리하세요",
  // 충돌·위험 계열 — 에너지와 위험이 동전의 양면
  양인살: "강한 추진력을 주지만, 이 에너지가 타인과의 갈등으로 이어질 수 있습니다",
  괴강살: "뛰어난 집중력과 고집이 있으나, 독단적 결정으로 관계가 어려워질 수 있습니다",
  백호살: "강렬한 돌파력이 있지만, 충동적 행동이나 사고 위험도 함께 높아집니다",
  겁살: "위협과 손재 가능성이 있으니, 재물과 계약 관계에서 신중함이 필요합니다",
  // 고립 계열 — 독립성과 고독의 양면
  고신살: "독립성과 자립심이 강해지나, 고독감과 이별 경험이 동반될 수 있습니다",
  과숙살: "독립적인 성향이 강해지나, 지나치면 관계에서 거리감을 줄 수 있습니다",
  // 성취·보호 계열
  반안살: "안정과 축적의 기운이나, 변화 회피가 성장 기회를 놓치게 할 수 있습니다",
  장성살: "리더십과 성취욕이 강해지나, 주도권 다툼에 주의가 필요합니다",
  // 기타
  화개: "내면 성찰과 예술적 감각이 높아지지만, 관계에서 거리감으로 작용할 수 있습니다",
  육해살: "갈등과 충돌 에너지가 있으니, 감정 조절과 관계 관리에 집중하세요",
  귀문관살: "직관력과 감수성이 날카로워지나, 신경 예민 상태가 이어질 수 있습니다",
  현침살: "날카로운 집중력이 생기나, 신체 수술 또는 사고 주의가 필요한 시기입니다",
  천의성: "치유와 봉사 기운이 강해지나, 과도한 희생으로 에너지가 소진될 수 있습니다",
  천문성: "하늘의 문이 열리는 기운으로 영적 직관과 종교적 감수성이 높아지나, 현실 감각을 함께 유지해야 합니다",
  재살: "재난·사고 위험이 있으니, 이동 중 안전과 건강 관리에 주의하세요",
  공망: "해당 지지가 비어 있어 그 기운이 약화되나, 정신·영적 세계에서는 오히려 선명하게 작용합니다",
};

export const SHINSAL_COLOR: Record<string, string> = {
  // 귀인 계열
  천을귀인: "bg-yellow-100 text-yellow-800 border-yellow-200",
  문창귀인: "bg-sky-100 text-sky-800 border-sky-200",
  문곡귀인: "bg-cyan-100 text-cyan-800 border-cyan-200",
  학당귀인: "bg-blue-50 text-blue-700 border-blue-200",
  천덕귀인: "bg-orange-100 text-orange-800 border-orange-200",
  월덕귀인: "bg-teal-100 text-teal-800 border-teal-200",
  태극귀인: "bg-yellow-50 text-yellow-900 border-yellow-300",
  금여: "bg-amber-100 text-amber-800 border-amber-200",
  복성귀인: "bg-lime-50 text-lime-700 border-lime-200",
  국인귀인: "bg-green-50 text-green-700 border-green-200",
  암록: "bg-emerald-100 text-emerald-800 border-emerald-200",
  천관귀인: "bg-violet-50 text-violet-700 border-violet-200",
  천복귀인: "bg-lime-100 text-lime-800 border-lime-200",
  천주귀인: "bg-purple-50 text-purple-700 border-purple-200",
  관귀학관: "bg-indigo-50 text-indigo-700 border-indigo-200",
  // 활동·이동 계열
  역마: "bg-blue-100 text-blue-800 border-blue-200",
  지살: "bg-emerald-50 text-emerald-700 border-emerald-200",
  천살: "bg-slate-100 text-slate-700 border-slate-200",
  // 관계·감정 계열
  도화: "bg-pink-100 text-pink-800 border-pink-200",
  홍염: "bg-rose-100 text-rose-800 border-rose-200",
  망신살: "bg-neutral-100 text-neutral-700 border-neutral-200",
  // 충돌·위험 계열
  양인살: "bg-red-100 text-red-800 border-red-200",
  괴강살: "bg-zinc-100 text-zinc-700 border-zinc-300",
  백호살: "bg-gray-100 text-gray-700 border-gray-300",
  겁살: "bg-red-50 text-red-700 border-red-200",
  // 고립 계열
  고신살: "bg-purple-50 text-purple-700 border-purple-200",
  과숙살: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  // 성취·보호 계열
  반안살: "bg-stone-100 text-stone-700 border-stone-200",
  장성살: "bg-indigo-100 text-indigo-800 border-indigo-200",
  // 기타
  화개: "bg-violet-100 text-violet-800 border-violet-200",
  육해살: "bg-rose-50 text-rose-700 border-rose-200",
  귀문관살: "bg-zinc-100 text-zinc-600 border-zinc-300",
  현침살: "bg-slate-100 text-slate-600 border-slate-300",
  천의성: "bg-teal-50 text-teal-700 border-teal-200",
  천문성: "bg-indigo-50 text-indigo-700 border-indigo-200",
  재살: "bg-orange-50 text-orange-700 border-orange-200",
  // 허(虛) 계열
  공망: "bg-gray-50 text-gray-500 border-gray-200",
};
