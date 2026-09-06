import { useState, useCallback, useMemo, Fragment } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PillarCard } from "@/components/PillarCard";
import type { CompatibilityResult, CompatibilityTone } from "@/lib/compatibilityScore";
import type { AnyCompatibilityReport } from "@/lib/reports";
import { getCompatibilityReport } from "@/lib/reports";
import { COMPAT_TONE_COLOR } from "@/lib/compatibilityScore";
import { getCompatibilityCardPolicy } from "@/lib/compatibilityDisplayPolicy";
import { toneClasses, toneTierFromScore, toneTierFromLevel, toneClassesNeutral, type ToneTier } from "@/lib/toneColors";

const PROGRESS_READINESS_TONE: Record<"매우 낮음" | "낮음" | "보통" | "높음" | "매우 높음", ToneTier> = {
  "매우 낮음": 4, "낮음": 3, "보통": 2, "높음": 1, "매우 높음": 0,
};
import { Switch } from "@/components/ui/switch";
import {
  getMyProfile,
  getPeople,
  getFinalPillars,
  type PersonRecord,
  type RelationshipType,
  RELATIONSHIP_TYPE_EMOJI,
} from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import type { ZodiacInfo } from "@/lib/zodiacAnimal";
import { type FiveElementCount } from "@/lib/sajuEngine";
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ArrowLeftRight } from "lucide-react";
import { GenderSymbol } from "@/components/GenderSymbol";
import { CopyButton } from "@/components/CopyButton";
import { buildCompatibilityClipboardText } from "@/lib/clipboardExport";
import { Link } from "wouter";
import { Mascot } from "@/components/Mascot";
import type { MascotExpression } from "@/components/Mascot";
import { charToElement, elementColorVar, type FiveElKey } from "@/lib/element-color";
import {
  calculateLuckCycles,
} from "@/lib/luckCycles";
import { getTenGod, getTenGodChipStyle, getTenGodTw } from "@/lib/tenGods";
import {
  getSpousePalaceInfo,
  getMarriageTimingHint,
} from "@/lib/relationshipReport";
import {
  computePersonCurrentFlow,
  computeCombinedTimingFlow,
} from "@/lib/dynamicCompatibility";
import { computePersonPipelineSnapshot } from "@/lib/personPipelineSnapshot";
import { getController } from "@/lib/element-color";
import {
  computeRelationshipInteractionByYearRange,
  dampeningFromCompatibilityTone,
  type PersonInteractionContext,
} from "@/lib/evaluations/relationshipInteractionActivation";
import {
  RELATION_COLORS,
  RELATION_DETAIL,
  RELATION_DESC,
  type RelationType,
} from "@/lib/branchRelations";
import { cn } from "@/lib/utils";

function scoreToMascot(score: number): MascotExpression {
  if (score >= 75) return "happy";
  if (score >= 55) return "neutral";
  return "warning";
}

