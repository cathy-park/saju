import { PillarCard } from "./PillarCard";
import type { ComputedPillars, FiveElementCount } from "@/lib/sajuEngine";
import { ELEMENT_BG_COLORS } from "@/lib/sajuEngine";

interface SajuDisplayProps {
  pillars: {
    year: { hangul: string; hanja: string } | null;
    month: { hangul: string; hanja: string } | null;
    day: { hangul: string; hanja: string } | null;
    hour: { hangul: string; hanja: string } | null;
  };
  fiveElements: FiveElementCount;
  timeUnknown?: boolean;
  compact?: boolean;
}

export function SajuDisplay({ pillars, fiveElements, timeUnknown, compact }: SajuDisplayProps) {
  const total = Object.values(fiveElements).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        <PillarCard label="생시" pillar={pillars.hour} unknown={timeUnknown || !pillars.hour} />
        <PillarCard label="생일" pillar={pillars.day} highlight />
        <PillarCard label="생월" pillar={pillars.month} />
        <PillarCard label="생년" pillar={pillars.year} />
      </div>

      {!compact && (
        <div>
          <p className="text-[13px] font-medium text-muted-foreground mb-2">오행 분포</p>
          <div className="flex flex-wrap gap-1.5">
            {(["목", "화", "토", "금", "수"] as const).map((el) => (
              <span
                key={el}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-semibold ${ELEMENT_BG_COLORS[el]}`}
              >
                {el} {fiveElements[el]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
