import { norm360 } from "../astronomy.js";
import { houseForLongitude } from "../houses.js";
import type { AspectType, PlanetId } from "../types.js";
import { RELEVANT_OVERLAY_HOUSES, SYNASTRY_ASPECTS, resolveSynastryOrb, synastryOrbBand } from "./rules.js";
import type { AngleAspectEvidence, CrossAspectEvidence, HouseOverlayEvidence, SynastryAngleId, SynastryEvidenceSet, SynastrySubject } from "./types.js";

const round = (value: number) => Number(value.toFixed(8));
const separation = (a: number, b: number) => { const delta = norm360(b - a); return delta > 180 ? 360 - delta : delta; };
export const canonicalPairId = (a: string, b: string) => [a, b].sort().join("~");
const aspectEntries = Object.entries(SYNASTRY_ASPECTS) as [AspectType, number][];
const crossId = (pairId: string, a: { personId: string; pointId: PlanetId }, b: { personId: string; pointId: PlanetId }, type: AspectType) => {
  const refs = [a, b].sort((left, right) => left.personId.localeCompare(right.personId) || left.pointId.localeCompare(right.pointId));
  return `synastry:${pairId}:cross:${refs[0].personId}.${refs[0].pointId}~${refs[1].personId}.${refs[1].pointId}:${type}`;
};
function angles(subject: SynastrySubject): Record<SynastryAngleId, number> {
  return { ascendant: subject.chart.angles.ascendant.longitude, descendant: norm360(subject.chart.angles.ascendant.longitude + 180), midheaven: subject.chart.angles.midheaven.longitude };
}

export function calculateSynastryEvidence(first: SynastrySubject, second: SynastrySubject): SynastryEvidenceSet {
  if (first.personId === second.personId) throw new Error("SYNASTRY_REQUIRES_DISTINCT_PEOPLE");
  const pairId = canonicalPairId(first.personId, second.personId), crossAspects: CrossAspectEvidence[] = [], overlays: HouseOverlayEvidence[] = [], angleAspects: AngleAspectEvidence[] = [];
  for (const a of first.chart.points) for (const b of second.chart.points) for (const [type, exactAngle] of aspectEntries) {
    const currentSeparation = separation(a.longitude, b.longitude), allowedOrb = resolveSynastryOrb(a.id as PlanetId, b.id as PlanetId, type), orb = Math.abs(currentSeparation - exactAngle);
    if (orb <= allowedOrb) {
      const refs = [{ personId: first.personId, pointId: a.id as PlanetId }, { personId: second.personId, pointId: b.id as PlanetId }] as const;
      crossAspects.push({ id: crossId(pairId, refs[0], refs[1], type), kind: "cross-aspect", pairId, points: [...refs].sort((x, y) => x.personId.localeCompare(y.personId)) as [typeof refs[0], typeof refs[1]], type, separation: round(currentSeparation), orb: round(orb), allowedOrb, orbBand: synastryOrbBand(orb, allowedOrb) });
    }
  }
  for (const [source, target] of [[first, second], [second, first]] as const) {
    const cusps = target.chart.houses.map((house) => house.cuspLongitude);
    for (const point of source.chart.points) {
      const targetHouse = houseForLongitude(point.longitude, cusps);
      if (RELEVANT_OVERLAY_HOUSES.has(targetHouse)) overlays.push({ id: `synastry:${pairId}:overlay:${source.personId}.${point.id}->${target.personId}.house${targetHouse}`, kind: "house-overlay", pairId, sourcePersonId: source.personId, sourcePointId: point.id as PlanetId, targetPersonId: target.personId, targetHouse: targetHouse as HouseOverlayEvidence["targetHouse"] });
      for (const [targetAngleId, longitude] of Object.entries(angles(target)) as [SynastryAngleId, number][]) for (const [type, exactAngle] of aspectEntries) {
        const currentSeparation = separation(point.longitude, longitude), orb = Math.abs(currentSeparation - exactAngle);
        if (orb <= 3) angleAspects.push({ id: `synastry:${pairId}:angle:${source.personId}.${point.id}->${target.personId}.${targetAngleId}:${type}`, kind: "angle-aspect", pairId, sourcePersonId: source.personId, sourcePointId: point.id as PlanetId, targetPersonId: target.personId, targetAngleId, type, separation: round(currentSeparation), orb: round(orb), allowedOrb: 3, orbBand: synastryOrbBand(orb, 3) });
      }
    }
  }
  const byId = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id));
  return { pairId, crossAspects: byId(crossAspects), overlays: byId(overlays), angleAspects: byId(angleAspects) };
}
