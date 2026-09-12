import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternSynthesisSummary } from "@/components/western/WesternSynthesisSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import type { WesternIssue } from "@/lib/western/types";
import { WesternRelationshipNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { monthInTimezone, monthRange, westernBirthSource, westernRoutes } from "@/lib/western/uiModel";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
export default function WesternRelationshipOverview() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>();
  const people = useMemo(() => ({ first: personId ? findPerson(personId) : null, second: otherPersonId ? findPerson(otherPersonId) : null }), [personId, otherPersonId]);
  const [state, setState] = useState<{ report?: WesternRelationshipSynthesisReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!people.first || !people.second) return;
    const firstBirth = westernBirthSource(people.first) satisfies WesternBirthSource, secondBirth = westernBirthSource(people.second) satisfies WesternBirthSource, timezone = firstBirth.timezone;
    if (!timezone || !secondBirth.timezone) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Both people need explicit Western locations" }], loading: false }); return; }
    const month = monthRange(monthInTimezone(timezone));
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-relationship-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: { personId: people.first.id, birth: firstBirth }, second: { personId: people.second.id, birth: secondBirth }, query: { startLocalDate: month.start, endLocalDate: month.end, timezone } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternRelationshipSynthesisReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western relationship overview service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [people]);
  if (!people.first || !people.second) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">비교할 사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">사람 목록으로</Link></main>;
  const missingNames = [people.first, people.second].filter((person) => !person.westernLocation).map((person) => person.birthInput.name);
  return <WesternReportShell personId={people.first.id} sajuHref={people.first.id === getMyProfile()?.id ? "/saju" : `/people/${people.first.id}`} westernHref={westernRoutes.relationship(people.first.id, people.second.id).overview} eyebrow="서양점성술 · 관계 종합" title={`${people.first.birthInput.name}님과 ${people.second.birthInput.name}님의 관계 구조`} description="점수나 결혼 판정 없이 각자의 성향과 실제 차트 상호작용을 함께 봅니다." navigation={<WesternRelationshipNav personId={people.first.id} otherPersonId={people.second.id} />}>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">두 사람의 기존 분석 결과를 종합하고 있습니다.</div> : state.report ? <WesternSynthesisSummary report={state.report} /> : <WesternMissingContext personId={!people.first.westernLocation ? people.first.id : people.second.id} personNames={missingNames} issue={state.errors?.[0]} fallback="관계 종합을 만들 수 없습니다." />}
  </WesternReportShell>;
}
