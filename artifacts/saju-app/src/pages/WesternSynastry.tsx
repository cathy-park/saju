import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternSynastrySummary } from "@/components/western/WesternSynastrySummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternBirthSource } from "@/lib/western/adapter";
import type { WesternSynastryReport } from "@/lib/western/synastry";
import type { WesternIssue } from "@/lib/western/types";

const requestPolishedTexts = createPolishRequestCache("westernSynastry");
function findPerson(id: string): PersonRecord | null { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; }

export default function WesternSynastry() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>();
  const people = useMemo(() => ({ first: personId ? findPerson(personId) : null, second: otherPersonId ? findPerson(otherPersonId) : null }), [personId, otherPersonId]);
  const [state, setState] = useState<{ report?: WesternSynastryReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!people.first || !people.second) return;
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-synastry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: { personId: people.first.id, birth: people.first.birthInput as unknown as WesternBirthSource }, second: { personId: people.second.id, birth: people.second.birthInput as unknown as WesternBirthSource } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternSynastryReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western synastry service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [people]);
  useEffect(() => { if (!state.report) return; let cancelled = false; const report = state.report; requestPolishedTexts(report.sections, `${report.schemaVersion}:${report.pairId}`).then((texts) => { if (!cancelled) setPolishedTexts(texts); }); return () => { cancelled = true; }; }, [state.report]);
  if (!people.first || !people.second) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">비교할 사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">사람 목록으로</Link></div>;
  return <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <header><p className="text-xs font-semibold text-primary">서양점성술 · 시너스트리</p><h1 className="mt-1 text-2xl font-bold text-foreground">{people.first.birthInput.name}님과 {people.second.birthInput.name}님의 관계</h1><p className="mt-2 text-sm text-muted-foreground">점수나 사건 예측 없이 두 출생차트가 실제로 만나는 방식을 봅니다.</p></header>
    <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="관계 분석 주제"><Link href={`/western/${people.first.id}/synastry/${people.second.id}/overview`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground">관계 종합</Link><span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-2 text-xs font-bold text-primary">시너스트리 근거</span></nav>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">두 차트의 상호작용을 정리하고 있습니다.</div>
      : state.report ? <WesternSynastrySummary report={state.report} polishedTexts={polishedTexts} />
      : <div className="ds-card ds-card-pad shadow-none" role="alert"><p className="text-sm font-bold text-foreground">두 사람의 정확한 출생정보가 필요합니다</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.errors?.[0]?.code === "MISSING_BIRTH_TIME" ? "출생시간을 알 수 없어 각도·하우스·7하우스 주인을 임의로 만들지 않았습니다." : state.errors?.[0]?.code === "MISSING_LOCATION_CONTEXT" ? "출생지 좌표와 IANA 시간대가 없어 시너스트리를 임의로 계산하지 않았습니다." : state.errors?.[0]?.message ?? "시너스트리 리포트를 만들 수 없습니다."}</p>{state.errors?.[0] && <p className="mt-2 text-xs text-muted-foreground">오류 코드: {state.errors[0].code}</p>}</div>}
    <Link href="/people" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">다른 사람 선택하기</Link>
  </div>;
}
