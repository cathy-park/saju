import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { spouseReportTimingYears } from "@/lib/ziwei/reports/spouseReport";
import {
  buildMarriageTimingReport, type MarriageTimingReport, type MarriageTimingYearCard, type TimingAxis,
} from "@/lib/ziwei/reports/marriageTimingReport";
import { polishStatementText } from "@/lib/ziwei/reports/proseLayer";
import type { EvidenceItem } from "@/lib/ziwei/types";

const PROSE_TOPIC = "marriageTiming";

const AXIS_LABEL: Record<TimingAxis, string> = {
  activation: "관계 활성화",
  stability: "안정화",
  formalization: "공식화 가능성",
  volatility: "변동성·주의",
};
const AXIS_BADGE_CLASS: Record<TimingAxis, string> = {
  activation: "bg-primary/10 text-primary",
  stability: "bg-emerald-500/10 text-emerald-700",
  formalization: "bg-sky-500/10 text-sky-700",
  volatility: "bg-amber-500/10 text-amber-700",
};
const SOURCE_LABEL: Record<NonNullable<EvidenceItem["source"]>, string> = {
  natal: "원국",
  major: "대한",
  annual: "유년",
};

function findPerson(personId: string): PersonRecord | null {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

function evidenceLabel(e: EvidenceItem): string {
  const prefix = e.source ? `[${SOURCE_LABEL[e.source]}] ` : "";
  switch (e.type) {
    case "star": return `${prefix}별: ${e.value}`;
    case "palace": return `${prefix}궁: ${e.value}`;
    case "transformation": return `${prefix}사화: ${e.value}`;
    case "period": return `${prefix}시기: ${e.value}`;
    default: return `${prefix}${e.value}`;
  }
}

function YearCard({ card, polishedText }: { card: MarriageTimingYearCard; polishedText?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{card.year}년</h3>
        <div className="flex flex-wrap gap-1 justify-end">
          {card.axes.map((axis) => (
            <span key={axis} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${AXIS_BADGE_CLASS[axis]}`}>
              {AXIS_LABEL[axis]}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground leading-relaxed">{polishedText ?? card.text}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 text-xs text-primary underline underline-offset-2"
      >
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.evidence.map((e, i) => (
            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {evidenceLabel(e)}
            </span>
          ))}
        </div>
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

function DetailTable({ report }: { report: MarriageTimingReport }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">연도별 전체 신호</h2>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        위 카드는 임계치를 넘은 해만 모은 것이고, 아래 표는 {spouseReportTimingYears()[0]}년부터{" "}
        {spouseReportTimingYears().at(-1)}년까지 전체 점수입니다. 각 숫자를 누르면 근거를 볼 수 있습니다.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-1.5 pr-2">연도</th>
              <th className="text-left py-1.5 pr-2">활성화</th>
              <th className="text-left py-1.5 pr-2">안정화</th>
              <th className="text-left py-1.5 pr-2">공식화</th>
              <th className="text-left py-1.5">변동성</th>
            </tr>
          </thead>
          <tbody>
            {report.signals.map((s) => (
              <tr key={s.year} className="border-b border-border/50">
                <td className="py-1.5 pr-2 font-medium text-foreground">{s.year}</td>
                <td className="py-1.5 pr-2"><AxisEvidencePopover label="활성화" score={s.activation.score} evidence={s.activation.evidence} /></td>
                <td className="py-1.5 pr-2"><AxisEvidencePopover label="안정화" score={s.stability.score} evidence={s.stability.evidence} /></td>
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

export default function ZiweiMarriageTimingReport() {
  const { personId } = useParams<{ personId: string }>();
  // findPerson()은 localStorage를 매번 새로 읽어 새 객체 참조를 반환하므로, personId로만
  // memoize해야 한다 — 그렇지 않으면 아래 report가 렌더마다 새 참조가 되어 report에 의존하는
  // useEffect(다듬기 효과)가 무한 루프를 돈다.
  const person = useMemo(() => (personId ? findPerson(personId) : null), [personId]);

  const { report, error } = useMemo(() => {
    if (!person) return { report: null, error: null };
    const input = person.birthInput;
    if (input.timeUnknown || input.hour === undefined) {
      return { report: null, error: "출생 시간이 없으면 자미두수 명반(命宮·夫妻宮 등)을 정확히 계산할 수 없습니다. 출생 시간을 입력해주세요." };
    }
    const chart = buildZiweiChart(
      {
        name: input.name, gender: input.gender, calendarType: input.calendarType,
        year: input.year, month: input.month, day: input.day,
        hour: input.hour, minute: input.minute, birthplace: input.birthplace,
      },
      zhongzhouV1,
      spouseReportTimingYears(),
    );
    return { report: buildMarriageTimingReport(chart, zhongzhouV1, input.name), error: null };
  }, [person]);

  // AI 문장 다듬기 — 연도×축(최대 60회)이 아니라 하이라이트된 연도 1개당 1회만 호출한다.
  // report.yearCards는 이미 축별 근거를 하나의 문단·fact 목록으로 묶어 둔 상태라, 여기서는
  // 그 묶음을 그대로 polishStatementText에 한 번씩만 넘긴다.
  const [polishedTexts, setPolishedTexts] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!report) return;
    setPolishedTexts({});
    let cancelled = false;
    for (const card of report.yearCards) {
      if (card.facts.length === 0) continue;
      polishStatementText(card.facts, card.text, PROSE_TOPIC, `year-${card.year}`).then((result) => {
        if (cancelled || result.source === "fallback") return;
        setPolishedTexts((prev) => ({ ...prev, [card.year]: result.text }));
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
      <Link href={`/ziwei/${personId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 주제 선택으로
      </Link>
      <h1 className="ds-title-lg">{person.birthInput.name}님의 결혼시기 리포트</h1>

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        report && (
          <>
            <div className="ds-card ds-card-pad shadow-none text-xs text-muted-foreground leading-relaxed">
              아래 연도는 "이 해에 결혼한다"는 예측이 아닙니다. 활성화가 높다고 반드시 결혼하기 좋은
              해는 아니며, 안정화·공식화 가능성·변동성과 함께 참고용으로만 봐주세요.
            </div>
            {report.yearCards.length === 0 ? (
              <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">
                뚜렷한 신호가 나타나는 해가 없습니다.
              </div>
            ) : (
              report.yearCards.map((card) => (
                <YearCard key={card.year} card={card} polishedText={polishedTexts[card.year]} />
              ))
            )}
            <DetailTable report={report} />
          </>
        )
      )}
    </div>
  );
}
