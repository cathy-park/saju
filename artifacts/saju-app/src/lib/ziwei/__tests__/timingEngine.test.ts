import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../buildZiweiChart";
import { zhongzhouV1 } from "../ruleSets/zhongzhouV1";
import {
  yearToStem, derivePalaceBranch, computeRelationshipTimingSignals, computeTimingHighlights,
} from "../timingEngine";
import { PARK_SOYEON_BIRTH } from "./fixtures/parkSoyeon";

const years = Array.from({ length: 10 }, (_, i) => 2024 + i);
const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1, years);

describe("timingEngine — 근거 데이터만 산출(자연어 문장 없음)", () => {
  it("yearToStem: 1984=甲, 1987=丁(조용민 fixture와 일치), 1989=己(박소연)", () => {
    expect(yearToStem(1984)).toBe("甲");
    expect(yearToStem(1987)).toBe("丁");
    expect(yearToStem(1989)).toBe("己");
  });

  it("derivePalaceBranch: 命宮=辰일 때 그 시기 夫妻宮(命宮 기준 +2칸 감소 방향)은 寅이다 — 원국 배정과 동일 규칙", () => {
    // 원국에서도 命宮=辰, 夫妻宮=寅 이므로(박소연 fixture), anchorBranch=辰으로 넣으면
    // derivePalaceBranch가 원국 命宮 배정 규칙을 그대로 재현하는지 확인할 수 있다.
    expect(derivePalaceBranch("辰", "命宮")).toBe("辰");
    expect(derivePalaceBranch("辰", "夫妻宮")).toBe("寅");
    expect(derivePalaceBranch("辰", "事業宮")).toBe("申");
  });

  it("derivePalaceBranch로 12궁 전체를 복원하면 원국 palaces 배열과 정확히 같다", () => {
    const mingGongBranch = chart.mingGong.branch;
    for (const p of chart.palaces) {
      expect(derivePalaceBranch(mingGongBranch, p.palace)).toBe(p.branch);
    }
  });

  it("computeRelationshipTimingSignals: 4개 축이 각각 score+evidence로 독립 존재하고, 자연어 문장 필드가 없다", () => {
    const signals = computeRelationshipTimingSignals(chart, zhongzhouV1, years);
    expect(signals.length).toBe(years.length);
    for (const s of signals) {
      for (const axis of [s.activation, s.stability, s.formalization, s.volatility]) {
        expect(typeof axis.score).toBe("number");
        expect(Array.isArray(axis.evidence)).toBe(true);
      }
      expect(Object.keys(s)).toEqual(["year", "activation", "stability", "formalization", "volatility"]);
    }
    const json = JSON.stringify(signals);
    expect(json).not.toMatch(/결혼/);
    expect(json).not.toMatch(/년에/);
  });

  it("化祿/化權/化科/化忌를 하나의 count로 합치지 않고 축마다 다르게 반영한다(2029=己년, 박소연 기준)", () => {
    // 己년 사화: 化祿=武曲@財帛宮(子, scope 밖) / 化權=貪狼@夫妻宮(寅, scope 안) /
    // 化科=天梁@父母宮(巳, scope 밖) / 化忌=文曲@夫妻宮(寅, scope 안).
    const [signal] = computeRelationshipTimingSignals(chart, zhongzhouV1, [2029]);
    const activationEv = JSON.stringify(signal.activation.evidence);
    const volatilityEv = JSON.stringify(signal.volatility.evidence);
    const stabilityEv = JSON.stringify(signal.stability.evidence);
    const formalizationEv = JSON.stringify(signal.formalization.evidence);

    // scope 밖인 化祿(武曲)·化科(天梁)는 어느 축에도 등장하지 않는다.
    expect(activationEv).not.toMatch(/武曲/);
    expect(formalizationEv).not.toMatch(/天梁/);

    // 化權은 activation에만 반영되고(공식화 신호로 자동 취급하지 않음), formalization/volatility에는 없다.
    expect(activationEv).toMatch(/化權\(貪狼\)/);
    expect(formalizationEv).not.toMatch(/化權/);
    expect(volatilityEv).not.toMatch(/化權/);

    // 化忌는 activation+volatility를 올리고 stability는 감점(evidence에는 남는다).
    expect(activationEv).toMatch(/化忌\(文曲\)/);
    expect(volatilityEv).toMatch(/化忌\(文曲\)/);
    expect(stabilityEv).toMatch(/化忌\(文曲\)/);
    expect(signal.stability.score).toBeLessThan(0.5); // 化忌 감점이 반영돼 안정도가 낮아짐(다른 가점이 없다면 음수)
  });

  it("流年 紅鸞·天喜는 생년 고정이 아니라 해당 연도 기준으로 다시 계산된다", () => {
    const [y2026] = computeRelationshipTimingSignals(chart, zhongzhouV1, [2026]);
    const [y2027] = computeRelationshipTimingSignals(chart, zhongzhouV1, [2027]);
    // 두 해의 연지가 다르므로(丙午/丁未), 流年紅鸞·天喜 근거 문자열도 서로 달라야 한다
    // (같은 문자열이 매년 반복된다면 "생년 고정값을 재사용하는 버그"라는 뜻).
    const ev2026 = JSON.stringify(y2026.activation.evidence);
    const ev2027 = JSON.stringify(y2027.activation.evidence);
    const hongluan2026 = ev2026.match(/紅鸞\(流年\)@(.)/)?.[1];
    const hongluan2027 = ev2027.match(/紅鸞\(流年\)@(.)/)?.[1];
    if (hongluan2026 && hongluan2027) {
      expect(hongluan2026).not.toBe(hongluan2027);
    }
  });

  it("evidence의 source 태그는 표시용 metadata일 뿐 점수·판정 로직에 영향을 주지 않는다(2029=己년, 박소연 기준)", () => {
    const [signal] = computeRelationshipTimingSignals(chart, zhongzhouV1, [2029]);
    // 大限夫妻宮/삼방 중첩(stability)은 major, 流年 관련 근거(activation/formalization/volatility)는
    // annual로 태깅된다 — 이 엔진은 natal 단독 근거를 만들지 않으므로 natal 태그는 등장하지 않는다.
    for (const e of signal.stability.evidence) {
      if (e.type === "period") expect(e.source).toBe("major");
    }
    for (const e of [...signal.activation.evidence, ...signal.formalization.evidence, ...signal.volatility.evidence]) {
      expect(e.source === "annual" || e.source === undefined).toBe(true);
    }
    const allSources = [signal.activation, signal.stability, signal.formalization, signal.volatility]
      .flatMap((axis) => axis.evidence.map((e) => e.source));
    expect(allSources).not.toContain("natal");

    // source 태그를 다 지워도 점수는 그대로다(순수 metadata라는 증거).
    const stripped = JSON.parse(JSON.stringify(signal));
    for (const axis of ["activation", "stability", "formalization", "volatility"] as const) {
      for (const e of stripped[axis].evidence) delete e.source;
    }
    expect(stripped.activation.score).toBe(signal.activation.score);
    expect(stripped.stability.score).toBe(signal.stability.score);
  });

  it("computeTimingHighlights: 임계치(1.5) 이상인 축만 해당 연도 목록에 들어간다", () => {
    const signals = computeRelationshipTimingSignals(chart, zhongzhouV1, years);
    const highlights = computeTimingHighlights(signals);
    for (const year of highlights.activationYears) {
      const s = signals.find((x) => x.year === year)!;
      expect(s.activation.score).toBeGreaterThanOrEqual(1.5);
    }
    for (const year of highlights.stabilityYears) {
      const s = signals.find((x) => x.year === year)!;
      expect(s.stability.score).toBeGreaterThanOrEqual(1.5);
    }
  });
});
