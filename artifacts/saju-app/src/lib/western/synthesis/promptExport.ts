// 서양점성술 "AI 해석 프롬프트 복사" — 해석 fact가 아니라 canonical 계산 구조를
// 사람이 읽을 수 있는 Markdown으로 내보낸다. 목표는 앱이 해석을 만드는 게 아니라 정확한
// 계산 원자료를 ChatGPT에 복사해 상담하게 하는 것(대표 지시) — 여기서 새 해석 문장을
// 만들지 않는다.
import type { WesternNatalChart } from "../types";
import type { WesternSynastryReport } from "../synastry/types";
import { calculateTransitTimeline } from "../transit/timeline";
import { calculateSecondaryProgressions } from "../progressions";
import { calculateSolarReturn, type SolarReturnLocation } from "../solarReturn";
import { monthInTimezone, monthRange, nowLocalDateTime } from "../uiModel";

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const position = (longitude: number) => `${SIGNS[Math.floor(((longitude % 360) + 360) % 360 / 30)]} ${(longitude % 30).toFixed(3)}°`;
const title = (id: string) => id === "ascendant" ? "ASC" : id === "midheaven" ? "MC" : id[0].toUpperCase() + id.slice(1);

function natalDataLines(chart: WesternNatalChart, placeLabel?: string): string[] {
  const birth = chart.normalizedBirth;
  const lines = [`출생 현지시각: ${birth.localDateTime}`, `출생지: ${placeLabel || "좌표 기준"}`, `좌표: ${birth.latitude}, ${birth.longitude}`, `IANA timezone: ${birth.timezone}`, `UTC instant: ${birth.utcInstant}`, "Zodiac / Houses: Tropical / Placidus", "", "### Planets"];
  for (const point of chart.points) lines.push(`- ${title(point.id)}: ${position(point.longitude)} · ${point.house}H${point.retrograde ? " · retrograde" : ""}`);
  lines.push("", "### Angles", `- ASC: ${position(chart.angles.ascendant.longitude)}`, `- MC: ${position(chart.angles.midheaven.longitude)}`, "", "### 12 House Cusps", ...chart.houses.map((h) => `- ${h.number}H: ${position(h.cuspLongitude)}`), "", "### Major Aspects", ...chart.aspects.map((a) => `- ${title(a.point1Id)} ${a.type} ${title(a.point2Id)} · orb ${a.orb.toFixed(3)}° / allowed ${a.allowedOrb.toFixed(3)}° · ${a.applying ? "applying" : "separating"}`));
  return lines;
}

/** 화면에서 "현재 월 흐름"을 따로 선택하지 않았더라도, 복사 버튼을 누르는 지금 이 순간
 * 기준으로 transit을 자동 계산한다(대표 지시) — 기존 transit 엔진(calculateTransitTimeline)을
 * 그대로 재사용하고, 조회 범위는 사람의 시간대 기준 "이번 달"(다른 화면들과 동일한 관례)로
 * 잡되 기준 시각(referenceLocalDateTime)은 실제 지금으로 준다. */
function currentTransitDataLines(chart: WesternNatalChart): string[] {
  const timezone = chart.normalizedBirth.timezone;
  const referenceLocalDateTime = nowLocalDateTime(timezone);
  const range = monthRange(monthInTimezone(timezone));
  const timeline = calculateTransitTimeline(chart, { startLocalDate: range.start, endLocalDate: range.end, timezone, referenceLocalDateTime });
  const lines = [`기준시각: ${timeline.query.referenceUtcInstant} (UTC)`, `조회 범위: ${timeline.query.startLocalDate} ~ ${timeline.query.endLocalDate} (${timezone})`, ""];
  if (timeline.events.length === 0) { lines.push("현재 활성화된 natal↔transit major aspect가 없습니다."); return lines; }
  for (const event of timeline.events) lines.push(`- ${title(event.transitPointId)} transit ${event.type} natal ${title(event.natalTargetId)} · orb ${event.orb.toFixed(3)}° / allowed ${event.allowedOrb.toFixed(3)}° · ${event.applying ? "applying" : "separating"} · window ${event.windowStart} ~ ${event.windowEnd} · exact ${event.exactHits.join(", ") || "없음"}`);
  return lines;
}

