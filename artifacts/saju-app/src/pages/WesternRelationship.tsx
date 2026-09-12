import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternPersonalNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { WesternRelationshipSummary } from "@/components/western/WesternRelationshipSummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternRelationshipReport } from "@/lib/western/interpretation/romance";
import { useResolvedWesternBirth } from "@/lib/western/useResolvedWesternBirth";

const requestPolishedTexts = createPolishRequestCache("westernRelationship");
function findPerson(id: string): PersonRecord | null {
  const mine = getMyProfile();
  return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null;
}

export default function WesternRelationship() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const { birth, status: birthStatus } = useResolvedWesternBirth(person);
  const [state, setState] = useState<{ report?: WesternRelationshipReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!person) return;
    if (birthStatus === "resolving") { setState({ loading: true }); return; }
    if (!birth) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit Western location is required" }], loading: false }); return; }
    let cancelled = false;
    setState({ loading: true });
    fetch("/api/western-romance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(birth) })
      .then(async (response) => {
        const data = await response.json() as { report?: WesternRelationshipReport; errors?: WesternIssue[] };
        if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false });
      }).catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western relationship service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person, birth, birthStatus]);
  useEffect(() => {
    if (!state.report) return;
    let cancelled = false;
    const report = state.report;
    requestPolishedTexts(report.sections, `${report.chart.schemaVersion}:${report.chart.engine.version}:${report.chart.normalizedBirth.utcInstant}:romance`).then((texts) => { if (!cancelled) setPolishedTexts(texts); });
    return () => { cancelled = true; };
  }, [state.report]);

  if (!person) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">목록으로</Link></div>;
  const sajuHref = person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`;
  return <WesternReportShell personId={person.id} sajuHref={sajuHref} eyebrow="서양점성술 · 연애와 배우자" title={`${person.birthInput.name}님의 관계 패턴`} navigation={<WesternPersonalNav personId={person.id} />}>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">관계 구조를 정리하고 있습니다.</div>
      : state.report ? <WesternRelationshipSummary report={state.report} polishedTexts={polishedTexts} />
      : <WesternMissingContext personId={person.id} personNames={[person.birthInput.name]} issue={state.errors?.[0]} fallback="관계 리포트를 만들 수 없습니다." />}
  </WesternReportShell>;
}
