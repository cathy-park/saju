import { useEffect, useState } from "react";
import { Check, Copy, ChevronDown } from "lucide-react";
import type { IntegratedReport } from "@/lib/integrated";
import { buildIntegratedCopyPrompt, polishIntegratedSection } from "@/lib/integrated/prompt";

const SYSTEM_LABEL = { saju: "사주", ziwei: "자미두수", western: "서양점성술" } as const;
export function IntegratedReportView({ report }: { report: IntegratedReport }) {
  const [copied, setCopied] = useState(false);
  const [polished, setPolished] = useState<Record<string, string>>({});
  useEffect(() => { let cancelled = false; setPolished({}); report.sections.forEach((section) => { if (!section.facts.length) return; polishIntegratedSection(report, section.key, section.text).then((text) => { if (!cancelled && text !== section.text) setPolished((current) => ({ ...current, [section.key]: text })); }); }); return () => { cancelled = true; }; }, [report]);
  const copy = async () => { await navigator.clipboard.writeText(buildIntegratedCopyPrompt(report)); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  return <div className="ds-section-gap">
    <div className="ds-card ds-card-pad shadow-none">
      <p className="text-sm font-semibold text-foreground">{report.availableSystems.map((system) => SYSTEM_LABEL[system]).join(" + ")} 결과로 종합 중</p>
      {report.missingSystems.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.missingSystems.map((system) => SYSTEM_LABEL[system]).join(", ")}은 필요한 정보가 준비되면 함께 포함됩니다.</p>}
    </div>
    {report.sections.filter((section) => section.text).map((section) => <section key={section.key} className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">{section.title}</h2><p className="mt-2 text-sm leading-relaxed text-foreground">{polished[section.key] ?? section.text}</p>
      {section.facts.length > 0 && <details className="mt-4 border-t border-border/60 pt-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-bold text-muted-foreground">왜 이런 결과인가요?<ChevronDown className="h-4 w-4" /></summary><div className="space-y-3 pt-2">{section.facts.map((fact) => <div key={fact.id} className="rounded-xl bg-muted/35 p-3"><p className="text-xs font-semibold text-foreground">{fact.meaning}</p><p className="mt-1 text-[11px] text-muted-foreground">{fact.sources.map((source) => `${SYSTEM_LABEL[source.system]} · ${source.module} · ${source.factId}`).join(" / ")}</p></div>)}</div></details>}
    </section>)}
    {(report.standaloneFacts.length > 0 || report.unmappedFacts.length > 0) && <section className="ds-card ds-card-pad shadow-none"><h2 className="text-base font-bold text-foreground">체계별로 남은 해석</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">공통 taxonomy에 억지로 합치지 않고 원래 체계의 결과로 보존했습니다.</p><div className="mt-3 space-y-3">{[...report.standaloneFacts, ...report.unmappedFacts].slice(0, 8).map((fact) => <div key={`${fact.system}:${fact.module}:${fact.factId}`} className="rounded-xl bg-muted/35 p-3"><p className="text-xs font-semibold leading-relaxed text-foreground">{fact.meaning}</p><p className="mt-1 text-[11px] text-muted-foreground">{SYSTEM_LABEL[fact.system]} · {fact.factId}</p></div>)}</div></section>}
    <button type="button" onClick={copy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "복사했습니다" : "전체 AI 해석 프롬프트 복사"}</button>
  </div>;
}
