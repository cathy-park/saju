import { WesternEvidenceToggle } from "./WesternEvidenceToggle";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";
import { WesternReportSection } from "./WesternReportSection";

export function WesternPersonalitySummary({ report, polishedTexts = {} }: { report: WesternPersonalityReport; polishedTexts?: Record<string, string> }) {
  return (
    <div className="ds-section-gap">
      {report.sections.map((section) => (
        <WesternReportSection key={section.key} title={section.title} text={polishedTexts[section.key] ?? section.text} evidence={<WesternEvidenceToggle evidence={section.evidence} />} />
      ))}
    </div>
  );
}
