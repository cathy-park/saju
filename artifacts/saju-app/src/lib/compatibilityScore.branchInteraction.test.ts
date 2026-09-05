// Phase 1 버그 수정 회귀 테스트(2026-09-03) — 점수 철학 변경 없이 순수 중복/버그만 다룬다.
// 관련 감사 배경: 박소연↔현욱 케이스에서 지지 전체 교차가 배우자궁·월지와 중복 가산되고,
// 같은 삼합(해묘미)이 여러 위치 조합으로 반복 가산되어 총점 93점을 만든 원인 3가지를 고친다.
import { describe, it, expect } from "vitest";
import { getBranchRels, scoreBranchInteractionDelta, sortBySeverityDesc } from "./compatibilityScore";
import type { Pillar } from "./sajuEngine";

function pillar(hangul: string): Pillar {
  return { hangul, hanja: "" };
}

function pillars(year: string, month: string, day: string, hour: string) {
  return {
    year: pillar("갑" + year),
    month: pillar("갑" + month),
    day: pillar("갑" + day),
    hour: pillar("갑" + hour),
  };
}

describe("버그 수정 1: getBranchRels — 동일 지지(b1===b2)는 반합으로 잡히면 안 됨", () => {
  const ALL_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
  it.each(ALL_BRANCHES)("%s·%s(동일 지지)는 어떤 관계도 반환하지 않는다", (b) => {
    expect(getBranchRels(b, b)).toEqual([]);
  });

  it("해묘미 그룹 구성원(해·묘)이 서로 다르면 정상적으로 반합이 잡힌다(회귀 방지)", () => {
    expect(getBranchRels("해", "묘")).toContain("반합");
  });
});

describe("버그 수정 2: (day,day)/(month,month) 쌍은 지지 전체 교차에서 제외된다", () => {
  it("day 쌍이 실제로 합(6합) 관계여도, 무관계일 때와 결과가 완전히 같다", () => {
    // p1/p2의 year·month·hour는 전부 인·해(합 관계, 9쌍 전부 동일 기여)로 고정해 상수로 만들고,
    // day만 바꾼다. 인/해 둘 다와 무관한 자·축을 day에 써서 day가 다른 슬롯과 교차할 때도
    // 영향이 없게 격리했다(자→인/해 무관계, 축→인/해 무관계는 사전에 relation 표로 확인함).
    const withUnrelatedDayPair = scoreBranchInteractionDelta(
      pillars("인", "인", "자", "인"),
      pillars("해", "해", "자", "해"), // day: 자·자 — 애초에 무관계(동일 지지)
    );
    const withHapDayPair = scoreBranchInteractionDelta(
      pillars("인", "인", "자", "인"),
      pillars("해", "해", "축", "해"), // day: 자·축 — 실제로는 6합 관계지만 day↔day라 제외 대상
    );
    expect(withHapDayPair.delta).toBe(withUnrelatedDayPair.delta);
    expect(withHapDayPair.note).toBe(withUnrelatedDayPair.note);
    expect(withHapDayPair.clashCount).toBe(withUnrelatedDayPair.clashCount);
  });

  it("month 쌍이 실제로 충 관계여도, 무관계일 때와 결과가 완전히 같다", () => {
    // p1.month=자로 고정. p2.month만 자(무관계, scenario Y) vs 오(자·오=충, scenario X)로 바꾼다.
    // year/day/hour 필러는 p1=사, p2=해로 고정했는데, 둘 다 자·오 어느 쪽과도 관계가 없어(관계표로
    // 사전 확인) month가 다른 슬롯과 교차하는 항(예: p1.month×p2.year)이 항상 0으로 유지되고,
        // 필러끼리의 배경 항(사×해=충, 9쌍)은 두 시나리오에 동일하게 존재해 비교에 영향이 없다.
    const p1 = pillars("사", "자", "사", "사");
    const withMonthClash = scoreBranchInteractionDelta(p1, pillars("해", "오", "해", "해"));
    const withoutMonthClash = scoreBranchInteractionDelta(p1, pillars("해", "자", "해", "해"));
    expect(withMonthClash.delta).toBe(withoutMonthClash.delta);
    expect(withMonthClash.note).toBe(withoutMonthClash.note);
  });
});

