import type { WesternSynastryReport } from "@/lib/western/synastry";
import { SynastryEvidenceToggle } from "./SynastryEvidenceToggle";

export function WesternSynastrySummary({ report, polishedTexts = {} }: { report: WesternSynastryReport; polishedTexts?: Record<string, string> }) {
  return <div className="ds-section-gap">{report.sections.map((section) => <section key={section.key} className="ds-card ds-card-pad shadow-none">
    <h2 className="text-base font-bold text-foreground">{section.title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-foreground">{polishedTexts[section.key] ?? section.text}</p>
    <SynastryEvidenceToggle evidence={section.primaryEvidence} />
  </section>)}</div>;
}
