import { WesternEvidenceToggle } from "./WesternEvidenceToggle";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";

export function WesternPersonalitySummary({ report, polishedTexts = {} }: { report: WesternPersonalityReport; polishedTexts?: Record<string, string> }) {
  return (
    <div className="ds-section-gap">
      {report.sections.map((section) => (
        <section key={section.key} className="ds-card ds-card-pad shadow-none">
          <h2 className="text-base font-bold text-foreground">{section.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{polishedTexts[section.key] ?? section.text}</p>
          <WesternEvidenceToggle evidence={section.evidence} />
        </section>
      ))}
    </div>
  );
}
