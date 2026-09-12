import type { WesternEvidenceItem } from "@/lib/western/interpretation";
import { WesternEvidenceDisclosure } from "./WesternEvidenceDisclosure";

export function WesternEvidenceToggle({ evidence }: { evidence: WesternEvidenceItem[] }) {
  if (evidence.length === 0) return null;
  return <WesternEvidenceDisclosure>
        <div className="flex flex-wrap gap-1.5">
          {evidence.map((item) => (
            <span key={item.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {item.label}{item.orbBand ? ` · ${item.orbBand}` : ""}
            </span>
          ))}
        </div>
  </WesternEvidenceDisclosure>;
}
