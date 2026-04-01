import { cn } from "@/lib/utils";
import type { ShinsalCombinationNote, ShinsalInterpretationEntry } from "@/lib/shinsalInterpretation";
import { SHINSAL_COLOR } from "@/lib/luckCycles";
import type { InfoSheetType } from "@/components/InfoBottomSheet";

interface ShinsalInterpretationSectionProps {
  entries: ShinsalInterpretationEntry[];
  combinations: ShinsalCombinationNote[];
  onOpenDetail: (payload: InfoSheetType) => void;
}

export function ShinsalInterpretationSection({
  entries,
  combinations,
  onOpenDetail,
}: ShinsalInterpretationSectionProps) {
  return (
    <div className="space-y-4">
      {combinations.length > 0 && (
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
      )}

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="ds-card shadow-none">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    onOpenDetail({
                      kind: "shinsal",
                      name: e.name,
                      source: "auto",
                      trigger: e.triggerDetail || undefined,
                    })
                  }
                  className={cn(
                    "ds-badge mb-2 text-[13px] font-extrabold shadow-none transition-opacity hover:opacity-90",
                    SHINSAL_COLOR[e.name] ?? "bg-muted text-foreground",
                  )}
                >
                  {e.name}
                </button>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{e.pillar}</span>
                  {" · "}
                  {e.anchor === "주전체" ? "주 전체" : e.anchor}에 표시
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 text-right sm:items-end">
                <span className="ds-badge bg-muted/50 text-[10px] font-bold uppercase tracking-wide text-muted-foreground shadow-none">
                  {e.basisLabel}
                </span>
              </div>
            </div>
            <div className="ds-card-pad space-y-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">영향 영역</p>
                <p className="text-sm text-foreground">{e.influenceDomain}</p>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">활성·연동</p>
                <div className="flex flex-wrap gap-1.5">
                  {e.activationStates.map((t) => (
                    <span key={t} className="ds-badge text-[11px] font-medium shadow-none">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-foreground/90">{e.oneLine}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
