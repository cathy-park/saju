import type { MaritalStatus } from "@/lib/storage";

export const MARITAL_OPTIONS: { value: MaritalStatus; icon: string }[] = [
  { value: "솔로",   icon: "🌸" },
  { value: "연애중", icon: "💑" },
  { value: "기혼",   icon: "💍" },
  { value: "모름",   icon: "🔒" },
];

export function MaritalField({
  value,
  onChange,
}: {
  value: MaritalStatus | undefined;
  onChange: (v: MaritalStatus | undefined) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5 mb-1">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">나의 현재 상태</p>
      <div className="flex flex-wrap gap-2">
        {MARITAL_OPTIONS.map(({ value: v, icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(active ? undefined : v)}
              className={`text-[13px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {icon} {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MaritalBadge({ status }: { status: MaritalStatus | undefined }) {
  if (!status) return null;
  const opt = MARITAL_OPTIONS.find(o => o.value === status);
  return (
    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border">
      {opt?.icon} {status}
    </span>
  );
}
