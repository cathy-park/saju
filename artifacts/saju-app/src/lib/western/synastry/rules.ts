import type { AspectType, PlanetId } from "../types.js";
import type { SynastryOrbBand } from "./types.js";

export const SYNASTRY_ASPECTS: Record<AspectType, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
export const SYNASTRY_CORE_PLANETS: readonly PlanetId[] = ["sun", "moon", "mercury", "venus", "mars"];
const OUTER = new Set<PlanetId>(["uranus", "neptune", "pluto"]);
const SOCIAL = new Set<PlanetId>(["jupiter", "saturn"]);

/** Single precedence path: outer > social > personal-aspect rule. */
export function resolveSynastryOrb(a: PlanetId, b: PlanetId, aspect: AspectType): number {
  if (OUTER.has(a) || OUTER.has(b)) return 3;
  if (SOCIAL.has(a) || SOCIAL.has(b)) return 4;
  return aspect === "sextile" ? 4 : 6;
}
export function synastryOrbBand(orb: number, allowedOrb: number): SynastryOrbBand {
  if (orb <= 1) return "exact";
  if (orb <= allowedOrb * 0.6) return "close";
  return "supporting";
}
export const RELEVANT_OVERLAY_HOUSES = new Set([1, 4, 5, 7, 8, 10]);
