import { useState } from "react";
import type { EvidenceItem } from "@/lib/ziwei/types";

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

const PREVIEW_COUNT = 8;

/** 메인 문장과 근거를 시각적으로 분리한다(옅은 배경 박스) — 이전에는 밑줄 링크 하나로만
 * 구분돼 있었다. 근거가 많으면(재물/연애 종합 섹션 등 20개 넘는 경우) 전부 보여주지 않고
 * PREVIEW_COUNT개만 먼저 보여주되, "삭제된 것처럼" 느껴지지 않도록 총 개수와 표시 개수를
 * 항상 함께 표기하고 "전체보기"로 펼칠 수 있게 한다(대표 지시). */
export function EvidenceToggle({
  evidence, confidence,
}: {
  evidence: EvidenceItem[];
  confidence?: "high" | "medium" | "low";
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (evidence.length === 0) return null;

  const hasMore = evidence.length > PREVIEW_COUNT;
  const shown = showAll ? evidence : evidence.slice(0, PREVIEW_COUNT);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary underline underline-offset-2"
      >
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {shown.map((e, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {evidenceLabel(e)}
              </span>
            ))}
            {confidence && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                신뢰도: {confidence === "high" ? "높음" : confidence === "medium" ? "중간" : "낮음"}
              </span>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-[11px] font-semibold text-primary underline underline-offset-2"
            >
              {showAll
                ? `근거 ${evidence.length}개 · 전체 표시 — 접기`
                : `근거 ${evidence.length}개 · ${PREVIEW_COUNT}개 표시 — 전체보기`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
