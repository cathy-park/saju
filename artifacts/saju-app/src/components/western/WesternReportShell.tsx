import type { ReactNode } from "react";
import { SystemSelector } from "@/components/SystemSelector";

export function WesternReportShell({ personId, sajuHref, westernHref, eyebrow, title, description, navigation, children }: { personId?: string; sajuHref?: string; westernHref?: string; eyebrow: string; title: string; description?: string; navigation: ReactNode; children: ReactNode }) {
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    {personId && sajuHref && <SystemSelector personId={personId} sajuHref={sajuHref} westernHref={westernHref} />}
    <header>
      <p className="text-xs font-semibold text-primary">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </header>
    {navigation}
    {children}
  </main>;
}
