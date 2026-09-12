import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import { SynthesisEvidenceToggle } from "./SynthesisEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternSynthesisSummary({
  report, polishedTexts,
}: {
  report: WesternPersonalSynthesisReport | WesternRelationshipSynthesisReport;
  polishedTexts?: Record<string, string>;
}) {
  return <div className="ds-section-gap">{report.sections.filter((section) => section.facts.length > 0).map((section) => <WesternReportSection key={section.key} title={section.title} text={polishedTexts?.[section.key] ?? section.text} evidence={<SynthesisEvidenceToggle sources={section.primarySourceRefs} />} />)}</div>;
}
