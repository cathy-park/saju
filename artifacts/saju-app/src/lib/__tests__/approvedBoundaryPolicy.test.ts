import { describe, it, expect, vi } from "vitest";
import { calculateProfileFromBirth, type BirthInput } from "../sajuEngine";
import { solarTermInstant, solarTermYearMonth } from "../solarTerms";
import { calculateDaewoonStart, calculateDaewoon, selectDaewoonAt, selectDaewoonForRange } from "../luckCycles";
import { toLunarBirth } from "../ziwei/lunarConvert";
import { ziweiQueryLunarYear, ziweiInclusiveAge, ziweiLunarYearRange } from "../ziwei/calendarPolicy";
import { buildZiweiChart } from "../ziwei/buildZiweiChart";
import { zhongzhouV1 } from "../ziwei/ruleSets/zhongzhouV1";
import { spouseReportTimingYears } from "../ziwei/reports/spouseReport";
const base: BirthInput = { name:"synthetic", gender:"여", calendarType:"solar", year:2000, month:6, day:15, hour:12, minute:0, timeUnknown:false, longitude:127 };
const independentTerms = [{"longitude":15,"iso":"2000-04-04T11:31:57.775691Z"},{"longitude":45,"iso":"2000-05-05T04:50:09.516674Z"},{"longitude":75,"iso":"2000-06-05T08:58:33.750699Z"},{"longitude":105,"iso":"2000-07-06T19:13:56.460266Z"},{"longitude":135,"iso":"2000-08-07T05:02:59.569951Z"},{"longitude":165,"iso":"2000-09-07T07:59:09.634203Z"},{"longitude":195,"iso":"2000-10-07T23:38:11.965011Z"},{"longitude":225,"iso":"2000-11-07T02:48:03.345589Z"},{"longitude":255,"iso":"2000-12-06T19:37:01.694031Z"},{"longitude":285,"iso":"2000-01-06T01:00:41.224346Z"},{"longitude":315,"iso":"2000-02-04T12:40:23.015946Z"},{"longitude":345,"iso":"2000-03-05T06:42:38.966124Z"}];
describe("approved physical-time and lunar-year policy",()=>{
 it.each(independentTerms)("crosses independent Swiss month term $longitude at minute-scale separation",({longitude,iso})=>{
   const ref=Date.parse(iso);
   expect(Math.abs(solarTermInstant(2000,longitude).getTime()-ref)).toBeLessThan(30000);
   const before=solarTermYearMonth(new Date(ref-60000)),after=solarTermYearMonth(new Date(ref+60000));
   expect(before.month).not.toEqual(after.month);
   if(longitude===315){expect(before.year.hangul).toBe("기묘");expect(after.year.hangul).toBe("경진");}
   else expect(before.year).toEqual(after.year);
 });
 it("uses civil instant for year/month and preserves corrected day/hour",()=>{
   const b={...base,month:2,day:4,hour:21,minute:41};
   const civil=calculateProfileFromBirth(b,{localMeridianOn:false});
   const corrected=calculateProfileFromBirth(b);
   expect(corrected.computedPillars.year).toEqual(civil.computedPillars.year);
   expect(corrected.computedPillars.month).toEqual(civil.computedPillars.month);
   expect(corrected.computedPillars.year.hangul).toBe("경진");
   expect(corrected.timeAudit?.longitudeMinutesApplied).toBe(-32);
   expect(corrected.rawResult.gapja.yearPillar).toBe(corrected.computedPillars.year.hangul);
 });
 it("removes the 24-hour 10-to-1 discontinuity",()=>{
   const term=solarTermInstant(2000,315).getTime();
   const ages=[-1,1].map(offset=>{
     const local=new Date(term+86400000+offset*60000+9*3600000);
     const b={...base,month:local.getUTCMonth()+1,day:local.getUTCDate(),hour:local.getUTCHours(),minute:local.getUTCMinutes()};
     return calculateDaewoonStart(b,calculateProfileFromBirth(b).computedPillars).ageYears;
   });
   expect(ages[0]).toBeGreaterThan(.32);expect(ages[1]).toBeLessThan(.35);
   expect(ages[1]-ages[0]).toBeCloseTo(2/4320,8);
 });
 it("selects every physical transition exactly once with no age gaps",()=>{
   const entries=calculateDaewoon(base,calculateProfileFromBirth(base).computedPillars);
   for(let i=1;i<entries.length;i++){
     expect(entries[i-1].endInstantUtcExclusive).toBe(entries[i].startInstantUtc);
     const boundary=Date.parse(entries[i].startInstantUtc!);
     expect(selectDaewoonAt(entries,new Date(boundary-1))).toBe(entries[i-1]);
     expect(selectDaewoonAt(entries,new Date(boundary))).toBe(entries[i]);
     expect(selectDaewoonAt(entries,new Date(boundary+1))).toBe(entries[i]);
     expect(selectDaewoonForRange(entries,new Date(boundary-1),new Date(boundary+1))).toBeUndefined();
   }
 });
 it("does not invent noon or age five when required birth data is absent",()=>{
   expect(calculateDaewoon({...base,timeUnknown:true},calculateProfileFromBirth({...base,timeUnknown:true}).computedPillars)).toEqual([]);
   expect(()=>calculateDaewoonStart({...base,timeUnknown:true},calculateProfileFromBirth(base).computedPillars)).toThrow();
   expect(()=>calculateDaewoonStart({...base,calendarType:"lunar",month:2,day:31},calculateProfileFromBirth(base).computedPillars)).toThrow();
 });
 it("derives Ziwei year stem/branch from lunar year on either side of 설 and 입춘",()=>{
   const before=toLunarBirth("solar",2025,1,28,23),after=toLunarBirth("solar",2025,1,29,0);
   expect([before.year,before.yearStem,before.yearBranch]).toEqual([2024,"甲","辰"]);
   expect([after.year,after.yearStem,after.yearBranch]).toEqual([2025,"乙","巳"]);
   expect(toLunarBirth("solar",2025,2,3,12).yearStem).toBe("乙");
   expect(toLunarBirth("solar",2025,2,4,12).yearStem).toBe("乙");
 });
 it("uses midnight Korean civil date and lunar inclusive age for current reports",()=>{
   const before=new Date("2025-01-28T23:59:59+09:00"),after=new Date("2025-01-29T00:00:00+09:00");
   expect(ziweiQueryLunarYear(before)).toBe(2024);expect(ziweiQueryLunarYear(after)).toBe(2025);
   expect(ziweiInclusiveAge(2000,ziweiQueryLunarYear(before))).toBe(25);
   expect(ziweiInclusiveAge(2000,ziweiQueryLunarYear(after))).toBe(26);
   vi.useFakeTimers();try{vi.setSystemTime(before);expect(spouseReportTimingYears()[0]).toBe(2024);vi.setSystemTime(after);expect(spouseReportTimingYears()[0]).toBe(2025);}finally{vi.useRealTimers();}
 });
 it("labels annual table with actual lunar-new-year half-open civil ranges",()=>{
   expect(ziweiLunarYearRange(2025)).toEqual({basis:"lunar-year-inclusive-age",startCivilInclusive:"2025-01-29T00:00:00+09:00",endCivilExclusive:"2026-02-17T00:00:00+09:00"});
   const chart=buildZiweiChart(base,zhongzhouV1,[2025]);
   expect(chart.annualPeriods[0].startCivilInclusive).toBe("2025-01-29T00:00:00+09:00");
 });
});
