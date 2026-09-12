import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import { SynthesisEvidenceToggle } from "./SynthesisEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternSynthesisSummary({
  report,
}: {
  report: WesternPersonalSynthesisReport | WesternRelationshipSynthesisReport;
}) {
  return <div className="ds-section-gap">{report.sections.filter((section) => section.facts.length > 0).map((section) => <WesternReportSection key={section.key} title={section.title} text={section.text} evidence={<SynthesisEvidenceToggle sources={section.primarySourceRefs} />} />)}</div>;
}
