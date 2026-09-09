/**
 * Placidus semi-arc solver adapted from astro-mcp v0.3.1 commit 76039f3,
 * itself adapted from auseklis 0.4.0. Both are MIT licensed.
 * Copyright (c) 2026 Wesley Liu; Copyright (c) 2026 devil.services.
 * See THIRD_PARTY_NOTICES.md. No Swiss Ephemeris code or data is used.
 */
import { D2R, R2D, norm360 } from "./astronomy";

function signedArc(a: number, b: number): number { let delta = norm360(a - b); if (delta > 180) delta -= 360; return delta; }
function longitudeOfRa(ra: number, epsilon: number): number {
  return norm360(Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(epsilon)) * R2D);
}
export function calculatePlacidusCusps(ascendant: number, midheaven: number, latitude: number, obliquity: number): number[] | null {
  const epsilon = obliquity * D2R;
  const phi = latitude * D2R;
  const mc = norm360(midheaven);
  const ramc = norm360(Math.atan2(Math.sin(mc * D2R) * Math.cos(epsilon), Math.cos(mc * D2R)) * R2D);
  const solve = (offset: number, fraction: number, nocturnal: boolean): number | null => {
    let ra = norm360(ramc + offset);
    for (let index = 0; index < 100; index++) {
      const lambda = longitudeOfRa(ra, epsilon) * D2R;
      const x = Math.tan(phi) * Math.tan(Math.asin(Math.sin(epsilon) * Math.sin(lambda)));
      if (Math.abs(x) >= 1) return null;
      const ascensionalDifference = Math.asin(x) * R2D;
      const next = nocturnal
        ? norm360(ramc + 180 - fraction * (90 - ascensionalDifference))
        : norm360(ramc + fraction * (90 + ascensionalDifference));
      const step = Math.abs(signedArc(next, ra));
      ra = next;
      if (step < 1e-9) return longitudeOfRa(ra, epsilon);
    }
    return null;
  };
  const c11 = solve(30, 1 / 3, false), c12 = solve(60, 2 / 3, false);
  const c2 = solve(120, 2 / 3, true), c3 = solve(150, 1 / 3, true);
  if (c11 === null || c12 === null || c2 === null || c3 === null) return null;
  return [ascendant, c2, c3, norm360(mc + 180), norm360(c11 + 180), norm360(c12 + 180), norm360(ascendant + 180), norm360(c2 + 180), norm360(c3 + 180), mc, c11, c12].map(norm360);
}

export function houseForLongitude(longitude: number, cusps: number[]): number {
  for (let index = 0; index < 12; index++) {
    const span = norm360(cusps[(index + 1) % 12] - cusps[index]);
    const relative = norm360(longitude - cusps[index]);
    if (span === 0 || relative < span) return index + 1;
  }
  return 12;
}
