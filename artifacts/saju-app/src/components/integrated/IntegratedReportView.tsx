import { useEffect, useState } from "react";
import { Check, Copy, ChevronDown } from "lucide-react";
import type { IntegratedReport } from "@/lib/integrated";
import { polishIntegratedHolistic, type HolisticArea } from "@/lib/integrated/prompt";
import { buildDeterministicPresentedAreas, evidenceForArea, systemsForArea } from "@/lib/integrated/presentation";

const SYSTEM_LABEL = { saju: "사주", ziwei: "자미두수", western: "서양점성술" } as const;

export function IntegratedReportView({ report, copyPrompt }: { report: IntegratedReport; copyPrompt?: string }) {
  const [copied, setCopied] = useState(false);
  const [activeKey, setActiveKey] = useState(report.scope === "personal" ? "overview" : "relationshipCoreStructure");
  // 대표 지시(다면 구조 복원) — 예전에는 20단계 IntegratedSection 키를 임의로 3개 그룹으로
  // 묶어 보여줬는데, 그 그룹과 AI holistic 문단의 구조가 서로 달라 실제로는 두 영역 정도만
  // 화면에 남는 문제가 있었다. 지금은 AI가 고정된 7개 영역(areas.ts) 중 근거가 있는 것만
  // 돌려주고, 그 영역들을 그대로 카드로 나열한다 — 근거가 없는 영역은 폴백 텍스트로도
  // 억지로 채우지 않는다(빈 배열이면 카드 자체가 없다).
  const [areas, setAreas] = useState<HolisticArea[]>(() => buildDeterministicPresentedAreas(report));
  useEffect(() => {
    setAreas(buildDeterministicPresentedAreas(report));
    let cancelled = false;
    polishIntegratedHolistic(report).then((result) => { if (!cancelled && result.length > 0) setAreas(result); });
    return () => { cancelled = true; };
  }, [report]);
  const hasTiming = report.timingConvergences.length > 0 || report.standaloneFacts.some((source) => source.temporalScope);
  const visibleAreas = areas.filter((area) => {
    if ((area.key === "currentFlow" || area.key === "currentRelationshipFlow") && !hasTiming) return false;
    return area.key === "overview" || area.key === "relationshipCoreStructure" || systemsForArea(report, area.key).length > 0;
  });
  const selected = visibleAreas.find((area) => area.key === activeKey) ?? visibleAreas[0];
  const evidence = selected ? evidenceForArea(report, selected.key) : [];
  const copy = async () => {
    if (!copyPrompt) return;
    await navigator.clipboard.writeText(copyPrompt); setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className="ds-section-gap">
    <div className="ds-card ds-card-pad shadow-none">
      <p className="text-sm font-semibold text-foreground">{report.availableSystems.map((system) => SYSTEM_LABEL[system]).join(" · ")}을 함께 살펴봤어요</p>
      {report.missingSystems.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.missingSystems.map((system) => SYSTEM_LABEL[system]).join(", ")}은 필요한 출생정보를 설정하면 함께 반영됩니다.</p>}
    </div>
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"><div className="flex w-max min-w-full gap-2" role="tablist" aria-label="종합 분석 주제">{visibleAreas.map((area) => <button key={area.key} type="button" role="tab" aria-selected={selected?.key === area.key} onClick={() => setActiveKey(area.key)} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-bold ${selected?.key === area.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{area.title}</button>)}</div></div>
    {selected && <section className="ds-card ds-card-pad border-primary/20 bg-primary/[0.03] shadow-none"><h2 className="text-base font-bold text-foreground">{selected.title}</h2><p className="mt-2 text-sm leading-relaxed text-foreground">{selected.text}</p><div className="mt-3 flex flex-wrap gap-1.5">{systemsForArea(report, selected.key).map((system) => <span key={system} className="rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">{SYSTEM_LABEL[system]}</span>)}</div></section>}
    {evidence.length > 0 && <details className="ds-card ds-card-pad shadow-none"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-foreground">왜 이렇게 보나요?<ChevronDown className="h-4 w-4" /></summary><div className="space-y-2 pt-3">{evidence.map((item) => <p key={`${item.system}:${item.text}`} className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{SYSTEM_LABEL[item.system]}</span> · {item.text}</p>)}</div></details>}
    {copyPrompt && <button type="button" onClick={copy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "복사했습니다" : "전체 AI 해석 프롬프트 복사"}</button>}
  </div>;
}
