import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternPersonalNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { WesternSynthesisSummary } from "@/components/western/WesternSynthesisSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternNatalChart } from "@/lib/western/types";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";
import { monthInTimezone, monthRange } from "@/lib/western/uiModel";
import { useResolvedWesternBirth } from "@/lib/western/useResolvedWesternBirth";
import { createWesternSynthesisPolishCache, westernSynthesisContentKey } from "@/lib/western/synthesis/prosePolish";
import { buildWesternCopyPrompt } from "@/lib/western/synthesis/promptExport";
import { CopyButton } from "@/components/CopyButton";

const requestPolishedTexts = createWesternSynthesisPolishCache("western-overview");

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
export default function WesternOverview() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const { birth, status: birthStatus } = useResolvedWesternBirth(person);
  const [state, setState] = useState<{ report?: WesternPersonalSynthesisReport; chart?: WesternNatalChart; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!state.report) return;
    let cancelled = false;
    requestPolishedTexts(state.report, westernSynthesisContentKey(state.report)).then((texts) => {
      if (!cancelled) setPolishedTexts(texts);
    });
    return () => { cancelled = true; };
  }, [state.report]);
  useEffect(() => {
    if (!person) return;
    if (birthStatus === "resolving") { setState({ loading: true }); return; }
    if (!birth || !birth.timezone) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit Western location is required" }], loading: false }); return; }
    const value = monthInTimezone(birth.timezone), month = monthRange(value);
    let cancelled = false; setState({ loading: true });
    Promise.all([
      fetch("/api/western-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: person.id, birth, query: { startLocalDate: month.start, endLocalDate: month.end, timezone: birth.timezone } }) }),
      fetch("/api/western-personality", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(birth) }),
    ]).then(async ([overviewResponse, chartResponse]) => { const data = await overviewResponse.json() as { report?: WesternPersonalSynthesisReport; errors?: WesternIssue[] }; const chartData = await chartResponse.json() as { report?: WesternPersonalityReport }; if (!cancelled) setState(overviewResponse.ok && data.report && chartData.report ? { report: data.report, chart: chartData.report.chart, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western overview service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person, birth, birthStatus]);
  if (!person) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">사람 목록으로</Link></main>;
  return <WesternReportShell personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} eyebrow="서양점성술 · 개인 종합" title={`${person.birthInput.name}님의 전체 흐름`} navigation={<WesternPersonalNav personId={person.id} />}>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">기존 분석 결과를 종합하고 있습니다.</div> : state.report ? (<>
      <WesternSynthesisSummary report={state.report} polishedTexts={polishedTexts} />
      {state.chart && <CopyButton buildText={() => buildWesternCopyPrompt(state.chart!, { placeLabel: person.westernLocation?.placeLabel })} label="서양점성술 AI 해석 프롬프트 복사" toastTitle="서양점성술 계산 구조가 복사되었습니다." />}
    </>) : <WesternMissingContext personId={person.id} personNames={[person.birthInput.name]} issue={state.errors?.[0]} fallback="종합 리포트를 만들 수 없습니다." />}
  </WesternReportShell>;
}
