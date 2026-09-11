import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { WesternTransitSummary } from "@/components/western/WesternTransitSummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternTransitReport } from "@/lib/western/transit";

const requestPolishedTexts = createPolishRequestCache("westernTransit");
const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
function currentMonth(timezone?: string) {
  const now = new Date();
  if (!timezone) { const value = now.toISOString().slice(0, 7); return { start: `${value}-01`, end: `${value}-${new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate()}` }; }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")!.value, month = parts.find((part) => part.type === "month")!.value;
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}` };
}

export default function WesternTransit() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const [state, setState] = useState<{ report?: WesternTransitReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!person) return;
    const birth = person.birthInput as unknown as WesternBirthSource, month = currentMonth(birth.timezone);
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-transit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birth, query: { startLocalDate: month.start, endLocalDate: month.end, timezone: birth.timezone } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternTransitReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western transit service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person]);
  useEffect(() => { if (!state.report) return; let cancelled = false; const report = state.report; requestPolishedTexts(report.sections, `${report.timeline.schemaVersion}:${report.timeline.query.startUtcInstant}:${report.timeline.query.endUtcInstant}`).then((texts) => { if (!cancelled) setPolishedTexts(texts); }); return () => { cancelled = true; }; }, [state.report]);
  if (!person) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">목록으로</Link></div>;
  const sajuHref = person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`;
  return <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <SystemSelector personId={person.id} sajuHref={sajuHref} />
    <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="서양점성술 해석 주제">
      <Link href={`/western/${person.id}/overview`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">종합</Link>
      <Link href={`/western/${person.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">개인 성향</Link>
      <Link href={`/western/${person.id}/romance`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">연애·배우자</Link>
      <span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-2 text-center text-xs font-bold text-primary">시기운</span>
    </nav>
    <header><p className="text-xs font-semibold text-primary">서양점성술 · 트랜싯</p><h1 className="mt-1 text-2xl font-bold text-foreground">{person.birthInput.name}님의 이번 달 흐름</h1></header>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">현재 활성화된 차트 구조를 계산하고 있습니다.</div>
      : state.report ? <WesternTransitSummary report={state.report} polishedTexts={polishedTexts} />
      : <div className="ds-card ds-card-pad shadow-none" role="alert"><p className="text-sm font-bold text-foreground">정확한 출생 위치 정보가 필요합니다</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.errors?.[0]?.code === "MISSING_LOCATION_CONTEXT" ? "저장된 출생지 좌표와 IANA 시간대가 없어 시기운을 임의로 계산하지 않았습니다." : state.errors?.[0]?.message ?? "시기운 리포트를 만들 수 없습니다."}</p>{state.errors?.[0] && <p className="mt-2 text-xs text-muted-foreground">오류 코드: {state.errors[0].code}</p>}</div>}
  </div>;
}
