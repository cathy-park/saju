import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { WesternPersonalitySummary } from "@/components/western/WesternPersonalitySummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";
import type { WesternBirthSource } from "@/lib/western/adapter";

const requestPolishedTexts = createPolishRequestCache("westernPersonality");

function findPerson(personId: string): PersonRecord | null {
  const mine = getMyProfile();
  if (mine?.id === personId) return mine;
  return getPeople().find((person) => person.id === personId) ?? null;
}

export default function WesternPersonality() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => personId ? findPerson(personId) : null, [personId]);
  const [result, setResult] = useState<{ report?: WesternPersonalityReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    setResult({ loading: true });
    fetch("/api/western-personality", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person.birthInput as unknown as WesternBirthSource),
    }).then(async (response) => {
      const data = await response.json() as { report?: WesternPersonalityReport; errors?: WesternIssue[] };
      if (!cancelled) setResult(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false });
    }).catch(() => { if (!cancelled) setResult({ errors: [{ code: "CALCULATION_FAILED", message: "Western calculation service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [person]);

  useEffect(() => {
    if (!result.report) return;
    let cancelled = false;
    const report = result.report;
    const contentKey = `${report.chart.schemaVersion}:${report.chart.engine.version}:${report.chart.normalizedBirth.utcInstant}`;
    requestPolishedTexts(report.sections, contentKey).then((texts) => {
      if (!cancelled) setPolishedTexts(texts);
    });
    return () => { cancelled = true; };
  }, [result.report]);

  if (!person) return (
    <div className="ds-app-shell ds-page-pad py-8 text-center">
      <p className="text-sm text-muted-foreground">사람을 찾을 수 없습니다.</p>
      <Link href="/people" className="mt-3 inline-block text-sm text-primary underline">목록으로</Link>
    </div>
  );

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
      <SystemSelector personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} />
      <nav className="flex rounded-xl bg-muted/40 p-1" aria-label="서양점성술 해석 주제">
      <Link href={`/western/${person.id}/overview`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">종합</Link>
      <span className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-primary/30 bg-card px-2 text-center text-xs font-bold text-primary">개인 성향</span>
      <Link href={`/western/${person.id}/romance`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">연애·배우자</Link>
      <Link href={`/western/${person.id}/transit`} className="flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold text-muted-foreground">시기운</Link>
      </nav>
      <header>
        <p className="text-xs font-semibold text-primary">서양점성술 · 개인 성향</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{person.birthInput.name}님의 성향</h1>
      </header>
      {result.loading ? (
        <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">출생차트를 계산하고 있습니다.</div>
      ) : result.report ? (
        <WesternPersonalitySummary report={result.report} polishedTexts={polishedTexts} />
      ) : (
        <div className="ds-card ds-card-pad shadow-none" role="alert">
          <p className="text-sm font-bold text-foreground">정확한 출생 위치 정보가 필요합니다</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {result.errors?.[0]?.code === "MISSING_LOCATION_CONTEXT"
              ? "저장된 출생지 좌표와 IANA 시간대가 없어 차트를 임의로 추정하지 않았습니다. 위치 입력 방식이 준비된 뒤 이용할 수 있습니다."
              : result.errors?.[0]?.message ?? "차트를 계산할 수 없습니다."}
          </p>
          {result.errors?.[0] && <p className="mt-2 text-xs text-muted-foreground">오류 코드: {result.errors[0].code}</p>}
        </div>
      )}
    </div>
  );
}
