import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../natalChart";
import { calculateSolarReturn } from "../solarReturn";
import { norm360 } from "../astronomy";

const PARK_SOYEON_INPUT = { localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" } as const;

function chart() {
  const result = calculateNatalChart(PARK_SOYEON_INPUT);
  if (!result.ok) throw new Error("fixture failed");
  return result.chart;
}

const angularDiff = (a: number, b: number) => { const d = norm360(a - b); return Math.min(d, 360 - d); };

describe("calculateSolarReturn — 정확한 solar return 시각 탐색", () => {
  it.each([1990, 2000, 2026, 2050])("%i년: 그 순간의 태양 황경이 natal 태양 황경과 일치한다(오차 <0.0001°)", (year) => {
    const natalChart = chart();
    const natalSun = natalChart.points.find((point) => point.id === "sun")!.longitude;
    const solarReturn = calculateSolarReturn(natalChart, year);
    const returnSun = solarReturn.points.find((point) => point.id === "sun")!.longitude;
    expect(angularDiff(returnSun, natalSun)).toBeLessThan(0.0001);
    expect(new Date(solarReturn.exactUtcInstant).getUTCFullYear()).toBeGreaterThanOrEqual(year - 1);
    expect(new Date(solarReturn.exactUtcInstant).getUTCFullYear()).toBeLessThanOrEqual(year + 1);
  });

  it("기준 지역을 주지 않으면 location/angles/houses가 전부 null이다(출생지를 몰래 쓰지 않음)", () => {
    const solarReturn = calculateSolarReturn(chart(), 2026);
    expect(solarReturn.location).toBeNull();
    expect(solarReturn.angles).toBeNull();
    expect(solarReturn.houses).toBeNull();
    expect(solarReturn.points).toHaveLength(10);
    expect(solarReturn.aspects.length).toBeGreaterThanOrEqual(0);
  });

  it("기준 지역을 명시하면 그 지역 기준으로 ASC/MC/12하우스를 계산한다", () => {
    const solarReturn = calculateSolarReturn(chart(), 2026, { latitude: 37.5665, longitude: 126.9780, timezone: "Asia/Seoul", placeLabel: "서울" });
    expect(solarReturn.location).toEqual({ latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul", placeLabel: "서울" });
    expect(solarReturn.angles).not.toBeNull();
    expect(solarReturn.houses).not.toBeNull();
    expect(solarReturn.houses).toHaveLength(12);
    expect(solarReturn.houses![0].cuspLongitude).toBeCloseTo(solarReturn.angles!.ascendant, 6);
  });

  it("연도가 다르면 서로 다른 실제 시각을 반환한다(특정 연도 하드코딩 아님)", () => {
    const natalChart = chart();
    const a = calculateSolarReturn(natalChart, 2025);
    const b = calculateSolarReturn(natalChart, 2026);
    expect(a.exactUtcInstant).not.toBe(b.exactUtcInstant);
    expect(new Date(b.exactUtcInstant).getTime() - new Date(a.exactUtcInstant).getTime()).toBeGreaterThan(360 * 86_400_000);
  });
});
