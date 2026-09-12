import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { WesternPersonalNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { WesternTransitSummary } from "@/components/western/WesternTransitSummary";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternTransitReport } from "@/lib/western/transit";
import { monthFromSearch, monthInTimezone, monthRange, shiftMonth } from "@/lib/western/uiModel";
import { useResolvedWesternBirth } from "@/lib/western/useResolvedWesternBirth";
import { buildWesternCopyPrompt } from "@/lib/western/synthesis/promptExport";
import { CopyButton } from "@/components/CopyButton";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
export default function WesternTransit() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const { birth, status: birthStatus } = useResolvedWesternBirth(person);
  const [state, setState] = useState<{ report?: WesternTransitReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [, navigate] = useLocation();
  const timezone = person?.westernLocation?.timezone;
  const fallbackMonth = timezone ? monthInTimezone(timezone) : new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(() => monthFromSearch(window.location.search, fallbackMonth));
  const chooseMonth = (value: string) => { setSelectedMonth(value); navigate(`/western/${personId}/transit?month=${value}`, { replace: true }); };
  useEffect(() => {
    if (!person) return;
    if (birthStatus === "resolving") { setState({ loading: true }); return; }
    if (!birth) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit Western location is required" }], loading: false }); return; }
    const month = monthRange(selectedMonth);
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-transit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ birth, query: { startLocalDate: month.start, endLocalDate: month.end, timezone: birth.timezone } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternTransitReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western transit service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person, birth, birthStatus, selectedMonth]);
  if (!person) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">목록으로</Link></div>;
  const sajuHref = person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`;
  const [yearLabel, monthLabel] = selectedMonth.split("-");
  return <WesternReportShell personId={person.id} sajuHref={sajuHref} eyebrow="서양점성술 · 시기운" title={`${person.birthInput.name}님의 월간 흐름`} navigation={<WesternPersonalNav personId={person.id} />}>
    <div className="grid grid-cols-[44px_1fr_44px] items-center rounded-2xl border border-border bg-card p-1 shadow-sm" aria-label="조회 월 이동">
      <button type="button" className="min-h-11 rounded-xl text-lg text-primary hover:bg-muted" onClick={() => chooseMonth(shiftMonth(selectedMonth, -1))} aria-label="이전 월">‹</button>
      <p className="text-center text-sm font-bold">{yearLabel}년 {Number(monthLabel)}월</p>
      <button type="button" className="min-h-11 rounded-xl text-lg text-primary hover:bg-muted" onClick={() => chooseMonth(shiftMonth(selectedMonth, 1))} aria-label="다음 월">›</button>
    </div>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">현재 활성화된 차트 구조를 계산하고 있습니다.</div>
      : state.report ? <><WesternTransitSummary report={state.report} /><CopyButton buildText={() => {
          // 화면에 보이는 시기와 복사 결과를 일치시킨다(대표 지시) — URL에 ?month=가 실제로
          // 있을 때만(사용자가 이전/다음 월을 명시적으로 골랐을 때만) 그 선택된 월의
          // WesternTransitReport를 그대로 쓰고, 선택이 없는 기본 진입 상태(오늘이 속한 달을
          // fallback으로만 보여주는 중)는 지금까지처럼 "지금 이 순간" 기준으로 자동 계산한다.
          const hasExplicitMonth = monthFromSearch(window.location.search, "") !== "";
          return buildWesternCopyPrompt(state.report!.timeline.natalChart, { placeLabel: person.westernLocation?.placeLabel, ...(hasExplicitMonth ? { transit: state.report } : {}) });
        }} label="서양점성술 AI 해석 프롬프트 복사" toastTitle="서양점성술 계산 구조가 복사되었습니다." /></>
      : <WesternMissingContext personId={person.id} personNames={[person.birthInput.name]} issue={state.errors?.[0]} fallback="시기운 리포트를 만들 수 없습니다." />}
  </WesternReportShell>;
}
