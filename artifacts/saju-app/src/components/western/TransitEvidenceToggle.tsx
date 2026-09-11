import { useState } from "react";
import type { TransitEvidence, TransitEvent } from "@/lib/western/transit";

export function TransitEvidenceToggle({ evidence, events }: { evidence: TransitEvidence[]; events: TransitEvent[] }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;
  return <div className="mt-4 border-t border-border/70 pt-3">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="min-h-11 text-sm font-semibold text-primary">
      왜 이런 결과인가요? <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <ul className="mt-2 space-y-3 text-xs leading-relaxed text-muted-foreground">
      {evidence.map((item) => { const event = events.find((candidate) => candidate.id === item.eventId); return <li key={item.eventId}>
        <p className="font-semibold text-foreground">{item.label}</p>
        {event && <p className="mt-1">영향 구간 {event.windowStart} ~ {event.windowEnd}<br />정확 시점 {event.exactHits.join(", ") || "구간 내 exact hit 없음"}</p>}
        <p className="mt-1">연결 근거: {item.natalLink.kind === "natal-fact" ? item.natalLink.factIds.join(", ") : item.natalLink.kind === "structural-context" ? `${item.natalLink.context.sign} · ${item.natalLink.context.house ?? "-"}H 구조` : "기술적 활성"}</p>
      </li>; })}
    </ul>}
  </div>;
}
