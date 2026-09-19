// 솔라리턴(Solar Return)의 "기준 지역" 설정 화면 — 출생지(WesternLocationSettings)와 달리
// 지금 이 사람이 실제로 살고 있는 곳을 받는다. 검색·선택·고급 설정 UI는 동일해서
// LocationSettingsForm을 공유하고, 저장 필드(currentLocation)와 문구만 다르다.
import { useParams } from "wouter";
import { LocationSettingsForm } from "@/components/western/LocationSettingsForm";

export default function WesternCurrentLocationSettings() {
  const { personId } = useParams<{ personId: string }>();
  return (
    <LocationSettingsForm
      personId={personId}
      field="currentLocation"
      heading="현재 지역"
      description="솔라리턴(Solar Return)의 ASC/MC/12하우스는 출생지가 아니라 지금 살고 있는 지역을 기준으로 계산됩니다. 지역 이름만 입력하면 위도·경도·시간대를 자동으로 찾습니다."
      overviewPath={(id) => `/western/${id}/overview`}
    />
  );
}
