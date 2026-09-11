import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { WesternRelationshipSummary } from "@/components/western/WesternRelationshipSummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternRelationshipReport } from "@/lib/western/interpretation/romance";

const requestPolishedTexts = createPolishRequestCache("westernRelationship");
function findPerson(id: string): PersonRecord | null {
  const mine = getMyProfile();
  return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null;
}

export default function WesternRelationship() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const [state, setState] = useState<{ report?: WesternRelationshipReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    setState({ loading: true });
    fetch("/api/western-romance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(person.birthInput as unknown as WesternBirthSource) })
      .then(async (response) => {
        const data = await response.json() as { report?: WesternRelationshipReport; errors?: WesternIssue[] };
        if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false });
      }).catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western relationship service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person]);
  useEffect(() => {
    if (!state.report) return;
    let cancelled = false;
    const report = state.report;
    requestPolishedTexts(report.sections, `${report.chart.schemaVersion}:${report.chart.engine.version}:${report.chart.normalizedBirth.utcInstant}:romance`).then((texts) => { if (!cancelled) setPolishedTexts(texts); });
    return () => { cancelled = true; };
  }, [state.report]);

  if (!person) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">목록으로</Link></div>;
  const sajuHref = person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`;
  return <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <SystemSelector personId={person.id} sajuHref={sajuHref} />
    <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="서양점성술 해석 주제">
      <Link href={`/western/${person.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold text-muted-foreground">개인 성향</Link>
      <span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-3 text-center text-sm font-bold text-primary">연애·배우자</span>
    </nav>
    <header><p className="text-xs font-semibold text-primary">서양점성술 · 연애와 배우자</p><h1 className="mt-1 text-2xl font-bold text-foreground">{person.birthInput.name}님의 관계 패턴</h1></header>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">관계 구조를 정리하고 있습니다.</div>
      : state.report ? <WesternRelationshipSummary report={state.report} polishedTexts={polishedTexts} />
      : <div className="ds-card ds-card-pad shadow-none" role="alert"><p className="text-sm font-bold text-foreground">정확한 출생 위치 정보가 필요합니다</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.errors?.[0]?.code === "MISSING_LOCATION_CONTEXT" ? "저장된 출생지 좌표와 IANA 시간대가 없어 관계 차트를 임의로 추정하지 않았습니다." : state.errors?.[0]?.message ?? "관계 리포트를 만들 수 없습니다."}</p>{state.errors?.[0] && <p className="mt-2 text-xs text-muted-foreground">오류 코드: {state.errors[0].code}</p>}</div>}
  </div>;
}
