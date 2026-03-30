import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { getMyProfile } from "@/lib/storage";
import { getTodayFortuneCard, getTenGodFortune } from "@/lib/todayFortune";
import type { PersonRecord } from "@/lib/storage";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { getZodiacFromDayPillar, DEFAULT_ZODIAC } from "@/lib/zodiacAnimal";
import type { ZodiacInfo } from "@/lib/zodiacAnimal";
import { ELEMENT_HEX, ELEMENT_TEXT_HEX, charToElement } from "@/lib/element-color";
import type { FiveElKey } from "@/lib/element-color";
import gyeolDefault from "@assets/gyeol_default_1774880100276.png";

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
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80, background: "#FAFAF8" }}>

      {/* ── Hero (대시보드와 동일한 배경 구조) ── */}
      <div style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        padding: "22px 20px 0",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* 날짜 레이블 */}
        <p style={{ fontSize: 12, fontWeight: 600, color: "#C17D50", margin: "0 0 6px", textAlign: "center", letterSpacing: "0.02em" }}>
          ✨ 나의 흐름
        </p>

        {/* 메인 타이틀 */}
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", textAlign: "center" }}>
          <span style={{ color: "hsl(12,72%,50%)" }}>사주</span>
          <span style={{ color: "#111" }}>로 읽는 오늘의 에너지</span>
        </h2>

        {/* 말풍선 */}
        <div style={{
          background: "rgba(255,255,255,0.92)",
          borderRadius: 18,
          padding: "14px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
          maxWidth: 310, width: "100%",
          position: "relative",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#333", lineHeight: 1.65, margin: 0 }}>
            안녕하세요! 저는 결이예요 🐰<br />
            생년월일만 입력하면 오늘의 흐름과<br />
            나만의 사주 리포트를 바로 확인할 수 있어요.
          </p>
          {/* 아래 꼬리 */}
          <div style={{
            position: "absolute", bottom: -9, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "9px solid rgba(255,255,255,0.92)",
          }} />
        </div>

        {/* 결이 기본 캐릭터 */}
        <div style={{ position: "relative", marginTop: 10, marginBottom: -28, zIndex: 2 }}>
          <img
            src={gyeolDefault}
            alt="결이"
            style={{ width: 200, height: 200, objectFit: "contain", position: "relative", display: "block" }}
          />
        </div>

        {/* 빈 영역 (대시보드의 일진 row 자리) — 높이만 맞춤 */}
        <div style={{ width: "100%", height: 52, zIndex: 1, position: "relative" }} />
      </div>

      {/* ── CTA 버튼 (대시보드와 동일 위치) ── */}
      <div style={{ padding: "16px 16px 0", display: "flex", gap: 10 }}>
        <Link href="/saju" style={{ flex: 1 }}>
          <div style={{ background: "#F6DADA", borderRadius: 50, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#B54848" }}>사주 리포트</span>
          </div>
        </Link>
        <Link href="/compatibility" style={{ flex: 1 }}>
          <div style={{ background: "#DDD6F5", borderRadius: 50, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>💞</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#6B5BBE" }}>궁합 보기</span>
          </div>
        </Link>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "#AAAAAA", marginTop: 12 }}>생년월일만 있으면 바로 시작 · 무료</p>
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
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#FFF", borderRadius: "24px 24px 0 0", padding: "16px 20px 40px", zIndex: 10, animation: "slideUp .22s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: "#DDD", margin: "0 auto 20px" }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 14 }}>닉네임 변경</p>
        <input
          ref={inputRef}
          type="text" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { const t = draft.trim(); if (t) onSave(t); else onClose(); } if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", height: 48, padding: "0 16px", border: "1px solid #E0E0E0", borderRadius: 12, fontSize: 15, outline: "none", boxSizing: "border-box" }}
          placeholder="닉네임을 입력하세요" maxLength={10}
        />
        <p style={{ fontSize: 12, color: "#AAA", textAlign: "right", marginTop: 6 }}>{draft.length}/10</p>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, border: "1px solid #E0E0E0", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#888", background: "#FFF", cursor: "pointer" }}>취소</button>
          <button onClick={() => { const t = draft.trim(); if (t) onSave(t); else onClose(); }} style={{ flex: 1, height: 44, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#FFF", background: "hsl(12,72%,50%)", cursor: "pointer" }}>저장</button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Dashboard
// ════════════════════════════════════════════════════════════════════
function Dashboard({ record }: { record: PersonRecord }) {
  const { user } = useAuth();
  const fortune = getTodayFortuneCard(record);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showLuckSheet, setShowLuckSheet] = useState(false);
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
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80, background: "#FAFAF8" }}>

      {/* ══════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════ */}
      <div style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        padding: "22px 20px 0",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* A. 날짜 레이블 */}
        <p style={{ fontSize: 12, fontWeight: 600, color: "#C17D50", margin: "0 0 6px", textAlign: "center", letterSpacing: "0.02em" }}>
          ✨ 오늘의 운세 — {dateStr}
        </p>

        {/* B. 메인 타이틀 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, textAlign: "center" }}>
            <span style={{ color: "hsl(12,72%,50%)" }}>{nickname}</span>
            <span style={{ color: "#111" }}>님의 오늘 흐름</span>
          </h2>
          {user && (
            <button onClick={() => setShowEditSheet(true)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#CCC" }}>
              <Pencil style={{ width: 11, height: 11 }} />
            </button>
          )}
        </div>

        {/* C. 말풍선 */}
        <div style={{
          background: "rgba(255,255,255,0.92)",
          borderRadius: 18,
          padding: "14px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
          maxWidth: 310, width: "100%",
          position: "relative",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#333", lineHeight: 1.65, margin: 0 }}>
            {guidance}
          </p>
          {/* 아래 꼬리 */}
          <div style={{
            position: "absolute", bottom: -9, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "9px solid rgba(255,255,255,0.92)",
          }} />
        </div>

        {/* D. 캐릭터 (마스코트) */}
        <div style={{ position: "relative", marginTop: 10, marginBottom: -28, zIndex: 2 }}>
          <div style={{
            position: "absolute", width: 220, height: 220, borderRadius: "50%",
            background: "transparent",
            top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          }} />
          <img src={zodiac.src} alt={zodiac.label} style={{ width: 200, height: 200, objectFit: "contain", position: "relative", display: "block" }} />
        </div>

        {/* E. 일진 row */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(255,255,255,0.88)",
          borderRadius: 14, padding: "12px 16px",
          border: "1px solid rgba(0,0,0,0.05)",
          width: "100%", boxSizing: "border-box",
          zIndex: 1, position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "#AAAAAA", fontWeight: 700, margin: 0, letterSpacing: "0.03em" }}>오늘의 일진</p>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.05em" }}>
              {fortune.dayGanZhiStr.split("").map((ch, i) => {
                const el = charToElement(ch);
                return <span key={i} style={{ color: el ? ELEMENT_TEXT_HEX[el] : "#111" }}>{ch}</span>;
              })}
            </span>
            <span style={{ fontSize: 12, color: "#CCCCCC", fontFamily: "serif" }}>{fortune.dayGanZhiHanja}</span>
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
          4 MINI STATUS CARDS
      ══════════════════════════════════════════ */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {fortune.domainFortunes.map((d) => {
            const bs = domainLevelBadge[d.level];
            return (
              <div key={d.domain} style={{
                flex: 1, background: "#FFF", border: "1px solid #EBEBEB",
                borderRadius: 12, padding: "8px 8px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111", whiteSpace: "nowrap" }}>{d.icon} {d.domain}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: bs.bg, color: bs.color, borderRadius: 20, padding: "2px 6px", whiteSpace: "nowrap" }}>
                  {bs.icon} {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          FLOW STRUCTURE CARD (대운/세운/월운/일운 2×2)
      ══════════════════════════════════════════ */}
      <div style={{ padding: "14px 16px 0" }}>
        <div
          onClick={() => setShowLuckSheet(true)}
          style={{ border: "1px solid #EBEBEB", borderRadius: 16, background: "#FFF", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, cursor: "pointer" }}>
          {fortune.luckLayers.map((layer) => {
            const stemEl = charToElement(layer.ganZhi[0]);
            const stemColor = stemEl ? ELEMENT_TEXT_HEX[stemEl as FiveElKey] : "#111";
            const branchEl = charToElement(layer.ganZhi[1]);
            const branchColor = branchEl ? ELEMENT_TEXT_HEX[branchEl as FiveElKey] : "#111";
            return (
              <div key={layer.label} style={{ background: "#FAFAF8", borderRadius: 10, padding: "10px 11px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#AAAAAA" }}>{layer.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.04em" }}>
                    <span style={{ color: stemColor }}>{layer.ganZhi[0]}</span>
                    <span style={{ color: branchColor }}>{layer.ganZhi[1]}</span>
                  </span>
                  {layer.hanja && <span style={{ fontSize: 11, color: "#CCCCCC", fontFamily: "serif" }}>{layer.hanja}</span>}
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {layer.tenGod && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(99,102,241,0.10)", color: "#6366F1", borderRadius: 20, padding: "2px 6px" }}>
                      천:{layer.tenGod}
                    </span>
                  )}
                  {layer.branchTenGod && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(20,184,166,0.10)", color: "#0F9B8E", borderRadius: 20, padding: "2px 6px" }}>
                      지:{layer.branchTenGod}
                    </span>
                  )}
                  {layer.twelveStage && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(120,120,120,0.10)", color: "#666", borderRadius: 20, padding: "2px 6px" }}>
                      {layer.twelveStage}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 오늘 일운 해석 strip */}
        {(() => {
          const dayLayer = fortune.luckLayers[3] ?? fortune.luckLayers[fortune.luckLayers.length - 1];
          if (!dayLayer) return null;
          const stemFortune   = getTenGodFortune(dayLayer.tenGod);
          const branchFortune = getTenGodFortune(dayLayer.branchTenGod);
          const items = [
            { label: dayLayer.tenGod, sub: "천간", ...stemFortune },
            ...(dayLayer.branchTenGod && dayLayer.branchTenGod !== dayLayer.tenGod
              ? [{ label: dayLayer.branchTenGod, sub: "지지", ...branchFortune }]
              : []),
          ];
          return (
            <div style={{ marginTop: 8, border: "1px solid #EBEBEB", borderRadius: 12, background: "#FFF", overflow: "hidden" }}>
              <div style={{ padding: "9px 14px 8px", borderBottom: "1px solid #F2F2F2" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#AAAAAA", letterSpacing: "0.05em" }}>오늘 일운 해석</span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{
                  padding: "10px 14px",
                  borderBottom: idx < items.length - 1 ? "1px solid #F7F7F7" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", background: "rgba(99,102,241,0.10)", borderRadius: 20, padding: "2px 9px" }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 10, color: "#BBBBBB", fontWeight: 600 }}>{item.sub}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", margin: "0 0 3px", fontWeight: 600, lineHeight: 1.5 }}>{item.summary}</p>
                  <p style={{ fontSize: 11, color: "#888", margin: 0, lineHeight: 1.55 }}>{item.guidance}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ══════════════════════════════════════════
          CTA BUTTONS
      ══════════════════════════════════════════ */}
      <div style={{ padding: "16px 16px 0", display: "flex", gap: 10 }}>
        <Link href="/saju" style={{ flex: 1 }}>
          <div style={{ background: "#F6DADA", borderRadius: 50, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#B54848" }}>사주 리포트</span>
          </div>
        </Link>
        <Link href="/compatibility" style={{ flex: 1 }}>
          <div style={{ background: "#DDD6F5", borderRadius: 50, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>💞</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#6B5BBE" }}>궁합 보기</span>
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
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{
        position: "relative", background: "#FFF",
        borderRadius: "24px 24px 0 0", padding: "16px 0 0",
        zIndex: 10, animation: "slideUp .25s cubic-bezier(.32,.72,0,1)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 99, background: "#DDD", margin: "0 auto 16px" }} />

        {/* Title */}
        <div style={{ padding: "0 20px 14px", borderBottom: "1px solid #F2F2F2" }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>오늘의 흐름 종합 해석</p>
          <p style={{ fontSize: 12, color: "#AAA", marginTop: 4 }}>대운 · 세운 · 월운 · 일운을 종합해 오늘을 읽습니다</p>
        </div>

        {/* Layers */}
        <div style={{ padding: "14px 20px 0" }}>
          {fortune.luckLayers.map((layer) => {
            const lc = LAYER_COLORS[layer.label] ?? { bg: "rgba(120,120,120,0.10)", color: "#555" };
            const stemF   = getTenGodFortune(layer.tenGod);
            const branchF = getTenGodFortune(layer.branchTenGod);
            const el = charToElement(layer.ganZhi[0]);
            const stemColor  = el ? ELEMENT_TEXT_HEX[el as FiveElKey] : "#111";
            const brEl = charToElement(layer.ganZhi[1]);
            const branchColor = brEl ? ELEMENT_TEXT_HEX[brEl as FiveElKey] : "#111";
            return (
              <div key={layer.label} style={{ marginBottom: 16, border: "1px solid #F0F0F0", borderRadius: 14, overflow: "hidden" }}>
                {/* Layer header */}
                <div style={{ padding: "10px 14px 9px", background: lc.bg, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: lc.color, background: "#FFF", borderRadius: 20, padding: "2px 9px" }}>{layer.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.05em" }}>
                    <span style={{ color: stemColor }}>{layer.ganZhi[0]}</span>
                    <span style={{ color: branchColor }}>{layer.ganZhi[1]}</span>
                  </span>
                  {layer.hanja && <span style={{ fontSize: 12, color: "#CCCCCC", fontFamily: "serif" }}>{layer.hanja}</span>}
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
