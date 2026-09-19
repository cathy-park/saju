import regions from "./koreanRegions.json";
import type { WesternGeoLocation } from "./storage";

// 행정안전부 법정동(2026-02) 및 브이월드 경계 중심점 기반.
// https://github.com/swuhalee/korea-regions-with-coords
export const koreanRegions = regions as unknown as Record<string, Record<string, [number, number]>>;
export const provinces = Object.keys(koreanRegions);

export function parseKoreanRegion(label?: string | null): { province: string; district: string } | null {
  if (!label) return null;
  const normalized = label.trim();
  for (const province of provinces) {
    for (const district of Object.keys(koreanRegions[province])) {
      if (normalized === `${province} ${district}`) return { province, district };
    }
  }
  return null;
}

export function koreanRegionLocation(label?: string | null): WesternGeoLocation | null {
  const parsed = parseKoreanRegion(label);
  if (!parsed) return null;
  const [latitude, longitude] = koreanRegions[parsed.province][parsed.district];
  return {
    placeLabel: `${parsed.province} ${parsed.district}`,
    latitude,
    longitude,
    timezone: "Asia/Seoul",
    resolver: { provider: "korean-regions", version: "2026-02" },
  };
}
