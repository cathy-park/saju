// Solar return — 대표 지시로 서양점성술 복사 원자료에 추가. transit Sun이 natal Sun의 황경과
// 정확히 일치하는 순간을 찾아(0.9856°/일의 선형 근사로 먼저 근접시킨 뒤 이분법으로 정밀화 —
// transit/timeline.ts의 refineRoot와 동일한 부호변화 이분법 기법), 그 순간의 행성 위치·aspect만
// 계산한다. ASC/MC/12 하우스는 "기준 지역"이 명시적으로 주어졌을 때만 계산하고, 출생지를
// 대신 쓰지 않는다(대표 지시) — 기준 지역이 없으면 location/angles/houses를 모두 비워 둔다.
import { calculateAngles, calculatePlanet, norm360 } from "./astronomy.js";
import { calculateMajorAspects } from "./aspects.js";
import { calculatePlacidusCusps, houseForLongitude } from "./houses.js";
import { TRANSIT_ASPECTS, TRANSIT_ORBS } from "./transit/rules.js";
import type { AspectType, PlanetId, WesternAspect, WesternNatalChart } from "./types.js";

const PLANETS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const DAY_MS = 86_400_000;
const SECOND_MS = 1_000;
/** 태양의 평균 겉보기 운동. 정밀 계산이 아니라 이분법 브래킷을 좁히기 위한 1차 근사치일 뿐 —
 * 최종 정확도는 뒤의 이분법이 보장한다. */
const SUN_DEGREES_PER_DAY = 360 / 365.2422;
const signedDelta = (a: number, b: number): number => { const delta = norm360(a - b); return delta > 180 ? delta - 360 : delta; };
const separation = (a: number, b: number): number => { const delta = norm360(b - a); return delta > 180 ? 360 - delta : delta; };
const round = (value: number, places = 8) => Number(value.toFixed(places));

export interface SolarReturnLocation { latitude: number; longitude: number; timezone: string; placeLabel?: string }
/** house는 "기준 지역"이 있어(하우스 계산이 가능해) location/angles/houses가 채워졌을 때만
 * 값이 들어간다 — 기준 지역이 없으면 다른 필드처럼 undefined로 비워 둔다(추측하지 않음). */
export interface SolarReturnPoint { id: PlanetId; longitude: number; speedLongitude: number; retrograde: boolean; house?: number }
/** 솔라리턴 행성 → natal 행성 aspect. 두 값 모두 "특정 시점의 고정된 위치"라는 점에서
 * progressions.ts의 progressed↔natal과 같은 성격이라 같은 orb 표(TRANSIT_ORBS/TRANSIT_ASPECTS)를
 * 그대로 쓴다. 기준 지역과 무관하게(행성 좌표만 있으면) 항상 계산된다. */
export interface SolarReturnNatalAspect { returnPointId: PlanetId; natalPointId: PlanetId; type: AspectType; orb: number; allowedOrb: number }
export interface SolarReturnChart {
  year: number;
  exactUtcInstant: string;
  points: SolarReturnPoint[];
  aspects: WesternAspect[];
  natalAspects: SolarReturnNatalAspect[];
  location: SolarReturnLocation | null;
  angles: { ascendant: number; midheaven: number } | null;
  houses: { number: number; cuspLongitude: number }[] | null;
}

function findExactReturnInstant(natalSunLongitude: number, seedUtcMs: number): number {
  const diffAt = (ms: number) => signedDelta(calculatePlanet("sun", new Date(ms)).longitude, natalSunLongitude);
  // 1차 선형 보정 — seed가 실제 생일과 며칠 어긋나 있어도(윤년 누적 오차 포함) 하루 이내로
  // 좁혀준다. 이후 이분법이 초 단위까지 정밀화한다.
  const corrected = seedUtcMs - (diffAt(seedUtcMs) / SUN_DEGREES_PER_DAY) * DAY_MS;
  let left = corrected - 2 * DAY_MS, right = corrected + 2 * DAY_MS;
  let leftValue = diffAt(left);
  for (let index = 0; index < 60 && right - left > SECOND_MS; index++) {
    const middle = (left + right) / 2, middleValue = diffAt(middle);
    if ((leftValue <= 0 && middleValue >= 0) || (leftValue >= 0 && middleValue <= 0)) right = middle;
    else { left = middle; leftValue = middleValue; }
  }
  return Math.round((left + right) / 2 / SECOND_MS) * SECOND_MS;
}

export function calculateSolarReturn(chart: WesternNatalChart, year: number, location?: SolarReturnLocation): SolarReturnChart {
  const natalSun = chart.points.find((point) => point.id === "sun")!.longitude;
  const birthDate = new Date(chart.normalizedBirth.utcInstant);
  const seed = Date.UTC(year, birthDate.getUTCMonth(), birthDate.getUTCDate(), birthDate.getUTCHours(), birthDate.getUTCMinutes(), birthDate.getUTCSeconds());
  const exactMs = findExactReturnInstant(natalSun, seed);
  const exactDate = new Date(exactMs);

  const points: SolarReturnPoint[] = PLANETS.map((id) => {
    const calculated = calculatePlanet(id, exactDate);
    return { id, longitude: calculated.longitude, speedLongitude: calculated.speedLongitude, retrograde: calculated.speedLongitude < 0 };
  });
  const aspects = calculateMajorAspects(points);

  // 솔라리턴 행성 → natal 행성 aspect (기준 지역과 무관하게 항상 계산 — progressions.ts의
  // progressed↔natal과 동일한 방식).
  const natalAspects: SolarReturnNatalAspect[] = [];
  for (const returnPoint of points) {
    for (const natal of chart.points) {
      for (const [type, angle] of Object.entries(TRANSIT_ASPECTS) as [AspectType, number][]) {
        const orb = Math.abs(separation(returnPoint.longitude, natal.longitude) - angle);
        const allowedOrb = TRANSIT_ORBS[returnPoint.id];
        if (orb <= allowedOrb) natalAspects.push({ returnPointId: returnPoint.id, natalPointId: natal.id as PlanetId, type, orb: round(orb), allowedOrb });
      }
    }
  }

  if (!location) return { year, exactUtcInstant: exactDate.toISOString(), points, aspects, natalAspects, location: null, angles: null, houses: null };

  const angleResult = calculateAngles(exactDate, location.latitude, location.longitude);
  const cusps = calculatePlacidusCusps(angleResult.ascendant, angleResult.midheaven, location.latitude, angleResult.obliquity);
  if (!cusps) return { year, exactUtcInstant: exactDate.toISOString(), points, aspects, natalAspects, location, angles: null, houses: null };
  const pointsWithHouse = points.map((point) => ({ ...point, house: houseForLongitude(point.longitude, cusps) }));
  return {
    year, exactUtcInstant: exactDate.toISOString(), points: pointsWithHouse, aspects, natalAspects, location,
    angles: { ascendant: angleResult.ascendant, midheaven: angleResult.midheaven },
    houses: cusps.map((cuspLongitude, index) => ({ number: index + 1, cuspLongitude })),
  };
}
