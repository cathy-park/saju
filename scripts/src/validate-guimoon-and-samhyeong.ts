import { calculateProfileFromBirth } from "../../artifacts/saju-app/src/lib/sajuEngine";
import { calculateShinsalFull, getDayGanZhi } from "../../artifacts/saju-app/src/lib/luckCycles";
import { analyzeBranchRelations } from "../../artifacts/saju-app/src/lib/branchRelations";

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function hasShinsal(enginePillars: ReturnType<typeof calculateShinsalFull>, name: string) {
  return enginePillars.some((p) => [...(p.branchItems ?? []), ...(p.pillarItems ?? []), ...(p.stemItems ?? [])].includes(name));
}

function getGuimoonTrigger(enginePillars: ReturnType<typeof calculateShinsalFull>) {
  const out: string[] = [];
  for (const ps of enginePillars) {
    const items = [...(ps.branchItems ?? []), ...(ps.stemItems ?? []), ...(ps.pillarItems ?? [])];
    if (!items.includes("귀문관살")) continue;
    const t = ps.triggerInfo["귀문관살"];
    if (t) out.push(t);
  }
  return uniq(out);
}

// Expected (widely cited) guimoon pairs
const GUIMOON_EXPECTED: Array<[string, string, string]> = [
  ["자", "유", "子酉"],
  ["축", "오", "丑午"],
  ["인", "미", "寅未"],
  ["묘", "신", "卯申"],
  ["진", "해", "辰亥"],
  ["사", "술", "巳戌"],
];

function expectedGuimoon(dayBranch: string, otherBranches: string[]) {
  const pair = GUIMOON_EXPECTED.find(([a, b]) => (a === dayBranch || b === dayBranch));
  if (!pair) return { expected: false, target: "" };
  const target = pair[0] === dayBranch ? pair[1] : pair[0];
  return { expected: otherBranches.includes(target), target };
}

function countConflicts(rels: ReturnType<typeof analyzeBranchRelations>) {
  const types = new Set(["형", "천간충", "지지충", "파", "해", "원진", "공망"]);
  return rels.filter((r) => types.has(r.type as any)).length;
}

function legacyGuimoonPairOf(dayBranch: string) {
  // Pre-change mapping from earlier stage in this repo (자유, 축오, 인미, 묘신, 진해, 사술)
  const M: Record<string, string> = {
    자: "유", 유: "자",
    축: "오", 오: "축",
    인: "미", 미: "인",
    묘: "신", 신: "묘",
    진: "해", 해: "진",
    사: "술", 술: "사",
  };
  return M[dayBranch] ?? "";
}

function wonjinStyleGuimoonPairOf(dayBranch: string) {
  // The interim (now reverted) mapping: 자미/축오/인유/묘신/진해/사술
  const M: Record<string, string> = {
    자: "미", 미: "자",
    축: "오", 오: "축",
    인: "유", 유: "인",
    묘: "신", 신: "묘",
    진: "해", 해: "진",
    사: "술", 술: "사",
  };
  return M[dayBranch] ?? "";
}

function simulateGuimoonPresence(
  mapFn: (d: string) => string,
  dayBranch: string,
  otherBranches: string[],
) {
  const t = mapFn(dayBranch);
  return t ? otherBranches.includes(t) : false;
}

