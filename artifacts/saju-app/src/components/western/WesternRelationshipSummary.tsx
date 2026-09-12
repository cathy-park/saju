import type { WesternRelationshipReport } from "@/lib/western/interpretation/romance";
import { RelationshipEvidenceToggle } from "./RelationshipEvidenceToggle";
import { WesternReportSection } from "./WesternReportSection";

export function WesternRelationshipSummary({ report }: { report: WesternRelationshipReport }) {
  return <div className="ds-section-gap">{report.sections.map((section) => (
    <WesternReportSection key={section.key} title={section.title} text={section.text} evidence={<RelationshipEvidenceToggle evidence={section.primaryEvidence} />} />
  ))}</div>;
}
