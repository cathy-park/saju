import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { TimeCalculationAuditView } from "../../components/TimeCalculationAuditView";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateSaju,
  solarToLunar,
  lunarToSolar,
} from "@fullstackfamily/manseryeok";
import { calculateProfileFromBirth, type BirthInput } from "../sajuEngine";
import { determineGukguk, GEONROK_BRANCH, YANGIN_BRANCH } from "../gukguk";
import { determineLatentGukguk } from "../latentGukguk";
import { resolveLocalDateTime } from "../western/time";
import { calculateNatalChart } from "../western/natalChart";
import { buildZiweiChart } from "../ziwei/buildZiweiChart";
import { zhongzhouV1 } from "../ziwei/ruleSets/zhongzhouV1";

// Synthetic fixtures, unrelated to any saved profile.
const birth: BirthInput = {
  name: "synthetic",
  gender: "여",
  calendarType: "solar",
  year: 2000,
  month: 2,
  day: 16,
  hour: 0,
  minute: 5,
  timeUnknown: false,
  longitude: 127,
};
describe("real manseryeok guards", () => {
  it("carries longitude correction into the preceding date and preserves original input", () => {
    const original = structuredClone(birth);
    const r = calculateProfileFromBirth(birth);
    expect(birth).toEqual(original);
    expect(r.solarDate).toEqual({ year: 2000, month: 2, day: 16 });
    expect(r.timeAudit?.effectiveSolarDateTime).toEqual({
      year: 2000,
      month: 2,
      day: 15,
      hour: 23,
      minute: 33,
    });
    const reference = calculateSaju(2000, 2, 15, 23, 33, {
      applyTimeCorrection: false,
    });
    expect(r.computedPillars.day.hangul).toBe(reference.dayPillar);
    expect(r.computedPillars.hour?.hangul).toBe(reference.hourPillar);
  });
  it("handles next day, leap day, large offsets, and zero correction", () => {
    expect(
      calculateProfileFromBirth({
        ...birth,
        month: 12,
        day: 31,
        hour: 23,
        minute: 55,
        longitude: 140,
      }).timeAudit?.effectiveSolarDateTime,
    ).toEqual({ year: 2001, month: 1, day: 1, hour: 0, minute: 15 });
    expect(
      calculateProfileFromBirth({ ...birth, month: 3, day: 1 }).timeAudit
        ?.effectiveSolarDateTime?.day,
    ).toBe(29);
    expect(
      calculateProfileFromBirth({ ...birth, longitude: -180 }).timeAudit
        ?.effectiveSolarDateTime?.minute,
    ).toBe(5);
    const zero = calculateProfileFromBirth({ ...birth, longitude: 135 });
    expect(zero.isTimeCorrected).toBe(false);
    expect(zero.timeAudit?.effectiveTime).toEqual({ hour: 0, minute: 5 });
  });
  it("preserves the dependency rounding at half-minute longitude offsets", () => {
    const b = { ...birth, hour: 12, minute: 0, longitude: 127.125 };
    expect(calculateProfileFromBirth(b).correctedTime).toEqual(
      calculateSaju(2000, 2, 16, 12, 0, { longitude: 127.125 }).correctedTime,
    );
  });
  it("applies equation of time on top of the default longitude correction", () => {
    const r = calculateProfileFromBirth(birth, { trueSolarTimeOn: true });
    expect(r.timeAudit?.basis).toBe("apparent-solar-approximate");
    expect(r.timeAudit?.effectiveSolarDateTime?.day).toBe(15);
    expect(r.timeAudit?.equationOfTimeMinutesApplied).toBeLessThan(0);
    expect(
      calculateProfileFromBirth(birth).timeAudit?.equationOfTimeMinutesApplied,
    ).toBe(0);
  });
  it("rejects invalid solar date, clock, range, longitude, and unsupported lunar leap input", () => {
    for (const patch of [
      { month: 2, day: 30 },
      { hour: 24 },
      { year: 1899 },
      { longitude: NaN },
      { leapMonth: true, calendarType: "lunar" as const },
    ]) {
      expect(() => calculateProfileFromBirth({ ...birth, ...patch })).toThrow();
    }
  });
  it("round trips real ordinary lunar conversion without changing the calendar input", () => {
    const lunar = solarToLunar(2000, 6, 15).lunar;
    const solar = lunarToSolar(
      lunar.year,
      lunar.month,
      lunar.day,
      lunar.isLeapMonth,
    ).solar;
    expect(solar).toEqual({ year: 2000, month: 6, day: 15 });
    expect(
      calculateProfileFromBirth({
        ...birth,
        calendarType: "lunar",
        year: lunar.year,
        month: lunar.month,
        day: lunar.day,
      }).solarDate,
    ).toEqual(solar);
  });
  it("actually recomputes ±5 minute branch sensitivity and preserves the other clocks", () => {
    const cases = [24, 29, 34].map((minute) => ({
      ...birth,
      hour: 19,
      minute,
    }));
    const profiles = cases.map((b) => calculateProfileFromBirth(b));
    expect(
      new Set(profiles.map((r) => r.computedPillars.hour?.hangul)).size,
    ).toBe(2);
    expect(profiles[1].timeAudit?.warnings).toContain(
      "HOUR_BRANCH_BOUNDARY_WITHIN_5_MINUTES",
    );
    const ziwei = cases.map((b) =>
      buildZiweiChart({ ...b, hour: b.hour!, minute: b.minute! }, zhongzhouV1),
    );
    expect(new Set(ziwei.map((r) => r.lunarBirth.hourBranch)).size).toBe(1);
    const charts = cases.map((b) =>
      calculateNatalChart({
        localDateTime: `2000-02-16T19:${b.minute}:00`,
        timezone: "Asia/Seoul",
        latitude: 37,
        longitude: 127,
      }),
    );
    expect(charts.every((c) => c.ok)).toBe(true);
    if (charts[1].ok)
      expect(charts[1].chart.normalizedBirth.utcInstant).toBe(
        "2000-02-16T10:29:00.000Z",
      );
  });
  it("labels the dependency date-only solar term limitation instead of claiming instant precision", () => {
    const before = calculateProfileFromBirth(
      { ...birth, day: 4, hour: 0 },
      { localMeridianOn: false },
    );
    const after = calculateProfileFromBirth(
      { ...birth, day: 4, hour: 23 },
      { localMeridianOn: false },
    );
    expect(before.computedPillars.month).toEqual(after.computedPillars.month);
    expect(before.timeAudit?.warnings).toContain(
      "SOLAR_TERM_INSTANT_NOT_SUPPORTED",
    );
  });
});
describe("month guards using real ten-god implementation", () => {
  it.each(Object.entries(GEONROK_BRANCH))(
    "retains a same-stem non-day pillar for %s",
    (stem, branch) => {
      expect(
        determineGukguk(stem, branch, [stem, stem, stem, stem])?.name,
      ).toBe("건록격");
    },
  );
  it.each(Object.entries(YANGIN_BRANCH).filter(([stem]) => stem !== "무"))(
    "allows actual rob-wealth exposure only in the yang blade month for %s",
    (stem, branch) => {
      const peer: Record<string, string> = {
        갑: "을",
        병: "정",
        경: "신",
        임: "계",
      };
      expect(
        determineGukguk(stem, branch, [
          peer[stem],
          peer[stem],
          stem,
          peer[stem],
        ])?.name,
      ).toBe("양인격");
    },
  );
  it("keeps Ding-Yin strict classification pending and the latent resource as a candidate", () => {
    expect(determineGukguk("정", "인", ["기", "병", "정", "기"])).toBeNull();
    expect(
      determineLatentGukguk("정", "인", ["기", "병", "정", "기"])?.name,
    ).toBe("정인격");
    expect(determineGukguk("정", "인", ["갑", "병", "정", "기"])?.name).toBe(
      "정인격",
    );
    // Wu-Wu has no rob-wealth hidden stem in this school's table: do not force it.
    expect(determineGukguk("무", "오", ["정", "병", "무", "정"])?.name).toBe(
      "정인격",
    );
  });
});
describe("IANA/DST conversion with actual Intl and astronomy modules", () => {
  it("rejects gaps/folds and resolves explicit fold selection one hour apart", () => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime: "2000-04-02T02:30:00",
        timezone: "America/New_York",
      }),
    ).toThrow(/does not exist/);
    const fold = {
      localDateTime: "2000-10-29T01:30:00",
      timezone: "America/New_York",
    };
    expect(() => resolveLocalDateTime(fold)).toThrow(/occurs twice/);
    const early = resolveLocalDateTime({ ...fold, dstFold: "earlier" });
    const late = resolveLocalDateTime({ ...fold, dstFold: "later" });
    expect(Date.parse(late.utcInstant) - Date.parse(early.utcInstant)).toBe(
      3600000,
    );
    expect(
      resolveLocalDateTime({
        localDateTime: "1988-06-15T12:00:00",
        timezone: "Asia/Seoul",
      }).utcOffsetMinutes,
    ).toBe(600);
  });
});

it("renders the actual engine audit and missing-audit state in the UI component", () => {
  const audit = calculateProfileFromBirth(birth).timeAudit;
  const html = renderToStaticMarkup(
    createElement(TimeCalculationAuditView, { audit }),
  );
  expect(html).toContain("local-mean");
  expect(html).toContain("SOLAR_TERM_INSTANT_NOT_SUPPORTED");
  expect(html).toContain("독립 검증은 완료되지 않았습니다");
  expect(
    renderToStaticMarkup(createElement(TimeCalculationAuditView)),
  ).toContain("시간 감사 정보가 없습니다");
});
