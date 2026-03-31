import { calculateShinsalFull } from "../../artifacts/saju-app/src/lib/luckCycles";

type PillarName = "시주" | "일주" | "월주" | "년주";

function printCase(
  title: string,
  input: { dayStem: string; dayBranch: string; birthMonth: number; pillars: { pillar: PillarName; stem: string; branch: string }[] }
) {
  const { dayStem, dayBranch, birthMonth, pillars } = input;
  const full = calculateShinsalFull(dayStem, dayBranch, birthMonth, pillars);
  console.log("\n==============================");
  console.log("CASE:", title);
  console.log("입력 사주:", pillars.map((p) => `${p.pillar}${p.stem}${p.branch}`).join(" / "));
  console.log("기준: dayStem=", dayStem, "dayBranch=", dayBranch, "birthMonth=", birthMonth);

  for (const ps of full) {
    const items = {
      pillarItems: ps.pillarItems ?? [],
      stemItems: ps.stemItems ?? [],
      branchItems: ps.branchItems ?? [],
    };
    const all = [...items.pillarItems, ...items.stemItems, ...items.branchItems];
    if (all.length === 0) continue;
    console.log("\n-", ps.pillar, `${ps.stem}${ps.branch}`);
    console.log("  표시 위치:");
    console.log("   - pillarItems:", items.pillarItems);
    console.log("   - stemItems:", items.stemItems);
    console.log("   - branchItems:", items.branchItems);
    console.log("  triggerInfo(발동 근거):");
    for (const n of all) {
      console.log(`   - ${n}: ${ps.triggerInfo?.[n] ?? "(missing)"}`);
    }
  }
}

// CASE 1: 귀인계열 반드시 발동(천을/문창/태극)
printCase("CASE 1 귀인계열(천을/문창/태극) 확정", {
  dayStem: "갑",
  dayBranch: "자",
  birthMonth: 1,
  pillars: [
    { pillar: "시주", stem: "무", branch: "축" }, // 천을귀인(갑→축/미)
    { pillar: "일주", stem: "갑", branch: "자" }, // 태극귀인(갑→자/오)
    { pillar: "월주", stem: "정", branch: "사" }, // 문창귀인(갑→사)
    { pillar: "년주", stem: "병", branch: "진" },
  ],
});

// CASE 2: 삼형 또는 귀문 확정
printCase("CASE 2 삼형(인사신) + 귀문(자유) 확정", {
  dayStem: "갑",
  dayBranch: "자",
  birthMonth: 1,
  pillars: [
    { pillar: "시주", stem: "무", branch: "신" }, // 삼형
    { pillar: "일주", stem: "갑", branch: "자" },
    { pillar: "월주", stem: "정", branch: "사" }, // 삼형
    { pillar: "년주", stem: "병", branch: "인" }, // 삼형
  ],
});

// CASE 3: 공망 명확 발생
printCase("CASE 3 공망 발생(지지 매핑 확인)", {
  dayStem: "갑",
  dayBranch: "술",
  birthMonth: 1,
  pillars: [
    { pillar: "시주", stem: "병", branch: "신" }, // 공망 후보(케이스에 따라)
    { pillar: "일주", stem: "갑", branch: "술" },
    { pillar: "월주", stem: "정", branch: "유" },
    { pillar: "년주", stem: "무", branch: "신" },
  ],
});

