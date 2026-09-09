import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAJOR_ASPECTS,
  calculateNatalChart,
  resolveLocalDateTime,
  type WesternNatalChart,
} from "../index";

const PARK_SOYEON_INPUT = {
  localDateTime: "1989-02-16T19:29:00",
  latitude: 37.4563,
  longitude: 126.7052,
  timezone: "Asia/Seoul",
} as const;

const SWISS_LONGITUDES = {
  sun: 327.736377917,
  moon: 100.06751925,
  mercury: 301.432206333,
  venus: 315.914863361,
  mars: 46.207008806,
  jupiter: 57.318303722,
  saturn: 280.642903556,
  uranus: 274.205401694,
  neptune: 281.532483972,
  pluto: 225.189436417,
} as const;

const SWISS_CUSPS = [
  163.949268778, 189.228585139, 218.935202639, 251.861546472,
  285.240905722, 316.322593306, 343.949268778, 9.228585139,
  38.935202639, 71.861546472, 105.240905722, 136.322593306,
] as const;

const SWISS_HOUSES = [6, 10, 5, 5, 9, 9, 4, 4, 4, 3];
const SWISS_ASPECTS = new Map([
  ["sun:jupiter:square", 0.418074], ["moon:saturn:opposition", 0.575384],
  ["moon:uranus:opposition", 5.862118], ["moon:neptune:opposition", 1.464965],
  ["moon:pluto:trine", 5.121917], ["mercury:jupiter:trine", 4.113903],
  ["venus:mars:square", 0.292145], ["venus:pluto:square", 0.725427],
  ["mars:saturn:trine", 5.564105], ["mars:neptune:trine", 4.674525],
  ["mars:pluto:opposition", 1.017572], ["saturn:uranus:conjunction", 6.437502],
  ["saturn:neptune:conjunction", 0.88958], ["saturn:pluto:sextile", 4.546533],
  ["uranus:neptune:conjunction", 7.327082], ["neptune:pluto:sextile", 3.656952],
]);

function expectSuccessfulChart(result: ReturnType<typeof calculateNatalChart>): WesternNatalChart {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected chart calculation to succeed");
  return result.chart;
}

describe("Western natal chart canonical engine", () => {
  it("matches the Park Soyeon Swiss golden fixture", () => {
    const chart = expectSuccessfulChart(calculateNatalChart(PARK_SOYEON_INPUT));

    expect(chart.schemaVersion).toBe("western-natal/v1");
    expect(chart.engine).toEqual({ name: "astronomy-engine", version: "2.1.19" });
    expect(chart.normalizedBirth.utcInstant).toBe("1989-02-16T10:29:00.000Z");
    expect(chart.zodiac).toBe("tropical");
    expect(chart.houseSystem).toBe("placidus");
    expect(chart.points).toHaveLength(10);

    chart.points.forEach((point, index) => {
      expect(point.kind).toBe("planet");
      if (point.kind !== "planet" || point.id.startsWith("aux:")) throw new Error("Expected a major planet");
      expect(Math.abs(point.longitude - SWISS_LONGITUDES[point.id])).toBeLessThanOrEqual(0.02);
      expect(point.house).toBe(SWISS_HOUSES[index]);
      expect(point.retrograde).toBe(point.id === "pluto");
    });
    expect(Math.abs(chart.angles.ascendant.longitude - SWISS_CUSPS[0])).toBeLessThanOrEqual(0.02);
    expect(Math.abs(chart.angles.midheaven.longitude - SWISS_CUSPS[9])).toBeLessThanOrEqual(0.02);
    chart.houses.forEach((house, index) => {
      expect(Math.abs(house.cuspLongitude - SWISS_CUSPS[index])).toBeLessThanOrEqual(0.05);
    });

    expect(chart.aspects).toHaveLength(SWISS_ASPECTS.size);
    for (const aspect of chart.aspects) {
      const key = `${aspect.point1Id}:${aspect.point2Id}:${aspect.type}`;
      expect(SWISS_ASPECTS.has(key), key).toBe(true);
      expect(Math.abs(aspect.orb - SWISS_ASPECTS.get(key)!)).toBeLessThanOrEqual(0.03);
      expect(aspect.allowedOrb).toBe(DEFAULT_MAJOR_ASPECTS[aspect.type].allowedOrb);
    }
    expect(chart.warnings).toEqual([]);
    expect(chart.errors).toEqual([]);
  });

  it("rejects a nonexistent DST wall time", () => {
    const result = calculateNatalChart({
      localDateTime: "2024-03-10T02:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    });
    expect(result).toMatchObject({ ok: false, errors: [{ code: "NONEXISTENT_LOCAL_TIME" }] });
  });

  it("requires an explicit fold for an ambiguous DST wall time", () => {
    const input = {
      localDateTime: "2024-11-03T01:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    } as const;
    expect(calculateNatalChart(input)).toMatchObject({
      ok: false,
      errors: [{ code: "AMBIGUOUS_LOCAL_TIME" }],
    });
    expect(resolveLocalDateTime({ ...input, dstFold: "earlier" }).utcInstant).toBe("2024-11-03T05:30:00.000Z");
    expect(resolveLocalDateTime({ ...input, dstFold: "later" }).utcInstant).toBe("2024-11-03T06:30:00.000Z");
  });

  it("honors historical IANA offsets and date boundaries", () => {
    expect(resolveLocalDateTime({
      localDateTime: "1945-08-15T12:00:00",
      latitude: 37.5665,
      longitude: 126.978,
      timezone: "Asia/Seoul",
    }).utcInstant).toBe("1945-08-15T03:00:00.000Z");

    expect(resolveLocalDateTime({
      localDateTime: "2000-01-01T00:15:00",
      latitude: 21.3069,
      longitude: -157.8583,
      timezone: "Pacific/Honolulu",
    }).utcInstant).toBe("2000-01-01T10:15:00.000Z");
  });

  it("uses inclusive aspect boundaries", () => {
    expect(DEFAULT_MAJOR_ASPECTS.square.matches(10, 107)).toEqual({ orb: 7 });
    expect(DEFAULT_MAJOR_ASPECTS.square.matches(10, 107.000001)).toBeNull();
  });

  it("returns structured errors for missing location context", () => {
    expect(calculateNatalChart({
      localDateTime: "1989-02-16T19:29:00",
      latitude: Number.NaN,
      longitude: Number.NaN,
      timezone: "",
    })).toMatchObject({ ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT" }] });
  });
});