async function findCasesForGuimoonPairs(minCases = 6) {
  const found: Birth[] = [];
  const wanted = new Set(GUIMOON_EXPECTED.map(([, , han]) => han));

  // We'll search for day pillar where dayBranch is one member of each pair
  const searchStartY = 1960;
  const searchEndY = 1999;
  const hourCandidates = [1, 4, 7, 10, 13, 16, 19, 22];

  for (let y = searchStartY; y <= searchEndY && wanted.size > 0; y++) {
    for (let m = 1; m <= 12 && wanted.size > 0; m++) {
      const dim = new Date(y, m, 0).getDate();
      for (let d = 1; d <= dim && wanted.size > 0; d++) {
        // We don't know dayBranch quickly; we filter only by checking potential match after full calc
        for (const hour of hourCandidates) {
          const b: Birth = { calendarType: "solar", year: y, month: m, day: d, hour, minute: 29, gender: "여", longitude: 127 };
          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const dayBranch = cp.day.hangul[1];
          const otherBranches = [
            cp.hour?.hangul?.[1],
            cp.month.hangul[1],
            cp.year.hangul[1],
          ].filter((x): x is string => !!x);

          const pair = GUIMOON_EXPECTED.find(([a, b2, han]) => (a === dayBranch || b2 === dayBranch) && wanted.has(han));
          if (!pair) continue;
          const target = pair[0] === dayBranch ? pair[1] : pair[0];
          if (!otherBranches.includes(target)) continue;

          found.push(b);
          wanted.delete(pair[2]);
          break;
        }
      }
    }
  }

  // Ensure at least minCases: add additional random-ish hits by scanning for any guimoon expected true
  if (found.length < minCases) {
    outer: for (let y = 1970; y <= 1999; y++) {
      for (let m = 1; m <= 12; m++) {
        const dim = new Date(y, m, 0).getDate();
        for (let d = 1; d <= dim; d++) {
          const b: Birth = { calendarType: "solar", year: y, month: m, day: d, hour: 19, minute: 29, gender: "여", longitude: 127 };
          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const dayBranch = cp.day.hangul[1];
          const otherBranches = [cp.hour?.hangul?.[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
          const exp = expectedGuimoon(dayBranch, otherBranches).expected;
          if (!exp) continue;
          found.push(b);
          if (found.length >= minCases) break outer;
        }
      }
    }
  }

  // Dedup
  const seen = new Set<string>();
  const out: Birth[] = [];
  for (const b of found) {
    const k = `${b.year}-${b.month}-${b.day} ${b.hour}:${pad2(b.minute)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

async function findCasesForSamhyeong(minCases = 6) {
  // We will search for:
  // - only-two-of {인,사,신}
  // - all-three-of {인,사,신}
  // - only-two-of {축,술,미}
  // - all-three-of {축,술,미}
  const goals = new Set(["A2", "A3", "B2", "B3"]);
  const out: Birth[] = [];
  const searchStartY = 1960;
  const searchEndY = 1999;
  const hourCandidates = [1, 4, 7, 10, 13, 16, 19, 22];

  function countSet(branches: string[], set: string[]) {
    return set.filter((b) => branches.includes(b)).length;
  }

  for (let y = searchStartY; y <= searchEndY && goals.size > 0; y++) {
    for (let m = 1; m <= 12 && goals.size > 0; m++) {
      const dim = new Date(y, m, 0).getDate();
      for (let d = 1; d <= dim && goals.size > 0; d++) {
        for (const hour of hourCandidates) {
          const b: Birth = { calendarType: "solar", year: y, month: m, day: d, hour, minute: 29, gender: "여", longitude: 127 };
          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const branches = [cp.hour?.hangul?.[1], cp.day.hangul[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
          const a = countSet(branches, ["인", "사", "신"]);
          const bcnt = countSet(branches, ["축", "술", "미"]);
          const hasA2 = a === 2;
          const hasA3 = a === 3;
          const hasB2 = bcnt === 2;
          const hasB3 = bcnt === 3;

          if (hasA2 && goals.has("A2")) { out.push(b); goals.delete("A2"); }
          if (hasA3 && goals.has("A3")) { out.push(b); goals.delete("A3"); }
          if (hasB2 && goals.has("B2")) { out.push(b); goals.delete("B2"); }
          if (hasB3 && goals.has("B3")) { out.push(b); goals.delete("B3"); }
          if (goals.size === 0) break;
        }
      }
    }
  }

  // pad to minCases with any that has A2/A3/B2/B3
  if (out.length < minCases) {
    outer: for (let y = 1970; y <= 1999; y++) {
      for (let m = 1; m <= 12; m++) {
        const dim = new Date(y, m, 0).getDate();
        for (let d = 1; d <= dim; d++) {
          const b: Birth = { calendarType: "solar", year: y, month: m, day: d, hour: 19, minute: 29, gender: "여", longitude: 127 };
          const profile = calculateProfileFromBirth(b, { localMeridianOn: true, trueSolarTimeOn: false });
          const cp = profile.computedPillars;
          const branches = [cp.hour?.hangul?.[1], cp.day.hangul[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
          const a = branches.filter((x) => ["인","사","신"].includes(x)).length;
          const bcnt = branches.filter((x) => ["축","술","미"].includes(x)).length;
          if ([2,3].includes(a) || [2,3].includes(bcnt)) {
            out.push(b);
            if (out.length >= minCases) break outer;
          }
        }
      }
    }
  }

  // Dedup
  const seen = new Set<string>();
  const dedup: Birth[] = [];
  for (const b of out) {
    const k = `${b.year}-${b.month}-${b.day} ${b.hour}:${pad2(b.minute)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(b);
  }
  return dedup.slice(0, Math.max(minCases, 6));
}

async function main() {
  const guimoonCases = await findCasesForGuimoonPairs(6);
  console.log("\n## 귀문관살 검증(6+ 케이스) — legacy vs wonjin-style vs current vs expected\n");
  console.log("| 케이스 | 일지 | 상대지지(연/월/시) | expected(일지 기준) | legacy(자유/축오/인미/묘신/진해/사술) | wonjin-style(자미/축오/인유/묘신/진해/사술) | current(engine) | triggerInfo |");
  console.log("|---|---|---|---:|---:|---:|---:|---|");

  for (const c of guimoonCases) {
    const profile = calculateProfileFromBirth(c, { localMeridianOn: true, trueSolarTimeOn: false });
    const cp = profile.computedPillars;
    const dayBranch = cp.day.hangul[1];
    const otherBranches = [cp.hour?.hangul?.[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
    const exp = expectedGuimoon(dayBranch, otherBranches);

    const legacy = simulateGuimoonPresence(legacyGuimoonPairOf, dayBranch, otherBranches);
    const wonjin = simulateGuimoonPresence(wonjinStyleGuimoonPairOf, dayBranch, otherBranches);

    const shinsal = calculateShinsalFull(cp.day.hangul[0], dayBranch, c.month, [
      { pillar: "시주", stem: cp.hour?.hangul?.[0] ?? "", branch: cp.hour?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: cp.day.hangul?.[0] ?? "", branch: cp.day.hangul?.[1] ?? "" },
      { pillar: "월주", stem: cp.month.hangul?.[0] ?? "", branch: cp.month.hangul?.[1] ?? "" },
      { pillar: "년주", stem: cp.year.hangul?.[0] ?? "", branch: cp.year.hangul?.[1] ?? "" },
    ]);

    const current = hasShinsal(shinsal, "귀문관살");
    const triggers = getGuimoonTrigger(shinsal).join(" || ");

    // pick the actual matching other branch for display (expected target or any)
    const hitTarget = exp.target ? exp.target : (legacyGuimoonPairOf(dayBranch) || wonjinStyleGuimoonPairOf(dayBranch));
    const matched = hitTarget && otherBranches.includes(hitTarget) ? `${hitTarget}` : otherBranches.join("");

    const label = `${c.year}-${c.month}-${c.day} ${c.hour}:${pad2(c.minute)}`;
    console.log(
      `| ${label} | ${dayBranch} | ${matched} | ${exp.expected ? "Y" : "N"} | ${legacy ? "Y" : "N"} | ${wonjin ? "Y" : "N"} | ${current ? "Y" : "N"} | ${triggers || "-"} |`,
    );
  }

  console.log("\n### 귀문관살 변화 요약(legacy vs current)\n");
  console.log("| 구분 | 케이스 | 일지 | 상대지지 | legacy | current | triggerInfo |");
  console.log("|---|---|---|---|---:|---:|---|");
  for (const c of guimoonCases) {
    const profile = calculateProfileFromBirth(c, { localMeridianOn: true, trueSolarTimeOn: false });
    const cp = profile.computedPillars;
    const dayStem = cp.day.hangul[0];
    const dayBranch = cp.day.hangul[1];
    const otherBranches = [cp.hour?.hangul?.[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
    const legacy = simulateGuimoonPresence(legacyGuimoonPairOf, dayBranch, otherBranches);
    const shinsal = calculateShinsalFull(dayStem, dayBranch, c.month, [
      { pillar: "시주", stem: cp.hour?.hangul?.[0] ?? "", branch: cp.hour?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: cp.day.hangul?.[0] ?? "", branch: cp.day.hangul?.[1] ?? "" },
      { pillar: "월주", stem: cp.month.hangul?.[0] ?? "", branch: cp.month.hangul?.[1] ?? "" },
      { pillar: "년주", stem: cp.year.hangul?.[0] ?? "", branch: cp.year.hangul?.[1] ?? "" },
    ]);
    const current = hasShinsal(shinsal, "귀문관살");
    const triggers = getGuimoonTrigger(shinsal).join(" || ") || "-";
    const exp = expectedGuimoon(dayBranch, otherBranches);
    const matched = exp.target && otherBranches.includes(exp.target) ? exp.target : otherBranches.join("");
    const label = `${c.year}-${c.month}-${c.day} ${c.hour}:${pad2(c.minute)}`;
    if (legacy !== current) {
      console.log(`| ${legacy && !current ? "기존에 있었는데 now 사라짐" : "기존에 없었는데 now 생김"} | ${label} | ${dayBranch} | ${matched} | ${legacy ? "Y" : "N"} | ${current ? "Y" : "N"} | ${triggers} |`);
    }
  }

  const samhyeongCases = await findCasesForSamhyeong(6);
  console.log("\n## 삼형(인사신/축술미) 검증(6+ 케이스) — current relations vs expected\n");
  console.log("| 케이스 | 지지(시/일/월/년) | 인사신 개수 | 축술미 개수 | expected(2=부분형,3=삼형) | current(관계엔진 '형' 포함 여부) | 형 관계 설명(일부) |");
  console.log("|---|---|---:|---:|---|---:|---|");

  for (const c of samhyeongCases) {
    const profile = calculateProfileFromBirth(c, { localMeridianOn: true, trueSolarTimeOn: false });
    const cp = profile.computedPillars;
    const branches = [cp.hour?.hangul?.[1], cp.day.hangul[1], cp.month.hangul[1], cp.year.hangul[1]].filter((x): x is string => !!x);
    const a = branches.filter((x) => ["인", "사", "신"].includes(x)).length;
    const b = branches.filter((x) => ["축", "술", "미"].includes(x)).length;
    const expected = [
      a === 3 ? "인사신=삼형" : a === 2 ? "인사신=부분형" : "인사신=-",
      b === 3 ? "축술미=삼형" : b === 2 ? "축술미=부분형" : "축술미=-",
    ].join(", ");

    const rels = analyzeBranchRelations(cp as any);
    const hasHyung = rels.some((r) => r.type === "형");
    const hyungDesc = rels.filter((r) => r.type === "형").slice(0, 3).map((r) => r.description).join(" / ") || "-";

    const label = `${c.year}-${c.month}-${c.day} ${c.hour}:${pad2(c.minute)}`;
    console.log(`| ${label} | ${branches.join("")} | ${a} | ${b} | ${expected} | ${hasHyung ? "Y" : "N"} | ${hyungDesc} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

