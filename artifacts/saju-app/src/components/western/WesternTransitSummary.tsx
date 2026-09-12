import type { WesternTransitReport } from "@/lib/western/transit";
import { TransitEvidenceToggle } from "./TransitEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";
import { presentTransitSection } from "@/lib/western/transit/presentation";

export function WesternTransitSummary({ report }: { report: WesternTransitReport }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <WesternReportSection key={section.key} title={section.title} text={presentTransitSection(report, section)} evidence={<TransitEvidenceToggle evidence={section.primaryEvidence} events={report.timeline.events} />} />)}</div>;
}
