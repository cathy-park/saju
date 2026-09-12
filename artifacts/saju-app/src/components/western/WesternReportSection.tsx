import type { ReactNode } from "react";

export function WesternReportSection({ title, text, evidence }: { title: string; text: string; evidence?: ReactNode }) {
  return <section className="ds-card ds-card-pad shadow-none">
    <h2 className="text-base font-bold text-foreground">{title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-foreground">{text}</p>
    {evidence}
  </section>;
}
