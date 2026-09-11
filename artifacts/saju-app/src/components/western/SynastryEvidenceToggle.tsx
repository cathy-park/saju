import { useState } from "react";
import type { SynastryEvidenceView } from "@/lib/western/synastry";

export function SynastryEvidenceToggle({ evidence }: { evidence: SynastryEvidenceView[] }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;
  return <div className="mt-4 border-t border-border/70 pt-3">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="min-h-11 text-sm font-semibold text-primary">왜 이런 결과인가요? <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <ul className="mt-2 space-y-3 text-xs leading-relaxed text-muted-foreground">{evidence.map((item) => <li key={item.id}>
      <p className="font-semibold text-foreground">{item.label}</p>
      <p className="mt-1">출생차트 연결: {item.natalLinks.map((link) => link.kind === "natal-fact" ? `${link.personId} · ${link.factIds.join(", ")}` : `${link.personId} · ${link.context?.house ?? "-"}H 구조`).join(" / ")}</p>
    </li>)}</ul>}
  </div>;
}
