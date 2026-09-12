import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternPersonalNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { WesternPersonalitySummary } from "@/components/western/WesternPersonalitySummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternIssue } from "@/lib/western/types";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";
import type { WesternBirthSource } from "@/lib/western/adapter";
import { westernBirthSource } from "@/lib/western/uiModel";

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
      body: JSON.stringify(westernBirthSource(person) satisfies WesternBirthSource),
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
    <WesternReportShell personId={person.id} sajuHref={person.id === getMyProfile()?.id ? "/saju" : `/people/${person.id}`} eyebrow="서양점성술 · 개인 성향" title={`${person.birthInput.name}님의 성향`} navigation={<WesternPersonalNav personId={person.id} />}>
      {result.loading ? (
        <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">출생차트를 계산하고 있습니다.</div>
      ) : result.report ? (
        <WesternPersonalitySummary report={result.report} polishedTexts={polishedTexts} />
      ) : (
        <WesternMissingContext personId={person.id} personNames={[person.birthInput.name]} issue={result.errors?.[0]} fallback="차트를 계산할 수 없습니다." />
      )}
    </WesternReportShell>
  );
}
