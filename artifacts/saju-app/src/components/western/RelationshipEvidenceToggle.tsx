import { useState } from "react";
import type { RelationshipEvidence } from "@/lib/western/interpretation/romance";

export function RelationshipEvidenceToggle({ evidence }: { evidence: RelationshipEvidence[] }) {
  const [open, setOpen] = useState(false);
  if (evidence.length === 0) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 text-xs text-primary underline underline-offset-2">
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-2.5" aria-live="polite">
          {evidence.map((item) => <span key={item.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{item.label}{item.orbBand ? ` · ${item.orbBand}` : ""}</span>)}
        </div>
      )}
    </div>
  );
}
