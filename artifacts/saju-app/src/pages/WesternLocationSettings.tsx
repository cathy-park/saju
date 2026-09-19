// 21단계 추가 지시 — 사용자는 출생지 "이름"만 입력한다. 위도·경도·IANA 시간대는 이 화면이
// /api/geocode(Nominatim 기반, api/geocode.ts 주석 참고)로 자동으로 찾는다. 실제 검색·선택·
// 고급 설정 UI는 현재 지역 설정 화면과 동일해서 LocationSettingsForm으로 공유한다.
import { useParams } from "wouter";
import { LocationSettingsForm } from "@/components/western/LocationSettingsForm";

export default function WesternLocationSettings() {
  const { personId } = useParams<{ personId: string }>();
  return (
    <LocationSettingsForm
      personId={personId}
      field="westernLocation"
      heading="출생 위치"
      description="출생지 이름만 입력하면 위도·경도·시간대를 자동으로 찾습니다. 동명 지역이거나 나라 안에 시간대가 여럿이면 직접 골라주세요."
      seedFromBirthplace
      overviewPath={(id) => `/western/${id}/overview`}
    />
  );
}
