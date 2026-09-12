import { describe, it, expect } from "vitest";
import { buildWesternCopyPrompt, buildWesternRelationshipCopyPrompt } from "../promptExport";
import { calculateNatalChart } from "../../natalChart";
import { resolveWesternSynastryForBirths } from "../../synastry/personAdapter";
import { buildWesternTransitReport } from "../../transit/report";

const PARK_SOYEON_INPUT = { localDateTime: "1989-02-16T19:29:00", latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" } as const;

function parkSoyeonChart() {
  const result = calculateNatalChart(PARK_SOYEON_INPUT);
  if (!result.ok) throw new Error("fixture failed");
  return result.chart;
}

describe("buildWesternCopyPrompt — 서양점성술 AI 해석 프롬프트 복사(계산 원자료만)", () => {
  it("canonical natal structure를 Markdown으로 만들고 해석/ID를 제외한다", () => {
    const prompt = buildWesternCopyPrompt(parkSoyeonChart());
    expect(prompt).toContain("# 서양점성술 계산 원자료");
    expect(prompt).toContain("## 1. Natal Chart");
    expect(prompt).toContain("Tropical / Placidus");
    expect(prompt).toContain("Sun:");
    expect(prompt).toContain("### 12 House Cusps");
    expect(prompt).toContain("orb");
    expect(prompt).not.toMatch(/personId|relationKind|meaning-1|synthesis:/);
    expect(() => JSON.parse(prompt)).toThrow();
  });

  // 대표 지시 4개 항목 — 실제 박소연 데이터로 Natal/Current Transits/Secondary
  // Progressions/Solar Return이 모두 clipboard 원자료에 들어가는지 검증한다.
  it("박소연 실제 데이터: Natal + Current Transits + Secondary Progressions + Solar Return이 모두 원자료에 존재한다", () => {
    const prompt = buildWesternCopyPrompt(parkSoyeonChart());
    expect(prompt).toContain("## 1. Natal Chart");
    expect(prompt).toContain("## 2. Current Transits");
    expect(prompt).toContain("## 3. Secondary Progressions");
    expect(prompt).toContain("## 4. Solar Return");

    const transitSection = prompt.split("## 2. Current Transits")[1].split("## 3.")[0];
    expect(transitSection).toContain("기준시각:");
    expect(transitSection).toContain("조회 범위:");
    // 지금 이 순간 기준으로 자동 계산돼야 한다 — 실제 실행 시각의 연-월과 일치해야 하고,
    // 특정 연도가 코드에 하드코딩돼 있지 않아야 한다(테스트를 나중에 실행해도 그때그때 달라짐).
    const currentYearMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    expect(transitSection).toContain(currentYearMonth);

    const progressionsSection = prompt.split("## 3. Secondary Progressions")[1].split("## 4.")[0];
    expect(progressionsSection).toContain("기준일:");
    expect(progressionsSection).toContain("진행 시각(1일=1년 환산):");
    expect(progressionsSection).toContain("### Progressed Planets");
    expect(progressionsSection).toContain("Sun:");
    expect(progressionsSection).toContain("### Progressed → Natal Aspects");
    expect(progressionsSection).toContain("### Progressed ↔ Progressed Aspects");

    const solarReturnSection = prompt.split("## 4. Solar Return")[1];
    expect(solarReturnSection).toContain("대상연도:");
    expect(solarReturnSection).toContain("정확시각:");
    expect(solarReturnSection).toContain("### Planets");
    // 기준 지역을 안 줬으므로 houses/angles는 계산하지 않는다고 명시해야 한다(출생지 대체 금지).
    expect(solarReturnSection).toContain("솔라리턴 기준 지역 없음");
    expect(solarReturnSection).not.toContain("### Angles");
  });

  // 대표 지시 — WesternTransit.tsx에서 특정 월을 선택한 경우, 화면에 보이는 그 월의
  // WesternTransitReport를 그대로 복사에 써야 한다(자동으로 "지금"을 다시 계산하지 않음).
  // Natal/Progressions/Solar Return/Synastry 구조는 이 옵션과 무관하게 그대로다.
  it("transit override를 주면 '지금'이 아니라 그 선택된 월의 조회 범위를 그대로 쓴다", () => {
    const chart = parkSoyeonChart();
    // 실행 시점과 절대 겹치지 않는, 화면에서 사용자가 과거로 이동해 선택했을 법한 달.
    const selected = buildWesternTransitReport(chart, { startLocalDate: "2019-05-01", endLocalDate: "2019-05-31", timezone: "Asia/Seoul", referenceLocalDateTime: "2019-05-15T12:00:00" });
    const prompt = buildWesternCopyPrompt(chart, { transit: selected });
    const transitSection = prompt.split("## 2. Current Transits")[1].split("## 3.")[0];
    expect(transitSection).toContain("조회 범위: 2019-05-01 ~ 2019-05-31");
    expect(transitSection).toContain(selected.timeline.query.referenceUtcInstant);
    // Natal/Progressions/Solar Return은 override와 무관하게 그대로 계산된다.
    expect(prompt).toContain("## 1. Natal Chart");
    expect(prompt).toContain("## 3. Secondary Progressions");
    expect(prompt).toContain("## 4. Solar Return");
  });

  it("transit override가 없으면 지금까지처럼 현재 시점을 자동 계산한다(회귀 확인)", () => {
    const chart = parkSoyeonChart();
    const withOverride = buildWesternCopyPrompt(chart, { transit: buildWesternTransitReport(chart, { startLocalDate: "2019-05-01", endLocalDate: "2019-05-31", timezone: "Asia/Seoul" }) });
    const withoutOverride = buildWesternCopyPrompt(chart);
    expect(withOverride.split("## 2. Current Transits")[1].split("## 3.")[0]).not.toBe(withoutOverride.split("## 2. Current Transits")[1].split("## 3.")[0]);
    expect(withoutOverride.split("## 2. Current Transits")[1]).not.toContain("2019-05");
  });

  it("solar return 기준 지역을 주면 ASC/MC/12 House Cusps가 포함된다", () => {
    const prompt = buildWesternCopyPrompt(parkSoyeonChart(), { solarReturnLocation: { latitude: 37.5665, longitude: 126.9780, timezone: "Asia/Seoul", placeLabel: "서울" } });
    const solarReturnSection = prompt.split("## 4. Solar Return")[1];
    expect(solarReturnSection).not.toContain("솔라리턴 기준 지역 없음");
    expect(solarReturnSection).toContain("기준 지역: 서울");
    expect(solarReturnSection).toContain("### Angles");
    expect(solarReturnSection).toContain("### 12 House Cusps");
  });

  it("관계 원자료에는 내부 personId를 노출하지 않는다", () => {
    const birth = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
    const result = resolveWesternSynastryForBirths({ personId: "private-a-id", birth }, { personId: "private-b-id", birth: { ...birth, year: 1990 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const prompt = buildWesternRelationshipCopyPrompt(result.report, { "private-a-id": { name: "첫 사람" }, "private-b-id": { name: "둘째 사람" } });
    expect(prompt).toContain("## 3. Synastry");
    expect(prompt).not.toContain("private-a-id");
    expect(prompt).not.toContain("private-b-id");
  });

  // 대표 지시 — "구조는 유지하되 중복 문구만 제거". natal 두 명분을 이어붙이면서 안내
  // 문구("아래는...")가 사람마다 반복되지 않고, 요청한 11개 섹션 순서를 그대로 지킨다.
  it("두 사람분을 이어붙여도 원자료 안내 문구가 반복되지 않고, 요청한 11개 섹션이 순서대로 있다", () => {
    const birth = { calendarType: "solar" as const, year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false, latitude: 37.4563, longitude: 126.7052, timezone: "Asia/Seoul" };
    const result = resolveWesternSynastryForBirths({ personId: "private-a-id", birth }, { personId: "private-b-id", birth: { ...birth, year: 1990 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const prompt = buildWesternRelationshipCopyPrompt(result.report, { "private-a-id": { name: "첫 사람" }, "private-b-id": { name: "둘째 사람" } });
    const introCount = prompt.split("아래는").length - 1;
    expect(introCount).toBe(1); // 관계 프롬프트 최상단 안내문 하나만 남는다.
    expect(prompt).toContain("# 두 사람 서양점성술 관계 계산 원자료");
    const headers = ["## 1. 첫 사람 Natal", "## 2. 둘째 사람 Natal", "## 3. Synastry", "## 4. House Overlays", "## 5. Angle Aspects", "## 6. 첫 사람 Current Transits", "## 7. 둘째 사람 Current Transits", "## 8. 첫 사람 Secondary Progressions", "## 9. 둘째 사람 Secondary Progressions", "## 10. 첫 사람 Solar Return", "## 11. 둘째 사람 Solar Return"];
    let cursor = -1;
    for (const header of headers) {
      const index = prompt.indexOf(header);
      expect(index).toBeGreaterThan(cursor); // 순서대로 등장해야 한다.
      cursor = index;
    }
    expect(prompt).toContain("출생 현지시각:");
  });
});
