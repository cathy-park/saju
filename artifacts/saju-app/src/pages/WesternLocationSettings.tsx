// 한국 시·도 → 시·군·구 선택 화면.
import { useParams } from "wouter";
import { LocationSettingsForm } from "@/components/western/LocationSettingsForm";

export default function WesternLocationSettings() {
  const { personId } = useParams<{ personId: string }>();
  return (
    <LocationSettingsForm
      personId={personId}
      field="westernLocation"
      heading="출생 위치"
      description="출생한 시·도와 시·군·구를 선택해주세요. 선택한 지역의 중심 좌표를 계산에 사용합니다."
      overviewPath={(id) => `/western/${id}/overview`}
    />
  );
}
