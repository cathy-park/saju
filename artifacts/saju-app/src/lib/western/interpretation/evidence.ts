import type { PlanetId, WesternAspect, WesternNatalChart, WesternPoint } from "../types.js";
import { signRuleAt } from "./rules/signRules.js";
import { orbBand } from "./rules/aspectRules.js";
import { PLANET_LABEL, type WesternEvidenceItem } from "./types.js";

export function placementEvidence(point: WesternPoint): WesternEvidenceItem {
  const sign = signRuleAt(point.longitude);
  return { id: `placement:${point.id}`, kind: "placement", label: `${PLANET_LABEL[point.id as PlanetId] ?? point.id} ${sign.name} ${point.house}H`, sourcePointIds: [point.id] };
}

export function ascendantEvidence(chart: WesternNatalChart): WesternEvidenceItem {
  const sign = signRuleAt(chart.angles.ascendant.longitude);
  return { id: "angle:ascendant", kind: "angle", label: `ASC ${sign.name}`, sourcePointIds: [] };
}

export function aspectEvidence(aspect: WesternAspect): WesternEvidenceItem {
  const first = PLANET_LABEL[aspect.point1Id as PlanetId] ?? aspect.point1Id;
  const second = PLANET_LABEL[aspect.point2Id as PlanetId] ?? aspect.point2Id;
  return { id: `aspect:${aspect.point1Id}:${aspect.point2Id}:${aspect.type}`, kind: "aspect", label: `${first} ${aspect.type} ${second} orb ${aspect.orb.toFixed(3)}°`, sourcePointIds: [aspect.point1Id, aspect.point2Id], orbBand: orbBand(aspect.orb) };
}

export function pointById(chart: WesternNatalChart, id: PlanetId): WesternPoint {
  const point = chart.points.find((candidate) => candidate.id === id);
  if (!point) throw new Error(`Missing required point: ${id}`);
  return point;
}
