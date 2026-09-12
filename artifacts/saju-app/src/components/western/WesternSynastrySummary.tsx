import type { WesternSynastryReport } from "@/lib/western/synastry";
import { SynastryEvidenceToggle } from "./SynastryEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternSynastrySummary({ report }: { report: WesternSynastryReport }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <WesternReportSection key={section.key} title={section.title} text={section.text} evidence={<SynastryEvidenceToggle evidence={section.primaryEvidence} />} />)}</div>;
}
