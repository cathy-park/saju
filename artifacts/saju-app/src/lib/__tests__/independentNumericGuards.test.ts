import { describe, it, expect } from "vitest";
import { lunarToSolarChecked } from "../calendarConversion";
import { calculateProfileFromBirth, equationOfTimeMins } from "../sajuEngine";
import { buildZiweiChart } from "../ziwei/buildZiweiChart";
import { zhongzhouV1 } from "../ziwei/ruleSets/zhongzhouV1";
import { calculateNatalChart } from "../western/natalChart";

describe("independent calendar reference cases (synthetic)", () => {
  it.each([
    [[1998, 11, 15], { year: 1999, month: 1, day: 2 }],
    [[2000, 12, 15], { year: 2001, month: 1, day: 9 }],
    [[2019, 12, 30], { year: 2020, month: 1, day: 24 }],
  ] as const)(
    "looks for late lunar months in the following solar year: %j",
    (input, expected) => {
      expect(lunarToSolarChecked(...input, false).solar).toEqual(expected);
      const birth = {
        name: "synthetic",
        gender: "여" as const,
        calendarType: "lunar" as const,
        year: input[0],
        month: input[1],
        day: input[2],
        hour: 12,
        minute: 0,
        timeUnknown: false,
      };
      expect(calculateProfileFromBirth(birth).solarDate).toEqual(expected);
      expect(buildZiweiChart(birth, zhongzhouV1).lunarBirth.day).toBe(input[2]);
    },
  );
  it("does not fabricate a missing row or extend the supported solar range", () => {
    expect(() => lunarToSolarChecked(2000, 13, 1)).toThrow();
    expect(() => lunarToSolarChecked(2050, 12, 30)).toThrow();
  });
});

describe("independent astronomical reference guards", () => {
  it("uses apparent-minus-mean EOT and stays within 0.05 minute of the independent date-noon fixture", () => {
    expect(Math.abs(equationOfTimeMins(2000, 12, 6) - 8.972096)).toBeLessThan(
      0.05,
    );
    expect(equationOfTimeMins(2000, 2, 16)).toBeLessThan(0);
    expect(equationOfTimeMins(2000, 11, 3)).toBeGreaterThan(0);
  });
  it("rejects all polar-circle Placidus cases, including a previously partially converged case", () => {
    const chart = calculateNatalChart({
      localDateTime: "1900-04-15T12:34:00",
      timezone: "UTC",
      latitude: 67,
      longitude: -74,
    });
    expect(chart.ok).toBe(false);
    if (!chart.ok) expect(chart.errors[0].message).toMatch(/Placidus/);
    expect(
      calculateNatalChart({
        localDateTime: "2000-06-15T12:00:00",
        timezone: "UTC",
        latitude: 37.5,
        longitude: 127,
      }).ok,
    ).toBe(true);
  });
});
