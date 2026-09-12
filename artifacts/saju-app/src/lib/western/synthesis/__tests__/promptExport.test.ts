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
});
