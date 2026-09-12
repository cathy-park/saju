import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { spouseReportTimingYears } from "@/lib/ziwei/reports/spouseReport";
import {
  buildMarriageTimingReport, type MarriageTimingReport, type MarriageTimingYearCard,
} from "@/lib/ziwei/reports/marriageTimingReport";
import { polishStatementText } from "@/lib/ziwei/reports/proseLayer";
import type { EvidenceItem } from "@/lib/ziwei/types";
import { ReportHeader } from "@/components/ziwei/ReportHeader";
import { EvidenceToggle, evidenceLabel } from "@/components/ziwei/EvidenceToggle";
import { AxisBadge } from "@/components/ziwei/AxisBadge";

const PROSE_TOPIC = "marriageTiming";

const DISCLAIMER = "아래 연도는 \"이 해에 결혼한다\"는 예측이 아닙니다. 활성화가 높다고 반드시 결혼하기 좋은 해는 아니며, 안정화·공식화 가능성·변동성과 함께 참고용으로만 봐주세요.";

function findPerson(personId: string): PersonRecord | null {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

function YearCard({ card, polishedText }: { card: MarriageTimingYearCard; polishedText?: string }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{card.year}년</h3>
        <div className="flex flex-wrap justify-end gap-1">
          {card.axes.map((axis) => <AxisBadge key={axis} axis={axis} />)}
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground leading-relaxed">{polishedText ?? card.text}</p>
      <EvidenceToggle evidence={card.evidence} />
    </div>
  );
}

/** 타고난 관계/배우자 baseline — 연도 목록 위에서 딱 한 번만 보여준다(21단계 대표 지시).
 * 모든 연도에 고정된 문장이라 AI 다듬기를 거치지 않고 deterministic 문장을 그대로 쓴다. */
function NatalBaselineCard({ natalBaseline }: { natalBaseline: MarriageTimingReport["natalBaseline"] }) {
  if (!natalBaseline) return null;
  return (
    <div className="ds-card ds-card-pad shadow-none border-primary/15 bg-primary/[0.03]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">타고난 관계 baseline</p>
      <p className="mt-1.5 text-sm text-foreground leading-relaxed">{natalBaseline.text}</p>
      <EvidenceToggle evidence={natalBaseline.evidence} />
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
      <ReportHeader personId={personId!} personName={person.birthInput.name} activeKey="marriageTiming" disclaimer={DISCLAIMER} />

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        report && (
          <>
            <NatalBaselineCard natalBaseline={report.natalBaseline} />
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
