import type { WesternEvidenceItem } from "@/lib/western/interpretation";
import { EvidenceDisclosure, EvidenceChipList } from "@/components/EvidenceDisclosure";

export function WesternEvidenceToggle({ evidence }: { evidence: WesternEvidenceItem[] }) {
  if (evidence.length === 0) return null;
  return (
    <EvidenceDisclosure>
      <EvidenceChipList items={evidence.map((item) => `${item.label}${item.orbBand ? ` · ${item.orbBand}` : ""}`)} />
    </EvidenceDisclosure>
  );
}
