export const WESTERN_SCHEMA_VERSION = "western-natal/v1" as const;
export const WESTERN_ENGINE = { name: "astronomy-engine", version: "2.1.19" } as const;

export type DstFold = "earlier" | "later";
export type PlanetId = "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto";
export type AuxiliaryPointId = `aux:${string}`;
export type WesternPointId = PlanetId | AuxiliaryPointId;
export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export interface WesternNatalInput {
  /** ISO local wall time without an offset, e.g. 1989-02-16T19:29:00. */
  localDateTime: string;
  latitude: number;
  longitude: number;
  /** IANA zone. Coordinates are never used to infer it. */
  timezone: string;
  /** Required only when the local wall time occurs twice. */
  dstFold?: DstFold;
}

export type WesternErrorCode =
  | "MISSING_LOCATION_CONTEXT" | "INVALID_LOCATION" | "INVALID_LOCAL_DATE_TIME"
  | "INVALID_TIMEZONE" | "NONEXISTENT_LOCAL_TIME" | "AMBIGUOUS_LOCAL_TIME"
  | "MISSING_BIRTH_TIME" | "UNSUPPORTED_CALENDAR" | "CALCULATION_FAILED";

export interface WesternIssue { code: WesternErrorCode; message: string; field?: string; details?: Record<string, unknown>; }
export interface WesternWarning { code: string; message: string; details?: Record<string, unknown>; }

export interface WesternPoint {
  id: WesternPointId;
  /** Allows lunar nodes and other deterministic auxiliary points without a schema change. */
  kind: "planet" | "lunar-node" | "auxiliary";
  longitude: number;
  latitude: number;
  speedLongitude: number;
  retrograde: boolean;
  house: number;
}

export interface WesternAngle { id: "ascendant" | "midheaven"; longitude: number; }
export interface WesternHouse { number: number; cuspLongitude: number; }
export interface WesternAspect {
  point1Id: WesternPointId;
  point2Id: WesternPointId;
  type: AspectType;
  exactAngle: number;
  separation: number;
  orb: number;
  allowedOrb: number;
  applying: boolean;
}

export interface WesternNatalChart {
  schemaVersion: typeof WESTERN_SCHEMA_VERSION;
  engine: typeof WESTERN_ENGINE;
  originalBirth: WesternNatalInput;
  normalizedBirth: {
    localDateTime: string;
    utcInstant: string;
    latitude: number;
    longitude: number;
    timezone: string;
    utcOffsetMinutes: number;
    dstFold?: DstFold;
  };
  zodiac: "tropical";
  houseSystem: "placidus";
  points: WesternPoint[];
  angles: { ascendant: WesternAngle; midheaven: WesternAngle };
  houses: WesternHouse[];
  aspects: WesternAspect[];
  warnings: WesternWarning[];
  errors: WesternIssue[];
}

export type WesternCalculationResult =
  | { ok: true; chart: WesternNatalChart }
  | { ok: false; errors: WesternIssue[]; warnings: WesternWarning[] };

export type WesternAdapterResult = { ok: true; input: WesternNatalInput } | { ok: false; errors: WesternIssue[] };