/** 이차진행(secondary progression, "하루=1년") — progressions.ts가 기존 astronomy-engine
 * 계산(calculatePlanet)만 재사용해서 만든 원자료를 그대로 나열한다. */
function progressionsDataLines(chart: WesternNatalChart): string[] {
  const progressions = calculateSecondaryProgressions(chart);
  const lines = [`기준일: ${progressions.referenceUtcInstant} (UTC)`, `진행 시각(1일=1년 환산): ${progressions.progressedUtcInstant} (UTC)`, `경과 나이: ${progressions.ageYears.toFixed(2)}세`, "", "### Progressed Planets"];
  for (const point of progressions.points) lines.push(`- ${title(point.id)}: ${position(point.longitude)}${point.retrograde ? " · retrograde" : ""}`);
  lines.push("", "### Progressed → Natal Aspects");
  if (progressions.natalAspects.length === 0) lines.push("해당 없음");
  else for (const aspect of progressions.natalAspects) lines.push(`- progressed ${title(aspect.progressedPointId)} ${aspect.type} natal ${title(aspect.natalPointId)} · orb ${aspect.orb.toFixed(3)}° / allowed ${aspect.allowedOrb.toFixed(3)}°`);
  lines.push("", "### Progressed ↔ Progressed Aspects");
  if (progressions.mutualAspects.length === 0) lines.push("해당 없음");
  else for (const aspect of progressions.mutualAspects) lines.push(`- ${title(aspect.point1Id)} ${aspect.type} ${title(aspect.point2Id)} · orb ${aspect.orb.toFixed(3)}° / allowed ${aspect.allowedOrb.toFixed(3)}°`);
  return lines;
}

/** solar return — solarReturn.ts가 계산한 정확 시각/행성/aspect를 그대로 나열한다. 기준
 * 지역(location)이 없으면 출생지를 대신 쓰지 않고 houses/angles를 아예 비운다(대표 지시). */
function solarReturnDataLines(chart: WesternNatalChart, year: number, location?: SolarReturnLocation): string[] {
  const solarReturn = calculateSolarReturn(chart, year, location);
  const lines = [`대상연도: ${solarReturn.year}`, `정확시각: ${solarReturn.exactUtcInstant} (UTC)`, "", "### Planets"];
  for (const point of solarReturn.points) lines.push(`- ${title(point.id)}: ${position(point.longitude)}${point.retrograde ? " · retrograde" : ""}`);
  lines.push("", "### Major Aspects");
  if (solarReturn.aspects.length === 0) lines.push("해당 없음");
  else for (const aspect of solarReturn.aspects) lines.push(`- ${title(aspect.point1Id)} ${aspect.type} ${title(aspect.point2Id)} · orb ${aspect.orb.toFixed(3)}° / allowed ${aspect.allowedOrb.toFixed(3)}°`);
  if (!solarReturn.location || !solarReturn.angles || !solarReturn.houses) {
    lines.push("", "솔라리턴 기준 지역 없음 — houses/angles 미계산");
  } else {
    lines.push("", `기준 지역: ${solarReturn.location.placeLabel || "좌표 기준"} (${solarReturn.location.latitude}, ${solarReturn.location.longitude})`, "", "### Angles", `- ASC: ${position(solarReturn.angles.ascendant)}`, `- MC: ${position(solarReturn.angles.midheaven)}`, "", "### 12 House Cusps", ...solarReturn.houses.map((h) => `- ${h.number}H: ${position(h.cuspLongitude)}`));
  }
  return lines;
}

