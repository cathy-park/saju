import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { buildSpouseReport, spouseReportTimingYears, type SpouseReportSection, type SpouseStatement } from "@/lib/ziwei/reports/spouseReport";
import { polishStatementText } from "@/lib/ziwei/reports/proseLayer";
import type { EvidenceItem, ZiweiChart } from "@/lib/ziwei/types";
import { ReportHeader } from "@/components/ziwei/ReportHeader";
import { EvidenceToggle, evidenceLabel } from "@/components/ziwei/EvidenceToggle";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const PROSE_TOPIC = "spouse";

function findPerson(personId: string): PersonRecord | null {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

function StatementBlock({ statement, polishedText }: { statement: SpouseStatement; polishedText?: string }) {
  return (
    <div className="border-t border-border first:border-t-0 pt-3 first:pt-0 mt-3 first:mt-0">
      <p className="text-sm text-foreground leading-relaxed">{polishedText ?? statement.text}</p>
      <EvidenceToggle evidence={statement.evidence} confidence={statement.confidence} />
    </div>
  );
}

function SectionCard({ section, polishedText }: { section: SpouseReportSection; polishedText?: string }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">{section.title}</h2>
      {section.statements.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      ) : (
        section.statements.map((s, i) => (
          <StatementBlock key={i} statement={s} polishedText={i === 0 ? polishedText : undefined} />
        ))
      )}
    </div>
  );
}

function AxisEvidencePopover({ label, score, evidence }: { label: string; score: number; evidence: EvidenceItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`underline decoration-dotted ${score > 0 ? "text-foreground" : score < 0 ? "text-muted-foreground" : "text-muted-foreground/60"}`}
        title={`${label} 근거 보기`}
      >
        {score.toFixed(1)}
      </button>
      {open && (
        <div className="absolute z-10 left-0 top-full mt-1 w-56 rounded-lg border border-border bg-popover p-2 text-[11px] shadow-sm">
          {evidence.length === 0 ? (
            <p className="text-muted-foreground">근거 없음</p>
          ) : (
            evidence.map((e, i) => <p key={i} className="text-muted-foreground">{evidenceLabel(e)}</p>)
          )}
        </div>
      )}
    </span>
  );
}

