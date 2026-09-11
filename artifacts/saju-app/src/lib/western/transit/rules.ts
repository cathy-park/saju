import type { AspectType, PlanetId } from "../types.js";
import type { TransitRole } from "./types.js";

export const TRANSIT_PLANETS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
export const TRANSIT_ASPECTS: Record<AspectType, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
export const TRANSIT_ORBS: Record<PlanetId, number> = {
  sun: 1, moon: 1, mercury: 1, venus: 1, mars: 1.5,
  jupiter: 2, saturn: 2, uranus: 1.5, neptune: 1.5, pluto: 1.5,
};
export const TRANSIT_ROLE: Record<PlanetId, TransitRole> = {
  sun: "trigger", moon: "trigger", mercury: "trigger", venus: "trigger", mars: "trigger",
  jupiter: "background", saturn: "background", uranus: "background", neptune: "background", pluto: "background",
};
/** Small enough that even a one-degree Moon window contains many samples. */
export const STEP_MINUTES: Record<PlanetId, number> = {
  moon: 15, mercury: 30, venus: 45, sun: 60, mars: 60,
  jupiter: 360, saturn: 720, uranus: 720, neptune: 720, pluto: 720,
};

export const PLANET_LABEL: Record<PlanetId, string> = {
  sun: "태양", moon: "달", mercury: "수성", venus: "금성", mars: "화성",
  jupiter: "목성", saturn: "토성", uranus: "천왕성", neptune: "해왕성", pluto: "명왕성",
};
