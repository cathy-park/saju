import { useState, type ReactNode } from "react";

/** 근거 토글 공용 셸 — 자미두수 EvidenceToggle의 UX(버튼 문구 "[왜 이런 결과인가요?]" /
 * "근거 숨기기", 열림 박스 스타일 `rounded-lg border border-border/60 bg-muted/40 p-2.5`)를
 * 기준으로 사주·자미두수·서양점성술이 전부 이 컴포넌트 하나를 쓴다(21단계 대표 지시 —
 * "evidence UI 통합, 자미 EvidenceToggle UX 기준으로 문구·spacing·open/close 통일").
 *
 * 각 체계의 evidence 데이터 모델은 서로 다르다(자미=EvidenceItem, 사주=SajuEvidenceItem,
 * 서양점성술=WesternEvidenceItem/SynastryEvidenceView/TransitEvidence 등) — 이 컴포넌트는
 * "버튼 + 열림 박스"라는 셸만 통일하고, 안에 무엇을 보여줄지는 children으로 각 도메인이
 * 그대로 결정한다(데이터 모델을 억지로 합치지 않는다). 열림/닫힘 상태는 컴포넌트마다
 * 독립적으로 갖는다(이전 버전들과 동일 — 카드 여러 개를 동시에 열고 닫을 수 있어야 한다). */
export function EvidenceDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-11 text-xs text-primary underline underline-offset-2"
      >
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2.5" aria-live="polite">
          {children}
        </div>
      )}
    </div>
  );
}

/** 근거가 단순 chip 목록(문자열 라벨)으로 표현되는 경우 공용으로 쓰는 렌더러 — 자미두수·
 * 사주·서양점성술의 "aspect/합충형파해원진 목록" 같은 평면 목록에 재사용한다(20개 넘게
 * 쌓이는 경우가 있어 처음엔 PREVIEW_COUNT개만 보여주고 "전체보기"로 펼친다 — 대표 지시:
 * "삭제된 것처럼" 느껴지지 않도록 총 개수와 표시 개수를 항상 함께 표기). 근거 항목끼리
 * 구조가 복잡해 chip으로 요약할 수 없는 경우(자연어 목록 등)는 EvidenceDisclosure에
 * 직접 children을 넘기고 이 렌더러를 쓰지 않아도 된다. */
export function EvidenceChipList({
  items, extraLabel, previewCount = 8,
}: {
  items: string[];
  extraLabel?: string;
  previewCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = items.length > previewCount;
  const shown = showAll ? items : items.slice(0, previewCount);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((label, i) => (
          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {label}
          </span>
        ))}
        {extraLabel && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{extraLabel}</span>
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 min-h-11 text-[11px] font-semibold text-primary underline underline-offset-2"
        >
          {showAll
            ? `근거 ${items.length}개 · 전체 표시 — 접기`
            : `근거 ${items.length}개 · ${previewCount}개 표시 — 전체보기`}
        </button>
      )}
    </>
  );
}
