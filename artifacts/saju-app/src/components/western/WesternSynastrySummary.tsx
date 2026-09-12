import type { WesternSynastryReport } from "@/lib/western/synastry";
import { SynastryEvidenceToggle } from "./SynastryEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternSynastrySummary({ report, polishedTexts = {} }: { report: WesternSynastryReport; polishedTexts?: Record<string, string> }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <WesternReportSection key={section.key} title={section.title} text={polishedTexts[section.key] ?? section.text} evidence={<SynastryEvidenceToggle evidence={section.primaryEvidence} />} />)}</div>;
}
