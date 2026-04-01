import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyProfile } from "@/lib/storage";
import { getTodayFortuneCard, getTenGodFortune } from "@/lib/todayFortune";
import { buildLifeFlowInsights } from "@/lib/lifeFlowInsight";
import type { PersonRecord } from "@/lib/storage";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { getZodiacFromDayPillar, DEFAULT_ZODIAC } from "@/lib/zodiacAnimal";
import type { ZodiacInfo } from "@/lib/zodiacAnimal";
import { charToElement, elementBgClass, elementTextClass } from "@/lib/element-color";
import type { FiveElKey } from "@/lib/element-color";
import { cn } from "@/lib/utils";
import gyeolDefault from "@assets/image_24_1774912053926.png";

const NICK_KEY = "naheuleum_nickname";
function loadNick(): string  { return localStorage.getItem(NICK_KEY) ?? "사용자"; }
function saveNick(v: string) { localStorage.setItem(NICK_KEY, v); }

export default function Home() {
  const [record] = useState<PersonRecord | null>(() => getMyProfile());
  return record ? <Dashboard record={record} /> : <Onboarding />;
}

// ════════════════════════════════════════════════════════════════════
//  Onboarding
// ════════════════════════════════════════════════════════════════════
function Onboarding() {
  return (
    <div className="ds-app-shell bg-background">
      <div className="flex flex-col items-center bg-[url('/bg.png')] bg-cover bg-[position:center_bottom] px-4 pb-0 pt-6">
        <p className="ds-caption mb-2 text-center font-semibold tracking-wide text-[hsl(var(--app-label-accent))]">
          ✨ 나의 흐름
        </p>
        <h2 className="ds-title-lg mb-4 text-center">
          <span className="text-primary">사주</span>
          <span className="text-foreground">로 읽는 오늘의 에너지</span>
        </h2>
        <div className="relative w-full max-w-[310px] rounded-2xl border border-border/60 bg-card/95 px-5 py-3.5 text-center shadow-none backdrop-blur-sm">
          <p className="ds-body text-center font-semibold">
            안녕하세요! 저는 결이예요 🐰<br />
            생년월일만 입력하면 오늘의 흐름과<br />
            나만의 사주 리포트를 바로 확인할 수 있어요.
          </p>
          <div
            className="absolute bottom-[-9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-card/95"
            aria-hidden
          />
        </div>
        <div className="relative z-[2] -mb-7 mt-2">
          <img src={gyeolDefault} alt="결이" className="relative block h-[200px] w-[200px] object-contain" />
        </div>
        <div className="relative z-[1] h-[52px] w-full" />
      </div>
      <div className="flex gap-2 px-4 pt-4">
        <Link href="/saju" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-500/10 px-4">
            <span className="text-base" aria-hidden>🔍</span>
            <span className="text-sm font-bold text-indigo-600">내 사주 보기</span>
          </div>
        </Link>
        <Link href="/compatibility" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4">
            <span className="text-base" aria-hidden>💞</span>
            <span className="text-sm font-bold text-primary">궁합 보기</span>
          </div>
        </Link>
      </div>
      <p className="ds-caption mt-3 text-center">생년월일만 있으면 바로 시작 · 무료</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Nickname Edit Bottom Sheet
// ════════════════════════════════════════════════════════════════════
function NicknameSheet({ value, onSave, onClose }: {
  value: string; onSave: (v: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  return (
    <div
      className="ds-sheet-scrim z-[100]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ds-sheet-panel rounded-t-3xl px-5 pb-10 pt-4">
        <div className="ds-sheet-handle" />
        <p className="ds-title mb-3">닉네임 변경</p>
        <Input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { const t = draft.trim(); if (t) onSave(t); else onClose(); }
            if (e.key === "Escape") onClose();
          }}
          className="h-12 rounded-lg text-sm"
          placeholder="닉네임을 입력하세요"
          maxLength={10}
        />
        <p className="ds-caption mt-2 text-right">{draft.length}/10</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="button" className="flex-1" onClick={() => { const t = draft.trim(); if (t) onSave(t); else onClose(); }}>저장</Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Dashboard
// ════════════════════════════════════════════════════════════════════
function Dashboard({ record }: { record: PersonRecord }) {
  const { user } = useAuth();
  const fortune = getTodayFortuneCard(record);
  const lifeFlow = buildLifeFlowInsights(record);
  const [, navigate] = useLocation();
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showLuckSheet, setShowLuckSheet] = useState(false);

  function goToTodayFortune() {
    sessionStorage.setItem("openReportTab", "오늘운세");
    navigate("/saju");
  }
  const [nickname, setNickname] = useState(() => user ? loadNick() : "사용자");
  useEffect(() => { setNickname(user ? loadNick() : "사용자"); }, [user]);

  const now = new Date();
  const months = now.getMonth() + 1;
  const dateStr = `${now.getFullYear()}년 ${months}월 ${now.getDate()}일`;

  const zodiac: ZodiacInfo = getZodiacFromDayPillar(record.profile.computedPillars.day.hangul) ?? DEFAULT_ZODIAC;
  const guidance = fortune.guidance ?? "오늘도 나답게 흘러가는 하루예요.";
  const keywords = fortune.keywords?.slice(0, 3) ?? [];

  function handleSaveNick(v: string) {
    if (!user) return;
    setNickname(v); saveNick(v); setShowEditSheet(false);
  }

  return (
    <div className="ds-app-shell bg-background">
      <div className="flex flex-col items-center bg-[url('/bg.png')] bg-cover bg-[position:center_bottom] px-4 pb-0 pt-6">
        <p className="ds-caption mb-2 text-center font-semibold tracking-wide text-[hsl(var(--app-label-accent))]">
          ✨ 오늘의 운세 — {dateStr}
        </p>

        <div className="mb-4 flex items-center justify-center gap-1">
          <h2 className="ds-title-lg m-0 text-center">
            <button
              type="button"
              onClick={() => setShowEditSheet(true)}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0"
            >
              <span className="border-b border-dashed border-primary/50 pb-0.5 text-primary">{nickname}</span>
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <span className="text-foreground">님의 오늘 흐름</span>
          </h2>
        </div>

        <div className="relative w-full max-w-[310px] rounded-2xl border border-border/60 bg-card/95 px-5 py-3.5 text-center shadow-none backdrop-blur-sm">
          <p className="ds-body text-center font-semibold">{guidance}</p>
          <div
            className="absolute bottom-[-9px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[9px] border-x-transparent border-t-card/95"
            aria-hidden
          />
        </div>

        <div className="relative z-[2] -mb-7 mt-2">
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent" aria-hidden />
          <img src={zodiac.src} alt={zodiac.label} className="relative block h-[200px] w-[200px] object-contain" />
        </div>

        <div className="relative z-[1] mt-2 flex w-full max-w-[340px] items-center rounded-xl border border-border/50 bg-card/90 px-4 py-3 backdrop-blur-sm">
          <div className="flex shrink-0 items-center gap-1.5">
            <p className="m-0 text-[11px] font-bold tracking-wide text-muted-foreground">오늘의 일진</p>
            <span className="text-[17px] font-extrabold tracking-wide">
              {fortune.dayGanZhiStr.split("").map((ch, i) => {
                const el = charToElement(ch);
                return (
                  <span key={i} className={el ? elementTextClass(el as FiveElKey, "strong") : "text-foreground"}>{ch}</span>
                );
              })}
            </span>
          </div>

          {keywords.length > 0 && (
            <div className="ml-auto flex flex-wrap justify-end gap-1">
              {keywords.map((kw, i) => {
                const styles = [
                  "border-indigo-200/60 bg-indigo-500/10 text-indigo-700",
                  "border-teal-200/60 bg-teal-500/10 text-teal-700",
                  "border-primary/30 bg-primary/10 text-primary",
                ];
                return (
                  <span key={kw} className={cn("ds-badge text-[10px] font-bold shadow-none", styles[i % styles.length])}>
                    {kw}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* '오늘 해석' 라벨 제거 — 동일 구역 여백 유지 */}
      <div className="px-4 pt-1 mb-2 min-h-[26px]" aria-hidden />

      {lifeFlow && (
        <div className="px-4 pt-0">
          <div className="ds-card relative overflow-hidden border-violet-200/80 p-5 shadow-none">
            <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-indigo-500/[0.08]" aria-hidden />
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-indigo-600">✦ 오늘의 전체 흐름</span>
            </div>
            <p className="ds-body mb-4 font-medium text-foreground leading-relaxed">
              {lifeFlow.overall.fullText}
            </p>
            {lifeFlow.overall.activityFlow && (
              <p className="mb-4 text-xs font-semibold text-indigo-600 leading-relaxed">
                {lifeFlow.overall.activityFlow}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "감정 흐름", text: lifeFlow.overall.emotional },
                { label: "결정 타이밍", text: lifeFlow.overall.decisionTiming },
              ].map(({ label, text }) => (
                <div key={label} className="rounded-lg bg-violet-50/80 px-4 py-3.5">
                  <p className="ds-caption mb-2 font-bold tracking-wide text-violet-600/90">{label}</p>
                  <p className="text-xs leading-snug text-foreground/90">{text}</p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={goToTodayFortune}
              className="mt-4 w-full border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-primary-foreground shadow-none hover:from-indigo-600 hover:to-violet-600"
            >
              오늘 운세 보러가기 →
            </Button>
          </div>
        </div>
      )}

      {/* ── 오늘 일운 해석 (십성) ── */}
      {(() => {
        const dayLayer = fortune.luckLayers[3] ?? fortune.luckLayers[fortune.luckLayers.length - 1];
        if (!dayLayer) return null;
        const stemFortune   = getTenGodFortune(dayLayer.tenGod);
        const branchFortune = getTenGodFortune(dayLayer.branchTenGod);
        const stemEl   = charToElement(dayLayer.ganZhi[0]) as FiveElKey | null;
        const branchEl = charToElement(dayLayer.ganZhi[1]) as FiveElKey | null;
        const items = [
          { label: dayLayer.tenGod,   sub: "천간", el: stemEl,   ...stemFortune },
          ...(dayLayer.branchTenGod && dayLayer.branchTenGod !== dayLayer.tenGod
            ? [{ label: dayLayer.branchTenGod, sub: "지지", el: branchEl, ...branchFortune }]
            : []),
        ];
        return (
          <div className="px-4 pt-2">
            <div className="ds-card overflow-hidden p-0 shadow-none">
              <div className="border-b border-border px-3.5 py-2">
                <span className="text-[10px] font-bold tracking-wide text-muted-foreground">오늘 일운 해석</span>
              </div>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn("px-3.5 py-2.5", idx < items.length - 1 && "border-b border-border/60")}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "ds-badge text-[11px] font-extrabold shadow-none",
                        item.el
                          ? cn(elementBgClass(item.el, "muted"), elementTextClass(item.el, "strong"), "border-transparent")
                          : "bg-muted text-primary",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{item.sub}</span>
                  </div>
                  <p className="mb-1 text-xs font-semibold leading-snug text-foreground">{item.summary}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{item.guidance}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ③ 운 흐름 스냅샷 — 대운·세운·월운·일운 한 그룹 */}
      <div className="px-4 pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">운 흐름 스냅샷</p>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
          <div className="border-b border-border bg-muted/20 px-3.5 py-2">
            <p className="text-[11px] font-bold text-foreground">대운 · 세운 · 월운 · 일운</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">탭하면 리포트 운세 탭으로 이동합니다</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border p-0">
          {fortune.luckLayers.map((layer) => {
            const stemEl = charToElement(layer.ganZhi[0]);
            const branchEl = charToElement(layer.ganZhi[1]);
            return (
              <div
                key={layer.label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  sessionStorage.setItem("openReportTab", "운세");
                  sessionStorage.setItem("openLuckTab", layer.label);
                  navigate("/saju");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    sessionStorage.setItem("openReportTab", "운세");
                    sessionStorage.setItem("openLuckTab", layer.label);
                    navigate("/saju");
                  }
                }}
                className="cursor-pointer bg-background p-2.5 transition-colors hover:bg-muted/25"
              >
                <div className="mb-1.5 flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{layer.label}</span>
                  <span className="text-sm font-extrabold tracking-wide">
                    <span className={stemEl ? elementTextClass(stemEl as FiveElKey, "strong") : "text-foreground"}>{layer.ganZhi[0]}</span>
                    <span className={branchEl ? elementTextClass(branchEl as FiveElKey, "strong") : "text-foreground"}>{layer.ganZhi[1]}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {layer.tenGod && (
                    <span className="daewoon-tengod-tag ds-badge border-indigo-200/50 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 shadow-none">
                      천:{layer.tenGod}
                    </span>
                  )}
                  {layer.branchTenGod && (
                    <span className="daewoon-tengod-tag ds-badge border-teal-200/50 bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 shadow-none">
                      지:{layer.branchTenGod}
                    </span>
                  )}
                  {layer.twelveStage && (
                    <span className="daewoon-tengod-tag ds-badge border-border bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground shadow-none">
                      {layer.twelveStage}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* ④ 주요 기능 이동 */}
      <div className="px-4 pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">주요 기능</p>
        <div className="flex gap-2">
        <Link href="/saju" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-500/10 px-4">
            <span className="text-base" aria-hidden>🔍</span>
            <span className="text-sm font-bold text-indigo-600">내 사주 보기</span>
          </div>
        </Link>
        <Link href="/compatibility" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4">
            <span className="text-base" aria-hidden>💞</span>
            <span className="text-sm font-bold text-primary">궁합 보기</span>
          </div>
        </Link>
        </div>
      </div>

      {showEditSheet && (
        <NicknameSheet value={nickname} onSave={handleSaveNick} onClose={() => setShowEditSheet(false)} />
      )}

      {showLuckSheet && (
        <LuckInterpretSheet fortune={fortune} onClose={() => setShowLuckSheet(false)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Luck Interpret Bottom Sheet
// ════════════════════════════════════════════════════════════════════
function LuckInterpretSheet({ fortune, onClose }: { fortune: ReturnType<typeof getTodayFortuneCard>; onClose: () => void }) {
  const LAYER_BAR: Record<string, string> = {
    대운: "bg-indigo-500/10",
    세운: "bg-teal-500/10",
    월운: "bg-orange-500/10",
    일운: "bg-red-500/10",
  };
  const LAYER_ACCENT: Record<string, string> = {
    대운: "text-indigo-700",
    세운: "text-teal-800",
    월운: "text-orange-800",
    일운: "text-red-800",
  };

  return (
    <div
      className="ds-sheet-scrim z-[200]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="ds-sheet-panel rounded-t-3xl bg-card pt-0 max-h-[88vh] overflow-y-auto">
        <div className="ds-sheet-handle mt-4" />

        <div className="border-b border-border px-5 pb-3">
          <p className="text-lg font-extrabold text-foreground">오늘의 흐름 종합 해석</p>
          <p className="ds-caption mt-1">대운 · 세운 · 월운 · 일운을 종합해 오늘을 읽습니다</p>
        </div>

        <div className="px-5 pb-10 pt-3">
          {fortune.luckLayers.map((layer) => {
            const bar = LAYER_BAR[layer.label] ?? "bg-muted/40";
            const accent = LAYER_ACCENT[layer.label] ?? "text-muted-foreground";
            const stemF   = getTenGodFortune(layer.tenGod);
            const branchF = getTenGodFortune(layer.branchTenGod);
            const stemEl = charToElement(layer.ganZhi[0]);
            const brEl = charToElement(layer.ganZhi[1]);
            return (
              <div key={layer.label} className="mb-4 overflow-hidden rounded-xl border border-border shadow-none">
                <div className={cn("flex items-center gap-2 px-3.5 py-2.5", bar)}>
                  <span className={cn("ds-badge bg-card text-[11px] font-extrabold shadow-none", accent)}>{layer.label}</span>
                  <span className="text-[15px] font-extrabold tracking-wide">
                    <span className={stemEl ? elementTextClass(stemEl as FiveElKey, "strong") : "text-foreground"}>{layer.ganZhi[0]}</span>
                    <span className={brEl ? elementTextClass(brEl as FiveElKey, "strong") : "text-foreground"}>{layer.ganZhi[1]}</span>
                  </span>
                  {layer.twelveStage && (
                    <span className="ds-badge ml-auto bg-muted/60 text-[10px] font-bold text-muted-foreground shadow-none">
                      {layer.twelveStage}
                    </span>
                  )}
                </div>

                {layer.tenGod && (
                  <div className="border-b border-border/60 px-3.5 py-2.5">
                    <div className="mb-1 flex items-center gap-1">
                      <span className={cn("ds-badge text-[10px] font-extrabold shadow-none", bar, accent)}>천 {layer.tenGod}</span>
                    </div>
                    <p className="mb-1 text-[13px] font-bold leading-snug text-foreground">{stemF.summary}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{stemF.guidance}</p>
                  </div>
                )}

                {layer.branchTenGod && layer.branchTenGod !== layer.tenGod && (
                  <div className="px-3.5 py-2.5">
                    <div className="mb-1 flex items-center gap-1">
                      <span className="ds-badge border-slate-200/60 bg-slate-500/10 text-[10px] font-extrabold text-slate-700 shadow-none">지 {layer.branchTenGod}</span>
                    </div>
                    <p className="mb-1 text-[13px] font-bold leading-snug text-foreground">{branchF.summary}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{branchF.guidance}</p>
                  </div>
                )}

                {layer.branchTenGod && layer.branchTenGod === layer.tenGod && (
                  <div className="px-3.5 pb-2.5 pt-1">
                    <p className="text-xs italic text-muted-foreground">천간·지지 동일 기운 — 에너지가 집중됩니다.</p>
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-orange-50/80 to-violet-50/90 p-4 pb-10 shadow-none">
            <p className="mb-1.5 text-[11px] font-bold tracking-wide text-violet-700">종합 흐름</p>
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {fortune.guidance}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
