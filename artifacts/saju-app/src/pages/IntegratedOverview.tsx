import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { IntegratedReportView } from "@/components/integrated/IntegratedReportView";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { adaptSajuPersonal, adaptWesternPersonal, adaptZiweiPersonal, buildIntegratedPersonalReport, type IntegratedReport, type IntegratedSourceFact, type TemporalScope } from "@/lib/integrated";
import { buildExistingPersonalReports } from "@/lib/integrated/personReports";
import { westernBirthSource } from "@/lib/western/uiModel";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
const monthScope = (month: string): TemporalScope => { const [year, value] = month.split("-").map(Number); const last = new Date(Date.UTC(year, value, 0)).getUTCDate(); return { start: `${month}-01`, end: `${month}-${last}`, timezone: "Asia/Seoul", granularity: "month", sourcePeriodLabel: `${year}년 ${value}월` }; };

export default function IntegratedOverview() {
  const { personId } = useParams<{ personId: string }>(); const search = useSearch();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]); const month = new URLSearchParams(search).get("month");
  const [report, setReport] = useState<IntegratedReport | null>(null);
  useEffect(() => {
    if (!person) return; let cancelled = false;
    const existing = buildExistingPersonalReports(person); const sources: IntegratedSourceFact[] = [...adaptSajuPersonal(existing.saju, person.id), ...(existing.ziwei ? adaptZiweiPersonal(existing.ziwei, person.id) : [])];
    const finish = (western?: WesternPersonalSynthesisReport) => { if (cancelled) return; const scope = month ? monthScope(month) : undefined; setReport(buildIntegratedPersonalReport({ personId: person.id, sources: [...sources, ...(western ? adaptWesternPersonal(western, scope) : [])], ...(scope ? { selectedPeriod: { start: scope.start, end: scope.end, timezone: scope.timezone } } : {}) })); };
    if (!person.westernLocation) { finish(); return () => { cancelled = true; }; }
    const birth = westernBirthSource(person); const scope = month ? monthScope(month) : undefined;
    fetch("/api/western-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: person.id, birth, ...(scope ? { query: { startLocalDate: scope.start, endLocalDate: scope.end, timezone: birth.timezone } } : {}) }) }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: { report: WesternPersonalSynthesisReport }) => finish(data.report)).catch(() => finish());
    return () => { cancelled = true; };
  }, [person, month]);
  if (!person) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p>사람을 찾을 수 없습니다.</p><Link href="/people">사람 목록으로</Link></main>;
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap"><div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur"><SystemSelector personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} /></div><header><p className="text-xs font-bold text-primary">세 체계 종합 · 개인</p><h1 className="ds-title-lg mt-2">{person.birthInput.name}님의 전체 흐름</h1><p className="ds-subtitle mt-2 block">서로 다른 체계가 말하는 공통점과 차이를 근거별로 묶었습니다.</p></header>{!month && <Link href={`/integrated/${person.id}/overview?month=${new Date().toISOString().slice(0, 7)}`} className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold">현재 월 흐름도 함께 보기</Link>}{report ? <IntegratedReportView report={report} /> : <div className="ds-card ds-card-pad text-sm text-muted-foreground" role="status">기존 결과를 종합하고 있습니다.</div>}</main>;
}
