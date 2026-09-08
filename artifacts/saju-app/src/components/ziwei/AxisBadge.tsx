import { Badge } from "@/components/ui/badge";
import { AXIS_LABEL, type TimingAxis } from "@/lib/ziwei/reports/marriageTimingReport";

const AXIS_CLASS: Record<TimingAxis, string> = {
  activation: "border-transparent bg-primary/10 text-primary",
  stability: "border-transparent bg-emerald-500/10 text-emerald-700",
  formalization: "border-transparent bg-sky-500/10 text-sky-700",
  volatility: "border-transparent bg-amber-500/10 text-amber-700",
};

export function AxisBadge({ axis }: { axis: TimingAxis }) {
  return <Badge className={AXIS_CLASS[axis]}>{AXIS_LABEL[axis]}</Badge>;
}
