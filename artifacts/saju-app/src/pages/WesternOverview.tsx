import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { WesternSynthesisSummary } from "@/components/western/WesternSynthesisSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";
import type { WesternIssue } from "@/lib/western/types";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
function currentMonth(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  const year = value("year"), month = value("month");
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}`, reference: `${year}-${month}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}` };
}
export default function WesternOverview() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const [state, setState] = useState<{ report?: WesternPersonalSynthesisReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!person) return;
    const birth = person.birthInput as unknown as WesternBirthSource, month = currentMonth(birth.timezone ?? "Asia/Seoul");
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: person.id, birth, query: { startLocalDate: month.start, endLocalDate: month.end, timezone: birth.timezone, referenceLocalDateTime: month.reference } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternPersonalSynthesisReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western overview service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person]);
  if (!person) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">사람 목록으로</Link></main>;
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <SystemSelector personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} />
    <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="서양점성술 해석 주제"><span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-2 text-xs font-bold text-primary">종합</span><Link href={`/western/${person.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground">개인 성향</Link><Link href={`/western/${person.id}/romance`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground">연애</Link><Link href={`/western/${person.id}/transit`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground">시기운</Link></nav>
    <header><p className="text-xs font-semibold text-primary">서양점성술 · 개인 종합</p><h1 className="mt-1 text-2xl font-bold text-foreground">{person.birthInput.name}님의 전체 흐름</h1></header>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">기존 분석 결과를 종합하고 있습니다.</div> : state.report ? <WesternSynthesisSummary report={state.report} /> : <div className="ds-card ds-card-pad shadow-none" role="alert"><p className="text-sm font-bold">종합에 필요한 출생정보가 부족합니다</p><p className="mt-2 text-sm text-muted-foreground">{state.errors?.[0]?.message ?? "종합 리포트를 만들 수 없습니다."}</p></div>}
  </main>;
}
