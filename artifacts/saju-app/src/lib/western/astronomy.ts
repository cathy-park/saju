/** Angle/frame calculations adapted from astro-mcp v0.3.1, commit 76039f3 (MIT). */
import * as AstronomyImport from "astronomy-engine";
import type { PlanetId } from "./types";

const A = ((AstronomyImport as unknown as { default?: typeof AstronomyImport }).default ?? AstronomyImport) as typeof AstronomyImport;
A.SetDeltaTFunction(A.DeltaT_JplHorizons);
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const norm360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

const BODY: Record<PlanetId, AstronomyImport.Body> = {
  sun: A.Body.Sun, moon: A.Body.Moon, mercury: A.Body.Mercury, venus: A.Body.Venus,
  mars: A.Body.Mars, jupiter: A.Body.Jupiter, saturn: A.Body.Saturn,
  uranus: A.Body.Uranus, neptune: A.Body.Neptune, pluto: A.Body.Pluto,
};

function eclipticPosition(id: PlanetId, date: Date): { longitude: number; latitude: number } {
  const time = A.MakeTime(date);
  const vector = A.RotateVector(A.Rotation_EQJ_ECT(time), A.GeoVector(BODY[id], time, true));
  return {
    longitude: norm360(Math.atan2(vector.y, vector.x) * R2D),
    latitude: Math.atan2(vector.z, Math.hypot(vector.x, vector.y)) * R2D,
  };
}
export function calculatePlanet(id: PlanetId, date: Date) {
  const position = eclipticPosition(id, date);
  const halfDay = 12 * 60 * 60 * 1000;
  const before = eclipticPosition(id, new Date(date.getTime() - halfDay)).longitude;
  const after = eclipticPosition(id, new Date(date.getTime() + halfDay)).longitude;
  let speedLongitude = after - before;
  if (speedLongitude > 180) speedLongitude -= 360;
  if (speedLongitude < -180) speedLongitude += 360;
  return { ...position, speedLongitude };
}

export function calculateAngles(date: Date, latitude: number, longitude: number) {
  const time = A.MakeTime(date);
  const obliquity = A.e_tilt(time).tobl;
  const epsilon = obliquity * D2R;
  const ramc = norm360(A.SiderealTime(time) * 15 + longitude);
  const phi = latitude * D2R;
  const midheaven = norm360(Math.atan2(Math.tan(ramc * D2R), Math.cos(epsilon)) * R2D + (Math.cos(ramc * D2R) < 0 ? 180 : 0));
  const denominator = Math.sin(ramc * D2R) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon);
  let ascendant = norm360(Math.atan2(Math.cos(ramc * D2R), -denominator) * R2D);
  if (norm360(ascendant - midheaven) > 180) ascendant = norm360(ascendant + 180);
  return { ascendant, midheaven, obliquity };
}