function TimingSection({ report }: { report: ReturnType<typeof buildSpouseReport> }) {
  const { timing } = report;
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">{timing.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        아래 점수는 "이 해에 결혼한다"는 예측이 아닙니다. 활성도가 높다고 반드시 결혼하기 좋은 해는
        아니며, 안정도·공식화·변동성 점수와 함께 참고용으로만 봐주세요. 각 숫자를 누르면 근거를
        볼 수 있습니다.
      </p>

      <div className="mt-3 space-y-2">
        {([
          ["활성도가 뚜렷한 해", timing.highlights.activationYears, "bg-primary/10 text-primary"],
          ["안정도가 뚜렷한 해", timing.highlights.stabilityYears, "bg-emerald-500/10 text-emerald-700"],
          ["공식화 신호가 있는 해", timing.highlights.formalizationYears, "bg-sky-500/10 text-sky-700"],
          ["변곡점(변동성 주의)", timing.highlights.volatilityYears, "bg-amber-500/10 text-amber-700"],
        ] as const).map(([label, ys, cls]) =>
          ys.length > 0 ? (
            <div key={label}>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {ys.map((y) => (
                  <span key={y} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{y}년</span>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-1.5 pr-2">연도</th>
              <th className="text-left py-1.5 pr-2">활성도</th>
              <th className="text-left py-1.5 pr-2">안정도</th>
              <th className="text-left py-1.5 pr-2">공식화</th>
              <th className="text-left py-1.5">변동성</th>
            </tr>
          </thead>
          <tbody>
            {timing.signals.map((s) => (
              <tr key={s.year} className="border-b border-border/50">
                <td className="py-1.5 pr-2 font-medium text-foreground">{s.year}</td>
                <td className="py-1.5 pr-2"><AxisEvidencePopover label="활성도" score={s.activation.score} evidence={s.activation.evidence} /></td>
                <td className="py-1.5 pr-2"><AxisEvidencePopover label="안정도" score={s.stability.score} evidence={s.stability.evidence} /></td>
                <td className="py-1.5 pr-2"><AxisEvidencePopover label="공식화" score={s.formalization.score} evidence={s.formalization.evidence} /></td>
                <td className="py-1.5"><AxisEvidencePopover label="변동성" score={s.volatility.score} evidence={s.volatility.evidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartAccordion({ chart }: { chart: ZiweiChart }) {
  return (
    <Accordion type="single" collapsible className="ds-card shadow-none px-4">
      <AccordionItem value="chart" className="border-b-0">
        <AccordionTrigger className="text-sm font-semibold">
          [내 자미두수 명반 자세히 보기]
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2">
            {chart.palaces.map((p) => (
              <div key={p.palace} className="rounded-lg border border-border p-2 text-xs">
                <div className="font-semibold text-foreground">{p.palace} ({p.branch})</div>
                <div className="mt-1 text-muted-foreground">
                  {[...p.majorStars, ...p.minorStars].map((s) => s.name).join(", ") || "空宮"}
                </div>
                {p.transformations.length > 0 && (
                  <div className="mt-1 text-primary">{p.transformations.join(" ")}</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
            <p>五行局: {chart.fiveElementBureau.name}</p>
            <p>命宮: {chart.mingGong.branch} / 身宮: {chart.shenGong.branch}({chart.shenGong.palace})</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default function ZiweiSpouseReport() {
  const { personId } = useParams<{ personId: string }>();
  // findPerson()은 localStorage를 매번 새로 읽어 새 객체 참조를 반환하므로, personId로만
  // memoize해야 한다 — 그렇지 않으면 아래 report가 렌더마다 새 참조가 되어 report에 의존하는
  // useEffect(다듬기 효과)가 무한 루프를 돈다.
  const person = useMemo(() => (personId ? findPerson(personId) : null), [personId]);

  const { chart, report, error } = useMemo(() => {
    if (!person) return { chart: null, report: null, error: null };
    const input = person.birthInput;
    if (input.timeUnknown || input.hour === undefined) {
      return { chart: null, report: null, error: "출생 시간이 없으면 자미두수 명반(命宮·身宮·十二宮)을 정확히 계산할 수 없습니다. 출생 시간을 입력해주세요." };
    }
    const built = buildZiweiChart(
      {
        name: input.name,
        gender: input.gender,
        calendarType: input.calendarType,
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.hour,
        minute: input.minute,
        birthplace: input.birthplace,
      },
      zhongzhouV1,
      spouseReportTimingYears(),
    );
    return { chart: built, report: buildSpouseReport(built, input.name), error: null };
  }, [person]);

  // AI 문장 다듬기(prose layer) — 결정론적 리포트는 이미 위에서 즉시 렌더된다. 이 effect는
  // 백그라운드로 각 섹션의 첫 statement만 다듬어 순차적으로 교체한다(progressive enhancement).
  // 로그인하지 않았거나 API가 실패하면 polishStatementText가 deterministic 문장을 그대로
  // 반환하므로, 이 페이지는 항상 안전하게 동작한다.
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!report) return;
    setPolishedTexts({});
    let cancelled = false;
    for (const section of report.sections) {
      const first = section.statements[0];
      if (!first || first.facts.length === 0) continue;
      polishStatementText(first.facts, first.text, PROSE_TOPIC, section.key).then((result) => {
        if (cancelled || result.source === "fallback") return;
        setPolishedTexts((prev) => ({ ...prev, [section.key]: result.text }));
      });
    }
    return () => { cancelled = true; };
  }, [report]);

  if (!person) {
    return (
      <div className="ds-app-shell ds-page-pad py-8 text-center">
        <p className="ds-subtitle mb-4 block">사람을 찾을 수 없습니다</p>
        <Link href="/ziwei"><span className="text-sm text-primary underline">목록으로</span></Link>
      </div>
    );
  }

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
      <ReportHeader personId={personId!} personName={person.birthInput.name} activeKey="spouse" />

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        chart && report && (
          <>
            {report.sections.map((section) => (
              <SectionCard key={section.key} section={section} polishedText={polishedTexts[section.key]} />
            ))}
            <TimingSection report={report} />
            <ChartAccordion chart={chart} />
          </>
        )
      )}
    </div>
  );
}
