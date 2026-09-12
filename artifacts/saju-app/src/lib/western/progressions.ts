// Secondary progressions ("1 day = 1 year") — 대표 지시로 서양점성술 복사 원자료에 추가.
// 새 천체력 코드를 만들지 않고 natalChart.ts/astronomy.ts가 이미 쓰는 calculatePlanet만
// 재사용한다: progressed 시각(출생 시각 + 경과 나이만큼의 "일수")의 행성 위치를 그대로 계산할
// 뿐, 해석 문장은 만들지 않는다. progressed 궁/하우스는 요청 범위에 없어 계산하지 않는다
// (진행 ASC/MC 산출 방식은 유파마다 갈려 임의로 하나를 고르지 않기 위함).
import { calculatePlanet, norm360 } from "./astronomy.js";
import { calculateMajorAspects } from "./aspects.js";
import { TRANSIT_ASPECTS, TRANSIT_ORBS } from "./transit/rules.js";
import type { AspectType, PlanetId, WesternNatalChart } from "./types.js";

const PROGRESSED_PLANETS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
/** 회귀년(tropical year) — "하루=1년" 환산에 쓴다. 365.25(율리우스년)가 아니라 실제 태양
 * 회귀 주기를 써야 진행 태양이 자연연도의 생일과 어긋나지 않는다. */
const TROPICAL_YEAR_DAYS = 365.2422;
const DAY_MS = 86_400_000;
const separation = (a: number, b: number): number => { const delta = norm360(b - a); return delta > 180 ? 360 - delta : delta; };
const round = (value: number, places = 8) => Number(value.toFixed(places));

export interface ProgressedPoint { id: PlanetId; longitude: number; speedLongitude: number; retrograde: boolean }
export interface ProgressedNatalAspect { progressedPointId: PlanetId; natalPointId: PlanetId; type: AspectType; orb: number; allowedOrb: number }
export interface ProgressedMutualAspect { point1Id: PlanetId; point2Id: PlanetId; type: AspectType; orb: number; allowedOrb: number; separation: number }
export interface SecondaryProgressions {
  /** "기준일" — 이 진행 차트가 어느 시점 기준인지(보통 지금). */
  referenceUtcInstant: string;
  /** 실제로 행성 위치를 계산한 진행 시각(출생시각 + 경과연수만큼의 일수). */
  progressedUtcInstant: string;
  ageYears: number;
  points: ProgressedPoint[];
  natalAspects: ProgressedNatalAspect[];
  mutualAspects: ProgressedMutualAspect[];
}

export function calculateSecondaryProgressions(chart: WesternNatalChart, referenceInstant: Date = new Date()): SecondaryProgressions {
  const birthMs = Date.parse(chart.normalizedBirth.utcInstant);
  const ageYears = (referenceInstant.getTime() - birthMs) / (TROPICAL_YEAR_DAYS * DAY_MS);
  const progressedMs = birthMs + ageYears * DAY_MS;
  const progressedDate = new Date(progressedMs);

  const points: ProgressedPoint[] = PROGRESSED_PLANETS.map((id) => {
    const calculated = calculatePlanet(id, progressedDate);
    return { id, longitude: calculated.longitude, speedLongitude: calculated.speedLongitude, retrograde: calculated.speedLongitude < 0 };
  });

  // progressed ↔ natal: 두 값 모두 "특정 시점의 고정된 위치"라는 점에서 transit↔natal과 같은
  // 성격이라, transit이 이미 쓰는 행성별 orb 표(TRANSIT_ORBS/TRANSIT_ASPECTS)를 그대로 쓴다.
  const natalAspects: ProgressedNatalAspect[] = [];
  for (const progressed of points) {
    for (const natal of chart.points) {
      for (const [type, angle] of Object.entries(TRANSIT_ASPECTS) as [AspectType, number][]) {
        const orb = Math.abs(separation(progressed.longitude, natal.longitude) - angle);
        const allowedOrb = TRANSIT_ORBS[progressed.id];
        if (orb <= allowedOrb) natalAspects.push({ progressedPointId: progressed.id, natalPointId: natal.id as PlanetId, type, orb: round(orb), allowedOrb });
      }
    }
  }

  // progressed ↔ progressed: natal 차트 내부 aspect와 같은 성격(둘 다 "한 시점의 배치")이라
  // calculateMajorAspects를 그대로 재사용한다.
  const mutualAspects: ProgressedMutualAspect[] = calculateMajorAspects(points).map((aspect) => ({
    point1Id: aspect.point1Id as PlanetId, point2Id: aspect.point2Id as PlanetId, type: aspect.type, orb: aspect.orb, allowedOrb: aspect.allowedOrb, separation: aspect.separation,
  }));

  return { referenceUtcInstant: referenceInstant.toISOString(), progressedUtcInstant: progressedDate.toISOString(), ageYears: round(ageYears, 4), points, natalAspects, mutualAspects };
}
