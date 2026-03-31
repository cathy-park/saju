import { computeStrengthResult } from "../../artifacts/saju-app/src/lib/interpretSchema";

type Case = {
  title: string;
  dayStem: string;
  monthBranch: string;
  stems: string[];
  branches: string[];
};

const cases: Case[] = [
  {
    title: "목 일간 + 봄 월지(득령) + 통근 + 득세",
    dayStem: "갑",
    monthBranch: "묘",
    stems: ["갑", "갑", "병"],        // other stems include 갑(득세)
    branches: ["묘", "인", "자", "유"], // 묘(본기 목) + 인(지장간 갑)
  },
  {
    title: "수 일간 + 여름 월지(실령) + 통근 약함 + 득세 없음",
    dayStem: "임",
    monthBranch: "오",
    stems: ["임", "병", "정"],        // other stems no 수
    branches: ["오", "사", "미", "술"], // 수 통근 거의 없음
  },
  {
    title: "토 일간 + 사계절 월지(득령) + 강한 통근",
    dayStem: "무",
    monthBranch: "진",
    stems: ["무", "기", "경"],        // other stems include 기(토 득세 1)
    branches: ["진", "술", "축", "미"], // 토 본기 다수
  },
];

for (const c of cases) {
  const r = computeStrengthResult(c.dayStem, c.monthBranch, c.stems, c.branches);
  console.log("\n##", c.title);
  console.log("strengthLevel:", r?.level ?? null, "score:", r?.score ?? null);
  console.log("explanation:", r?.explanation ?? null);
  console.log("reason:", r?.reason ?? null);
}

