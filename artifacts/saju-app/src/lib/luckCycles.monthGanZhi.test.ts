// getMonthGanZhi 1월(축월) 버그 회귀 테스트 — 축월이 그 해 인월 기준으로 "11칸 앞"이
// 아니라 직전 명리년(year-1) 표를 써야 2월(인월)과 정상 연결되는지 검증한다.
import { describe, it, expect } from "vitest";
import { getMonthGanZhi } from "./luckCycles";

const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];

function stemIdx(stem: string): number {
  return STEMS.indexOf(stem);
}

describe("getMonthGanZhi: 2026년 1~12월", () => {
  const expected: Record<number, string> = {
    1: "기축", 2: "경인", 3: "신묘", 4: "임진", 5: "계사", 6: "갑오",
    7: "을미", 8: "병신", 9: "정유", 10: "무술", 11: "기해", 12: "경자",
  };

  for (const [m, hangul] of Object.entries(expected)) {
    it(`${m}월 = ${hangul}`, () => {
      expect(getMonthGanZhi(2026, Number(m)).hangul).toBe(hangul);
    });
  }

  it("9~12월은 이전 감사에서 보고된 값과 동일하게 유지된다(정유·무술·기해·경자)", () => {
    expect(getMonthGanZhi(2026, 9).hangul).toBe("정유");
    expect(getMonthGanZhi(2026, 10).hangul).toBe("무술");
    expect(getMonthGanZhi(2026, 11).hangul).toBe("기해");
    expect(getMonthGanZhi(2026, 12).hangul).toBe("경자");
  });

  it("1~12월 천간이 한 단계씩 순행한다(1→2월 포함)", () => {
    const hanguls = Array.from({ length: 12 }, (_, i) => getMonthGanZhi(2026, i + 1));
    for (let i = 1; i < hanguls.length; i++) {
      const prev = stemIdx(hanguls[i - 1].stem);
      const cur = stemIdx(hanguls[i].stem);
      expect((cur - prev + 10) % 10).toBe(1);
    }
  });
});

describe("getMonthGanZhi: 60년 범위 회귀(1980~2040)", () => {
  for (let year = 1980; year <= 2040; year++) {
    it(`${year}년 1월 지지=축, 2월 지지=인, 1→2월 천간 순행`, () => {
      const jan = getMonthGanZhi(year, 1);
      const feb = getMonthGanZhi(year, 2);
      expect(jan.branch).toBe("축");
      expect(feb.branch).toBe("인");
      expect((stemIdx(feb.stem) - stemIdx(jan.stem) + 10) % 10).toBe(1);
    });
  }

  it("연도가 바뀌어도 2~12월 사이의 천간은 항상 한 단계씩 순행한다(1980~2040 전수)", () => {
    for (let year = 1980; year <= 2040; year++) {
      for (let m = 2; m < 12; m++) {
        const a = getMonthGanZhi(year, m);
        const b = getMonthGanZhi(year, m + 1);
        expect((stemIdx(b.stem) - stemIdx(a.stem) + 10) % 10).toBe(1);
      }
    }
  });

  it("한 해의 12월과 다음 해의 1월도 60갑자 상 정상 연속이다(경계 교차 검증)", () => {
    for (let year = 1980; year <= 2039; year++) {
      const dec = getMonthGanZhi(year, 12);
      const nextJan = getMonthGanZhi(year + 1, 1);
      expect((stemIdx(nextJan.stem) - stemIdx(dec.stem) + 10) % 10).toBe(1);
    }
  });
});

describe("getMonthGanZhi: 2~12월 기존 계산값 불변(수정 전후 동일해야 함)", () => {
  // 수정 전 코드(연도 보정 없음)로도 동일하게 나오던 값 — 2~12월은 stemTableYear가
  // year 그대로이므로 이번 수정으로 절대 바뀌면 안 된다. 여러 연도에서 고정 스냅샷으로 고정.
  const snapshots: [number, number, string][] = [
    [2024, 2, "병인"], [2024, 6, "경오"], [2024, 12, "병자"],
    [2025, 2, "무인"], [2025, 9, "을유"], [2025, 12, "무자"],
    [2026, 2, "경인"], [2026, 5, "계사"], [2026, 12, "경자"],
    [2027, 2, "임인"], [2027, 7, "정미"], [2027, 12, "임자"],
  ];
  for (const [year, month, hangul] of snapshots) {
    it(`${year}-${month} = ${hangul}`, () => {
      expect(getMonthGanZhi(year, month).hangul).toBe(hangul);
    });
  }
});

describe("getMonthGanZhi: 입력 범위 유지", () => {
  it("solarMonth 1~12 전부 유효한 GanZhi를 반환한다", () => {
    for (let m = 1; m <= 12; m++) {
      const gz = getMonthGanZhi(2026, m);
      expect(gz.stem).toBeTruthy();
      expect(gz.branch).toBeTruthy();
      expect(gz.hangul.length).toBe(2);
    }
  });

  it("동일 입력에 대해 결정적(deterministic)이다", () => {
    expect(getMonthGanZhi(2026, 1)).toEqual(getMonthGanZhi(2026, 1));
  });
});
