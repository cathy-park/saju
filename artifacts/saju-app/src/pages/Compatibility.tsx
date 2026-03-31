import { useState, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PillarCard } from "@/components/PillarCard";
import type { CompatibilityResult, CompatibilityTone } from "@/lib/compatibilityScore";
import { buildFullCompatibilityReport, COMPAT_TONE_COLOR } from "@/lib/compatibilityReport";
import {
  getMyProfile,
  getPeople,
  getFinalPillars,
  type PersonRecord,
  type RelationshipType,
  RELATIONSHIP_TYPE_EMOJI,
} from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { type FiveElementCount } from "@/lib/sajuEngine";
import { Heart, CheckCircle, XCircle, AlertTriangle, Lightbulb, Star, ChevronDown, ArrowLeftRight, Waves } from "lucide-react";
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

function scoreToMascot(score: number): MascotExpression {
  if (score >= 75) return "happy";
  if (score >= 55) return "neutral";
  return "warning";
}

// ── Grade color palette (single source of truth) ─────────────────
// All UI elements — card bg, graph ring, badge, score accent — derive from here.
// Keyed by result.finalType only. No other logic is used for colors.

const GRADE_PALETTE: Record<CompatibilityTone, { cardBg: string; pastel: string; strong: string; border: string; badgeText: string }> = {
  "이상적 궁합": { cardBg: "#FAF7FF", pastel: "#F1E8FF", strong: "#8B5CF6", border: "#C4B5FD", badgeText: "#6D28D9" },
  "좋은 궁합":   { cardBg: "#F3FBF6", pastel: "#E6F7EC", strong: "#22C55E", border: "#86EFAC", badgeText: "#15803D" },
  "노력형 궁합": { cardBg: "#F3F8FF", pastel: "#E8F1FF", strong: "#3B82F6", border: "#93C5FD", badgeText: "#1D4ED8" },
  "긴장형 궁합": { cardBg: "#FFFCF8", pastel: "#FFF1E6", strong: "#F59E0B", border: "#FCD34D", badgeText: "#B45309" },
  "주의 궁합":   { cardBg: "#FFF7F7", pastel: "#FFE8E8", strong: "#EF4444", border: "#FCA5A5", badgeText: "#B91C1C" },
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

const FLOW_STEM_EL: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};
const FLOW_EL_BG: Record<string, string> = {
  목: "bg-green-100 text-green-800", 화: "bg-red-100 text-red-800",
  토: "bg-yellow-100 text-yellow-800", 금: "bg-gray-100 text-gray-700",
  수: "bg-blue-100 text-blue-800",
};
const TODAY_CARD_COLORS: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50/50",
  neutral: "border-border bg-muted/20",
  caution: "border-amber-200 bg-amber-50/50",
};
const TODAY_TEXT_COLORS: Record<string, string> = {
  good: "text-emerald-700",
  neutral: "text-foreground",
  caution: "text-amber-700",
};
const ALIGN_BADGE: Record<string, string> = {
  "둘 다 열림": "bg-emerald-100 text-emerald-800",
  "한쪽 열림":  "bg-blue-100 text-blue-800",
  "교차 흐름":  "bg-amber-100 text-amber-800",
  "둘 다 안정": "bg-gray-100 text-gray-700",
  "긴장 구간":  "bg-red-100 text-red-700",
};
const OPEN_BADGE: Record<string, string> = {
  open:    "bg-emerald-100 text-emerald-800",
  neutral: "bg-gray-100 text-gray-700",
  closed:  "bg-indigo-100 text-indigo-800",
};

