import type { ComputedPillars, FiveElementCount } from "./sajuEngine";
import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";

export interface CompatibilityResult {
  score: number;
  grade: "최상" | "상" | "중" | "하" | "최하";
  summary: string;
  details: {
    title: string;
    description: string;
    isPositive: boolean;
  }[];
  elementBalance: {
    person1: FiveElementCount;
    person2: FiveElementCount;
  };
}

const ELEMENT_ORDER: Array<keyof FiveElementCount> = ["목", "화", "토", "금", "수"];

function getPillarElements(pillars: ReturnType<typeof getFinalPillars>): string[] {
  const chars: string[] = [];
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean);
  for (const p of list) {
    if (p) chars.push(...p.hangul.split(""));
  }
  return chars;
}

const STEM_ELEMENTS: Record<string, keyof FiveElementCount> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",
  임: "수", 계: "수",
};
const BRANCH_ELEMENTS: Record<string, keyof FiveElementCount> = {
  자: "수", 축: "토",
  인: "목", 묘: "목",
  진: "토", 사: "화",
  오: "화", 미: "토",
  신: "금", 유: "금",
  술: "토", 해: "수",
};

function elementsFromPillars(pillars: ReturnType<typeof getFinalPillars>): FiveElementCount {
  const counts: FiveElementCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const chars = getPillarElements(pillars);
  for (const ch of chars) {
    const el = STEM_ELEMENTS[ch] || BRANCH_ELEMENTS[ch];
    if (el) counts[el]++;
  }
  return counts;
}

function complementScore(a: FiveElementCount, b: FiveElementCount): number {
  const GENERATING = [
    ["목", "화"],
    ["화", "토"],
    ["토", "금"],
    ["금", "수"],
    ["수", "목"],
  ] as const;

  let score = 50;

  for (const [src, tgt] of GENERATING) {
    if (a[src] > 0 && b[tgt] > 0) score += 8;
    if (b[src] > 0 && a[tgt] > 0) score += 8;
  }

  const CONTROLLING = [
    ["목", "토"],
    ["토", "수"],
    ["수", "화"],
    ["화", "금"],
    ["금", "목"],
  ] as const;

  for (const [ctrl, tgt] of CONTROLLING) {
    if (a[ctrl] > 1 && b[tgt] > 0) score -= 6;
    if (b[ctrl] > 1 && a[tgt] > 0) score -= 6;
  }

  const weakA = ELEMENT_ORDER.filter((e) => a[e] === 0);
  const weakB = ELEMENT_ORDER.filter((e) => b[e] === 0);
  const complement = weakA.filter((e) => b[e] > 0).length;
  const complement2 = weakB.filter((e) => a[e] > 0).length;
  score += complement * 3 + complement2 * 3;

  return Math.max(0, Math.min(100, score));
}

function gradeFromScore(score: number): CompatibilityResult["grade"] {
  if (score >= 85) return "최상";
  if (score >= 70) return "상";
  if (score >= 50) return "중";
  if (score >= 35) return "하";
  return "최하";
}

function summaryFromGrade(grade: CompatibilityResult["grade"]): string {
  switch (grade) {
    case "최상": return "천생연분에 가까운 인연입니다. 서로를 북돋아주는 에너지가 강합니다.";
    case "상": return "잘 맞는 궁합입니다. 함께하면 서로 발전할 수 있습니다.";
    case "중": return "보통의 궁합입니다. 노력하면 좋은 관계를 만들 수 있습니다.";
    case "하": return "주의가 필요한 궁합입니다. 서로 이해하고 맞춰가는 노력이 중요합니다.";
    case "최하": return "쉽지 않은 인연입니다. 큰 노력이 필요하지만 불가능하지는 않습니다.";
  }
}

export function calculateCompatibility(
  person1: PersonRecord,
  person2: PersonRecord
): CompatibilityResult {
  const p1 = getFinalPillars(person1);
  const p2 = getFinalPillars(person2);

  const el1 = elementsFromPillars(p1);
  const el2 = elementsFromPillars(p2);

  const score = complementScore(el1, el2);
  const grade = gradeFromScore(score);

  const details: CompatibilityResult["details"] = [];

  const dayCompatible = p1.day.hangul.length >= 1 && p2.day.hangul.length >= 1;
  const stem1 = p1.day.hangul[0];
  const stem2 = p2.day.hangul[0];

  if (stem1 === stem2) {
    details.push({
      title: "일주 천간 일치",
      description: "두 사람의 일주 천간이 같아 서로 공감대가 형성됩니다.",
      isPositive: true,
    });
  }

  const GENERATING_PAIRS: Array<[string, string]> = [
    ["갑을", "병정"], ["병정", "무기"], ["무기", "경신"],
    ["경신", "임계"], ["임계", "갑을"],
  ];

  for (const [src, tgt] of GENERATING_PAIRS) {
    if (src.includes(stem1) && tgt.includes(stem2)) {
      details.push({
        title: "일주 상생",
        description: `${person1.birthInput.name}님의 일간이 ${person2.birthInput.name}님의 일간을 생합니다.`,
        isPositive: true,
      });
      break;
    }
    if (src.includes(stem2) && tgt.includes(stem1)) {
      details.push({
        title: "일주 상생",
        description: `${person2.birthInput.name}님의 일간이 ${person1.birthInput.name}님의 일간을 생합니다.`,
        isPositive: true,
      });
      break;
    }
  }

  if (Object.values(el1).filter((v) => v === 0).length > 2) {
    details.push({
      title: `${person1.birthInput.name}님 오행 편중`,
      description: "특정 오행이 결핍되어 있습니다. 상대방의 오행으로 보완이 필요합니다.",
      isPositive: false,
    });
  }

  if (score >= 70) {
    details.push({
      title: "오행 조화",
      description: "두 사람의 오행이 서로 잘 어우러져 균형을 이룹니다.",
      isPositive: true,
    });
  } else if (score < 50) {
    details.push({
      title: "오행 충돌",
      description: "일부 오행이 충돌할 수 있습니다. 서로의 차이를 이해하는 것이 중요합니다.",
      isPositive: false,
    });
  }

  return {
    score,
    grade,
    summary: summaryFromGrade(grade),
    details,
    elementBalance: { person1: el1, person2: el2 },
  };
}
