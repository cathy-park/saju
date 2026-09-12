import { useMemo } from "react";
import type { SajuPipelineResult } from "@/lib/sajuPipeline";
import { buildSajuMonthlySections } from "@/lib/sajuMonthlyFacts";
import { SajuSummaryBlock } from "@/components/saju/SajuSummaryUI";

export function SajuMonthlySummary({
  pipeline, selectedWolun,
}: {
  personId: string;
  pipeline: SajuPipelineResult;
  selectedWolun: { year: number; month: number };
}) {
  const sections = useMemo(() => buildSajuMonthlySections(pipeline), [pipeline]);

  return (
    <SajuSummaryBlock
      caption={`${selectedWolun.year}년 ${selectedWolun.month}월 핵심 요약`}
      sections={sections.map((s) => ({
        key: s.key, title: s.title, text: s.text, evidence: s.evidence, hasFacts: s.facts.length > 0,
      }))}
    />
  );
}
