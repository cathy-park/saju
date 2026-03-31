import { calculateProfileFromBirth } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { calculateShinsalFull } from "../../artifacts/saju-app/src/lib/luckCycles";
import { determineGukguk } from "../../artifacts/saju-app/src/lib/gukguk";
import { analyzeBranchRelations } from "../../artifacts/saju-app/src/lib/branchRelations";
import { computeStrengthLevel } from "../../artifacts/saju-app/src/lib/interpretSchema";
import { getDayGanZhi } from "../../artifacts/saju-app/src/lib/luckCycles";
import type { ComputedPillars } from "../../artifacts/saju-app/src/lib/sajuEngine";

type Birth = {
  calendarType: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: "남" | "여";
  longitude: number;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function formatList(list: string[]) {
  return list.length ? list.join(", ") : "(없음)";
}

function simulateDisplayShinsalNames(
  shinsalPillars: ReturnType<typeof calculateShinsalFull>,
  mode: "before" | "after",
) {
  // UI rules:
  // - stem row uses: (pillarItems + stemItems) for most pillars
  // - branch row uses: branchItems
  // - for 일주 special stars, after-fix moves pillarItems from 일천간 row -> 일지 row
  const byRow: Record<string, string[]> = {};

  for (const ps of shinsalPillars) {
    const pillar = ps.pillar; // 시주/일주/월주/년주
    const stemPos = `${pillar}-천간`;
    const branchPos = `${pillar}-지지`;

    const pillarItems = ps.pillarItems ?? [];
    const stemItems = ps.stemItems ?? [];
    const branchItems = ps.branchItems ?? [];

    const stemItemsRendered =
      mode === "after" && pillar === "일주"
        ? [...stemItems]
        : [...pillarItems, ...stemItems];

    const branchItemsRendered =
      mode === "after" && pillar === "일주"
        ? [...branchItems, ...pillarItems]
        : [...branchItems];

    byRow[stemPos] = stemItemsRendered;
    byRow[branchPos] = branchItemsRendered;
  }

  const allNames = uniq(
    Object.values(byRow).flatMap((x) => x ?? []),
  );

  return { allNames, byRow };
}

function extractRelationsSummary(
  computedPillars: ComputedPillars,
) {
  const rels = analyzeBranchRelations(computedPillars as any);
  const has = rels.some((r) => ["형", "파", "해", "원진", "지지충", "천간충", "공망"].includes(r.type));
  return { has, count: rels.length };
}

function computeStrengthSummary(
  dayStem: string,
  monthBranch: string,
  allStems: string[],
  allBranches: string[],
  fiveElements: any,
) {
  const level = computeStrengthLevel(dayStem, fiveElements, monthBranch, allStems, allBranches);
  return { level };
}

function buildShinsalPillarsForUIInput(
  dayStem: string,
  dayBranch: string,
  input: Birth,
  computedPillars: ComputedPillars,
  fortuneMonthParam: number,
) {
  const hourP = computedPillars.hour;
  const monthP = computedPillars.month;
  const dayP = computedPillars.day;
  const yearP = computedPillars.year;

  return calculateShinsalFull(
    dayStem,
    dayBranch,
    fortuneMonthParam,
    [
      {
        pillar: "시주",
        stem: hourP?.hangul?.[0] ?? "",
        branch: hourP?.hangul?.[1] ?? "",
      },
      {
        pillar: "일주",
        stem: dayP.hangul[0],
        branch: dayP.hangul[1],
      },
      {
        pillar: "월주",
        stem: monthP?.hangul?.[0] ?? "",
        branch: monthP?.hangul?.[1] ?? "",
      },
      {
        pillar: "년주",
        stem: yearP?.hangul?.[0] ?? "",
        branch: yearP?.hangul?.[1] ?? "",
      },
    ],
    "default",
  );
}

async function main() {
  // 공망 void branches 확인을 위해, 정미일주의 void 조합이 고정(인/묘)이라고 가정하지 않고
  // 엔진 결과 shinsalPillars로 "공망 위치"를 기준으로 케이스를 뽑습니다.

  const cases: Birth[] = [];
  // 1) 박소연(요구 케이스)
  cases.push({
    calendarType: "solar",
    year: 1989,
    month: 2,
    day: 16,
    hour: 19,
    minute: 29,
    gender: "여",
    longitude: 127,
  });

  // 2) 다른 정미일주 날짜 3개를 자동 탐색(월지/연지/시지 공망 포함하도록 선별)
  const foundByGoal: Record<"월지공망" | "연지공망" | "시지공망", boolean> = {
    월지공망: false,
    연지공망: false,
    시지공망: false,
  };

  const targetNeed: Array<keyof typeof foundByGoal> = ["월지공망", "연지공망", "시지공망"];

  const startY = 1980;
  const endY = 1995;

  for (let y = startY; y <= endY && targetNeed.some((k) => !foundByGoal[k]); y++) {
    for (let m = 1; m <= 12 && targetNeed.some((k) => !foundByGoal[k]); m++) {
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth && targetNeed.some((k) => !foundByGoal[k]); d++) {
        const gj = getDayGanZhi(y, m, d).hangul;
        if (gj !== "정미") continue;

        // 기본 시각(19:29)
        const baseBirth: Birth = {
          calendarType: "solar",
          year: y,
          month: m,
          day: d,
          hour: 19,
          minute: 29,
          gender: "여",
          longitude: 127,
        };

        // 시지 공망을 위해: 寅(04:29) / 卯(05:29)
        const hourCandidates: Birth[] = [
          baseBirth,
          { ...baseBirth, hour: 4, minute: 29 }, // 寅
          { ...baseBirth, hour: 5, minute: 29 }, // 卯
        ];

        for (const b of hourCandidates) {
          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const dm = cp.day.hangul[0];
          const db = cp.day.hangul[1];
          if (dm !== "정" || db !== "미") continue;

          const shinsalPillars = buildShinsalPillarsForUIInput(dm, db, b, cp, b.month);
          const voidHit = {
            연: shinsalPillars.find((p) => p.pillar === "년주") ? (shinsalPillars.find((p) => p.pillar === "년주")!.branchItems ?? []).includes("공망") : false,
            월: shinsalPillars.find((p) => p.pillar === "월주") ? (shinsalPillars.find((p) => p.pillar === "월주")!.branchItems ?? []).includes("공망") : false,
            일: (shinsalPillars.find((p) => p.pillar === "일주")!.branchItems ?? []).includes("공망"),
            시: (shinsalPillars.find((p) => p.pillar === "시주")!.branchItems ?? []).includes("공망"),
          };

          if (voidHit.월 && !foundByGoal.월지공망) {
            foundByGoal.월지공망 = true;
            cases.push(b);
          }
          if (voidHit.연 && !foundByGoal.연지공망) {
            foundByGoal.연지공망 = true;
            cases.push(b);
          }
          if (voidHit.시 && !foundByGoal.시지공망) {
            foundByGoal.시지공망 = true;
            cases.push(b);
          }

          if (targetNeed.every((k) => foundByGoal[k])) break;
        }
      }
    }
  }

  // Dedup by date+time
  const dedupKey = (b: Birth) => `${b.year}-${b.month}-${b.day} ${b.hour}:${String(b.minute).padStart(2, "0")}`;
  const uniqueCases: Birth[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    const key = dedupKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCases.push(c);
  }

  const selected = uniqueCases.slice(0, 4); // keep output bounded

  for (let i = 0; i < selected.length; i++) {
    const b = selected[i];
    const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
    const cp = profile.computedPillars;
    const dayStem = cp.day.hangul[0];
    const dayBranch = cp.day.hangul[1];
    const monthBranch = cp.month.hangul[1];

    const allStems = [cp.hour?.hangul?.[0], dayStem, cp.month.hangul[0], cp.year.hangul[0]].filter((x): x is string => !!x);
    const allBranches = [cp.hour?.hangul?.[1], dayBranch, cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);

    const guk = determineGukguk(dayStem, monthBranch, allStems);
    const rels = extractRelationsSummary(cp);
    const strength = computeStrengthSummary(dayStem, monthBranch, allStems, allBranches, profile.fiveElementDistribution);

    const shinsalPillars = buildShinsalPillarsForUIInput(dayStem, dayBranch, b, cp, b.month);

    const before = simulateDisplayShinsalNames(shinsalPillars, "before");
    const after = simulateDisplayShinsalNames(shinsalPillars, "after");

    const keyStar = "음양차착살";
    const beforeLocStem = before.byRow["일주-천간"]?.includes(keyStar);
    const beforeLocBranch = before.byRow["일주-지지"]?.includes(keyStar);
    const afterLocStem = after.byRow["일주-천간"]?.includes(keyStar);
    const afterLocBranch = after.byRow["일주-지지"]?.includes(keyStar);

    const moved = beforeLocStem && afterLocBranch && !afterLocStem;

    console.log(`\n=== 케이스 ${i + 1}: ${b.year}-${b.month}-${b.day} ${b.hour}:${String(b.minute).padStart(2, "0")} ===`);
    console.log(`격국(투출만) : ${guk ? guk.name : "미인정(null)"}`);
    console.log(`형충파해/원진/공망 존재 여부 : ${rels.has} (totalRelations=${rels.count})`);
    console.log(`신강/신약 판정 : ${strength.level}`);

    console.log(`\n[Before UI display mapping]`);
    console.log(`음양차착살 위치: 일천간=${beforeLocStem ? "O" : "X"}, 일지=${beforeLocBranch ? "O" : "X"}`);
    console.log(`신살 리스트(이름): ${formatList(before.allNames.sort())}`);

    console.log(`\n[After UI display mapping]`);
    console.log(`음양차착살 위치: 일천간=${afterLocStem ? "O" : "X"}, 일지=${afterLocBranch ? "O" : "X"}`);
    console.log(`신살 리스트(이름): ${formatList(after.allNames.sort())}`);
    if (moved) console.log(`결과: 음양차착살이 '일천간->일지'로 이동되어 '누락'처럼 보이던 문제 완화 가능`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

