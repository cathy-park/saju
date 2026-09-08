import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { buildZiweiChart } from "@/lib/ziwei/buildZiweiChart";
import { zhongzhouV1 } from "@/lib/ziwei/ruleSets/zhongzhouV1";
import { spouseReportTimingYears } from "@/lib/ziwei/reports/spouseReport";
import { buildComprehensiveReport, type ComprehensiveReport, type ComprehensiveSection } from "@/lib/ziwei/reports/comprehensiveReport";
import { polishStatementText } from "@/lib/ziwei/reports/proseLayer";
import type { EvidenceItem } from "@/lib/ziwei/types";

const PROSE_TOPIC = "overview";

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

function SectionCard({ section, polishedText }: { section: ComprehensiveSection; polishedText?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h2 className="text-base font-bold text-foreground">{section.title}</h2>
      {section.text ? (
        <>
          <p className="mt-2 text-sm text-foreground leading-relaxed">{polishedText ?? section.text}</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 text-xs text-primary underline underline-offset-2"
          >
            {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
          </button>
          {open && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.evidence.map((e, i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {evidenceLabel(e)}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      )}
    </div>
  );
}

export default function ZiweiComprehensiveReport() {
  const { personId } = useParams<{ personId: string }>();
  // findPerson()은 localStorage를 매번 새로 읽어 새 객체 참조를 반환하므로, personId로만
  // memoize해야 한다 — 그렇지 않으면 아래 report가 렌더마다 새 참조가 되어 report에 의존하는
  // useEffect(다듬기 효과)가 무한 루프를 돈다.
  const person = useMemo(() => (personId ? findPerson(personId) : null), [personId]);

  const { report, error } = useMemo((): { report: ComprehensiveReport | null; error: string | null } => {
    if (!person) return { report: null, error: null };
    const input = person.birthInput;
    if (input.timeUnknown || input.hour === undefined) {
      return { report: null, error: "출생 시간이 없으면 자미두수 명반을 정확히 계산할 수 없습니다. 출생 시간을 입력해주세요." };
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
    return { report: buildComprehensiveReport(chart, zhongzhouV1, input.name), error: null };
  }, [person]);

  // AI 문장 다듬기 — 5개 섹션당 정확히 1회씩, 총 5회만 호출한다(섹션마다 이미 deterministic
  // synthesis를 마친 facts/text 묶음을 그대로 넘길 뿐, AI가 새 해석을 추가하지 않는다).
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!report) return;
    setPolishedTexts({});
    let cancelled = false;
    for (const section of report.sections) {
      if (section.facts.length === 0) continue;
      polishStatementText(section.facts, section.text, PROSE_TOPIC, section.key).then((result) => {
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
      <Link href={`/ziwei/${personId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 주제 선택으로
      </Link>
      <h1 className="ds-title-lg">{person.birthInput.name}님의 종합 리포트</h1>

      {error ? (
        <div className="ds-card ds-card-pad shadow-none text-sm text-muted-foreground">{error}</div>
      ) : (
        report && report.sections.map((section) => (
          <SectionCard key={section.key} section={section} polishedText={polishedTexts[section.key]} />
        ))
      )}
    </div>
  );
}
