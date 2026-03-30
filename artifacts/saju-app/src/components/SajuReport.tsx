import { useState, useMemo } from "react";
import type { FiveElementCount } from "@/lib/sajuEngine";
import { ELEMENT_BG_COLORS, ELEMENT_COLORS } from "@/lib/sajuEngine";
import {
  buildInterpretSchema,
  STRENGTH_LEVELS,
  STRENGTH_LEVEL_INDEX,
  STRENGTH_DISPLAY_LABEL,
  STRENGTH_SHORT_DESC,
  ELEMENT_KO,
  type StrengthLevel,
} from "@/lib/interpretSchema";
import type { PersonRecord, ManualShinsalItem, MaritalStatus, ManualBranchRelation, ManualDerived } from "@/lib/storage";
import { getFinalPillars, saveManualShinsal, saveExcludedAutoShinsal, saveMaritalStatus, updatePersonRecord } from "@/lib/storage";
import { charToElement, ELEMENT_TEXT_HEX, ELEMENT_HEX, ELEMENT_LIGHT_HEX, ELEMENT_TW, getTenGodGroup, type FiveElKey } from "@/lib/element-color";
import { TodayFortuneCard } from "@/components/TodayFortuneCard";
import { getFortuneForDate } from "@/lib/todayFortune";
import { buildLifeFlowInsights } from "@/lib/lifeFlowInsight";
import { getTenGod, TEN_GOD_COLOR, TEN_GOD_KEYWORDS, TEN_GOD_TOOLTIP, TEN_GOD_ELEMENT } from "@/lib/tenGods";
import { getHiddenStems, HIDDEN_STEMS_HANJA } from "@/lib/hiddenStems";
import { InfoBottomSheet } from "@/components/InfoBottomSheet";
import type { InfoSheetType } from "@/components/InfoBottomSheet";
import {
  analyzeBranchRelations,
  RELATION_COLORS,
  RELATION_DESC,
} from "@/lib/branchRelations";
import {
  getTwelveStage,
  TWELVE_STAGE_COLOR,
  TWELVE_STAGE_DESC,
} from "@/lib/twelveStages";
import {
  calculateLuckCycles,
  calculateShinsalFull,
  SHINSAL_COLOR,
  SHINSAL_DESC,
  ALL_SHINSAL_NAMES,
  SHINSAL_GROUPS,
} from "@/lib/luckCycles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getSpousePalaceInfo,
  getComplementaryInfo,
  getMarriageTimingHint,
  getRelationshipPattern,
} from "@/lib/relationshipReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  Edit3,
  TrendingUp,
  Calendar,
  Star,
  Heart,
  Sparkles,
  Layers,
  ChevronDown,
  User,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────

const STEM_ELEMENT: Record<string, keyof FiveElementCount> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

const ELEMENT_EMOJI: Record<string, string> = {
  목: "🌳", 화: "🔥", 토: "🌍", 금: "⚔️", 수: "💧",
};

const KEYWORD_COLORS = [
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-green-100 text-green-800 border-green-200",
];

function getStemElement(ch: string): keyof FiveElementCount | null {
  return STEM_ELEMENT[ch] ?? null;
}

const STEM_SIGN: Record<string, string> = {
  갑: "+목", 을: "-목", 병: "+화", 정: "-화",
  무: "+토", 기: "-토", 경: "+금", 신: "-금",
  임: "+수", 계: "-수",
};

const BRANCH_SIGN: Record<string, string> = {
  자: "+수", 축: "-토", 인: "+목", 묘: "-목",
  진: "+토", 사: "+화", 오: "-화", 미: "-토",
  신: "+금", 유: "-금", 술: "+토", 해: "-수",
};

// ── AccSection ─────────────────────────────────────────────────────

function AccSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/40 pt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3 group"
      >
        <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div className={`space-y-4 pb-2 ${open ? "" : "hidden"}`}>{children}</div>
    </div>
  );
}


// ── Core Insight Chips ─────────────────────────────────────────────

const DAY_STEM_KEYWORDS: Record<string, string[]> = {
  갑: ["리더십", "성장", "도전"],
  을: ["유연함", "섬세함", "조화"],
  병: ["열정", "표현력", "활력"],
  정: ["직관", "헌신", "세심함"],
  무: ["신뢰", "안정", "중용"],
  기: ["꼼꼼함", "인내", "실용"],
  경: ["결단력", "원칙", "강직함"],
  신: ["완벽주의", "예민함", "정밀함"],
  임: ["창의", "유연성", "통찰"],
  계: ["감성", "적응력", "지혜"],
};

const ELEMENT_EXTRA_LABEL: Record<string, string> = {
  목: "목 기운 강",
  화: "화 기운 강",
  토: "토 기운 강",
  금: "금 기운 강",
  수: "수 기운 강",
};

function CoreInsightChips({
  dayStem,
  fiveElement,
}: {
  dayStem: string;
  fiveElement: FiveElementCount;
}) {
  const keywords = DAY_STEM_KEYWORDS[dayStem] ?? [];
  const dayEl = STEM_ELEMENT[dayStem];
  const sorted = (Object.entries(fiveElement) as [keyof FiveElementCount, number][])
    .filter(([el]) => el !== dayEl)
    .sort(([, a], [, b]) => b - a);
  const strongestExtra = sorted[0];

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-1">
      {keywords.map((kw, idx) => (
        <span
          key={kw}
          className={`text-[13px] font-bold px-3 py-1 rounded-full border ${KEYWORD_COLORS[idx % KEYWORD_COLORS.length]}`}
        >
          {kw}
        </span>
      ))}
      {strongestExtra && strongestExtra[1] >= 2 && ELEMENT_EXTRA_LABEL[strongestExtra[0]] && (
        <span className={`text-[13px] font-bold px-3 py-1 rounded-full border ${ELEMENT_TW[strongestExtra[0] as FiveElKey] ?? "bg-muted text-foreground border-border"}`}>
          {ELEMENT_EXTRA_LABEL[strongestExtra[0]]}
        </span>
      )}
    </div>
  );
}

// ── PillarTable ────────────────────────────────────────────────────

const TEN_GOD_OPTIONS = ["비견","겁재","식신","상관","편재","정재","편관","정관","편인","정인"] as const;
const TWELVE_STAGE_OPTIONS = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"] as const;

