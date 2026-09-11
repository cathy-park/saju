import type { WesternTransitReport } from "@/lib/western/transit";
import { TransitEvidenceToggle } from "./TransitEvidenceToggle";

export function WesternTransitSummary({ report, polishedTexts = {} }: { report: WesternTransitReport; polishedTexts?: Record<string, string> }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <section key={section.key} className="ds-card ds-card-pad shadow-none">
    <h2 className="text-base font-bold text-foreground">{section.title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-foreground">{polishedTexts[section.key] ?? section.text}</p>
    <TransitEvidenceToggle evidence={section.primaryEvidence} events={report.timeline.events} />
  </section>)}</div>;
}
