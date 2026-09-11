import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport } from "@/lib/western/synthesis";
import { SynthesisEvidenceToggle } from "./SynthesisEvidenceToggle";

export function WesternSynthesisSummary({ report }: { report: WesternPersonalSynthesisReport | WesternRelationshipSynthesisReport }) {
  return <div className="ds-section-gap">{report.sections.filter((section) => section.facts.length > 0).map((section) => <section key={section.key} className="ds-card ds-card-pad shadow-none">
    <h2 className="text-base font-bold text-foreground">{section.title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-foreground">{section.text}</p>
    <SynthesisEvidenceToggle sources={section.primarySourceRefs} />
  </section>)}</div>;
}
