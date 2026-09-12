import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { PersonRecord } from "@/lib/storage";
import type { TodayFortuneData } from "@/lib/todayFortune";
import type { LifeFlowInsightResult } from "@/lib/lifeFlowInsight";
import { buildExistingPersonalReports } from "@/lib/integrated/personReports";
import { adaptSajuPersonal, adaptWesternPersonal, adaptZiweiPersonal, buildIntegratedPersonalReport, type IntegratedReport } from "@/lib/integrated";
import { polishIntegratedHolistic, type HolisticArea } from "@/lib/integrated/prompt";
import { systemsForArea } from "@/lib/integrated/presentation";
import { monthInTimezone, monthRange, westernBirthSource } from "@/lib/western/uiModel";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";

const TOPICS = [["전체", "overview"], ["연애", "romance"], ["결혼", "marriagePartner"], ["재물", "wealthReality"], ["커리어", "careerWork"], ["건강", "healthRhythm"], ["현재 흐름", "currentFlow"]] as const;
const SYSTEM_LABEL = { saju: "사주", ziwei: "자미두수", western: "서양점성술" } as const;

export function HomeTodayFlow({ record, fortune, lifeFlow }: { record: PersonRecord; fortune: TodayFortuneData; lifeFlow: LifeFlowInsightResult | null }) {
  const [activeKey, setActiveKey] = useState("overview");
  const [report, setReport] = useState<IntegratedReport | null>(null);
  const [areas, setAreas] = useState<HolisticArea[]>([]);
  const existing = useMemo(() => buildExistingPersonalReports(record), [record.id]);
  useEffect(() => {
    let cancelled = false;
    const timezone = record.westernLocation?.timezone ?? "Asia/Seoul";
    const month = monthInTimezone(timezone); const range = monthRange(month);
    const scope = { start: range.start, end: range.end, timezone, granularity: "month" as const, sourcePeriodLabel: month };
    const base = [...adaptSajuPersonal(existing.saju, record.id), ...(existing.ziwei ? adaptZiweiPersonal(existing.ziwei, record.id) : [])];
    const finish = async (western?: WesternPersonalSynthesisReport) => {
      const next = buildIntegratedPersonalReport({ personId: record.id, sources: [...base, ...(western ? adaptWesternPersonal(western, scope) : [])], selectedPeriod: scope });
      if (cancelled) return; setReport(next); const polished = await polishIntegratedHolistic(next); if (!cancelled) setAreas(polished);
    };
    if (!record.westernLocation) { void finish(); return () => { cancelled = true; }; }
    const birth = westernBirthSource(record);
    fetch("/api/western-overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: record.id, birth, query: { startLocalDate: range.start, endLocalDate: range.end, timezone } }) })
      .then((response) => response.ok ? response.json() : Promise.reject()).then((data: { report: WesternPersonalSynthesisReport }) => finish(data.report)).catch(() => finish());
    return () => { cancelled = true; };
  }, [record.id, record.westernLocation, existing]);
  const selected = areas.find((area) => area.key === activeKey);
  const text = activeKey === "currentFlow" ? [selected?.text, fortune.guidance, lifeFlow?.overall.decisionTiming].filter(Boolean).join(" ") : selected?.text;
  const systems = report ? systemsForArea(report, activeKey) : [];
  return <section className="ds-stack-3" aria-label="주제별 나의 흐름"><div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"><div className="flex w-max gap-2" role="tablist">{TOPICS.map(([label, key]) => <button key={key} type="button" role="tab" aria-selected={activeKey === key} onClick={() => setActiveKey(key)} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-bold ${activeKey === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{label}</button>)}</div></div>{text && <div className="ds-card ds-card-pad shadow-none"><p className="text-sm leading-relaxed text-foreground">{text}</p><div className="mt-3 flex flex-wrap gap-1.5">{systems.map((system) => <span key={system} className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{SYSTEM_LABEL[system]}</span>)}</div><Link href={`/integrated/${record.id}/overview${activeKey === "currentFlow" ? `?month=${monthInTimezone(record.westernLocation?.timezone ?? "Asia/Seoul")}` : ""}`} className="mt-4 block text-right text-xs font-semibold text-primary">자세히 보기</Link></div>}</section>;
}
