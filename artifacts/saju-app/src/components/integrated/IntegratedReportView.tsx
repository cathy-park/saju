import { useEffect, useState } from "react";
import { Check, Copy, ChevronDown } from "lucide-react";
import type { IntegratedReport } from "@/lib/integrated";
import { buildHolisticDeterministicText, polishIntegratedHolistic } from "@/lib/integrated/prompt";

const SYSTEM_LABEL = { saju: "사주", ziwei: "자미두수", western: "서양점성술" } as const;
const PERSONAL_GROUPS = [
  { title: "감정·관계", keys: ["emotionRelationship"] },
  { title: "일·커리어·재물", keys: ["workCareer", "moneyReality", "strengthGrowth"] },
  { title: "현재 흐름", keys: ["currentFlow"] },
] as const;
const RELATIONSHIP_GROUPS = [
  { title: "감정·관계", keys: ["attractionIntimacy", "emotionCommunication"] },
  { title: "갈등·조율과 지속", keys: ["conflictAdjustment", "longTerm"] },
  { title: "현재 흐름", keys: ["currentRelationshipFlow"] },
] as const;

export function IntegratedReportView({ report, copyPrompt }: { report: IntegratedReport; copyPrompt?: string }) {
  const [copied, setCopied] = useState(false);
  const [holistic, setHolistic] = useState(() => buildHolisticDeterministicText(report));
  useEffect(() => {
    setHolistic(buildHolisticDeterministicText(report));
    let cancelled = false;
    polishIntegratedHolistic(report).then((text) => { if (!cancelled) setHolistic(text); });
    return () => { cancelled = true; };
  }, [report]);
  const groups = report.scope === "personal" ? PERSONAL_GROUPS : RELATIONSHIP_GROUPS;
  const evidence = Array.from(new Map(
    report.sections.flatMap((section) => section.facts.flatMap((fact) => fact.sources.flatMap((source) =>
      source.evidence.map((item) => [`${source.system}:${item.label}`, { system: source.system, label: item.label }] as const),
    ))),
  ).values());
  const copy = async () => {
    if (!copyPrompt) return;
    await navigator.clipboard.writeText(copyPrompt); setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className="ds-section-gap">
    <div className="ds-card ds-card-pad shadow-none">
      <p className="text-sm font-semibold text-foreground">{report.availableSystems.map((system) => SYSTEM_LABEL[system]).join(" · ")}을 함께 살펴봤어요</p>
      {report.missingSystems.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.missingSystems.map((system) => SYSTEM_LABEL[system]).join(", ")}은 필요한 출생정보를 설정하면 함께 반영됩니다.</p>}
    </div>
    <section className="ds-card ds-card-pad border-primary/20 bg-primary/[0.03] shadow-none">
      <h2 className="text-base font-bold text-foreground">{report.scope === "personal" ? "나를 가장 잘 설명하는 핵심" : "관계를 가장 잘 설명하는 핵심"}</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{holistic}</p>
    </section>
    {groups.map((group) => {
      const sections = report.sections.filter((section) => (group.keys as readonly string[]).includes(section.key) && section.text);
      if (!sections.length) return null;
      return <section key={group.title} className="ds-card ds-card-pad shadow-none"><h2 className="text-base font-bold text-foreground">{group.title}</h2>{sections.map((section) => <p key={section.key} className="mt-2 text-sm leading-relaxed text-foreground">{section.text}</p>)}</section>;
    })}
    {evidence.length > 0 && <details className="ds-card ds-card-pad shadow-none"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-foreground">세 체계에서 확인한 근거<ChevronDown className="h-4 w-4" /></summary><div className="space-y-2 pt-3">{evidence.map((item) => <p key={`${item.system}:${item.label}`} className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{SYSTEM_LABEL[item.system]}</span> · {item.label}</p>)}</div></details>}
    {copyPrompt && <button type="button" onClick={copy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "복사했습니다" : "전체 AI 해석 프롬프트 복사"}</button>}
  </div>;
}
