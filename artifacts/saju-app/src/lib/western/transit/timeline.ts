import { calculatePlanet, norm360 } from "../astronomy.js";
import { houseForLongitude } from "../houses.js";
import { resolveLocalDateTime } from "../time.js";
import type { AspectType, PlanetId, WesternNatalChart } from "../types.js";
import { STEP_MINUTES, TRANSIT_ASPECTS, TRANSIT_ORBS, TRANSIT_PLANETS, TRANSIT_ROLE } from "./rules.js";
import type { NormalizedTransitQuery, TransitActivation, TransitEvent, TransitPoint, TransitQuery, TransitSnapshot, TransitTargetId, TransitTimeline } from "./types.js";

const MINUTE = 60_000;
const SECOND = 1_000;
const DAY = 86_400_000;
const TARGET_ASPECTS = Object.entries(TRANSIT_ASPECTS) as [AspectType, number][];
const round = (value: number, places = 8) => Number(value.toFixed(places));
const separation = (a: number, b: number) => { const delta = norm360(b - a); return delta > 180 ? 360 - delta : delta; };
const orbAt = (transitLongitude: number, natalLongitude: number, exactAngle: number) => Math.abs(separation(transitLongitude, natalLongitude) - exactAngle);
const signed180 = (degrees: number) => { const value = norm360(degrees + 180) - 180; return value === -180 ? 180 : value; };
const orientations = (angle: number) => angle === 0 ? [0] : angle === 180 ? [180] : [angle, -angle];
const isoSecond = (milliseconds: number) => new Date(Math.round(milliseconds / SECOND) * SECOND).toISOString();
function addLocalDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function resolveBoundary(chart: WesternNatalChart, localDateTime: string, timezone: string): number {
  return Date.parse(resolveLocalDateTime({ localDateTime, timezone, latitude: chart.normalizedBirth.latitude, longitude: chart.normalizedBirth.longitude }).utcInstant);
}

function normalizeQuery(chart: WesternNatalChart, query: TransitQuery): NormalizedTransitQuery {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.startLocalDate) || !/^\d{4}-\d{2}-\d{2}$/.test(query.endLocalDate) || query.endLocalDate < query.startLocalDate) throw new Error("INVALID_TRANSIT_RANGE");
  const start = resolveBoundary(chart, `${query.startLocalDate}T00:00:00`, query.timezone);
  const end = resolveBoundary(chart, `${addLocalDays(query.endLocalDate, 1)}T00:00:00`, query.timezone);
  const reference = query.referenceLocalDateTime ? resolveBoundary(chart, query.referenceLocalDateTime, query.timezone) : start + (end - start) / 2;
  return { ...query, startUtcInstant: new Date(start).toISOString(), endUtcInstant: new Date(end).toISOString(), referenceUtcInstant: new Date(Math.min(Math.max(reference, start), end - 1)).toISOString() };
}

function natalTargets(chart: WesternNatalChart): { id: TransitTargetId; longitude: number }[] {
  return [...chart.points.map((point) => ({ id: point.id as PlanetId, longitude: point.longitude })), { id: "ascendant" as const, longitude: chart.angles.ascendant.longitude }, { id: "midheaven" as const, longitude: chart.angles.midheaven.longitude }];
}

