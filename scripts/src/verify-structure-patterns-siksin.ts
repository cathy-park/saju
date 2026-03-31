import { detectStructurePatterns } from "../../artifacts/saju-app/src/lib/gukguk";

function runCase(title: string, dayStem: string, allStems: string[], allBranches: string[], monthBranch?: string) {
  const patterns = detectStructurePatterns(dayStem, allStems, allBranches, monthBranch);
  const names = patterns.map((p) => p.name);
  console.log("\n##", title);
  console.log("dayStem:", dayStem, "stems:", allStems.join("·"), "branches:", allBranches.join("·"));
  console.log("patterns:", names);
}

// Case A: 상관(丁) + 재성(戊) 존재, 식신(丙) 없음 → "식신생재"가 뜨면 안 됨
runCase(
  "A) 식신=0(상관만) + 재성 있음",
  "갑",
  ["갑", "정", "무"],          // 정=상관, 무=편재/정재 계열(갑 기준 재성은 토)
  ["자", "묘", "진", "유"],    // 진=토(재성)
  "묘"
);

// Case B: 식신(丙) + 재성(戊) 존재 → "식신생재"가 떠야 함
runCase(
  "B) 식신 있음 + 재성 있음",
  "갑",
  ["갑", "병", "무"],          // 병=식신, 무=재성
  ["자", "묘", "진", "유"],
  "묘"
);

// Case C: 식신 있음, 재성 없음 → 뜨면 안 됨
runCase(
  "C) 식신 있음 + 재성 없음",
  "갑",
  ["갑", "병", "경"],          // 경=편관/정관 계열(갑 기준 관성은 금)
  ["자", "묘", "유", "해"],    // 유=금(관성), 해=수(인성)
  "묘"
);

