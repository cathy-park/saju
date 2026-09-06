// Phase 2 Core/Aux 2계층 종합 궁합 점수 단위 테스트(2026-09).
import { describe, it, expect } from "vitest";
import {
  normalizeCoreAxis,
  positiveAuxGate,
  computeCoreAuxBreakdown,
  CORE_DM_POS_MAX,
  CORE_DM_NEG_MIN,
  CORE_SP_POS_MAX,
  CORE_MB_POS_MAX,
  AUX_POS_MAX,
  AUX_NEG_MAX,
  CORE_MAX_INFLUENCE,
  AUX_MAX_INFLUENCE,
} from "./compatibilityScore";

describe("normalizeCoreAxis: 개별 core 축을 -1~+1로 정규화(각기 다른 positive/negative 분모 사용)", () => {
  it("양수는 POS_MAX로, 음수는 NEG_MIN(절댓값)으로 나눈다 — 서로 다른 range가 암묵적 가중치가 되지 않는다", () => {
    expect(normalizeCoreAxis(CORE_DM_POS_MAX, CORE_DM_POS_MAX, CORE_DM_NEG_MIN)).toBeCloseTo(1, 5);
    expect(normalizeCoreAxis(-CORE_DM_NEG_MIN, CORE_DM_POS_MAX, CORE_DM_NEG_MIN)).toBeCloseTo(-1, 5);
    expect(normalizeCoreAxis(CORE_DM_POS_MAX / 2, CORE_DM_POS_MAX, CORE_DM_NEG_MIN)).toBeCloseTo(0.5, 5);
  });

  it("정규화 이후에는 dm/sp/mb가 동일한 -1~+1 스케일을 공유한다(원래 range와 무관)", () => {
    // dm 최댓값(15)과 sp 최댓값(18)은 raw로는 다르지만, 정규화 후에는 둘 다 정확히 1이 된다.
    expect(normalizeCoreAxis(15, CORE_DM_POS_MAX, CORE_DM_NEG_MIN)).toBe(1);
    expect(normalizeCoreAxis(18, CORE_SP_POS_MAX, 18)).toBe(1);
  });

  it("범위를 벗어나는 값도 ±1로 clamp된다(방어적)", () => {
    expect(normalizeCoreAxis(999, CORE_MB_POS_MAX, 12)).toBe(1);
    expect(normalizeCoreAxis(-999, CORE_MB_POS_MAX, 12)).toBe(-1);
  });
});

describe("positiveAuxGate: piecewise-linear(-1→0.20, 0→0.65, +1→0.95), 연속적이며 hard cutoff 없음", () => {
  it("세 앵커 지점에서 정확한 값을 반환한다", () => {
    expect(positiveAuxGate(-1)).toBeCloseTo(0.20, 5);
    expect(positiveAuxGate(0)).toBeCloseTo(0.65, 5);
    expect(positiveAuxGate(1)).toBeCloseTo(0.95, 5);
  });

  it("중간값은 두 앵커 사이를 선형 보간한다(불연속 없음)", () => {
    expect(positiveAuxGate(-0.5)).toBeCloseTo(0.425, 5); // (0.20+0.65)/2
    expect(positiveAuxGate(0.5)).toBeCloseTo(0.80, 5); // (0.65+0.95)/2
  });

  it("coreNorm=0 경계를 넘나들어도 gate 값이 점프하지 않는다(연속성)", () => {
    const justBelow = positiveAuxGate(-0.0001);
    const atZero = positiveAuxGate(0);
    const justAbove = positiveAuxGate(0.0001);
    expect(Math.abs(atZero - justBelow)).toBeLessThan(0.001);
    expect(Math.abs(justAbove - atZero)).toBeLessThan(0.001);
  });
});

