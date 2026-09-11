import { calculateAngles, calculatePlanet } from "./astronomy.js";
import { calculateMajorAspects } from "./aspects.js";
import { calculatePlacidusCusps, houseForLongitude } from "./houses.js";
import { resolveLocalDateTime, WesternInputError } from "./time.js";
import { WESTERN_ENGINE, WESTERN_SCHEMA_VERSION, type PlanetId, type WesternCalculationResult, type WesternIssue, type WesternNatalInput } from "./types.js";

const PLANETS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

function inputError(input: Partial<WesternNatalInput>): WesternIssue | null {
  if (!input.timezone || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return { code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit latitude, longitude, and IANA timezone are required" };
  if (input.latitude! < -90 || input.latitude! > 90 || input.longitude! < -180 || input.longitude! > 180) return { code: "INVALID_LOCATION", field: "location", message: "Latitude must be within ±90 and longitude within ±180" };
  if (!input.localDateTime) return { code: "INVALID_LOCAL_DATE_TIME", field: "localDateTime", message: "localDateTime is required" };
  return null;
}
export function calculateNatalChart(input: Partial<WesternNatalInput>): WesternCalculationResult {
  const validationError = inputError(input);
  if (validationError) return { ok: false, errors: [validationError], warnings: [] };
  const complete = input as WesternNatalInput;
  try {
    const resolved = resolveLocalDateTime(complete);
    const date = new Date(resolved.utcInstant);
    const angles = calculateAngles(date, complete.latitude, complete.longitude);
    const cusps = calculatePlacidusCusps(angles.ascendant, angles.midheaven, complete.latitude, angles.obliquity);
    if (!cusps) return { ok: false, errors: [{ code: "CALCULATION_FAILED", message: "Placidus houses are undefined at this latitude for this instant" }], warnings: [] };
    const points = PLANETS.map((id) => ({ id, kind: "planet" as const, ...calculatePlanet(id, date) }))
      .map((point) => ({ ...point, retrograde: point.speedLongitude < 0, house: houseForLongitude(point.longitude, cusps) }));
    return { ok: true, chart: {
      schemaVersion: WESTERN_SCHEMA_VERSION, engine: WESTERN_ENGINE, originalBirth: { ...complete },
      normalizedBirth: { localDateTime: resolved.localDateTime, utcInstant: resolved.utcInstant, latitude: complete.latitude, longitude: complete.longitude, timezone: complete.timezone, utcOffsetMinutes: resolved.utcOffsetMinutes, ...(resolved.dstFold ? { dstFold: resolved.dstFold } : {}) },
      zodiac: "tropical", houseSystem: "placidus", points,
      angles: { ascendant: { id: "ascendant", longitude: angles.ascendant }, midheaven: { id: "midheaven", longitude: angles.midheaven } },
      houses: cusps.map((cuspLongitude, index) => ({ number: index + 1, cuspLongitude })),
      aspects: calculateMajorAspects(points), warnings: [], errors: [],
    } };
  } catch (error) {
    if (error instanceof WesternInputError) return { ok: false, errors: [{ code: error.code, message: error.message }], warnings: [] };
    return { ok: false, errors: [{ code: "CALCULATION_FAILED", message: error instanceof Error ? error.message : "Unknown calculation failure" }], warnings: [] };
  }
}
