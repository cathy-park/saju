import { calculateProfileFromBirth } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { determineGukguk } from "../../artifacts/saju-app/src/lib/gukguk";
import { getTenGod } from "../../artifacts/saju-app/src/lib/tenGods";
import type { TenGod } from "../../artifacts/saju-app/src/lib/tenGods";
import { calculateShinsalFull } from "../../artifacts/saju-app/src/lib/luckCycles";

/**
 * Legacy (pre-strict) 격국 판정 로직 재현:
 * - 지장간 투출이 없어도 월지 본기(마지막 원소) 기준으로 격국을 반환하던 방식
 * - strict 규칙 비교용 (before/after)
 */
function determineGukgukLegacy(
  dayStem: string,
  monthBranch: string,
  allStems: string[],
): ReturnType<typeof determineGukguk> {
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

  const YANGIN_BRANCH: Record<string, string> = {
    갑: "묘",
    병: "오",
    무: "오",
    경: "유",
    임: "자",
  };

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

  const GUKGUK_TONE: Record<string, "길" | "흉" | "중"> = {
    식신격: "길",
    정재격: "길",
    정관격: "길",
    정인격: "길",
    건록격: "길",
    상관격: "중",
    편재격: "중",
    양인격: "중",
    편관격: "흉",
    편인격: "중",
  };

  const GUKGUK_COLOR: Record<string, string> = {
    길: "bg-emerald-50 text-emerald-700 border-emerald-200",
    흉: "bg-rose-50 text-rose-700 border-rose-200",
    중: "bg-amber-50 text-amber-700 border-amber-200",
  };

  if (!dayStem || !monthBranch) return null;

  const hiddenStems = JIJANGGAN[monthBranch];
  if (!hiddenStems || hiddenStems.length === 0) return null;

  const nonDayStems = allStems.filter((s) => s !== dayStem);

  const reversed = [...hiddenStems].reverse();
  let transparentStem: string | null = null;
  for (const hs of reversed) {
    if (nonDayStems.includes(hs)) {
      transparentStem = hs;
      break;
    }
  }

  // legacy fallback: 투출이 없으면 본기(마지막 원소)
  const targetStem = transparentStem ?? hiddenStems[hiddenStems.length - 1];
  const isTransparent = transparentStem !== null;

  const tg = getTenGod(dayStem, targetStem);
  if (!tg) return null;

  let gukgukName = TG_TO_GUKGUK[tg];
  if (tg === "비견") {
    const yanginBr = YANGIN_BRANCH[dayStem];
    gukgukName = yanginBr === monthBranch ? "양인격" : "건록격";
  }

  const tone = GUKGUK_TONE[gukgukName] ?? "중";

  return {
    // keep shape compatible with current result
    name: gukgukName,
    description: "",
    tone,
    colorClass: GUKGUK_COLOR[tone],
    monthBranch,
    transparentStem,
    isTransparent,
  };
}

function printResult(label: string, r: ReturnType<typeof determineGukguk>) {
  if (!r) {
    console.log(`\n[${label}] null (격국 미인정)`);
    return;
  }
  console.log(`\n[${label}] ${r.name}`);
  console.log(`  tone: ${r.tone}`);
  console.log(`  monthBranch: ${r.monthBranch}`);
  console.log(`  transparentStem: ${r.transparentStem}`);
  if ((r as any).explanation) {
    console.log("  explanation:");
    for (const line of (r as any).explanation as string[]) {
      console.log(`   - ${line}`);
    }
  }
}

async function main() {
  // 박소연: 1989-02-16 19:29
  // 성별은 격국 투출 판정에 영향 없지만, 나머지 엔진 흐름 안정성을 위해 기본값 설정
  const profile = calculateProfileFromBirth(
    {
      name: "박소연",
      gender: "여",
      calendarType: "solar",
      year: 1989,
      month: 2,
      day: 16,
      hour: 19,
      minute: 29,
      timeUnknown: false,
      longitude: 127,
    },
    // timeOpts: 라이브 엔진 기본값과 맞추기
    {
      localMeridianOn: true,
      trueSolarTimeOn: false,
    },
  );

  const computed = profile.computedPillars;
  const dayStem = computed.day.hangul[0];
  const dayBranch = computed.day.hangul[1];
  const monthBranch = computed.month.hangul[1];
  const allStems = [
    computed.hour?.hangul[0] ?? "",
    computed.day.hangul[0],
    computed.month.hangul[0],
    computed.year.hangul[0],
  ].filter((s) => !!s);

  console.log("=== 박소연 사주(격국 비교) ===");
  console.log(`day: ${computed.day.hangul}, monthBranch: ${computed.month.hangul[1]}`);
  console.log(`heaven stems (allStems): ${allStems.join("·")}`);

  const legacy = determineGukgukLegacy(dayStem, monthBranch, allStems);
  const strict = determineGukguk(dayStem, monthBranch, allStems);

  printResult("before (legacy)", legacy);
  printResult("after (strict 투출만)", strict);

  // Shinsal spot-check (공망 위치 + triggerInfo 존재 확인)
  const shinsalPillars = calculateShinsalFull(dayStem, dayBranch, 2, [
    { pillar: "시주", stem: computed.hour?.hangul?.[0] ?? "", branch: computed.hour?.hangul?.[1] ?? "" },
    { pillar: "일주", stem: computed.day.hangul?.[0] ?? "", branch: computed.day.hangul?.[1] ?? "" },
    { pillar: "월주", stem: computed.month.hangul?.[0] ?? "", branch: computed.month.hangul?.[1] ?? "" },
    { pillar: "년주", stem: computed.year.hangul?.[0] ?? "", branch: computed.year.hangul?.[1] ?? "" },
  ], "default");

  console.log("\n=== 박소연 사주(공망 위치/triggerInfo) ===");
  for (const ps of shinsalPillars) {
    const items = [
      ...(ps.pillarItems ?? []),
      ...(ps.stemItems ?? []),
      ...(ps.branchItems ?? []),
    ];
    if (items.includes("공망")) {
      console.log(`- ${ps.pillar}: 공망`);
      console.log(`  trigger: ${ps.triggerInfo["공망"] ?? "(missing triggerInfo)"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

