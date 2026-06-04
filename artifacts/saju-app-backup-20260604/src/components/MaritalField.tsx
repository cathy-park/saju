import type { MaritalStatus } from "@/lib/storage";

/** Display-only extension for 관계 `other` → 기타 뱃지 */
export type MaritalBadgeStatus = MaritalStatus | "기타";

export const MARITAL_OPTIONS: { value: MaritalStatus; icon: string }[] = [
  { value: "솔로",   icon: "🌸" },
  { value: "연애중", icon: "💑" },
  { value: "기혼",   icon: "💍" },
  { value: "모름",   icon: "🔒" },
];

const BADGE_DISPLAY_OPTIONS: { value: MaritalBadgeStatus; icon: string }[] = [
  ...MARITAL_OPTIONS,
  { value: "기타", icon: "🙂" },
];

export function MaritalField({
  value,
  onChange,
}: {
  value: MaritalStatus | undefined;
  onChange: (v: MaritalStatus | undefined) => void;
}) {
  return (
    <div className="ds-card ds-card-pad mb-1 bg-muted/20">
      <p className="ds-caption mb-2 font-bold uppercase tracking-wide">나의 현재 상태</p>
      <div className="flex flex-wrap gap-2">
        {MARITAL_OPTIONS.map(({ value: v, icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(active ? undefined : v)}
              className={`ds-badge transition-colors active:scale-[0.98] ${
                active ? "ds-badge-active" : "hover:border-foreground/30"
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

export function MaritalBadge({ status }: { status: MaritalBadgeStatus | undefined }) {
  if (!status) return null;
  const opt = BADGE_DISPLAY_OPTIONS.find(o => o.value === status);
  return (
    <span className="ds-badge bg-muted/50 text-muted-foreground">
      {opt?.icon} {status}
    </span>
  );
}
