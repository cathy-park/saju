import { calculateShinsalFull } from "../../artifacts/saju-app/src/lib/luckCycles";

type PillarName = "시주" | "일주" | "월주" | "년주";
type Pos = { stem: string; branch: string };

// Must match SajuReport.tsx mapping
const PILLAR_TO_POSITIONS: Record<PillarName, Pos> = {
  시주: { stem: "시천간", branch: "시지" },
  일주: { stem: "일천간", branch: "일지" },
  월주: { stem: "월천간", branch: "월지" },
  년주: { stem: "연천간", branch: "연지" },
};

function visibleSetsForUI(ps: ReturnType<typeof calculateShinsalFull>[number]) {
  const pillar = ps.pillar as PillarName;
  const positions = PILLAR_TO_POSITIONS[pillar];
  const pillarItems = ps.pillarItems ?? [];
  const stemItems = ps.stemItems ?? [];
  const branchItems = ps.branchItems ?? [];

  // Matches SajuReport logic (auto items are always visible; excluded list ignored here)
  const autoStemRaw = pillar === "일주" ? [...stemItems] : [...pillarItems, ...stemItems];
  const autoBranchRaw = pillar === "일주" ? [...branchItems, ...pillarItems] : branchItems;
  return {
    positions,
    visibleAutoStem: autoStemRaw,
    visibleAutoBranch: autoBranchRaw,
    raw: { pillarItems, stemItems, branchItems },
  };
}

function union<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

function diff(a: Set<string>, b: Set<string>) {
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  return { onlyA, onlyB };
}

function runCase(title: string, dayStem: string, dayBranch: string, birthMonth: number, pillars: { pillar: PillarName; stem: string; branch: string }[]) {
  const full = calculateShinsalFull(dayStem, dayBranch, birthMonth, pillars);
  console.log("\n##", title);
  for (const ps of full) {
    const ui = visibleSetsForUI(ps);
    const engineStemSet = union(ps.stemItems ?? []);
    const engineBranchSet = union(ps.branchItems ?? []);
    const enginePillarSet = union(ps.pillarItems ?? []);

    // What UI shows for each row
    const uiStemSet = union(ui.visibleAutoStem);
    const uiBranchSet = union(ui.visibleAutoBranch);

    // Expectations:
    // - stem row should include stemItems, plus pillarItems for non-day pillars
    // - branch row should include branchItems, plus pillarItems for day pillar only
    const expectedStem = new Set<string>([
      ...[...engineStemSet],
      ...(ps.pillar !== "일주" ? [...enginePillarSet] : []),
    ]);
    const expectedBranch = new Set<string>([
      ...[...engineBranchSet],
      ...(ps.pillar === "일주" ? [...enginePillarSet] : []),
    ]);

    const dStem = diff(expectedStem, uiStemSet);
    const dBranch = diff(expectedBranch, uiBranchSet);

    const hasMismatch = dStem.onlyA.length || dStem.onlyB.length || dBranch.onlyA.length || dBranch.onlyB.length;
    if (hasMismatch) {
      console.log(`- ${ps.pillar} mismatch`);
      console.log("  expectedStemOnly:", dStem.onlyA);
      console.log("  uiStemOnly:", dStem.onlyB);
      console.log("  expectedBranchOnly:", dBranch.onlyA);
      console.log("  uiBranchOnly:", dBranch.onlyB);
    }

    // TriggerInfo integrity for all engine-added names
    const allNames = [...engineStemSet, ...engineBranchSet, ...enginePillarSet];
    const missingTrigger = allNames.filter((n) => !ps.triggerInfo?.[n]);
    if (missingTrigger.length) {
      console.log(`- ${ps.pillar} missing triggerInfo for:`, missingTrigger);
    }
  }
  console.log("done");
}

// CASES: must cover all item types
runCase(
  "귀인(천을/문창/태극) + 공망 + 귀문",
  "갑",
  "자",
  1,
  [
    { pillar: "시주", stem: "무", branch: "축" }, // 천을귀인(갑→축미)
    { pillar: "일주", stem: "갑", branch: "자" }, // 태극귀인(갑→자오)
    { pillar: "월주", stem: "정", branch: "사" }, // 문창귀인(갑→사)
    { pillar: "년주", stem: "병", branch: "유" }, // 귀문관살(자유)
  ]
);

runCase(
  "삼형(인사신) + 자형(유유)",
  "갑",
  "오",
  1,
  [
    { pillar: "시주", stem: "무", branch: "신" },
    { pillar: "일주", stem: "갑", branch: "오" },
    { pillar: "월주", stem: "정", branch: "사" },
    { pillar: "년주", stem: "병", branch: "인" },
  ]
);

runCase(
  "일주 기반(고란/음양차착/일귀인) + 백호/괴강",
  "무",
  "오",
  1,
  [
    { pillar: "시주", stem: "경", branch: "진" },
    { pillar: "일주", stem: "무", branch: "오" }, // 무오: 일귀인/고란살 세트들 점검
    { pillar: "월주", stem: "갑", branch: "인" },
    { pillar: "년주", stem: "병", branch: "술" },
  ]
);

