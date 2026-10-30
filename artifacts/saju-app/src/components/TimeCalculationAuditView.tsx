import React from "react";
import type { TimeCalculationAudit } from "@/lib/timeCalculationAudit";

export function TimeCalculationAuditView({
  audit,
}: {
  audit?: TimeCalculationAudit;
}) {
  return (
    <details
      className="rounded-xl border border-border p-3 text-xs"
      data-testid="time-calculation-audit"
    >
      <summary>계산 시간 기준과 검증 범위</summary>
      {audit ? (
        <>
          <p>
            사주 기준: {audit.basis} · 경계 거리:{" "}
            {audit.hourBoundaryDistanceMinutes ?? "시각 미상"}분
          </p>
          <p>
            원본 양력: {JSON.stringify(audit.originalSolarDate)} · 보정 후:{" "}
            {JSON.stringify(
              audit.effectiveSolarDateTime ?? audit.effectiveTime,
            )}
          </p>
          <p>
            자미두수는 원본 시계시각, 서양차트는 원본 현지시각의 시간대/DST를
            사용합니다. 사주 보정시각과 다릅니다.
          </p>
          <p>
            시진 경계 5분 이내는 ±5분 재계산 비교가 필요합니다. 절기 시각은
            미지원이며 신강·용신 지수, 자미두수 유파·사화·운기와 서양
            천문력·하우스의 독립 검증은 완료되지 않았습니다.
          </p>
          <p>{audit.warnings.join(" · ")}</p>
        </>
      ) : (
        <p>
          이 저장 명반에는 시간 감사 정보가 없습니다. 자동 계산 초기화로 갱신할
          수 있습니다.
        </p>
      )}
    </details>
  );
}
