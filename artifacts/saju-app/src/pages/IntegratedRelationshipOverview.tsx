import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { SystemSelector } from "@/components/SystemSelector";
import { IntegratedReportView } from "@/components/integrated/IntegratedReportView";
import { getCompatibilityReport } from "@/lib/reports";
import { buildSajuCompatibilitySections } from "@/lib/sajuCompatibilityFacts";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { adaptSajuRelationship, adaptWesternRelationship, adaptZiweiRelationshipContext, buildIntegratedRelationshipReport, type IntegratedReport, type IntegratedSourceFact } from "@/lib/integrated";
import { buildExistingPersonalReports } from "@/lib/integrated/personReports";
import { westernBirthSource } from "@/lib/western/uiModel";
import type { WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import type { WesternSynastryReport } from "@/lib/western/synastry";
import { buildCompatibilityCalculationClipboardText } from "@/lib/clipboardExport";
import { buildZiweiCopyPrompt } from "@/lib/ziwei/reports/promptExport";
import { buildWesternRelationshipCopyPrompt } from "@/lib/western/synthesis/promptExport";
import { buildIntegratedRelationshipCopyPrompt } from "@/lib/integrated/prompt";

const findPerson = (id: string): PersonRecord | null => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };
export default function IntegratedRelationshipOverview() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>();
  const pair = useMemo(() => ({ first: personId ? findPerson(personId) : null, second: otherPersonId ? findPerson(otherPersonId) : null }), [personId, otherPersonId]);
  const [report, setReport] = useState<IntegratedReport | null>(null);
  const [copyPrompt, setCopyPrompt] = useState<string>();
  useEffect(() => {
    if (!pair.first || !pair.second) return; let cancelled = false;
    const relType = pair.second.relationshipType ?? "lover"; const saju = buildSajuCompatibilitySections(getCompatibilityReport(pair.first, pair.second, relType));
    const firstReports = buildExistingPersonalReports(pair.first), secondReports = buildExistingPersonalReports(pair.second);
    const sources: IntegratedSourceFact[] = [...adaptSajuRelationship(saju), ...(firstReports.ziwei ? adaptZiweiRelationshipContext(firstReports.ziwei, pair.first.id) : []), ...(secondReports.ziwei ? adaptZiweiRelationshipContext(secondReports.ziwei, pair.second.id) : [])];
    const pairId = [pair.first.id, pair.second.id].sort().join("~"); const finish = (western?: WesternRelationshipSynthesisReport, synastry?: WesternSynastryReport) => { if (!cancelled) { setReport(buildIntegratedRelationshipReport({ pairId, sources: [...sources, ...(western ? adaptWesternRelationship(western) : [])] })); setCopyPrompt(buildIntegratedRelationshipCopyPrompt({ saju: buildCompatibilityCalculationClipboardText(pair.first!, pair.second!, getCompatibilityReport(pair.first!, pair.second!, relType)), ziwei: [firstReports.ziweiChart ? buildZiweiCopyPrompt(firstReports.ziweiChart) : `${pair.first!.birthInput.name}: 출생시간 없음`, secondReports.ziweiChart ? buildZiweiCopyPrompt(secondReports.ziweiChart) : `${pair.second!.birthInput.name}: 출생시간 없음`].join("\n\n---\n\n"), western: synastry ? buildWesternRelationshipCopyPrompt(synastry, { [pair.first!.id]: { placeLabel: pair.first!.westernLocation?.placeLabel, name: pair.first!.birthInput.name }, [pair.second!.id]: { placeLabel: pair.second!.westernLocation?.placeLabel, name: pair.second!.birthInput.name } }) : "두 사람의 출생지 좌표와 timezone을 설정하면 계산 구조가 포함됩니다." })); } };
    if (!pair.first.westernLocation || !pair.second.westernLocation) { finish(); return () => { cancelled = true; }; }
    const body = JSON.stringify({ first: { personId: pair.first.id, birth: westernBirthSource(pair.first) }, second: { personId: pair.second.id, birth: westernBirthSource(pair.second) } });
    Promise.all([fetch("/api/western-relationship-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body }), fetch("/api/western-synastry", { method: "POST", headers: { "Content-Type": "application/json" }, body })]).then(async ([overviewResponse, synastryResponse]) => { if (!overviewResponse.ok || !synastryResponse.ok) throw new Error(); const overview = await overviewResponse.json() as { report: WesternRelationshipSynthesisReport }; const synastry = await synastryResponse.json() as { report: WesternSynastryReport }; finish(overview.report, synastry.report); }).catch(() => finish());
    return () => { cancelled = true; };
  }, [pair]);
  if (!pair.first || !pair.second) return <main className="ds-app-shell ds-page-pad py-8 text-center"><p>비교할 사람을 찾을 수 없습니다.</p><Link href="/people">사람 목록으로</Link></main>;
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap"><div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur"><SystemSelector personId={pair.first.id} sajuHref={`/compatibility/${pair.second.id}`} synthesisHref={`/integrated/${pair.first.id}/relationship/${pair.second.id}/overview`} /></div><header><p className="text-xs font-bold text-primary">세 체계 종합 · 관계</p><h1 className="ds-title-lg mt-2">{pair.first.birthInput.name}님과 {pair.second.birthInput.name}님의 관계</h1><p className="ds-subtitle mt-2 block">두 사람의 상호작용과 관계의 핵심 흐름을 함께 살펴봅니다.</p></header>{report ? <IntegratedReportView report={report} copyPrompt={copyPrompt} /> : <div className="ds-card ds-card-pad text-sm text-muted-foreground" role="status">기존 관계 결과를 종합하고 있습니다.</div>}</main>;
}
