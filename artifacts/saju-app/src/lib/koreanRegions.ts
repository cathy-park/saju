import regions from "./koreanRegions.json";
import type { WesternGeoLocation } from "./storage";

// 행정안전부 법정동(2026-02) 및 브이월드 경계 중심점 기반.
// https://github.com/swuhalee/korea-regions-with-coords
export const koreanRegions = regions as unknown as Record<string, Record<string, [number, number]>>;
export const provinces = Object.keys(koreanRegions);

export function parseKoreanRegion(label?: string | null): { province: string; district: string | null } | null {
  if (!label) return null;
  const normalized = label.trim();
  for (const province of provinces) {
    if (normalized === province) return { province, district: null };
    for (const district of Object.keys(koreanRegions[province])) {
      if (normalized === `${province} ${district}`) return { province, district };
    }
  }
  return null;
}

export function koreanRegionLocation(label?: string | null): WesternGeoLocation | null {
  const parsed = parseKoreanRegion(label);
  if (!parsed) return null;
  const districts = koreanRegions[parsed.province];
  const points = parsed.district ? [districts[parsed.district]] : Object.values(districts);
  const latitude = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const longitude = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return {
    placeLabel: parsed.district ? `${parsed.province} ${parsed.district}` : parsed.province,
    latitude,
    longitude,
    timezone: "Asia/Seoul",
    resolver: { provider: "korean-regions", version: "2026-02" },
  };
}
