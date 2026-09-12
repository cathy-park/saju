import { describe, expect, it } from "vitest";
import { calculateNatalChart } from "../natalChart";
import { calculateSecondaryProgressions } from "../progressions";

const PARK_SOYEON_INPUT = { localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" } as const;

function chart() {
  const result = calculateNatalChart(PARK_SOYEON_INPUT);
  if (!result.ok) throw new Error("fixture failed");
  return result.chart;
}

describe("calculateSecondaryProgressions — 1일=1년 이차진행", () => {
  it("진행 시각은 출생 시각 + (회귀년 기준 경과연수)일이다", () => {
    const natalChart = chart();
    const reference = new Date("2026-09-13T00:00:00Z");
    const progressions = calculateSecondaryProgressions(natalChart, reference);
    const birthMs = Date.parse(natalChart.normalizedBirth.utcInstant);
    const expectedAgeYears = (reference.getTime() - birthMs) / (365.2422 * 86_400_000);
    expect(progressions.ageYears).toBeCloseTo(expectedAgeYears, 4);
    const expectedProgressedMs = birthMs + expectedAgeYears * 86_400_000;
    expect(Date.parse(progressions.progressedUtcInstant)).toBeCloseTo(expectedProgressedMs, -2);
    // 37~38세 구간이므로 진행 시각은 출생일로부터 약 37~38일 뒤여야 한다(1일=1년).
    const daysAfterBirth = (Date.parse(progressions.progressedUtcInstant) - birthMs) / 86_400_000;
    expect(daysAfterBirth).toBeGreaterThan(37);
    expect(daysAfterBirth).toBeLessThan(38);
  });

  it("10개 행성 전부 계산하고, natal/mutual aspect는 orb 허용치 안에서만 나온다", () => {
    const progressions = calculateSecondaryProgressions(chart(), new Date("2026-09-13T00:00:00Z"));
    expect(progressions.points).toHaveLength(10);
    expect(new Set(progressions.points.map((p) => p.id)).size).toBe(10);
    for (const aspect of progressions.natalAspects) expect(aspect.orb).toBeLessThanOrEqual(aspect.allowedOrb);
    for (const aspect of progressions.mutualAspects) expect(aspect.orb).toBeLessThanOrEqual(aspect.allowedOrb);
  });

  it("입력 natal chart의 points를 재계산하지 않는다(진행만 새로 계산)", () => {
    const natalChart = chart();
    const before = JSON.stringify(natalChart.points);
    calculateSecondaryProgressions(natalChart, new Date("2026-09-13T00:00:00Z"));
    expect(JSON.stringify(natalChart.points)).toBe(before);
  });

  it("기준 시각이 다르면 진행 위치도 달라진다(하드코딩된 연도 없음)", () => {
    const natalChart = chart();
    const a = calculateSecondaryProgressions(natalChart, new Date("2020-01-01T00:00:00Z"));
    const b = calculateSecondaryProgressions(natalChart, new Date("2030-01-01T00:00:00Z"));
    expect(a.progressedUtcInstant).not.toBe(b.progressedUtcInstant);
    expect(a.points.find((p) => p.id === "sun")!.longitude).not.toBeCloseTo(b.points.find((p) => p.id === "sun")!.longitude, 2);
  });
});
