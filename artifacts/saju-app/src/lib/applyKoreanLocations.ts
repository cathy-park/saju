import type { PersonRecord } from "./storage";
import { koreanRegionLocation } from "./koreanRegions";

export function applyKoreanLocations(record: PersonRecord): PersonRecord {
  const birth = record.birthInput.birthplace;
  const current = record.currentPlaceName;
  return {
    ...record,
    westernLocation: koreanRegionLocation(birth) ?? (birth ? record.westernLocation : undefined),
    currentLocation: koreanRegionLocation(current) ?? (current ? record.currentLocation : undefined),
  };
}
