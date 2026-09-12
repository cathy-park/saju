import type { ZiweiChart } from "../types";

export function buildZiweiCopyPrompt(chart: ZiweiChart, options?: { omitIntro?: boolean }): string {
  const b = chart.birth, lunar = chart.lunarBirth;
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - b.year + 1;
  const currentMajor = chart.majorPeriods.find((period) => currentAge >= period.ageRange[0] && currentAge <= period.ageRange[1]);
  const currentAnnual = chart.annualPeriods.find((period) => period.year === currentYear);
  // omitIntro — 궁합처럼 이 함수를 두 사람분 이어붙여 쓰는 호출부는 자기 상단에 이미 같은
  // 취지의 안내 문구를 한 번 써두므로, 여기서 "아래는 계산된 자미두수 명반 원자료입니다..."/
  // "# 자미두수 명반 구조"를 사람마다 반복하지 않는다(중복 문구 제거, 구조는 그대로).
  const identityLines = [`이름: ${b.name}`, `출생: ${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ${String(b.hour).padStart(2, "0")}:${String(b.minute ?? 0).padStart(2, "0")}`, `출생지: ${b.birthplace || "미입력"}`,
    `음력: ${lunar.year}-${lunar.month}-${lunar.day}${lunar.isLeapMonth ? " (윤달)" : ""}`, `명궁: ${chart.mingGong.branch}`, `신궁: ${chart.shenGong.branch} · ${chart.shenGong.palace}`, `오행국: ${chart.fiveElementBureau.name}`,
    `현재 대한: ${currentMajor ? `${currentMajor.ageRange[0]}~${currentMajor.ageRange[1]}세 · ${currentMajor.palace}(${currentMajor.branch})` : "계산 범위 밖"}`,
    `현재 유년: ${currentAnnual ? `${currentAnnual.year}년 · ${currentAnnual.palace}(${currentAnnual.branch})` : "계산 범위 밖"}`, "",
    "## 12궁"];
  const lines = options?.omitIntro
    ? identityLines
    : ["아래는 계산된 자미두수 명반 원자료입니다. 제공된 구조 밖의 별·궁·사화를 만들지 말고 종합적으로 해석해주세요.", "", "# 자미두수 명반 구조", ...identityLines];
  for (const palace of chart.palaces) lines.push(`- ${palace.palace}(${palace.branch})${palace.isShenGong ? " [신궁]" : ""}: 주성 ${palace.majorStars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ""}`).join(", ") || "없음"}; 보조성 ${palace.minorStars.map((s) => s.name).join(", ") || "없음"}; 사화 ${palace.transformations.join(", ") || "없음"}; 대궁 ${palace.oppositePalace}; 삼방: ${palace.trinePalaces.join(", ")}`);
  lines.push("", "## 생년 사화", ...Object.entries(chart.birthYearTransformations).map(([kind, value]) => `- ${kind}: ${value.star} · ${value.palace}`), "", "## 대한", ...chart.majorPeriods.map((p) => `- ${p.ageRange[0]}~${p.ageRange[1]}세: ${p.palace}(${p.branch})`), "", "## 유년", ...chart.annualPeriods.map((p) => `- ${p.year}년: ${p.palace}(${p.branch})`));
  return lines.join("\n");
}
