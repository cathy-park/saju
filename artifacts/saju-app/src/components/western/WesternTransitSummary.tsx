import type { WesternTransitReport } from "@/lib/western/transit";
import { TransitEvidenceToggle } from "./TransitEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternTransitSummary({ report, polishedTexts = {} }: { report: WesternTransitReport; polishedTexts?: Record<string, string> }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <WesternReportSection key={section.key} title={section.title} text={polishedTexts[section.key] ?? section.text} evidence={<TransitEvidenceToggle evidence={section.primaryEvidence} events={report.timeline.events} />} />)}</div>;
}
