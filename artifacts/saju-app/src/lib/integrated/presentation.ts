import { areasForScope, type IntegratedArea } from "./areas";
import type { IntegratedReport, IntegratedSystem, IntegratedTheme } from "./types";

const META_PATTERNS = [
  /연간 배경과 월간 활성/, /같은 사건을 뜻하지/, /timing activation/i,
  /지금까지 살펴본 .*근거/, /서로 다른 관점에서 같은 방향/, /정확도나 확률의 상승/,
];

export const isUserFacingInterpretation = (text: string): boolean =>
  !!text.trim() && !META_PATTERNS.some((pattern) => pattern.test(text));

function areaSources(report: IntegratedReport, area: IntegratedArea) {
  const themes = new Set(area.themes as IntegratedTheme[]);
  const sources = [
    ...report.sections.flatMap((section) => section.facts.flatMap((fact) => themes.has(fact.theme) ? fact.sources : [])),
    ...report.standaloneFacts.filter((fact) => themes.has(fact.mapping.theme)),
  ];
  const temporalOnly = area.key === "currentFlow" || area.key === "currentRelationshipFlow";
  return Array.from(new Map(sources
    .filter((source) => temporalOnly ? !!source.temporalScope : !source.temporalScope)
    .map((source) => [`${source.system}:${source.module}:${source.factId}`, source])).values());
}

export interface PresentedArea { key: string; title: string; text: string; systems: IntegratedSystem[] }

/** AI 실패 때도 pipeline 설명 대신 실제 source fact의 사용자 문장만 보여준다. */
export function buildDeterministicPresentedAreas(report: IntegratedReport): PresentedArea[] {
  const details = areasForScope(report.scope).filter((area) => area.key !== "overview" && area.key !== "relationshipCoreStructure").flatMap((area) => {
    const sources = areaSources(report, area);
    const meanings = [...new Set(sources.map((source) => source.meaning).filter(isUserFacingInterpretation))].slice(0, 3);
    if (!meanings.length) return [];
    return [{ key: area.key, title: area.title, text: meanings.join(" "), systems: [...new Set(sources.map((source) => source.system))] }];
  });
  const overviewDef = areasForScope(report.scope)[0];
  const overviewText = details.slice(0, 3).map((area) => area.text).join(" ");
  return overviewText
    ? [{ key: overviewDef.key, title: overviewDef.title, text: overviewText, systems: [...new Set(details.flatMap((area) => area.systems))] }, ...details]
    : details;
}

export function systemsForArea(report: IntegratedReport, key: string): IntegratedSystem[] {
  const area = areasForScope(report.scope).find((item) => item.key === key);
  return area ? [...new Set(areaSources(report, area).map((source) => source.system))] : [];
}

export function evidenceForArea(report: IntegratedReport, key: string): { system: IntegratedSystem; text: string }[] {
  const area = areasForScope(report.scope).find((item) => item.key === key);
  if (!area) return [];
  return Array.from(new Map(areaSources(report, area)
    .filter((source) => isUserFacingInterpretation(source.meaning))
    .map((source) => [`${source.system}:${source.meaning}`, { system: source.system, text: source.meaning }])).values());
}
