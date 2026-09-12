import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { WesternSynastrySummary } from "@/components/western/WesternSynastrySummary";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import type { WesternSynastryReport } from "@/lib/western/synastry";
import type { WesternIssue } from "@/lib/western/types";
import { WesternRelationshipNav } from "@/components/western/WesternNavigation";
import { WesternReportShell } from "@/components/western/WesternReportShell";
import { WesternMissingContext } from "@/components/western/WesternMissingContext";
import { westernRoutes } from "@/lib/western/uiModel";
import { useResolvedWesternBirth } from "@/lib/western/useResolvedWesternBirth";
import { buildWesternRelationshipCopyPrompt } from "@/lib/western/synthesis/promptExport";
import { CopyButton } from "@/components/CopyButton";

const requestPolishedTexts = createPolishRequestCache("westernSynastry");
function findPerson(id: string): PersonRecord | null { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; }

export default function WesternSynastry() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>();
  const people = useMemo(() => ({ first: personId ? findPerson(personId) : null, second: otherPersonId ? findPerson(otherPersonId) : null }), [personId, otherPersonId]);
  const first = useResolvedWesternBirth(people.first);
  const second = useResolvedWesternBirth(people.second);
  const [state, setState] = useState<{ report?: WesternSynastryReport; errors?: WesternIssue[]; loading: boolean }>({ loading: true });
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!people.first || !people.second) return;
    if (first.status === "resolving" || second.status === "resolving") { setState({ loading: true }); return; }
    if (!first.birth || !second.birth) { setState({ errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit Western location is required" }], loading: false }); return; }
    let cancelled = false; setState({ loading: true });
    fetch("/api/western-synastry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first: { personId: people.first.id, birth: first.birth }, second: { personId: people.second.id, birth: second.birth } }) })
      .then(async (response) => { const data = await response.json() as { report?: WesternSynastryReport; errors?: WesternIssue[] }; if (!cancelled) setState(response.ok && data.report ? { report: data.report, loading: false } : { errors: data.errors, loading: false }); })
      .catch(() => { if (!cancelled) setState({ errors: [{ code: "CALCULATION_FAILED", message: "Western synastry service is unavailable" }], loading: false }); });
    return () => { cancelled = true; };
  }, [people, first.birth, first.status, second.birth, second.status]);
  useEffect(() => { if (!state.report) return; let cancelled = false; const report = state.report; requestPolishedTexts(report.sections, `${report.schemaVersion}:${report.pairId}`).then((texts) => { if (!cancelled) setPolishedTexts(texts); }); return () => { cancelled = true; }; }, [state.report]);
  if (!people.first || !people.second) return <div className="ds-app-shell ds-page-pad py-8 text-center"><p className="text-sm text-muted-foreground">비교할 사람을 찾을 수 없습니다.</p><Link href="/people" className="mt-3 inline-block text-sm text-primary underline">사람 목록으로</Link></div>;
  const missingNames = [people.first, people.second].filter((person) => !person.westernLocation).map((person) => person.birthInput.name);
  return <WesternReportShell personId={people.first.id} sajuHref={people.first.id === getMyProfile()?.id ? "/saju" : `/people/${people.first.id}`} westernHref={westernRoutes.relationship(people.first.id, people.second.id).overview} synthesisHref={`/integrated/${people.first.id}/relationship/${people.second.id}/overview`} eyebrow="서양점성술 · 시너스트리" title={`${people.first.birthInput.name}님과 ${people.second.birthInput.name}님의 관계`} description="점수나 사건 예측 없이 두 출생차트가 실제로 만나는 방식을 봅니다." navigation={<WesternRelationshipNav personId={people.first.id} otherPersonId={people.second.id} />}>
    {state.loading ? <div className="ds-card ds-card-pad text-sm text-muted-foreground shadow-none" role="status" aria-live="polite">두 차트의 상호작용을 정리하고 있습니다.</div>
      : state.report ? <><WesternSynastrySummary report={state.report} polishedTexts={polishedTexts} /><CopyButton buildText={() => buildWesternRelationshipCopyPrompt(state.report!, { [people.first!.id]: { name: people.first!.birthInput.name, placeLabel: people.first!.westernLocation?.placeLabel }, [people.second!.id]: { name: people.second!.birthInput.name, placeLabel: people.second!.westernLocation?.placeLabel } })} label="서양점성술 AI 해석 프롬프트 복사" toastTitle="두 사람의 서양점성술 계산 구조가 복사되었습니다." /></>
      : <WesternMissingContext personId={!people.first.westernLocation ? people.first.id : people.second.id} personNames={missingNames} issue={state.errors?.[0]} fallback="시너스트리 리포트를 만들 수 없습니다." />}
    <Link href="/people" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">다른 사람 선택하기</Link>
  </WesternReportShell>;
}
