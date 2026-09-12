import { useMemo } from "react";
import type { AnyCompatibilityReport } from "@/lib/reports";
import { buildSajuCompatibilitySections } from "@/lib/sajuCompatibilityFacts";
import { SajuSummaryBlock } from "@/components/saju/SajuSummaryUI";

export function SajuCompatibilitySummary({
  report,
}: {
  /** 두 사람 조합을 구분하는 키(예: `${p1.id}-${p2.id}`). */
  pairId: string;
  report: AnyCompatibilityReport;
}) {
  const sections = useMemo(() => buildSajuCompatibilitySections(report), [report]);

  return (
    <SajuSummaryBlock
      caption="관계 핵심 요약"
      sections={sections.map((s) => ({
        key: s.key, title: s.title, text: s.text, evidence: s.evidence, hasFacts: s.facts.length > 0,
      }))}
    />
  );
}
