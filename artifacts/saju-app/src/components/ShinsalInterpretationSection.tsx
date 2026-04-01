import type { ShinsalCombinationNote } from "@/lib/shinsalInterpretation";

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
          <div key={c.title} className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <div className="mb-1 flex flex-wrap gap-1">
              {c.members.map((m) => (
                <span key={m} className="ds-badge text-[11px] font-bold shadow-none">
                  {m}
                </span>
              ))}
            </div>
            <p className="text-[13px] font-semibold text-foreground">{c.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
