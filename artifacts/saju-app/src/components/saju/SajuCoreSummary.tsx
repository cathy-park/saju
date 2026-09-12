import { useMemo } from "react";
import type { SajuPipelineResult } from "@/lib/sajuPipeline";
import type { BranchRelation } from "@/lib/branchRelations";
import type { ShinsalInterpretationEntry } from "@/lib/shinsalInterpretation";
import { buildSajuSummarySections } from "@/lib/sajuSummaryFacts";
import { SajuSummaryBlock } from "@/components/saju/SajuSummaryUI";

export function SajuCoreSummary({
  pipeline, branchRelations, shinsalEntries,
}: {
  personId: string;
  pipeline: SajuPipelineResult;
  branchRelations: BranchRelation[];
  shinsalEntries: ShinsalInterpretationEntry[];
}) {
  const sections = useMemo(
    () => buildSajuSummarySections(pipeline, branchRelations, shinsalEntries),
    [pipeline, branchRelations, shinsalEntries],
  );

  return (
    <SajuSummaryBlock
      caption="원국 핵심 요약"
      sections={sections.map((s) => ({
        key: s.key, title: s.title, text: s.text, evidence: s.evidence, hasFacts: s.facts.length > 0,
      }))}
    />
  );
}
