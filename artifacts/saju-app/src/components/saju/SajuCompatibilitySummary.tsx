import { useEffect, useMemo, useState } from "react";
import type { AnyCompatibilityReport } from "@/lib/reports";
import { buildSajuCompatibilitySections } from "@/lib/sajuCompatibilityFacts";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { SajuSummaryBlock } from "@/components/saju/SajuSummaryUI";

const PROSE_TOPIC = "sajuCompatibility";

/** 9/10단계가 만든 팩토리를 그대로 재사용. */
const requestPolishedTexts = createPolishRequestCache(PROSE_TOPIC);

export function SajuCompatibilitySummary({
  pairId, report,
}: {
  /** 두 사람 조합을 구분하는 키(예: `${p1.id}-${p2.id}`) — 캐시·AI 호출 키에 포함된다. */
  pairId: string;
  report: AnyCompatibilityReport;
}) {
  const sections = useMemo(() => buildSajuCompatibilitySections(report), [report]);

  // sections는 report(=매 렌더 재계산되는 CompatibilityResult) 참조가 바뀔 때마다 새 객체로
  // 만들어진다. AI 호출 여부는 참조가 아니라 실제 내용으로 판단한다(9/10단계와 동일 이유).
  const sectionsContentKey = useMemo(
    () => sections.map((s) => `${s.key}:${s.text}`).join("|"),
    [sections],
  );
  const requestKey = `${pairId}-${sectionsContentKey}`;

  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    setPolishedTexts({});
    let cancelled = false;
    const timer = setTimeout(() => {
      requestPolishedTexts(sections, requestKey).then((results) => {
        if (!cancelled) setPolishedTexts(results);
      });
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
    // sections/pairId는 requestKey에 이미 포함돼 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return (
    <SajuSummaryBlock
      caption="관계 핵심 요약"
      polishedTexts={polishedTexts}
      sections={sections.map((s) => ({
        key: s.key, title: s.title, text: s.text, evidence: s.evidence, hasFacts: s.facts.length > 0,
      }))}
    />
  );
}
