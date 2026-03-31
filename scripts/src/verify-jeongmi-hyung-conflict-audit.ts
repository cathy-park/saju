import { calculateProfileFromBirth } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { calculateShinsalFull } from "../../artifacts/saju-app/src/lib/luckCycles";
import { getDayGanZhi } from "../../artifacts/saju-app/src/lib/luckCycles";
import { determineGukguk } from "../../artifacts/saju-app/src/lib/gukguk";
import { analyzeBranchRelations } from "../../artifacts/saju-app/src/lib/branchRelations";
import { computeStrengthLevel } from "../../artifacts/saju-app/src/lib/interpretSchema";

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

const BASE_CASES: Birth[] = [
  { calendarType: "solar", year: 1989, month: 2, day: 16, hour: 19, minute: 29, gender: "여", longitude: 127 },
  { calendarType: "solar", year: 1980, month: 2, day: 4, hour: 19, minute: 29, gender: "여", longitude: 127 },
  { calendarType: "solar", year: 1980, month: 2, day: 4, hour: 4, minute: 29, gender: "여", longitude: 127 },
  { calendarType: "solar", year: 1986, month: 3, day: 4, hour: 19, minute: 29, gender: "여", longitude: 127 },
];

function dedupBirths(list: Birth[]) {
  const seen = new Set<string>();
  const out: Birth[] = [];
  for (const b of list) {
    const key = `${b.year}-${b.month}-${b.day} ${b.hour}:${String(b.minute).padStart(2, "0")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

async function findTargetJeongmiCases() {
  const target: Record<string, (expected: ReturnType<typeof expectedHyungSelfGroups>, ctx: { otherContains: boolean }) => boolean> = {
    "인사신(삼형살)": (exp) => exp.samhyeongA,
    "축술미(삼형살)": (exp) => exp.samhyeongB,
    "자묘(상형살)": (exp) => exp.sanghyeong,
    "자형(중복)": (exp) => exp.selfHyungTargets.length > 0,
    "자미(원진/귀문 기대)": (_exp, ctx) => ctx.otherContains,
  };

  const found: Partial<Record<keyof typeof target, Birth>> = {};
  const hourCandidates = [1, 4, 7, 10, 13, 16, 19, 22];
  const searchStartY = 1970;
  const searchEndY = 1999;

  for (const label of Object.keys(target)) {
    found[label as keyof typeof target] = undefined;
  }

  const keys = Object.keys(target) as (keyof typeof target)[];
  for (let y = searchStartY; y <= searchEndY; y++) {
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        // Fast filter by day gan-ji (정미)
        const dayGz = getDayGanZhi(y, m, d).hangul;
        if (dayGz !== "정미") continue;

        for (const hour of hourCandidates) {
          const b: Birth = {
            calendarType: "solar",
            year: y,
            month: m,
            day: d,
            hour,
            minute: 29,
            gender: "여",
            longitude: 127,
          };

          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const { dayStem, dayBranch, monthBranch, allBranches, allStems } = getDayPillars(cp);
          if (!(dayStem === "정" && dayBranch === "미")) continue;

          const branchCounts: Record<string, number> = {};
          for (const br of allBranches) branchCounts[br] = (branchCounts[br] ?? 0) + 1;
          const expected = expectedHyungSelfGroups(branchCounts);

          // request pairing for dayBranch 미: 원진/귀문 기대 pairOther = 자
          const otherContains = allBranches.includes("자");

          const ctx = { otherContains };
          for (const k of keys) {
            if (found[k]) continue; // already found
            if (target[k](expected, ctx)) {
              found[k] = b;
            }
          }

          if (keys.every((k) => !!found[k])) return found as Record<keyof typeof target, Birth>;
        }
      }
    }
  }

  // return what we found
  return found as Partial<Record<keyof typeof target, Birth>>;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDayPillars(cp: ReturnType<typeof calculateProfileFromBirth>["computedPillars"]) {
  const dayStem = cp.day.hangul[0];
  const dayBranch = cp.day.hangul[1];
  const monthBranch = cp.month.hangul[1];

  const allBranches = [
    cp.hour?.hangul?.[1],
    dayBranch,
    cp.month.hangul[1],
    cp.year.hangul[1],
  ].filter((x): x is string => !!x);

  const allStems = [
    cp.hour?.hangul?.[0],
    dayStem,
    cp.month.hangul[0],
    cp.year.hangul[0],
  ].filter((x): x is string => !!x);

  return { dayStem, dayBranch, monthBranch, allBranches, allStems };
}

function expectedHyungSelfGroups(branchCounts: Record<string, number>) {
  const samhyeongA = ["인", "사", "신"].every((b) => (branchCounts[b] ?? 0) > 0);
  const samhyeongB = ["축", "술", "미"].every((b) => (branchCounts[b] ?? 0) > 0);
  const sanghyeong = (branchCounts["자"] ?? 0) > 0 && (branchCounts["묘"] ?? 0) > 0;
  const selfHyungTargets = ["진", "오", "유", "해"].filter((b) => (branchCounts[b] ?? 0) >= 2);
  return { samhyeongA, samhyeongB, sanghyeong, selfHyungTargets };
}

function hasShinsal(enginePillars: ReturnType<typeof calculateShinsalFull>, name: string) {
  return enginePillars.some((p) => [...(p.branchItems ?? []), ...(p.pillarItems ?? []), ...(p.stemItems ?? [])].includes(name));
}

function getShinsalLocationsWithTrigger(enginePillars: ReturnType<typeof calculateShinsalFull>, name: string) {
  const out: { pillar: string; trigger?: string }[] = [];
  for (const ps of enginePillars) {
    const items = [...(ps.branchItems ?? []), ...(ps.stemItems ?? []), ...(ps.pillarItems ?? [])];
    if (!items.includes(name)) continue;
    out.push({ pillar: ps.pillar, trigger: ps.triggerInfo[name] });
  }
  return out;
}

function computeConflictTotalRelations(branchRelations: ReturnType<typeof analyzeBranchRelations>) {
  const conflictTypes = new Set(["형", "천간충", "지지충", "파", "해", "원진", "공망"]);
  return branchRelations.filter((r) => conflictTypes.has(r.type as any)).length;
}

async function main() {
  const targetFound = await findTargetJeongmiCases();
  const foundCases = Object.values(targetFound).filter(Boolean) as Birth[];

  const cases = dedupBirths([...BASE_CASES, ...foundCases]);

  for (let i = 0; i < cases.length; i++) {
    const b = cases[i];
    const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
    const cp = profile.computedPillars;
    const { dayStem, dayBranch, monthBranch, allBranches, allStems } = getDayPillars(cp);

    // sanity: 정미일주?
    const jeongmi = dayStem === "정" && dayBranch === "미";

    const branchCounts: Record<string, number> = {};
    for (const br of allBranches) branchCounts[br] = (branchCounts[br] ?? 0) + 1;

    const expected = expectedHyungSelfGroups(branchCounts);

    const guk = determineGukguk(dayStem, monthBranch, allStems);
    const strengthLevel = computeStrengthLevel(dayStem, profile.fiveElementDistribution, monthBranch, allStems, allBranches);

    const shinsalPillars = calculateShinsalFull(dayStem, dayBranch, b.month, [
      { pillar: "시주", stem: cp.hour?.hangul?.[0] ?? "", branch: cp.hour?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: cp.day.hangul?.[0] ?? "", branch: cp.day.hangul?.[1] ?? "" },
      { pillar: "월주", stem: cp.month.hangul?.[0] ?? "", branch: cp.month.hangul?.[1] ?? "" },
      { pillar: "년주", stem: cp.year.hangul?.[0] ?? "", branch: cp.year.hangul?.[1] ?? "" },
    ]);

    const rels = analyzeBranchRelations(cp as any);
    const conflictTotalRelations = computeConflictTotalRelations(rels);

    // expected 원진/귀문 (요청 조합 기준)
    const pairMap: Record<string, string> = { 자: "미", 미: "자", 축: "오", 오: "축", 인: "유", 유: "인", 묘: "신", 신: "묘", 진: "해", 해: "진", 사: "술", 술: "사" };
    const wonjinExpectedOther = pairMap[dayBranch] ?? "";
    const otherContains = wonjinExpectedOther ? allBranches.includes(wonjinExpectedOther) : false;

    const targets = ["삼형살(인사신)", "삼형살(축술미)", "상형살(자묘)", "자형살", "원진살", "귀문관살", "공망"];
    const presentByTarget: Record<string, boolean> = {};
    const missingExpected: string[] = [];

    // expected flags for shinsal
    const expFlags: Record<string, boolean> = {
      "삼형살(인사신)": expected.samhyeongA,
      "삼형살(축술미)": expected.samhyeongB,
      "상형살(자묘)": expected.sanghyeong,
      "자형살": expected.selfHyungTargets.length > 0,
      // 원진살/귀문관살: 요청 조합 기준으로 일지 중심 쌍이 다른 지지에 존재하면 기대
      "원진살": otherContains,
      "귀문관살": otherContains,
      "공망": true, // 공망은 旬 기반이라 "정미일주에서는 항상"이 아니라 케이스별로 engine에서 판단
    };

    for (const t of targets) presentByTarget[t] = hasShinsal(shinsalPillars, t);

    // 공망은 전문 기준 대신 engine의 trigger 존재로 확인 (단, expected 분기에는 넣지 않음)
    for (const t of targets) {
      if (t === "공망") continue;
      if (expFlags[t] && !presentByTarget[t]) missingExpected.push(t);
    }

    console.log(`\n=== CASE ${i + 1}: ${b.year}-${b.month}-${b.day} ${b.hour}:${pad2(b.minute)} (${jeongmi ? "정미일주" : "비정미"}) ===`);
    console.log(`격국(투출만) : ${guk ? guk.name : "미인정(null)"}`);
    console.log(`신강/신약(레벨) : ${strengthLevel}`);
    console.log(`기대 형살(삼형/상형/자형) : 인사신=${expected.samhyeongA ? "Y" : "N"}, 축술미=${expected.samhyeongB ? "Y" : "N"}, 자묘=${expected.sanghyeong ? "Y" : "N"}, 자형(중복)=${expected.selfHyungTargets.length ? `Y(${expected.selfHyungTargets.join(",")})` : "N"}`);
    console.log(`원진/귀문 기대(요청 조합, 일지 중심) : dayBranch=${dayBranch}, pairOther=${wonjinExpectedOther || "-"} -> 다른 지지 포함=${otherContains ? "Y" : "N"}`);
    console.log(`형충파해 totalRelations(관계엔진 필터) : ${conflictTotalRelations} / totalRelations=${rels.length}`);

    for (const t of targets) {
      const locs = getShinsalLocationsWithTrigger(shinsalPillars, t);
      const locStr = locs.length ? locs.map((l) => `${l.pillar}${l.trigger ? "" : ""}`).join(" | ") : "(없음)";
      console.log(`- ${t}: ${presentByTarget[t] ? "있음" : "없음"} ${locStr !== "(없음)" ? `(${locStr})` : ""}`);
      if (locs.length) {
        // triggerInfo가 있으면 함께 출력 (짧게)
        const triggers = uniq(locs.map((l) => l.trigger).filter(Boolean) as string[]);
        console.log(`  trigger: ${triggers.join(" || ")}`);
      }
    }

    if (missingExpected.length) {
      console.log(`=> 엔진 계산 누락으로 보이는 항목: ${missingExpected.join(", ")}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