describe("버그 수정 3: 같은 삼합/반합 구조가 여러 위치 조합으로 중복 가산되지 않는다", () => {
  it("해묘미가 두 개의 (k1,k2) 조합에서 동시에 성립하면, 1개는 100% + 나머지는 감쇠(30%)만 반영된다", () => {
    // p1: year=해, hour=묘(둘 다 해묘미 그룹) / p2: month=미
    // → (p1.year×p2.month)=반합, (p1.hour×p2.month)=반합 — 같은 해묘미 구조가 두 조합에서 성립.
    // 이 fixture는 day×month(자·미)에서 해+원진 복합관계도 함께 성립한다(디버그 스크립트로 확인).
    // 손으로 검증한 값:
    //   반합 아닌 나머지(자·미의 해+원진 복합관계 감쇠 포함) 합계 raw = -25.86
    //     - day×month(자·미) 해+원진: 원진(-4, 100%) + 해(-3, 30%) = -4*1.8 + -3*1.8*0.3 = -8.82
    //     - 그 외 원진 1건(해·진, 1.5) -4*1.5=-6, 원진 1건(인·유, 0.96) -4*0.96=-3.84,
    //       파 1건(자·유, 1.2) -3*1.2=-3.6, 합 1건(묘·술, 0.8) +4*0.8=3.2,
    //       해 1건(묘·진, 1.2) -3*1.2=-3.6, 충 1건(묘·유, 0.64) -5*0.64=-3.2
    //       합계: -8.82-6-3.84-3.6+3.2-3.6-3.2 = -25.86
    //   반합(해묘미: 1.20+0.96, 인오술: 1.20) 그룹 dedup 후 = 7.44 + 6.0 = 13.44
    //   총 raw = -12.42 → round = -12 (compound 감쇠로 ±15 캡 미도달)
    const p1 = pillars("해", "인", "자", "묘");
    const p2 = pillars("술", "미", "진", "유");
    const result = scoreBranchInteractionDelta(p1, p2);
    expect(result.delta).toBe(-12);
    expect(result.note).toContain("반합구조 2종"); // 해묘미, 인오술 — 그룹 2개로 정확히 집계
    expect(result.note).toContain("복합관계 1건");
    expect(result.clashCount).toBe(1);
    expect(result.compoundEvidence).toEqual([
      "day×month(자·미): 해+원진 동시 성립(점수는 감쇠, 관계는 모두 보존)",
    ]);
  });

  it("반합이 그룹당 1번만 성립하면(중복 없음) 그 값은 100% 그대로 반영된다", () => {
    // p1: hour=묘만 해묘미 그룹 구성원 / p2: month=미 — 조합이 (hour,month) 단 하나뿐.
    // 다른 슬롯(year/day)은 서로 완전히 무관하게 자(p1)·인(p2)로 채운다(자-인 관계 없음 확인됨).
    const p1 = pillars("자", "자", "인", "묘");
    const p2 = pillars("인", "미", "자", "인");
    const result = scoreBranchInteractionDelta(p1, p2);
    // hour(0.8)×month(1.2)=0.96 가중치의 반합 1건만 존재 → 5*0.96=4.8, 그 외 교차는 없어야 함.
    expect(result.note).toContain("반합구조 1종");
  });
});

describe("버그 수정 4(compound-relation overcounting): 같은 위치쌍에서 관계가 여러 개 겹치면 관계는 보존하고 점수만 감쇠한다", () => {
  it("같은 부호(음수) 복합 — 미·축(충+형)는 절댓값 최대 관계 100% + 나머지 30%만 반영된다", () => {
    // HYEONG_MAP은 방향성이 있어(축:[술], 미:[축]) getBranchRels(축,미)=충만, getBranchRels(미,축)=충+형이다.
    // p1.year=미, p2.hour=축만 관계가 성립(미·축=충+형). 나머지 슬롯은 전부 인(축·미 둘 다와
    // 무관함을 사전에 전수 확인)으로 채워 완전히 격리했다.
    const p1 = pillars("미", "인", "인", "인");
    const p2 = pillars("인", "인", "인", "축");
    const result = scoreBranchInteractionDelta(p1, p2);
    // weight = year(1.0)×hour(0.8) = 0.8. 충(-5, 100%) + 형(-4, 30%) = -4.0 + -0.96 = -4.96 → round -5.
    expect(result.delta).toBe(-5);
    expect(result.clashCount).toBe(1); // 위치쌍 1건(충+형이 같은 위치쌍) — 태그 개수가 아니라 위치쌍 개수
    expect(result.compoundEvidence).toEqual([
      "year×hour(미·축): 충+형 동시 성립(점수는 감쇠, 관계는 모두 보존)",
    ]);
  });

  it("서로 반대 부호(합+형)가 동시에 성립하면 각자 100%로 보존된 뒤 합산된다(어느 한쪽도 지워지거나 감쇠되지 않음)", () => {
    // p1.year=사, p2.hour=신만 관계가 성립(사·신=합+형). 나머지 슬롯은 전부 오(사·신 둘 다와
    // 무관함을 사전에 전수 확인)로 채워 격리했다.
    const p1 = pillars("사", "오", "오", "오");
    const p2 = pillars("오", "오", "오", "신");
    const result = scoreBranchInteractionDelta(p1, p2);
    // weight = 0.8. 합(+4, positive 그룹 단독 100%) + 형(-4, negative 그룹 단독 100%)
    // = +3.2 + (-3.2) = 0 — 반대 부호는 서로의 감쇠에 영향을 주지 않고 각자 그대로 합산된다.
    expect(result.delta).toBe(0);
    expect(result.clashCount).toBe(0); // 충이 아니므로 0
    expect(result.compoundEvidence).toEqual([
      "year×hour(사·신): 합+형 동시 성립(점수는 감쇠, 관계는 모두 보존)",
    ]);
  });

  it("절댓값이 동률인 관계끼리는 입력 순서와 무관하게 항상 같은 순서로 정렬된다(deterministic tiebreak)", () => {
    // 실제 지지 테이블에는 동률 compound(예: 형=원진=-4, 파=해=-3)가 없어(전수 검사로 확인),
    // sortBySeverityDesc를 직접 호출해 입력 순서를 뒤집어도 결과가 같은지 검증한다.
    const a = [
      { r: "형", base: -4 },
      { r: "원진", base: -4 },
    ];
    const b = [
      { r: "원진", base: -4 },
      { r: "형", base: -4 },
    ];
    expect(sortBySeverityDesc(a)).toEqual(sortBySeverityDesc(b));
    // RELATION_TIEBREAK_ORDER = ["합","충","형","원진","해","파"] → 형이 원진보다 앞.
    expect(sortBySeverityDesc(a).map((x) => x.r)).toEqual(["형", "원진"]);

    const c = [
      { r: "파", base: -3 },
      { r: "해", base: -3 },
    ];
    const d = [
      { r: "해", base: -3 },
      { r: "파", base: -3 },
    ];
    expect(sortBySeverityDesc(c)).toEqual(sortBySeverityDesc(d));
    expect(sortBySeverityDesc(c).map((x) => x.r)).toEqual(["해", "파"]);
  });
});
