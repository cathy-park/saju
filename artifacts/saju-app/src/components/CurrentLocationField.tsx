import { KoreanRegionField } from "@/components/KoreanRegionField";
export function CurrentLocationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="ds-card ds-card-pad mb-1 bg-muted/20">
      <KoreanRegionField id="current-place-name" label="현재 거주지역" value={value} onChange={onChange} />
      <p className="mt-1.5 text-xs text-muted-foreground">
        올해 운세(솔라리턴)의 기준 지역으로 쓰입니다. 출생지와 달라도 괜찮아요 — 비워두면 솔라리턴은 행성 위치까지만 계산됩니다.
      </p>
    </div>
  );
}
