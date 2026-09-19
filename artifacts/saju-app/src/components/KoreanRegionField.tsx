import { koreanRegions, parseKoreanRegion, provinces } from "@/lib/koreanRegions";
import { useState } from "react";

export function KoreanRegionField({ value, onChange, id, label }: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  label: string;
}) {
  const parsed = parseKoreanRegion(value);
  const [province, setProvince] = useState(parsed?.province ?? "");
  return <div>
    <label htmlFor={`${id}-province`} className="mb-1 block text-sm font-medium">{label}</label>
    <div className="grid grid-cols-2 gap-2">
      <select id={`${id}-province`} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" value={province} onChange={(e) => { setProvince(e.target.value); onChange(""); }}>
        <option value="">시·도 선택</option>
        {provinces.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      <select id={`${id}-district`} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" value={parsed?.province === province ? parsed.district : ""} disabled={!province} onChange={(e) => onChange(e.target.value ? `${province} ${e.target.value}` : "")}>
        <option value="">시·군·구 선택</option>
        {province && Object.keys(koreanRegions[province]).map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
    {value && !parsed && <p className="mt-1 text-xs text-muted-foreground">기존 지역: {value} · 목록에서 다시 선택해주세요.</p>}
  </div>;
}
