import type { EvidenceItem } from "@/lib/ziwei/types";
import { EvidenceDisclosure, EvidenceChipList } from "@/components/EvidenceDisclosure";

const SOURCE_LABEL: Record<NonNullable<EvidenceItem["source"]>, string> = {
  natal: "원국",
  major: "대한",
  annual: "유년",
};

export function evidenceLabel(e: EvidenceItem): string {
  const prefix = e.source ? `[${SOURCE_LABEL[e.source]}] ` : "";
  switch (e.type) {
    case "star": return `${prefix}별: ${e.value}`;
    case "palace": return `${prefix}궁: ${e.value}`;
    case "transformation": return `${prefix}사화: ${e.value}`;
    case "period": return `${prefix}시기: ${e.value}`;
    default: return `${prefix}${e.value}`;
  }
}

/** 자미두수 근거 토글 — 셸(버튼/열림 박스)은 공용 EvidenceDisclosure를 그대로 쓰고
 * (21단계, 사주·서양점성술과 문구·spacing·open/close를 통일), chip 목록만 자미두수
 * evidenceLabel()로 채운다. */
export function EvidenceToggle({
  evidence, confidence,
}: {
  evidence: EvidenceItem[];
  confidence?: "high" | "medium" | "low";
}) {
  if (evidence.length === 0) return null;
  const confidenceLabel = confidence
    ? `신뢰도: ${confidence === "high" ? "높음" : confidence === "medium" ? "중간" : "낮음"}`
    : undefined;
  return (
    <EvidenceDisclosure>
      <EvidenceChipList items={evidence.map(evidenceLabel)} extraLabel={confidenceLabel} />
    </EvidenceDisclosure>
  );
}
