import type { SynastryEvidenceView } from "@/lib/western/synastry";
import { WesternEvidenceDisclosure } from "./WesternEvidenceDisclosure";

export function SynastryEvidenceToggle({ evidence }: { evidence: SynastryEvidenceView[] }) {
  if (!evidence.length) return null;
  return <WesternEvidenceDisclosure><ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">{evidence.map((item) => <li key={item.id}>
      <p className="font-semibold text-foreground">{item.label}</p>
      <p className="mt-1">출생차트 연결: {item.natalLinks.map((link) => link.kind === "natal-fact" ? `${link.personId} · ${link.factIds.join(", ")}` : `${link.personId} · ${link.context?.house ?? "-"}H 구조`).join(" / ")}</p>
    </li>)}</ul></WesternEvidenceDisclosure>;
}
