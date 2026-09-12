import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { buildCareerReport, type CareerReportSection } from "@/lib/ziwei/reports/careerReport";
import type { SpouseStatement } from "@/lib/ziwei/reports/spouseReport";
import { ReportHeader } from "@/components/ziwei/ReportHeader";
import { EvidenceToggle } from "@/components/ziwei/EvidenceToggle";

function findPerson(personId: string): PersonRecord | null {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

function StatementBlock({ statement }: { statement: SpouseStatement }) {
  return (
    <div className="border-t border-border first:border-t-0 pt-3 first:pt-0 mt-3 first:mt-0">
      <p className="text-sm text-foreground leading-relaxed">{statement.text}</p>
      <EvidenceToggle evidence={statement.evidence} confidence={statement.confidence} />
    </div>
  );
}

function SectionCard({ section }: { section: CareerReportSection }) {
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

export default function ZiweiCareerReport() {
  const { personId } = useParams<{ personId: string }>();
  const person = useMemo(() => (personId ? findPerson(personId) : null), [personId]);

  const { report, error } = useMemo(() => {
    if (!person) return { report: null, error: null };
    const input = person.birthInput;
    if (input.timeUnknown || input.hour === undefined) {
      return { report: null, error: "출생 시간이 없으면 자미두수 명반(命宮·事業宮 등)을 정확히 계산할 수 없습니다. 출생 시간을 입력해주세요." };
    }
    const chart = buildZiweiChart(
      {
        name: input.name, gender: input.gender, calendarType: input.calendarType,
        year: input.year, month: input.month, day: input.day,
        hour: input.hour, minute: input.minute, birthplace: input.birthplace,
      },
      zhongzhouV1,
    );
    return { report: buildCareerReport(chart, input.name), error: null };
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
      <ReportHeader personId={personId!} personName={person.birthInput.name} activeKey="career" />

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        report && report.sections.map((section) => <SectionCard key={section.key} section={section} />)
      )}
    </div>
  );
}
