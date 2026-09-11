import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternSynthesisSummary } from "@/components/western/WesternSynthesisSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import type { WesternIssue } from "@/lib/western/types";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
function currentMonth(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  const year = value("year"), month = value("month");
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}`, reference: `${year}-${month}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}` };
}
export default function WesternRelationshipOverview() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>();
  const people = useMemo(() => ({ first: personId ? findPerson(personId) : null, second: otherPersonId ? findPerson(otherPersonId) : null }), [personId, otherPersonId]);
  const [state, setState] = useState<{ report?: WesternRelationshipSynthesisReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!people.first || !people.second) return;
    const firstBirth = people.first.birthInput as unknown as WesternBirthSource, timezone = firstBirth.timezone ?? "Asia/Seoul", month = currentMonth(timezone);
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-relationship-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: { personId: people.first.id, birth: firstBirth }, second: { personId: people.second.id, birth: people.second.birthInput as unknown as WesternBirthSource }, query: { startLocalDate: month.start, endLocalDate: month.end, timezone, referenceLocalDateTime: month.reference } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternRelationshipSynthesisReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western relationship overview service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [people]);
  if (!people.first || !people.second) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">비교할 사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">사람 목록으로</Link></main>;
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <header><p className="text-xs font-semibold text-primary">서양점성술 · 관계 종합</p><h1 className="mt-1 text-2xl font-bold text-foreground">{people.first.birthInput.name}님과 {people.second.birthInput.name}님의 관계 구조</h1><p className="mt-2 text-sm text-muted-foreground">점수나 결혼 판정 없이 각자의 성향과 실제 차트 상호작용을 함께 봅니다.</p></header>
    <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="관계 분석 주제"><span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-2 text-xs font-bold text-primary">관계 종합</span><Link href={`/western/${people.first.id}/synastry/${people.second.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground">시너스트리 근거</Link></nav>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">두 사람의 기존 분석 결과를 종합하고 있습니다.</div> : state.report ? <WesternSynthesisSummary report={state.report} /> : <div className="ds-card ds-card-pad shadow-none" role="alert"><p className="text-sm font-bold">두 사람의 정확한 출생정보가 필요합니다</p><p className="mt-2 text-sm text-muted-foreground">{state.errors?.[0]?.message ?? "관계 종합을 만들 수 없습니다."}</p></div>}
  </main>;
}
