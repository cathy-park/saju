import { useEffect, useMemo, useState } from "react";
import type { SajuPipelineResult } from "@/lib/sajuPipeline";
import { buildSajuMonthlySections, type SajuMonthlySummarySection } from "@/lib/sajuMonthlyFacts";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { SajuEvidenceToggle } from "@/components/saju/SajuCoreSummary";

const PROSE_TOPIC = "sajuMonthly";

/** 9단계가 만든 팩토리를 그대로 재사용 — 컴포넌트가 언마운트·재마운트돼도, 그리고 같은 달을
 * 다시 선택해도 동일 content key에 대해 요청을 다시 보내지 않는다. */
const requestPolishedTexts = createPolishRequestCache(PROSE_TOPIC);

function SectionCard({ section, polishedText }: { section: SajuMonthlySummarySection; polishedText?: string }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h3 className="text-base font-bold text-foreground">{section.title}</h3>
      {section.text ? (
        <>
          <p className="mt-2 text-sm text-foreground leading-relaxed">{polishedText ?? section.text}</p>
          <SajuEvidenceToggle evidence={section.evidence} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      )}
    </div>
  );
}

export function SajuMonthlySummary({
  personId, pipeline, selectedWolun,
}: {
  personId: string;
  pipeline: SajuPipelineResult;
  selectedWolun: { year: number; month: number };
}) {
  const sections = useMemo(() => buildSajuMonthlySections(pipeline), [pipeline]);

  const sectionsContentKey = useMemo(
    () => sections.map((s) => `${s.key}:${s.text}`).join("|"),
    [sections],
  );

  // personId+연월을 content key에 포함해, 같은 인물의 같은 달을 다시 선택하면(=내용이 같으면)
  // 캐시를 그대로 써서 재요청하지 않는다. 12개월을 미리 부르지 않고 지금 선택된 달만 부른다.
  const requestKey = `${personId}-${selectedWolun.year}-${selectedWolun.month}-${sectionsContentKey}`;

  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    // 월을 바꾸면 섹션 키(atAGlance 등)는 그대로인데 내용은 실제로 달라지므로, 이전 달의
    // 다듬은 문장이 새 달 화면에 잠깐이라도 겹쳐 보이지 않도록 즉시 비운다(원국 요약과 달리
    // 여기서는 "내용이 실제로 자주 바뀌는" 상황이 정상 케이스라 초기화가 필요하다).
    setPolishedTexts({});
    let cancelled = false;
    const timer = setTimeout(() => {
      requestPolishedTexts(sections, requestKey).then((results) => {
        if (!cancelled) setPolishedTexts(results);
      });
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
    // sections/personId는 requestKey에 이미 포함돼 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return (
    <div className="ds-stack-2">
      <p className="ds-caption font-semibold uppercase tracking-wide">
        {selectedWolun.year}년 {selectedWolun.month}월 핵심 요약
      </p>
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} polishedText={polishedTexts[section.key]} />
      ))}
    </div>
  );
}
