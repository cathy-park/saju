import { useState } from "react";
import type { SynthesisSourceRef } from "@/lib/western/synthesis";

export function SynthesisEvidenceToggle({ sources }: { sources: SynthesisSourceRef[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return <div className="mt-4 border-t border-border/70 pt-3">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="min-h-11 text-sm font-semibold text-primary">왜 이런 결과인가요? <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <ul className="mt-2 space-y-3 text-xs leading-relaxed text-muted-foreground">{sources.map((source) => <li key={`${source.module}:${source.personId ?? source.pairId}:${source.factId}`}>
      <p className="font-semibold text-foreground">{source.module} · {source.factId}</p>
      <p className="mt-1 break-words">궁극 근거: {source.ultimateEvidenceIds.join(", ")}</p>
      {!!source.linkedNatalFactIds?.length && <p className="mt-1">연결된 출생차트 fact: {source.linkedNatalFactIds.join(", ")}</p>}
    </li>)}</ul>}
  </div>;
}
