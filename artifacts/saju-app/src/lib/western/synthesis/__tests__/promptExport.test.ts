import { describe, it, expect } from "vitest";
import { buildWesternCopyPrompt, buildWesternRelationshipCopyPrompt } from "../promptExport";
import { calculateNatalChart } from "../../natalChart";
import { resolveWesternSynastryForBirths } from "../../synastry/personAdapter";

describe("buildWesternCopyPrompt — 21단계 서양점성술 AI 해석 프롬프트 복사", () => {
  it("canonical natal structure를 Markdown으로 만들고 해석/ID를 제외한다", () => {
    const result = calculateNatalChart({ localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" });
    if (!result.ok) throw new Error("fixture failed");
    const prompt = buildWesternCopyPrompt(result.chart);
    expect(prompt).toContain("# 서양점성술 계산 구조");
    expect(prompt).toContain("Tropical / Placidus");
    expect(prompt).toContain("Sun:");
    expect(prompt).toContain("## 12 House Cusps");
    expect(prompt).toContain("orb");
    expect(prompt).not.toMatch(/personId|relationKind|meaning-1|synthesis:/);
    expect(() => JSON.parse(prompt)).toThrow();
  });

  it("관계 원자료에는 내부 personId를 노출하지 않는다", () => {
    const birth = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
    const result = resolveWesternSynastryForBirths({ personId: "private-a-id", birth }, { personId: "private-b-id", birth: { ...birth, year: 1990 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const prompt = buildWesternRelationshipCopyPrompt(result.report, { "private-a-id": { name: "첫 사람" }, "private-b-id": { name: "둘째 사람" } });
    expect(prompt).toContain("## Synastry Cross-Aspects");
    expect(prompt).not.toContain("private-a-id");
    expect(prompt).not.toContain("private-b-id");
  });

  // 대표 지시 — "구조는 유지하되 중복 문구만 제거". natal 두 명분을 이어붙이면서 안내
  // 문구("아래는 계산된 서양점성술 원자료입니다...")와 "# 서양점성술 계산 구조" 헤더가
  // 사람마다 반복되던 걸, 관계 프롬프트 최상단 안내문 하나로만 남긴다.
  it("두 사람분을 이어붙여도 원자료 안내 문구·섹션 헤더가 반복되지 않는다", () => {
    const birth = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
    const result = resolveWesternSynastryForBirths({ personId: "private-a-id", birth }, { personId: "private-b-id", birth: { ...birth, year: 1990 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const prompt = buildWesternRelationshipCopyPrompt(result.report, { "private-a-id": { name: "첫 사람" }, "private-b-id": { name: "둘째 사람" } });
    const introCount = prompt.split("아래는").length - 1;
    expect(introCount).toBe(1); // 관계 프롬프트 최상단 안내문 하나만 남는다.
    const headerCount = prompt.split("# 서양점성술 계산 구조").length - 1;
    expect(headerCount).toBe(0); // 사람별 natal chart 헤더(# 첫 사람 natal chart 등)로 이미 구분되므로 제거.
    expect(prompt).toContain("첫 사람 natal chart");
    expect(prompt).toContain("둘째 사람 natal chart 및 관계 구조");
    expect(prompt).toContain("출생 현지시각:");
  });
});
