import type { SynthesisSourceRef } from "@/lib/western/synthesis";
import { WesternEvidenceDisclosure } from "./WesternEvidenceDisclosure";

export function SynthesisEvidenceToggle({ sources }: { sources: SynthesisSourceRef[] }) {
  if (!sources.length) return null;
  return <WesternEvidenceDisclosure><ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">{sources.map((source) => <li key={`${source.module}:${source.personId ?? source.pairId}:${source.factId}`}>
      <p className="font-semibold text-foreground">{source.module} · {source.factId}</p>
      <p className="mt-1 break-words">궁극 근거: {source.ultimateEvidenceIds.join(", ")}</p>
      {!!source.linkedNatalFactIds?.length && <p className="mt-1">연결된 출생차트 fact: {source.linkedNatalFactIds.join(", ")}</p>}
    </li>)}</ul></WesternEvidenceDisclosure>;
}
