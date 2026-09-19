import { describe, expect, it } from "vitest";
import { koreanRegions, koreanRegionLocation, parseKoreanRegion, provinces } from "../koreanRegions";

describe("Korean region catalog", () => {
  it("has coordinates for every selectable district", () => {
    expect(provinces).toHaveLength(17);
    for (const [province, districts] of Object.entries(koreanRegions)) {
      for (const district of Object.keys(districts)) {
        const location = koreanRegionLocation(`${province} ${district}`);
        expect(location?.latitude).toBeGreaterThan(32);
        expect(location?.latitude).toBeLessThan(39);
        expect(location?.longitude).toBeGreaterThan(124);
        expect(location?.longitude).toBeLessThan(132);
        expect(location?.timezone).toBe("Asia/Seoul");
      }
    }
  });

  it("requires both levels so duplicate district names stay distinct", () => {
    expect(parseKoreanRegion("영광군")).toBeNull();
    expect(koreanRegionLocation("전라남도 영광군")?.placeLabel).toBe("전라남도 영광군");
    expect(koreanRegionLocation("서울특별시 중구")?.latitude).not.toBe(koreanRegionLocation("부산광역시 중구")?.latitude);
  });

  it("resolves a province alone and uses the district coordinate when supplied", () => {
    const province = koreanRegionLocation("전라남도");
    const district = koreanRegionLocation("전라남도 영광군");
    expect(parseKoreanRegion("전라남도")).toEqual({ province: "전라남도", district: null });
    expect(province?.placeLabel).toBe("전라남도");
    expect(province?.latitude).toBeGreaterThan(32);
    expect(province?.longitude).toBeLessThan(132);
    expect(province?.latitude).not.toBe(district?.latitude);
    expect(district?.latitude).toBe(koreanRegions["전라남도"]["영광군"][0]);
  });
});
