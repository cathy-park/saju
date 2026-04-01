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
import { charToElement, elementColorVar } from "@/lib/element-color";
import type { FiveElKey } from "@/lib/element-color";
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
            <span className="text-sm font-bold text-indigo-600">사주 리포트</span>
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
  const dayStemEl = charToElement(record.profile.computedPillars.day.hangul?.[0] ?? "") as FiveElKey | undefined;
  const keywords = fortune.keywords?.slice(0, 3) ?? [];

  const domainLevelBadge = {
    good:    { icon: "▲", bg: "rgba(46,125,50,0.10)", color: "#2E7D32" },
    neutral: { icon: "–", bg: "rgba(120,120,120,0.10)", color: "#555" },
    caution: { icon: "▼", bg: "rgba(230,81,0,0.10)",  color: "#E65100" },
  };

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

        <div className="relative z-[1] mt-2 flex w-full items-center rounded-xl border border-border/50 bg-card/90 px-4 py-3 backdrop-blur-sm">
          <div className="flex shrink-0 items-center gap-1.5">
            <p className="m-0 text-[11px] font-bold tracking-wide text-muted-foreground">오늘의 일진</p>
            <span className="text-[17px] font-extrabold tracking-wide">
              {fortune.dayGanZhiStr.split("").map((ch, i) => {
                const el = charToElement(ch);
                return <span key={i} style={{ color: el ? elementColorVar(el, "strong") : "hsl(var(--foreground))" }}>{ch}</span>;
              })}
            </span>
            {/* hanja 표기는 숨김 */}
          </div>

          {/* 키워드 chips (오른쪽) */}
          {keywords.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
              {keywords.map((kw, i) => {
                const P = [
                  { bg: "rgba(99,102,241,0.10)", color: "#6366F1" },
                  { bg: "rgba(20,184,166,0.10)",  color: "#0F9B8E" },
                  { bg: "rgba(239,116,66,0.10)",  color: "hsl(12,72%,50%)" },
                ];
                const p = P[i % P.length];
                return (
                  <span key={kw} style={{ fontSize: 10, fontWeight: 700, color: p.color, background: p.bg, borderRadius: 20, padding: "3px 8px", border: `1px solid ${p.color}33`, whiteSpace: "nowrap" }}>
                    {kw}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          오늘의 전체 흐름 카드
      ══════════════════════════════════════════ */}
      {lifeFlow && (
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: "#FFF", border: "1px solid #E8E4FC", borderRadius: 16, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            {/* 배경 그라데이션 포인트 */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

            {/* 제목 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#6366F1" }}>✦ 오늘의 전체 흐름</span>
            </div>

            {/* 전체 텍스트 */}
            <p style={{ fontSize: 13, color: "#333", lineHeight: 1.6, margin: "0 0 6px", fontWeight: 500 }}>
              {lifeFlow.overall.fullText}
            </p>

            {/* 활동 방향 */}
            {lifeFlow.overall.activityFlow && (
              <p style={{ fontSize: 12, color: "#6366F1", margin: "0 0 10px", fontWeight: 600 }}>
                {lifeFlow.overall.activityFlow}
              </p>
            )}

            {/* 감정 흐름 + 결정 타이밍 2칸 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "감정 흐름", text: lifeFlow.overall.emotional },
                { label: "결정 타이밍", text: lifeFlow.overall.decisionTiming },
              ].map(({ label, text }) => (
                <div key={label} style={{ background: "#F7F6FE", borderRadius: 10, padding: "9px 11px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#8B8FCC", margin: "0 0 4px", letterSpacing: "0.03em" }}>{label}</p>
                  <p style={{ fontSize: 12, color: "#444", margin: 0, lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>

            {/* 오늘 운세 보러가기 버튼 */}
            <button
              onClick={goToTodayFortune}
              style={{ display: "block", width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#FFF", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer", letterSpacing: "0.02em" }}
            >
              오늘 운세 보러가기 →
            </button>
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
          <div style={{ padding: "10px 16px 0" }}>
            <div style={{ border: "1px solid #EBEBEB", borderRadius: 12, background: "#FFF", overflow: "hidden" }}>
              <div style={{ padding: "9px 14px 8px", borderBottom: "1px solid #F2F2F2" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#AAAAAA", letterSpacing: "0.05em" }}>오늘 일운 해석</span>
              </div>
              {items.map((item, idx) => {
                const tc = item.el ? elementColorVar(item.el, "strong") : "hsl(var(--primary))";
                const bg = item.el ? elementColorVar(item.el, "muted") : "hsl(var(--muted))";
                return (
                  <div key={idx} style={{ padding: "10px 14px", borderBottom: idx < items.length - 1 ? "1px solid #F7F7F7" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tc, background: bg, borderRadius: 20, padding: "2px 9px" }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 10, color: "#BBBBBB", fontWeight: 600 }}>{item.sub}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#555", margin: "0 0 3px", fontWeight: 600, lineHeight: 1.5 }}>{item.summary}</p>
                    <p style={{ fontSize: 11, color: "#888", margin: 0, lineHeight: 1.55 }}>{item.guidance}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════
          FLOW STRUCTURE CARD (대운/세운/월운/일운 2×2)
      ══════════════════════════════════════════ */}
      <div style={{ padding: "14px 16px 0" }}>
        <div
          style={{ border: "1px solid #EBEBEB", borderRadius: 16, background: "#FFF", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {fortune.luckLayers.map((layer) => {
            const stemEl = charToElement(layer.ganZhi[0]);
            const stemColor = stemEl ? elementColorVar(stemEl as FiveElKey, "strong") : "hsl(var(--foreground))";
            const branchEl = charToElement(layer.ganZhi[1]);
            const branchColor = branchEl ? elementColorVar(branchEl as FiveElKey, "strong") : "hsl(var(--foreground))";
            return (
              <div
                key={layer.label}
                onClick={() => {
                  sessionStorage.setItem("openReportTab", "운세");
                  sessionStorage.setItem("openLuckTab", layer.label);
                  navigate("/saju");
                }}
                style={{ background: "#FAFAF8", borderRadius: 10, padding: "10px 11px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#AAAAAA" }}>{layer.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.04em" }}>
                    <span style={{ color: stemColor }}>{layer.ganZhi[0]}</span>
                    <span style={{ color: branchColor }}>{layer.ganZhi[1]}</span>
                  </span>
                  {/* hanja 표기는 숨김 */}
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {layer.tenGod && (
                    <span className="daewoon-tengod-tag" style={{ fontSize: 9, fontWeight: 700, background: "rgba(99,102,241,0.10)", color: "#6366F1", borderRadius: 20, padding: "2px 6px" }}>
                      천:{layer.tenGod}
                    </span>
                  )}
                  {layer.branchTenGod && (
                    <span className="daewoon-tengod-tag" style={{ fontSize: 9, fontWeight: 700, background: "rgba(20,184,166,0.10)", color: "#0F9B8E", borderRadius: 20, padding: "2px 6px" }}>
                      지:{layer.branchTenGod}
                    </span>
                  )}
                  {layer.twelveStage && (
                    <span className="daewoon-tengod-tag" style={{ fontSize: 9, fontWeight: 700, background: "rgba(120,120,120,0.10)", color: "#666", borderRadius: 20, padding: "2px 6px" }}>
                      {layer.twelveStage}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ══════════════════════════════════════════
          CTA BUTTONS
      ══════════════════════════════════════════ */}
      <div className="flex gap-2 px-4 pt-4">
        <Link href="/saju" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-500/10 px-4">
            <span className="text-base" aria-hidden>🔍</span>
            <span className="text-sm font-bold text-indigo-600">사주 리포트</span>
          </div>
        </Link>
        <Link href="/compatibility" className="flex-1">
          <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4">
            <span className="text-base" aria-hidden>💞</span>
            <span className="text-sm font-bold text-primary">궁합 보기</span>
          </div>
        </Link>
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
  const LAYER_COLORS: Record<string, { bg: string; color: string }> = {
    대운: { bg: "rgba(99,102,241,0.12)", color: "#4F46E5" },
    세운: { bg: "rgba(20,184,166,0.12)", color: "#0F766E" },
    월운: { bg: "rgba(249,115,22,0.12)", color: "#C2410C" },
    일운: { bg: "rgba(239,68,68,0.12)",  color: "#B91C1C" },
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
            const lc = LAYER_COLORS[layer.label] ?? { bg: "rgba(120,120,120,0.10)", color: "#555" };
            const stemF   = getTenGodFortune(layer.tenGod);
            const branchF = getTenGodFortune(layer.branchTenGod);
            const el = charToElement(layer.ganZhi[0]);
            const stemColor  = el ? elementColorVar(el as FiveElKey, "strong") : "hsl(var(--foreground))";
            const brEl = charToElement(layer.ganZhi[1]);
            const branchColor = brEl ? elementColorVar(brEl as FiveElKey, "strong") : "hsl(var(--foreground))";
            return (
              <div key={layer.label} style={{ marginBottom: 16, border: "1px solid #F0F0F0", borderRadius: 14, overflow: "hidden" }}>
                {/* Layer header */}
                <div style={{ padding: "10px 14px 9px", background: lc.bg, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: lc.color, background: "#FFF", borderRadius: 20, padding: "2px 9px" }}>{layer.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.05em" }}>
                    <span style={{ color: stemColor }}>{layer.ganZhi[0]}</span>
                    <span style={{ color: branchColor }}>{layer.ganZhi[1]}</span>
                  </span>
                  {/* hanja 표기는 숨김 */}
                  {layer.twelveStage && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#888", background: "rgba(0,0,0,0.06)", borderRadius: 20, padding: "2px 7px", marginLeft: "auto" }}>
                      {layer.twelveStage}
                    </span>
                  )}
                </div>

                {/* 천간 interpretation */}
                {layer.tenGod && (
                  <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid #F8F8F8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: lc.color, background: lc.bg, borderRadius: 20, padding: "2px 8px" }}>천 {layer.tenGod}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 3px", lineHeight: 1.5 }}>{stemF.summary}</p>
                    <p style={{ fontSize: 12, color: "#666", margin: 0, lineHeight: 1.6 }}>{stemF.guidance}</p>
                  </div>
                )}

                {/* 지지 interpretation (if different) */}
                {layer.branchTenGod && layer.branchTenGod !== layer.tenGod && (
                  <div style={{ padding: "10px 14px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", background: "rgba(107,114,128,0.10)", borderRadius: 20, padding: "2px 8px" }}>지 {layer.branchTenGod}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: "0 0 3px", lineHeight: 1.5 }}>{branchF.summary}</p>
                    <p style={{ fontSize: 12, color: "#666", margin: 0, lineHeight: 1.6 }}>{branchF.guidance}</p>
                  </div>
                )}

                {/* If branch same as stem, just show one paragraph */}
                {layer.branchTenGod && layer.branchTenGod === layer.tenGod && (
                  <div style={{ padding: "4px 14px 10px" }}>
                    <p style={{ fontSize: 12, color: "#999", margin: 0, fontStyle: "italic" }}>천간·지지 동일 기운 — 에너지가 집중됩니다.</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Synthesis note */}
          <div style={{ background: "linear-gradient(135deg,#FFF4F0,#F2EEFF)", border: "1px solid #EDE9FE", borderRadius: 14, padding: "14px 16px", marginBottom: 0, paddingBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", margin: "0 0 6px", letterSpacing: "0.04em" }}>종합 흐름</p>
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7, margin: 0 }}>
              {fortune.guidance}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
