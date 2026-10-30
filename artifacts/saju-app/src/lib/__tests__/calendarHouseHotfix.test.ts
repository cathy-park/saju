import { describe, it, expect } from 'vitest';
import { lunarToSolarChecked, solarToLunarChecked, calculateSajuChecked } from '../calendarConversion';
import { calculateProfileFromBirth } from '../sajuEngine';
import { buildZiweiChart } from '../ziwei/buildZiweiChart';
import { zhongzhouV1 } from '../ziwei/ruleSets/zhongzhouV1';
import { calculateNatalChart } from '../western/natalChart';
const base = { name: 'synthetic', gender: '여' as const, calendarType: 'solar' as const, year: 1956, month: 12, day: 31, hour: 12, minute: 0, timeUnknown: false, longitude: 127 };

describe('calendar and polar-house hotfix only', () => {
  it.each([
    [[1998, 11, 15], { year: 1999, month: 1, day: 2 }],
    [[2000, 12, 15], { year: 2001, month: 1, day: 9 }],
    [[2019, 12, 30], { year: 2020, month: 1, day: 24 }],
  ] as const)('recovers a late lunar source row %j', (input, expected) => {
    expect(lunarToSolarChecked(...input, false).solar).toEqual(expected);
    expect(calculateProfileFromBirth({ ...base, calendarType: 'lunar', year: input[0], month: input[1], day: input[2] }).solarDate).toEqual(expected);
  });
  it('repairs only the publicly corroborated missing row in both directions and systems', () => {
    const row = solarToLunarChecked(1956, 12, 31);
    expect(row.lunar).toEqual({ year: 1956, month: 11, day: 30, isLeapMonth: false });
    expect(row.gapja.dayPillarHanja).toBe('壬申');
    expect(row.julianDay).toBe(2435839);
    expect(lunarToSolarChecked(1956, 11, 30).solar).toEqual(row.solar);
    const profile = calculateProfileFromBirth(base);
    expect(profile.computedPillars.day.hangul).toBe('임신');
    expect(profile.timeAudit?.warnings).toContain('CALENDAR_SOURCE_ROW_REPAIRED_1956_12_31');
    expect(buildZiweiChart(base, zhongzhouV1).lunarBirth.day).toBe(30);
  });
  it('uses the same-day-stem library hour rule at every hour', () => {
    const stems = ['갑','을','병','정','무','기','경','신','임','계'];
    const branches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
    for (let hour=0; hour<24; hour++) {
      const b = hour===23 ? 0 : Math.floor((hour+1)/2);
      const r = calculateSajuChecked(1956,12,31,hour,0,{ applyTimeCorrection:false });
      expect(r.hourPillar).toBe(stems[(6+b)%10]+branches[b]);
    }
    expect(calculateSajuChecked(1956,12,31).hourPillar).toBeNull();
  });
  it('handles longitude rollover into the repaired date while preserving the original date', () => {
    const p = calculateProfileFromBirth({ ...base, year:1957, month:1, day:1, hour:0, minute:5 });
    expect(p.solarDate).toEqual({year:1957,month:1,day:1});
    expect(p.timeAudit?.effectiveSolarDateTime?.day).toBe(31);
    expect(p.computedPillars.day.hangul).toBe('임신');
  });
  it('does not create other invalid dates or change leap-month policy', () => {
    expect(() => solarToLunarChecked(1956, 12, 32)).toThrow();
    expect(() => lunarToSolarChecked(2050,12,30)).toThrow();
    expect(() => calculateProfileFromBirth({...base,calendarType:'lunar',leapMonth:true})).toThrow();
  });
  it('rejects polar Placidus without changing normal-latitude charts', () => {
    const input={localDateTime:'1900-04-15T12:34:00',timezone:'UTC',latitude:67,longitude:-74};
    expect(calculateNatalChart(input).ok).toBe(false);
    expect(calculateNatalChart({...input,latitude:37.5}).ok).toBe(true);
  });
});
