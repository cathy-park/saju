import type { Pillar } from "@/lib/sajuEngine";
import { ELEMENT_COLORS } from "@/lib/sajuEngine";

const STEM_ELEMENT: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

interface PillarCardProps {
  label: string;
  pillar: Pillar | null | undefined;
  unknown?: boolean;
  highlight?: boolean;
}

export function PillarCard({ label, pillar, unknown, highlight }: PillarCardProps) {
  const stemChar = pillar?.hangul?.[0];
  const branchChar = pillar?.hangul?.[1];
  const stemEl = stemChar ? STEM_ELEMENT[stemChar] : null;
  const branchEl = branchChar ? STEM_ELEMENT[branchChar] : null;

  return (
    <div
      className={`flex flex-col rounded-lg border text-center overflow-hidden ${
        highlight ? "border-amber-300 bg-amber-50/60" : "border-border bg-card"
      }`}
    >
      <div className="text-[13px] font-medium text-muted-foreground py-1 bg-muted/40 border-b border-border">
        {label}
      </div>
      {unknown || !pillar ? (
        <div className="flex flex-col items-center justify-center py-2">
          <span className="text-base text-muted-foreground">?</span>
        </div>
      ) : (
        <>
          <div
            className={`py-1.5 border-b border-border/50 font-bold text-base ${
              stemEl ? ELEMENT_COLORS[stemEl as keyof typeof ELEMENT_COLORS] : ""
            }`}
          >
            {stemChar}
          </div>
          <div
            className={`py-1.5 font-bold text-base ${
              branchEl ? ELEMENT_COLORS[branchEl as keyof typeof ELEMENT_COLORS] : ""
            }`}
          >
            {branchChar}
          </div>
        </>
      )}
    </div>
  );
}
