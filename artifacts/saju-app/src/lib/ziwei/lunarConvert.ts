// 양력→음력/간지 변환. @fullstackfamily/manseryeok(기존 프로젝트에 이미 설치돼 있고 sajuEngine.ts가
// 쓰는 것과 동일 라이브러리)를 얇게 감싸기만 한다 — 이 파일이 sajuEngine.ts를 import하지는 않는다
// (라이브러리만 공유, 사주 엔진 코드/상태는 전혀 공유하지 않음). 1989-02-16 실행 결과가
// 己巳年丙寅月丁未日/음력 1989-01-11로, windada.com 실계산 결과와 정확히 일치함을 확인했다
// (2026-09-07, ruleSets/zhongzhouV1.ts 주석 참고).
import { solarToLunar, lunarToSolar } from "@fullstackfamily/manseryeok";
import { BRANCHES, STEMS, type Branch, type LunarBirth, type Stem } from "./types";

/** 0~23시를 12지지 시진(2시간 단위, 23:00~00:59=子)으로 변환. */
export function hourToBranch(hour: number): Branch {
  const h = ((hour % 24) + 24) % 24;
  const index = Math.floor(((h + 1) % 24) / 2); // 23,0→子(0) ... 21,22→亥(11)
  return BRANCHES[index];
}

function hanjaToStem(hanja: string): Stem {
  const s = hanja[0] as Stem;
  if (!STEMS.includes(s)) throw new Error(`알 수 없는 천간: ${hanja}`);
  return s;
}
function hanjaToBranch(hanja: string): Branch {
  const b = hanja[1] as Branch;
  if (!BRANCHES.includes(b)) throw new Error(`알 수 없는 지지: ${hanja}`);
  return b;
}

export function toLunarBirth(
  calendarType: "solar" | "lunar",
  year: number,
  month: number,
  day: number,
  hour: number,
  isLeapMonth = false,
): LunarBirth {
  const result =
    calendarType === "solar"
      ? solarToLunar(year, month, day)
      : (() => {
          const r = lunarToSolar(year, month, day, isLeapMonth);
          // lunarToSolar는 solar/gapja를 반환하지만 lunar 필드 형태를 맞추기 위해 재구성한다.
          return { lunar: { year, month, day, isLeapMonth }, gapja: r.gapja };
        })();

  return {
    year: result.lunar.year,
    month: result.lunar.month,
    day: result.lunar.day,
    isLeapMonth: result.lunar.isLeapMonth,
    hourBranch: hourToBranch(hour),
    yearStem: hanjaToStem(result.gapja.yearPillarHanja),
    yearBranch: hanjaToBranch(result.gapja.yearPillarHanja),
  };
}