function pointAt(id: PlanetId, milliseconds: number, chart: WesternNatalChart, cache: Map<string, TransitPoint>): TransitPoint {
  const key = `${id}:${milliseconds}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const calculated = calculatePlanet(id, new Date(milliseconds));
  const point = { id, longitude: calculated.longitude, speedLongitude: calculated.speedLongitude, retrograde: calculated.speedLongitude < 0, natalHouse: houseForLongitude(calculated.longitude, chart.houses.map((house) => house.cuspLongitude)) };
  cache.set(key, point);
  return point;
}

function applyingAt(id: PlanetId, time: number, natalLongitude: number, angle: number, chart: WesternNatalChart, cache: Map<string, TransitPoint>): boolean {
  const current = orbAt(pointAt(id, time, chart, cache).longitude, natalLongitude, angle);
  const future = orbAt(pointAt(id, time + MINUTE, chart, cache).longitude, natalLongitude, angle);
  return future < current;
}

function refineBoundary(active: (time: number) => boolean, left: number, right: number, entering: boolean): number {
  for (let index = 0; index < 40 && right - left > SECOND; index++) {
    const middle = (left + right) / 2;
    if (active(middle) === entering) right = middle; else left = middle;
  }
  return entering ? right : left;
}

function extendBoundary(active: (time: number) => boolean, from: number, direction: -1 | 1, step: number): number {
  let activeTime = from;
  let inactiveTime = from;
  const maximumSteps = Math.ceil((2_500 * DAY) / step);
  for (let index = 0; index < maximumSteps; index++) {
    inactiveTime += direction * step;
    if (!active(inactiveTime)) break;
    activeTime = inactiveTime;
  }
  return direction < 0 ? refineBoundary(active, inactiveTime, activeTime, true) : refineBoundary(active, activeTime, inactiveTime, false);
}

function refineRoot(value: (time: number) => number, left: number, right: number): number {
  let leftValue = value(left);
  for (let index = 0; index < 50 && right - left > SECOND; index++) {
    const middle = (left + right) / 2, middleValue = value(middle);
    if ((leftValue <= 0 && middleValue >= 0) || (leftValue >= 0 && middleValue <= 0)) right = middle;
    else { left = middle; leftValue = middleValue; }
  }
  return (left + right) / 2;
}

function exactHits(id: PlanetId, natalLongitude: number, angle: number, start: number, end: number, step: number, chart: WesternNatalChart, cache: Map<string, TransitPoint>): string[] {
  const hits: number[] = [];
  for (const orientation of orientations(angle)) {
    const value = (time: number) => signed180(pointAt(id, time, chart, cache).longitude - natalLongitude - orientation);
    let previousTime = start, previousValue = value(start);
    for (let time = Math.min(start + step, end); time <= end; time = Math.min(time + step, end)) {
      const currentValue = value(time);
      if (Math.abs(currentValue) < 1e-9 || ((previousValue < 0 && currentValue > 0) || (previousValue > 0 && currentValue < 0)) && Math.abs(currentValue - previousValue) < 30) hits.push(refineRoot(value, previousTime, time));
      if (time === end) break;
      previousTime = time; previousValue = currentValue;
    }
  }
  return [...new Set(hits.sort((a, b) => a - b).map((hit) => isoSecond(hit)))];
}

function eventId(id: PlanetId, target: TransitTargetId, type: AspectType, windowStart: number): string {
  return `transit:${id}:${target}:${type}:${isoSecond(windowStart)}`;
}

export function calculateTransitSnapshot(chart: WesternNatalChart, localDateTime: string, timezone: string): TransitSnapshot {
  const utcInstant = resolveLocalDateTime({ localDateTime, timezone, latitude: chart.normalizedBirth.latitude, longitude: chart.normalizedBirth.longitude }).utcInstant;
  const time = Date.parse(utcInstant), cache = new Map<string, TransitPoint>();
  const points = TRANSIT_PLANETS.map((id) => pointAt(id, time, chart, cache));
  const activations: TransitActivation[] = [];
  for (const transit of points) for (const target of natalTargets(chart)) for (const [type, angle] of TARGET_ASPECTS) {
    const orb = orbAt(transit.longitude, target.longitude, angle), allowedOrb = TRANSIT_ORBS[transit.id];
    if (orb <= allowedOrb) activations.push({ transitPointId: transit.id, natalTargetId: target.id, type, orb: round(orb), allowedOrb, applying: applyingAt(transit.id, time, target.longitude, angle, chart, cache), role: TRANSIT_ROLE[transit.id] });
  }
  return { localDateTime, timezone, utcInstant, points, activations };
}

export function calculateTransitTimeline(chart: WesternNatalChart, queryInput: TransitQuery): TransitTimeline {
  const query = normalizeQuery(chart, queryInput), start = Date.parse(query.startUtcInstant), end = Date.parse(query.endUtcInstant), reference = Date.parse(query.referenceUtcInstant);
  const cache = new Map<string, TransitPoint>(), events: TransitEvent[] = [];
  for (const id of TRANSIT_PLANETS) {
    const step = STEP_MINUTES[id] * MINUTE, allowedOrb = TRANSIT_ORBS[id];
    for (const target of natalTargets(chart)) for (const [type, angle] of TARGET_ASPECTS) {
      const active = (time: number) => orbAt(pointAt(id, time, chart, cache).longitude, target.longitude, angle) <= allowedOrb;
      const segments: [number, number][] = [];
      let segmentStart: number | null = active(start) ? extendBoundary(active, start, -1, step) : null;
      let previousTime = start, previousActive = active(start);
      for (let time = Math.min(start + step, end); time <= end; time = Math.min(time + step, end)) {
        const currentActive = active(time);
        if (!previousActive && currentActive) segmentStart = refineBoundary(active, previousTime, time, true);
        if (previousActive && !currentActive && segmentStart !== null) { segments.push([segmentStart, refineBoundary(active, previousTime, time, false)]); segmentStart = null; }
        if (time === end) break;
        previousTime = time; previousActive = currentActive;
      }
      if (segmentStart !== null) segments.push([segmentStart, extendBoundary(active, end, 1, step)]);
      for (const [windowStart, windowEnd] of segments) {
        const hits = exactHits(id, target.longitude, angle, windowStart, windowEnd, step, chart, cache);
        const hitInsideQuery = hits.map(Date.parse).find((hit) => hit >= start && hit < end);
        const overlapStart = Math.max(windowStart, start), overlapEnd = Math.min(windowEnd, end);
        const stateTime = reference >= windowStart && reference < windowEnd ? reference : hitInsideQuery ?? overlapStart + (overlapEnd - overlapStart) / 2;
        const transit = pointAt(id, stateTime, chart, cache), orb = orbAt(transit.longitude, target.longitude, angle);
        events.push({ id: eventId(id, target.id, type, windowStart), transitPointId: id, natalTargetId: target.id, type, orb: round(orb), allowedOrb, applying: applyingAt(id, stateTime, target.longitude, angle, chart, cache), role: TRANSIT_ROLE[id], natalHouse: transit.natalHouse, windowStart: isoSecond(windowStart), exactHits: hits, windowEnd: isoSecond(windowEnd), activeAtQueryStart: windowStart < start && windowEnd > start, activeAfterQueryEnd: windowStart < end && windowEnd > end, phase: orb <= allowedOrb * 0.2 ? "exact" : orb <= allowedOrb * 0.6 ? "close" : "active", referenceUtcInstant: new Date(stateTime).toISOString(), transitLongitude: round(transit.longitude), natalLongitude: round(target.longitude) });
      }
    }
  }
  return { schemaVersion: "western-transit/v1", engine: chart.engine, natalChart: chart, query, events: events.sort((a, b) => a.windowStart.localeCompare(b.windowStart) || a.id.localeCompare(b.id)), warnings: [] };
}
