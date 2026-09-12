import type { RelationshipEvidence } from "@/lib/western/interpretation/romance";
import { EvidenceDisclosure, EvidenceChipList } from "@/components/EvidenceDisclosure";

export function RelationshipEvidenceToggle({ evidence }: { evidence: RelationshipEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <EvidenceDisclosure>
      <EvidenceChipList items={evidence.map((item) => `${item.label}${item.orbBand ? ` · ${item.orbBand}` : ""}`)} />
    </EvidenceDisclosure>
  );
}
