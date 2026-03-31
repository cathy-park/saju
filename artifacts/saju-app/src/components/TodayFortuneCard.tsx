import type { PersonRecord } from "@/lib/storage";
import { getFortuneForDate } from "@/lib/todayFortune";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { getTenGodTw } from "@/lib/tenGods";
import { TWELVE_STAGE_COLOR } from "@/lib/twelveStages";
import { charToElement } from "@/lib/element-color";
import { ELEMENT_TEXT_HEX } from "@/lib/element-color";

const KEYWORD_COLORS = [
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-green-100 text-green-800 border-green-200",
];

function GanjiText({ ch }: { ch: string }) {
  const el = charToElement(ch);
  const color = el ? ELEMENT_TEXT_HEX[el] : undefined;
  return <span style={color ? { color } : undefined}>{ch}</span>;
}

interface TodayFortuneCardProps {
  record: PersonRecord;
  year?: number;
  month?: number;
  day?: number;
}

export function TodayFortuneCard({ record, year, month, day }: TodayFortuneCardProps) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const d = day ?? now.getDate();

  const dayStem = record.profile.computedPillars?.day?.hangul?.[0] ?? "";
  const fortune = getFortuneForDate(record, y, m, d);

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          오늘의 운세 — {fortune.dateLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-center shrink-0">
            <p className="text-[13px] text-amber-600 font-medium mb-0.5">일진</p>
            <p className="text-xl font-bold text-foreground">
              {fortune.dayGanZhiStr.split("").map((ch, i) => (
                <GanjiText key={i} ch={ch} />
              ))}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-1">{fortune.summary}</p>
            {fortune.relationshipSignal && (
              <span className="text-[13px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
                💕 {fortune.relationshipSignal}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fortune.keywords.map((kw, i) => (
            <span key={kw} className={`text-[13px] font-bold px-2.5 py-1 rounded-full border ${KEYWORD_COLORS[i % KEYWORD_COLORS.length]}`}>
              {kw}
            </span>
          ))}
        </div>

        {/* Luck layers — 3 badges each */}
        <div className="grid grid-cols-2 gap-1.5">
          {fortune.luckLayers.map((layer) => (
            <div key={layer.label} className="rounded-lg border border-border/60 bg-white/50 px-2.5 py-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-muted-foreground font-medium w-7 shrink-0">{layer.label}</span>
                <span className="font-bold text-sm">
                  {layer.ganZhi.split("").map((ch, i) => <GanjiText key={i} ch={ch} />)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {layer.tenGod && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${getTenGodTw(layer.tenGod, dayStem)}`}>
                    천:{layer.tenGod}
                  </span>
                )}
                {layer.branchTenGod && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${getTenGodTw(layer.branchTenGod, dayStem)}`}>
                    지:{layer.branchTenGod}
                  </span>
                )}
                {layer.twelveStage && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${TWELVE_STAGE_COLOR[layer.twelveStage as keyof typeof TWELVE_STAGE_COLOR] ?? "bg-muted text-muted-foreground"}`}>
                    {layer.twelveStage}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white/60 border border-amber-100 px-3 py-2">
          <p className="text-[13px] text-amber-800">{fortune.guidance}</p>
        </div>
      </CardContent>
    </Card>
  );
}
