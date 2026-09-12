import type { WesternRelationshipReport } from "@/lib/western/interpretation/romance";
import { RelationshipEvidenceToggle } from "./RelationshipEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternRelationshipSummary({ report, polishedTexts = {} }: { report: WesternRelationshipReport; polishedTexts?: Record<string, string> }) {
  return <div className="ds-section-gap">{report.sections.map((section) => (
    <WesternReportSection key={section.key} title={section.title} text={polishedTexts[section.key] ?? section.text} evidence={<RelationshipEvidenceToggle evidence={section.primaryEvidence} />} />
  ))}</div>;
}
