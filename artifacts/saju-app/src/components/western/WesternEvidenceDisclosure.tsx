import { useState, type ReactNode } from "react";

export function WesternEvidenceDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-2">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline">
      왜 이런 결과인가요? <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="mt-2 rounded-xl border border-border/60 bg-muted/30 p-3" aria-live="polite">{children}</div>}
  </div>;
}