function TgChip({ tg, stem }: { tg: string | null; stem: string }) {
  if (!tg) return null;
  const el = FLOW_STEM_EL[stem];
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${el ? FLOW_EL_BG[el] : "bg-muted text-foreground"}`}>
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
  return {
    background: elementColorVar(el as FiveElKey, "muted"),
    borderColor: elementColorVar(el as FiveElKey, "base"),
  };
}

// ── Element Mirror — Mirrored Bar Chart ──────────────────────────

const OHAENG_COLOR: Record<string, string> = {
  목: "#4CAF50", 화: "#E53935", 토: "#E0A800", 금: "#9E9E9E", 수: "#1E88E5",
};

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
        const elColor = OHAENG_COLOR[el];

        return (
          <div
            key={el}
            className={`flex items-center gap-1 py-0.5 px-1 rounded-lg transition-colors ${isEmphasis ? "bg-amber-50" : ""}`}
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
                style={{ color: isEmphasis ? elColor : "#999" }}
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
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-4">{children}</div>}
    </div>
  );
}

// ── Bullet list row ───────────────────────────────────────────────

function BulletRow({ text, positive }: { text: string; positive: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-[13px] rounded-lg px-3 py-2 ${positive ? "bg-emerald-50 text-emerald-900" : "bg-orange-50 text-orange-900"}`}>
      {positive
        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
        : <XCircle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />}
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
          className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors ${
            selectedPerson?.id === p.id
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border hover:border-muted-foreground/40"
          }`}
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
            className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors ${
              selected?.id === p.id
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-muted-foreground/40"
            }`}
          >
            {p.birthInput.name}
          </button>
        ))}
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

  const fullReport = (ep1 && ep2)
    ? buildFullCompatibilityReport(ep1, ep2, mode === "me_other" ? (p2 as PersonRecord & { relationshipType?: RelationshipType }).relationshipType : undefined)
    : null;
  const result: CompatibilityResult | null = fullReport?.scoreResult ?? null;

  // ── 시주 포함 기준 점수 (비교용) ──────────────────────────────
  const hasHourExcluded = hourModeA === "제외" || hourModeB === "제외";
  const fullReportBase = hasHourExcluded && p1 && p2
    ? buildFullCompatibilityReport(p1, p2, mode === "me_other" ? (p2 as PersonRecord & { relationshipType?: RelationshipType }).relationshipType : undefined)
    : null;
  const resultBase: CompatibilityResult | null = fullReportBase?.scoreResult ?? null;
  // Derive all colors from result.finalType — single source of truth
  const palette = result ? (GRADE_PALETTE[result.finalType] ?? GRADE_PALETTE["노력형 궁합"]) : null;
  const myName = p1?.birthInput.name ?? "";
  const otherName = p2?.birthInput.name ?? "";
  const myGender = p1?.birthInput.gender ?? "";
  const otherGender = p2?.birthInput.gender ?? "";

  // ── 배우자궁·관성 레이어 데이터 ──
  const myPillarsFull = p1 ? getFinalPillars(p1) : null;
  const myDayBranch2 = myPillarsFull?.day?.hangul?.[1] ?? "";
  const myDayStem2   = myPillarsFull?.day?.hangul?.[0] ?? "";
  const mySpousePalace = myDayBranch2 ? getSpousePalaceInfo(myDayBranch2) : null;
  const myLC = p1 ? calculateLuckCycles(p1.birthInput, p1.profile.computedPillars) : null;
  const myMarriageTiming = (p1 && myDayStem2 && myLC && myLC.daewoon.length > 0)
    ? getMarriageTimingHint(p1.birthInput.gender as "남" | "여", myDayStem2, myLC.daewoon)
    : null;

  const otherPillarsFull = p2 ? getFinalPillars(p2) : null;
  const otherDayBranch2 = otherPillarsFull?.day?.hangul?.[1] ?? "";
  const otherDayStem2   = otherPillarsFull?.day?.hangul?.[0] ?? "";
  const otherSpousePalace = otherDayBranch2 ? getSpousePalaceInfo(otherDayBranch2) : null;
  const otherLC = p2
    ? calculateLuckCycles(p2.birthInput, p2.profile.computedPillars)
    : null;
  const otherMarriageTiming = (p2 && otherDayStem2 && otherLC && otherLC.daewoon.length > 0)
    ? getMarriageTimingHint(p2.birthInput.gender as "남" | "여", otherDayStem2, otherLC.daewoon)
    : null;

  // ── 동적 궁합 — 현재 운 흐름 ──────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const flowA = useMemo(
    () => (p1 ? computePersonCurrentFlow(p1, now) : null),
    [p1, now],
  );
  const flowB = useMemo(
    () => (p2 ? computePersonCurrentFlow(p2, now) : null),
    [p2, now],
  );
  const combinedFlow = useMemo(
    () =>
      flowA && flowB && result
        ? computeCombinedTimingFlow(flowA, flowB, result.score)
        : null,
    [flowA, flowB, result],
  );

  const canUsePairMode = people.length >= 2;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">궁합</h1>
        {mode === "me_other"
          ? <p className="text-[13px] text-muted-foreground mt-0.5">{myProfile.birthInput.name}님의 사주 궁합 분석</p>
          : (pairPersonA && pairPersonB)
            ? <p className="text-[13px] text-muted-foreground mt-0.5">{pairPersonA.birthInput.name} ↔ {pairPersonB.birthInput.name} 궁합 분석</p>
            : <p className="text-[13px] text-muted-foreground mt-0.5">두 사람을 선택해 궁합을 분석합니다</p>
        }
      </div>
      {/* ── 모드 탭 ── */}
      {canUsePairMode && (
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          {([
            { key: "me_other", label: "나 ↔ 상대" },
            { key: "pair",     label: "상대끼리" },
          ] as { key: "me_other" | "pair"; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 text-[13px] font-semibold py-1.5 rounded-lg transition-colors ${
                mode === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
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
          {mode === "me_other" ? (
            <PeopleTabSelector
              people={people}
              selectedPerson={selectedPerson}
              onSelect={setSelectedPerson}
            />
          ) : (
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
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

          {/* ── 시주 포함/제외 모드 (인물별 개별 설정) ── */}
          {p1 && p2 && (
            <div className="space-y-1.5">
              {(
                [
                  { label: p1.birthInput.name || "A", mode: hourModeA, setMode: setHourModeA },
                  { label: p2.birthInput.name || "B", mode: hourModeB, setMode: setHourModeB },
                ] as Array<{ label: string; mode: "포함" | "제외"; setMode: (m: "포함" | "제외") => void }>
              ).map(({ label, mode: hm, setMode: setHm }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[12px] text-muted-foreground shrink-0 w-16 truncate font-medium">{label}</span>
                  <span className="text-[12px] text-muted-foreground shrink-0">시주</span>
                  {(["포함", "제외"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setHm(m)}
                      className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                        hm === m
                          ? "bg-foreground text-background border-foreground"
                          : "bg-muted/30 text-muted-foreground border-border"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  {hm === "제외" && (
                    <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      제외 중
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {result && p1 && p2 && palette && fullReport && (() => {
            const myPillarsForZodiac = p1 ? getFinalPillars(p1) : null;
            const myZodiac  = getZodiacFromDayPillar(myPillarsForZodiac?.day?.hangul ?? "");
            const otherZodiac = getZodiacFromDayPillar(otherPillarsFull?.day?.hangul ?? "");
            return (
            <div className="space-y-4">

              {/* ── A. 종합 요약 (result.finalType → palette 단일 출처) ── */}
              <div
                className="rounded-2xl border-2 p-5"
                style={{ background: palette.cardBg, borderColor: palette.border }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <ScoreArc score={result.score} accentColor={palette.strong} />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="inline-flex items-center font-bold text-[15px] px-3 py-1 rounded-full border"
                        style={{
                          background: palette.pastel,
                          borderColor: palette.border,
                          color: palette.badgeText,
                        }}
                      >
                        {result.finalType}
                      </span>
                      <button
                        onClick={() => setShowInfoSheet(true)}
                        className="w-5 h-5 rounded-full border border-muted-foreground/40 text-muted-foreground text-[11px] font-bold leading-none flex items-center justify-center hover:bg-muted/60 transition-colors shrink-0"
                        aria-label="점수 계산 기준 보기"
                      >
                        i
                      </button>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
                      {fullReport.toneDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 시주 제외 비교 점수 카드 ── */}
              {hasHourExcluded && resultBase && result && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3 space-y-2">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">시주 포함/제외 점수 비교</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center rounded-lg border border-border bg-card py-2">
                      <p className="text-[11px] text-muted-foreground mb-0.5">시주 포함</p>
                      <p className="text-xl font-bold text-foreground">{resultBase.score}점</p>
                      <p className="text-[11px] text-muted-foreground">{resultBase.finalType}</p>
                    </div>
                    <div className="text-center shrink-0">
                      {result.score !== resultBase.score ? (
                        <span className={`text-lg font-bold ${result.score > resultBase.score ? "text-emerald-600" : "text-rose-500"}`}>
                          {result.score > resultBase.score ? `+${result.score - resultBase.score}` : result.score - resultBase.score}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">변화없음</span>
                      )}
                    </div>
                    <div className="flex-1 text-center rounded-lg border border-violet-300 bg-violet-50 py-2">
                      <p className="text-[11px] text-muted-foreground mb-0.5">
                        {hourModeA === "제외" && hourModeB === "제외" ? "시주 모두 제외" : hourModeA === "제외" ? `${p1?.birthInput.name || "A"} 시주 제외` : `${p2?.birthInput.name || "B"} 시주 제외`}
                      </p>
                      <p className="text-xl font-bold text-violet-700">{result.score}점</p>
                      <p className="text-[11px] text-muted-foreground">{result.finalType}</p>
                    </div>
                  </div>
                  {result.finalType !== resultBase.finalType && (
                    <p className="text-[12px] text-violet-700">
                      시주 포함 시 <span className="font-bold">{resultBase.finalType}</span>에서 <span className="font-bold">{result.finalType}</span>으로 변합니다.
                    </p>
                  )}
                </div>
              )}

              <CopyButton
                buildText={() => buildCompatibilityClipboardText(p1!, p2!, result)}
                label="궁합 분석 전체 복사"
              />

              {/* ── DEV: 점수 디버그 ── */}
              {import.meta.env.DEV && (() => {
                const s = result.score;
                const baseType = s >= 85 ? "이상적 궁합" : s >= 70 ? "좋은 궁합" : s >= 55 ? "노력형 궁합" : s >= 40 ? "긴장형 궁합" : "주의 궁합";
                const adj: string[] = [];
                if (fullReport.structural.dayMasterSupportive)  adj.push("일간상생 −1");
                if (fullReport.structural.spousePalaceClash)    adj.push("배우자궁충 +1");
                if (fullReport.structural.branchClashCount >= 2) adj.push(`지지충${fullReport.structural.branchClashCount}개 +1`);
                if (fullReport.structural.monthBranchClash)     adj.push("월지충 +1");
                return (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-[11px] font-mono text-yellow-800">
                    [DEV] 기본점수 {s}점 ({baseType}) → 조정: [{adj.join(", ") || "없음"}] → 최종: {fullReport.tone}
                  </div>
                );
              })()}

              {/* ── B. 핵심 포인트 3가지 (항상 표시) ── */}
              <div className="grid grid-cols-3 gap-2">
                {/* 일간 관계 */}
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1.5">일간 관계</p>
                  <p className="text-[13px] font-bold text-foreground leading-tight">{fullReport.stemRel.label}</p>
                  {fullReport.stemRel.me2other && (
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block ${getTenGodTw(fullReport.stemRel.me2other, myDayStem2)}`} style={getTenGodChipStyle(fullReport.stemRel.me2other, myDayStem2)}>
                      {fullReport.stemRel.me2other}
                    </span>
                  )}
                </div>
                {/* 배우자궁 */}
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1.5">배우자궁</p>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-base font-bold" style={getBranchColor(fullReport.branchComp.myBranch)}>{fullReport.branchComp.myBranch}</span>
                    <span className="text-muted-foreground text-sm">↔</span>
                    <span className="text-base font-bold" style={getBranchColor(fullReport.branchComp.otherBranch)}>{fullReport.branchComp.otherBranch}</span>
                  </div>
                  <p className={`text-[11px] font-semibold ${REL_TONE_COLOR[fullReport.branchComp.tone] ?? "text-foreground"}`}>
                    {fullReport.branchComp.tone}
                  </p>
                </div>
                {/* 연애 스타일 */}
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1.5">스타일</p>
                  <p className="text-[11px] font-bold text-foreground leading-tight">{fullReport.styleComp.person1Style}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{fullReport.styleComp.person2Style}</p>
                </div>
              </div>

              {/* ── E. 현재 관계 흐름 (동적 궁합) ── */}
              {flowA && flowB && combinedFlow && (
                <AccSection
                  title="현재 관계 흐름"
                  icon={<Waves className="h-3.5 w-3.5 text-sky-500" />}
                  defaultOpen={true}
                >
                  {/* 개인 흐름 — 2열 */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { flow: flowA, gender: myGender },
                      { flow: flowB, gender: otherGender },
                    ] as const).map(({ flow, gender }) => (
                      <div key={flow.name} className="rounded-xl border border-border bg-card p-3 space-y-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-bold text-foreground inline-flex items-center gap-0.5">
                            <GenderSymbol gender={gender} />{flow.name}
                          </span>
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${OPEN_BADGE[flow.flowOpenness]}`}>
                            {flow.flowLabel}
                          </span>
                        </div>
                        {flow.daywoon && (
                          <FlowRow label="대운" gz={flow.daywoon.ganZhi} tg={flow.daywoonTenGod} />
                        )}
                        <FlowRow label="세운" gz={flow.sewoon} tg={flow.sewoonTenGod} />
                        <FlowRow label="월운" gz={flow.wolwoon} tg={flow.wolwoonTenGod} />
                        <FlowRow label="일운" gz={flow.ilwoon} tg={flow.ilwoonTenGod} />
                      </div>
                    ))}
                  </div>

                  {/* 개인 해석 */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { flow: flowA, gender: myGender },
                      { flow: flowB, gender: otherGender },
                    ] as const).map(({ flow, gender }) => (
                      <div key={flow.name} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                        <p className="text-[12px] font-bold text-foreground inline-flex items-center gap-0.5">
                          <GenderSymbol gender={gender} />{flow.name}의 현재 흐름
                        </p>
                        <div className="space-y-1.5">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">감정</p>
                            <p className="text-[12px] text-foreground leading-snug">{flow.emotionalTendency}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">관계</p>
                            <p className="text-[12px] text-foreground leading-snug">{flow.relationshipTendency}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">소통</p>
                            <p className="text-[12px] text-foreground leading-snug">{flow.communicationTendency}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 결합 흐름 */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold text-foreground">둘의 현재 결합 흐름</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ALIGN_BADGE[combinedFlow.alignmentType]}`}>
                        {combinedFlow.alignmentType}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">{combinedFlow.alignmentDesc}</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{combinedFlow.staticModifier}</p>
                  </div>

                  {/* 오늘의 관계 흐름 */}
                  <div className={`rounded-xl border p-3 ${TODAY_CARD_COLORS[combinedFlow.todayLevel]}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">오늘의 관계 흐름</p>
                    <p className={`text-[14px] font-semibold leading-snug ${TODAY_TEXT_COLORS[combinedFlow.todayLevel]}`}>
                      {combinedFlow.todaySummary}
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                    ※ 운 흐름은 규칙 기반 간략 추정으로, 절대적 예언이 아닙니다.
                  </p>
                </AccSection>
              )}

              {/* ── B2. 배우자궁·관성 레이어 (접기/참고 지표) ── */}
              <AccSection
                title="배우자 성향 · 관계운 레이어"
                icon={<Heart className="h-3.5 w-3.5 text-violet-500" />}
                defaultOpen={false}
              >
                <p className="text-[12px] text-muted-foreground leading-relaxed -mt-1">
                  궁합 점수와 <span className="font-semibold text-foreground">별개</span>로, 각자의 원국이 담고 있는 배우자 성향과 관계운 흐름을 보여줍니다.
                </p>

                {/* ① 원국 배우자 성향 */}
                <div>
                  <p className="text-[11px] font-bold text-violet-500 uppercase tracking-widest mb-2">① 원국 배우자 성향</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: myName, gender: myGender, branch: myDayBranch2, palace: mySpousePalace },
                      { name: otherName, gender: otherGender, branch: otherDayBranch2, palace: otherSpousePalace },
                    ].map(({ name, gender, branch, palace }) => (
                      <div key={name} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[12px] font-semibold text-muted-foreground inline-flex items-center gap-0.5">
                            <GenderSymbol gender={gender} />{name}
                          </span>
                          {branch && (
                            <span
                              className="text-sm font-bold bg-muted px-1.5 py-0.5 rounded"
                              style={getBranchColor(branch)}
                            >
                              {branch}
                            </span>
                          )}
                        </div>
                        {palace ? (
                          <>
                            <p className="text-[12px] font-bold text-foreground leading-snug mb-1">
                              {palace.title.split("—")[1]?.trim() ?? palace.element}
                            </p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">{palace.summary}</p>
                          </>
                        ) : (
                          <p className="text-[12px] text-muted-foreground">정보 없음</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ② 결혼 적합 시기 힌트 */}
                {(myMarriageTiming || otherMarriageTiming) && (
                  <div>
                    <p className="text-[11px] font-bold text-violet-500 uppercase tracking-widest mb-2">② 결혼 적합 시기 힌트</p>
                    <div className="space-y-2">
                      {[
                        { name: myName, gender: myGender, timing: myMarriageTiming },
                        { name: otherName, gender: otherGender, timing: otherMarriageTiming },
                      ]
                        .filter(({ timing }) => timing)
                        .map(({ name, gender, timing }) => (
                          <div key={name} className="rounded-lg bg-muted/20 border border-border px-3 py-2.5">
                            <p className="text-[12px] font-semibold text-foreground mb-1 inline-flex items-center gap-0.5">
                              <GenderSymbol gender={gender} />{name}
                            </p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">{timing!.daewoonHint}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">{timing!.general}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-2.5">
                  * 궁합은 운명이 아닙니다. 두 원국 구조가 어떻게 상호작용하는 경향이 있는지를 보여주는 참고 정보입니다.
                </p>
              </AccSection>

              {/* ── F. 상세 분석 (접기) ── */}
              <AccSection
                title="상세 분석"
                icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
              >
                {/* 양쪽 사주 요약 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">사주 비교</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { record: p1!, label: myName, gender: myGender },
                      { record: p2!, label: otherName, gender: otherGender },
                    ].map(({ record, label, gender }) => {
                      const p = getFinalPillars(record);
                      return (
                        <div key={label} className="rounded-xl border border-border bg-card p-2.5">
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

                {/* 일간 관계 상세 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">일간 관계 상세</p>
                  <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5 mb-2">
                    <p className="text-[13px] font-semibold text-muted-foreground mb-1">{fullReport.stemRel.label}</p>
                    <p className="text-sm">{fullReport.stemRel.desc}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        from: myName, to: otherName,
                        tg: fullReport.stemRel.me2other,
                        tgDayStem: myDayStem2,
                        desc: fullReport.stemRel.me2otherDesc,
                        sectionTitle: `${myName}${ptcl(myName, "이", "가")} 느끼는 ${otherName}`,
                        bodyLabel: `${myName}에게 ${otherName}${ptcl(otherName, "은", "는")}`,
                      },
                      {
                        from: otherName, to: myName,
                        tg: fullReport.stemRel.other2me,
                        tgDayStem: otherDayStem2,
                        desc: fullReport.stemRel.other2meDesc,
                        sectionTitle: `${otherName}${ptcl(otherName, "이", "가")} 느끼는 ${myName}`,
                        bodyLabel: `${otherName}에게 ${myName}${ptcl(myName, "은", "는")}`,
                      },
                    ].map(({ from, tg, tgDayStem, desc, sectionTitle, bodyLabel }) => (
                      <div key={from} className="rounded-lg border border-border bg-muted/10 p-2.5">
                        <p className="text-[12px] font-bold text-foreground mb-2 leading-tight">{sectionTitle}</p>
                        {tg ? (
                          <>
                            <p className="text-[12px] text-muted-foreground mb-1.5">{bodyLabel}</p>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getTenGodTw(tg, tgDayStem ?? "")}`} style={getTenGodChipStyle(tg, tgDayStem ?? "")}>{tg}</span>
                              <span className="text-[12px] text-muted-foreground">관계로 느껴집니다</span>
                            </div>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
                          </>
                        ) : <span className="text-[13px] text-muted-foreground">해당 없음</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 배우자궁 비교 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">배우자궁 비교</p>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 text-center rounded-lg border p-2.5" style={getElCardStyle(charToElement(fullReport.branchComp.myBranch))}>
                      <p className="text-[13px] text-muted-foreground mb-1 inline-flex items-center gap-0.5 justify-center w-full">
                        <GenderSymbol gender={myGender} />{myName} 일지
                      </p>
                      <span className="text-2xl font-bold" style={getBranchColor(fullReport.branchComp.myBranch)}>{fullReport.branchComp.myBranch}</span>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-tight">{fullReport.branchComp.myPalaceTitle.split("—")[0]}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-muted-foreground text-lg">↔</span>
                      {fullReport.branchComp.relations.length > 0 ? (
                        <div className="flex flex-col gap-0.5 mt-1">
                          {fullReport.branchComp.relations.map((r, i) => (
                            <span key={i} className="text-[13px] font-bold bg-muted px-1.5 py-0.5 rounded">{r}</span>
                          ))}
                        </div>
                      ) : <p className="text-[13px] text-muted-foreground mt-1">무관계</p>}
                    </div>
                    <div className="flex-1 text-center rounded-lg border p-2.5" style={getElCardStyle(charToElement(fullReport.branchComp.otherBranch))}>
                      <p className="text-[13px] text-muted-foreground mb-1 inline-flex items-center gap-0.5 justify-center w-full">
                        <GenderSymbol gender={otherGender} />{otherName} 일지
                      </p>
                      <span className="text-2xl font-bold" style={getBranchColor(fullReport.branchComp.otherBranch)}>{fullReport.branchComp.otherBranch}</span>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-tight">{fullReport.branchComp.otherPalaceTitle.split("—")[0]}</p>
                    </div>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 flex items-center gap-2`}>
                    <span className={`text-[13px] font-semibold shrink-0 ${REL_TONE_COLOR[fullReport.branchComp.tone] ?? "text-foreground"}`}>
                      {fullReport.branchComp.tone}
                    </span>
                    <p className="text-sm">{fullReport.branchComp.desc}</p>
                  </div>
                  <div className="rounded-lg bg-muted/20 border border-border px-3 py-2 mt-2">
                    <p className="text-[13px] font-semibold text-muted-foreground mb-1">관계 안정도</p>
                    <p className="text-sm">{fullReport.branchComp.stability}</p>
                  </div>
                </div>

                {/* 천간 관계 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">천간 관계</p>
                  <p className="text-sm mb-2">{fullReport.stemHarmony.overallDesc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fullReport.stemHarmony.combines.map((c, i) => (
                      <span key={i} className="text-[13px] bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                        합 {c}
                      </span>
                    ))}
                    {fullReport.stemHarmony.clashes.map((c, i) => (
                      <span key={i} className="text-[13px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                        충 {c}
                      </span>
                    ))}
                    {fullReport.stemHarmony.combines.length === 0 && fullReport.stemHarmony.clashes.length === 0 && (
                      <p className="text-[13px] text-muted-foreground">특별한 천간 합충 관계가 없습니다</p>
                    )}
                  </div>
                </div>

                {/* 지지 관계 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">지지 관계</p>
                  <p className="text-sm mb-2">{fullReport.crossBranch.overallDesc}</p>
                  <div className="space-y-1.5">
                    {fullReport.crossBranch.positive.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px] bg-green-50 rounded px-2 py-1.5">
                        <CheckCircle className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                        <span>{item.desc}</span>
                      </div>
                    ))}
                    {fullReport.crossBranch.negative.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px] bg-orange-50 rounded px-2 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                        <span>{item.desc}</span>
                      </div>
                    ))}
                    {fullReport.crossBranch.positive.length === 0 && fullReport.crossBranch.negative.length === 0 && (
                      <p className="text-[13px] text-muted-foreground">두 차트 사이에 특별한 지지 관계가 없습니다</p>
                    )}
                  </div>
                </div>

                {/* 관계 에너지 구조 비교 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">관계 에너지 구조 비교</p>
                  <ElementMirror
                    name1={myName} el1={result.elementBalance.person1} dayStem1={myDayStem2}
                    name2={otherName} el2={result.elementBalance.person2}
                  />
                  <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5 mt-2">
                    <p className="text-sm">{fullReport.elementComp.desc}</p>
                  </div>
                </div>

                {/* 연애 스타일 */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">연애 스타일</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2.5 text-center">
                      <p className="text-[13px] text-muted-foreground inline-flex items-center gap-0.5 justify-center w-full">
                        <GenderSymbol gender={myGender} />{myName}
                      </p>
                      <p className="text-sm font-bold text-foreground mt-1">{fullReport.styleComp.person1Style}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2.5 text-center">
                      <p className="text-[13px] text-muted-foreground inline-flex items-center gap-0.5 justify-center w-full">
                        <GenderSymbol gender={otherGender} />{otherName}
                      </p>
                      <p className="text-sm font-bold text-foreground mt-1">{fullReport.styleComp.person2Style}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5">
                    <p className="text-sm">{fullReport.styleComp.dynamicsDesc}</p>
                  </div>
                </div>

                {/* 결혼 관점 */}
                <div className="rounded-lg border border-violet-100 bg-violet-50/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] text-muted-foreground">관계 유형</span>
                    <span className={`text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-violet-100 ${fullReport.marriageView.typeColor}`}>
                      {fullReport.marriageView.type}
                    </span>
                  </div>
                  <p className="text-sm">{fullReport.marriageView.desc}</p>
                </div>

                {/* 세부 분석 */}
                {result.details.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">세부 분석</p>
                    {result.details.map((d, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg p-2.5 ${d.isPositive ? "bg-green-50 border border-green-100" : "bg-orange-50 border border-orange-100"}`}>
                        {d.isPositive
                          ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          : <XCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold">{d.title}</p>
                          <p className="text-[13px] text-muted-foreground mt-0.5">{d.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccSection>

              {/* ── C. 잘 맞는 점 / 주의할 점 ── */}
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">잘 맞는 점</p>
                  {fullReport.harmonyPoints.slice(0, 3).map((item, i) => (
                    <BulletRow key={i} text={item} positive />
                  ))}
                </div>
                <div className="space-y-1.5 mt-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-0.5">주의할 점</p>
                  {fullReport.conflictPoints.slice(0, 3).map((item, i) => (
                    <BulletRow key={i} text={item} positive={false} />
                  ))}
                </div>
              </div>

              {/* ── D. 관계 유지 팁 ── */}
              {fullReport.tips.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-[13px] font-semibold text-foreground">관계 유지 팁</p>
                  </div>
                  <ul className="space-y-1.5">
                    {fullReport.tips.slice(0, 3).map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                        <span className="shrink-0 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
            className="w-full bg-background rounded-t-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
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
                    { cond: "일간 상생 + 배우자궁 긍정", delta: "1단계 상향", color: "text-green-700" },
                    { cond: "배우자궁 충",               delta: "1단계 하향", color: "text-red-600" },
                    { cond: "배우자궁 복합 긴장 (≥2)",   delta: "1단계 하향", color: "text-red-600" },
                    { cond: "지지 충 2개 이상",           delta: "1단계 하향", color: "text-red-600" },
                    { cond: "월지 충",                   delta: "1단계 하향", color: "text-red-600" },
                  ].map(({ cond, delta, color }) => (
                    <div key={cond} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0">
                      <span className="text-muted-foreground flex-1">{cond}</span>
                      <span className={`font-semibold shrink-0 ${color}`}>{delta}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">조정은 최대 ±2단계까지 적용됩니다.</p>
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

                  {/* 기준 합산 점수 (base_score = 50 + 조정 합계) */}
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
