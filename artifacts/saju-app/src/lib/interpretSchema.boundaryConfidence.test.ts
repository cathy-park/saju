// 2단계 용신 hard-cliff 완충(buffer=±0.2) 회귀 테스트.
// 경계 밖(거리>=0.2)에서는 confidence가 반드시 1(기존과 bit-identical)이어야 하고,
// 경계 안에서는 0.5(경계 정확히 위) ~ 1(경계에서 0.2만큼 떨어진 지점) 사이에서
// 선형·연속적으로 움직여야 한다.
import { describe, it, expect } from "vitest";
import { computeStrengthBoundaryConfidence, YONGSHIN_STRENGTH_BUFFER } from "./interpretSchema";

const BOUNDARIES = [-5, -3, -1.5, 1, 3, 5];

describe("computeStrengthBoundaryConfidence: 6개 경계 × ±0.01/±0.19/±0.21 회귀", () => {
  it("buffer 상수는 0.2다", () => {
    expect(YONGSHIN_STRENGTH_BUFFER).toBe(0.2);
  });

  for (const b of BOUNDARIES) {
    describe(`경계 ${b}`, () => {
      it(`±0.21(버퍼 밖)에서는 confidence=1(기존과 완전히 동일)`, () => {
        expect(computeStrengthBoundaryConfidence(b - 0.21).confidence).toBe(1);
        expect(computeStrengthBoundaryConfidence(b + 0.21).confidence).toBe(1);
      });

      it(`±0.19(버퍼 안, 경계에 아주 가까움)에서는 confidence가 1 미만이고 0.5보다 크다`, () => {
        const below = computeStrengthBoundaryConfidence(b - 0.19);
        const above = computeStrengthBoundaryConfidence(b + 0.19);
        expect(below.confidence).toBeLessThan(1);
        expect(below.confidence).toBeGreaterThan(0.5);
        expect(above.confidence).toBeLessThan(1);
        expect(above.confidence).toBeGreaterThan(0.5);
        // 0.19/0.2 = 0.95 → confidence = 0.5+0.5*0.95 = 0.975
        expect(below.confidence).toBeCloseTo(0.975, 5);
        expect(above.confidence).toBeCloseTo(0.975, 5);
      });

      it(`±0.01(경계 바로 옆)에서는 confidence가 0.5에 아주 가깝다`, () => {
        const below = computeStrengthBoundaryConfidence(b - 0.01);
        const above = computeStrengthBoundaryConfidence(b + 0.01);
        // 0.01/0.2 = 0.05 → confidence = 0.5+0.5*0.05 = 0.525
        expect(below.confidence).toBeCloseTo(0.525, 5);
        expect(above.confidence).toBeCloseTo(0.525, 5);
      });

      it(`경계(distance=0)에서는 confidence가 정확히 0.5다`, () => {
        expect(computeStrengthBoundaryConfidence(b).confidence).toBeCloseTo(0.5, 10);
      });

      it(`0.21 → 0.19 → 0.01 → 0(경계) → -0.01 → ... 로 갈수록 confidence가 단조 감소한다(연속성)`, () => {
        const offsets = [0.25, 0.21, 0.19, 0.1, 0.05, 0.01, 0];
        const confidences = offsets.map((o) => computeStrengthBoundaryConfidence(b + o).confidence);
        for (let i = 1; i < confidences.length; i++) {
          expect(confidences[i]).toBeLessThanOrEqual(confidences[i - 1] + 1e-9);
        }
      });

      it("0.02 스텝 연속성: 경계 양쪽 confidence 차이가 작다(hard-cliff 없음)", () => {
        const justBelow = computeStrengthBoundaryConfidence(b - 0.01).confidence;
        const justAbove = computeStrengthBoundaryConfidence(b + 0.01).confidence;
        expect(Math.abs(justAbove - justBelow)).toBeLessThan(0.01);
      });
    });
  }

  it("buffer=0을 넘겨주면 완전히 비활성화된다(confidence 항상 1)", () => {
    for (const b of BOUNDARIES) {
      expect(computeStrengthBoundaryConfidence(b, 0).confidence).toBe(1);
      expect(computeStrengthBoundaryConfidence(b + 0.001, 0).confidence).toBe(1);
    }
  });

  it("경계에서 아주 멀리 떨어진 임의 점수는 항상 confidence=1이다", () => {
    for (const s of [-20, -10, -6.5, -4, -0.2, 0, 0.4, 2, 4, 10, 20]) {
      // 각 s가 실제로 모든 경계에서 0.2 이상 떨어져 있는지 확인 후 검증
      const minDist = Math.min(...BOUNDARIES.map((b) => Math.abs(s - b)));
      if (minDist >= 0.2) {
        expect(computeStrengthBoundaryConfidence(s).confidence).toBe(1);
      }
    }
  });
});
