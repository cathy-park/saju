import type { WesternNatalChart } from "../types.js";
import { HOUSE_RULES, HOUSE_THEME_EMPHASIS } from "./rules/houseRules.js";
import { ELEMENT_EMPHASIS, MODALITY_EMPHASIS, signRuleAt } from "./rules/signRules.js";
import type { WesternChartEmphasis } from "./types.js";

/** Selects repeated independent placements categorically; no numeric personality score is produced. */
export function detectChartEmphasis(chart: WesternNatalChart): WesternChartEmphasis[] {
  const used = new Set<string>();
  const dimensions = [
    { prefix: "element", value: (id: number) => signRuleAt(chart.points[id].longitude).element, text: ELEMENT_EMPHASIS },
    { prefix: "modality", value: (id: number) => signRuleAt(chart.points[id].longitude).modality, text: MODALITY_EMPHASIS },
    { prefix: "house", value: (id: number) => HOUSE_RULES[chart.points[id].house].theme, text: HOUSE_THEME_EMPHASIS },
  ] as const;
  const result: WesternChartEmphasis[] = [];
  for (const dimension of dimensions) {
    const groups = new Map<string, string[]>();
    chart.points.forEach((point, index) => {
      if (used.has(point.id)) return;
      const key = dimension.value(index);
      groups.set(key, [...(groups.get(key) ?? []), `placement:${point.id}`]);
    });
    const selected = [...groups.entries()].filter(([, ids]) => ids.length >= 3)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    if (!selected) continue;
    const [key, sourceEvidenceIds] = selected;
    const meaning = (dimension.text as Record<string, string>)[key];
    if (!meaning) continue;
    sourceEvidenceIds.forEach((id) => used.add(id.replace("placement:", "")));
    result.push({ id: `${dimension.prefix}:${key}`, meaning, sourceEvidenceIds });
  }
  return result;
}
