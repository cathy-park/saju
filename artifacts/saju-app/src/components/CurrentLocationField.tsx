// 프로필 입력 폼에 넣는 "현재 거주지역" 텍스트칸 — 출생지(BirthForm 내부)와 똑같이 이름만
// 받고, 실제 위도/경도/시간대는 useResolvedCurrentLocation이 백그라운드에서 지오코딩해 채운다.
export function CurrentLocationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="ds-card ds-card-pad mb-1 bg-muted/20">
      <label htmlFor="current-place-name" className="ds-caption mb-2 block font-bold uppercase tracking-wide">
        현재 거주지역
      </label>
      <input
        id="current-place-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 서울"
        className="flex h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        올해 운세(솔라리턴)의 기준 지역으로 쓰입니다. 출생지와 달라도 괜찮아요 — 비워두면 솔라리턴은 행성 위치까지만 계산됩니다.
      </p>
    </div>
  );
}
