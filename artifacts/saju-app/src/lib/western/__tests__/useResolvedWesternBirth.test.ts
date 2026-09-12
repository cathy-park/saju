import { describe, expect, it } from "vitest";
import { selectUnambiguousCandidate } from "../useResolvedWesternBirth";
import type { GeocodeCandidate } from "../geocode";

function candidate(overrides: Partial<GeocodeCandidate> = {}): GeocodeCandidate {
  return {
    label: "전주, 대한민국",
    latitude: 35.8242,
    longitude: 127.148,
    countryCode: "KR",
    timezones: [{ value: "Asia/Seoul", label: "Asia/Seoul (UTC+09:00)" }],
    ...overrides,
  };
}

describe("selectUnambiguousCandidate", () => {
  it("returns null for no candidates", () => {
    expect(selectUnambiguousCandidate([])).toBeNull();
  });

  it("auto-selects the single candidate (existing behavior)", () => {
    const only = candidate();
    expect(selectUnambiguousCandidate([only])).toBe(only);
  });

  it("auto-selects the first candidate when multiple candidates share the same country and timezone", () => {
    const first = candidate({ label: "전주, 동부대로" });
    const second = candidate({ label: "전주, 호남고속도로", latitude: 35.883, longitude: 127.057 });
    expect(selectUnambiguousCandidate([first, second])).toBe(first);
  });

  it("returns null when candidates span different timezones", () => {
    const seoul = candidate();
    const other = candidate({ timezones: [{ value: "America/New_York", label: "America/New_York (UTC-05:00)" }] });
    expect(selectUnambiguousCandidate([seoul, other])).toBeNull();
  });

  it("returns null when candidates span different countries", () => {
    const kr = candidate();
    const us = candidate({ countryCode: "US" });
    expect(selectUnambiguousCandidate([kr, us])).toBeNull();
  });

  it("returns null when any single candidate itself has multiple timezone options", () => {
    const ambiguous = candidate({
      timezones: [
        { value: "Asia/Seoul", label: "Asia/Seoul (UTC+09:00)" },
        { value: "Asia/Pyongyang", label: "Asia/Pyongyang (UTC+09:00)" },
      ],
    });
    expect(selectUnambiguousCandidate([ambiguous])).toBeNull();
  });
});
