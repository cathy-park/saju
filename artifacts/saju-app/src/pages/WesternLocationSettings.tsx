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
      description="출생한 시·도를 선택해주세요. 시·군·구를 알면 추가로 선택할 수 있습니다. 선택한 범위의 대표 좌표를 계산에 사용합니다."
      overviewPath={(id) => `/western/${id}/overview`}
    />
  );
}