function PillarTable({
  pillars,
  dayStem,
  shinsalBranchItems,
  manualDerived,
  onSaveDerived,
}: {
  pillars: Array<{
    label: string;
    hangul: string;
    hanja: string;
    isDayMaster?: boolean;
    isUnknown?: boolean;
  }>;
  dayStem: string;
  shinsalBranchItems?: string[][];
  manualDerived?: ManualDerived;
  onSaveDerived?: (d: ManualDerived) => void;
}) {
  const [activeTooltip, setActiveTooltip] = useState<{ idx: number; type: "stem" | "branch" } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [localDerived, setLocalDerived] = useState<ManualDerived>(() => manualDerived ?? {});

  const computed = pillars.map((p, i) => {
    const stemChar = p.hangul[0] ?? "";
    const branchChar = p.hangul[1] ?? "";
    const stemEl = stemChar ? charToElement(stemChar) : null;
    const branchEl = branchChar ? charToElement(branchChar) : null;
    const stemTenGod = (dayStem && stemChar) ? getTenGod(dayStem, stemChar) : null;
    const branchTenGod = (dayStem && branchChar) ? getTenGod(dayStem, branchChar) : null;
    const stage = dayStem && branchChar ? getTwelveStage(dayStem, branchChar) : null;
    const hidden = branchChar ? getHiddenStems(branchChar) : [];
    const shinsal = shinsalBranchItems?.[i] ?? [];
    const key = String(i);
    const effStemTG = localDerived.stemTenGod?.[key] ?? stemTenGod;
    const effBranchTG = localDerived.branchTenGod?.[key] ?? branchTenGod;
    const effHidden = localDerived.hiddenStems?.[key] ?? hidden.join("");
    const effStage = localDerived.twelveStage?.[key] ?? stage;
    const effShinsal = localDerived.branchShinsal?.[key] ?? shinsal.join(" ");
    return { ...p, i, key, stemChar, branchChar, stemEl, branchEl, stemTenGod, branchTenGod, stage, hidden, shinsal, effStemTG, effBranchTG, effHidden, effStage, effShinsal };
  });

  function isOpen(idx: number, type: "stem" | "branch") {
    return activeTooltip?.idx === idx && activeTooltip?.type === type;
  }
  function toggle(idx: number, type: "stem" | "branch") {
    setActiveTooltip(isOpen(idx, type) ? null : { idx, type });
  }

  function setDerived<K extends keyof ManualDerived>(field: K, idx: number, value: string) {
    setLocalDerived((prev) => ({
      ...prev,
      [field]: { ...(prev[field] as Record<string, string> ?? {}), [String(idx)]: value },
    }));
  }

  function handleSave() {
    onSaveDerived?.(localDerived);
    setEditMode(false);
  }
  function handleCancel() {
    setLocalDerived(manualDerived ?? {});
    setEditMode(false);
  }

  const selectStyle = "text-[10px] border border-border rounded px-0.5 py-0.5 bg-background w-full max-w-[60px] text-center";
  const inputStyle = "text-[10px] border border-border rounded px-1 py-0.5 bg-background w-full max-w-[60px] text-center";

  return (
    <div className="space-y-0">
      {/* Edit toggle bar */}
      {onSaveDerived && (
        <div className="flex justify-end mb-1.5 gap-1.5">
          {editMode ? (
            <>
              <button onClick={handleSave} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-primary text-primary-foreground transition-all active:scale-95">저장</button>
              <button onClick={handleCancel} className="text-[12px] font-medium px-3 py-1 rounded-lg border border-border text-muted-foreground transition-all active:scale-95">취소</button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="text-[12px] font-medium px-3 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all active:scale-95">✏️ 원국 수정</button>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-border">
        <table className="w-full border-collapse">
          {/* Column headers */}
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="py-1.5 px-1.5 w-[44px] bg-muted/20 border-r border-border/40" />
              {computed.map((c, i) => (
                <th key={i} className={`py-1.5 px-1 text-[12px] font-semibold text-center border-l border-border/40 ${c.isDayMaster ? "bg-amber-50 text-amber-700" : "text-muted-foreground"}`}>
                  {c.label}{c.isDayMaster && "★"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 천간 row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">천간</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1.5 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-xl text-muted-foreground">?</span> : (
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-bold leading-tight ${c.stemEl ? ELEMENT_COLORS[c.stemEl] : ""}`}>
                        {c.stemChar}<span className="text-base font-normal font-serif">{c.hanja[0]}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{STEM_SIGN[c.stemChar] ?? ""}</span>
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* 십성 (stem) row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">십성</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1.5 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span> : editMode ? (
                    <select value={c.effStemTG ?? ""} onChange={(e) => setDerived("stemTenGod", i, e.target.value)} className={selectStyle}>
                      <option value="">-</option>
                      {TEN_GOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.effStemTG ? (
                    <button onClick={() => toggle(i, "stem")}
                      className={`text-[12px] font-semibold px-1 py-0.5 rounded transition-colors ${isOpen(i, "stem") ? "bg-primary/15 text-primary" : TEN_GOD_COLOR[c.effStemTG as keyof typeof TEN_GOD_COLOR]}`}>
                      {c.effStemTG}
                    </button>
                  ) : <span className="text-[10px] text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>

            {/* 지지 row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">지지</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1.5 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-xl text-muted-foreground">?</span> : (
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-bold leading-tight ${c.branchEl ? ELEMENT_COLORS[c.branchEl] : ""}`}>
                        {c.branchChar}<span className="text-base font-normal font-serif">{c.hanja[1]}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{BRANCH_SIGN[c.branchChar] ?? ""}</span>
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* 십성 (branch) row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">십성</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1.5 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <select value={c.effBranchTG ?? ""} onChange={(e) => setDerived("branchTenGod", i, e.target.value)} className={selectStyle}>
                      <option value="">-</option>
                      {TEN_GOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.effBranchTG ? (
                    <button onClick={() => toggle(i, "branch")}
                      className={`text-[12px] font-semibold px-1 py-0.5 rounded transition-colors ${isOpen(i, "branch") ? "bg-primary/15 text-primary" : TEN_GOD_COLOR[c.effBranchTG as keyof typeof TEN_GOD_COLOR]}`}>
                      {c.effBranchTG}
                    </button>
                  ) : <span className="text-[10px] text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>

            {/* 지장간 row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">지장간</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <input type="text" value={c.effHidden} onChange={(e) => setDerived("hiddenStems", i, e.target.value)} className={inputStyle} maxLength={6} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{c.effHidden || "-"}</span>
                  )}
                </td>
              ))}
            </tr>

            {/* 12운성 row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">12운성</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <select value={c.effStage ?? ""} onChange={(e) => setDerived("twelveStage", i, e.target.value)} className={selectStyle}>
                      <option value="">-</option>
                      {TWELVE_STAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.effStage ? (
                    <span className={`text-[12px] font-semibold ${TWELVE_STAGE_COLOR[c.effStage as keyof typeof TWELVE_STAGE_COLOR]}`}>{c.effStage}</span>
                  ) : <span className="text-[10px] text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>

            {/* 12신살 row */}
            <tr>
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">12신살</td>
              {computed.map((c, i) => (
                <td key={i} className={`text-center py-1 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <input type="text" value={c.effShinsal} onChange={(e) => setDerived("branchShinsal", i, e.target.value)} className={inputStyle} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground leading-tight block">{c.effShinsal || "-"}</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ten-god tooltip card */}
      {!editMode && activeTooltip && (() => {
        const c = computed[activeTooltip.idx];
        const tg = activeTooltip.type === "stem" ? c.effStemTG : c.effBranchTG;
        if (!tg) return null;
        const tooltip = TEN_GOD_TOOLTIP[tg as keyof typeof TEN_GOD_TOOLTIP];
        const kws = TEN_GOD_KEYWORDS[tg as keyof typeof TEN_GOD_KEYWORDS] ?? [];
        return (
          <div className="border border-border rounded-xl bg-card px-4 py-3 space-y-2 mt-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${TEN_GOD_COLOR[tg as keyof typeof TEN_GOD_COLOR]}`}>{tg}</span>
                <span className="ml-2 text-[13px] text-muted-foreground">{tooltip?.headline}</span>
              </div>
              <button onClick={() => setActiveTooltip(null)} className="text-muted-foreground/50 hover:text-muted-foreground text-sm">✕</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {kws.map((kw) => (
                <span key={kw} className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{kw}</span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Five-element pentagon diagram ────────────────────────────────

const TENGOD_GROUP_HEX: Record<string, string> = {
  비겁: "#15803d", 식상: "#991b1b", 재성: "#854d0e", 관성: "#374151", 인성: "#1e40af",
};

function FiveElementSection({ counts, dayStem }: { counts: FiveElementCount; dayStem?: string }) {
  // Pentagon order starting from top, clockwise: 화→토→금→수→목
  const elements: FiveElKey[] = ["화", "토", "금", "수", "목"];
  const total = elements.reduce((s, e) => s + (counts[e] ?? 0), 0) || 1;
  const dayEl = dayStem ? (STEM_ELEMENT[dayStem] as FiveElKey | undefined) : undefined;

  // Pentagon positions: center (148, 148), radius 82
  const CX = 148, CY = 148, R = 82, NODE_R = 32;
  const nodes = elements.map((el, k) => {
    const angle = k * 72 * Math.PI / 180;
    const x = CX + R * Math.sin(angle);
    const y = CY - R * Math.cos(angle);
    const count = counts[el] ?? 0;
    const pct = count / total;
    const tenGodGroup = dayEl ? getTenGodGroup(dayEl, el) : null;
    return { el, x, y, count, pct, tenGodGroup };
  });

  // Arrow path from node i to node j (offset from circle edges)
  function arrowD(fromIdx: number, toIdx: number) {
    const { x: x1, y: y1 } = nodes[fromIdx];
    const { x: x2, y: y2 } = nodes[toIdx];
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1) return "";
    const dx = (x2 - x1) / d, dy = (y2 - y1) / d;
    return `M ${(x1 + (NODE_R + 3) * dx).toFixed(1)} ${(y1 + (NODE_R + 3) * dy).toFixed(1)} L ${(x2 - (NODE_R + 9) * dx).toFixed(1)} ${(y2 - (NODE_R + 9) * dy).toFixed(1)}`;
  }

  // 상생 (generates): 화→토→금→수→목→화 (clockwise outer ring, idx 0→1→2→3→4→0)
  const generatesArrows = elements.map((_, i) => ({ from: i, to: (i + 1) % 5 }));
  // 상극 (controls): 목극토, 토극수, 수극화, 화극금, 금극목 (inner star)
  const controlsArrows = [{ from: 4, to: 1 }, { from: 1, to: 3 }, { from: 3, to: 0 }, { from: 0, to: 2 }, { from: 2, to: 4 }];

  return (
    <div className="flex flex-col items-center gap-2">
      {dayStem && dayEl && (
        <p className="text-[13px] font-bold text-foreground self-start">나의 오행: {dayStem}{dayEl}</p>
      )}
      <div className="flex gap-4 text-[12px] self-start">
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="text-blue-500 font-bold">→</span> 생(生)
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="text-red-500 font-bold">→</span> 극(剋)
        </span>
      </div>
      <svg viewBox="0 0 296 296" width="100%" style={{ maxWidth: 444 }}>
        <defs>
          <marker id="arr-gen" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="#3B82F6" opacity="0.8" />
          </marker>
          <marker id="arr-ctrl" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="#EF4444" opacity="0.8" />
          </marker>
          {nodes.map(({ el, x, y }) => (
            <clipPath key={el} id={`pclip-${el}`}>
              <circle cx={x} cy={y} r={NODE_R} />
            </clipPath>
          ))}
        </defs>

        {/* 상생 arrows (blue) */}
        {generatesArrows.map(({ from, to }, i) => {
          const d = arrowD(from, to);
          return d ? <path key={i} d={d} stroke="#3B82F6" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gen)" opacity="0.7" /> : null;
        })}

        {/* 상극 arrows (red star) */}
        {controlsArrows.map(({ from, to }, i) => {
          const d = arrowD(from, to);
          return d ? <path key={i} d={d} stroke="#EF4444" strokeWidth="1.5" fill="none" markerEnd="url(#arr-ctrl)" opacity="0.7" /> : null;
        })}

        {/* Element nodes */}
        {nodes.map(({ el, x, y, pct, count, tenGodGroup }) => {
          const fillY = y + NODE_R * (1 - 2 * pct);
          const fillH = 2 * NODE_R * pct;
          const isDay = el === dayEl;
          return (
            <g key={el}>
              <circle cx={x} cy={y} r={NODE_R} fill="white" stroke={isDay ? ELEMENT_HEX[el] : "#e5e7eb"} strokeWidth={isDay ? 2.5 : 1.5} />
              <rect x={x - NODE_R} y={fillY} width={NODE_R * 2} height={Math.max(0, fillH)}
                fill={ELEMENT_HEX[el]} opacity={0.35} clipPath={`url(#pclip-${el})`} />
              <text x={x} y={y - (tenGodGroup ? 9 : 4)} textAnchor="middle" fontSize="15" fontWeight="700" fill={ELEMENT_TEXT_HEX[el]}>{el}</text>
              {tenGodGroup && (
                <text x={x} y={y + 5} textAnchor="middle" fontSize="10" fontWeight="600" fill={TENGOD_GROUP_HEX[tenGodGroup] ?? "#9ca3af"}>({tenGodGroup})</text>
              )}
              <text x={x} y={y + (tenGodGroup ? 18 : 11)} textAnchor="middle" fontSize="11" fill="#6b7280">
                {count}개 {Math.round(pct * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Ten-God Distribution Section ──────────────────────────────────

function TenGodDistributionSection({
  dayStem,
  allChars,
  onTap,
}: {
  dayStem: string;
  allChars: string[];
  onTap: (group: string) => void;
}) {
  const groups = ["비겁", "식상", "재성", "관성", "인성"];
  const groupFor = (tg: string | null): string | null => {
    if (!tg) return null;
    if (tg === "비견" || tg === "겁재") return "비겁";
    if (tg === "식신" || tg === "상관") return "식상";
    if (tg === "편재" || tg === "정재") return "재성";
    if (tg === "편관" || tg === "정관") return "관성";
    if (tg === "편인" || tg === "정인") return "인성";
    return null;
  };
  const counts: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const ch of allChars) {
    if (!ch) continue;
    const tg = getTenGod(dayStem, ch);
    const g = groupFor(tg);
    if (g) counts[g]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const GROUP_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
    비겁: { bar: "bg-green-500",  bg: "bg-green-100 border-green-200",   text: "text-green-800" },
    식상: { bar: "bg-red-500",    bg: "bg-red-100 border-red-200",       text: "text-red-800" },
    재성: { bar: "bg-yellow-500", bg: "bg-yellow-100 border-yellow-200", text: "text-yellow-800" },
    관성: { bar: "bg-gray-400",   bg: "bg-gray-100 border-gray-200",     text: "text-gray-700" },
    인성: { bar: "bg-blue-500",   bg: "bg-blue-100 border-blue-200",     text: "text-blue-800" },
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-3">
        {groups.map((g) => {
          const pct = Math.round((counts[g] / total) * 100);
          const c = GROUP_COLORS[g];
          return (
            <button
              key={g}
              onClick={() => onTap(g)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-bold cursor-pointer transition-all active:scale-95 hover:shadow-sm ${c.bg} ${c.text}`}
            >
              <span>{g}</span>
              <span className="font-normal opacity-75">{counts[g]}개</span>
              <span className="font-normal opacity-60">{pct}%</span>
              <span className="text-[13px] opacity-50 ml-0.5">▸</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5">
        {groups.map((g) => {
          const pct = Math.round((counts[g] / total) * 100);
          const c = GROUP_COLORS[g];
          return (
            <button
              key={g}
              onClick={() => onTap(g)}
              className="w-full flex items-center gap-3 text-left hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
            >
              <span className="w-10 text-[13px] font-semibold shrink-0">{g}</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[13px] font-bold whitespace-nowrap text-right px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}>
                {counts[g]}개 {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Interpretation helpers ─────────────────────────────────────────

function getDayMasterSummary(dayStem: string, counts: FiveElementCount) {
  const el = STEM_ELEMENT[dayStem];
  if (!el) return "";
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const pct = counts[el] / total;
  if (pct >= 0.4) return `일간 ${dayStem}(${el})이 매우 강합니다. 신강 사주로 활동적이고 자기주장이 강한 편입니다.`;
  if (pct >= 0.25) return `일간 ${dayStem}(${el})의 기운이 적절합니다. 균형 잡힌 사주입니다.`;
  return `일간 ${dayStem}(${el})이 약합니다. 신약 사주로 섬세하고 타인과의 관계를 중시하는 경향이 있습니다.`;
}

// ── Strength visual graph ─────────────────────────────────────────

const STRENGTH_SEGMENT_COLOR: Record<number, string> = {
  0: "bg-red-700 text-white",
  1: "bg-red-500 text-white",
  2: "bg-orange-400 text-white",
  3: "bg-emerald-500 text-white",
  4: "bg-blue-400 text-white",
  5: "bg-blue-600 text-white",
  6: "bg-indigo-700 text-white",
};

function StrengthGraph({ level }: { level: StrengthLevel }) {
  const idx = STRENGTH_LEVEL_INDEX[level];
  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 rounded-lg overflow-hidden">
        {STRENGTH_LEVELS.map((lvl, i) => (
          <div
            key={lvl}
            className={`flex-1 py-2 text-center text-[10px] font-bold leading-tight transition-all ${
              i === idx
                ? STRENGTH_SEGMENT_COLOR[i]
                : "bg-muted/40 text-muted-foreground/40"
            }`}
          >
            {lvl}
          </div>
        ))}
      </div>
      <p className="text-[13px] text-center text-muted-foreground">
        현재 사주 강도:{" "}
        <span className="font-bold text-foreground">{level}</span>
      </p>
    </div>
  );
}

// ── Structural summary card (interactive inline editing) ──────────

const YONGSHIN_TYPES = ["억부용신", "조후용신", "통관용신", "병약용신"] as const;
type YongshinType = typeof YONGSHIN_TYPES[number];
type YongshinEntry = { type: string; elements: string[] };

function SajuStructureSummary({
  dayStem,
  counts,
  monthBranch,
  dayBranch,
  allStems,
  allBranches,
  overrideStrengthLevel,
  overrideYongshinData,
  onStrengthLevelChange,
  onYongshinDataChange,
}: {
  dayStem: string;
  counts: FiveElementCount;
  monthBranch?: string;
  dayBranch?: string;
  allStems?: string[];
  allBranches?: string[];
  overrideStrengthLevel?: string | null;
  overrideYongshinData?: YongshinEntry[] | null;
  onStrengthLevelChange?: (lv: string | null) => void;
  onYongshinDataChange?: (data: YongshinEntry[]) => void;
}) {
  const [editMode, setEditMode] = useState<"none" | "strength" | "yongshin">("none");
  const [activeYongshinType, setActiveYongshinType] = useState<YongshinType>("억부용신");
  const [localYongshinData, setLocalYongshinData] = useState<YongshinEntry[]>(overrideYongshinData ?? []);

  const baseSchema = buildInterpretSchema(dayStem, counts, monthBranch, dayBranch, allStems, allBranches);
  const schema = {
    ...baseSchema,
    ...(overrideStrengthLevel ? {
      strengthLevel: overrideStrengthLevel as StrengthLevel,
      strengthDisplayLabel: STRENGTH_DISPLAY_LABEL[overrideStrengthLevel as StrengthLevel] ?? overrideStrengthLevel,
      strengthDesc: STRENGTH_SHORT_DESC[overrideStrengthLevel as StrengthLevel] ?? "",
    } : {}),
  };

  const hasYongshinOverride = overrideYongshinData && overrideYongshinData.length > 0;
  const canEdit = !!(onStrengthLevelChange || onYongshinDataChange);

  function getTypeElements(type: string): string[] {
    return localYongshinData.find((e) => e.type === type)?.elements ?? [];
  }

  function toggleElement(type: string, el: string) {
    setLocalYongshinData((prev) => {
      const existing = prev.find((e) => e.type === type);
      if (existing) {
        const newEls = existing.elements.includes(el)
          ? existing.elements.filter((e) => e !== el)
          : [...existing.elements, el];
        if (newEls.length === 0) return prev.filter((e) => e.type !== type);
        return prev.map((e) => e.type === type ? { ...e, elements: newEls } : e);
      } else {
        return [...prev, { type, elements: [el] }];
      }
    });
  }

  function saveYongshin() {
    onYongshinDataChange?.(localYongshinData);
    setEditMode("none");
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-amber-700 tracking-wide">나의 사주 구조 요약</p>
        {canEdit && editMode !== "none" && (
          <button
            onClick={() => setEditMode("none")}
            className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full border border-border hover:bg-muted/40 transition-colors"
          >
            닫기
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {/* 대표 오행 */}
        <div className="rounded-lg bg-white border border-border/60 px-2 py-2.5">
          <p className="text-[11px] text-muted-foreground mb-1">대표 오행</p>
          <p className={`text-base font-bold ${ELEMENT_COLORS[schema.dominantElement]}`}>
            {schema.dominantElement}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{ELEMENT_KO[schema.dominantElement].split(" ")[1] ?? ""}</p>
        </div>

        {/* 사주 강도 */}
        <button
          onClick={() => canEdit && onStrengthLevelChange && setEditMode((m) => m === "strength" ? "none" : "strength")}
          className={`rounded-lg bg-white border px-2 py-2.5 text-center transition-all active:scale-95 ${
            editMode === "strength" ? "border-amber-400 ring-1 ring-amber-300" : "border-border/60"
          } ${canEdit && onStrengthLevelChange ? "cursor-pointer hover:border-amber-300" : "cursor-default"}`}
        >
          <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
            사주 강도
            {canEdit && onStrengthLevelChange && <span className="text-[9px] opacity-40">✎</span>}
          </p>
          <p className="text-base font-bold text-foreground">{schema.strengthDisplayLabel}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{schema.strengthDesc}</p>
        </button>

        {/* 용신 */}
        <button
          onClick={() => canEdit && onYongshinDataChange && setEditMode((m) => m === "yongshin" ? "none" : "yongshin")}
          className={`rounded-lg bg-white border px-2 py-2.5 text-center transition-all active:scale-95 ${
            editMode === "yongshin" ? "border-amber-400 ring-1 ring-amber-300" : "border-border/60"
          } ${canEdit && onYongshinDataChange ? "cursor-pointer hover:border-amber-300" : "cursor-default"}`}
        >
          <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
            용신
            {!hasYongshinOverride && (
              <span className="text-[9px] font-bold text-orange-500 bg-orange-50 rounded px-1 align-middle">후보</span>
            )}
            {canEdit && onYongshinDataChange && <span className="text-[9px] opacity-40">✎</span>}
          </p>
          {hasYongshinOverride ? (
            <div className="space-y-0.5">
              {overrideYongshinData!.map((entry) => (
                <div key={entry.type} className="text-[10px] text-left">
                  <span className="text-muted-foreground/60">{entry.type.replace("용신", "")}:</span>{" "}
                  {entry.elements.map((el, i) => (
                    <span key={i} className={`font-bold ${ELEMENT_COLORS[el as keyof typeof ELEMENT_COLORS] ?? ""}`}>{el}</span>
                  )).reduce<React.ReactNode[]>((acc, node, i) => i === 0 ? [node] : [...acc, " ", node], [])}
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className={`text-base font-bold ${ELEMENT_COLORS[schema.yongshin]}`}>{schema.yongshinLabel}</p>
              {schema.yongshinSecondary && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  보조: <span className={ELEMENT_COLORS[schema.yongshinSecondary]}>{schema.yongshinSecondary}</span>
                </p>
              )}
            </>
          )}
        </button>
      </div>

      <StrengthGraph level={schema.strengthLevel} />

      {/* 사주 강도 picker */}
      {editMode === "strength" && onStrengthLevelChange && (
        <div className="pt-1 space-y-2 border-t border-amber-100">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">사주 강도 선택</p>
          <div className="flex flex-wrap gap-1.5">
            {STRENGTH_LEVELS.map((lv) => {
              const isActive = (overrideStrengthLevel ?? baseSchema.strengthLevel) === lv;
              return (
                <button
                  key={lv}
                  onClick={() => { onStrengthLevelChange(lv === baseSchema.strengthLevel ? null : lv); setEditMode("none"); }}
                  className={`text-[13px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    isActive ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-muted/30 text-muted-foreground border-border hover:border-amber-300 hover:text-amber-700"
                  }`}
                >
                  {lv}
                </button>
              );
            })}
            {overrideStrengthLevel && (
              <button onClick={() => { onStrengthLevelChange(null); setEditMode("none"); }} className="text-[11px] text-muted-foreground px-2 py-1.5 rounded-full border border-border hover:bg-muted/40 transition-colors">초기화</button>
            )}
          </div>
        </div>
      )}

      {/* 용신 multi-type picker */}
      {editMode === "yongshin" && onYongshinDataChange && (
        <div className="pt-1 space-y-3 border-t border-amber-100">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">용신 설정</p>
            <div className="flex gap-1.5">
              <button onClick={saveYongshin} className="text-[12px] font-bold px-3 py-1 rounded-full bg-amber-500 text-white border-amber-500 transition-all active:scale-95">저장</button>
              {overrideYongshinData && overrideYongshinData.length > 0 && (
                <button onClick={() => { setLocalYongshinData([]); onYongshinDataChange([]); setEditMode("none"); }} className="text-[11px] text-muted-foreground px-2 py-1 rounded-full border border-border hover:bg-muted/40 transition-colors">초기화</button>
              )}
            </div>
          </div>
          {/* Type tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {YONGSHIN_TYPES.map((t) => {
              const hasEntries = getTypeElements(t).length > 0;
              return (
                <button
                  key={t}
                  onClick={() => setActiveYongshinType(t)}
                  className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap transition-all active:scale-95 ${
                    activeYongshinType === t
                      ? "bg-amber-500 text-white border-amber-500"
                      : hasEntries
                      ? "bg-amber-50 text-amber-700 border-amber-300"
                      : "bg-muted/20 text-muted-foreground border-border"
                  }`}
                >
                  {t}
                  {hasEntries && `: ${getTypeElements(t).join("")}`}
                </button>
              );
            })}
          </div>
          {/* Element multi-select for active type */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">{activeYongshinType} 오행 선택 (복수 가능)</p>
            <div className="flex gap-2">
              {(["목", "화", "토", "금", "수"] as const).map((el) => {
                const isActive = getTypeElements(activeYongshinType).includes(el);
                const hex = ELEMENT_TEXT_HEX[el] ?? "#555";
                const lightHex = ELEMENT_LIGHT_HEX[el] ?? "#F9F9F9";
                return (
                  <button
                    key={el}
                    onClick={() => toggleElement(activeYongshinType, el)}
                    style={{ background: isActive ? hex : lightHex, color: isActive ? "#FFF" : hex, border: `1.5px solid ${isActive ? hex : hex + "55"}` }}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    {el}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Current selections summary */}
          {localYongshinData.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {localYongshinData.map((entry) => (
                <div key={entry.type} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <span className="text-[11px] text-amber-700 font-semibold">{entry.type.replace("용신", "")}: {entry.elements.join(" ")}</span>
                  <button onClick={() => setLocalYongshinData((prev) => prev.filter((e) => e.type !== entry.type))} className="text-amber-400 hover:text-amber-700 text-[11px] leading-none">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getElementBalanceSummary(counts: FiveElementCount) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const missing = (["목", "화", "토", "금", "수"] as const).filter((el) => counts[el] === 0);
  const dominant = (["목", "화", "토", "금", "수"] as const).filter((el) => counts[el] / total >= 0.4);
  if (missing.length === 0 && dominant.length === 0) return "오행이 고르게 분포되어 있습니다. 다재다능하고 균형 잡힌 성격입니다.";
  if (missing.length > 0) return `${missing.join("·")} 오행이 부족합니다. 해당 기운을 보완하는 것이 도움이 됩니다.`;
  if (dominant.length > 0) return `${dominant.join("·")} 오행이 편중되어 있습니다. 해당 기운의 특성이 강하게 나타납니다.`;
  return "오행 분포에 주의가 필요합니다.";
}

// ── Fortune Calendar (일운 monthly view) ──────────────────────────

function FortuneCalendar({ record }: { record: PersonRecord }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();

  const dayFortunes = useMemo(() => {
    const arr: Array<{ day: number; fortune: ReturnType<typeof getFortuneForDate> }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, fortune: getFortuneForDate(record, viewYear, viewMonth, d) });
    }
    return arr;
  }, [record, viewYear, viewMonth, daysInMonth]);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const selectedFortune = selectedDay !== null ? dayFortunes.find((f) => f.day === selectedDay) : null;

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function toneDotColor(fortune: ReturnType<typeof getFortuneForDate>) {
    const tg = fortune.dayTenGod;
    const favorable = ["식신", "정재", "정관", "정인"];
    const cautious = ["겁재", "상관", "편관", "편재"];
    if (tg && favorable.includes(tg)) return "#22C55E";
    if (tg && cautious.includes(tg)) return "#EF4444";
    return "#F59E0B";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="px-3 py-1 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors active:scale-95">‹</button>
        <span className="text-sm font-bold">{viewYear}년 {viewMonth}월</span>
        <button onClick={nextMonth} className="px-3 py-1 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors active:scale-95">›</button>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-bold py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[52px]" />
        ))}
        {dayFortunes.map(({ day, fortune }) => {
          const isToday = day === today.getDate() && viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
          const isSelected = selectedDay === day;
          const dow = (firstDayOfWeek + day - 1) % 7;
          const ganjiStr = fortune.dayGanZhiStr ?? "";
          const stemEl = ganjiStr[0] ? charToElement(ganjiStr[0]) : null;
          const branchEl = ganjiStr[1] ? charToElement(ganjiStr[1]) : null;
          const dot = toneDotColor(fortune);
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`min-h-[52px] flex flex-col items-center justify-start pt-1 pb-1 rounded-lg transition-all active:scale-95 border ${
                isSelected ? "border-orange-400 bg-orange-50" : isToday ? "border-amber-300 bg-amber-50/60" : "border-transparent hover:border-border hover:bg-muted/20"
              }`}
            >
              <span className={`text-[12px] font-bold leading-none mb-0.5 ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-foreground"}`}>
                {day}
              </span>
              <span className="text-[11px] font-bold leading-none">
                <span style={{ color: stemEl ? ELEMENT_TEXT_HEX[stemEl] : "#555" }}>{ganjiStr[0] ?? ""}</span>
                <span style={{ color: branchEl ? ELEMENT_TEXT_HEX[branchEl] : "#555" }}>{ganjiStr[1] ?? ""}</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: dot }} />
            </button>
          );
        })}
      </div>

      {selectedDay !== null && selectedFortune && (
        <div className="mt-4">
          <TodayFortuneCard record={record} year={viewYear} month={viewMonth} day={selectedDay} />
        </div>
      )}
    </div>
  );
}

// ── Luck Flow Tabs ─────────────────────────────────────────────────

type LuckTabKey = "대운" | "세운" | "월운" | "일운";

function LuckFlowTabs({
  luckCycles,
  dayStem,
  birthYear,
  onInfoSheet,
  record,
}: {
  luckCycles: ReturnType<typeof calculateLuckCycles>;
  dayStem: string;
  birthYear: number;
  onInfoSheet: (info: InfoSheetType) => void;
  record: PersonRecord;
}) {
  const [tab, setTab] = useState<LuckTabKey>("대운");
  const TABS: { key: LuckTabKey; label: string }[] = [
    { key: "대운", label: "대운" },
    { key: "세운", label: "세운" },
    { key: "월운", label: "월운" },
    { key: "일운", label: "일운" },
  ];
  const now = new Date();
  const age = now.getFullYear() - birthYear;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95 ${
              tab === key
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 대운 panel */}
      {tab === "대운" && (
        <div className="space-y-2">
          {luckCycles.daewoon.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">대운 데이터가 없습니다</p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground px-0.5">10년 주기 운의 흐름 · 항목을 탭하면 해석을 볼 수 있습니다</p>
              <div className="grid grid-cols-2 gap-2">
                {luckCycles.daewoon.slice(0, 8).map((entry, i) => {
                  const stemEl = getStemElement(entry.ganZhi.stem);
                  const branchEl = STEM_ELEMENT[entry.ganZhi.branch] ?? null;
                  const tg = dayStem ? getTenGod(dayStem, entry.ganZhi.stem) : null;
                  const isCurrent = age >= entry.startAge && age <= entry.endAge;
                  const branchTg = dayStem ? getTenGod(dayStem, entry.ganZhi.branch) : null;
                  return (
                    <button
                      key={i}
                      onClick={() => onInfoSheet({ kind: "luck", luckType: "대운", ganZhiStr: entry.ganZhi.hangul, ganZhiHanja: entry.ganZhi.hanja, tenGod: tg, branchTenGod: branchTg, period: `${entry.startAge}~${entry.endAge}세`, dayStem })}
                      className={`rounded-lg border p-2.5 flex items-center gap-2.5 cursor-pointer transition-all active:scale-95 hover:bg-muted/30 text-left ${isCurrent ? "border-amber-400 bg-amber-50" : "border-border bg-muted/20"}`}
                    >
                      <div className="text-center w-14 shrink-0">
                        <p className="text-[13px] text-muted-foreground">{entry.startAge}~{entry.endAge}세</p>
                        {isCurrent && <p className="text-[13px] text-amber-600 font-bold">현재</p>}
                      </div>
                      <div className="flex gap-0.5 items-center">
                        <span className={`text-xl font-bold ${stemEl ? ELEMENT_COLORS[stemEl] : ""}`}>{entry.ganZhi.stem}</span>
                        <span className={`text-xl font-bold ${branchEl ? ELEMENT_COLORS[branchEl] : ""}`}>{entry.ganZhi.branch}</span>
                      </div>
                      {tg && <span className={`text-[13px] font-bold px-1 py-0.5 rounded ml-auto ${TEN_GOD_COLOR[tg]}`}>{tg}</span>}
                      <span className="text-[13px] text-muted-foreground opacity-40 ml-auto">▸</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 세운 panel */}
      {tab === "세운" && (
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground px-0.5">연간 운세 · 탭하면 해석을 볼 수 있습니다</p>
          <div className="flex gap-2 flex-wrap">
            {luckCycles.seun.map(({ year, ganZhi }) => {
              const se = getStemElement(ganZhi.stem);
              const be = STEM_ELEMENT[ganZhi.branch] ?? null;
              const isThisYear = year === now.getFullYear();
              const tg = dayStem ? getTenGod(dayStem, ganZhi.stem) : null;
              const btg = dayStem ? getTenGod(dayStem, ganZhi.branch) : null;
              return (
                <button
                  key={year}
                  onClick={() => onInfoSheet({ kind: "luck", luckType: "세운", ganZhiStr: ganZhi.hangul, ganZhiHanja: ganZhi.hanja, tenGod: tg, branchTenGod: btg, period: `${year}년`, dayStem })}
                  className={`rounded-lg border px-3 py-2 text-center cursor-pointer transition-all active:scale-95 hover:brightness-95 ${isThisYear ? "border-amber-300 bg-amber-50" : "border-border bg-muted/20"}`}
                >
                  <p className="text-[13px] text-muted-foreground">{year}년</p>
                  <div className="flex gap-0.5 justify-center mt-0.5">
                    <span className={`text-lg font-bold ${se ? ELEMENT_COLORS[se] : ""}`}>{ganZhi.stem}</span>
                    <span className={`text-lg font-bold ${be ? ELEMENT_COLORS[be] : ""}`}>{ganZhi.branch}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground font-serif">{ganZhi.hanja}</p>
                  {isThisYear
                    ? <p className="text-[13px] text-amber-600 font-medium mt-0.5">올해 ▸</p>
                    : <p className="text-[13px] text-muted-foreground/40 mt-0.5">▸</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 월운 panel */}
      {tab === "월운" && (
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground px-0.5">이달 월운과 오늘 일운 · 탭하면 해석을 볼 수 있습니다</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { luckType: "월운" as const, gz: luckCycles.wolun.ganZhi, sub: `${luckCycles.wolun.year}년 ${luckCycles.wolun.month}월` },
              { luckType: "일운" as const, gz: luckCycles.ilun.ganZhi, sub: `${luckCycles.ilun.month}월 ${luckCycles.ilun.day}일` },
            ] as const).map(({ luckType, gz, sub }) => {
              const se = getStemElement(gz.stem);
              const be = STEM_ELEMENT[gz.branch] ?? null;
              const tg = dayStem ? getTenGod(dayStem, gz.stem) : null;
              const btg = dayStem ? getTenGod(dayStem, gz.branch) : null;
              return (
                <button
                  key={luckType}
                  onClick={() => onInfoSheet({ kind: "luck", luckType, ganZhiStr: gz.hangul, ganZhiHanja: gz.hanja, tenGod: tg, branchTenGod: btg, period: sub, dayStem })}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-3 cursor-pointer transition-all active:scale-95 hover:bg-muted/30 text-left w-full"
                >
                  <p className="text-[13px] text-muted-foreground mb-1.5">{luckType} · {sub}</p>
                  <div className="flex gap-0.5 items-baseline">
                    <span className={`text-xl font-bold ${se ? ELEMENT_COLORS[se] : ""}`}>{gz.stem}</span>
                    <span className={`text-xl font-bold ${be ? ELEMENT_COLORS[be] : ""}`}>{gz.branch}</span>
                    <span className="text-[13px] text-muted-foreground font-serif ml-1">{gz.hanja}</span>
                  </div>
                  {tg && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block ${TEN_GOD_COLOR[tg]}`}>{tg}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 일운 panel */}
      {tab === "일운" && <FortuneCalendar record={record} />}
    </div>
  );
}

// ── Main Report ────────────────────────────────────────────────────

interface SajuReportProps {
  record: PersonRecord;
  showSaveStatus?: boolean;
}

export function SajuReport({ record, showSaveStatus = true }: SajuReportProps) {
  const [infoSheet, setInfoSheet] = useState<InfoSheetType | null>(null);
  const [manualShinsal, setManualShinsal] = useState<ManualShinsalItem[]>(record.manualShinsal ?? []);
  const [excludedAutoShinsal, setExcludedAutoShinsal] = useState<ManualShinsalItem[]>(record.excludedAutoShinsal ?? []);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | undefined>(record.maritalStatus);
  const [pickerForPosition, setPickerForPosition] = useState<string | null>(null);
  const [manualBranchAdd, setManualBranchAdd] = useState<ManualBranchRelation[]>(record.manualBranchRelationAdd ?? []);
  const [manualBranchRemove, setManualBranchRemove] = useState<string[]>(record.manualBranchRelationRemove ?? []);
  const [branchEditMode, setBranchEditMode] = useState(false);
  const [showBranchAddSheet, setShowBranchAddSheet] = useState(false);
  const [branchAddType, setBranchAddType] = useState<string>("지지육합");
  const [branchAddPick1, setBranchAddPick1] = useState<string>("");
  const [branchAddPick2, setBranchAddPick2] = useState<string>("");
  const [localStrengthLevel, setLocalStrengthLevel] = useState<string | null>(record.manualStrengthLevel ?? null);
  const [localYongshinData, setLocalYongshinData] = useState<{ type: string; elements: string[] }[]>(record.manualYongshinData ?? []);
  const [manualDerived, setManualDerived] = useState<ManualDerived>(record.manualDerived ?? {});

  // ── Interpretation subtab state ────────────────────────────────
  const INTERPRET_TABS = [
    { key: "전체",    icon: "✨" },
    { key: "사랑",    icon: "❤️" },
    { key: "재물",    icon: "💰" },
    { key: "건강",    icon: "🌿" },
    { key: "일성과",  icon: "⚡" },
    { key: "성격",    icon: "🌟" },
    { key: "배우자운", icon: "💍" },
  ] as const;
  type InterpretTab = (typeof INTERPRET_TABS)[number]["key"];
  const [interpretTab, setInterpretTab] = useState<InterpretTab>("전체");

  // ── Handlers ───────────────────────────────────────────────────
  function handleMaritalStatus(status: MaritalStatus) {
    const next = status === maritalStatus ? undefined : status;
    setMaritalStatus(next);
    saveMaritalStatus(record.id, next);
  }

  function handleAddShinsal(name: string) {
    if (!pickerForPosition) return;
    if (manualShinsal.some((m) => m.position === pickerForPosition && m.name === name)) return;
    setManualShinsal((prev) => {
      const next = [...prev, { position: pickerForPosition, name }];
      saveManualShinsal(record.id, next);
      return next;
    });
    setPickerForPosition(null);
  }

  function handleDeleteManualShinsal(position: string, name: string) {
    setManualShinsal((prev) => {
      const next = prev.filter((m) => !(m.position === position && m.name === name));
      saveManualShinsal(record.id, next);
      return next;
    });
  }

  function handleExcludeAutoShinsal(position: string, name: string) {
    setExcludedAutoShinsal((prev) => {
      if (prev.some((m) => m.position === position && m.name === name)) return prev;
      const next = [...prev, { position, name }];
      saveExcludedAutoShinsal(record.id, next);
      return next;
    });
  }

  function handleRestoreAutoShinsal(position: string, name: string) {
    setExcludedAutoShinsal((prev) => {
      const next = prev.filter((m) => !(m.position === position && m.name === name));
      saveExcludedAutoShinsal(record.id, next);
      return next;
    });
  }

  // ── Computed values ────────────────────────────────────────────
  const pillars = getFinalPillars(record);
  const profile = record.profile;
  const input = record.birthInput;
  const isManuallyEdited = !!(record.manualPillars && Object.keys(record.manualPillars).length > 0);

  const pillarData = [
    { label: "생시", hangul: pillars.hour?.hangul ?? "", hanja: pillars.hour?.hanja ?? "", isUnknown: !pillars.hour || input.timeUnknown },
    { label: "생일", hangul: pillars.day?.hangul ?? "", hanja: pillars.day?.hanja ?? "", isDayMaster: true },
    { label: "생월", hangul: pillars.month?.hangul ?? "", hanja: pillars.month?.hanja ?? "" },
    { label: "생년", hangul: pillars.year?.hangul ?? "", hanja: pillars.year?.hanja ?? "" },
  ];

  const dayStem = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";

  const allChars = [
    pillars.hour?.hangul?.[0], pillars.hour?.hangul?.[1],
    pillars.day?.hangul?.[1],
    pillars.month?.hangul?.[0], pillars.month?.hangul?.[1],
    pillars.year?.hangul?.[0], pillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const allStems = [
    pillars.hour?.hangul?.[0], dayStem,
    pillars.month?.hangul?.[0], pillars.year?.hangul?.[0],
  ].filter((c): c is string => !!c);
  const allBranches = [
    pillars.hour?.hangul?.[1], dayBranch,
    pillars.month?.hangul?.[1], pillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const branchRelations = analyzeBranchRelations(pillars);
  const luckCycles = calculateLuckCycles(input, record.profile.computedPillars);

  const shinsalPillars = (dayStem && dayBranch)
    ? calculateShinsalFull(dayStem, dayBranch, input.month, [
        { pillar: "시주", stem: pillars.hour?.hangul?.[0] ?? "", branch: pillars.hour?.hangul?.[1] ?? "" },
        { pillar: "일주", stem: pillars.day?.hangul?.[0] ?? "", branch: pillars.day?.hangul?.[1] ?? "" },
        { pillar: "월주", stem: pillars.month?.hangul?.[0] ?? "", branch: pillars.month?.hangul?.[1] ?? "" },
        { pillar: "년주", stem: pillars.year?.hangul?.[0] ?? "", branch: pillars.year?.hangul?.[1] ?? "" },
      ])
    : [];

  const shinsalBranchItems = (["시주", "일주", "월주", "년주"] as const).map(
    (name) => shinsalPillars.find((p) => p.pillar === name)?.branchItems ?? []
  );

  const PILLAR_TO_POSITIONS: Record<string, { stem: string; branch: string }> = {
    시주: { stem: "시천간", branch: "시지" },
    일주: { stem: "일천간", branch: "일지" },
    월주: { stem: "월천간", branch: "월지" },
    년주: { stem: "연천간", branch: "연지" },
  };

  const autoShinsalSet = new Set<string>(
    shinsalPillars.flatMap((ps) => [
      ...(ps.pillarItems ?? []), ...(ps.stemItems ?? []), ...(ps.branchItems ?? []),
    ])
  );

  const autoShinsalByPosition = new Map<string, Set<string>>();
  for (const ps of shinsalPillars) {
    const pos = PILLAR_TO_POSITIONS[ps.pillar];
    if (!pos) continue;
    const stemSet = autoShinsalByPosition.get(pos.stem) ?? new Set<string>();
    for (const n of [...(ps.pillarItems ?? []), ...(ps.stemItems ?? [])]) stemSet.add(n);
    autoShinsalByPosition.set(pos.stem, stemSet);
    const branchSet = autoShinsalByPosition.get(pos.branch) ?? new Set<string>();
    for (const n of (ps.branchItems ?? [])) branchSet.add(n);
    autoShinsalByPosition.set(pos.branch, branchSet);
  }

  const finalShinsalNames = new Set<string>();
  for (const ps of shinsalPillars) {
    const pos = PILLAR_TO_POSITIONS[ps.pillar];
    if (!pos) continue;
    const stemItems = [...(ps.pillarItems ?? []), ...(ps.stemItems ?? [])];
    const branchItems = ps.branchItems ?? [];
    for (const n of stemItems) {
      if (!excludedAutoShinsal.some((e) => e.position === pos.stem && e.name === n)) finalShinsalNames.add(n);
    }
    for (const n of branchItems) {
      if (!excludedAutoShinsal.some((e) => e.position === pos.branch && e.name === n)) finalShinsalNames.add(n);
    }
  }
  for (const m of manualShinsal) finalShinsalNames.add(m.name);

  const lifeFlowData = buildLifeFlowInsights(
    { ...record, maritalStatus },
    { finalShinsalNames }
  );

  const tenGodPairs = [
    ...(pillars.hour ? [{ label: "시주", pillar: pillars.hour }] : []),
    { label: "일주 (일간)", pillar: pillars.day, isSelf: true },
    { label: "월주", pillar: pillars.month },
    { label: "년주", pillar: pillars.year },
  ];

  const spousePalace = dayBranch ? getSpousePalaceInfo(dayBranch) : null;
  const complementary = dayBranch ? getComplementaryInfo(dayBranch) : null;
  const marriageTiming = (dayStem && luckCycles.daewoon.length > 0)
    ? getMarriageTimingHint(input.gender, dayStem, luckCycles.daewoon)
    : null;
  const relationshipPattern = (dayStem && dayBranch)
    ? getRelationshipPattern(dayStem, dayBranch, profile.fiveElementDistribution)
    : null;

  const [reportTab, setReportTab] = useState<"원국" | "성향" | "운세" | "해석">("원국");

  return (
    <div className="space-y-4">

      {/* ── 상단 요약 (항상 표시) ── */}
      {dayStem && (
        <CoreInsightChips dayStem={dayStem} fiveElement={profile.fiveElementDistribution} />
      )}

      {/* ── 탭 바 ── */}
      <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
        {(["원국", "성향", "운세", "해석"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setReportTab(tab)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95 ${
              reportTab === tab
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 원국 ── */}
      {reportTab === "원국" && (
        <div className="space-y-3">
          {/* 사주팔자 — 항상 표시 */}
          <PillarTable
            pillars={pillarData}
            dayStem={dayStem}
            shinsalBranchItems={shinsalBranchItems}
            manualDerived={manualDerived}
            onSaveDerived={async (d) => {
              setManualDerived(d);
              await updatePersonRecord(record.id, { manualDerived: d });
            }}
          />

          <AccSection title="오행 분포 五行分布">
            <FiveElementSection counts={profile.fiveElementDistribution} dayStem={dayStem} />
          </AccSection>

          {/* 신살 */}
          {dayStem && dayBranch && (
            <AccSection title="신살 神殺">
              <div className="space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  일간 <span className="font-bold text-foreground">{dayStem}</span> · 일지 <span className="font-bold text-foreground">{dayBranch}</span> 기준
                </p>
                {[
                  { pillar: "시주", stemLabel: "시천간", branchLabel: "시지", isDay: false, isUnknown: !pillars.hour || input.timeUnknown },
                  { pillar: "일주", stemLabel: "일천간", branchLabel: "일지", isDay: true, isUnknown: false },
                  { pillar: "월주", stemLabel: "월천간", branchLabel: "월지", isDay: false, isUnknown: false },
                  { pillar: "년주", stemLabel: "연천간", branchLabel: "연지", isDay: false, isUnknown: false },
                ].map(({ pillar, stemLabel, branchLabel, isDay, isUnknown }) => {
                  const ps = shinsalPillars.find((p) => p.pillar === pillar);
                  const positions = PILLAR_TO_POSITIONS[pillar] ?? { stem: stemLabel, branch: branchLabel };
                  const autoStemRaw = [...(ps?.pillarItems ?? []), ...(ps?.stemItems ?? [])];
                  const autoBranchRaw = ps?.branchItems ?? [];
                  const visibleAutoStem = autoStemRaw.filter((n) => !excludedAutoShinsal.some((e) => e.position === positions.stem && e.name === n));
                  const visibleAutoBranch = autoBranchRaw.filter((n) => !excludedAutoShinsal.some((e) => e.position === positions.branch && e.name === n));
                  const manualStem = manualShinsal.filter((m) => m.position === positions.stem);
                  const manualBranch = manualShinsal.filter((m) => m.position === positions.branch);
                  const renderPositionRow = (label: string, pos: string, autoItems: string[], rawAutoItems: string[], manualItems: ManualShinsalItem[], isLast: boolean) => {
                    const excludedAtPos = rawAutoItems.filter((n) => excludedAutoShinsal.some((e) => e.position === pos && e.name === n));
                    const mergedNames = new Set(autoItems.filter((n) => manualItems.some((m) => m.name === n)));
                    const autoOnly = autoItems.filter((n) => !mergedNames.has(n));
                    const manualOnly = manualItems.filter((m) => !mergedNames.has(m.name));
                    const isEmpty = autoItems.length === 0 && manualItems.length === 0 && excludedAtPos.length === 0;
                    return (
                      <div className={`flex items-start gap-2 px-3 py-2.5 ${isLast ? "" : "border-b border-border/40"}`}>
                        <span className="text-[13px] text-muted-foreground w-14 shrink-0 pt-1 font-medium">{label}</span>
                        {isUnknown ? (
                          <span className="text-[13px] text-muted-foreground italic pt-0.5">미상</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {[...mergedNames].map((n) => (
                              <div key={`merged-${pos}-${n}`} className="flex items-center gap-0.5">
                                <button onClick={() => setInfoSheet({ kind: "shinsal", name: n, source: "auto" })}
                                  className={`text-[13px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 hover:brightness-95 ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>
                                  {n}
                                </button>
                                <button title="자동 제외" onClick={(e) => { e.stopPropagation(); handleExcludeAutoShinsal(pos, n); }}
                                  className="text-[13px] text-orange-500 hover:text-orange-700 px-1 py-0.5 rounded border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors font-bold shrink-0">제외</button>
                                <button title="수동 삭제" onClick={(e) => { e.stopPropagation(); handleDeleteManualShinsal(pos, n); }}
                                  className="text-[13px] text-red-500 hover:text-red-700 px-1 py-0.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 transition-colors font-bold shrink-0">✕</button>
                              </div>
                            ))}
                            {autoOnly.map((n) => (
                              <div key={`auto-${pos}-${n}`} className="flex items-center gap-0.5">
                                <button onClick={() => setInfoSheet({ kind: "shinsal", name: n, source: "auto" })}
                                  className={`text-[13px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 hover:brightness-95 ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>
                                  {n}
                                </button>
                                <button title="제외" onClick={(e) => { e.stopPropagation(); handleExcludeAutoShinsal(pos, n); }}
                                  className="text-[13px] text-muted-foreground hover:text-red-600 px-1 py-0.5 rounded border border-border hover:border-red-200 hover:bg-red-50 transition-colors font-bold shrink-0">✕</button>
                              </div>
                            ))}
                            {manualOnly.map((m) => (
                              <div key={`manual-${pos}-${m.name}`} className="flex items-center gap-0.5">
                                <button onClick={() => setInfoSheet({ kind: "shinsal", name: m.name, source: "manual" })}
                                  className={`text-[13px] font-bold px-2.5 py-1 rounded-full border border-dashed transition-all active:scale-95 hover:brightness-95 ${SHINSAL_COLOR[m.name] ?? "bg-muted text-muted-foreground border-border"}`}>
                                  {m.name}
                                </button>
                                <button title="삭제" onClick={(e) => { e.stopPropagation(); handleDeleteManualShinsal(pos, m.name); }}
                                  className="text-[13px] text-red-500 hover:text-red-700 px-1 py-0.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 transition-colors font-bold shrink-0">✕</button>
                              </div>
                            ))}
                            {excludedAtPos.map((n) => (
                              <div key={`excl-${pos}-${n}`} className="flex items-center gap-0.5">
                                <span className="text-[13px] text-muted-foreground/40 px-2 py-0.5 rounded-full border border-dashed border-border line-through">{n}</span>
                                <button title="복원" onClick={() => handleRestoreAutoShinsal(pos, n)}
                                  className="text-[13px] text-blue-500 hover:text-blue-700 px-1 py-0.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors font-bold shrink-0">↺</button>
                              </div>
                            ))}
                            {isEmpty && <span className="text-[13px] text-muted-foreground opacity-50">없음</span>}
                            <button onClick={() => setPickerForPosition(pos)}
                              className="text-[13px] font-bold px-2 py-0.5 rounded-full border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 transition-colors">+ 추가</button>
                          </div>
                        )}
                      </div>
                    );
                  };
                  return (
                    <div key={pillar} className={`rounded-lg border overflow-hidden ${isDay ? "border-amber-200" : "border-border/70"}`}>
                      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDay ? "bg-amber-50/60 border-amber-200" : "bg-muted/30 border-border/50"}`}>
                        <span className="text-[13px] font-bold text-foreground">{pillar}</span>
                        {!isUnknown && ps && (
                          <div className="flex gap-1 ml-1">
                            {ps.stem && <span className="text-sm font-bold">{ps.stem}</span>}
                            {ps.branch && <span className="text-sm font-bold">{ps.branch}</span>}
                          </div>
                        )}
                        {isDay && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold ml-auto">일간</span>}
                        {isUnknown && <span className="text-[13px] text-muted-foreground ml-auto">시간 미상</span>}
                      </div>
                      {renderPositionRow(stemLabel, positions.stem, visibleAutoStem, autoStemRaw, manualStem, false)}
                      {renderPositionRow(branchLabel, positions.branch, visibleAutoBranch, autoBranchRaw, manualBranch, true)}
                    </div>
                  );
                })}
                <Dialog open={pickerForPosition !== null} onOpenChange={(o) => { if (!o) setPickerForPosition(null); }}>
                  <DialogContent className="max-w-sm max-h-[82vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base">신살 추가</DialogTitle>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        <span className="font-bold text-blue-600">{pickerForPosition}</span>에 추가할 신살을 선택하세요
                      </p>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                      {SHINSAL_GROUPS.map((group) => {
                        const visibleNames = group.names.filter((name) => ALL_SHINSAL_NAMES.includes(name));
                        if (visibleNames.length === 0) return null;
                        return (
                          <div key={group.label}>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border/40 pb-1">{group.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {visibleNames.map((name) => {
                                const isAlreadyManual = manualShinsal.some((m) => m.position === pickerForPosition && m.name === name);
                                const isAlreadyAutoHere = pickerForPosition
                                  ? (autoShinsalByPosition.get(pickerForPosition)?.has(name) ?? false)
                                    && !excludedAutoShinsal.some((e) => e.position === pickerForPosition && e.name === name)
                                  : false;
                                const isAutoElsewhere = !isAlreadyAutoHere && autoShinsalSet.has(name);
                                const isDisabled = isAlreadyManual || isAlreadyAutoHere;
                                return (
                                  <button key={name} disabled={isDisabled} onClick={() => handleAddShinsal(name)}
                                    className={`text-[13px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                                      isDisabled ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : SHINSAL_COLOR[name] ?? "bg-muted text-foreground border-border hover:brightness-95"
                                    }`}>
                                    {name}
                                    {isAlreadyManual && <span className="ml-1 text-[11px] opacity-70">이미추가</span>}
                                    {isAlreadyAutoHere && <span className="ml-1 text-[11px] opacity-60">자동있음</span>}
                                    {isAutoElsewhere && !isDisabled && <span className="ml-1 text-[11px] opacity-40">타위치있음</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setPickerForPosition(null)}
                      className="mt-4 w-full py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors">취소</button>
                  </DialogContent>
                </Dialog>
              </div>
            </AccSection>
          )}

          {/* 지장간·12운성 */}
          <AccSection title="지장간 · 12운성 地藏干">
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground mb-2">지장간 地藏干</p>
                <div className="grid grid-cols-4 gap-0 rounded-xl overflow-hidden border border-border">
                  {[
                    { label: "시지", branch: pillars.hour?.hangul?.[1], isDay: false },
                    { label: "일지", branch: pillars.day?.hangul?.[1], isDay: true },
                    { label: "월지", branch: pillars.month?.hangul?.[1], isDay: false },
                    { label: "년지", branch: pillars.year?.hangul?.[1], isDay: false },
                  ].map(({ label, branch, isDay }, i) => {
                    const hidden = branch ? getHiddenStems(branch) : [];
                    const hiddenHanja = branch ? (HIDDEN_STEMS_HANJA[branch] ?? []) : [];
                    return (
                      <div key={i} className={`border-r last:border-r-0 border-border ${isDay ? "bg-amber-50" : "bg-card"}`}>
                        <div className="text-center text-[13px] font-medium text-muted-foreground py-1.5 border-b border-border bg-muted/40">{label}</div>
                        <div className="flex flex-col items-center gap-1 py-2.5 px-1">
                          {branch ? (
                            <>
                              <span className="text-base font-bold text-foreground">{branch}</span>
                              {hidden.length > 0 ? (
                                <div className="flex flex-col items-center gap-0.5 mt-1">
                                  {hidden.map((s, j) => {
                                    const el = STEM_ELEMENT[s];
                                    return (
                                      <span key={j} className={`text-[13px] font-semibold px-1.5 py-0.5 rounded-sm ${el ? ELEMENT_BG_COLORS[el] : "bg-muted"}`}>
                                        {s}<span className="text-[13px] ml-0.5 opacity-70">{hiddenHanja[j]}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : <span className="text-[13px] text-muted-foreground">-</span>}
                            </>
                          ) : <span className="text-muted-foreground text-sm">?</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {dayStem && (
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground mb-2">12운성 · 일간 <span className="font-bold text-foreground">{dayStem}</span> 기준</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "시지", branch: pillars.hour?.hangul?.[1] },
                      { label: "일지", branch: pillars.day?.hangul?.[1] },
                      { label: "월지", branch: pillars.month?.hangul?.[1] },
                      { label: "년지", branch: pillars.year?.hangul?.[1] },
                    ].map(({ label, branch }) => {
                      if (!branch) return null;
                      const stage = getTwelveStage(dayStem, branch);
                      return (
                        <div key={label} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                          <span className="text-[13px] text-muted-foreground w-8 shrink-0">{label}</span>
                          <span className="text-base font-bold">{branch}</span>
                          <span className="text-muted-foreground">→</span>
                          {stage ? (
                            <div className="flex flex-col">
                              <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${TWELVE_STAGE_COLOR[stage]}`}>{stage}</span>
                              <span className="text-[13px] text-muted-foreground mt-0.5">{TWELVE_STAGE_DESC[stage]}</span>
                            </div>
                          ) : <span className="text-[13px] text-muted-foreground">-</span>}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
              )}
            </div>
          </AccSection>

          {/* 천간·지지 관계 */}
          <AccSection title="천간 · 지지 관계 干支關係">
            {(() => {
              const visibleAuto = branchRelations.filter((rel) => {
                const key = `${rel.type}:${rel.description}`;
                return !manualBranchRemove.includes(key);
              });
              const allVisible = [
                ...visibleAuto.map((r) => ({ ...r, isManual: false as const, manualRef: null })),
                ...manualBranchAdd.map((r) => ({
                  type: r.type as typeof branchRelations[number]["type"],
                  description: `${r.branch1}${r.branch2} ${r.type}`,
                  isManual: true as const,
                  manualRef: r,
                })),
              ];
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">탭하면 상세 해석 · 편집 모드에서 추가/삭제</p>
                    <button
                      onClick={() => setBranchEditMode((m) => !m)}
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-colors active:scale-95 ${branchEditMode ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-muted/40 text-muted-foreground border-border"}`}
                    >
                      {branchEditMode ? "완료" : "편집"}
                    </button>
                  </div>
                  {allVisible.length === 0 && (
                    <p className="text-sm text-muted-foreground py-1">특별한 지지 관계가 없습니다.</p>
                  )}
                  {allVisible.map((rel, i) => {
                    const relBranches = rel.description.match(/[자축인묘진사오미신유술해]/g) ?? [];
                    const autoKey = `${rel.type}:${rel.description}`;
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        <button
                          className="flex-1 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-left active:bg-muted/30 transition-colors"
                          onClick={() => setInfoSheet({ kind: "branchRelation", relationType: rel.type, branches: relBranches })}
                        >
                          <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full shrink-0 ${RELATION_COLORS[rel.type]}`}>{rel.type}</span>
                          <span className="text-sm font-medium flex-1">{rel.description}</span>
                          {rel.isManual && <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1 ml-1 shrink-0">수동</span>}
                          {!branchEditMode && <span className="text-[11px] text-muted-foreground ml-auto shrink-0">›</span>}
                        </button>
                        {branchEditMode && (
                          <button
                            onClick={() => {
                              if (rel.isManual && rel.manualRef) {
                                const next = manualBranchAdd.filter(
                                  (r) => !(r.branch1 === rel.manualRef!.branch1 && r.branch2 === rel.manualRef!.branch2 && r.type === rel.manualRef!.type)
                                );
                                setManualBranchAdd(next);
                                updatePersonRecord(record.id, { manualBranchRelationAdd: next });
                              } else {
                                const next = [...manualBranchRemove, autoKey];
                                setManualBranchRemove(next);
                                updatePersonRecord(record.id, { manualBranchRelationRemove: next });
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold border border-red-200 shrink-0 active:scale-95 transition-all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {branchEditMode && (
                    <button
                      onClick={() => setShowBranchAddSheet(true)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-green-400 text-green-700 bg-green-50/60 px-3 py-2 text-[13px] font-bold active:scale-95 transition-all"
                    >
                      + 관계 수동 추가
                    </button>
                  )}
                  {manualBranchRemove.length > 0 && branchEditMode && (
                    <button
                      onClick={() => { setManualBranchRemove([]); updatePersonRecord(record.id, { manualBranchRelationRemove: [] }); }}
                      className="text-[11px] text-muted-foreground underline px-1"
                    >
                      숨긴 자동관계 복원
                    </button>
                  )}
                </div>
              );
            })()}
          </AccSection>

          {/* 수동 지지관계 추가 다이얼로그 */}
          <Dialog open={showBranchAddSheet} onOpenChange={(o) => { if (!o) { setShowBranchAddSheet(false); setBranchAddPick1(""); setBranchAddPick2(""); } }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">지지 관계 수동 추가</DialogTitle>
                <p className="text-[13px] text-muted-foreground mt-1">관계 유형과 두 지지를 선택하세요</p>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground mb-2 uppercase">관계 유형</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["천간합", "지지육합", "지지삼합", "지지방합", "천간충", "지지충", "형", "파", "해", "원진", "공망"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setBranchAddType(t)}
                        className={`text-[12px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${branchAddType === t ? RELATION_COLORS[t] : "bg-muted/30 text-muted-foreground border-border"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground mb-2 uppercase">지지 선택 (두 개)</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"].map((b) => {
                      const el = charToElement(b);
                      const isP1 = branchAddPick1 === b;
                      const isP2 = branchAddPick2 === b;
                      return (
                        <button
                          key={b}
                          onClick={() => {
                            if (isP1) { setBranchAddPick1(""); return; }
                            if (isP2) { setBranchAddPick2(""); return; }
                            if (!branchAddPick1) setBranchAddPick1(b);
                            else if (!branchAddPick2) setBranchAddPick2(b);
                            else { setBranchAddPick1(branchAddPick2); setBranchAddPick2(b); }
                          }}
                          style={el ? { color: isP1 || isP2 ? "#FFF" : ELEMENT_TEXT_HEX[el], background: isP1 || isP2 ? ELEMENT_HEX[el] : ELEMENT_LIGHT_HEX[el] } : {}}
                          className={`text-center py-2 rounded-lg text-sm font-bold border transition-all ${isP1 || isP2 ? "border-current shadow-sm scale-105" : "border-transparent"}`}
                        >
                          {b}
                          {isP1 && <span className="block text-[9px] opacity-80">①</span>}
                          {isP2 && <span className="block text-[9px] opacity-80">②</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  disabled={!branchAddPick1 || !branchAddPick2}
                  onClick={() => {
                    const item: ManualBranchRelation = { type: branchAddType, branch1: branchAddPick1, branch2: branchAddPick2 };
                    const next = [...manualBranchAdd, item];
                    setManualBranchAdd(next);
                    updatePersonRecord(record.id, { manualBranchRelationAdd: next });
                    setShowBranchAddSheet(false);
                    setBranchAddPick1("");
                    setBranchAddPick2("");
                  }}
                  className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                >
                  추가하기
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── 탭 2: 성향 ── */}
      {reportTab === "성향" && (
        <div className="space-y-3">
          {/* 사주 구조 요약 (항상 표시) */}
          {dayStem && (
            <SajuStructureSummary
              dayStem={dayStem}
              counts={profile.fiveElementDistribution}
              monthBranch={pillars.month?.hangul?.[1]}
              dayBranch={dayBranch}
              allStems={allStems}
              allBranches={allBranches}
              overrideStrengthLevel={localStrengthLevel}
              overrideYongshinData={localYongshinData}
              onStrengthLevelChange={(lv) => {
                setLocalStrengthLevel(lv);
                updatePersonRecord(record.id, { manualStrengthLevel: lv ?? undefined });
              }}
              onYongshinDataChange={(data) => {
                setLocalYongshinData(data);
                updatePersonRecord(record.id, { manualYongshinData: data });
              }}
            />
          )}

          {/* 일간 성향 카드 */}
          {dayStem && (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5">
              <p className="text-[13px] font-bold text-muted-foreground mb-1.5">일간 성향 · {dayStem}일간</p>
              <p className="text-sm text-foreground leading-relaxed">{getDayMasterSummary(dayStem, profile.fiveElementDistribution)}</p>
            </div>
          )}

          {/* 오행 균형 */}
          <AccSection title="오행 균형 五行均衡">
            <div className="rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2.5">
              <p className="text-sm">{getElementBalanceSummary(profile.fiveElementDistribution)}</p>
            </div>
            <FiveElementSection counts={profile.fiveElementDistribution} dayStem={dayStem} />
          </AccSection>

          {/* 십성 분포 */}
          <AccSection title="십성 분포 十星分布" defaultOpen>
            {dayStem ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-muted-foreground mb-2.5">각 항목을 탭하면 자세한 설명을 볼 수 있습니다</p>
                  <TenGodDistributionSection
                    dayStem={dayStem}
                    allChars={allChars}
                    onTap={(group) => setInfoSheet({ kind: "tengod-group", group })}
                  />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground mb-2">십성 개별 배치</p>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-[13px] text-muted-foreground">
                          <td className="py-1.5 px-2 text-center font-medium">주</td>
                          <td className="py-1.5 px-2 text-center font-medium border-l border-border">천간</td>
                          <td className="py-1.5 px-2 text-center font-medium border-l border-border">십성</td>
                          <td className="py-1.5 px-2 text-center font-medium border-l border-border">지지</td>
                          <td className="py-1.5 px-2 text-center font-medium border-l border-border">십성</td>
                        </tr>
                      </thead>
                      <tbody>
                        {tenGodPairs.map(({ label, pillar, isSelf }, i) => {
                          if (!pillar) return null;
                          const stem = pillar.hangul[0];
                          const branch = pillar.hangul[1];
                          const stemTg = getTenGod(dayStem, stem);
                          const branchTg = getTenGod(dayStem, branch);
                          const stemEl = charToElement(stem);
                          const branchEl = charToElement(branch);
                          return (
                            <tr key={i} className={`border-t border-border ${isSelf ? "bg-amber-50/60" : ""}`}>
                              <td className="py-2 px-2 text-center text-[13px] text-muted-foreground">{label}</td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                <span className={`font-bold ${stemEl ? ELEMENT_COLORS[stemEl] : ""}`}>{stem}</span>
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                {stemTg ? (
                                  <span className={`text-[13px] px-1.5 py-0.5 rounded font-bold ${TEN_GOD_COLOR[stemTg]}`}>{stemTg}</span>
                                ) : <span className="text-[13px] text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                <span className={`font-bold ${branchEl ? ELEMENT_COLORS[branchEl] : ""}`}>{branch}</span>
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                {branchTg ? (
                                  <span className={`text-[13px] px-1.5 py-0.5 rounded font-bold ${TEN_GOD_COLOR[branchTg]}`}>{branchTg}</span>
                                ) : <span className="text-[13px] text-muted-foreground">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">일간 정보가 없습니다</p>
            )}
          </AccSection>

          {/* 배우자궁 */}
          {spousePalace && (
            <AccSection title="배우자궁 配偶者宮" defaultOpen>
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center">
                    <span className="text-lg font-bold text-rose-700">{dayBranch}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{spousePalace.title}</p>
                    <p className="text-[13px] text-muted-foreground">{spousePalace.element} 기운 · 일지(배우자궁)</p>
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{spousePalace.summary}</p>
                {spousePalace.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {spousePalace.strengths.map((s) => (
                      <span key={s} className="text-[13px] bg-emerald-50 border border-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">✓ {s}</span>
                    ))}
                  </div>
                )}
                {spousePalace.cautions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {spousePalace.cautions.map((c) => (
                      <span key={c} className="text-[13px] bg-amber-50 border border-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">⚠ {c}</span>
                    ))}
                  </div>
                )}
              </div>
            </AccSection>
          )}
        </div>
      )}

      {/* ── 탭 3: 운세 ── */}
      {reportTab === "운세" && (
        <div className="space-y-3">
          <Card className="border-[#EBEBEB] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                운 흐름 運氣
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LuckFlowTabs
                luckCycles={luckCycles}
                dayStem={dayStem}
                birthYear={input.year}
                onInfoSheet={setInfoSheet}
                record={record}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 탭 4: 해석 ── */}
      {reportTab === "해석" && dayStem && lifeFlowData && (
        <div className="space-y-3">
          {/* 해석 서브탭 */}
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="flex gap-1.5 min-w-max">
              {INTERPRET_TABS.map(({ key, icon }) => {
                const active = interpretTab === key;
                return (
                  <button key={key} onClick={() => setInterpretTab(key)}
                    className={`text-[13px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 whitespace-nowrap ${
                      active ? "bg-foreground text-background border-foreground" : "bg-muted/30 text-muted-foreground border-border"
                    }`}>
                    {icon} {key}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 오늘의 전체 흐름 — 전체 탭에서만 노출 */}
          {interpretTab === "전체" && <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                오늘의 전체 흐름
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-sm text-foreground leading-relaxed">{lifeFlowData.overall.fullText}</p>
              <p className="text-[13px] text-indigo-700 leading-relaxed">{lifeFlowData.overall.activityFlow}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: "감정 흐름", text: lifeFlowData.overall.emotional },
                  { label: "결정 타이밍", text: lifeFlowData.overall.decisionTiming },
                ].map(({ label, text }) => (
                  <div key={label} className="rounded-lg bg-indigo-50/80 border border-indigo-100 px-2.5 py-2">
                    <p className="text-[13px] font-semibold text-indigo-500 mb-0.5">{label}</p>
                    <p className="text-[13px] text-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>}

          {/* 도메인 카드 */}
          {(() => {
            const categoryTabMap: Record<string, InterpretTab> = {
              "관계운": "사랑", "재물운": "재물", "건강운": "건강", "일·성과운": "일성과",
            };
            const visibleCards = lifeFlowData.lifeFlows.filter((card) => {
              if (interpretTab === "전체") return true;
              const mapped = categoryTabMap[card.category];
              return mapped === interpretTab;
            });
            if (visibleCards.length === 0) return null;
            return (
              <div className={`grid gap-3 ${visibleCards.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {visibleCards.map((card) => {
                  const borderColor = card.level === "good" ? "border-green-200" : card.level === "caution" ? "border-orange-200" : "border-border";
                  const bgColor = card.level === "good" ? "bg-green-50/40" : card.level === "caution" ? "bg-orange-50/40" : "bg-muted/20";
                  const levelLabel = card.level === "good" ? "▲ 좋음" : card.level === "caution" ? "▼ 주의" : "— 보통";
                  const levelColor = card.level === "good" ? "text-green-600" : card.level === "caution" ? "text-orange-600" : "text-muted-foreground";
                  return (
                    <div key={card.category} className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold">{card.icon} {card.category}</span>
                        <span className={`text-[13px] font-bold ${levelColor}`}>{levelLabel}</span>
                      </div>
                      <p className="text-[13px] font-medium text-foreground mb-1">{card.summary}</p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{card.detail}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* 성격 카드 */}
          {(interpretTab === "전체" || interpretTab === "성격") && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-3.5 w-3.5 text-sky-500" />
                <p className="text-[13px] font-bold text-sky-700">성격 · 기질 분석</p>
                <div className="h-px flex-1 bg-sky-100" />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-[13px] font-semibold text-amber-700 mb-1">일간 성향</p>
                <p className="text-sm">{getDayMasterSummary(dayStem, profile.fiveElementDistribution)}</p>
              </div>
              <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                <p className="text-[13px] font-semibold text-sky-700 mb-1">오행 균형</p>
                <p className="text-sm">{getElementBalanceSummary(profile.fiveElementDistribution)}</p>
              </div>
              {branchRelations.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[13px] font-semibold text-muted-foreground mb-1">차트 특징</p>
                  <p className="text-sm">
                    {[
                      branchRelations.some((r) => r.type === "지지충" || r.type === "충" || r.type === "천간충") && "충이 존재하여 변화와 활동성이 강합니다.",
                      branchRelations.some((r) => r.type === "지지육합" || r.type === "지지삼합" || r.type === "지지방합" || r.type === "천간합" || r.type === "합") && "합이 있어 인연이 풍부하고 조화로운 면이 있습니다.",
                      branchRelations.some((r) => r.type === "형") && "형이 포함되어 긴장이나 갈등 상황이 나타날 수 있습니다.",
                    ].filter(Boolean).join(" ") || `${branchRelations.map((r) => r.description).join(", ")} 관계가 있습니다.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 신살 해석 */}
          {lifeFlowData.shinsalInsight && (interpretTab === "전체" || interpretTab === "사랑" || interpretTab === "배우자운") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-3.5 py-3 space-y-1.5">
              <p className="text-[13px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Star className="h-3 w-3" />
                신살 기운 해석
              </p>
              <p className="text-[13px] text-foreground leading-relaxed">{lifeFlowData.shinsalInsight}</p>
            </div>
          )}

          {/* 배우자운 상세 */}
          {(interpretTab === "전체" || interpretTab === "배우자운") && (
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    관계 흐름 변화 시기
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-muted-foreground mb-1">현재 흐름</p>
                    <p className="text-sm text-foreground">{lifeFlowData.relationshipTiming.current}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-blue-600 mb-1">다가오는 흐름</p>
                    <p className="text-sm text-foreground">{lifeFlowData.relationshipTiming.upcoming}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    인연운 활성 시기
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-foreground">{lifeFlowData.connectionActivation.summary}</p>
                  <p className="text-[13px] text-muted-foreground">{lifeFlowData.connectionActivation.period}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 관계·연애 보고서 */}
          {(interpretTab === "전체" || interpretTab === "배우자운") && (complementary || marriageTiming || relationshipPattern) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-foreground">관계 · 연애 사주 해석</h3>
                <div className="h-px flex-1 bg-border" />
              </div>
              {complementary && (
                <Card className="border-pink-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-pink-700">잘 맞는 관계 · 배우자궁</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground mb-3">{complementary.guidance}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {complementary.branches.map((b) => {
                        const el = ({"자":"수","축":"토","인":"목","묘":"목","진":"토","사":"화","오":"화","미":"토","신":"금","유":"금","술":"토","해":"수"} as Record<string,string>)[b];
                        return (
                          <span key={b} className={`text-sm font-bold px-2.5 py-1 rounded-full ${el ? ELEMENT_BG_COLORS[el as keyof typeof ELEMENT_BG_COLORS] : "bg-muted"}`}>{b}</span>
                        );
                      })}
                      {complementary.elements.map((e) => (
                        <span key={e} className={`text-[13px] px-2 py-1 rounded-full ${ELEMENT_BG_COLORS[e as keyof typeof ELEMENT_BG_COLORS] ?? "bg-muted"}`}>{e} 기운</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {marriageTiming && (
                <Card className="border-amber-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-amber-700">결혼운 시기 힌트</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                      <p className="text-sm text-foreground">{marriageTiming.general}</p>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                      <p className="text-[13px] font-semibold text-muted-foreground mb-1">대운 흐름 분석</p>
                      <p className="text-sm text-foreground">{marriageTiming.daewoonHint}</p>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                      <p className="text-[13px] font-semibold text-muted-foreground mb-1">참고 사항</p>
                      <p className="text-sm text-foreground">{marriageTiming.favorable}</p>
                    </div>
                    <p className="text-[13px] text-muted-foreground italic">※ 위 내용은 규칙 기반 간략 추정으로, 절대적 예언이 아닙니다.</p>
                  </CardContent>
                </Card>
              )}
              {relationshipPattern && (
                <Card className="border-violet-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-violet-700">연애 · 관계 패턴</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">관계 스타일</span>
                      <span className="text-[13px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">{relationshipPattern.style}</span>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                      <p className="text-[13px] font-semibold text-muted-foreground mb-1">성향 분석</p>
                      <p className="text-sm text-foreground">{relationshipPattern.styleDesc}</p>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                      <p className="text-[13px] font-semibold text-muted-foreground mb-1">선호하는 배우자</p>
                      <p className="text-sm text-foreground">{relationshipPattern.spouseStyle}</p>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                      <p className="text-[13px] font-semibold text-muted-foreground mb-1">오행 관계 특성</p>
                      <p className="text-sm text-foreground">{relationshipPattern.elemental}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 개발 디버그 */}
          {import.meta.env.DEV && (
            <details className="rounded-lg border border-dashed border-border text-[13px] text-muted-foreground">
              <summary className="px-3 py-2 cursor-pointer font-mono font-bold hover:bg-muted/30">🛠 해석 입력 상태 (개발용)</summary>
              <div className="px-3 pb-3 pt-1 space-y-1 font-mono">
                <p><span className="font-bold">관계상태:</span> {maritalStatus ?? "미설정"}</p>
                <p><span className="font-bold">finalShinsal 수:</span> {finalShinsalNames.size}개</p>
                <p><span className="font-bold">finalShinsal:</span> {finalShinsalNames.size > 0 ? [...finalShinsalNames].join(", ") : "없음"}</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── 저장 상태 (항상 표시) ── */}
      {showSaveStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">저장 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>자동 계산됨</span>
                <span className="text-[13px] text-muted-foreground ml-auto">
                  {new Date(record.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              {isManuallyEdited && (
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700 font-medium">수동 수정됨</span>
                  <span className="text-[13px] text-muted-foreground ml-auto">
                    {new Date(record.updatedAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground text-[13px] pt-1 border-t border-border">
                <span>
                  {input.calendarType === "solar" ? "양력" : "음력"} ·{" "}
                  {input.year}.{String(input.month).padStart(2, "0")}.{String(input.day).padStart(2, "0")}
                  {!input.timeUnknown
                    ? ` · ${String(input.hour ?? 0).padStart(2, "0")}:${String(input.minute ?? 0).padStart(2, "0")}`
                    : " · 시간 미상"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bottom Sheet ── */}
      <InfoBottomSheet info={infoSheet} onClose={() => setInfoSheet(null)} />
    </div>
  );
}
