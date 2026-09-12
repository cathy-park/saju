import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternPersonalNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { WesternSynthesisSummary } from "@/components/western/WesternSynthesisSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";
import type { WesternIssue } from "@/lib/western/types";
import { monthInTimezone, monthRange, westernBirthSource } from "@/lib/western/uiModel";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
export default function WesternOverview() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const [state, setState] = useState<{ report?: WesternPersonalSynthesisReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!person) return;
    const birth = westernBirthSource(person) satisfies WesternBirthSource;
    if (!birth.timezone) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit Western location is required" }], loading: false }); return; }
    const value = monthInTimezone(birth.timezone), month = monthRange(value);
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: person.id, birth, query: { startLocalDate: month.start, endLocalDate: month.end, timezone: birth.timezone } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternPersonalSynthesisReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western overview service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person]);
  if (!person) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">사람 목록으로</Link></main>;
  return <WesternReportShell personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} eyebrow="서양점성술 · 개인 종합" title={`${person.birthInput.name}님의 전체 흐름`} navigation={<WesternPersonalNav personId={person.id} />}>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">기존 분석 결과를 종합하고 있습니다.</div> : state.report ? <WesternSynthesisSummary report={state.report} /> : <WesternMissingContext personId={person.id} personNames={[person.birthInput.name]} issue={state.errors?.[0]} fallback="종합 리포트를 만들 수 없습니다." />}
  </WesternReportShell>;
}
