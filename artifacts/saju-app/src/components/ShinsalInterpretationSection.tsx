import type { ShinsalCombinationNote } from "@/lib/shinsalInterpretation";
import { cn } from "@/lib/utils";
import { SHINSAL_COLOR } from "@/lib/luckCycles";

/** 복합 신살 조합만 표시 (원국표 위 고정) */
export function ShinsalCombinationsCard({ combinations }: { combinations: ShinsalCombinationNote[] }) {
  if (combinations.length === 0) return null;
  return (
    <div className="ds-card shadow-none">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">복합 신살 조합</h3>
        <p className="mt-1 text-xs text-muted-foreground">동시에 성립할 때 참고할 만한 조합만 표시합니다.</p>
      </div>
      <div className="ds-card-pad space-y-3">
        {combinations.map((c) => (
          <div key={c.title} className="ds-inline-detail-nested space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {c.members.map((m) => (
                <span
                  key={m}
                  className={cn(
                    "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-bold shadow-none break-words",
                    SHINSAL_COLOR[m] ?? "border-border bg-muted/50 text-foreground",
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
            <p className="text-[13px] font-semibold text-foreground">{c.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
