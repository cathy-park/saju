// 서양점성술 "AI 해석 프롬프트 복사" — 해석 fact가 아니라 canonical 계산 구조를
// 사람이 읽을 수 있는 Markdown으로 내보낸다.
import type { WesternNatalChart } from "../types";
import type { WesternTransitReport } from "../transit/types";
import type { WesternSynastryReport } from "../synastry/types";

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const position = (longitude: number) => `${SIGNS[Math.floor(((longitude % 360) + 360) % 360 / 30)]} ${(longitude % 30).toFixed(3)}°`;
const title = (id: string) => id === "ascendant" ? "ASC" : id === "midheaven" ? "MC" : id[0].toUpperCase() + id.slice(1);

export function buildWesternCopyPrompt(chart: WesternNatalChart, options?: { transit?: WesternTransitReport; synastry?: WesternSynastryReport; placeLabel?: string }): string {
  const birth = chart.normalizedBirth;
  const lines = ["아래는 계산된 서양점성술 원자료입니다. 제공된 구조 밖의 천체·하우스·aspect를 만들지 말고 종합적으로 해석해주세요.", "", "# 서양점성술 계산 구조", `출생 현지시각: ${birth.localDateTime}`, `출생지: ${options?.placeLabel || "좌표 기준"}`, `좌표: ${birth.latitude}, ${birth.longitude}`, `IANA timezone: ${birth.timezone}`, `UTC instant: ${birth.utcInstant}`, "Zodiac / Houses: Tropical / Placidus", "", "## Planets"];
  for (const point of chart.points) lines.push(`- ${title(point.id)}: ${position(point.longitude)} · ${point.house}H${point.retrograde ? " · retrograde" : ""}`);
  lines.push("", "## Angles", `- ASC: ${position(chart.angles.ascendant.longitude)}`, `- MC: ${position(chart.angles.midheaven.longitude)}`, "", "## 12 House Cusps", ...chart.houses.map((h) => `- ${h.number}H: ${position(h.cuspLongitude)}`), "", "## Major Aspects", ...chart.aspects.map((a) => `- ${title(a.point1Id)} ${a.type} ${title(a.point2Id)} · orb ${a.orb.toFixed(3)}° / allowed ${a.allowedOrb.toFixed(3)}° · ${a.applying ? "applying" : "separating"}`));
  if (options?.transit) lines.push("", "## Transit", `조회 기간: ${options.transit.timeline.query.startLocalDate} ~ ${options.transit.timeline.query.endLocalDate} (${options.transit.timeline.query.timezone})`, ...options.transit.timeline.events.map((e) => `- ${title(e.transitPointId)} ${e.type} natal ${title(e.natalTargetId)} · orb ${e.orb.toFixed(3)}° · ${e.applying ? "applying" : "separating"} · window ${e.windowStart} ~ ${e.windowEnd} · exact ${e.exactHits.join(", ") || "없음"}`));
  if (options?.synastry) lines.push("", "## Synastry Cross-Aspects", ...options.synastry.evidence.crossAspects.map((e) => `- ${title(e.points[0].pointId)} (${e.points[0].personId}) ${e.type} ${title(e.points[1].pointId)} (${e.points[1].personId}) · orb ${e.orb.toFixed(3)}°`), "", "## House Overlays", ...options.synastry.evidence.overlays.map((e) => `- ${title(e.sourcePointId)} (${e.sourcePersonId}) → ${e.targetPersonId} ${e.targetHouse}H`), "", "## Angle Aspects", ...options.synastry.evidence.angleAspects.map((e) => `- ${title(e.sourcePointId)} (${e.sourcePersonId}) ${e.type} ${title(e.targetAngleId)} (${e.targetPersonId}) · orb ${e.orb.toFixed(3)}°`));
  return lines.join("\n");
}

export function buildWesternRelationshipCopyPrompt(report: WesternSynastryReport, subjects?: Record<string, { name: string; placeLabel?: string }>): string {
  const [first, second] = report.subjects;
  const firstLabel = subjects?.[first.personId]?.name ?? "첫 번째 사람";
  const secondLabel = subjects?.[second.personId]?.name ?? "두 번째 사람";
  const relationshipStructure = buildWesternCopyPrompt(second.chart, { placeLabel: subjects?.[second.personId]?.placeLabel, synastry: report })
    .replaceAll(first.personId, firstLabel).replaceAll(second.personId, secondLabel);
  return [
    "아래는 두 사람의 서양점성술 계산 원자료입니다. 제공된 구조 밖의 천체·하우스·aspect를 만들지 말고 관계를 종합적으로 해석해주세요.",
    "",
    `# ${firstLabel} natal chart`,
    buildWesternCopyPrompt(first.chart, { placeLabel: subjects?.[first.personId]?.placeLabel }),
    "",
    `# ${secondLabel} natal chart 및 관계 구조`,
    relationshipStructure,
  ].join("\n");
}