function MiniPersonCard({
  title,
  name,
  gender,
  dayHangul,
  zodiac,
  hourMode,
  onHourModeChange,
}: {
  title: string;
  name: string;
  gender: string;
  dayHangul: string;
  zodiac: ZodiacInfo | null;
  hourMode: "포함" | "제외";
  onHourModeChange: (m: "포함" | "제외") => void;
}) {
  const dayText = dayHangul && dayHangul.length >= 2 ? `${dayHangul[0]}${dayHangul[1]}일주` : "일주 정보 없음";
  return (
    <div className="ds-inline-detail-nested flex-1 min-w-0 p-3">
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-background flex items-center justify-center">
          {zodiac ? (
            <img src={zodiac.src} alt={zodiac.label} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">{name.charAt(0) || "?"}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
          <div className="mt-1 flex items-center justify-center gap-1.5 min-w-0 sm:justify-start">
            <p className="truncate text-[15px] font-extrabold text-foreground">{name}</p>
            <GenderSymbol gender={gender} />
          </div>
          <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">{dayText}</p>
        </div>
      </div>

      {/* Mobile: label + plain switch (avoid segment overflow) */}
      <div className="mt-2 w-full sm:hidden">
        <div className="border-t border-border/60 pt-2.5" />
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">시주 포함</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Switch
            checked={hourMode === "포함"}
            onCheckedChange={(v) => onHourModeChange(v ? "포함" : "제외")}
            aria-label="시주 포함/제외"
          />
          <span className="text-[12px] font-semibold text-muted-foreground">{hourMode}</span>
        </div>
      </div>

      {/* Desktop/Tablet: segmented control */}
      <div className="mt-3 hidden w-full sm:block">
        <div className="ds-segment-list min-h-9 rounded-xl border border-border shadow-none w-full">
          {(["포함", "제외"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onHourModeChange(m)}
              className={cn(
                "ds-segment-item text-[12px] shadow-none",
                hourMode === m ? "ds-segment-item-active" : "ds-segment-item-inactive",
              )}
            >
              시주 {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizeRelationType(label: string): RelationType | null {
  const s = (label ?? "").trim();
  if (!s) return null;
  if (s.includes("육합")) return "지지육합";
  if (s.includes("삼합")) return "지지삼합";
  if (s.includes("방합")) return "지지방합";
  if (s === "합") return "합";
  if (s === "충") return "충";
  if (s === "형") return "형";
  if (s === "파") return "파";
  if (s === "해") return "해";
  if (s === "원진") return "원진";
  if (s === "천간합" || s === "천간충" || s === "지지충" || s === "공망") return s as RelationType;
  return null;
}

function RelationChip({
  type,
  label,
  selected,
  onClick,
}: {
  type: RelationType;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ds-badge border text-[12px] font-semibold shadow-none transition-colors",
        RELATION_COLORS[type] ?? "bg-muted/40 text-foreground",
        selected && "border-primary bg-primary/[0.06]",
        onClick && "hover:opacity-90 active:scale-[0.99]",
      )}
      aria-pressed={!!selected}
    >
      {label}
    </button>
  );
}

function RelationInlineDetail({
  type,
  title,
  onClose,
}: {
  type: RelationType;
  title: string;
  onClose: () => void;
}) {
  const detail = RELATION_DETAIL[type];
  return (
    <div className="ds-inline-detail overflow-hidden">
      <div className="ds-inline-detail-header">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            관계 해석 카드
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md px-2 py-0.5 text-[12px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body">
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground">
            {RELATION_DESC[type] ?? detail.domain}
          </p>
          <div className="ds-inline-detail-nested space-y-1.5">
            <p className="text-[12px] font-semibold text-foreground">📋 의미</p>
            <p className="ds-body">{detail.meaning}</p>
          </div>
          <div className="ds-inline-detail-nested space-y-1.5">
            <p className="text-[12px] font-semibold text-foreground">🟢 긍정적 발현 (잘 사용될 경우)</p>
            <p className="ds-body">{detail.interpretation}</p>
          </div>
          <div className="ds-inline-detail-nested space-y-1.5">
            <p className="text-[12px] font-semibold text-foreground">⚠️ 주의할 점 (잘못 사용될 경우)</p>
            <p className="ds-body">{detail.caution}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grade color palette (single source of truth) ─────────────────
// All UI elements — card bg, graph ring, badge, score accent — derive from here.
// Keyed by result.finalType only. No other logic is used for colors.

const GRADE_PALETTE: Record<CompatibilityTone, { cardBg: string; pastel: string; strong: string; border: string; badgeText: string }> = {
  "이상적 궁합": { cardBg: "var(--compat-grade-ideal-cardBg)", pastel: "var(--compat-grade-ideal-pastel)", strong: "var(--compat-grade-ideal-strong)", border: "var(--compat-grade-ideal-border)", badgeText: "var(--compat-grade-ideal-badgeText)" },
  "좋은 궁합":   { cardBg: "var(--compat-grade-good-cardBg)", pastel: "var(--compat-grade-good-pastel)", strong: "var(--compat-grade-good-strong)", border: "var(--compat-grade-good-border)", badgeText: "var(--compat-grade-good-badgeText)" },
  "노력형 궁합": { cardBg: "var(--compat-grade-effort-cardBg)", pastel: "var(--compat-grade-effort-pastel)", strong: "var(--compat-grade-effort-strong)", border: "var(--compat-grade-effort-border)", badgeText: "var(--compat-grade-effort-badgeText)" },
  "긴장형 궁합": { cardBg: "var(--compat-grade-tense-cardBg)", pastel: "var(--compat-grade-tense-pastel)", strong: "var(--compat-grade-tense-strong)", border: "var(--compat-grade-tense-border)", badgeText: "var(--compat-grade-tense-badgeText)" },
  "주의 궁합":   { cardBg: "var(--compat-grade-caution-cardBg)", pastel: "var(--compat-grade-caution-pastel)", strong: "var(--compat-grade-caution-strong)", border: "var(--compat-grade-caution-border)", badgeText: "var(--compat-grade-caution-badgeText)" },
};

// ── Score Arc ─────────────────────────────────────────────────────

function ScoreArc({ score, accentColor }: { score: number; accentColor: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ * 0.75;
  const gap = circ - dash;
  return (
    <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-[135deg]">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="7"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" />
        <circle cx="44" cy="44" r={r} fill="none"
          stroke={accentColor}
          strokeWidth="7"
          strokeDasharray={`${dash} ${gap + circ * 0.25}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold leading-none" style={{ color: accentColor }}>{score}</span>
        <span className="text-[13px] text-muted-foreground">점</span>
      </div>
    </div>
  );
}

// ── Korean grammar particle helper ───────────────────────────────
function ptcl(name: string, withConsonant: string, withVowel: string): string {
  if (!name) return withConsonant;
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return withConsonant;
  return (code - 0xAC00) % 28 === 0 ? withVowel : withConsonant;
}

// ── Dynamic flow display helpers ─────────────────────────────────

const TODAY_LEVEL_CLASS: Record<string, { ring: string; title: string }> = {
  good: { ring: "ring-1 ring-emerald-500/15", title: "text-emerald-700 dark:text-emerald-400" },
  neutral: { ring: "ring-1 ring-border/80", title: "text-foreground" },
  caution: { ring: "ring-1 ring-amber-500/20", title: "text-amber-800 dark:text-amber-300" },
};
const ALIGN_BADGE: Record<string, string> = {
  "둘 다 열림": "bg-emerald-100 text-emerald-800",
  "한쪽 열림": "bg-blue-100 text-blue-800",
  "교차 흐름": "bg-amber-100 text-amber-800",
  "둘 다 안정": "bg-gray-100 text-gray-700",
  "긴장 구간": "bg-red-100 text-red-700",
};
const OPEN_BADGE: Record<string, string> = {
  open: "border-border bg-muted/35 text-foreground",
  neutral: "border-border bg-muted/35 text-foreground",
  closed: "border-border bg-muted/35 text-foreground",
};

function TgChip({ tg, stem }: { tg: string | null; stem: string }) {
  if (!tg) return null;
  return (
    <span
      className={cn("ds-badge text-[11px] font-semibold shadow-none", getTenGodTw(tg, stem))}
      style={getTenGodChipStyle(tg, stem)}
    >
      {tg}
    </span>
  );
}

function FlowRow({ label, gz, tg }: {
  label: string;
  gz: { hangul: string; stem: string };
  tg: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-[12px] text-muted-foreground w-7 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[13px] font-bold">
          <span style={getBranchColor(gz.hangul[0])}>{gz.hangul[0]}</span>
          <span style={getBranchColor(gz.hangul[1])}>{gz.hangul[1]}</span>
        </span>
        <TgChip tg={tg} stem={gz.stem} />
      </div>
    </div>
  );
}

// ── Element color helpers ─────────────────────────────────────────

/** 지지/천간 한 글자를 받아 오행 텍스트 색상 인라인 스타일을 반환 */
function getBranchColor(ch: string): React.CSSProperties {
  const el = charToElement(ch);
  if (!el) return {};
  return { color: elementColorVar(el as FiveElKey, "strong") };
}

/** 오행 배경색(연한) + 보더 인라인 스타일 */
function getElCardStyle(el: string | null): React.CSSProperties {
  if (!el) return {};
  const bg = elementColorVar(el as FiveElKey, "muted");
  return {
    // lighten pastel by +10% white
    background: `color-mix(in oklab, ${bg} 90%, white 10%)`,
    borderColor: elementColorVar(el as FiveElKey, "base"),
  };
}

function getElCardStyleLite(el: string | null): React.CSSProperties {
  if (!el) return {};
  const bg = elementColorVar(el as FiveElKey, "muted");
  return {
    // spouse-palace compare: lighten an extra +10% (total +20% white)
    background: `color-mix(in oklab, ${bg} 80%, white 20%)`,
    borderColor: elementColorVar(el as FiveElKey, "base"),
  };
}

function getDayPillarCardStyle(dayHangul: string): React.CSSProperties {
  const stem = dayHangul?.[0] ?? "";
  const el = charToElement(stem);
  if (!el) return {};
  const bg = elementColorVar(el as FiveElKey, "muted");
  return {
    // lighten pastel by +10% white
    background: `color-mix(in oklab, ${bg} 90%, white 10%)`,
    borderColor: elementColorVar(el as FiveElKey, "base"),
  };
}

// ── Element Mirror — Mirrored Bar Chart ──────────────────────────

// Generating (a → b): a generates b
const GEN_PAIRS: [string, string][] = [["목","화"],["화","토"],["토","금"],["금","수"],["수","목"]];
// Controlling (a → b): a controls b
const CTL_PAIRS: [string, string][] = [["목","토"],["토","수"],["수","화"],["화","금"],["금","목"]];

const STEM_EL_MAP: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

function getCategoryLabel(el: string, masterEl: string): string {
  if (!masterEl) return el;
  if (el === masterEl)                                                      return "비겁";
  if (GEN_PAIRS.some(([a, b]) => a === el && b === masterEl))              return "인성";
  if (GEN_PAIRS.some(([a, b]) => a === masterEl && b === el))              return "식상";
  if (CTL_PAIRS.some(([a, b]) => a === masterEl && b === el))              return "재성";
  if (CTL_PAIRS.some(([a, b]) => a === el && b === masterEl))              return "관성";
  return el;
}

function ElementMirror({ name1, el1, dayStem1, name2, el2 }: {
  name1: string; el1: FiveElementCount; dayStem1?: string;
  name2: string; el2: FiveElementCount;
}) {
  const OHAENG = ["목", "화", "토", "금", "수"] as const;
  const masterEl = dayStem1 ? (STEM_EL_MAP[dayStem1] ?? "") : "";
  const t1 = Object.values(el1).reduce((a, b) => a + b, 0) || 1;
  const t2 = Object.values(el2).reduce((a, b) => a + b, 0) || 1;

  // Find max-diff element for emphasis
  const diffs = OHAENG.map(el => Math.abs(el1[el] - el2[el]));
  const maxDiff = Math.max(...diffs);

  return (
    <div className="space-y-1.5">
      {/* Names shown once at top */}
      <div className="flex items-center text-[12px] font-semibold mb-2">
        <div className="flex-1 flex justify-end pr-1 text-muted-foreground">{name1}</div>
        <div className="w-[68px] shrink-0" />
        <div className="flex-1 pl-1 text-muted-foreground">{name2}</div>
      </div>

      {OHAENG.map((el) => {
        const p1 = Math.round((el1[el] / t1) * 100);
        const p2 = Math.round((el2[el] / t2) * 100);
        const diff = Math.abs(el1[el] - el2[el]);
        const isEmphasis = diff > 0 && diff === maxDiff;
        const label = masterEl ? getCategoryLabel(el, masterEl) : el;
        const elColor = elementColorVar(el, "base");

        return (
          <div
            key={el}
            className={cn(
              "flex items-center gap-1 py-0.5 px-1 rounded-lg transition-colors",
              isEmphasis && "bg-muted/25 ring-1 ring-border/60",
            )}
          >
            {/* Left person — bars extend LEFT (right-aligned) */}
            <div className="flex-1 flex items-center justify-end gap-1.5">
              {p1 > 0 && <span className="text-[11px] text-muted-foreground/80 shrink-0">{p1}%</span>}
              <div className="w-16 h-2.5 bg-muted rounded-full overflow-hidden flex justify-end">
                <div className="h-full rounded-full" style={{ width: `${p1}%`, background: elColor, opacity: 0.85 }} />
              </div>
            </div>

            {/* Center: category label */}
            <div className="w-[68px] shrink-0 flex flex-col items-center gap-0.5">
              <span
                className="text-[12px] font-bold leading-none"
                style={{ color: isEmphasis ? elColor : "hsl(var(--muted-foreground))" }}
              >
                {label}
              </span>
              {isEmphasis && (
                <span className="text-[9px] font-semibold" style={{ color: elColor }}>차이</span>
              )}
            </div>

            {/* Right person — bars extend RIGHT (left-aligned) */}
            <div className="flex-1 flex items-center gap-1.5">
              <div className="w-16 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p2}%`, background: elColor, opacity: 0.85 }} />
              </div>
              {p2 > 0 && <span className="text-[11px] text-muted-foreground/80 shrink-0">{p2}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Accordion Section ─────────────────────────────────────────────

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
    <div className="scroll-mt-4 border-t border-border/40 pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left group min-w-0"
      >
        <span className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-foreground">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div className={cn("space-y-4 pb-2", !open && "hidden")}>{children}</div>
    </div>
  );
}

function CardAccordion({
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
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/35 transition-colors"
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Bullet list row ───────────────────────────────────────────────

function BulletRow({ text, positive }: { text: string; positive: boolean }) {
  return (
    <div
      className={cn(
        "ds-inline-detail-nested flex items-start gap-2 text-[13px] leading-relaxed text-foreground",
        positive ? "border-l-2 border-l-primary/35" : "border-l-2 border-l-muted-foreground/35",
      )}
    >
      {positive ? (
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span>{text}</span>
    </div>
  );
}

// GRADE_STYLES removed — use GRADE_PALETTE (defined above) for all color logic.

const REL_TONE_COLOR: Record<string, string> = {
  "매우 좋음": "text-green-700",
  "활력 있지만 긴장": "text-amber-700",
  "긴장과 자극": "text-orange-600",
  "균열 주의": "text-red-600",
  "방해 요소 존재": "text-red-600",
  "무난한 관계": "text-gray-600",
};

// ── People Tab Selector ───────────────────────────────────────────

type RelTab = "전체" | RelationshipType;

const REL_TABS: { key: RelTab; label: string; emoji: string }[] = [
  { key: "전체",      label: "전체",   emoji: "" },
  { key: "lover",     label: "연인",   emoji: RELATIONSHIP_TYPE_EMOJI["lover"] },
  { key: "spouse",    label: "배우자", emoji: RELATIONSHIP_TYPE_EMOJI["spouse"] },
  { key: "interest",  label: "이성",   emoji: RELATIONSHIP_TYPE_EMOJI["interest"] },
  { key: "friend",    label: "친구",   emoji: RELATIONSHIP_TYPE_EMOJI["friend"] },
  { key: "coworker",  label: "동료",   emoji: RELATIONSHIP_TYPE_EMOJI["coworker"] },
  { key: "family",    label: "가족",   emoji: RELATIONSHIP_TYPE_EMOJI["family"] },
  { key: "other",     label: "기타",   emoji: RELATIONSHIP_TYPE_EMOJI["other"] },
];

function PeopleTabSelector({
  people,
  selectedPerson,
  onSelect,
}: {
  people: PersonRecord[];
  selectedPerson: PersonRecord | null;
  onSelect: (p: PersonRecord) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className={cn(
            "inline-flex min-h-9 items-center text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors",
            selectedPerson?.id === p.id
              ? "border-primary bg-primary/[0.06] text-foreground"
              : "border-border bg-card text-foreground hover:border-muted-foreground/40",
          )}
        >
          {p.birthInput.name}
        </button>
      ))}
    </div>
  );
}

// ── Pair Person Selector ──────────────────────────────────────────

function PairSelector({
  label,
  people,
  selected,
  excluded,
  onSelect,
}: {
  label: string;
  people: PersonRecord[];
  selected: PersonRecord | null;
  excluded: PersonRecord | null;
  onSelect: (p: PersonRecord) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {people.filter((p) => p.id !== excluded?.id).map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={cn(
              "inline-flex min-h-9 items-center text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors",
              selected?.id === p.id
                ? "border-primary bg-primary/[0.06] text-foreground"
                : "border-border bg-card text-foreground hover:border-muted-foreground/40",
            )}
          >
            {p.birthInput.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LoveThermometer & HeartBattery ────────────────────────────────

function getThermometerGradient(score: number) {
  if (score < 40) return "from-sky-400 to-blue-500";
  if (score < 60) return "from-teal-400 to-emerald-500";
  if (score < 75) return "from-amber-400 to-orange-500";
  return "from-rose-400 to-red-500";
}

function RelationThermometer({ score, isPersonalLove }: { score: number; isPersonalLove: boolean }) {
  const temp = (36.5 + (score - 50) * 0.15).toFixed(1);
  const fillWidth = `${score}%`;

  const label = isPersonalLove ? "궁합 온도계 🌡️" : "관계 온도계 🌡️";
  const desc = isPersonalLove 
    ? "두 사람의 궁합 에너지가 따뜻하게 교감하는 활성 온도를 나타냅니다."
    : "두 사람의 에너지가 시너지를 내는 활성 온도를 나타냅니다.";
  
  const gradient = getThermometerGradient(score);
  const textColor = score >= 75 ? "text-rose-500" : score >= 60 ? "text-orange-500" : score >= 40 ? "text-emerald-500" : "text-blue-500";

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-none transition-all hover:border-primary/20">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        <span className={`text-[13px] font-extrabold tracking-tight ${textColor}`}>{temp}°C</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000 ease-out`}
          style={{ width: fillWidth }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground leading-normal">{desc}</p>
    </div>
  );
}

function RelationBattery({ score, isPersonalLove, isFamily }: { score: number; isPersonalLove: boolean; isFamily: boolean }) {
  const fillHeight = `${100 - score}%`;
  
  let label = "충전 게이지 🔋";
  let desc = "긍정적인 에너지가 충전된 상태를 나타냅니다.";
  let svgPaths = (
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  );
  let colors = { start: "#EC4899", end: "#F43F5E", text: "text-pink-600" };

  if (isPersonalLove) {
    label = "하트 충전 게이지 🔋";
    desc = "서로를 향한 애정 기운과 긍정 지수가 충전된 상태를 나타냅니다.";
  } else if (isFamily) {
    label = "유대감 충전 게이지 🔋";
    desc = "가족으로서의 유대감과 편안함이 충전된 상태를 나타냅니다.";
    svgPaths = <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />;
    colors = { start: "#F59E0B", end: "#D97706", text: "text-amber-600" };
  } else {
    label = "시너지 충전 게이지 🔋";
    desc = "서로의 강점을 이끌어내는 시너지 에너지가 충전된 상태를 나타냅니다.";
    svgPaths = <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.16-.28L11.5 2h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />;
    colors = { start: "#8B5CF6", end: "#6D28D9", text: "text-violet-600" };
  }

  const gradId = `grad-${colors.start.replace('#', '')}`;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-none transition-all hover:border-primary/20">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        <span className={`text-[13px] font-extrabold tracking-tight ${colors.text}`}>{score}%</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative h-9 w-9 shrink-0">
          <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full fill-muted stroke-border stroke-[1.5]">
            {svgPaths}
          </svg>
          <div
            className="absolute inset-0 overflow-hidden transition-all duration-1000 ease-out"
            style={{ clipPath: `inset(${fillHeight} 0 0 0)` }}
          >
            <svg viewBox="0 0 24 24" className="h-full w-full">
              <defs>
                <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor={colors.start} />
                  <stop offset="100%" stopColor={colors.end} />
                </linearGradient>
              </defs>
              <g fill={`url(#${gradId})`}>
                {svgPaths}
              </g>
            </svg>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {desc}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function Compatibility() {
  const { personId } = useParams<{ personId: string }>();
  const myProfileRaw = getMyProfile();
  const people = getPeople();
  const targetPerson = people.find((p) => p.id === personId);

  // Read URL query params for pair mode (from PeopleList "궁합 분석하기")
  const urlParams = new URLSearchParams(window.location.search);
  const urlA = urlParams.get("a");
  const urlB = urlParams.get("b");
  const urlPairA = urlA ? (people.find((p) => p.id === urlA) ?? null) : null;
  const urlPairB = urlB ? (people.find((p) => p.id === urlB) ?? null) : null;
  const initialMode: "me_other" | "pair" = urlPairA && urlPairB ? "pair" : "me_other";

  const [mode, setMode] = useState<"me_other" | "pair">(initialMode);
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(targetPerson ?? null);
  const [pairPersonA, setPairPersonA] = useState<PersonRecord | null>(urlPairA);
  const [pairPersonB, setPairPersonB] = useState<PersonRecord | null>(urlPairB);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [hourModeA, setHourModeA] = useState<"포함" | "제외">("포함");
  const [hourModeB, setHourModeB] = useState<"포함" | "제외">("포함");
  const [activeRelation, setActiveRelation] = useState<{
    scope: "stem" | "dayBranch" | "crossBranch";
    type: RelationType;
    title: string;
  } | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);

  // ── 시주 제외 모드 지원: manualPillars.hour = null 로 시주 무력화 ──
  function withHourRemoved(record: PersonRecord): PersonRecord {
    return {
      ...record,
      manualPillars: { ...(record.manualPillars ?? {}), hour: null },
    };
  }

  const swapPair = useCallback(() => {
    setPairPersonA(pairPersonB);
    setPairPersonB(pairPersonA);
    setHourModeA(hourModeB);
    setHourModeB(hourModeA);
  }, [pairPersonA, pairPersonB, hourModeA, hourModeB]);

  if (!myProfileRaw) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center space-y-3 flex flex-col items-center">
            <Mascot expression="guiding" size={90} />
            <div>
              <p className="font-medium text-foreground">내 사주를 먼저 등록해주세요</p>
              <p className="text-sm text-muted-foreground mt-1">궁합 계산을 위해 내 프로필이 필요합니다</p>
            </div>
            <Link href="/"><Button>내 사주 등록하러 가기</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myProfile = myProfileRaw;

  // ── Active pair depends on mode ───────────────────────────────
  const p1: PersonRecord | null = mode === "me_other" ? myProfile : pairPersonA;
  const p2: PersonRecord | null = mode === "me_other" ? selectedPerson : pairPersonB;

  // ── 시주 모드에 따라 effective 레코드 생성 (궁합 계산에 사용) ──
  const ep1 = p1 && hourModeA === "제외" ? withHourRemoved(p1) : p1;
  const ep2 = p2 && hourModeB === "제외" ? withHourRemoved(p2) : p2;

  const relType: RelationshipType | undefined =
    (p2 as (PersonRecord & { relationshipType?: RelationshipType }) | null)?.relationshipType;

  // 썸/이성(interest)도 연애 전제 관계라 연인·배우자와 동일하게 연애/결혼 적합도 등
  // isPersonalLove 계열 UI를 노출한다.
  const isPersonalLove = relType === "lover" || relType === "spouse" || relType === "interest";

  const fullReport: AnyCompatibilityReport | null = (ep1 && ep2)
    ? getCompatibilityReport(ep1, ep2, relType)
    : null;
  const result: CompatibilityResult | null = fullReport?.scoreResult ?? null;

  // ── 시주 포함 기준 점수 (비교용) ──────────────────────────────
  const hasHourExcluded = hourModeA === "제외" || hourModeB === "제외";
  const fullReportBase = hasHourExcluded && p1 && p2
    ? getCompatibilityReport(p1, p2, relType)
    : null;
  const resultBase: CompatibilityResult | null = fullReportBase?.scoreResult ?? null;
  // Derive all colors from result.finalType — single source of truth (legacy Phase 2
  // 관계형 종합 점수 전용. Phase 3 3축 히어로 카드는 아래 cardPolicy/heroPalette를 쓴다.)
  const palette = result ? (GRADE_PALETTE[result.finalType] ?? GRADE_PALETTE["노력형 궁합"]) : null;
  const myName = p1?.birthInput.name ?? "";
  const otherName = p2?.birthInput.name ?? "";
  const myGender = p1?.birthInput.gender ?? "";
  const otherGender = p2?.birthInput.gender ?? "";

  // [Phase 3 P0] 화면/클립보드 export가 공유하는 단일 source of truth. lover/spouse/
  // interest만 연애·결혼 궁합을 노출하고, 그 외(family/friend/coworker/other/undefined)는
  // 인간관계 궁합만 노출한다 — 예전에 "성별이 다르면 family/coworker에도 연애·결혼
  // 카드를 보여준다"던 genderDiffers 확장 정책은 이번 전환에서 명시적으로 폐기했다.
  const cardPolicy = getCompatibilityCardPolicy(relType);

  function adaptTextForRelType(text: string): string {
    if (!text) return text;
    // For non-romantic relations, remove romantic framing where possible.
    if (relType !== "family" && relType !== "friend" && relType !== "coworker") return text;
    return text
      .replaceAll("연인", "상대")
      .replaceAll("사랑", "관계")
      .replaceAll("애정", "정서")
      .replaceAll("설렘", "활력")
      .replaceAll("데이트", "만남")
      .replaceAll("스킨십", "표현")
      .replaceAll("두 사람만의 시간", "함께하는 시간")
      .replaceAll("가정을", "관계를")
      .replaceAll("결혼", "관계");
  }

  // ── 배우자궁·관성 레이어 데이터 ──
  // 시주 포함/제외 토글에 맞춰 표시/해석도 함께 변하도록 effective record 기준 사용
  const myPillarsFull = ep1 ? getFinalPillars(ep1) : null;
  const myDayBranch2 = myPillarsFull?.day?.hangul?.[1] ?? "";
  const myDayStem2   = myPillarsFull?.day?.hangul?.[0] ?? "";
  const mySpousePalace = myDayBranch2 ? getSpousePalaceInfo(myDayBranch2) : null;
  // manualPillars 반영을 위해 raw computedPillars가 아니라 위에서 이미 병합한 myPillarsFull을 사용한다.
  const myLC = ep1 && myPillarsFull ? calculateLuckCycles(ep1.birthInput, myPillarsFull) : null;
  const myMarriageTiming = (ep1 && myDayStem2 && myLC && myLC.daewoon.length > 0)
    ? getMarriageTimingHint(ep1.birthInput.gender as "남" | "여", myDayStem2, myLC.daewoon)
    : null;

  const otherPillarsFull = ep2 ? getFinalPillars(ep2) : null;
  const otherDayBranch2 = otherPillarsFull?.day?.hangul?.[1] ?? "";
  const otherDayStem2   = otherPillarsFull?.day?.hangul?.[0] ?? "";
  const otherSpousePalace = otherDayBranch2 ? getSpousePalaceInfo(otherDayBranch2) : null;
  // manualPillars 반영을 위해 raw computedPillars가 아니라 위에서 이미 병합한 otherPillarsFull을 사용한다.
  const otherLC = ep2 && otherPillarsFull
    ? calculateLuckCycles(ep2.birthInput, otherPillarsFull)
    : null;
  const otherMarriageTiming = (ep2 && otherDayStem2 && otherLC && otherLC.daewoon.length > 0)
    ? getMarriageTimingHint(ep2.birthInput.gender as "남" | "여", otherDayStem2, otherLC.daewoon)
    : null;

  // ── 동적 궁합 — 현재 운 흐름 ──────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const flowA = useMemo(
    () => (ep1 ? computePersonCurrentFlow(ep1, now) : null),
    [ep1, now],
  );
  const flowB = useMemo(
    () => (ep2 ? computePersonCurrentFlow(ep2, now) : null),
    [ep2, now],
  );
  const combinedFlow = useMemo(
    () =>
      flowA && flowB && result
        ? computeCombinedTimingFlow(flowA, flowB, result.score, (p2 as any)?.relationshipType)
        : null,
    [flowA, flowB, result],
  );

  // ── 💕 커플 관계 상호작용도(연도별) ──────────────────────────────
  // 개인별 배우자 활성도/안정도(computePersonPipelineSnapshot의 spouseActivation)와는
  // 별개로, 두 사람 사이의 관계 자체가 그 해에 얼마나 활성화·조화·충돌하는지 계산한다.
  const myPipelineForInteraction = useMemo(
    () => (ep1 ? computePersonPipelineSnapshot(ep1) : null),
    [ep1],
  );
  const otherPipelineForInteraction = useMemo(
    () => (ep2 ? computePersonPipelineSnapshot(ep2) : null),
    [ep2],
  );
  const relationshipInteractionByYear = useMemo(() => {
    if (
      !ep1 || !ep2 || !myLC || !otherLC ||
      !myPipelineForInteraction?.evaluations || !otherPipelineForInteraction?.evaluations ||
      !myDayStem2 || !otherDayStem2
    ) {
      return [];
    }
    const aYongshin = myPipelineForInteraction.adjusted.effectiveYongshin;
    const bYongshin = otherPipelineForInteraction.adjusted.effectiveYongshin;
    const aCtx: PersonInteractionContext = {
      name: ep1.birthInput.name,
      dayStem: myDayStem2,
      dayBranch: myDayBranch2,
      yongshin: aYongshin,
      heesin: myPipelineForInteraction.adjusted.effectiveYongshinSecondary,
      gisin: getController(aYongshin),
      birthYear: ep1.birthInput.year,
      daewoon: myLC.daewoon,
    };
    const bCtx: PersonInteractionContext = {
      name: ep2.birthInput.name,
      dayStem: otherDayStem2,
      dayBranch: otherDayBranch2,
      yongshin: bYongshin,
      heesin: otherPipelineForInteraction.adjusted.effectiveYongshinSecondary,
      gisin: getController(bYongshin),
      birthYear: ep2.birthInput.year,
      daewoon: otherLC.daewoon,
    };
    return computeRelationshipInteractionByYearRange({
      a: aCtx,
      b: bCtx,
      aSpouseCtx: {
        dayStem: myDayStem2,
        dayBranch: myDayBranch2,
        allStems: myPipelineForInteraction.input.allStems,
        gender: ep1.birthInput.gender as "남" | "여",
        evaluations: myPipelineForInteraction.evaluations,
        yongshin: aYongshin,
        heesin: myPipelineForInteraction.adjusted.effectiveYongshinSecondary,
        gisin: getController(aYongshin),
        birthYear: ep1.birthInput.year,
        daewoon: myLC.daewoon,
        seunEntries: myLC.seun,
      },
      bSpouseCtx: {
        dayStem: otherDayStem2,
        dayBranch: otherDayBranch2,
        allStems: otherPipelineForInteraction.input.allStems,
        gender: ep2.birthInput.gender as "남" | "여",
        evaluations: otherPipelineForInteraction.evaluations,
        yongshin: bYongshin,
        heesin: otherPipelineForInteraction.adjusted.effectiveYongshinSecondary,
        gisin: getController(bYongshin),
        birthYear: ep2.birthInput.year,
        daewoon: otherLC.daewoon,
        seunEntries: otherLC.seun,
      },
      fromYear: myLC.wolun.year,
      count: 10,
      baseCompatibilityDampening: dampeningFromCompatibilityTone(result?.finalType),
    });
  }, [ep1, ep2, myLC, otherLC, myPipelineForInteraction, otherPipelineForInteraction, myDayStem2, otherDayStem2, myDayBranch2, otherDayBranch2, result?.finalType]);

  const canUsePairMode = people.length >= 2;

  return (
    <div className="ds-app-shell ds-page-pad py-6 ds-section-gap">
      <div>
        <h1 className="ds-title">궁합</h1>
        {mode === "me_other" ? (
          <p className="ds-subtitle mt-1">
            {myProfile.birthInput.name}님과 상대의 사주를 비교해, 관계에 스며드는 기질의 흐름을 읽어 드립니다.
          </p>
        ) : pairPersonA && pairPersonB ? (
          <p className="ds-subtitle mt-1">
            {pairPersonA.birthInput.name}님과 {pairPersonB.birthInput.name}님 두 분의 사주를 같은 방식으로 정리했습니다.
          </p>
        ) : (
          <p className="ds-subtitle mt-1">아래에서 두 분을 선택하면 궁합 리포트가 이어집니다.</p>
        )}
      </div>
      {/* ── 모드 탭: 사주 포함/제외 세그먼트와 동일 스타일 ── */}
      {canUsePairMode && (
        <div className="flex items-center gap-2 w-full">
          <div className="ds-segment-list min-h-10 flex-1 rounded-xl border border-border shadow-none">
            {([
              { key: "me_other" as const, label: "나 ↔ 상대" },
              { key: "pair" as const, label: "상대끼리" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "ds-segment-item flex-1 text-[12px] font-bold shadow-none",
                  mode === key ? "ds-segment-item-active" : "ds-segment-item-inactive",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsListExpanded((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/60 transition-all active:scale-95 shadow-none"
            aria-label={isListExpanded ? "인물 목록 접기" : "인물 목록 펼치기"}
          >
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                isListExpanded && "rotate-180"
              )}
            />
          </button>
        </div>
      )}
      {people.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Mascot expression="guiding" size={90} />
            <div>
              <p className="font-medium text-foreground">아직 상대가 없어요</p>
              <p className="text-muted-foreground text-sm mt-1">
                상대를 등록하면 궁합 분석을 볼 수 있어요
              </p>
            </div>
            <Link href="/people/add">
              <Button variant="outline" className="mt-1">상대 추가하기</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── 상대 선택 ── */}
          {(!canUsePairMode || isListExpanded) && (
            <div className="space-y-3">
              {mode === "me_other" ? (
                <PeopleTabSelector
                  people={people}
                  selectedPerson={selectedPerson}
                  onSelect={setSelectedPerson}
                />
              ) : (
                <div className="ds-card ds-card-pad space-y-3 shadow-none">
                  <div className="flex items-start gap-2">
                    <PairSelector
                      label="A"
                      people={people}
                      selected={pairPersonA}
                      excluded={pairPersonB}
                      onSelect={setPairPersonA}
                    />
                    <button
                      onClick={swapPair}
                      disabled={!pairPersonA || !pairPersonB}
                      className="mt-6 p-2 rounded-full border border-border bg-background hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
                      title="A ↔ B 바꾸기"
                    >
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <PairSelector
                      label="B"
                      people={people}
                      selected={pairPersonB}
                      excluded={pairPersonA}
                      onSelect={setPairPersonB}
                    />
                  </div>
                  {(!pairPersonA || !pairPersonB) && (
                    <p className="text-[12px] text-muted-foreground text-center">A와 B를 각각 선택하면 궁합이 계산됩니다</p>
                  )}
                </div>
              )}
            </div>
          )}

          {result && p1 && p2 && palette && fullReport && (() => {
            const myPillarsForZodiac = ep1 ? getFinalPillars(ep1) : null;
            const myZodiac = getZodiacFromDayPillar(myPillarsForZodiac?.day?.hangul ?? "");
            const otherZodiac = getZodiacFromDayPillar(otherPillarsFull?.day?.hangul ?? "");
            return (
            <div className="ds-section-gap">

              {/* ── 1. 궁합 히어로 카드 (파격 개편) ── */}
              {(() => {
                const isLoveType = relType === "lover" || relType === "spouse" || relType === "interest";
                const isFamilyType = relType === "family";
                // [Phase 3 P0] romantic relType(cardPolicy.showRomance)에서는 totalScore 단일
                // 히어로 대신 아래 3축 동일 위계 블록을 렌더링하므로 여기서는 score를 null로
                // 둔다. 비-romantic에서는 Human Compatibility를 대표 점수로 쓴다(totalScore를
                // Human으로 이름만 바꾸는 게 아니라 실제 humanCompatibility.final을 사용).
                const score = cardPolicy.showRomance ? null : result.humanCompatibility.final;
                const heroTone = cardPolicy.showRomance ? null : result.humanCompatibility.tone;
                const heroPalette = heroTone ? (GRADE_PALETTE[heroTone] ?? GRADE_PALETTE["노력형 궁합"]) : null;

                // 별점/분위기 라벨은 Human 단독 대표 모드(비연애 관계유형)에서만 사용한다.
                const starCount = score === null ? 0 : score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1;
                const stars = Array.from({ length: 5 }, (_, i) => i < starCount ? "★" : "☆");

                // 관계 분위기 라벨(비연애 관계유형에서만 사용 — isLoveType 분기는 이 경로에서
                // 도달하지 않지만 기존 문구를 그대로 보존해 둔다)
                const moodLabel = score === null ? "" : score >= 85
                  ? isLoveType ? "💞 천생연분에 가까운 인연" : "⚡ 완벽한 시너지 파트너"
                  : score >= 70
                  ? isLoveType ? "🌸 설렘과 안정이 공존하는 관계" : "🌿 서로 잘 맞는 좋은 파트너"
                  : score >= 55
                  ? isLoveType ? "🌊 끌리지만 조율이 필요한 관계" : "🌀 보완하며 성장하는 관계"
                  : score >= 40
                  ? isLoveType ? "🔥 긴장과 자극이 공존하는 관계" : "⚙️ 다름을 인정하며 조율하는 관계"
                  : isLoveType ? "⚡ 차이가 크지만 성장할 수 있는 관계" : "🧩 서로 다른 에너지의 관계";

                // 관계 유형별 헤더 아이콘/색상
                const typeEmoji = isLoveType ? (relType === "interest" ? "💫" : "💕") : isFamilyType ? "🏠" : "🤝";
                const bgClass = isLoveType
                  ? "from-pink-50/80 via-rose-50/40 to-white"
                  : isFamilyType
                  ? "from-amber-50/80 via-yellow-50/40 to-white"
                  : "from-violet-50/80 via-indigo-50/40 to-white";
                const accentClass = isLoveType ? "text-rose-500" : isFamilyType ? "text-amber-600" : "text-violet-600";
                const borderClass = isLoveType ? "border-rose-100/80" : isFamilyType ? "border-amber-100/80" : "border-violet-100/80";

                const myPillarsForZodiac = ep1 ? getFinalPillars(ep1) : null;
                const myZodiac = getZodiacFromDayPillar(myPillarsForZodiac?.day?.hangul ?? "");
                const otherZodiac = getZodiacFromDayPillar(otherPillarsFull?.day?.hangul ?? "");

                return (
                  <div className={`ds-card border shadow-sm overflow-hidden ${borderClass}`} style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}>
                    <div className={`bg-gradient-to-br ${bgClass}`}>
                      <div className="ds-card-pad space-y-4">

                        {/* 헤더: 관계 유형 + 두 사람 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">궁합 분석</span>
                            <h2 className="ds-title mt-0.5 flex items-center gap-1.5">
                              <span>{typeEmoji}</span>
                              <span>{myName} × {otherName}</span>
                            </h2>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowInfoSheet(true)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-bold text-muted-foreground hover:bg-muted/60"
                            aria-label="점수 계산 기준 보기"
                          >
                            i
                          </button>
                        </div>

                        {/* 두 사람 카드 */}
                        <div className="flex items-center gap-2">
                          <MiniPersonCard
                            title="나"
                            name={myName}
                            gender={myGender}
                            dayHangul={myPillarsForZodiac?.day?.hangul ?? ""}
                            zodiac={myZodiac}
                            hourMode={hourModeA}
                            onHourModeChange={setHourModeA}
                          />
                          <div className="shrink-0 px-1 text-center">
                            <span className={`text-2xl leading-none ${accentClass}`}>
                              {isLoveType ? "♡" : isFamilyType ? "⭐" : "⇄"}
                            </span>
                          </div>
                          <MiniPersonCard
                            title="상대"
                            name={otherName}
                            gender={otherGender}
                            dayHangul={otherPillarsFull?.day?.hangul ?? ""}
                            zodiac={otherZodiac}
                            hourMode={hourModeB}
                            onHourModeChange={setHourModeB}
                          />
                        </div>

                        {cardPolicy.showRomance ? (
                          /* [Phase 3 P0] romantic relType — 🤝/💕/💍 3축을 동일 위계로 표시.
                             새 종합/평균 점수는 만들지 않는다(C안). */
                          <div className="rounded-2xl border border-border/40 bg-white/70 backdrop-blur-sm px-4 py-4 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">목적별 궁합 점수</p>
                            <div className="grid grid-cols-3 gap-2">
                              {([
                                { emoji: "🤝", label: "인간관계 궁합", final: result.humanCompatibility.final, tone: result.humanCompatibility.tone },
                                { emoji: "💕", label: "연애 궁합", final: result.romanceCompatibility.final, tone: result.romanceCompatibility.tone },
                                { emoji: "💍", label: "결혼 궁합", final: result.marriageCompatibility.final, tone: result.marriageCompatibility.tone },
                              ] as const).map((axis) => {
                                const axisPalette = GRADE_PALETTE[axis.tone] ?? GRADE_PALETTE["노력형 궁합"];
                                return (
                                  <div key={axis.label} className="rounded-xl border border-border/60 bg-background/80 p-3 text-center">
                                    <p className="text-[11px] text-muted-foreground">{axis.emoji} {axis.label}</p>
                                    <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: axisPalette.badgeText }}>{axis.final}</p>
                                    <span
                                      className="mt-1 inline-block ds-badge border px-2 py-0.5 text-[10px] font-bold shadow-none"
                                      style={{ background: axisPalette.pastel, borderColor: axisPalette.border, color: axisPalette.badgeText }}
                                    >
                                      {axis.tone}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                              세 점수는 서로 다른 산식(핵심축 가중치·보조 신호 구성이 다름)입니다 — 사람 대 사람 상성, 연애 상성, 결혼 상성을 각각 나타내며 평균이나 합산으로 만든 값이 아닙니다.
                            </p>
                          </div>
                        ) : (
                          /* 비연애 관계유형 — Human Compatibility를 대표 점수로 사용(totalScore를
                             이름만 바꾼 것이 아니라 실제 humanCompatibility.final). */
                          <div className="rounded-2xl border border-border/40 bg-white/70 backdrop-blur-sm px-4 py-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">인간관계 궁합</p>
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-4xl font-extrabold tracking-tight ${accentClass}`}>{score}</span>
                                  <span className="text-base text-muted-foreground font-semibold">/100</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  {stars.map((s, i) => (
                                    <span key={i} className={`text-xl ${s === "★" ? accentClass : "text-muted-foreground/30"}`}>{s}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="shrink-0">
                                <ScoreArc score={score ?? 0} accentColor={heroPalette!.strong} />
                              </div>
                            </div>

                            {/* 분위기 라벨 */}
                            <div className={`rounded-xl px-3 py-2.5 border ${
                              (score ?? 0) >= 70 ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-800"
                              : (score ?? 0) >= 50 ? "bg-amber-50/80 border-amber-200/60 text-amber-800"
                              : "bg-orange-50/80 border-orange-200/60 text-orange-800"
                            }`}>
                              <p className="text-[13px] font-bold">{moodLabel}</p>
                            </div>

                            {/* 관계 타입 배지 */}
                            <div>
                              <span
                                className="ds-badge border px-3 py-1.5 text-[13px] font-bold shadow-none"
                                style={{ background: heroPalette!.pastel, borderColor: heroPalette!.border, color: heroPalette!.badgeText }}
                              >
                                {heroTone}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 온도계 및 게이지 — 인간관계 궁합 단독 대표 모드에서만(3축 동시 표시와 의미 충돌 방지) */}
                        {!cardPolicy.showRomance && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <RelationThermometer score={score!} isPersonalLove={false} />
                            <RelationBattery score={score!} isPersonalLove={false} isFamily={relType === "family"} />
                          </div>
                        )}

                        {/* Give & Take 에너지 흐름 카드 */}
                        {fullReport.elementComp && (() => {
                          const { p1Lacks, p2Lacks, p1Comps, p2Comps } = fullReport.elementComp;
                          const hasGive = p1Comps.length > 0 || p2Comps.length > 0;
                          if (!hasGive) return null;
                          return (
                            <div className="rounded-2xl border border-border/40 bg-white/60 px-4 py-3 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">⚡ Give & Take 에너지 흐름</p>
                              <div className="space-y-2">
                                {p1Comps.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-foreground shrink-0">{myName}</span>
                                    <span className="text-muted-foreground text-[11px]">→→</span>
                                    <span className="text-[12px] text-muted-foreground flex-1">
                                      <span className="font-semibold text-foreground">{p1Comps.join(" · ")} 기운</span>이 {otherName}님을 채워줘요
                                    </span>
                                    <span className="text-emerald-600 text-[13px]">✅</span>
                                  </div>
                                )}
                                {p2Comps.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-foreground shrink-0">{otherName}</span>
                                    <span className="text-muted-foreground text-[11px]">→→</span>
                                    <span className="text-[12px] text-muted-foreground flex-1">
                                      <span className="font-semibold text-foreground">{p2Comps.join(" · ")} 기운</span>이 {myName}님을 채워줘요
                                    </span>
                                    <span className="text-emerald-600 text-[13px]">✅</span>
                                  </div>
                                )}
                              </div>
                              {fullReport.elementComp.desc && (
                                <p className="text-[12px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2 mt-1">{fullReport.elementComp.desc}</p>
                              )}
                            </div>
                          );
                        })()}

                        {/* AI 프롬프트 복사 버튼 */}
                        <div className="border-t border-border/40 pt-4">
                          <CopyButton
                            buildText={() => buildCompatibilityClipboardText(p1!, p2!, result, hourModeA, hourModeB)}
                            label="AI 해석 프롬프트 복사"
                          />
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* [Phase 3 P0] legacy "연애 적합도 · 결혼 적합도"(romanceMarriageFit) 카드는
                  제거했다 — 위 히어로 카드의 💕/💍 3축과 이름이 겹쳐 "같은 이름, 다른 산식"
                  중복 노출을 만들었기 때문(감사 [3] 참고). romanceMarriageFit 필드 자체는
                  backward compatibility로 CompatibilityResult에 남아 있으나 이 화면에서는
                  더 이상 소비하지 않는다. */}

              {/* 요약 타일 (일간 관계 / 배우자궁 혹은 월지) — 궁합 한눈에보기 카드 아래로 이동 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="ds-inline-detail-nested p-4 text-center">
                  <p className="text-[12px] font-semibold text-muted-foreground">일간 관계</p>
                  <p className="mt-2 text-[15px] font-extrabold leading-snug text-foreground">
                    {fullReport.stemRel.label}
                  </p>
                </div>
                {isPersonalLove ? (
                  <div className="ds-inline-detail-nested p-4 text-center">
                    <p className="text-[12px] font-semibold text-muted-foreground">배우자궁</p>
                    <p className="mt-2 text-[15px] font-extrabold leading-snug text-foreground">
                      <span style={getBranchColor((fullReport as any).branchComp?.myBranch)}>{(fullReport as any).branchComp?.myBranch}</span>{" "}
                      ↔{" "}
                      <span style={getBranchColor((fullReport as any).branchComp?.otherBranch)}>{(fullReport as any).branchComp?.otherBranch}</span>
                    </p>
                  </div>
                ) : (
                  <div className="ds-inline-detail-nested p-4 text-center">
                    <p className="text-[12px] font-semibold text-muted-foreground">월지(사회성/가치관) 관계</p>
                    <p className="mt-2 text-[15px] font-extrabold leading-snug text-foreground">
                      <span style={getBranchColor(myPillarsFull?.month?.hangul?.[1] ?? "")}>{myPillarsFull?.month?.hangul?.[1] ?? ""}</span>{" "}
                      ↔{" "}
                      <span style={getBranchColor(otherPillarsFull?.month?.hangul?.[1] ?? "")}>{otherPillarsFull?.month?.hangul?.[1] ?? ""}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* ── 2. 관계 구조 분석: 섹션 pastel → 카드/네스티드 white ── */}
                <div className="ds-card overflow-hidden shadow-none">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h2 className="text-sm font-bold text-foreground">관계 구조 분석</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      천간·지지의 연결 고리, 오행 균형, 십성 시선(나→상대/상대→나)을 한 흐름으로 정리했습니다.
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">천간 관계</p>
                    <div className="ds-inline-detail-nested space-y-2">
                      <p className="ds-body">{fullReport.stemHarmony.overallDesc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {fullReport.stemHarmony.combines.map((c, i) => (
                          <RelationChip
                            key={`c-${i}`}
                            type="천간합"
                            label={`합 ${c}`}
                            selected={activeRelation?.scope === "stem" && activeRelation.type === "천간합" && activeRelation.title === `합 ${c}`}
                            onClick={() => setActiveRelation({ scope: "stem", type: "천간합", title: `합 ${c}` })}
                          />
                        ))}
                        {fullReport.stemHarmony.clashes.map((c, i) => (
                          <RelationChip
                            key={`x-${i}`}
                            type="천간충"
                            label={`충 ${c}`}
                            selected={activeRelation?.scope === "stem" && activeRelation.type === "천간충" && activeRelation.title === `충 ${c}`}
                            onClick={() => setActiveRelation({ scope: "stem", type: "천간충", title: `충 ${c}` })}
                          />
                        ))}
                        {fullReport.stemHarmony.combines.length === 0 &&
                          fullReport.stemHarmony.clashes.length === 0 && (
                            <span className="ds-caption">눈에 띄는 천간 합·충 패턴은 없어요. 아래 지지·오행을 이어서 보면 됩니다.</span>
                          )}
                      </div>
                    </div>
                  </div>
                  {activeRelation?.scope === "stem" && (
                    <div className="-mt-1">
                      <RelationInlineDetail
                        type={activeRelation.type}
                        title={activeRelation.title}
                        onClose={() => setActiveRelation(null)}
                      />
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">지지 관계</p>
                    <div className="ds-inline-detail-nested space-y-2">
                      <p className="ds-body">{fullReport.crossBranch.overallDesc}</p>
                      {(fullReport as any).branchComp?.relations.length > 0 && (
                      <div className="space-y-2">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">일지 관계 태그</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(fullReport as any).branchComp?.relations
                              .map((raw: string) => ({ raw, type: normalizeRelationType(raw) }))
                              .filter((x: any): x is { raw: string; type: RelationType } => !!x.type)
                              .map(({ raw, type }: { raw: string; type: RelationType }, i: number) => (
                                <RelationChip
                                  key={`${raw}-${i}`}
                                  type={type}
                                  label={raw}
                                  selected={activeRelation?.scope === "dayBranch" && activeRelation.title === raw}
                                  onClick={() => setActiveRelation({ scope: "dayBranch", type, title: raw })}
                                />
                              ))}
                          </div>
                          {activeRelation?.scope === "dayBranch" && (
                            <div className="pt-2">
                              <RelationInlineDetail
                                type={activeRelation.type}
                                title={`일지 관계: ${activeRelation.title}`}
                                onClose={() => setActiveRelation(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {fullReport.crossBranch.positive.map((item, i) => (
                          <Fragment key={`p-${i}`}>
                            <button
                              type="button"
                              onClick={() => setActiveRelation({ scope: "crossBranch", type: item.type as RelationType, title: item.label })}
                              className={cn(
                                "w-full text-left flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition-colors",
                                activeRelation?.scope === "crossBranch" && activeRelation.title === item.label
                                  ? "border-emerald-300 bg-emerald-100/50 text-foreground"
                                  : "border-emerald-100 bg-emerald-50/70 text-foreground hover:bg-emerald-100/50"
                              )}
                            >
                              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{item.desc}</span>
                            </button>
                            {activeRelation?.scope === "crossBranch" && activeRelation.title === item.label && (
                              <div className="pt-2 pb-2">
                                <RelationInlineDetail
                                  type={activeRelation.type as RelationType}
                                  title={activeRelation.title}
                                  onClose={() => setActiveRelation(null)}
                                />
                              </div>
                            )}
                          </Fragment>
                        ))}
                        {fullReport.crossBranch.negative.map((item, i) => (
                          <Fragment key={`n-${i}`}>
                            <button
                              type="button"
                              onClick={() => setActiveRelation({ scope: "crossBranch", type: item.type as RelationType, title: item.label })}
                              className={cn(
                                "w-full text-left flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition-colors",
                                activeRelation?.scope === "crossBranch" && activeRelation.title === item.label
                                  ? "border-amber-300 bg-amber-100/50 text-foreground"
                                  : "border-amber-100 bg-amber-50/60 text-foreground hover:bg-amber-100/50"
                              )}
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                              <span>{item.desc}</span>
                            </button>
                            {activeRelation?.scope === "crossBranch" && activeRelation.title === item.label && (
                              <div className="pt-2 pb-2">
                                <RelationInlineDetail
                                  type={activeRelation.type as RelationType}
                                  title={activeRelation.title}
                                  onClose={() => setActiveRelation(null)}
                                />
                              </div>
                            )}
                          </Fragment>
                        ))}
                        {fullReport.crossBranch.positive.length === 0 &&
                          fullReport.crossBranch.negative.length === 0 && (
                            <p className="ds-caption">두 차트 사이에 특별히 강조할 지지 조합은 없습니다.</p>
                          )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Give & Take (오행 보완)</p>
                    <div className="ds-inline-detail-nested space-y-3 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-background border border-indigo-100 dark:border-indigo-900/50">
                      <p className="text-[13px] font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed mb-1">
                        {fullReport.elementComp.desc}
                      </p>
                      <ElementMirror
                        name1={myName}
                        el1={result.elementBalance.person1}
                        dayStem1={myDayStem2}
                        name2={otherName}
                        el2={result.elementBalance.person2}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">십성 궁합</p>
                    <div className="ds-inline-detail-nested space-y-2">
                      <p className="ds-body">
                        {result.adjustmentSteps.find((s) => s.category === "십성 궁합")?.note ??
                          "십성 관계에 대한 추가 설명을 불러오지 못했습니다."}
                      </p>
                      <div className="space-y-2">
                        <div className="ds-inline-detail-nested space-y-1.5">
                          <p className="text-[12px] font-semibold text-foreground">
                            {myName} → {otherName}
                          </p>
                          {fullReport.stemRel.me2other ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn("ds-badge text-[12px] font-bold shadow-none", getTenGodTw(fullReport.stemRel.me2other, myDayStem2))}
                                  style={getTenGodChipStyle(fullReport.stemRel.me2other, myDayStem2)}
                                >
                                  {fullReport.stemRel.me2other}
                                </span>
                                <span className="text-[12px] text-muted-foreground">
                                  {myName}{ptcl(myName, "이", "가")} {otherName}{ptcl(otherName, "을", "를")} 이렇게 느끼기 쉬워요
                                </span>
                              </div>
                              <p className="text-[12px] leading-relaxed text-muted-foreground">{fullReport.stemRel.me2otherDesc}</p>
                            </>
                          ) : (
                            <p className="text-[12px] leading-relaxed text-muted-foreground">십성 관계가 뚜렷하게 잡히지 않습니다.</p>
                          )}
                        </div>
                        <div className="ds-inline-detail-nested space-y-1.5">
                          <p className="text-[12px] font-semibold text-foreground">
                            {otherName} → {myName}
                          </p>
                          {fullReport.stemRel.other2me ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn("ds-badge text-[12px] font-bold shadow-none", getTenGodTw(fullReport.stemRel.other2me, otherDayStem2))}
                                  style={getTenGodChipStyle(fullReport.stemRel.other2me, otherDayStem2)}
                                >
                                  {fullReport.stemRel.other2me}
                                </span>
                                <span className="text-[12px] text-muted-foreground">
                                  {otherName}{ptcl(otherName, "이", "가")} {myName}{ptcl(myName, "을", "를")} 이렇게 느끼기 쉬워요
                                </span>
                              </div>
                              <p className="text-[12px] leading-relaxed text-muted-foreground">{fullReport.stemRel.other2meDesc}</p>
                            </>
                          ) : (
                            <p className="text-[12px] leading-relaxed text-muted-foreground">십성 관계가 뚜렷하게 잡히지 않습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>

              {/* ── 배우자 구조 비교: 스냅샷 3축 교차 해석(보조·메인 점수 미반영) ── */}
              {isPersonalLove && result.spouseStructureAxisComparison && (() => {
                const spouseBlock = result.spouseStructureAxisComparison!;
                const higherLabel = (
                  h: "person1" | "person2" | "tie",
                ): string => {
                  if (h === "tie") return "동일";
                  if (h === "person1")
                    return `${myName}${ptcl(myName, "이", "가")} 더 높음`;
                  return `${otherName}${ptcl(otherName, "이", "가")} 더 높음`;
                };
                return (
                  <div className="ds-card overflow-hidden shadow-none border-rose-200/50 bg-rose-50/25 dark:border-rose-900/35 dark:bg-rose-950/20">
                    <div className="border-b border-border bg-muted/20 px-4 py-3">
                      <h2 className="text-sm font-bold text-foreground">배우자 구조 비교</h2>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        원국 스냅샷으로 각자의 현실·정서·매력 축을 뽑은 뒤, 갭·방향·유지/만족을 교차 해석한 보조 섹션입니다. 위 궁합 점수(기준 50+7조정)에는 반영되지 않습니다.
                      </p>
                    </div>
                    <div className="space-y-4 p-4">
                      {(
                        [
                          { axis: "practical" as const, label: "현실 궁합" },
                          { axis: "emotional" as const, label: "정서 궁합" },
                          { axis: "image" as const, label: "매력 궁합" },
                        ] as const
                      ).map(({ axis, label }) => {
                        const v1 = spouseBlock.person1[axis];
                        const v2 = spouseBlock.person2[axis];
                        const st = spouseBlock.stats[axis];
                        const sentence = spouseBlock.crossSentences[axis];
                        return (
                          <div key={axis} className="ds-inline-detail-nested space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {label}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="rounded-lg border border-border/60 bg-background/80 py-2">
                                <p className="text-[11px] text-muted-foreground">{myName}</p>
                                <p className="text-lg font-bold tabular-nums text-foreground">{v1}</p>
                                <p className="text-[10px] text-muted-foreground">점</p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-background/80 py-2">
                                <p className="text-[11px] text-muted-foreground">{otherName}</p>
                                <p className="text-lg font-bold tabular-nums text-foreground">{v2}</p>
                                <p className="text-[10px] text-muted-foreground">점</p>
                              </div>
                            </div>
                            <div className="rounded-md border border-border/50 bg-muted/15 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                              <span className="tabular-nums">차이 {st.gap}점</span>
                              <span className="mx-1.5 text-border">·</span>
                              <span className="tabular-nums">
                                최소 {st.min} · 최대 {st.max} · 평균 {st.average}
                              </span>
                              <span className="mx-1.5 text-border">·</span>
                              <span>{higherLabel(st.higher)}</span>
                            </div>
                            <p className="text-[12px] leading-relaxed text-foreground/90">{sentence}</p>
                          </div>
                        );
                      })}

                      <div className="ds-inline-detail-nested space-y-3 rounded-lg border border-rose-200/40 bg-background/70 p-3 dark:border-rose-900/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          종합 배우자 구조 비교
                        </p>
                        <p className="text-[12px] leading-relaxed text-foreground/95">
                          {spouseBlock.holisticSummary}
                        </p>
                        <div className="space-y-2 border-t border-border/50 pt-2 text-[12px] leading-relaxed">
                          <p>
                            <span className="font-semibold text-foreground">유지 구조</span>
                            <span className="text-muted-foreground"> (생활·역할·약속) </span>
                            {spouseBlock.maintenanceLine}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">만족 구조</span>
                            <span className="text-muted-foreground"> (정서·끌림 체감) </span>
                            {spouseBlock.satisfactionLine}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {isPersonalLove && result.spouseActivationTiming && (() => {
                const timing = result.spouseActivationTiming!;
                const people = [
                  { name: myName, data: timing.person1 },
                  { name: otherName, data: timing.person2 },
                ];
                return (
                  <div className="ds-card overflow-hidden shadow-none border-rose-200/50 bg-rose-50/25 dark:border-rose-900/35 dark:bg-rose-950/20">
                    <div className="border-b border-border bg-muted/20 px-4 py-3">
                      <h2 className="text-sm font-bold text-foreground">결혼운 시기 힌트 비교</h2>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        각자의 현재 대운 안에서 세운별 배우자·결혼 테마 활성도를 계산했습니다. 활성도가 높다고 결혼 적기라는 뜻은 아니며, 활성도×안정도 조합으로 시기의 성격을 구분해서 봐야 합니다.
                      </p>
                    </div>
                    <div className="space-y-5 p-4">
                      {people.map(({ name, data }) => (
                        <div key={name} className="ds-inline-detail-nested space-y-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {name || "인물"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            배우자·결혼 테마가 강하게 움직이는 연도:{" "}
                            <span className="font-semibold text-foreground">
                              {data.top.map((e) => `${e.year}(${e.activation.activationScore}점)`).join(" > ")}
                            </span>
                          </p>
                          <div className="space-y-1.5">
                            {data.years.map((e) => {
                              const isTop = data.top.some((t) => t.year === e.year);
                              return (
                                <div
                                  key={e.year}
                                  className={`rounded-lg border px-3 py-2 text-[12px] ${isTop ? "border-rose-200/70 bg-background/90 dark:border-rose-900/40" : "border-border/50 bg-background/60"}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-foreground tabular-nums">
                                      {e.year} {e.ganZhiHangul}
                                    </span>
                                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                      ❤️ 활성 {e.activation.activationScore}({e.activation.activationLevel}) · 🏠 안정 {e.activation.stabilityScore}({e.activation.stabilityLevel})
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                    {e.activation.interpretation}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── 시주 제외 비교 (중립 카드 + 흰 nested) ── */}
              {hasHourExcluded && resultBase && result && (
                  <div className="ds-card overflow-hidden shadow-none border-violet-200/70 bg-violet-50/35 dark:border-violet-900/40 dark:bg-violet-950/20">
                    <div className="border-b border-border bg-muted/20 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">시주 포함·제외</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        시주를 제외하면 점수가 달라질 수 있어요. 같은 기준에서 비교해 드립니다.
                      </p>
                    </div>
                    <div className="ds-card-pad space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="ds-inline-detail-nested flex-1 space-y-0 py-2 text-center">
                          <p className="ds-caption">시주 포함</p>
                          <p className="text-xl font-bold text-foreground">{resultBase.score}점</p>
                          <p className="ds-caption">{resultBase.finalType}</p>
                        </div>
                        <div className="shrink-0 px-1 text-center">
                          {result.score !== resultBase.score ? (
                            <span
                              className={`text-lg font-bold tabular-nums ${result.score > resultBase.score ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {result.score > resultBase.score
                                ? `+${result.score - resultBase.score}`
                                : result.score - resultBase.score}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">변화 없음</span>
                          )}
                        </div>
                        <div className="ds-inline-detail-nested flex-1 space-y-0 py-2 text-center">
                          <p className="ds-caption">
                            {hourModeA === "제외" && hourModeB === "제외"
                              ? "시주 모두 제외"
                              : hourModeA === "제외"
                                ? `${p1?.birthInput.name || "A"} 시주 제외`
                                : `${p2?.birthInput.name || "B"} 시주 제외`}
                          </p>
                          <p className="text-xl font-bold text-foreground">{result.score}점</p>
                          <p className="ds-caption">{result.finalType}</p>
                        </div>
                      </div>
                      {result.finalType !== resultBase.finalType && (
                        <div className="ds-inline-detail-nested text-[12px] leading-relaxed text-foreground">
                          시주를 모두 넣었을 때는 <span className="font-semibold">{resultBase.finalType}</span>에 가깝고, 지금 설정에서는{" "}
                          <span className="font-semibold">{result.finalType}</span> 쪽으로 읽히는 차이가 있습니다.
                        </div>
                      )}
                    </div>
                  </div>
              )}

              {/* ── 3. 관계 해석 ── */}
                <div className="ds-card overflow-hidden shadow-none">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h2 className="text-sm font-bold text-foreground">관계 해석</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      구조가 만드는 분위기를, 읽기 쉬운 리포트 문장으로 정리했습니다.
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">관계 특징 요약</p>
                      <div className="ds-inline-detail-nested">
                        <p className="ds-body">{fullReport.toneDesc}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">관계 장점</p>
                      <div className="space-y-2">
                        {result.strengths.map((t, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{adaptTextForRelType(t)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">관계 주의점</p>
                      <div className="space-y-2">
                        {result.cautions.map((t, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                            <span>{adaptTextForRelType(t)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              {/* ── 4. 연애/결혼 관점 해석 (별도 카드) ── */}
                {(() => {
                  const rel = mode === "me_other"
                    ? (p2 as (PersonRecord & { relationshipType?: RelationshipType }) | null)?.relationshipType
                    : undefined;

                  const viewTitle =
                    rel === "family" ? "가족 관점 해석" :
                    rel === "friend" ? "친구 관점 해석" :
                    "연애 관점 해석";

                  const viewDesc =
                    rel === "family"
                      ? "가족으로서 서로를 대할 때 어떤 리듬과 소통 방식이 자연스러운지 정리합니다."
                      : rel === "friend"
                        ? "친구로서 서로를 대할 때 어떤 리듬과 소통 방식이 자연스러운지 정리합니다."
                        : "서로를 대할 때 어떤 리듬과 소통 방식이 자연스러운지 정리합니다.";

                  const deRomance = (text: string) => {
                    if (!text) return text;
                    // 비연인 관계에서는 연애/이성 전제를 줄이고 관계 일반 표현으로 치환
                    if (rel !== "family" && rel !== "friend") return text;
                    return text
                      .replaceAll("연애", "관계")
                      .replaceAll("이성", "상대")
                      .replaceAll("데이트", "만남")
                      .replaceAll("애정", "정서")
                      .replaceAll("스킨십", "표현")
                      .replaceAll("설렘", "활력");
                  };

                  return (
                  <div className="ds-card overflow-hidden shadow-none">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h2 className="text-sm font-bold text-foreground">{viewTitle}</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {viewDesc}
                    </p>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className={cn("rounded-xl border p-3 text-center", myGender === "여" ? "border-rose-200 bg-rose-50/60" : "border-sky-200 bg-sky-50/60")}>
                        <p className="text-[13px] text-muted-foreground inline-flex items-center gap-0.5 justify-center w-full">
                          <GenderSymbol gender={myGender} />{myName}
                        </p>
                        <div className="ds-inline-detail-nested mt-2 py-2">
                          <p className="text-sm font-bold text-foreground">{deRomance((fullReport as any).styleComp?.person1Style || (fullReport as any).workStyleComp?.person1Style || (fullReport as any).dynamicsComp?.person1Style)}</p>
                        </div>
                      </div>
                      <div className={cn("rounded-xl border p-3 text-center", otherGender === "여" ? "border-rose-200 bg-rose-50/60" : "border-sky-200 bg-sky-50/60")}>
                        <p className="text-[13px] text-muted-foreground inline-flex items-center gap-0.5 justify-center w-full">
                          <GenderSymbol gender={otherGender} />{otherName}
                        </p>
                        <div className="ds-inline-detail-nested mt-2 py-2">
                          <p className="text-sm font-bold text-foreground">{deRomance((fullReport as any).styleComp?.person2Style || (fullReport as any).workStyleComp?.person2Style || (fullReport as any).dynamicsComp?.person2Style)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="ds-inline-detail-nested">
                      <p className="ds-body">{deRomance((fullReport as any).styleComp?.dynamicsDesc || (fullReport as any).workStyleComp?.synergyDesc || (fullReport as any).dynamicsComp?.desc)}</p>
                    </div>
                  </div>
                </div>
                  );
                })()}

                {mode === "me_other" && (() => {
                  const rel = (p2 as (PersonRecord & { relationshipType?: RelationshipType }) | null)?.relationshipType;
                  const show = rel === "lover" || rel === "spouse" || rel === "interest";
                  // [Phase 3 P0 재작업] marriageView는 이제 구조 evidence(dayBranchRel)만으로
                  // 결정 가능할 때만 값을 가진다 — legacy score threshold로 억지 라벨을
                  // 만들지 않으므로 null이면 섹션 자체를 숨긴다(P1에서 새 calibration 설계).
                  if (!show || !(fullReport as any).marriageView) return null;
                  return (
                    <div className="ds-card overflow-hidden shadow-none">
                      <div className="border-b border-border bg-muted/20 px-4 py-3">
                        <h2 className="text-sm font-bold text-foreground">결혼 관점 해석</h2>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          관계를 ‘함께 살기’ 관점으로 보면 어떤 방향이 유리한지 정리합니다.
                        </p>
                      </div>
                      <div className="space-y-3 p-4">
                        {/* 궁합 점수(현재 result)와 동일 팔레트로 태그 통일 */}
                        <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] text-muted-foreground">관계 유형</span>
                            <span
                              className="ds-badge border px-3 py-1.5 text-[13px] font-bold shadow-none"
                              style={{
                                background: palette.pastel,
                                borderColor: palette.border,
                                color: palette.badgeText,
                              }}
                            >
                              {(fullReport as any).marriageView?.type}
                            </span>
                          </div>
                          <p className="mt-2 text-[13px] leading-relaxed text-foreground">{(fullReport as any).marriageView?.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ── DEV: 점수 디버그 ── */}
              {import.meta.env.DEV && (() => {
                const s = result.score;
                const baseType = s >= 85 ? "이상적 궁합" : s >= 70 ? "좋은 궁합" : s >= 55 ? "노력형 궁합" : s >= 40 ? "긴장형 궁합" : "주의 궁합";
                const adj: string[] = [];
                if ((fullReport as any).structural?.dayMasterSupportive)  adj.push("일간상생 −1");
                if ((fullReport as any).structural?.spousePalaceClash)    adj.push("배우자궁충 +1");
                if ((fullReport as any).structural?.branchClashCount >= 2) adj.push(`지지충${(fullReport as any).structural?.branchClashCount}개 +1`);
                if ((fullReport as any).structural?.monthBranchClash)     adj.push("월지충 +1");
                return (
                  <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-[11px] font-mono text-yellow-800">
                    [DEV] 기본점수 {s}점 ({baseType}) → 조정: [{adj.join(", ") || "없음"}] → 최종: {fullReport.tone}
                  </div>
                );
              })()}

              {/* ── 5. 상세/흐름/레이어 (내 사주 아코디언 스타일) ── */}
              <div className="space-y-3">
                <CardAccordion title="상세 분석" defaultOpen={false}>
                {/* 양쪽 사주 요약 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">사주 비교</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { record: ep1!, label: myName, gender: myGender },
                      { record: ep2!, label: otherName, gender: otherGender },
                    ].map(({ record, label, gender }) => {
                      const p = getFinalPillars(record);
                      return (
                        <div key={label} className="ds-inline-detail-nested p-2.5">
                          <p className="text-[13px] text-muted-foreground mb-2 inline-flex items-center gap-0.5">
                            <GenderSymbol gender={gender} />{label}
                          </p>
                          <div className="grid grid-cols-4 gap-0.5">
                            {[
                              { lbl: "시", pillar: p.hour },
                              { lbl: "일", pillar: p.day },
                              { lbl: "월", pillar: p.month },
                              { lbl: "년", pillar: p.year },
                            ].map(({ lbl, pillar }) => (
                              <PillarCard key={lbl} label={lbl} pillar={pillar} unknown={!pillar} highlight={lbl === "일"} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 배우자궁 비교 */}
                {(isPersonalLove || (!isPersonalLove && (fullReport as any).branchComp)) && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{isPersonalLove ? "배우자궁 비교" : "내면(일지) 비교"}</p>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).branchComp?.myBranch))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={myGender} />
                            {myName} 일지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).branchComp?.myBranch)}>
                            {(fullReport as any).branchComp?.myBranch}{charToElement((fullReport as any).branchComp?.myBranch) ?? ""}
                          </span>
                      </div>
                      <div className="text-center">
                        <span className="text-lg text-muted-foreground">↔</span>
                      </div>
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).branchComp?.otherBranch))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={otherGender} />
                            {otherName} 일지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).branchComp?.otherBranch)}>
                            {(fullReport as any).branchComp?.otherBranch}{charToElement((fullReport as any).branchComp?.otherBranch) ?? ""}
                          </span>
                      </div>
                    </div>
                    <div className="ds-inline-detail-nested space-y-1">
                      <p className={cn("text-[13px] font-semibold", REL_TONE_COLOR[(fullReport as any).branchComp?.tone] ?? "text-foreground")}>
                        {(fullReport as any).branchComp?.tone}
                      </p>
                      <p className="text-sm text-foreground">{(fullReport as any).branchComp?.desc}</p>
                    </div>
                    <div className="ds-inline-detail-nested mt-2 space-y-1">
                      <p className="text-[13px] font-semibold text-muted-foreground">관계 안정도</p>
                      <p className="text-sm text-foreground">{(fullReport as any).branchComp?.stability}</p>
                    </div>
                  </div>
                )}

                {/* 사회궁(월지) 비교 (동료) */}
                {!isPersonalLove && (fullReport as any).monthBranchComp && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">사회궁(월지) 비교</p>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).monthBranchComp?.myMonth))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={myGender} />
                            {myName} 월지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).monthBranchComp?.myMonth)}>
                            {(fullReport as any).monthBranchComp?.myMonth}{charToElement((fullReport as any).monthBranchComp?.myMonth) ?? ""}
                          </span>
                      </div>
                      <div className="text-center">
                        <span className="text-lg text-muted-foreground">↔</span>
                      </div>
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).monthBranchComp?.otherMonth))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={otherGender} />
                            {otherName} 월지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).monthBranchComp?.otherMonth)}>
                            {(fullReport as any).monthBranchComp?.otherMonth}{charToElement((fullReport as any).monthBranchComp?.otherMonth) ?? ""}
                          </span>
                      </div>
                    </div>
                    <div className="ds-inline-detail-nested space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {(fullReport as any).monthBranchComp?.relations?.map((r: string, i: number) => (
                          <span key={i} className="ds-badge font-bold shadow-none border-border">
                            {r}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-foreground">{(fullReport as any).monthBranchComp?.desc}</p>
                    </div>
                  </div>
                )}


                {/* 세부 분석 */}
                {result.details.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">세부 분석</p>
                    <div className="ds-inline-detail-nested p-3 space-y-2">
                      {result.details
                        // avoid repeating already-expanded sections (구조 분석/비교 카드에서 다룬 항목)
                        .filter((d) => !["일간 분석", "배우자궁", "지지 교차", "오행 보완", "십성 관계"].includes(d.title))
                        // 비애정 관계 시 배우자/애정성 항목 필터링
                        .filter((d) => isPersonalLove || !["배우자궁 안정(원국)", "관성 작동(원국)", "재성 작동(원국)", "올해 운 가중(타이밍)", "배우자·결혼 활성도(타이밍)"].includes(d.title))
                        .map((d, i) => (
                        d.isPositive ? (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{d.title}</p>
                              <p className="mt-0.5 text-[13px] text-foreground/80">{adaptTextForRelType(d.description)}</p>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{d.title}</p>
                              <p className="mt-0.5 text-[13px] text-foreground/80">{adaptTextForRelType(d.description)}</p>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
                </CardAccordion>

              {/* ── 현재 관계 흐름 (상세 이후) ── */}
              {flowA && flowB && combinedFlow && (
                <CardAccordion title="현재 관계 흐름" defaultOpen={true}>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { flow: flowA, gender: myGender },
                      { flow: flowB, gender: otherGender },
                    ] as const).map(({ flow, gender }) => (
                      <div key={flow.name} className="ds-inline-detail-nested space-y-3 p-3 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-foreground">
                            <GenderSymbol gender={gender} />
                            {flow.name}
                          </span>
                          <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full border border-border", OPEN_BADGE[flow.flowOpenness])}>
                            {flow.flowLabel}
                          </span>
                        </div>

                        <div className="ds-inline-detail-nested space-y-1 p-2.5">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">운 흐름</p>
                          {flow.daywoon && (
                            <FlowRow label="대운" gz={flow.daywoon.ganZhi} tg={flow.daywoonTenGod} />
                          )}
                          <FlowRow label="세운" gz={flow.sewoon} tg={flow.sewoonTenGod} />
                          <FlowRow label="월운" gz={flow.wolwoon} tg={flow.wolwoonTenGod} />
                          <FlowRow label="일운" gz={flow.ilwoon} tg={flow.ilwoonTenGod} />
                        </div>

                        <div className="ds-inline-detail-nested space-y-2 p-2.5">
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">요약</p>
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">감정</p>
                            <p className="text-[12px] leading-snug text-foreground">{flow.emotionalTendency}</p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">관계</p>
                            <p className="text-[12px] leading-snug text-foreground">{flow.relationshipTendency}</p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">소통</p>
                            <p className="text-[12px] leading-snug text-foreground">{flow.communicationTendency}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 이전 스타일 (스샷 5.21.05): 결합 흐름(블루) + 오늘(화이트) */}
                  <div className="rounded-xl border border-sky-200/80 bg-sky-50/35 p-3 shadow-none dark:border-sky-900/40 dark:bg-sky-950/20">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-bold text-foreground">둘의 현재 결합 흐름</p>
                      <span className={cn("text-[11px] font-semibold rounded-full border border-border px-2 py-0.5", ALIGN_BADGE[combinedFlow.alignmentType])}>
                        {combinedFlow.alignmentType}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-foreground">{combinedFlow.alignmentDesc}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{combinedFlow.staticModifier}</p>
                  </div>

                  <div className="ds-inline-detail-nested space-y-1.5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">오늘의 관계 흐름</p>
                    <p className={cn("text-[14px] font-semibold leading-snug", (TODAY_LEVEL_CLASS[combinedFlow.todayLevel] ?? TODAY_LEVEL_CLASS.neutral).title)}>
                      {combinedFlow.todaySummary}
                    </p>
                  </div>

                  {/* 동적 궁합 시기 분석 (터닝 포인트) 추가 */}
                  {combinedFlow.timingTurningPoints && combinedFlow.timingTurningPoints.length > 0 && (
                    <div className="ds-inline-detail-nested space-y-3 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">다가오는 터닝포인트 타이밍 📅</p>
                      <div className="space-y-2">
                        {combinedFlow.timingTurningPoints.map((tp, idx) => {
                          let badgeBg = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
                          if (tp.type === "union") badgeBg = "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
                          else if (tp.type === "adjustment") badgeBg = "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30";
                          else if (tp.type === "caution") badgeBg = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";

                          return (
                            <div key={idx} className="rounded-lg border border-border p-3 bg-white dark:bg-neutral-900">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[13px] font-bold text-foreground">{tp.title}</h4>
                                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", badgeBg)}>
                                  {tp.type === "union" ? "결합/결실" : tp.type === "adjustment" ? "변화/조율" : tp.type === "caution" ? "주의/조율" : "일반"}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                                {tp.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] leading-relaxed text-muted-foreground/60">
                    ※ 운 흐름은 규칙 기반 간략 추정으로, 절대적 예언이 아닙니다.
                  </p>
                </CardAccordion>
              )}

              {relationshipInteractionByYear.length > 0 && (
                <CardAccordion title="💕 커플 관계 상호작용도(연도별)" defaultOpen={false}>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mb-2">
                    각자의 개인별 배우자·결혼 활성도/안정도와는 별개로, 그 해 대운·세운이 두 사람 사이의
                    관계 자체를 얼마나 활성화·조화·충돌시키는지 보여줍니다. 활성도가 높다고 재회·결혼으로
                    단정하지 말고, 조화도(방향)와 개인별 배우자 활성도를 함께 참고하세요.
                  </p>
                  <div className="space-y-2">
                    {relationshipInteractionByYear.map(({ year, result: r }) => (
                      <div key={year} className="rounded-lg border border-border p-3 bg-white dark:bg-neutral-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-bold text-foreground">{year}년</span>
                          <span className={cn("text-[11px] font-semibold rounded-full border px-2 py-0.5", toneClassesNeutral(r.activationLevel).badge)}>
                            관계 활성 {r.activationScore} ({r.activationLevel})
                          </span>
                          <span
                            className={cn(
                              "text-[11px] font-semibold rounded-full border px-2 py-0.5",
                              toneClasses(toneTierFromLevel(r.harmonyDirection)).badge,
                            )}
                          >
                            조화 {r.harmonyScore} ({r.harmonyDirection})
                          </span>
                          <span className={cn("text-[11px] font-semibold rounded-full border px-2 py-0.5", toneClasses(toneTierFromLevel(r.stabilityLevel)).badge)}>
                            안정 {r.stabilityScore} ({r.stabilityLevel})
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/85">{r.interpretation}</p>
                        <div
                          className={cn(
                            "mt-2 rounded-md border px-2.5 py-2",
                            toneClasses(PROGRESS_READINESS_TONE[r.progressReadinessLevel]).box,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-foreground/90">💕 관계 진전 여건</span>
                            <span
                              className={cn(
                                "text-[11px] font-bold rounded-full border px-2 py-0.5",
                                toneClasses(PROGRESS_READINESS_TONE[r.progressReadinessLevel]).badge,
                              )}
                            >
                              {r.progressReadinessLevel}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">{r.progressReadinessNote}</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">근거: {r.progressReadinessReasons.join(" · ")}</p>
                        </div>
                        {r.isLowActivityPeriod && (
                          <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
                            💤 관계 저활성 구간 — 두 사람 모두 배우자 테마와 커플 상호작용이 조용한 시기입니다. 인연이 없다는 뜻은 아니며, 특별한 사건 없이 지나갈 가능성이 상대적으로 높다는 의미입니다.
                          </div>
                        )}
                        {r.factors.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {r.factors.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <span
                                  className={cn(
                                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                    f.direction === "우호" ? "bg-emerald-400" : f.direction === "비우호" ? "bg-red-400" : "bg-gray-300",
                                  )}
                                />
                                {f.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </CardAccordion>
              )}

              {(isPersonalLove || (!isPersonalLove && (fullReport as any).branchComp)) && (
                <CardAccordion title="배우자 성향 · 관계운 레이어" defaultOpen={false}>
                  <p className="-mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    궁합 점수와는 <span className="font-semibold text-foreground">따로 놓고</span> 읽어 주세요. 각자 원국에 스며 있는 배우자 성향과 관계운의 흐름만 담았습니다.
                  </p>

                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">① 원국 배우자 성향</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: myName, gender: myGender, branch: myDayBranch2, palace: mySpousePalace },
                        { name: otherName, gender: otherGender, branch: otherDayBranch2, palace: otherSpousePalace },
                      ].map(({ name, gender, branch, palace }) => (
                        <div key={name} className="ds-inline-detail-nested space-y-1.5 p-3">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-muted-foreground">
                              <GenderSymbol gender={gender} />
                              {name}
                            </span>
                            {branch && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-sm font-bold" style={getBranchColor(branch)}>
                                {branch}
                              </span>
                            )}
                          </div>
                          {palace ? (
                            <>
                              <p className="mb-1 text-[12px] font-bold leading-snug text-foreground">
                                {palace.title.split("—")[1]?.trim() ?? palace.element}
                              </p>
                              <p className="text-[12px] leading-relaxed text-muted-foreground">{palace.summary}</p>
                            </>
                          ) : (
                            <p className="text-[12px] text-muted-foreground">정보 없음</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(myMarriageTiming || otherMarriageTiming) && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">② 결혼 적합 시기 힌트</p>
                      <div className="space-y-2">
                        {[
                          { name: myName, gender: myGender, timing: myMarriageTiming },
                          { name: otherName, gender: otherGender, timing: otherMarriageTiming },
                        ]
                          .filter(({ timing }) => timing)
                          .map(({ name, gender, timing }) => (
                            <div key={name} className="ds-inline-detail-nested space-y-1 px-3 py-2.5">
                              <p className="mb-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-foreground">
                                <GenderSymbol gender={gender} />
                                {name}
                              </p>
                              <p className="text-[12px] leading-relaxed text-muted-foreground">{timing!.daewoonHint}</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">{timing!.general}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <p className="border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground/60">
                    * 궁합은 운명이 아닙니다. 두 원국 구조가 어떻게 상호작용하는 경향이 있는지를 보여주는 참고 정보입니다.
                  </p>
                </CardAccordion>
              )}
              </div>

              {/* ── 행동 가이드 ── */}
              <div className="ds-card overflow-hidden shadow-none">
                  <div className="border-b border-border bg-muted/20 px-4 py-3">
                    <h2 className="text-sm font-bold text-foreground">행동 가이드</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      오늘부터 천천히 시도해 볼 만한 행동과, 부딪히기 쉬운 지점을 함께 정리했습니다.
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">추천 행동</p>
                      <div className="space-y-2">
                        {result.advice.map((t, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{adaptTextForRelType(t)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">주의 행동</p>
                      <div className="space-y-2">
                        {(fullReport.conflictPoints.length > 0
                          ? fullReport.conflictPoints.slice(0, 3)
                          : ["반복되는 갈등 패턴을 미리 짚고, 감정이 격해질 때 잠시 거리를 두는 연습을 해보세요."]).map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>{adaptTextForRelType(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {fullReport.tips.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">관계 유지 팁</p>
                        <div className="rounded-xl border border-border bg-muted/15 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[14px]">💡</span>
                            <p className="text-sm font-bold text-foreground">오늘부터 써먹기</p>
                          </div>
                          <ul className="space-y-2">
                            {fullReport.tips.slice(0, 5).map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                                <span className="mt-0.5 shrink-0">•</span>
                                <span>{adaptTextForRelType(tip)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

            </div>
          );})()}
        </>
      )}
      {/* ── 점수 기준 정보 시트 ── */}
      {showInfoSheet && fullReport && result && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowInfoSheet(false)}
        >
          <div
            className="w-full bg-background rounded-t-3xl border-t border-border shadow-none max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
              <h2 className="font-bold text-[16px] text-foreground">점수 계산 기준</h2>
              <button
                onClick={() => setShowInfoSheet(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 pt-[40px] pb-[40px]">

              {/* 섹션 1: 점수 구성 */}
              <section>
                <h3 className="text-[13px] font-bold text-foreground mb-2">① 점수 구성 (기준점 50 + 7항목 조정)</h3>
                <div className="rounded-xl border border-border overflow-hidden text-[12px]">
                  {[
                    { name: "일간 관계",   range: "−12 ~ +12", desc: "두 일간의 오행 상생·상극" },
                    { name: "배우자궁",    range: "−10 ~ +10", desc: "두 일지의 합·충·형·파·해" },
                    { name: "월지 궁합",   range: "−10 ~ +10", desc: "월지(가치관·환경)의 합충" },
                    { name: "지지 합충",   range: "−10 ~ +10", desc: "8자 지지 전체 조합 관계" },
                    { name: "오행 보완",   range: "−5 ~ +5",   desc: "서로 부족한 오행 보완 구조" },
                    { name: "십성 궁합",   range: "−5 ~ +5",   desc: "상대 일간이 주는 십성 유형" },
                    { name: "용신 보완",   range: "0 ~ +8",    desc: "상대 오행이 내 용신과 일치" },
                  ].map(({ name, range, desc }) => (
                    <div key={name} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0">
                      <span className="font-semibold text-foreground w-20 shrink-0">{name}</span>
                      <span className="text-muted-foreground w-24 shrink-0 text-right tabular-nums">{range}</span>
                      <span className="text-muted-foreground leading-snug">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 섹션 2: 등급 기준 */}
              <section>
                <h3 className="text-[13px] font-bold text-foreground mb-2">② 등급 기준</h3>
                <div className="rounded-xl border border-border overflow-hidden text-[12px]">
                  {[
                    { range: "80점 이상",  label: "이상적 궁합", color: "text-purple-700" },
                    { range: "68 – 79점", label: "좋은 궁합",   color: "text-green-700" },
                    { range: "55 – 67점", label: "노력형 궁합", color: "text-blue-600" },
                    { range: "40 – 54점", label: "긴장형 궁합", color: "text-orange-600" },
                    { range: "39점 이하",  label: "주의 궁합",   color: "text-red-600" },
                  ].map(({ range, label, color }) => (
                    <div key={label} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
                      <span className="text-muted-foreground w-24 shrink-0">{range}</span>
                      <span className={`font-bold ${color}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 섹션 3: 구조적 등급 조정 */}
              <section>
                <h3 className="text-[13px] font-bold text-foreground mb-2">③ 구조적 등급 조정</h3>
                <div className="rounded-xl border border-border overflow-hidden text-[12px]">
                  {[
                    { cond: "배우자궁 복합 긴장 (원진·해·형 중복)", delta: "1단계 하향", color: "text-red-600" },
                  ].map(({ cond, delta, color }) => (
                    <div key={cond} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0">
                      <span className="text-muted-foreground flex-1">{cond}</span>
                      <span className={`font-semibold shrink-0 ${color}`}>{delta}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  일간·배우자궁·월지는 이제 기준 합산 점수 자체(Core)에 직접 반영되어 있어, 여기서 다시 등급을 조정하지 않습니다. 조정은 최대 1단계까지 적용됩니다.
                </p>
              </section>

              {/* 섹션 4: 현재 쌍 적용 */}
              <section>
                <h3 className="text-[13px] font-bold text-foreground mb-2">④ 현재 쌍 적용 결과</h3>
                <div className="rounded-xl border border-border overflow-hidden text-[12px]">

                  {/* 기준점 */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
                    <span className="text-muted-foreground flex-1">기준점</span>
                    <span className="font-bold text-foreground">50점</span>
                  </div>

                  {/* 7가지 조정 항목 (result 단일 객체에서 읽음) */}
                  {result.adjustmentSteps.map((step) => {
                    const sign = step.delta > 0 ? "+" : "";
                    const color = step.delta > 0 ? "text-green-700" : step.delta < 0 ? "text-red-600" : "text-muted-foreground";
                    return (
                      <div key={step.category} className="border-b border-border last:border-b-0">
                        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                          <span className="text-muted-foreground flex-1">{step.category}</span>
                          <span className={`font-semibold shrink-0 tabular-nums ${color}`}>{sign}{step.delta}점</span>
                        </div>
                        {step.note && (
                          <p className="px-3 pb-2 text-[11px] text-muted-foreground/70 leading-snug">{step.note}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* 기준 합산 점수 — Phase 2부터 baseScore는 위 8개 항목의 flat 합산이 아니라
                      Core(일간·배우자궁·월지)/Aux(나머지 5개) 2계층 가중합이다. 위에 나열된
                      8개 delta 값은 각 항목 자체의 해석용 수치이며, 단순히 더한다고 이 점수가
                      나오지 않는다(상세 breakdown은 CompatibilityResult.coreAux 참고). */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t-2 border-border bg-muted/40">
                    <span className="text-muted-foreground flex-1">기준 합산 점수</span>
                    <span className="font-bold text-foreground">{result.baseScore}점</span>
                  </div>

                  {/* 구조적 등급 조정 (있을 때만) */}
                  {result.structuralSteps.length > 0 && (
                    <div className="px-3 py-2 border-t border-border">
                      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">구조적 등급 조정</p>
                      {result.structuralSteps.map((s) => (
                        <div key={s.label} className="flex items-center gap-2 mb-0.5">
                          <span className="text-foreground text-[12px]">• {s.label}</span>
                          <span className={`text-[12px] font-semibold ${s.direction === "up" ? "text-green-700" : "text-red-600"}`}>
                            {s.direction === "up" ? "▲ 1단계 상향" : "▼ 1단계 하향"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 최종 등급 (result.finalType → palette.badgeText — 팝업과 배지 동일 출처) */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t-2 border-border bg-muted/40">
                    <span className="text-muted-foreground flex-1">최종 등급</span>
                    <span
                      className="font-bold"
                      style={{ color: palette?.badgeText }}
                    >{result.finalType}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                  점수는 사주 원칙에 기반한 참고 지표입니다. 실제 인연은 노력과 이해로 만들어집니다.
                </p>
              </section>

            </div>
            <div className="h-8" />
          </div>
        </div>
      )}
    </div>
  );
}