describe("computeCoreAuxBreakdown: Core weight(0.35/0.35/0.30) + continuous synergy + Aux gate", () => {
  it("dm/sp/mb가 전부 최댓값(+1 정규화)이면 coreNorm은 synergy를 더해 1을 넘지 않고 정확히 1로 clamp된다", () => {
    const b = computeCoreAuxBreakdown(15, 18, 12, [0, 0, 0, 0, 0]);
    expect(b.dmNorm).toBe(1);
    expect(b.spNorm).toBe(1);
    expect(b.mbNorm).toBe(1);
    expect(b.coreBase).toBeCloseTo(1, 5); // 0.35+0.35+0.30
    expect(b.synergy).toBeCloseTo(0.05, 5); // dm,sp 둘 다 양수 최댓값 → sqrt(1*1)*0.05
    expect(b.coreNorm).toBe(1); // clamp
    expect(b.coreContribution).toBe(CORE_MAX_INFLUENCE);
  });

  it("dm/sp가 둘 다 아주 약한 양수면 synergy도 아주 작다(연속적 — 불연속 sign-only가 아님)", () => {
    const weak = computeCoreAuxBreakdown(1, 1, 0, [0, 0, 0, 0, 0]);
    const strong = computeCoreAuxBreakdown(15, 18, 0, [0, 0, 0, 0, 0]);
    expect(weak.synergy).toBeGreaterThan(0);
    expect(weak.synergy).toBeLessThan(strong.synergy);
    // 옛 sign-only 방식이었다면 둘 다 +0.05로 동일했을 것 — 강도 비례 확인.
    expect(weak.synergy).not.toBeCloseTo(0.05, 3);
  });

  it("dm/sp가 mixed(한쪽 양수·한쪽 음수)면 synergy는 0이다", () => {
    const b = computeCoreAuxBreakdown(10, -10, 0, [0, 0, 0, 0, 0]);
    expect(b.synergy).toBe(0);
  });

  it("dm/sp가 둘 다 음수면 synergy는 음수(강도 비례)다", () => {
    const b = computeCoreAuxBreakdown(-12, -18, 0, [0, 0, 0, 0, 0]);
    expect(b.synergy).toBeCloseTo(-0.05, 5); // 둘 다 -1 정규화 → sqrt(1*1)*-0.05
  });

  it("Aux positive만 있을 때: auxPosNorm×gatePos만 반영되고 auxContribution은 AUX_MAX_INFLUENCE를 넘지 않는다", () => {
    const b = computeCoreAuxBreakdown(0, 0, 0, [15, 15, 12, 12, 10]); // 전부 최댓값 = AUX_POS_MAX
    expect(b.auxPosRaw).toBe(AUX_POS_MAX);
    expect(b.auxPosNorm).toBe(1);
    expect(b.auxNegRaw).toBe(0);
    expect(b.gatePos).toBeCloseTo(0.65, 5); // coreNorm=0
    expect(b.auxContribution).toBeCloseTo(AUX_MAX_INFLUENCE * 0.65, 5);
    expect(b.auxContribution).toBeLessThanOrEqual(AUX_MAX_INFLUENCE);
  });

  it("negative Aux는 gate 없이 100% 그대로 반영된다(A안)", () => {
    const b = computeCoreAuxBreakdown(0, 0, 0, [-15, -15, -8, -8, -5]); // 전부 최솟값 = -AUX_NEG_MAX
    expect(b.auxNegRaw).toBe(-AUX_NEG_MAX);
    expect(b.auxNegNorm).toBe(1);
    expect(b.auxContribution).toBeCloseTo(-AUX_MAX_INFLUENCE, 5); // gate 없이 100%
  });

  it("핵심 요구사항: 강하게 나쁜 Core(-1)는 최대 positive Aux로도 상위권(예: 80점 이상)까지 뒤집히지 않는다", () => {
    const b = computeCoreAuxBreakdown(-12, -18, -12, [15, 15, 12, 12, 10]); // core 최악 + aux positive 최대
    const finalScore = 50 + b.coreContribution + b.auxContribution;
    expect(b.coreNorm).toBeLessThan(0);
    expect(finalScore).toBeLessThan(80);
  });

  it("Core가 중립(0)이면 coreContribution은 작고, auxContribution이 최종 변화량의 주 원인이 될 수 있다", () => {
    // 박소연↔현욱 실측 패턴 재현: dm/sp/mb가 서로 상쇄돼 coreNorm≈0에 가깝지만 aux는 크게 양수.
    const b = computeCoreAuxBreakdown(-10, 12, 4, [6, 10, 7, 1, 10]);
    expect(Math.abs(b.coreContribution)).toBeLessThan(Math.abs(b.auxContribution));
  });
});
