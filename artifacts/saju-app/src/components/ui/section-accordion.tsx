import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// 12단계 UI·요약 구조 정리 — SajuReport.tsx와 Compatibility.tsx가 각자 독립적으로 정의해
// 중복돼 있던 두 접기 컴포넌트를 그대로(시각 스타일 변경 없이) 이 파일 하나로 옮긴다.
// AccSection(구분선형)과 CardAccordion(카드형)은 서로 다른 시각 스타일이라 하나로 합치지
// 않는다 — 스타일 통일은 21단계(전체 디자인 통일) 몫이다. 여기서는 중복 제거만 한다.

/** 구분선 + 제목 버튼 스타일 접기 섹션. SajuReport.tsx 원국/성격해석 탭에서 쓰던 것과
 * 완전히 동일한 마크업(마이그레이션 전 코드 그대로). */
export function AccSection({
  title,
  defaultOpen = false,
  titleExtra,
  children,
  id,
}: {
  title: string;
  defaultOpen?: boolean;
  titleExtra?: ReactNode;
  children: ReactNode;
  /** 스크롤 앵커(핵심 한눈에 보기 등) */
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="scroll-mt-4 border-t border-border/40 pt-1">
      <div className="flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between py-3 group min-w-0"
        >
          <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
            {title}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 ml-2 shrink-0",
              open && "rotate-180",
            )}
          />
        </button>
        {titleExtra && (
          <div className="pl-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {titleExtra}
          </div>
        )}
      </div>
      <div className={cn("space-y-4 pb-2", !open && "hidden")}>{children}</div>
    </div>
  );
}

/** 카드 셸 + 헤더 바 스타일 접기 섹션. Compatibility.tsx에서 쓰던 것과 완전히 동일한
 * 마크업(마이그레이션 전 코드 그대로) — 닫혀 있으면 children을 아예 마운트하지 않는다. */
export function CardAccordion({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** 카드 테두리 색 등 기존에 개별 카드가 쓰던 미세한 톤 차이(예: 배우자 카드의 rose 테두리)를
   * 유지하기 위한 선택적 override — 새 스타일을 추가하는 용도가 아니라 이미 있던 스타일을
   * 그대로 옮기기 위함이다. */
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/35 transition-colors"
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}
