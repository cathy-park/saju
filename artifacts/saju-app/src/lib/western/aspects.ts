import { norm360 } from "./astronomy";
import type { AspectType, PlanetId, WesternAspect } from "./types";

function separation(a: number, b: number): number { const delta = norm360(b - a); return delta > 180 ? 360 - delta : delta; }
function match(exactAngle: number, allowedOrb: number, a: number, b: number) {
  const orb = Math.abs(separation(a, b) - exactAngle);
  return orb <= allowedOrb ? { orb } : null;
}
export const DEFAULT_MAJOR_ASPECTS: Record<AspectType, { exactAngle: number; allowedOrb: number; matches: (a: number, b: number) => { orb: number } | null }> = {
  conjunction: { exactAngle: 0, allowedOrb: 8, matches: (a, b) => match(0, 8, a, b) },
  sextile: { exactAngle: 60, allowedOrb: 6, matches: (a, b) => match(60, 6, a, b) },
  square: { exactAngle: 90, allowedOrb: 7, matches: (a, b) => match(90, 7, a, b) },
  trine: { exactAngle: 120, allowedOrb: 7, matches: (a, b) => match(120, 7, a, b) },
  opposition: { exactAngle: 180, allowedOrb: 8, matches: (a, b) => match(180, 8, a, b) },
};

interface AspectPoint { id: PlanetId; longitude: number; speedLongitude: number; }
export function calculateMajorAspects(points: AspectPoint[]): WesternAspect[] {
  const result: WesternAspect[] = [];
  for (let first = 0; first < points.length; first++) for (let second = first + 1; second < points.length; second++) {
    const a = points[first], b = points[second];
    for (const [type, definition] of Object.entries(DEFAULT_MAJOR_ASPECTS) as [AspectType, typeof DEFAULT_MAJOR_ASPECTS[AspectType]][]) {
      const found = definition.matches(a.longitude, b.longitude);
      if (!found) continue;
      const currentSeparation = separation(a.longitude, b.longitude);
      const futureSeparation = separation(a.longitude + a.speedLongitude * 0.001, b.longitude + b.speedLongitude * 0.001);
      result.push({ point1Id: a.id, point2Id: b.id, type, exactAngle: definition.exactAngle, separation: currentSeparation, orb: found.orb, allowedOrb: definition.allowedOrb, applying: Math.abs(futureSeparation - definition.exactAngle) < found.orb });
      break;
    }
  }
  return result;
}