export function buildWesternCopyPrompt(chart: WesternNatalChart, options?: { placeLabel?: string; omitIntro?: boolean; solarReturnLocation?: SolarReturnLocation }): string {
  const body = [
    "## 1. Natal Chart", ...natalDataLines(chart, options?.placeLabel), "",
    "## 2. Current Transits", ...currentTransitDataLines(chart), "",
    "## 3. Secondary Progressions", ...progressionsDataLines(chart), "",
    "## 4. Solar Return", ...solarReturnDataLines(chart, new Date().getFullYear(), options?.solarReturnLocation),
  ];
  // omitIntro — buildWesternRelationshipCopyPrompt처럼 이 함수를 두 번 이어붙여 쓰는 호출부는
  // 자기 상단에 이미 같은 취지의 안내 문구를 한 번 써두므로, 여기서 또 반복하지 않는다(중복
  // 문구 제거, 구조는 그대로).
  if (options?.omitIntro) return body.join("\n");
  return ["아래는 계산된 서양점성술 원자료입니다. 제공된 구조 밖의 천체·하우스·aspect를 만들지 말고 종합적으로 해석해주세요.", "", "# 서양점성술 계산 원자료", "", ...body].join("\n");
}

function synastryDataLines(report: WesternSynastryReport, labelOf: Record<string, string>) {
  const label = (personId: string) => labelOf[personId] ?? personId;
  return {
    cross: report.evidence.crossAspects.map((e) => `- ${title(e.points[0].pointId)} (${label(e.points[0].personId)}) ${e.type} ${title(e.points[1].pointId)} (${label(e.points[1].personId)}) · orb ${e.orb.toFixed(3)}°`),
    overlays: report.evidence.overlays.map((e) => `- ${title(e.sourcePointId)} (${label(e.sourcePersonId)}) → ${label(e.targetPersonId)} ${e.targetHouse}H`),
    angles: report.evidence.angleAspects.map((e) => `- ${title(e.sourcePointId)} (${label(e.sourcePersonId)}) ${e.type} ${title(e.targetAngleId)} (${label(e.targetPersonId)}) · orb ${e.orb.toFixed(3)}°`),
  };
}

export function buildWesternRelationshipCopyPrompt(report: WesternSynastryReport, subjects?: Record<string, { name: string; placeLabel?: string }>): string {
  const [first, second] = report.subjects;
  const firstLabel = subjects?.[first.personId]?.name ?? "첫 번째 사람";
  const secondLabel = subjects?.[second.personId]?.name ?? "두 번째 사람";
  const synastry = synastryDataLines(report, { [first.personId]: firstLabel, [second.personId]: secondLabel });
  const year = new Date().getFullYear();
  return [
    "아래는 두 사람의 서양점성술 계산 원자료입니다. 제공된 구조 밖의 천체·하우스·aspect를 만들지 말고 관계를 종합적으로 해석해주세요.",
    "",
    "# 두 사람 서양점성술 관계 계산 원자료",
    "",
    `## 1. ${firstLabel} Natal`, ...natalDataLines(first.chart, subjects?.[first.personId]?.placeLabel), "",
    `## 2. ${secondLabel} Natal`, ...natalDataLines(second.chart, subjects?.[second.personId]?.placeLabel), "",
    "## 3. Synastry", ...synastry.cross, "",
    "## 4. House Overlays", ...synastry.overlays, "",
    "## 5. Angle Aspects", ...synastry.angles, "",
    `## 6. ${firstLabel} Current Transits`, ...currentTransitDataLines(first.chart), "",
    `## 7. ${secondLabel} Current Transits`, ...currentTransitDataLines(second.chart), "",
    `## 8. ${firstLabel} Secondary Progressions`, ...progressionsDataLines(first.chart), "",
    `## 9. ${secondLabel} Secondary Progressions`, ...progressionsDataLines(second.chart), "",
    `## 10. ${firstLabel} Solar Return`, ...solarReturnDataLines(first.chart, year), "",
    `## 11. ${secondLabel} Solar Return`, ...solarReturnDataLines(second.chart, year),
  ].join("\n");
}
