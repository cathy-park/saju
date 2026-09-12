import { Link } from "wouter";
import type { WesternIssue } from "@/lib/western/types";

export function WesternMissingContext({ personId, personNames = [], issue, fallback }: { personId: string; personNames?: string[]; issue?: WesternIssue; fallback: string }) {
  const missing = personNames.length > 0 ? `${personNames.join(", ")}님의 ` : "";
  return <div className="ds-card ds-card-pad shadow-none" role="alert">
    <p className="text-sm font-bold text-foreground">정확한 출생 위치 정보가 필요합니다</p>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{issue?.code === "MISSING_LOCATION_CONTEXT" ? `${missing}출생지 좌표와 IANA 시간대가 없어 임의로 계산하지 않았습니다.` : issue?.message ?? fallback}</p>
    {issue?.code === "MISSING_LOCATION_CONTEXT" && <Link href={`/western/${personId}/location`} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">출생지 설정</Link>}
    {issue && <p className="mt-2 text-xs text-muted-foreground">오류 코드: {issue.code}</p>}
  </div>;
}
