import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { buildSpouseReport, spouseReportTimingYears, type SpouseReportSection, type SpouseStatement } from "@/lib/ziwei/reports/spouseReport";
import type { EvidenceItem, ZiweiChart } from "@/lib/ziwei/types";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

function findPerson(personId: string): PersonRecord | null {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

function evidenceLabel(e: EvidenceItem): string {
  switch (e.type) {
    case "star": return `별: ${e.value}`;
    case "palace": return `궁: ${e.value}`;
    case "transformation": return `사화: ${e.value}`;
    case "period": return `시기: ${e.value}`;
    default: return e.value;
  }
}

function StatementBlock({ statement }: { statement: SpouseStatement }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border first:border-t-0 pt-3 first:pt-0 mt-3 first:mt-0">
      <p className="text-sm text-foreground leading-relaxed">{statement.text}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 text-xs text-primary underline underline-offset-2"
      >
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {statement.evidence.map((e, i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {evidenceLabel(e)}
            </span>
          ))}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            신뢰도: {statement.confidence === "high" ? "높음" : statement.confidence === "medium" ? "중간" : "낮음"}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section }: { section: SpouseReportSection }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">{section.title}</h2>
      {section.statements.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      ) : (
        section.statements.map((s, i) => <StatementBlock key={i} statement={s} />)
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

      {timing.notableYears.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {timing.notableYears.map((y) => (
            <span key={y} className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
              {y}년 — 신호 겹침
            </span>
          ))}
        </div>
      )}

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
  const person = personId ? findPerson(personId) : null;

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
      <Link href={`/ziwei/${personId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 주제 선택으로
      </Link>
      <h1 className="ds-title-lg">{person.birthInput.name}님의 배우자 리포트</h1>

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        chart && report && (
          <>
            {report.sections.map((section) => (
              <SectionCard key={section.key} section={section} />
            ))}
            <TimingSection report={report} />
            <ChartAccordion chart={chart} />
          </>
        )
      )}
    </div>
  );
}
