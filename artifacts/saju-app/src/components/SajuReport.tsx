import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * 상세 표시 규칙 (동종 콘텐츠는 동일 경로 유지)
 * - 짧은 설명: 인라인 상세 카드 (`ds-inline-detail` + `ds-inline-detail-body` = `p-4`, 헤더 `px-4 py-3`)
 * - 중간 길이: 카드 내 `ds-inline-detail-nested` 또는 섹션 하단 패널
 * - 긴 설명: `InfoBottomSheet` (`setInfoSheet`)
 *
 * 태그 컬러 단일 출처: 신살 `SHINSAL_COLOR`, 십성 `getTenGodChipStyle`+`getTenGodTw`, 오행 `element*Class`/`elementColorVar`,
 * 관계(지지) `RELATION_COLORS` — 동일 의미 태그는 다른 페이지에서도 이 토큰만 사용.
 */
import type { ComputedPillars, FiveElementCount } from "@/lib/sajuEngine";
import { countFiveElements, calculateProfileFromBirth } from "@/lib/sajuEngine";
import type { DaewoonSuOpts } from "@/lib/luckCycles";
import {
  countFiveElementsNoHour,
  diffFiveElements,
  diffShinsal,
  hasAnyHourDiff,
} from "@/lib/hourPillarDiff";
import type { FiveElDiffEntry, ShinsalDiff } from "@/lib/hourPillarDiff";
import {
  buildInterpretSchema,
  computePrimaryElement,
  STRENGTH_LEVELS,
  STRENGTH_DISPLAY_LABEL,
  STRENGTH_SHORT_DESC,
  ELEMENT_KO,
  type StrengthLevel,
  type StrengthResult,
} from "@/lib/interpretSchema";
import type { PersonRecord, ManualShinsalItem, MaritalStatus, ManualBranchRelation, ManualDerived, ManualTenGodCounts, FortuneOptions } from "@/lib/storage";
import type { SajuProfile } from "@/lib/sajuEngine";
import { getFinalPillars, getMyProfile, getPeople, saveManualShinsal, saveExcludedAutoShinsal, saveMaritalStatus, updatePersonRecord } from "@/lib/storage";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { useAuth } from "@/lib/authContext";
import { computeSajuPipeline } from "@/lib/sajuPipeline";
import {
  charToElement,
  elementBgClass,
  elementBorderClass,
  elementChipColors,
  elementColorVar,
  elementHslAlpha,
  elementTextClass,
  getTenGodGroup,
  type ElementTone,
  type FiveElKey,
} from "@/lib/element-color";
import { CopyButton } from "@/components/CopyButton";
import { buildPersonClipboardText } from "@/lib/clipboardExport";
import { ShinsalCombinationsCard } from "@/components/ShinsalInterpretationSection";
import { TodayFortuneCard } from "@/components/TodayFortuneCard";
import {
  buildShinsalCombinationNotes,
  buildShinsalInterpretationList,
  formatTodayShinsalOneLine,
  type ShinsalInterpretationEntry,
} from "@/lib/shinsalInterpretation";
import { getFortuneForDate } from "@/lib/todayFortune";
import { buildLifeFlowInsights } from "@/lib/lifeFlowInsight";
import {
  getTenGod,
  getTenGodChipStyle,
  getTenGodElement,
  getTenGodTw,
  TEN_GOD_KEYWORDS, TEN_GOD_TOOLTIP, TEN_GOD_ELEMENT,
  tenGodCountsToFiveElements, autoCountTenGods,
  ALL_TEN_GOD_NAMES, TEN_GOD_GROUPS,
  type TenGod,
} from "@/lib/tenGods";
import { getHiddenStems, HIDDEN_STEMS_HANJA } from "@/lib/hiddenStems";
import {
  InfoBottomSheet,
  TG_LUCK_MEANING,
  TG_NATAL_MEANING,
  TEN_GOD_GROUP_DETAILS,
  getTenGodGroupPctContext,
} from "@/components/InfoBottomSheet";
import type { InfoSheetType } from "@/components/InfoBottomSheet";
import {
  analyzeBranchRelations,
  RELATION_COLORS,
  RELATION_DESC,
  RELATION_DETAIL,
  type BranchRelation,
} from "@/lib/branchRelations";
import {
  getTwelveStage,
  TWELVE_STAGE_COLOR,
  TWELVE_STAGE_DESC,
} from "@/lib/twelveStages";
import {
  calculateLuckCycles,
  calculateShinsalFull,
  getDayGanZhi,
  getMonthGanZhi,
  getYearGanZhi,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  determineGukguk,
  detectStructurePatterns,
  STRUCTURE_TYPE_COLOR,
  BRANCH_HANJA,
} from "@/lib/gukguk";
import {
  getSpousePalaceInfo,
  getComplementaryInfo,
  getMarriageTimingHint,
  getRelationshipPattern,
} from "@/lib/relationshipReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  TrendingUp,
  Calendar,
  Star,
  Heart,
  Zap,
  Sparkles,
  Layers,
  CheckCircle2,
  ChevronDown,
  User,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  titleExtra,
  children,
  id,
}: {
  title: string;
  defaultOpen?: boolean;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
  /** 스크롤 앵커(핵심 한눈에 보기 등) */
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="scroll-mt-4 border-t border-border/40 pt-1">
      <div className="flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between py-3 group min-w-0"
        >
          <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
            {title}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ml-2 shrink-0 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {titleExtra && (
          <div className="pl-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {titleExtra}
          </div>
        )}
      </div>
      <div className={`space-y-4 pb-2 ${open ? "" : "hidden"}`}>{children}</div>
    </div>
  );
}


// ── PillarTable ────────────────────────────────────────────────────

type ShinsalTagRef = { id: string; name: string };

function ShinsalChip({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-left text-[13px] font-bold",
        SHINSAL_COLOR[name] ?? "border-border bg-muted text-foreground",
      )}
    >
      {name}
    </span>
  );
}

function ShinsalTagStrip({
  tags,
  selectedId,
  onSelect,
}: {
  tags: ShinsalTagRef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!tags.length) return null;
  return (
    <div className="mt-1 w-full min-w-0 px-0.5">
      <div className="flex flex-wrap justify-center gap-0.5">
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "max-w-full rounded border border-transparent px-1 py-px text-center text-[9px] font-bold leading-tight shadow-none transition-opacity active:scale-[0.98] break-words whitespace-normal",
              SHINSAL_COLOR[t.name] ?? "border-border bg-muted/50 text-foreground",
              selectedId === t.id && "border border-primary bg-primary/[0.06]",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectedShinsalInlineCard({
  entry,
  onClose,
  onMore,
  layout = "card",
}: {
  entry: ShinsalInterpretationEntry;
  onClose: () => void;
  onMore: () => void;
  /** panel: 원국표 아래 단일 패널(이중 카드 없음) */
  layout?: "card" | "panel";
}) {
  const body = (
    <>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">기준</p>
        <p className="text-[13px] font-semibold text-foreground">{entry.basisLabel}</p>
        {entry.triggerDetail ? (
          <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">{entry.triggerDetail}</p>
        ) : null}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">영향 영역</p>
        <p className="text-[13px] text-foreground">{entry.influenceDomain}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">활성 상태</p>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {entry.activationStates.map((s) => (
            <span key={s} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground/90">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="ds-inline-detail-nested">
        <p className="mb-0.5 text-[10px] font-bold text-muted-foreground">한 줄 해석</p>
        <p className="break-words text-[13px] leading-relaxed text-foreground">{entry.oneLine}</p>
      </div>
      <button
        type="button"
        onClick={onMore}
        className="text-[12px] font-semibold text-primary underline-offset-2 hover:underline"
      >
        긴 해석 더보기
      </button>
    </>
  );

  if (layout === "panel") {
    return (
      <div className="ds-inline-detail mt-3 px-0 py-0 space-y-0 overflow-visible">
        <div className="ds-inline-detail-header !px-3">
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-left text-[13px] font-bold",
                SHINSAL_COLOR[entry.name] ?? "border-border bg-muted text-foreground",
              )}
            >
              {entry.name}
            </span>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              발동 위치: <span className="font-semibold text-foreground">{entry.pillar}</span> · {entry.anchor}
            </p>
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
        <div className="ds-inline-detail-body space-y-2.5">{body}</div>
      </div>
    );
  }

  return (
    <div className="ds-inline-detail mt-3 overflow-visible">
      <div className="ds-inline-detail-header">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "ds-badge inline-block max-w-full whitespace-normal break-words text-left text-[13px] font-bold shadow-none",
              SHINSAL_COLOR[entry.name] ?? "bg-muted text-foreground",
            )}
          >
            {entry.name}
          </span>
          <p className="mt-1 text-[11px] text-muted-foreground">
            발동 위치:{" "}
            <span className="font-semibold text-foreground">{entry.pillar}</span>
            {" · "}
            {entry.anchor}
          </p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body">{body}</div>
    </div>
  );
}

function TenGodGroupInlineCard({
  group,
  pct,
  dayStem,
  onClose,
  onMore,
}: {
  group: string;
  pct: number;
  dayStem: string;
  onClose: () => void;
  onMore: () => void;
}) {
  const detail = TEN_GOD_GROUP_DETAILS.find((g) => g.group === group);
  if (!detail) return null;
  const chipEl = getTenGodGroupElementForDayStem(group, dayStem) ?? ("토" as FiveElKey);
  const pctContext = getTenGodGroupPctContext(group, pct);
  return (
    <div className="ds-inline-detail mt-0 overflow-visible">
      <div className="ds-inline-detail-header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="ds-badge text-[12px] font-bold shadow-none"
              style={{
                backgroundColor: elementHslAlpha(chipEl, "strong", 0.16),
                borderColor: elementHslAlpha(chipEl, "strong", 0.32),
                color: elementColorVar(chipEl, "strong"),
              }}
            >
              {group}
            </span>
            <span className="text-[12px] font-semibold text-muted-foreground">{pct}%</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">행동 스타일·기질 해석</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body">
        <p className="text-[13px] font-semibold text-foreground">{detail.title}</p>
        <p className="break-words text-[13px] leading-relaxed text-foreground/90">{detail.meaning}</p>
        <div className="ds-inline-detail-nested">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">내 사주 비중 맥락</p>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-foreground">{pctContext}</p>
        </div>
        <div className="ds-inline-detail-nested">
          <p className="text-[10px] font-bold text-muted-foreground">차트 해석 포인트</p>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-foreground">{detail.chartPoint}</p>
        </div>
        <button type="button" onClick={onMore} className="text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          관계·직업·감정 측면 더보기
        </button>
      </div>
    </div>
  );
}

function BranchRelationInlineCard({
  relation,
  onClose,
  onMore,
}: {
  relation: BranchRelation;
  onClose: () => void;
  onMore: () => void;
}) {
  const detail = RELATION_DETAIL[relation.type];
  const shortDesc = RELATION_DESC[relation.type] ?? "";
  return (
    <div className="ds-inline-detail mt-0 overflow-visible">
      <div className="ds-inline-detail-header">
        <div className="min-w-0 flex-1">
          <span className={cn("ds-badge text-[12px] font-bold shadow-none", RELATION_COLORS[relation.type])}>{relation.type}</span>
          <p className="mt-1 break-words text-[13px] font-medium text-foreground">{relation.description}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body">
        <p className="break-words text-[13px] leading-relaxed text-muted-foreground">{shortDesc}</p>
        {detail ? (
          <>
            <div className="ds-inline-detail-nested">
              <p className="text-[10px] font-bold text-muted-foreground">기본 의미</p>
              <p className="mt-1 break-words text-[13px] leading-relaxed text-foreground">{detail.meaning}</p>
            </div>
            <div className="ds-inline-detail-nested">
              <p className="text-[10px] font-bold text-muted-foreground">해석 관점</p>
              <p className="mt-1 break-words text-[13px] leading-relaxed text-foreground">{detail.interpretation}</p>
            </div>
          </>
        ) : null}
        <button type="button" onClick={onMore} className="text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          도메인·주의점 더보기
        </button>
      </div>
    </div>
  );
}

function HiddenStemInlineCard({
  pillarLabel,
  branch,
  stems,
  onClose,
}: {
  pillarLabel: string;
  branch: string;
  stems: string[];
  onClose: () => void;
}) {
  return (
    <div className="ds-inline-detail mt-0 overflow-visible">
      <div className="ds-inline-detail-header">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">지장간</p>
          <p className="text-[14px] font-bold text-foreground">
            {pillarLabel} · {branch}
          </p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body space-y-3">
        <p className="break-words text-[13px] leading-relaxed text-foreground/90">
          지장간(地藏干)은 지지 안에 숨은 천간으로, 겉으로 드러난 지지 한 글자만으로는 보이지 않는 오행층입니다. 통근·성격 배경·내면 기운을 읽을 때 참고합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {stems.map((s) => {
            const el = STEM_ELEMENT[s] as FiveElKey | undefined;
            return (
              <span
                key={s}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[13px] font-bold",
                  el ? cn(elementBgClass(el, "muted"), elementTextClass(el, "strong"), elementBorderClass(el, "muted")) : "border-border bg-muted",
                )}
              >
                {s}
                {el ? <span className="ml-1 text-[11px] font-semibold opacity-80">({el})</span> : null}
              </span>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          여기·중기·본기 순으로 저장된 간을 원국표 순서대로 나열했습니다.
        </p>
      </div>
    </div>
  );
}

function TwelveStageInlineCard({
  label,
  branch,
  stage,
  onClose,
}: {
  label: string;
  branch: string;
  stage: string;
  onClose: () => void;
}) {
  const desc = TWELVE_STAGE_DESC[stage as keyof typeof TWELVE_STAGE_DESC] ?? "";
  const color = TWELVE_STAGE_COLOR[stage as keyof typeof TWELVE_STAGE_COLOR] ?? "";
  return (
    <div className="ds-inline-detail mt-0 overflow-visible">
      <div className="ds-inline-detail-header">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">12운성</p>
          <p className="text-[14px] font-bold text-foreground">
            {label} · {branch} <span className="text-muted-foreground">·</span> <span className={cn("inline-block rounded px-1.5 py-0.5", color)}>{stage}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="ds-inline-detail-body">
        <p className="break-words text-[13px] leading-relaxed text-foreground/90">{desc}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">일간 기준 각 지지에서의 기운 성장 단계를 나타냅니다.</p>
      </div>
    </div>
  );
}

function TenGodNatalInlineBlock({
  dayStem,
  tg,
  displayCounts,
  onClose,
  onMore,
}: {
  dayStem: string;
  tg: TenGod;
  displayCounts: ManualTenGodCounts;
  onClose: () => void;
  onMore: () => void;
}) {
  const nm = TG_NATAL_MEANING[tg];
  if (!nm) return null;
  const allTgTotal = Object.values(displayCounts).reduce((s, c) => s + c, 0) || 1;
  const cnt = displayCounts[tg] ?? 0;
  const pct = Math.round((cnt / allTgTotal) * 100);
  const pctLabel = pct === 0 ? "없음(0%)" : pct <= 10 ? `매우 약함(${pct}%)` : pct <= 25 ? `적당함(${pct}%)` : pct <= 50 ? `강함(${pct}%)` : `매우 강함(${pct}%)`;
  const pctContext =
    pct === 0
      ? `현재 사주에 ${tg}이(가) 없습니다. 이 기운의 본성적 특질이 약하게 나타나며, 오히려 대운·세운에서 이 기운을 만났을 때 더 민감하게 반응할 수 있습니다.`
      : pct <= 10
        ? `${tg}이(가) 사주에 매우 약하게(${pct}%) 자리합니다. 주도적으로 발현되기보다 특수한 상황이나 자극이 있을 때 간헐적으로 나타납니다.`
        : pct <= 25
          ? `${tg}이(가) 사주에 적당히(${pct}%) 자리합니다. 다른 기운과 조화롭게 균형을 이루며 발현됩니다.`
          : pct <= 50
            ? `${tg}이(가) 사주에 강하게(${pct}%) 자리합니다. 성격과 삶의 흐름에 뚜렷한 영향을 미치는 핵심 기운 중 하나입니다.`
            : `${tg}이(가) 사주에서 매우 강하게(${pct}%) 작용합니다. 삶 전반에 걸쳐 가장 핵심적인 영향을 미치는 지배적 기운입니다.`;

  return (
    <div className="ds-inline-detail mt-0 overflow-visible">
      <div className="ds-inline-detail-header">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            className={cn("ds-badge text-[13px] font-bold shadow-none border-0", getTenGodTw(tg, dayStem))}
            style={getTenGodChipStyle(tg, dayStem)}
          >
            {tg}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground rounded-full border border-border/60 bg-muted/20 px-2 py-0.5">
            {pctLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[12px] text-muted-foreground px-2 py-0.5 rounded-md hover:bg-muted/50"
        >
          닫기
        </button>
      </div>
      <div className="ds-inline-detail-body">
      <div className="ds-inline-detail-nested space-y-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">원국 비중 맥락</p>
        <p className="text-[12px] leading-relaxed text-foreground break-words">{pctContext}</p>
      </div>
      {pct > 0 && (
        <>
          <p className="text-[12px] leading-relaxed break-words">{nm.summary}</p>
          {nm.traits && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">성향·특성</p>
              <p className="text-[12px] leading-relaxed break-words">{nm.traits}</p>
            </div>
          )}
          {nm.strengths && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">강점</p>
              <p className="text-[12px] leading-relaxed break-words">{nm.strengths}</p>
            </div>
          )}
          {nm.caution && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">주의점</p>
              <p className="text-[12px] leading-relaxed break-words">{nm.caution}</p>
            </div>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onMore}
        className="w-full pt-0.5 text-left text-[12px] font-semibold text-primary underline-offset-2 hover:underline"
      >
        십성 통합 해설 더보기
      </button>
      </div>
    </div>
  );
}

const TEN_GOD_OPTIONS = ["비견","겁재","식신","상관","편재","정재","편관","정관","편인","정인"] as const;
const TWELVE_STAGE_OPTIONS = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"] as const;

function PillarTable({
  pillars,
  dayStem,
  shinsalBranchItems,
  manualDerived,
  onSaveDerived,
  shinsalPerColumn,
  selectedShinsalId,
  onShinsalSelect,
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
  shinsalPerColumn?: Array<{ stem: ShinsalTagRef[]; branch: ShinsalTagRef[] }>;
  selectedShinsalId?: string | null;
  onShinsalSelect?: (id: string) => void;
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
          {editMode && (
            <>
              <button onClick={handleSave} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-primary text-primary-foreground transition-all active:scale-95">저장</button>
              <button onClick={handleCancel} className="text-[12px] font-medium px-3 py-1 rounded-lg border border-border text-muted-foreground transition-all active:scale-95">취소</button>
            </>
          )}
        </div>
      )}

      <div className="ds-card overflow-visible shadow-none">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-[44px] border-r border-border/40 bg-muted/20 px-1.5 py-2" />
              {computed.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    "border-l border-border/40 px-1 py-2 text-center text-xs font-semibold",
                    c.isDayMaster ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {c.label}{c.isDayMaster && "★"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/40">
              <td className="border-r border-border/40 bg-muted/20 px-1.5 py-2 text-center text-[10px] font-medium leading-tight text-muted-foreground">천간</td>
              {computed.map((c, i) => (
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
                  {c.isUnknown ? <span className="text-xl text-muted-foreground">?</span> : (
                    <div className="flex w-full min-w-0 flex-col items-center">
                      <span className={`text-xl font-bold leading-tight ${c.stemEl ? elementTextClass(c.stemEl, "strong") : ""}`}>
                        {c.stemChar}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{STEM_SIGN[c.stemChar] ?? ""}</span>
                      {onShinsalSelect && shinsalPerColumn?.[i] ? (
                        <ShinsalTagStrip
                          tags={[...shinsalPerColumn[i].stem]}
                          selectedId={selectedShinsalId ?? null}
                          onSelect={onShinsalSelect}
                        />
                      ) : null}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* 십성 (stem) row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">십성</td>
              {computed.map((c, i) => (
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span> : editMode ? (
                    <select value={c.effStemTG ?? ""} onChange={(e) => setDerived("stemTenGod", i, e.target.value)} className={selectStyle}>
                      <option value="">-</option>
                      {TEN_GOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.effStemTG ? (
                    <button
                      type="button"
                      onClick={() => toggle(i, "stem")}
                      className={`text-[12px] font-semibold px-1 py-0.5 rounded transition-colors ${isOpen(i, "stem") ? "bg-primary/15 text-primary border border-transparent" : getTenGodTw(c.effStemTG, dayStem)}`}
                      style={!isOpen(i, "stem") && c.effStemTG ? getTenGodChipStyle(c.effStemTG, dayStem) : undefined}
                    >
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
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
                  {c.isUnknown ? <span className="text-xl text-muted-foreground">?</span> : (
                    <div className="flex w-full min-w-0 flex-col items-center">
                      <span className={`text-xl font-bold leading-tight ${c.branchEl ? elementTextClass(c.branchEl, "strong") : ""}`}>
                        {c.branchChar}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{BRANCH_SIGN[c.branchChar] ?? ""}</span>
                      {onShinsalSelect && shinsalPerColumn?.[i] ? (
                        <ShinsalTagStrip
                          tags={[...shinsalPerColumn[i].branch]}
                          selectedId={selectedShinsalId ?? null}
                          onSelect={onShinsalSelect}
                        />
                      ) : null}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* 십성 (branch) row */}
            <tr className="border-b border-border/40">
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">십성</td>
              {computed.map((c, i) => (
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <select value={c.effBranchTG ?? ""} onChange={(e) => setDerived("branchTenGod", i, e.target.value)} className={selectStyle}>
                      <option value="">-</option>
                      {TEN_GOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.effBranchTG ? (
                    <button
                      type="button"
                      onClick={() => toggle(i, "branch")}
                      className={`text-[12px] font-semibold px-1 py-0.5 rounded transition-colors ${isOpen(i, "branch") ? "bg-primary/15 text-primary border border-transparent" : getTenGodTw(c.effBranchTG, dayStem)}`}
                      style={!isOpen(i, "branch") && c.effBranchTG ? getTenGodChipStyle(c.effBranchTG, dayStem) : undefined}
                    >
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
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
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
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
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

            {/* 12신살 row — 자리별 태그가 있으면 비편집 시 숨김(중복 제거). 편집 모드에서는 수동 입력 유지 */}
            {(!shinsalPerColumn || editMode) && (
            <tr>
              <td className="text-[10px] text-muted-foreground font-medium py-1 px-1.5 bg-muted/20 border-r border-border/40 text-center leading-tight">12신살</td>
              {computed.map((c, i) => (
                <td key={i} className={cn("border-l border-border/40 px-0.5 py-2 text-center", c.isDayMaster && "bg-primary/10")}>
                  {c.isUnknown ? <span className="text-[10px] text-muted-foreground">-</span>
                  : editMode ? (
                    <input type="text" value={c.effShinsal} onChange={(e) => setDerived("branchShinsal", i, e.target.value)} className={inputStyle} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground leading-tight block whitespace-normal break-words">{c.effShinsal || "-"}</span>
                  )}
                </td>
              ))}
            </tr>
            )}
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
                <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${getTenGodTw(tg, dayStem)}`} style={getTenGodChipStyle(tg, dayStem)}>{tg}</span>
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

/** 오행도 원 하단 채움 — 파스텔 유지하되 채도↑(회색끼 덜 나게) */
const ELEMENT_PENTAGON_FILL: Record<FiveElKey, string> = {
  수: "#9DCDF0",
  목: "#9DDFB8",
  화: "#F0A8A0",
  토: "#E8D080",
  금: "#B6C5DC",
};

/** 대표 노드 테두리·(괄호) 십성 그룹 글자 — 행동 스타일 행 범주색과 동일 */
function getTenGodGroupElementForDayStem(group: string, dayStem: string): FiveElKey | null {
  if (!dayStem) return null;
  const seed: Record<string, TenGod> = {
    비겁: "비견",
    식상: "식신",
    재성: "정재",
    관성: "정관",
    인성: "정인",
  };
  const tg = seed[group];
  return tg ? getTenGodElement(tg, dayStem) : null;
}

function FiveElementSection({
  counts,
  dayStem,
  monthBranch,
  dayBranch,
  allStems,
  allBranches,
  variant = "structure",
}: {
  counts: FiveElementCount;
  dayStem?: string;
  monthBranch?: string;
  dayBranch?: string;
  allStems?: string[];
  allBranches?: string[];
  /** 원국=구조 데이터, 성격 탭=행동·기질 해석 관점 */
  variant?: "structure" | "personality";
}) {
  // Pentagon order starting from top, clockwise: 화→토→금→수→목
  const elements: FiveElKey[] = ["화", "토", "금", "수", "목"];
  const total = elements.reduce((s, e) => s + (counts[e] ?? 0), 0) || 1;
  const dayEl = dayStem ? (STEM_ELEMENT[dayStem] as FiveElKey | undefined) : undefined;
  const primaryEl = computePrimaryElement({ counts, monthBranch, dayBranch, allStems, allBranches });

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
      <div className="self-start space-y-0.5">
        {variant === "structure" ? (
          <>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">구조 데이터</span>: 천간+지지 개수 기준 분포입니다.
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              용신 계산에는 <span className="font-semibold text-foreground">지장간 가중치</span>가 반영됩니다.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            같은 수치를 <span className="font-semibold text-foreground">성격·행동 균형</span> 관점에서 읽습니다. 자세한 수치 해석은 원국 탭을 참고하세요.
          </p>
        )}
      </div>
      <div className="flex gap-4 self-start text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-bold text-chart-5">→</span> 상생
        </span>
        <span className="flex items-center gap-1">
          <span className="font-bold text-destructive">→</span> 상극
        </span>
      </div>
      <div className="self-start flex items-center gap-2">
        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${elementBgClass(primaryEl, "muted")} ${elementBorderClass(primaryEl, "strong")}`}>
          대표 오행
        </span>
        <span className={`text-[13px] font-black ${elementTextClass(primaryEl, "strong")}`}>{primaryEl}</span>
      </div>
      {/* graph wrapper padding (common rule): py-5 = 20px top/bottom */}
      {/* NOTE: 그래프 원 크기는 바꾸지 않고, wrapper 세로 패딩만 통일합니다. */}
      <div className="w-full py-5">
        {/* Tighten viewBox Y-range to reduce empty vertical margin around the circle group */}
        <svg viewBox="0 26 296 244" preserveAspectRatio="xMidYMid meet" width="100%" className="mx-auto block w-full max-w-[444px]">
        <defs>
          <marker id="arr-gen" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="hsl(var(--chart-5))" opacity="0.8" />
          </marker>
          <marker id="arr-ctrl" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="hsl(var(--destructive))" opacity="0.8" />
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
          return d ? <path key={i} d={d} stroke="hsl(var(--chart-5))" strokeWidth="1.5" fill="none" markerEnd="url(#arr-gen)" opacity="0.7" /> : null;
        })}

        {/* 상극 arrows (red star) */}
        {controlsArrows.map(({ from, to }, i) => {
          const d = arrowD(from, to);
          return d ? <path key={i} d={d} stroke="hsl(var(--destructive))" strokeWidth="1.5" fill="none" markerEnd="url(#arr-ctrl)" opacity="0.7" /> : null;
        })}

        {/* Element nodes */}
        {nodes.map(({ el, x, y, pct, count, tenGodGroup }) => {
          const fillHRaw = 2 * NODE_R * pct;
          const fillH = count > 0 ? Math.max(fillHRaw, 4) : 0;
          const fillY = y + NODE_R - fillH;
          const isPrimary = el === primaryEl;
          /* 오행 글자 = 꼭짓점 오행 strong / 대표 테두리·괄호 십성 = 십성 그룹 범주색 strong / 비대표 괄호 = 꼭짓점 base */
          const elLabelFill = elementColorVar(el, "strong");
          const parenFill =
            isPrimary
              ? elementColorVar(el, "strong")
              : elementColorVar(el, "base");
          // Selected(primary) node must follow the element's own base/strong color (not ten-god category color)
          const stroke = isPrimary ? elementColorVar(el, "strong") : "hsl(var(--border))";
          const strokeW = 1;
          return (
            <g key={el}>
              <circle cx={x} cy={y} r={NODE_R} fill="hsl(var(--card))" />
              {fillH > 0 && (
                <rect
                  x={x - NODE_R}
                  y={fillY}
                  width={NODE_R * 2}
                  height={fillH}
                  fill={ELEMENT_PENTAGON_FILL[el]}
                  clipPath={`url(#pclip-${el})`}
                />
              )}
              {/* 대표 오행: 외곽선 1중(링 이중 제거), 오행 컬러 stroke만 */}
              <circle
                cx={x}
                cy={y}
                r={NODE_R}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeW}
              />
              <text
                x={x}
                y={y - (tenGodGroup ? 9 : 4)}
                textAnchor="middle"
                fontSize="15"
                fontWeight={isPrimary ? "800" : "600"}
                fill={elLabelFill}
              >
                {el}
              </text>
              {tenGodGroup && (
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isPrimary ? "700" : "600"}
                  fill={parenFill}
                >
                  ({tenGodGroup})
                </text>
              )}
              <text x={x} y={y + (tenGodGroup ? 18 : 11)} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">
                {count}개 {Math.round(pct * 100)}%
              </text>
            </g>
          );
        })}
        </svg>
      </div>
    </div>
  );
}

// ── Ten-God Distribution Section ──────────────────────────────────

type TenGodGroupKey = "비겁" | "식상" | "재성" | "관성" | "인성";

const TG_SUB_PAIRS: Record<string, [string, string]> = {
  비겁: ["비견", "겁재"],
  식상: ["식신", "상관"],
  재성: ["정재", "편재"],
  관성: ["정관", "편관"],
  인성: ["정인", "편인"],
};

// Returns { top_level, detailed } ten god distribution.
// Group totals come from effectiveFiveElements (updates with ohaeng edits).
// Sub-ratios (yin/yang split) come from actual character ten god counts.
function computeTenGodDistribution(
  dayStem: string,
  dayEl: FiveElKey | undefined,
  allChars: string[],
  effectiveFiveElements: FiveElementCount,
): {
  topLevel: Record<string, number>;   // group → % (0-100)
  detailed: Record<string, number>;   // ten-god → % (0-100)
  groupRaw: Record<string, number>;   // group → raw count (for tie-break)
  rawTotal: number;
} {
  const groups = ["비겁", "식상", "재성", "관성", "인성"] as const;
  const fiveElKeys: FiveElKey[] = ["목", "화", "토", "금", "수"];

  // ── Group totals from ohaeng ────────────────────────────────────
  const groupRaw: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  if (dayEl) {
    for (const el of fiveElKeys) {
      const g = getTenGodGroup(dayEl, el);
      groupRaw[g] = (groupRaw[g] ?? 0) + (effectiveFiveElements[el] ?? 0);
    }
  } else {
    // fallback: count from chars
    for (const ch of allChars) {
      const tg = getTenGod(dayStem, ch);
      if (!tg) continue;
      const g = tg === "비견" || tg === "겁재" ? "비겁"
              : tg === "식신" || tg === "상관" ? "식상"
              : tg === "편재" || tg === "정재" ? "재성"
              : tg === "편관" || tg === "정관" ? "관성"
              : "인성";
      groupRaw[g]++;
    }
  }
  const rawTotal = Object.values(groupRaw).reduce((a, b) => a + b, 0) || 1;
  const topLevel: Record<string, number> = {};
  for (const g of groups) topLevel[g] = Math.round((groupRaw[g] / rawTotal) * 100);

  // ── Sub-ratio from actual chars ─────────────────────────────────
  const detailedFromChars: Record<string, number> = {};
  for (const ch of allChars) {
    const tg = getTenGod(dayStem, ch);
    if (tg) detailedFromChars[tg] = (detailedFromChars[tg] ?? 0) + 1;
  }

  // Apply sub-ratio to group %
  const detailed: Record<string, number> = {};
  for (const g of groups) {
    const [s1, s2] = TG_SUB_PAIRS[g];
    const c1 = detailedFromChars[s1] ?? 0;
    const c2 = detailedFromChars[s2] ?? 0;
    const subTotal = c1 + c2;
    const gPct = topLevel[g];
    if (subTotal === 0) {
      detailed[s1] = Math.round(gPct / 2);
      detailed[s2] = gPct - Math.round(gPct / 2);
    } else {
      const p1 = Math.round((c1 / subTotal) * gPct);
      detailed[s1] = p1;
      detailed[s2] = gPct - p1;
    }
  }

  return { topLevel, detailed, groupRaw, rawTotal };
}

function pickDominantTenGodGroups(args: {
  groupRaw: Record<string, number>;
  rawTotal: number;
  order?: readonly ("비겁" | "식상" | "재성" | "관성" | "인성")[];
}): {
  primary: { group: "비겁" | "식상" | "재성" | "관성" | "인성"; pctExact: number; pctRounded: number; raw: number } | null;
  secondary: { group: "비겁" | "식상" | "재성" | "관성" | "인성"; pctExact: number; pctRounded: number; raw: number } | null;
} {
  const order = (args.order ?? ["비겁", "식상", "재성", "관성", "인성"]) as Array<
    "비겁" | "식상" | "재성" | "관성" | "인성"
  >;
  const items = order.map((g) => {
    const raw = args.groupRaw[g] ?? 0;
    const pctExact = (raw / (args.rawTotal || 1));
    const pctRounded = Math.round(pctExact * 100);
    return { group: g, raw, pctExact, pctRounded };
  });
  items.sort((a, b) => (b.pctExact - a.pctExact) || (b.raw - a.raw) || (order.indexOf(a.group) - order.indexOf(b.group)));
  const primary = items[0] && items[0].raw > 0 ? items[0] : null;
  const secondary = items[1] && items[1].raw > 0 ? items[1] : null;
  return { primary, secondary };
}

function TenGodDistributionSection({
  dayStem,
  dayEl,
  allChars,
  effectiveFiveElements,
  onTap,
  selectedGroup,
  selectedGroupInlineSlot,
  dominantPrimary,
  dominantSecondary,
  rowHighlightMode = "single",
  personalityUserHasTapped = false,
  monthBranch,
  dayBranch,
  allStems,
  allBranches,
}: {
  dayStem: string;
  dayEl?: FiveElKey;
  allChars: string[];
  effectiveFiveElements: FiveElementCount;
  onTap: (group: string, pct: number) => void;
  selectedGroup?: string | null;
  selectedGroupInlineSlot?: ReactNode;
  /** 상위에서 단일 source로 계산된 대표/2순위(선택) */
  dominantPrimary?: { group: "비겁" | "식상" | "재성" | "관성" | "인성"; pctExact: number; pctRounded: number; raw: number } | null;
  dominantSecondary?: { group: "비겁" | "식상" | "재성" | "관성" | "인성"; pctExact: number; pctRounded: number; raw: number } | null;
  /** single: 한 가지 강조 스타일. personality: 초기=약한 강조, 탭 후=선택 강조 */
  rowHighlightMode?: "single" | "personality";
  /** 성격 탭 전용: 사용자가 행을 한 번이라도 눌렀는지 */
  personalityUserHasTapped?: boolean;
  monthBranch?: string;
  dayBranch?: string;
  allStems?: string[];
  allBranches?: string[];
}) {
  const groups = ["비겁", "식상", "재성", "관성", "인성"] as const;
  const { topLevel, detailed, groupRaw, rawTotal } = computeTenGodDistribution(dayStem, dayEl, allChars, effectiveFiveElements);
  const computed = pickDominantTenGodGroups({ groupRaw, rawTotal });
  const primary = dominantPrimary ?? computed.primary;
  const secondary = dominantSecondary ?? computed.secondary;
  const dominantGroup = primary?.group ?? null;

  return (
    <div className="space-y-3">
      {primary && secondary && (
        <div className="ds-inline-detail-nested space-y-1.5 p-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">최종 조합 해설</p>
          <p className="text-sm text-foreground">
            대표 흐름은 <span className="font-semibold">{primary.group}</span>({primary.pctRounded}%)이고, 다음 축은{" "}
            <span className="font-semibold">{secondary.group}</span>({secondary.pctRounded}%)입니다.
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {COMBINED_FORTUNE_TEXTS[primary.group]?.[secondary.group] ?? `${primary.group}과 ${secondary.group}의 기운이 함께 작용합니다.`}
          </p>
        </div>
      )}
      <div className="space-y-3">
        {groups.map((g) => {
          const pct = topLevel[g];
          const rowEl = getTenGodGroupElementForDayStem(g, dayStem) ?? ("토" as FiveElKey);
          const [s1, s2] = TG_SUB_PAIRS[g];
          const p1 = detailed[s1] ?? 0;
          const p2 = detailed[s2] ?? 0;
          const isDominantRow = dominantGroup === g;
          const isRowSelected = selectedGroup === g;
          // 대표 배지는 정적 표시(선택 상태와 완전히 분리)
          const showDominantBadge = rowHighlightMode === "personality" && isDominantRow;

          let rowStyle: CSSProperties | undefined;
          let rowBorder = "border border-transparent";

          if (rowHighlightMode === "personality" && isRowSelected) {
            rowBorder = "border";
            if (personalityUserHasTapped) {
              rowStyle = {
                backgroundColor: elementHslAlpha(rowEl, "strong", 0.07),
                borderColor: elementColorVar(rowEl, "strong"),
              };
            } else {
              rowStyle = {
                backgroundColor: elementHslAlpha(rowEl, "strong", 0.035),
                borderColor: elementHslAlpha(rowEl, "strong", 0.35),
              };
            }
          } else if (rowHighlightMode === "single") {
            if (isRowSelected) {
              rowBorder = "border";
              rowStyle = {
                backgroundColor: elementHslAlpha(rowEl, "strong", 0.07),
                borderColor: elementColorVar(rowEl, "strong"),
              };
            } else if (isDominantRow) {
              rowBorder = "border";
              rowStyle = {
                backgroundColor: elementHslAlpha(rowEl, "strong", 0.06),
                borderColor: elementHslAlpha(rowEl, "strong", 0.22),
              };
            }
          }

          const rowClass = cn("rounded-xl px-2 py-2 transition-colors", rowBorder);

          return (
            <div key={g} className="space-y-2">
              <div className={rowClass} style={rowStyle}>
                <button
                  type="button"
                  onClick={() => onTap(g, pct)}
                  className="flex w-full min-w-0 flex-col gap-2 rounded px-1 py-0.5 text-left transition-opacity hover:opacity-90"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <span className="flex shrink-0 items-center gap-1.5">
                      {showDominantBadge ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black leading-none shadow-md"
                          style={{
                            backgroundColor: elementHslAlpha(rowEl, "strong", 0.28),
                            borderColor: elementColorVar(rowEl, "strong"),
                            color: elementColorVar(rowEl, "strong"),
                            boxShadow: `0 2px 8px ${elementHslAlpha(rowEl, "strong", 0.25)}`,
                          }}
                        >
                          <span aria-hidden className="text-sm leading-none">
                            ⭐
                          </span>
                          <span className="tracking-tight">대표</span>
                        </span>
                      ) : null}
                      <span className={cn("whitespace-nowrap text-[13px] font-bold", elementTextClass(rowEl, "strong"))}>
                        {g}
                      </span>
                    </span>
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full", elementBgClass(rowEl, "base"))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "shrink-0 ds-badge text-[13px] font-bold shadow-none",
                        elementBgClass(rowEl, "muted"),
                        elementTextClass(rowEl, "strong"),
                        elementBorderClass(rowEl, "muted"),
                      )}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "ds-badge flex items-center gap-1 text-[11px] shadow-none",
                        elementBgClass(rowEl, "muted"),
                        elementTextClass(rowEl, "strong"),
                        elementBorderClass(rowEl, "muted"),
                      )}
                    >
                      <span className="font-semibold">{s1}</span>
                      <span className="opacity-80">{p1}%</span>
                    </span>
                    <span
                      className={cn(
                        "ds-badge flex items-center gap-1 text-[11px] shadow-none",
                        elementBgClass(rowEl, "muted"),
                        elementTextClass(rowEl, "strong"),
                        elementBorderClass(rowEl, "muted"),
                      )}
                    >
                      <span className="font-semibold">{s2}</span>
                      <span className="opacity-80">{p2}%</span>
                    </span>
                  </div>
                </button>
              </div>
              {selectedGroup === g && selectedGroupInlineSlot}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Interpretation helpers ─────────────────────────────────────────

function getDayMasterSummaryFromStrength(dayStem: string, strengthLevel: StrengthLevel) {
  const el = STEM_ELEMENT[dayStem];
  const elLabel = el ? `(${el})` : "";
  if (strengthLevel === "중화") return `일간 ${dayStem}${elLabel}의 기운이 균형 잡혀 있습니다.`;
  if (strengthLevel === "신강" || strengthLevel === "태강" || strengthLevel === "극신강")
    return `일간 ${dayStem}${elLabel}의 기운이 강한 편입니다. 주도성과 추진력이 장점으로 나타납니다.`;
  return `일간 ${dayStem}${elLabel}의 기운이 약한 편입니다. 섬세함과 관계 감수성이 강점으로 나타날 수 있습니다.`;
}

function DayMasterStrengthCard({
  strength,
}: {
  strength?: {
    level: StrengthLevel;
    score: number;
    description: string;
    explanation: string[];
  } | null;
}) {
  if (!strength || !Number.isFinite(strength.score)) return null;
  const lines = strength.explanation ?? [];
  return (
    <div className="rounded-xl border px-4 py-4 bg-gradient-to-br from-sky-50/70 to-white border-sky-200 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-sky-700 tracking-wide">일간 강도</p>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">자동 계산</span>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-black tracking-tight text-foreground">{strength.level}</p>
        <p className="text-[13px] font-bold text-muted-foreground pb-1">({strength.score}점)</p>
      </div>
      {strength.description && <p className="text-[12px] text-muted-foreground">{strength.description}</p>}
      {lines.length > 0 ? (
        <ul className="text-[12px] text-foreground/80 list-disc pl-4 space-y-0.5">
          {lines.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          득령·득지·득세 조건이 뚜렷하지 않아 설명이 생성되지 않았습니다.
        </p>
      )}
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
  pipelineStrength,
  pipelineYongshinPrimary,
  pipelineYongshinSecondary,
  pipelineSeasonalNote,
  ruleInsights,
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
  /** Single source of truth from pipeline */
  pipelineStrength?: StrengthResult | null;
  pipelineYongshinPrimary?: FiveElKey | null;
  pipelineYongshinSecondary?: FiveElKey | null;
  pipelineSeasonalNote?: string | null;
  /** 규칙 기반 구조 해석 (상단 요약과 중복되지 않음) */
  ruleInsights?: string[];
  overrideStrengthLevel?: string | null;
  overrideYongshinData?: YongshinEntry[] | null;
  onStrengthLevelChange?: (lv: string | null) => void;
  onYongshinDataChange?: (data: YongshinEntry[]) => void;
}) {
  const [editMode, setEditMode] = useState<"none" | "strength" | "yongshin">("none");
  const [activeYongshinType, setActiveYongshinType] = useState<YongshinType>("억부용신");
  const [localYongshinData, setLocalYongshinData] = useState<YongshinEntry[]>(overrideYongshinData ?? []);

  const baseSchema = buildInterpretSchema(dayStem, counts, monthBranch, dayBranch, allStems, allBranches);
  const strengthLevelEffective: StrengthLevel =
    (overrideStrengthLevel as StrengthLevel | null) ??
    (pipelineStrength?.level ?? baseSchema.strengthLevel);
  const strengthDisplayLabel = STRENGTH_DISPLAY_LABEL[strengthLevelEffective] ?? strengthLevelEffective;
  const strengthDesc = STRENGTH_SHORT_DESC[strengthLevelEffective] ?? "";
  const strengthScore = pipelineStrength?.score;

  const yongshinPrimary = (pipelineYongshinPrimary ?? baseSchema.yongshin) as FiveElKey;
  const yongshinSecondary = (pipelineYongshinSecondary ?? baseSchema.yongshinSecondary) as FiveElKey | undefined;

  const hasYongshinOverride = overrideYongshinData && overrideYongshinData.length > 0;
  const canEdit = !!(onStrengthLevelChange || onYongshinDataChange);
  const insights = ruleInsights ?? [];

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
    <div className="ds-card border-amber-200 bg-gradient-to-br from-amber-50/90 to-white shadow-none">
      <div className="border-b border-amber-200/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80">해석 요약</p>
            <p className="text-[13px] font-bold text-amber-900">사주 구조 해석</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              이 카드는 문장형으로 읽는 <span className="font-semibold text-foreground">기질·균형 해석</span>입니다. 표·비율·격국 문장 전문은{" "}
              <span className="font-semibold text-foreground">원국</span> 탭을 보세요.
            </p>
          </div>
          {canEdit && editMode !== "none" && (
            <button
              type="button"
              onClick={() => setEditMode("none")}
              className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
      <div className="ds-card-pad space-y-3">
        <div className="rounded-xl border border-border/60 bg-white px-3 py-3 dark:bg-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-muted-foreground">
              용신
              {!hasYongshinOverride && (
                <span className="ml-1.5 rounded bg-orange-50 px-1 text-[9px] font-bold text-orange-600">자동</span>
              )}
            </p>
            {canEdit && onYongshinDataChange && (
              <button
                type="button"
                onClick={() => setEditMode((m) => (m === "yongshin" ? "none" : "yongshin"))}
                className="text-[10px] font-semibold text-primary"
              >
                {editMode === "yongshin" ? "편집 닫기" : "편집"}
              </button>
            )}
          </div>
          {hasYongshinOverride ? (
            <div className="space-y-1">
              {overrideYongshinData!.map((entry) => (
                <div key={entry.type} className="text-[13px]">
                  <span className="text-muted-foreground">{entry.type.replace("용신", "")}: </span>
                  {entry.elements.map((el, i) => (
                    <span key={i} className={`font-bold ${elementTextClass(el as FiveElKey, "strong")}`}>{el}</span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className={`text-lg font-bold ${elementTextClass(yongshinPrimary, "strong")}`}>{yongshinPrimary}</p>
              {yongshinSecondary && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  희신: <span className={cn("font-semibold", elementTextClass(yongshinSecondary, "strong"))}>{yongshinSecondary}</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-white px-3 py-2.5 dark:bg-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-muted-foreground">사주 강도 (참고)</p>
            {canEdit && onStrengthLevelChange && (
              <button
                type="button"
                onClick={() => setEditMode((m) => (m === "strength" ? "none" : "strength"))}
                className="text-[10px] font-semibold text-primary"
              >
                {editMode === "strength" ? "선택 닫기" : "수정"}
              </button>
            )}
          </div>
          <p className="text-[13px] font-bold text-foreground">{strengthDisplayLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {strengthDesc}
            {typeof strengthScore === "number" && Number.isFinite(strengthScore) ? ` · ${strengthScore}점` : ""}
          </p>
        </div>

        {pipelineSeasonalNote && (
          <div className="rounded-xl border border-border/60 bg-white px-3 py-2.5 shadow-none dark:bg-card">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">조후(계절) 보정</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              문장 전체는 <span className="font-semibold text-foreground">원국</span> 탭 「격국·조후」에만 두었습니다. 이 탭은 기질·행동 해석에 집중합니다.
            </p>
          </div>
        )}

        {insights.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">구조·규칙 인사이트</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-foreground/85">
              {insights.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

      {/* 사주 강도 picker */}
      {editMode === "strength" && onStrengthLevelChange && (
        <div className="pt-1 space-y-2 border-t border-amber-100">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">사주 강도 선택</p>
          <div className="flex flex-wrap gap-2">
            {STRENGTH_LEVELS.map((lv) => {
              const isActive = (overrideStrengthLevel ?? baseSchema.strengthLevel) === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => { onStrengthLevelChange(lv === baseSchema.strengthLevel ? null : lv); setEditMode("none"); }}
                  className={cn(
                    "ds-badge text-[13px] font-bold shadow-none transition-colors active:scale-[0.98]",
                    isActive ? "ds-badge-active border-primary bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {lv}
                </button>
              );
            })}
            {overrideStrengthLevel && (
              <button type="button" onClick={() => { onStrengthLevelChange(null); setEditMode("none"); }} className="ds-badge text-[11px] text-muted-foreground shadow-none hover:bg-muted/60">초기화</button>
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
              <button type="button" onClick={saveYongshin} className="ds-badge-active ds-badge border-primary bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground shadow-none transition-colors active:scale-[0.98]">저장</button>
              {overrideYongshinData && overrideYongshinData.length > 0 && (
                <button onClick={() => { setLocalYongshinData([]); onYongshinDataChange([]); setEditMode("none"); }} className="text-[11px] text-muted-foreground px-2 py-1 rounded-full border border-border hover:bg-muted/40 transition-colors">초기화</button>
              )}
            </div>
          </div>
          {/* Type tabs */}
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {YONGSHIN_TYPES.map((t) => {
              const hasEntries = getTypeElements(t).length > 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveYongshinType(t)}
                  className={cn(
                    "ds-badge whitespace-nowrap text-[12px] font-semibold shadow-none transition-colors active:scale-[0.98]",
                    activeYongshinType === t
                      ? "ds-badge-active border-primary bg-primary text-primary-foreground"
                      : hasEntries
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground",
                  )}
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
                return (
                  <button
                    key={el}
                    onClick={() => toggleElement(activeYongshinType, el)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                      isActive
                        ? `${elementBgClass(el, "strong")} ${elementBorderClass(el, "strong")} text-white`
                        : `${elementBgClass(el, "muted")} ${elementBorderClass(el, "base")} ${elementTextClass(el, "strong")}`
                    }`}
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
                <div key={entry.type} className="ds-badge flex items-center gap-1 border-primary/25 bg-primary/10 text-primary shadow-none">
                  <span className="text-[11px] font-semibold">{entry.type.replace("용신", "")}: {entry.elements.join(" ")}</span>
                  <button type="button" onClick={() => setLocalYongshinData((prev) => prev.filter((e) => e.type !== entry.type))} className="text-[11px] leading-none text-primary/60 hover:text-primary">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
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

function getElementBalanceAccent(counts: FiveElementCount): FiveElKey | null {
  const missing = (["목", "화", "토", "금", "수"] as const).filter((el) => counts[el] === 0);
  if (missing.length > 0) return missing[0];
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const dominant = (["목", "화", "토", "금", "수"] as const).filter((el) => counts[el] / total >= 0.4);
  return dominant.length > 0 ? dominant[0] : null;
}

// ── 格局 & 구조 분석 섹션 ────────────────────────────────────────

function GukgukSection({
  dayStem,
  monthBranch,
  allStems,
  allBranches,
  pipelineGukguk,
  pipelinePatterns,
}: {
  dayStem: string;
  monthBranch?: string;
  allStems: string[];
  allBranches: string[];
  pipelineGukguk?: ReturnType<typeof determineGukguk> | null;
  pipelinePatterns?: ReturnType<typeof detectStructurePatterns>;
}) {
  if (!dayStem || !monthBranch) return null;
  // Single source of truth: prefer pipeline-computed results to avoid divergent logic across sections.
  const gukguk = pipelineGukguk ?? determineGukguk(dayStem, monthBranch, allStems);
  const patterns = pipelinePatterns ?? detectStructurePatterns(dayStem, allStems, allBranches, monthBranch);
  if (!gukguk && patterns.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border px-4 py-4 space-y-2 bg-muted/20 border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight">격국 없음</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">미인정</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground">월지 {monthBranch}</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            월지 지장간의 <span className="font-semibold text-foreground">투출</span>이 확인되지 않아 격국을 확정하지 않았습니다.
          </p>
          <p className="text-[12px] text-muted-foreground/80">
            이 경우에도 사주 자체는 정상이며, 구조 패턴이 명확하지 않으면 “구조 분석”이 표시되지 않을 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const toneLabel = gukguk
    ? (gukguk.tone === "길" ? "길격" : gukguk.tone === "흉" ? "흉격" : "중성격")
    : null;
  const toneBadge = gukguk
    ? (gukguk.tone === "길"
      ? "bg-emerald-100 text-emerald-700"
      : gukguk.tone === "흉"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700")
    : null;

  return (
    <div className="space-y-3">
      {/* 格局 카드 */}
      {gukguk ? (
        <div className={`rounded-2xl border px-4 py-4 space-y-3 ${gukguk.colorClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight">{gukguk.name}</span>
              {toneLabel && toneBadge && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${toneBadge}`}>{toneLabel}</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] text-current/60">
                월지 {monthBranch}
                {gukguk.transparentStem ? ` · ${gukguk.transparentStem} 투출` : ""}
              </span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed opacity-90">{gukguk.description}</p>
          {gukguk.explanation && gukguk.explanation.length > 0 && (
            <div className="ds-inline-detail-nested space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">격국 판정 근거</p>
              <ul className="text-[12px] text-foreground/90 list-disc pl-4 space-y-0.5">
                {gukguk.explanation.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {/* strict 투출 격국: 투출이 없으면 determineGukguk가 null을 반환 */}
        </div>
      ) : (
        <div className="rounded-2xl border px-4 py-4 space-y-2 bg-muted/20 border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight">격국 없음</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">미인정</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground">월지 {monthBranch}</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            월지 지장간의 <span className="font-semibold text-foreground">투출</span>이 확인되지 않아 격국을 확정하지 않았습니다.
          </p>
        </div>
      )}

      {/* 구조 분석 */}
      {patterns.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1">사주 구조 분석</p>
          {patterns.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${STRUCTURE_TYPE_COLOR[p.type]}`}
            >
              <span className="text-[11px] font-bold mt-0.5 shrink-0 opacity-70">
                {p.type === "상생" ? "생" : p.type === "상극" ? "극" : "◎"}
              </span>
              <div>
                <p className="text-[13px] font-bold leading-tight">{p.name}</p>
                <p className="text-[12px] opacity-80 mt-0.5 leading-relaxed">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Fortune Calendar (일운 monthly view) ──────────────────────────

function FortuneCalendar({ record, dayStem, luckCycles, birthYear, adjustedDaewoon }: {
  record: PersonRecord;
  dayStem: string;
  luckCycles: ReturnType<typeof calculateLuckCycles>;
  birthYear: number;
  adjustedDaewoon: ReturnType<typeof calculateLuckCycles>["daewoon"];
}) {
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

  const calCombined = useMemo(() => {
    if (!selectedDay || !dayStem) return null;
    const selectedAge = viewYear - birthYear;
    const calDaewoon = adjustedDaewoon.find(e => selectedAge >= e.startAge && selectedAge <= e.endAge);
    if (!calDaewoon) return null;
    const yearGZ = getYearGanZhi(viewYear);
    const monthGZ = getMonthGanZhi(viewYear, viewMonth);
    const dayGZ = getDayGanZhi(viewYear, viewMonth, selectedDay);
    return getCombinedFortuneText(dayStem, [
      { label: "대운", ganZhi: calDaewoon.ganZhi },
      { label: "세운", ganZhi: yearGZ },
      { label: "월운", ganZhi: monthGZ },
      { label: "일운", ganZhi: dayGZ },
    ]);
  }, [selectedDay, dayStem, viewYear, viewMonth, birthYear, adjustedDaewoon]);

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

  function toneDotClass(fortune: ReturnType<typeof getFortuneForDate>) {
    const tg = fortune.dayTenGod;
    const favorable = ["식신", "정재", "정관", "정인"];
    const cautious = ["겁재", "상관", "편관", "편재"];
    if (tg && favorable.includes(tg)) return "bg-chart-2";
    if (tg && cautious.includes(tg)) return "bg-destructive";
    return "bg-chart-4";
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
          <div key={d} className={`py-1 text-center text-[11px] font-bold ${i === 0 ? "text-destructive" : i === 6 ? "text-chart-5" : "text-muted-foreground"}`}>
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
          const dotCls = toneDotClass(fortune);
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`flex min-h-[52px] flex-col items-center justify-start rounded-lg border pb-1 pt-1 transition-all active:scale-95 ${
                isSelected ? "border-primary/50 bg-primary/10" : isToday ? "border-primary/30 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/20"
              }`}
            >
              <span className={`mb-0.5 text-[12px] font-bold leading-none ${dow === 0 ? "text-destructive" : dow === 6 ? "text-chart-5" : "text-foreground"}`}>
                {day}
              </span>
              <span className="text-[11px] font-bold leading-none">
                <span className={stemEl ? elementTextClass(stemEl, "base") : "text-muted-foreground"}>{ganjiStr[0] ?? ""}</span>
                <span className={branchEl ? elementTextClass(branchEl, "base") : "text-muted-foreground"}>{ganjiStr[1] ?? ""}</span>
              </span>
              <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", dotCls)} />
            </button>
          );
        })}
      </div>

      {selectedDay !== null && (() => {
        const dayGZ = getDayGanZhi(viewYear, viewMonth, selectedDay);
        const se = getStemElement(dayGZ.stem);
        const be = STEM_ELEMENT[dayGZ.branch] ?? null;
        const tg = dayStem ? getTenGod(dayStem, dayGZ.stem) : null;
        const btg = dayStem ? getTenGod(dayStem, dayGZ.branch) : null;
        return (
          <div className="mt-4 space-y-3">
            {/* 일운 형식 카드 */}
            <div
              className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3"
              style={
                se
                  ? {
                      backgroundColor: elementHslAlpha(se, "strong", 0.102),
                      borderColor: elementHslAlpha(se, "strong", 0.238),
                    }
                  : undefined
              }
            >
              <p className="text-[13px] text-muted-foreground mb-1.5">일운 · {viewMonth}월 {selectedDay}일</p>
              <div className="flex gap-0.5 items-baseline">
                <span className={`text-xl font-bold ${se ? elementTextClass(se, "strong") : ""}`}>{dayGZ.stem}</span>
                <span className={`text-xl font-bold ${be ? elementTextClass(be, "strong") : ""}`}>{dayGZ.branch}</span>
                {/* hanja 표기는 숨김 */}
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {tg && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(tg, dayStem ?? "")}`} style={getTenGodChipStyle(tg, dayStem ?? "")}>천간 {tg}</span>}
                {btg && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(btg, dayStem ?? "")}`} style={getTenGodChipStyle(btg, dayStem ?? "")}>지지 {btg}</span>}
              </div>
            </div>

            {/* 결합 해석 */}
            {calCombined && (
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-3 space-y-1.5">
                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">대운 × 세운 × 월운 × 일운 결합 해석</p>
                <p className="text-[12px] text-rose-400 font-mono">{calCombined.layerDesc}</p>
                <p className="text-[13px] text-foreground leading-relaxed">{calCombined.combinedText}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Fortune combined interpretation helpers ──────────────────────

const TG_GROUP_MAP: Record<string, string> = {
  비견: "비겁", 겁재: "비겁", 식신: "식상", 상관: "식상",
  편재: "재성", 정재: "재성", 편관: "관성", 정관: "관성",
  편인: "인성", 정인: "인성",
};

const COMBINED_FORTUNE_TEXTS: Record<string, Record<string, string>> = {
  비겁: {
    비겁: "같은 자아 에너지가 겹쳐 독립성과 경쟁심이 강해집니다. 주도적으로 움직이되 지나친 고집은 조심하세요.",
    식상: "자신감이 창의적 표현으로 발전합니다. 자기 색깔을 드러낼 기회를 잡으세요.",
    재성: "경쟁 에너지가 재물 기운을 자극합니다. 능동적으로 행동하면 기회가 열립니다.",
    관성: "자아와 규율이 긴장합니다. 무리한 확장보다 신중한 대처가 필요합니다.",
    인성: "자아 에너지가 지원으로 채워집니다. 학습과 성장에 좋은 기반이 됩니다.",
  },
  식상: {
    비겁: "표현력이 자신감으로 뒷받침됩니다. 창작·소통 활동이 활발해집니다.",
    식상: "표현과 창의가 두 배로 펼쳐집니다. 예술·언어·기술 분야에서 두각을 나타낼 수 있습니다.",
    재성: "표현력이 재물로 연결됩니다. 능력을 수익으로 전환할 기회가 많습니다.",
    관성: "창의성과 규율의 균형이 중요합니다. 자유로움과 책임감이 동시에 요구됩니다.",
    인성: "창의 에너지가 학문적으로 정리됩니다. 깊이 있는 발전을 꾀하기 좋습니다.",
  },
  재성: {
    비겁: "재물 에너지가 경쟁과 만납니다. 자금 관리와 경쟁 상황에 주의가 필요합니다.",
    식상: "재물 흐름이 활발해지고 기회가 늘어납니다. 적극적인 행동이 결실을 맺습니다.",
    재성: "재물 기운이 두 겹으로 활성화됩니다. 큰 기회이지만 과욕은 금물입니다.",
    관성: "재물과 사회적 성취가 연결됩니다. 경력을 통한 수입 확대를 기대할 수 있습니다.",
    인성: "재물 기운이 안정적인 지원을 받습니다. 꾸준한 자산 형성에 유리합니다.",
  },
  관성: {
    비겁: "권위 에너지가 도전을 받습니다. 원칙과 자기중심 사이에서 균형이 필요합니다.",
    식상: "규율이 표현력과 부딪힙니다. 창의적 돌파구를 찾으세요.",
    재성: "사회적 성공과 재물이 연결됩니다. 경력·직위를 통한 성과가 기대됩니다.",
    관성: "규율과 압박이 강해집니다. 인내와 적응력이 이 시기의 핵심입니다.",
    인성: "관성 에너지가 지지를 받습니다. 공직·학문·전문직에서 인정받기 좋은 흐름입니다.",
  },
  인성: {
    비겁: "지원 에너지가 자아를 강화합니다. 자기계발과 독립에 좋은 구조입니다.",
    식상: "지식이 표현으로 피어납니다. 강의·저술·교육 활동에 좋은 흐름입니다.",
    재성: "배움을 재물로 연결하는 전환점이 될 수 있습니다. 능력을 실용적으로 적용하세요.",
    관성: "지원 에너지와 규율이 결합됩니다. 체계적인 학습이나 자격 취득에 유리합니다.",
    인성: "지원과 보호 에너지가 풍부해집니다. 안정적이고 내면적인 성장의 시기입니다.",
  },
};


function getCombinedFortuneText(
  dayStem: string,
  layers: Array<{ label: string; ganZhi: { stem: string; hangul: string } } | null | undefined>
): { layerDesc: string; combinedText: string } {
  const valid = layers.filter((l): l is { label: string; ganZhi: { stem: string; hangul: string } } => !!l);
  if (valid.length < 2) return { layerDesc: "", combinedText: "" };
  const tagged = valid.map((l) => {
    const tg = getTenGod(dayStem, l.ganZhi.stem) ?? null;
    const group = tg ? (TG_GROUP_MAP[tg] ?? "비겁") : "비겁";
    return { ...l, tg, group };
  });
  const layerDesc = tagged.map((t) => `${t.label} ${t.ganZhi.hangul}(${t.tg ?? "-"})`).join(" + ");
  const second = tagged[tagged.length - 2];
  const last = tagged[tagged.length - 1];
  const combinedText = COMBINED_FORTUNE_TEXTS[second.group]?.[last.group]
    ?? `${second.group}과 ${last.group}의 기운이 함께 작용합니다.`;
  return { layerDesc, combinedText };
}

function getDaewoonInterpretationText(dayStem: string, ganZhi: { hangul: string; stem: string }): string {
  const tg = getTenGod(dayStem, ganZhi.stem);
  const group = tg ? (TG_GROUP_MAP[tg] ?? "비겁") : "비겁";
  const texts: Record<string, string> = {
    비겁: `${ganZhi.hangul} 대운은 자아와 독립을 강조하는 시기입니다. 경쟁에서 자신만의 길을 개척하는 에너지가 강합니다.`,
    식상: `${ganZhi.hangul} 대운은 표현과 창의가 피어나는 시기입니다. 재능이 외부로 발휘되고 소통이 활발해집니다.`,
    재성: `${ganZhi.hangul} 대운은 재물과 현실적 성취에 집중되는 시기입니다. 실용적인 노력이 결실을 맺습니다.`,
    관성: `${ganZhi.hangul} 대운은 사회적 책임과 성취의 시기입니다. 원칙과 규율 속에서 지위와 인정을 쌓아갑니다.`,
    인성: `${ganZhi.hangul} 대운은 학습·보호·지원의 흐름이 강한 시기입니다. 배움과 내면의 성장이 중심이 됩니다.`,
  };
  return texts[group] ?? `${ganZhi.hangul} 대운이 흐르고 있습니다.`;
}

// ── Luck Flow Tabs ─────────────────────────────────────────────────

type LuckTabKey = "대운" | "세운" | "월운" | "일운";

function LuckDetailCard({ luckType, ganZhi, period, tg, btg, dayStem }: {
  luckType: string;
  ganZhi: { stem: string; branch: string; hangul: string; hanja: string };
  period: string;
  tg: string | null;
  btg: string | null;
  dayStem?: string;
}) {
  const tgData = tg ? TG_LUCK_MEANING[tg] : null;
  const btgData = btg ? TG_LUCK_MEANING[btg] : null;
  const se = getStemElement(ganZhi.stem);
  const be = STEM_ELEMENT[ganZhi.branch] ?? null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">{luckType}</span>
        {tg && <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getTenGodTw(tg, dayStem ?? "")}`} style={getTenGodChipStyle(tg, dayStem ?? "")}>천간 {tg}</span>}
        {btg && <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getTenGodTw(btg, dayStem ?? "")}`} style={getTenGodChipStyle(btg, dayStem ?? "")}>지지 {btg}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold">
          <span className={se ? elementTextClass(se, "strong") : ""}>{ganZhi.stem}</span>
          <span className={be ? elementTextClass(be, "strong") : ""}>{ganZhi.branch}</span>
        </span>
        {/* hanja 표기는 숨김 */}
        <span className="text-[12px] text-muted-foreground ml-1">{period}</span>
      </div>
      {tgData ? (
        <div className="space-y-1.5">
          <div className="rounded-lg bg-sky-50 border border-sky-100 px-2.5 py-2">
            <p className="text-[11px] font-bold text-sky-700 mb-0.5">이 시기의 기운 (천간)</p>
            <p className="text-[13px] text-foreground">{tgData.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-2 py-1.5">
              <p className="text-[11px] font-bold text-violet-700 mb-0.5">관계·연애</p>
              <p className="text-[13px] text-foreground leading-snug">{tgData.relationship}</p>
            </div>
            <div className="rounded-lg bg-teal-50 border border-teal-100 px-2 py-1.5">
              <p className="text-[11px] font-bold text-teal-700 mb-0.5">일·직업</p>
              <p className="text-[13px] text-foreground leading-snug">{tgData.work}</p>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-100 px-2.5 py-2">
            <p className="text-[11px] font-bold text-green-700 mb-0.5">활용 팁</p>
            <p className="text-[13px] text-foreground">{tgData.tip}</p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{ganZhi.hangul} 운기입니다. 이 간지의 오행 흐름이 전반적인 운에 영향을 미칩니다.</p>
      )}
      {btgData && (
        <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">지지 기운 — {btg}</p>
          <p className="text-[13px] text-foreground">{btgData.summary}</p>
          <p className="text-[13px] text-muted-foreground">{btgData.relationship}</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground/60">※ 운세 해석은 참고용 분석으로, 절대적 예언이 아닙니다.</p>
    </div>
  );
}

function LuckFlowTabs({
  luckCycles,
  dayStem,
  birthYear,
  record,
}: {
  luckCycles: ReturnType<typeof calculateLuckCycles>;
  dayStem: string;
  birthYear: number;
  record: PersonRecord;
}) {
  const [tab, setTab] = useState<LuckTabKey>(() => {
    const saved = sessionStorage.getItem("openLuckTab") as LuckTabKey | null;
    if (saved && (["대운", "세운", "월운", "일운"] as string[]).includes(saved)) {
      sessionStorage.removeItem("openLuckTab");
      return saved;
    }
    return "대운";
  });
  const TABS: { key: LuckTabKey; label: string }[] = [
    { key: "대운", label: "대운" },
    { key: "세운", label: "세운" },
    { key: "월운", label: "월운" },
    { key: "일운", label: "일운" },
  ];
  const now = new Date();
  const [selectedWolunYear, setSelectedWolunYear] = useState(now.getFullYear());
  const [selectedWolunMonth, setSelectedWolunMonth] = useState(now.getMonth() + 1);
  const age = now.getFullYear() - birthYear;
  const daewoonSu = luckCycles.daewoon[0]?.startAge ?? 0;
  const currentSeun = luckCycles.seun.find((e) => e.year === now.getFullYear()) ?? null;
  const displayDaewoonSu = daewoonSu;

  // ── 대운수 기준으로 전체 연령 재계산 ─────────────────────────
  const adjustedDaewoon = useMemo(
    () => luckCycles.daewoon.map((entry, i) => ({
      ...entry,
      startAge: displayDaewoonSu + i * 10,
      endAge: displayDaewoonSu + i * 10 + 9,
    })),
    [luckCycles.daewoon, displayDaewoonSu]
  );
  const currentDaewoon = adjustedDaewoon.find((e) => age >= e.startAge && age <= e.endAge) ?? null;
  const currentDaewoonIdx = adjustedDaewoon.findIndex((e) => age >= e.startAge && age <= e.endAge);

  const [selectedDaewoonIdx, setSelectedDaewoonIdx] = useState<number>(
    currentDaewoonIdx >= 0 ? currentDaewoonIdx : 0
  );
  const [selectedSeunYear, setSelectedSeunYear] = useState<number>(now.getFullYear());
  const selectedSeunEntry = luckCycles.seun.find((e) => e.year === selectedSeunYear) ?? null;

  // Read-only: 대운수는 엔진 자동 계산값만 표시합니다.

  return (
    <div className="space-y-3">
      <div className="ds-segment-list min-h-10 rounded-xl border border-border shadow-none">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "ds-segment-item text-[13px] shadow-none",
              tab === key ? "ds-segment-item-active" : "ds-segment-item-inactive",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 대운 panel */}
      {tab === "대운" && (
        <div className="space-y-3">
          {/* 대운수 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="text-center shrink-0">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">대운수</p>
              <p className="text-2xl font-bold text-amber-700">{displayDaewoonSu}</p>
            </div>
            <div className="w-px h-10 bg-amber-200 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-amber-700">
                만 <span className="font-bold">{displayDaewoonSu}세</span>부터 대운이 시작됩니다
              </p>
              {currentDaewoon && (
                <p className="text-[12px] text-amber-600 mt-0.5">
                  현재 대운: <span className="font-bold">{currentDaewoon.ganZhi.hangul}</span> ({currentDaewoon.startAge}~{currentDaewoon.endAge}세)
                </p>
              )}
            </div>
          </div>

          {/* Current daewoon interpretation */}
          {currentDaewoon && dayStem && (
            <div className="rounded-xl bg-muted/20 border border-border px-3 py-3">
              <p className="text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">현재 대운 해석</p>
              <p className="text-[13px] text-foreground leading-relaxed">
                {getDaewoonInterpretationText(dayStem, currentDaewoon.ganZhi)}
              </p>
            </div>
          )}

          {adjustedDaewoon.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">대운 데이터가 없습니다</p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground px-0.5">10년 주기 운의 흐름 · 항목을 탭하면 해석이 아래에 표시됩니다</p>
              <div className="grid grid-cols-2 gap-2">
                {adjustedDaewoon.slice(0, 8).map((entry, i) => {
                  const stemEl = getStemElement(entry.ganZhi.stem);
                  const branchEl = STEM_ELEMENT[entry.ganZhi.branch] ?? null;
                  const isCurrent = age >= entry.startAge && age <= entry.endAge;
                  const isSelected = selectedDaewoonIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDaewoonIdx(i)}
                      className={`rounded-lg border p-2.5 flex items-center gap-2.5 cursor-pointer transition-all active:scale-95 hover:bg-muted/30 text-left ${isSelected ? "border-indigo-400 bg-indigo-50" : isCurrent ? "border-amber-400 bg-amber-50" : "border-border bg-muted/20"}`}
                    >
                      <div className="text-center w-14 shrink-0">
                        <p className="text-[13px] text-muted-foreground">{entry.startAge}~{entry.endAge}세</p>
                        {isCurrent && <p className="text-[13px] text-amber-600 font-bold">현재</p>}
                      </div>
                      <div className="flex gap-0.5 items-center">
                        <span className={`text-xl font-bold ${stemEl ? elementTextClass(stemEl, "strong") : ""}`}>{entry.ganZhi.stem}</span>
                        <span className={`text-xl font-bold ${branchEl ? elementTextClass(branchEl, "strong") : ""}`}>{entry.ganZhi.branch}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 선택된 대운 인라인 상세 카드 */}
              {adjustedDaewoon[selectedDaewoonIdx] && (() => {
                const entry = adjustedDaewoon[selectedDaewoonIdx];
                const tg = dayStem ? getTenGod(dayStem, entry.ganZhi.stem) : null;
                const btg = dayStem ? getTenGod(dayStem, entry.ganZhi.branch) : null;
                const isCurrent = age >= entry.startAge && age <= entry.endAge;
                return (
                  <LuckDetailCard
                    luckType="대운"
                    ganZhi={entry.ganZhi}
                    period={`${entry.startAge}~${entry.endAge}세${isCurrent ? " · 현재 대운" : ""}`}
                    tg={tg}
                    btg={btg}
                    dayStem={dayStem}
                  />
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* 세운 panel */}
      {tab === "세운" && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground px-0.5">연간 운세 · 탭하면 해석이 아래에 표시됩니다</p>
          {/* 수평 스크롤 연도 목록 */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
            <div className="flex min-w-max gap-2">
              {luckCycles.seun.map(({ year, ganZhi }) => {
                const se = getStemElement(ganZhi.stem);
                const be = STEM_ELEMENT[ganZhi.branch] ?? null;
                const isThisYear = year === now.getFullYear();
                const isSelected = year === selectedSeunYear;
                const tg = dayStem ? getTenGod(dayStem, ganZhi.stem) : null;
                return (
                  <button
                    key={year}
                    onClick={() => setSelectedSeunYear(year)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-center cursor-pointer transition-all active:scale-95 ${
                      isSelected ? "border-indigo-400 bg-indigo-50" : isThisYear ? "border-amber-300 bg-amber-50" : "border-border bg-muted/20"
                    }`}
                  >
                    <p className="text-[13px] text-muted-foreground">{year}년</p>
                    <div className="flex gap-0.5 justify-center mt-0.5">
                      <span className={`text-lg font-bold ${se ? elementTextClass(se, "strong") : ""}`}>{ganZhi.stem}</span>
                      <span className={`text-lg font-bold ${be ? elementTextClass(be, "strong") : ""}`}>{ganZhi.branch}</span>
                    </div>
                    {/* hanja 표기는 숨김 */}
                    {tg && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${getTenGodTw(tg, dayStem)}`} style={getTenGodChipStyle(tg, dayStem)}>{tg}</span>}
                    {isThisYear && <p className="text-[11px] text-amber-600 font-medium mt-0.5">올해</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 대운 × 선택된 세운 결합 해석 (상세 카드 위) */}
          {currentDaewoon && selectedSeunEntry && dayStem && (() => {
            const { layerDesc, combinedText } = getCombinedFortuneText(dayStem, [
              { label: "대운", ganZhi: currentDaewoon.ganZhi },
              { label: "세운", ganZhi: selectedSeunEntry.ganZhi },
            ]);
            return (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3 space-y-1.5">
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">대운 × 세운 결합 해석</p>
                <p className="text-[12px] text-indigo-400 font-mono">{layerDesc}</p>
                <p className="text-[13px] text-foreground leading-relaxed">{combinedText}</p>
              </div>
            );
          })()}

          {/* 선택된 세운 인라인 상세 카드 */}
          {selectedSeunEntry && (() => {
            const { ganZhi } = selectedSeunEntry;
            const tg = dayStem ? getTenGod(dayStem, ganZhi.stem) : null;
            const btg = dayStem ? getTenGod(dayStem, ganZhi.branch) : null;
            return (
              <LuckDetailCard
                luckType="세운"
                ganZhi={ganZhi}
                period={`${selectedSeunYear}년`}
                tg={tg}
                btg={btg}
                dayStem={dayStem}
              />
            );
          })()}
        </div>
      )}

      {/* 월운 panel */}
      {tab === "월운" && (
        <div className="space-y-3">
          {/* 월운 content */}
          {(() => {
            const thisYear = now.getFullYear();
            const thisMonth = now.getMonth() + 1;
            const wolunSeun = luckCycles.seun.find(e => e.year === selectedWolunYear) ?? null;
            const wolunDaewoon = adjustedDaewoon.find(e => (selectedWolunYear - birthYear) >= e.startAge && (selectedWolunYear - birthYear) <= e.endAge) ?? currentDaewoon;
            return (
              <div className="space-y-3">
                {/* 연도 선택 */}
                <div className="flex items-center justify-between">
                  <button onClick={() => setSelectedWolunYear(y => y - 1)} className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm font-bold active:scale-95">‹</button>
                  <span className="text-[15px] font-bold">{selectedWolunYear}년 월운</span>
                  <button onClick={() => setSelectedWolunYear(y => y + 1)} className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm font-bold active:scale-95">›</button>
                </div>

                {/* 12달 그리드 */}
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const gz = getMonthGanZhi(selectedWolunYear, m);
                    const se = getStemElement(gz.stem);
                    const be = STEM_ELEMENT[gz.branch] ?? null;
                    const tg = dayStem ? getTenGod(dayStem, gz.stem) : null;
                    const isNow = selectedWolunYear === thisYear && m === thisMonth;
                    const isSelected = m === selectedWolunMonth;
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedWolunMonth(m)}
                        className={`rounded-lg border p-2 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${isSelected ? "border-teal-400 bg-teal-50" : isNow ? "border-amber-400 bg-amber-50" : "border-border bg-muted/20"}`}
                      >
                        <span className="text-[11px] text-muted-foreground font-semibold">{m}월{isNow ? " ●" : ""}</span>
                        <div className="flex gap-0.5">
                          <span className={`text-[15px] font-bold leading-tight ${se ? elementTextClass(se, "strong") : ""}`}>{gz.stem}</span>
                          <span className={`text-[15px] font-bold leading-tight ${be ? elementTextClass(be, "strong") : ""}`}>{gz.branch}</span>
                        </div>
                        {tg && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${getTenGodTw(tg, dayStem)}`} style={getTenGodChipStyle(tg, dayStem)}>{tg}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* 선택된 월 상세 카드 + 결합해석 */}
                {(() => {
                  const gz = getMonthGanZhi(selectedWolunYear, selectedWolunMonth);
                  const se = getStemElement(gz.stem);
                  const be = STEM_ELEMENT[gz.branch] ?? null;
                  const tg = dayStem ? getTenGod(dayStem, gz.stem) : null;
                  const btg = dayStem ? getTenGod(dayStem, gz.branch) : null;
                  return (
                    <div className="space-y-2">
                      <div
                        className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3"
                        style={
                          se
                            ? {
                              backgroundColor: elementHslAlpha(se, "strong", 0.102),
                              borderColor: elementHslAlpha(se, "strong", 0.238),
                              }
                            : undefined
                        }
                      >
                        <p className="text-[13px] text-muted-foreground mb-1.5">월운 · {selectedWolunYear}년 {selectedWolunMonth}월</p>
                        <div className="flex gap-0.5 items-baseline">
                          <span className={`text-xl font-bold ${se ? elementTextClass(se, "strong") : ""}`}>{gz.stem}</span>
                          <span className={`text-xl font-bold ${be ? elementTextClass(be, "strong") : ""}`}>{gz.branch}</span>
                          {/* hanja 표기는 숨김 */}
                        </div>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {tg && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(tg, dayStem)}`} style={getTenGodChipStyle(tg, dayStem)}>천간 {tg}</span>}
                          {btg && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(btg, dayStem)}`} style={getTenGodChipStyle(btg, dayStem)}>지지 {btg}</span>}
                        </div>
                      </div>
                      {wolunDaewoon && wolunSeun && dayStem && (() => {
                        const { layerDesc, combinedText } = getCombinedFortuneText(dayStem, [
                          { label: "대운", ganZhi: wolunDaewoon.ganZhi },
                          { label: "세운", ganZhi: wolunSeun.ganZhi },
                          { label: "월운", ganZhi: gz },
                        ]);
                        return (
                          <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-3 space-y-1.5">
                            <p className="text-[11px] font-bold text-teal-600 uppercase tracking-wide">대운 × 세운 × 월운 결합 해석</p>
                            <p className="text-[12px] text-teal-400 font-mono">{layerDesc}</p>
                            <p className="text-[13px] text-foreground leading-relaxed">{combinedText}</p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

        </div>
      )}

      {/* 일운 panel (달력) */}
      {tab === "일운" && <FortuneCalendar record={record} dayStem={dayStem} luckCycles={luckCycles} birthYear={birthYear} adjustedDaewoon={adjustedDaewoon} />}
    </div>
  );
}

function ReportAtAGlanceCard({
  dayStem,
  dayBranch,
  primaryEl,
  gukgukName,
  strengthLevel,
  strengthScore,
  onPrimaryClick,
  onGukgukClick,
  onStrengthClick,
}: {
  dayStem: string;
  dayBranch: string;
  primaryEl: FiveElKey | null;
  gukgukName: string;
  strengthLevel: string;
  strengthScore?: number;
  onPrimaryClick?: () => void;
  onGukgukClick?: () => void;
  onStrengthClick?: () => void;
}) {
  const tile = (opts: { onClick?: () => void; className?: string; children: ReactNode }) => {
    const { onClick, className, children } = opts;
    const cls = cn(
      "rounded-lg border border-border bg-background/70 px-3 py-2 text-left",
      onClick && "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/65",
      className,
    );
    if (onClick) {
      return (
        <button type="button" className={cls} onClick={onClick}>
          {children}
        </button>
      );
    }
    return <div className={cls}>{children}</div>;
  };

  return (
    <div className="ds-card border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-none">
      <div className="ds-card-pad space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">원국 요약</p>
          <h2 className="ds-title mt-1">핵심 한눈에 보기</h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            아래 세 가지를 순서대로 확인하면 원국을 빠르게 잡을 수 있습니다. 카드를 누르면 해당 구역으로 이동합니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tile({
            onClick: onPrimaryClick,
            children: (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">대표 오행</p>
                {primaryEl ? (
                  <p className={cn("text-lg font-black", elementTextClass(primaryEl, "strong"))}>{primaryEl}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">구조 중심 에너지 확인 · 오행 분포로 이동</p>
              </>
            ),
          })}
          {tile({
            onClick: onGukgukClick,
            children: (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">격국</p>
                <p className="text-sm font-bold leading-snug text-foreground">{gukgukName || "—"}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">해석 프레임 확인 · 격국·조후로 이동</p>
              </>
            ),
          })}
          {tile({
            onClick: onStrengthClick,
            className: "sm:col-span-2",
            children: (
              <>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">일간 강약</p>
                <p className="text-base font-bold text-foreground">
                  {strengthLevel}
                  {typeof strengthScore === "number" && Number.isFinite(strengthScore) ? (
                    <span className="ml-2 text-sm font-semibold text-muted-foreground">({strengthScore}점)</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  일간 {dayStem} · 일지 {dayBranch}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">균형 상태 확인 · 일간 강도로 이동</p>
              </>
            ),
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Report ────────────────────────────────────────────────────

const STEM_RELATION_TYPES = new Set(["천간합", "천간충"]);

interface SajuReportProps {
  record: PersonRecord;
  showSaveStatus?: boolean;
}

type ReportMainTab = "원국" | "성격해석" | "운세" | "오늘운세";

const REPORT_MAIN_TABS: ReportMainTab[] = ["원국", "성격해석", "운세", "오늘운세"];

const REPORT_TAB_LABEL: Record<ReportMainTab, string> = {
  원국: "원국",
  성격해석: "성격해석",
  운세: "운세",
  오늘운세: "오늘운세",
};

/** AppHeader `h-14` — must match when pinning report tabs below it */
const APP_HEADER_OFFSET_PX = 56;

/** 조후 문장이 이 길이를 넘을 때만 바텀시트「상세」노출 (짧은 문장은 인라인만) */
const LONG_SEASONAL_CHARS = 200;

/** 원국 탭: 표·그리드에서 연 상세는 한 번에 하나만 (과밀 방지) */
type YuanGuoInlineDetail =
  | { kind: "shinsal"; id: string }
  | { kind: "tengod"; tg: TenGod }
  | { kind: "hiddenStem"; label: string; branch: string }
  | { kind: "twelveStage"; label: string; branch: string; stage: string }
  | { kind: "branchRelation"; relation: BranchRelation };

export function SajuReport({ record, showSaveStatus = false }: SajuReportProps) {
  const { user } = useAuth();
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
  const [manualFiveElements, setManualFiveElements] = useState<FiveElementCount | undefined>(record.manualFiveElements);
  const [showFiveElEdit, setShowFiveElEdit] = useState(false);
  const [draftFiveEl, setDraftFiveEl] = useState<FiveElementCount>({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 });
  const [manualTenGodCounts, setManualTenGodCounts] = useState<ManualTenGodCounts | undefined>(record.manualTenGodCounts);
  const [showTenGodEdit, setShowTenGodEdit] = useState(false);
  const [draftTenGod, setDraftTenGod] = useState<ManualTenGodCounts>({
    비견: 0, 겁재: 0, 식신: 0, 상관: 0,
    편재: 0, 정재: 0, 편관: 0, 정관: 0,
    편인: 0, 정인: 0,
  });
  const [reportTab, setReportTab] = useState<ReportMainTab>(() => {
    const saved = sessionStorage.getItem("openReportTab");
    if (saved === "오늘운세") { sessionStorage.removeItem("openReportTab"); return "오늘운세"; }
    if (saved === "운세") { sessionStorage.removeItem("openReportTab"); return "운세"; }
    if (saved === "성향" || saved === "성격해석") { sessionStorage.removeItem("openReportTab"); return "성격해석"; }
    return "원국";
  });
  const [hourMode, setHourMode] = useState<"포함" | "제외" | "비교">("포함");
  const [yuanGuoInlineDetail, setYuanGuoInlineDetail] = useState<YuanGuoInlineDetail | null>(null);
  const [selectedTgGroupInline, setSelectedTgGroupInline] = useState<{ group: string; pct: number } | null>(null);
  const [personalityTengodUserPicked, setPersonalityTengodUserPicked] = useState(false);
  const personalityTengodSeededRef = useRef(false);
  const [todayDomainOpen, setTodayDomainOpen] = useState<"사랑" | "일" | "돈" | "건강" | "대인관계" | "학업" | null>(null);
  const [todayDomainUserPicked, setTodayDomainUserPicked] = useState(false);
  const [todayHeroInline, setTodayHeroInline] = useState<
    | { kind: "keyword"; keyword: string }
    | { kind: "tengod"; tenGod: TenGod }
    | null
  >(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setYuanGuoInlineDetail(null);
    personalityTengodSeededRef.current = false;
    setSelectedTgGroupInline(null);
    setPersonalityTengodUserPicked(false);
    setTodayDomainOpen(null);
    setTodayDomainUserPicked(false);
    setTodayHeroInline(null);
  }, [record.id]);

  useEffect(() => {
    setYuanGuoInlineDetail(null);
    if (reportTab !== "성격해석") {
      personalityTengodSeededRef.current = false;
      setSelectedTgGroupInline(null);
      setPersonalityTengodUserPicked(false);
    }
    if (reportTab !== "오늘운세") {
      setTodayDomainOpen(null);
      setTodayDomainUserPicked(false);
      setTodayHeroInline(null);
    }
  }, [reportTab]);

  const reportMainTabsAnchorRef = useRef<HTMLDivElement>(null);
  const [reportMainTabsPinned, setReportMainTabsPinned] = useState(false);

  const scrollToYuanAnchor = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const scrollToStrengthOrStructure = useCallback(() => {
    requestAnimationFrame(() => {
      const strength = document.getElementById("yuan-strength");
      if (strength) {
        strength.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      document.getElementById("yuan-oheung-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // ── LOCAL REACTIVE STATE for fortune options + profile ─────────────
  // Root cause of unresponsive toggles: `record` is a prop. `updatePersonRecord`
  // writes to localStorage but the parent never re-renders with the new value.
  // Fix: shadow `record.fortuneOptions` and `record.profile` in local state so
  // toggles cause immediate re-renders without waiting for the parent.
  const [fortuneOpts, setFortuneOpts] = useState<FortuneOptions>(() => record.fortuneOptions ?? {});
  const [localProfile, setLocalProfile] = useState<SajuProfile>(() => record.profile);

  const { toast } = useToast();

  // ── Debounced Supabase sync ─────────────────────────────────────
  // Any manual edit (shinsal, strength, yongshin, five-elements, etc.)
  // only hits localStorage.  scheduleSync() queues a Supabase write
  // ~1.5 s after the last change so cross-device edits are persisted.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    if (!user) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const myProfile = getMyProfile();
        if (myProfile?.id === record.id) {
          await upsertMyProfile(user.id, myProfile);
          console.log("[SajuReport] manual edit synced to Supabase (myProfile) ✓");
        } else {
          const partner = getPeople().find((p) => p.id === record.id);
          if (partner) {
            await upsertPartnerProfile(user.id, partner);
            console.log("[SajuReport] manual edit synced to Supabase (partner) ✓");
          }
        }
      } catch (e) {
        console.error("[SajuReport] sync to Supabase failed:", e);
      }
    }, 1500);
  }, [user, record.id]);

  // ── Unified fortune-option updater ──────────────────────────────
  // Updates local state (instant re-render) + persists to storage.
  // When time-correction options change, also rebuilds the profile so
  // hour pillar / five-element distribution reflect the new correction.
  const applyFortuneOption = useCallback((
    patch: Partial<FortuneOptions>,
    profilePatch?: SajuProfile,   // supply when pillars must be recalculated
  ) => {
    setFortuneOpts((prev) => {
      const next = { ...prev, ...patch };
      // Persist merged opts + optional new profile to localStorage
      updatePersonRecord(record.id, {
        fortuneOptions: next,
        ...(profilePatch ? { profile: profilePatch } : {}),
      });
      return next;
    });
    if (profilePatch) {
      setLocalProfile(profilePatch);
    }
    scheduleSync();
  }, [record.id, scheduleSync]);

  // ── 자동 계산 초기화 ────────────────────────────────────────────
  // Clears ALL manual override fields and re-runs the full calculation pipeline
  // using the stored birth input + current fortune options (time corrections etc.).
  const handleResetToAuto = useCallback(() => {
    const freshProfile = calculateProfileFromBirth(record.birthInput, {
      localMeridianOn: fortuneOpts?.localMeridianOn ?? true,
      trueSolarTimeOn: fortuneOpts?.trueSolarTimeOn ?? false,
    });

    updatePersonRecord(record.id, {
      profile: freshProfile,
      // ── Clear all manual overrides ──────────────────────────────
      manualPillars:           undefined,
      manualShinsal:           undefined,
      excludedAutoShinsal:     undefined,
      manualStrengthLevel:     undefined,
      manualYongshin:          undefined,
      manualYongshinData:      undefined,
      manualFiveElements:      undefined,
      manualTenGodCounts:      undefined,
      manualDerived:           undefined,
      manualBranchRelationAdd: undefined,
      manualBranchRelationRemove: undefined,
    });

    // Update local reactive states so UI reflects the reset immediately
    setLocalProfile(freshProfile);
    setLocalStrengthLevel(null);
    setLocalYongshinData([]);
    setManualDerived({});
    setManualFiveElements(undefined);
    setManualTenGodCounts(undefined);
    setManualBranchRemove([]);
    setManualBranchAdd([]);

    scheduleSync();
    setShowResetConfirm(false);

    toast({
      description: "자동 계산값으로 초기화되었습니다",
      duration: 3000,
    });
  }, [record.id, record.birthInput, fortuneOpts, scheduleSync, toast]);

  // ── Interpretation subtab state ────────────────────────────────
  // NOTE: 오늘운세 탭은 "오늘 하루 변화 흐름"만 보여주므로 해석 서브탭을 사용하지 않습니다.

  // ── Handlers ───────────────────────────────────────────────────
  function handleMaritalStatus(status: MaritalStatus) {
    const next = status === maritalStatus ? undefined : status;
    setMaritalStatus(next);
    saveMaritalStatus(record.id, next);
    scheduleSync();
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
    scheduleSync();
  }

  function handleDeleteManualShinsal(position: string, name: string) {
    setManualShinsal((prev) => {
      const next = prev.filter((m) => !(m.position === position && m.name === name));
      saveManualShinsal(record.id, next);
      return next;
    });
    scheduleSync();
  }

  function handleExcludeAutoShinsal(position: string, name: string) {
    setExcludedAutoShinsal((prev) => {
      if (prev.some((m) => m.position === position && m.name === name)) return prev;
      const next = [...prev, { position, name }];
      saveExcludedAutoShinsal(record.id, next);
      return next;
    });
    scheduleSync();
  }

  function handleRestoreAutoShinsal(position: string, name: string) {
    setExcludedAutoShinsal((prev) => {
      const next = prev.filter((m) => !(m.position === position && m.name === name));
      saveExcludedAutoShinsal(record.id, next);
      return next;
    });
    scheduleSync();
  }

  function openFiveElEditor(current: FiveElementCount) {
    setDraftFiveEl({ ...current });
    setShowFiveElEdit(true);
  }

  function saveFiveElEdit() {
    setManualFiveElements(draftFiveEl);
    updatePersonRecord(record.id, { manualFiveElements: draftFiveEl });
    setShowFiveElEdit(false);
    scheduleSync();
  }

  function resetFiveElEdit() {
    setManualFiveElements(undefined);
    updatePersonRecord(record.id, { manualFiveElements: undefined });
    setShowFiveElEdit(false);
    scheduleSync();
  }

  function openTenGodEditor(autoCounts: ManualTenGodCounts) {
    const source = manualTenGodCounts ? { ...manualTenGodCounts } : { ...autoCounts };
    const total = Object.values(source).reduce((s, c) => s + c, 0) || 1;
    const pcts: ManualTenGodCounts = {} as ManualTenGodCounts;
    for (const [tg, cnt] of Object.entries(source)) {
      pcts[tg as TenGod] = Math.round((cnt / total) * 100);
    }
    setDraftTenGod(pcts);
    setShowTenGodEdit(true);
  }

  function saveTenGodEdit() {
    setManualTenGodCounts(draftTenGod);
    setManualFiveElements(undefined);
    updatePersonRecord(record.id, { manualTenGodCounts: draftTenGod, manualFiveElements: undefined });
    setShowTenGodEdit(false);
    scheduleSync();
  }

  function resetTenGodEdit() {
    setManualTenGodCounts(undefined);
    updatePersonRecord(record.id, { manualTenGodCounts: undefined });
    setShowTenGodEdit(false);
    scheduleSync();
  }

  // ── Computed values (read-only results) ─────────────────────────
  // Results are engine-derived and must remain read-only.
  // Ignore any legacy manual override fields (manualPillars/manualFiveElements/etc).
  const profile = localProfile;
  const pillars = profile.computedPillars;
  const input = record.birthInput;
  const isManuallyEdited = false;

  // ── 시주 포함/제외 전환 ──────────────────────────────────────────
  // 제외 모드: hour pillar 제거, 비교 모드: 원본 유지 + diff 표시
  const effectivePillars = useMemo(() =>
    hourMode === "제외"
      ? { ...pillars, hour: null as typeof pillars.hour }
      : pillars,
    [pillars, hourMode],
  );

  // ── 효과적 오행 (read-only): always auto-count from pillars ─────
  const dayStemForCompute = pillars.day?.hangul?.[0] ?? "";
  const effectiveFiveElements = useMemo<FiveElementCount>(() => {
    return countFiveElements(effectivePillars as ComputedPillars);
  }, [effectivePillars, dayStemForCompute]);

  // ── 4-Layer Saju Pipeline (auto-recomputes when any input changes) ──
  // 오행·십성·신강약·조후·용신·규칙 해석을 한 번에 재계산합니다.
  // 계산 순서: 오행 → 십성 → 신강약 → 조후 보정 → 용신 → 규칙 해석
  const sajuPipelineResult = useMemo(() => {
    const dayStemNow = effectivePillars.day?.hangul?.[0] ?? "";
    if (!dayStemNow) return null;
    const allStemsNow = [
      effectivePillars.hour?.hangul?.[0], dayStemNow,
      effectivePillars.month?.hangul?.[0], effectivePillars.year?.hangul?.[0],
    ].filter((c): c is string => !!c);
    const allBranchesNow = [
      effectivePillars.hour?.hangul?.[1], effectivePillars.day?.hangul?.[1],
      effectivePillars.month?.hangul?.[1], effectivePillars.year?.hangul?.[1],
    ].filter((c): c is string => !!c);
    return computeSajuPipeline({
      dayStem: dayStemNow,
      monthBranch: effectivePillars.month?.hangul?.[1],
      dayBranch: effectivePillars.day?.hangul?.[1],
      allStems: allStemsNow,
      allBranches: allBranchesNow,
      effectiveFiveElements,
      expertOptions: {
        seasonalAdjustmentOff: false,
      },
    });
  }, [effectiveFiveElements, effectivePillars]);

  const ruleInsights = sajuPipelineResult?.interpretation.ruleInsights ?? [];
  const structureType = sajuPipelineResult?.interpretation.structureType ?? "";
  const seasonalNote  = sajuPipelineResult?.interpretation.seasonalNote ?? "";
  const strengthUnified = sajuPipelineResult?.adjusted?.strengthResult ?? null;

  const pillarData = [
    {
      label: "생시",
      hangul: effectivePillars.hour?.hangul ?? "",
      hanja: effectivePillars.hour?.hanja ?? "",
      isUnknown: !effectivePillars.hour || input.timeUnknown || hourMode === "제외",
    },
    { label: "생일", hangul: effectivePillars.day?.hangul ?? "", hanja: effectivePillars.day?.hanja ?? "", isDayMaster: true },
    { label: "생월", hangul: effectivePillars.month?.hangul ?? "", hanja: effectivePillars.month?.hanja ?? "" },
    { label: "생년", hangul: effectivePillars.year?.hangul ?? "", hanja: effectivePillars.year?.hanja ?? "" },
  ];

  const dayStem = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";

  const allChars = [
    effectivePillars.hour?.hangul?.[0], effectivePillars.hour?.hangul?.[1],
    effectivePillars.day?.hangul?.[1],
    effectivePillars.month?.hangul?.[0], effectivePillars.month?.hangul?.[1],
    effectivePillars.year?.hangul?.[0], effectivePillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const allStems = [
    effectivePillars.hour?.hangul?.[0], dayStem,
    effectivePillars.month?.hangul?.[0], effectivePillars.year?.hangul?.[0],
  ].filter((c): c is string => !!c);
  const allBranches = [
    effectivePillars.hour?.hangul?.[1], dayBranch,
    effectivePillars.month?.hangul?.[1], effectivePillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const tenGodDisplayCounts = useMemo((): ManualTenGodCounts | null => {
    if (!dayStem) return null;
    return autoCountTenGods(dayStem, [...allStems.filter((s) => s !== dayStem), ...allBranches]) as ManualTenGodCounts;
  }, [dayStem, allStems, allBranches]);

  const atAGlancePrimary = useMemo((): FiveElKey | null => {
    if (!dayStemForCompute) return null;
    return computePrimaryElement({
      counts: effectiveFiveElements,
      monthBranch: effectivePillars.month?.hangul?.[1],
      dayBranch: effectivePillars.day?.hangul?.[1],
      allStems,
      allBranches,
    });
  }, [effectiveFiveElements, effectivePillars, dayStemForCompute, allStems, allBranches]);

  // ── 대표 십성(그룹) 단일 source ───────────────────────────────
  // 동률(예: 비겁38% vs 식상38%)일 때는 "대표 오행(atAGlancePrimary)"이 가리키는 십성 그룹을 우선합니다.
  // 이렇게 해야 원국 탭의 대표 오행/대표 십성과 성격해석 탭 대표가 어긋나지 않습니다.
  const dominantTenGodPair = useMemo(() => {
    if (!dayStem) {
      return {
        primary: null as ReturnType<typeof pickDominantTenGodGroups>["primary"],
        secondary: null as ReturnType<typeof pickDominantTenGodGroups>["secondary"],
      };
    }
    const dayMasterEl = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
    const preferred =
      dayMasterEl && atAGlancePrimary ? (getTenGodGroup(dayMasterEl, atAGlancePrimary) as "비겁" | "식상" | "재성" | "관성" | "인성") : null;
    const base = ["비겁", "식상", "재성", "관성", "인성"] as const;
    const order = preferred ? [preferred, ...base.filter((g) => g !== preferred)] : base;
    const { groupRaw, rawTotal } = computeTenGodDistribution(dayStem, dayMasterEl, allChars, effectiveFiveElements);
    return pickDominantTenGodGroups({ groupRaw, rawTotal, order });
  }, [dayStem, atAGlancePrimary, allChars, effectiveFiveElements]);

  useEffect(() => {
    if (reportTab !== "성격해석" || !dayStem) return;
    if (personalityTengodSeededRef.current) return;
    personalityTengodSeededRef.current = true;
    if (dominantTenGodPair.primary) {
      setSelectedTgGroupInline({ group: dominantTenGodPair.primary.group, pct: dominantTenGodPair.primary.pctRounded });
      setPersonalityTengodUserPicked(false);
    }
  }, [reportTab, dayStem, dominantTenGodPair.primary]);

  // Debug helper (opt-in): localStorage.debugStrength === "1"
  if (typeof window !== "undefined") {
    try {
      const on = window.localStorage.getItem("debugStrength") === "1";
      if (on && strengthUnified) {
        // eslint-disable-next-line no-console
        console.log("[strength-debug]", {
          personId: record.id,
          pillars: {
            year: pillars.year?.hangul,
            month: pillars.month?.hangul,
            day: pillars.day?.hangul,
            hour: pillars.hour?.hangul,
          },
          effectiveFiveElements,
          dayStem,
          monthBranch: pillars.month?.hangul?.[1],
          allStems,
          allBranches,
          strength: strengthUnified,
        });
      }
    } catch { /* ignore */ }
  }

  const branchRelations = analyzeBranchRelations(effectivePillars as Parameters<typeof analyzeBranchRelations>[0]);
  const daewoonSuOpts: DaewoonSuOpts = {
    exactSolarTermBoundaryOn: fortuneOpts?.exactSolarTermBoundaryOn ?? true,
    trueSolarTimeOn: fortuneOpts?.trueSolarTimeOn ?? false,
  };
  const luckCycles = calculateLuckCycles(input, localProfile.computedPillars, daewoonSuOpts);

  // ── 오늘운세: 오늘 날짜 기준 요약 데이터 ────────────────────────
  const todayFortune = useMemo(() => {
    const now = new Date();
    return getFortuneForDate(record, now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, [record]);

  const todayScoreRows = useMemo(() => {
    const dayLayer = todayFortune.luckLayers.find((l) => l.label === "일운") ?? todayFortune.luckLayers[todayFortune.luckLayers.length - 1];
    const tgStem = (dayLayer?.tenGod ?? todayFortune.dayTenGod ?? null) as string | null;
    const tgBranch = (dayLayer?.branchTenGod ?? null) as string | null;
    const tg = tgStem ?? tgBranch ?? null;
    const domainByName = new Map(todayFortune.domainFortunes.map((d) => [d.domain, d] as const));
    const love = domainByName.get("관계");
    const work = domainByName.get("일");
    const money = domainByName.get("재물");
    const health = domainByName.get("건강");

    const studyLevel: "good" | "neutral" | "caution" = tg
      ? (["정인", "편인"].includes(tg) ? "good" : ["상관", "겁재"].includes(tg) ? "caution" : "neutral")
      : "neutral";

    const domainToLabel = (lvl: "good" | "neutral" | "caution", rawLabel?: string) => {
      if (lvl === "good") return rawLabel && ["상승", "활발"].includes(rawLabel) ? "매우 좋음" : "좋음";
      if (lvl === "caution") return "주의";
      return "보통";
    };
    const domainToEmoji = (lvl: "good" | "neutral" | "caution", rawLabel?: string) => {
      if (lvl === "good") return rawLabel && ["상승", "활발"].includes(rawLabel) ? "☀️" : "🌤";
      if (lvl === "caution") return "🌧";
      return "⛅";
    };
    const score = (lvl: "good" | "neutral" | "caution", rawLabel?: string) => {
      if (lvl === "good") return rawLabel && ["상승", "활발"].includes(rawLabel) ? 3 : 2;
      if (lvl === "neutral") return 1;
      return 0;
    };

    const rows = [
      { key: "사랑" as const, src: love, fallback: { level: "neutral" as const, label: "보통" } },
      { key: "일" as const, src: work, fallback: { level: "neutral" as const, label: "보통" } },
      { key: "돈" as const, src: money, fallback: { level: "neutral" as const, label: "보통" } },
      { key: "건강" as const, src: health, fallback: { level: "neutral" as const, label: "보통" } },
      { key: "대인관계" as const, src: love, fallback: { level: "neutral" as const, label: "보통" } },
      { key: "학업" as const, src: null, fallback: { level: studyLevel, label: domainToLabel(studyLevel) } },
    ].map((r) => {
      const lvl = (r.src?.level ?? r.fallback.level) as "good" | "neutral" | "caution";
      const raw = r.src?.label;
      return {
        key: r.key,
        lvl,
        state: r.src ? domainToLabel(lvl, raw) : r.fallback.label,
        emoji: r.src ? domainToEmoji(lvl, raw) : domainToEmoji(lvl),
        hint: r.src?.hint ?? "",
        score: score(lvl, raw),
      };
    });

    const order = ["사랑", "일", "돈", "건강", "대인관계", "학업"] as const;
    const best = [...rows].sort((a, b) => (b.score - a.score) || (order.indexOf(a.key as any) - order.indexOf(b.key as any)))[0]?.key ?? null;
    return { rows, best };
  }, [todayFortune]);

  useEffect(() => {
    if (reportTab !== "오늘운세") return;
    // 첫 진입 기본 상태: 어떤 영역도 자동 선택하지 않음(사용자 클릭 시에만 열림)
    setTodayDomainOpen(null);
    setTodayDomainUserPicked(false);
  }, [reportTab]);

  const shinsalLuckCtx = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const seun = luckCycles.seun.find((e) => e.year === y);
    const age = y - input.year;
    const dw0 = luckCycles.daewoon[0]?.startAge ?? 0;
    const adjustedDw = luckCycles.daewoon.map((entry, i) => ({
      ...entry,
      startAge: dw0 + i * 10,
      endAge: dw0 + i * 10 + 9,
    }));
    const cur = adjustedDw.find((e) => age >= e.startAge && age <= e.endAge);
    return { seunBranch: seun?.ganZhi.branch, daewoonBranch: cur?.ganZhi.branch };
  }, [luckCycles, input.year]);

  const yuanGuoShinsalPillars = (dayStem && dayBranch)
    ? calculateShinsalFull(dayStem, dayBranch, input.month, [
        { pillar: "시주", stem: effectivePillars.hour?.hangul?.[0] ?? "", branch: effectivePillars.hour?.hangul?.[1] ?? "" },
        { pillar: "일주", stem: effectivePillars.day?.hangul?.[0] ?? "", branch: effectivePillars.day?.hangul?.[1] ?? "" },
        { pillar: "월주", stem: effectivePillars.month?.hangul?.[0] ?? "", branch: effectivePillars.month?.hangul?.[1] ?? "" },
        { pillar: "년주", stem: effectivePillars.year?.hangul?.[0] ?? "", branch: effectivePillars.year?.hangul?.[1] ?? "" },
      ], fortuneOpts?.shinsalMode ?? "default")
    : [];

  const shinsalBranchItems = (["시주", "일주", "월주", "년주"] as const).map(
    (name) => yuanGuoShinsalPillars.find((p) => p.pillar === name)?.branchItems ?? []
  );

  const PILLAR_TO_POSITIONS: Record<string, { stem: string; branch: string }> = {
    시주: { stem: "시천간", branch: "시지" },
    일주: { stem: "일천간", branch: "일지" },
    월주: { stem: "월천간", branch: "월지" },
    년주: { stem: "연천간", branch: "연지" },
  };

  const autoShinsalSet = new Set<string>(
    yuanGuoShinsalPillars.flatMap((ps) => [
      ...(ps.pillarItems ?? []), ...(ps.stemItems ?? []), ...(ps.branchItems ?? []),
    ])
  );

  const autoShinsalByPosition = new Map<string, Set<string>>();
  for (const ps of yuanGuoShinsalPillars) {
    const pos = PILLAR_TO_POSITIONS[ps.pillar];
    if (!pos) continue;
    const stemSet = autoShinsalByPosition.get(pos.stem) ?? new Set<string>();
    for (const n of [...(ps.pillarItems ?? []), ...(ps.stemItems ?? [])]) stemSet.add(n);
    autoShinsalByPosition.set(pos.stem, stemSet);
    const branchSet = autoShinsalByPosition.get(pos.branch) ?? new Set<string>();
    for (const n of (ps.branchItems ?? [])) branchSet.add(n);
    autoShinsalByPosition.set(pos.branch, branchSet);
  }

  const yuanGuoFinalShinsalNames = new Set<string>();
  for (const ps of yuanGuoShinsalPillars) {
    const pos = PILLAR_TO_POSITIONS[ps.pillar];
    if (!pos) continue;
    const stemItems = [...(ps.pillarItems ?? []), ...(ps.stemItems ?? [])];
    const branchItems = ps.branchItems ?? [];
    for (const n of stemItems) {
      yuanGuoFinalShinsalNames.add(n);
    }
    for (const n of branchItems) {
      yuanGuoFinalShinsalNames.add(n);
    }
  }
  // 원국 탭 수동 편집 반영(원국 표시 전용)
  for (const it of excludedAutoShinsal) {
    if (it?.name) yuanGuoFinalShinsalNames.delete(it.name);
  }
  for (const it of manualShinsal) {
    if (it?.name) yuanGuoFinalShinsalNames.add(it.name);
  }

  const yuanGuoShinsalInterpretEntries = useMemo(
    () =>
      yuanGuoShinsalPillars.length > 0
        ? buildShinsalInterpretationList(yuanGuoShinsalPillars, branchRelations, shinsalLuckCtx)
        : [],
    [yuanGuoShinsalPillars, branchRelations, shinsalLuckCtx],
  );

  const shinsalComboNotes = useMemo(() => {
    const names = new Set<string>();
    for (const ps of yuanGuoShinsalPillars) {
      for (const n of [...(ps.pillarItems ?? []), ...(ps.stemItems ?? []), ...(ps.branchItems ?? [])]) {
        names.add(n);
      }
    }
    return buildShinsalCombinationNotes(names);
  }, [yuanGuoShinsalPillars]);

  const PILLAR_TO_TABLE_COL: Record<string, 0 | 1 | 2 | 3> = {
    시주: 0,
    일주: 1,
    월주: 2,
    년주: 3,
  };

  const shinsalPerColumn = useMemo(() => {
    const cols: Array<{ stem: ShinsalTagRef[]; branch: ShinsalTagRef[] }> = [
      { stem: [], branch: [] },
      { stem: [], branch: [] },
      { stem: [], branch: [] },
      { stem: [], branch: [] },
    ];
    for (const e of yuanGuoShinsalInterpretEntries) {
      const idx = PILLAR_TO_TABLE_COL[e.pillar];
      if (idx === undefined) continue;
      const ref: ShinsalTagRef = { id: e.id, name: e.name };
      if (e.anchor === "천간") cols[idx].stem.push(ref);
      else if (e.anchor === "지지") cols[idx].branch.push(ref);
      else cols[idx].stem.push(ref);
    }
    return cols;
  }, [yuanGuoShinsalInterpretEntries]);

  const yuanGuoOrderedShinsalInsights = useMemo(() => {
    // Order follows the same visual order as YuanGuo PillarTable:
    // 시→일→월→년 columns, and within each column: 천간 tags → 지지 tags.
    const orderedNames: string[] = [];
    for (const col of shinsalPerColumn) {
      for (const t of col.stem) orderedNames.push(t.name);
      for (const t of col.branch) orderedNames.push(t.name);
    }
    const seen = new Set<string>();
    const uniqueOrdered = orderedNames.filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    const byName = new Map<string, ShinsalInterpretationEntry>();
    for (const e of yuanGuoShinsalInterpretEntries) {
      if (!byName.has(e.name)) byName.set(e.name, e);
    }

    const names = uniqueOrdered.length > 0 ? uniqueOrdered : [...yuanGuoFinalShinsalNames];
    return names
      .filter((n) => yuanGuoFinalShinsalNames.has(n))
      .map((name) => ({ name, oneLine: byName.get(name)?.oneLine ?? "" }))
      .filter((x) => x.oneLine);
  }, [yuanGuoFinalShinsalNames, yuanGuoShinsalInterpretEntries, shinsalPerColumn]);

  // ── 오늘운세 신살(일운 기준): 오늘 일진 간지 vs 내 원국(일간/일지) ──
  const todayShinsalPillars = useMemo(() => {
    if (!dayStem || !dayBranch) return [];
    const gz = luckCycles?.ilun?.ganZhi;
    if (!gz?.stem || !gz?.branch) return [];
    return calculateShinsalFull(
      dayStem,
      dayBranch,
      input.month,
      [{ pillar: "일운", stem: gz.stem, branch: gz.branch }],
      fortuneOpts?.shinsalMode ?? "default",
    );
  }, [dayStem, dayBranch, luckCycles, input.month, fortuneOpts?.shinsalMode]);

  const todayFinalShinsalNames = useMemo(() => {
    const out = new Set<string>();
    for (const ps of todayShinsalPillars) {
      for (const n of [...(ps.pillarItems ?? []), ...(ps.stemItems ?? []), ...(ps.branchItems ?? [])]) out.add(n);
    }
    return out;
  }, [todayShinsalPillars]);

  const todayOrderedShinsalInsights = useMemo(() => {
    return [...todayFinalShinsalNames]
      .map((name) => ({ name, oneLine: formatTodayShinsalOneLine(name) }))
      .filter((x) => x.oneLine);
  }, [todayFinalShinsalNames]);

  const selectedShinsalEntry = useMemo(() => {
    if (yuanGuoInlineDetail?.kind !== "shinsal") return null;
    return yuanGuoShinsalInterpretEntries.find((e) => e.id === yuanGuoInlineDetail.id) ?? null;
  }, [yuanGuoInlineDetail, yuanGuoShinsalInterpretEntries]);

  const lifeFlowData = buildLifeFlowInsights(
    { ...record, maritalStatus },
    { finalShinsalNames: todayFinalShinsalNames }
  );

  const tenGodPairs = [
    ...(effectivePillars.hour ? [{ label: "시주", pillar: effectivePillars.hour }] : []),
    { label: "일주 (일간)", pillar: effectivePillars.day, isSelf: true },
    { label: "월주", pillar: effectivePillars.month },
    { label: "년주", pillar: effectivePillars.year },
  ];

  const spousePalace = dayBranch ? getSpousePalaceInfo(dayBranch) : null;
  const complementary = dayBranch ? getComplementaryInfo(dayBranch) : null;
  const marriageTiming = (dayStem && luckCycles.daewoon.length > 0)
    ? getMarriageTimingHint(input.gender, dayStem, luckCycles.daewoon)
    : null;
  const relationshipPattern = (dayStem && dayBranch)
    ? getRelationshipPattern(dayStem, dayBranch, effectiveFiveElements)
    : null;

  // ── 시주 비교 모드 계산 ────────────────────────────────────────
  const hasHourPillar = !!(pillars.hour && !input.timeUnknown);
  const fiveElNoHour = useMemo<FiveElementCount>(
    () => countFiveElementsNoHour(pillars as ComputedPillars),
    [pillars],
  );
  const shinsalNamesNoHour = useMemo<string[]>(() => {
    if (!dayStem || !dayBranch) return [];
    const noHourPillars = [
      { pillar: "일주", stem: pillars.day?.hangul?.[0] ?? "", branch: pillars.day?.hangul?.[1] ?? "" },
      { pillar: "월주", stem: pillars.month?.hangul?.[0] ?? "", branch: pillars.month?.hangul?.[1] ?? "" },
      { pillar: "년주", stem: pillars.year?.hangul?.[0] ?? "", branch: pillars.year?.hangul?.[1] ?? "" },
    ];
    const ps = calculateShinsalFull(dayStem, dayBranch, input.month, noHourPillars, "default");
    return ps.flatMap((p) => [...(p.pillarItems ?? []), ...(p.stemItems ?? []), ...(p.branchItems ?? [])]);
  }, [dayStem, dayBranch, pillars, input.month]);

  const fiveElDiff = useMemo<FiveElDiffEntry[]>(
    () => (hasHourPillar ? diffFiveElements(effectiveFiveElements, fiveElNoHour) : []),
    [hasHourPillar, effectiveFiveElements, fiveElNoHour],
  );
  const shinsalDiff = useMemo<ShinsalDiff>(
    () => (hasHourPillar ? diffShinsal(Array.from(yuanGuoFinalShinsalNames), shinsalNamesNoHour) : { added: [], removed: [] }),
    [hasHourPillar, yuanGuoFinalShinsalNames, shinsalNamesNoHour],
  );
  const anyDiff = hasAnyHourDiff(fiveElDiff, shinsalDiff);

  // ── 항상 시주 포함 기준 diff (hourMode와 무관) ────────────────
  const fiveElDiffBase = useMemo<FiveElDiffEntry[]>(() => {
    if (!hasHourPillar) return [];
    const { countFiveElements: countFull } = (() => {
      // countFiveElements of full pillars
      const counts: FiveElementCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
      const addEl = (ch: string | undefined) => {
        const el = ch ? STEM_ELEMENT[ch] : null;
        if (el && el in counts) counts[el as keyof FiveElementCount]++;
      };
      for (const p of Object.values(pillars)) {
        if (!p) continue;
        addEl(p.hangul?.[0]);
        addEl(p.hangul?.[1]);
      }
      return { countFiveElements: counts };
    })();
    return diffFiveElements(countFull, fiveElNoHour);
  }, [hasHourPillar, pillars, fiveElNoHour]);

  const shinsalNamesWithHour = useMemo<string[]>(() => {
    if (!dayStem || !dayBranch || !hasHourPillar) return [];
    const withHourPillars = [
      { pillar: "시주", stem: pillars.hour?.hangul?.[0] ?? "", branch: pillars.hour?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: pillars.day?.hangul?.[0] ?? "", branch: pillars.day?.hangul?.[1] ?? "" },
      { pillar: "월주", stem: pillars.month?.hangul?.[0] ?? "", branch: pillars.month?.hangul?.[1] ?? "" },
      { pillar: "년주", stem: pillars.year?.hangul?.[0] ?? "", branch: pillars.year?.hangul?.[1] ?? "" },
    ];
    const ps = calculateShinsalFull(dayStem, dayBranch, input.month, withHourPillars, "default");
    return ps.flatMap((p) => [...(p.pillarItems ?? []), ...(p.stemItems ?? []), ...(p.branchItems ?? [])]);
  }, [dayStem, dayBranch, hasHourPillar, pillars, input.month]);

  const shinsalDiffBase = useMemo<ShinsalDiff>(
    () => (hasHourPillar ? diffShinsal(shinsalNamesWithHour, shinsalNamesNoHour) : { added: [], removed: [] }),
    [hasHourPillar, shinsalNamesWithHour, shinsalNamesNoHour],
  );
  const anyDiffBase = hasAnyHourDiff(fiveElDiffBase, shinsalDiffBase);

  useEffect(() => {
    const anchor = reportMainTabsAnchorRef.current;
    if (!anchor) return;
    const updatePinned = () => {
      const top = anchor.getBoundingClientRect().top;
      setReportMainTabsPinned(top < APP_HEADER_OFFSET_PX);
    };
    updatePinned();
    window.addEventListener("scroll", updatePinned, { passive: true });
    window.addEventListener("resize", updatePinned);
    return () => {
      window.removeEventListener("scroll", updatePinned);
      window.removeEventListener("resize", updatePinned);
    };
  }, [hasHourPillar, hourMode, record.id]);

  // ── 시주 천간/지지 십성 ────────────────────────────────────────
  const hourStem = pillars.hour?.hangul?.[0] ?? null;
  const hourBranch = pillars.hour?.hangul?.[1] ?? null;
  const hourStemTg = hasHourPillar && dayStem && hourStem ? getTenGod(dayStem, hourStem) : null;
  const hourBranchTg = hasHourPillar && dayStem && hourBranch ? getTenGod(dayStem, hourBranch) : null;

  return (
    <div className="space-y-4">

      {/* ── 시주 모드 토글 (탭 바 위, 출생 시간 있을 때만) ── */}
      {hasHourPillar && (
        <div className="ds-segment-list min-h-10 rounded-xl border border-border shadow-none">
          {(["포함", "제외", "비교"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setHourMode(m)}
              className={cn(
                "ds-segment-item text-[12px] shadow-none",
                hourMode === m ? "ds-segment-item-active" : "ds-segment-item-inactive",
              )}
            >
              시주 {m}
            </button>
          ))}
        </div>
      )}

      {/* ── 시주 비교 표: '시주 비교' 탭 바로 아래 ── */}
      {hasHourPillar && hourMode === "비교" && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3 space-y-2.5">
          <div className="flex items-center gap-3">
            {/* 시주 글자 */}
            <div className="shrink-0 text-center">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-0.5">시주</p>
              <div className="flex gap-0.5">
                {hourStem && STEM_ELEMENT[hourStem] && (
                  <span className={`text-xl font-bold ${elementTextClass(STEM_ELEMENT[hourStem] as FiveElKey, "strong")}`}>{hourStem}</span>
                )}
                {hourBranch && STEM_ELEMENT[hourBranch] && (
                  <span className={`text-xl font-bold ${elementTextClass(STEM_ELEMENT[hourBranch] as FiveElKey, "strong")}`}>{hourBranch}</span>
                )}
              </div>
              <div className="flex gap-0.5 mt-0.5 justify-center flex-wrap">
                {hourStemTg && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${getTenGodTw(hourStemTg, dayStem)}`} style={getTenGodChipStyle(hourStemTg, dayStem)}>{hourStemTg}</span>}
                {hourBranchTg && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${getTenGodTw(hourBranchTg, dayStem)}`} style={getTenGodChipStyle(hourBranchTg, dayStem)}>{hourBranchTg}</span>}
              </div>
            </div>
            <div className="ds-inline-detail-nested flex-1 min-w-0 space-y-1.5">
              <p className="text-[11px] font-bold text-violet-600">시주 포함·제외 비교</p>
              {/* 오행 변화 */}
              {fiveElDiffBase.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {fiveElDiffBase.map(({ el, withHour, withoutHour, delta }) => (
                    <div key={el} className="flex items-center gap-0.5 rounded-md border border-border bg-muted/20 px-2 py-0.5">
                      <span className={`text-[12px] font-black ${elementTextClass(el as FiveElKey, "strong")}`}>{el}</span>
                      <span className="text-[11px] text-muted-foreground">{withoutHour}→{withHour}</span>
                      <span className={`text-[10px] font-bold ${delta > 0 ? "text-emerald-600" : "text-rose-500"}`}>{delta > 0 ? `+${delta}` : delta}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">오행 변화 없음</p>
              )}
              {/* 신살 변화 */}
              {(shinsalDiffBase.added.length > 0 || shinsalDiffBase.removed.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {shinsalDiffBase.removed.map((n) => (
                    <span key={`rem-${n}`} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border line-through opacity-50 ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>{n}</span>
                  ))}
                  {shinsalDiffBase.added.map((n) => (
                    <span key={`add-${n}`} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>+{n}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={reportMainTabsAnchorRef}>
        {reportMainTabsPinned && (
          <div
            className="shrink-0 border-b border-transparent"
            style={{ height: "calc(1rem + 2.75rem + 1px)" }}
            aria-hidden
          />
        )}
        <div
          className={cn(
            "z-30 border-b border-border/50 bg-background supports-[backdrop-filter]:bg-background/95 backdrop-blur-sm",
            reportMainTabsPinned
              ? "fixed top-14 left-0 right-0 py-2"
              : "-mx-4 px-4 py-2 supports-[backdrop-filter]:bg-background/85",
          )}
        >
          <div className={cn(reportMainTabsPinned && "mx-auto max-w-lg px-4")}>
            <div className="ds-segment-list min-h-11 rounded-xl border border-border shadow-none">
              {REPORT_MAIN_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setReportTab(tab)}
                  className={cn(
                    "ds-segment-item text-sm shadow-none",
                    reportTab === tab ? "ds-segment-item-active" : "ds-segment-item-inactive",
                  )}
                >
                  {REPORT_TAB_LABEL[tab]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 1: 원국 ── */}
      {reportTab === "원국" && (
        <div className="space-y-3">
          {dayStem && sajuPipelineResult && (
            <ReportAtAGlanceCard
              dayStem={dayStem}
              dayBranch={dayBranch}
              primaryEl={atAGlancePrimary}
              gukgukName={
                sajuPipelineResult.interpretation.gukguk?.name ??
                sajuPipelineResult.interpretation.structureType ??
                "—"
              }
              strengthLevel={sajuPipelineResult.adjusted.effectiveStrengthLevel}
              strengthScore={sajuPipelineResult.adjusted.strengthResult?.score}
              onPrimaryClick={() => scrollToYuanAnchor("yuan-five-el")}
              onGukgukClick={() => scrollToYuanAnchor("yuan-gukguk")}
              onStrengthClick={scrollToStrengthOrStructure}
            />
          )}

          <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">원국</span>은 표와 오행·십성의{" "}
            <span className="font-semibold text-foreground">구조(숫자·배치)</span>를 보는 탭입니다. 문장으로 풀어 쓴 기질·행동 해석은{" "}
            <span className="font-semibold text-foreground">성격 해석</span> 탭을 이용하세요.
          </div>

          {/* 사주팔자 — 항상 표시 */}
          <PillarTable
            pillars={pillarData}
            dayStem={dayStem}
            shinsalBranchItems={shinsalBranchItems}
            shinsalPerColumn={dayStem && dayBranch ? shinsalPerColumn : undefined}
            selectedShinsalId={yuanGuoInlineDetail?.kind === "shinsal" ? yuanGuoInlineDetail.id : null}
            onShinsalSelect={
              dayStem && dayBranch
                ? (id) =>
                    setYuanGuoInlineDetail((prev) =>
                      prev?.kind === "shinsal" && prev.id === id ? null : { kind: "shinsal", id },
                    )
                : undefined
            }
          />

          {yuanGuoInlineDetail?.kind === "shinsal" && selectedShinsalEntry ? (
            <SelectedShinsalInlineCard
              layout="panel"
              entry={selectedShinsalEntry}
              onClose={() => setYuanGuoInlineDetail(null)}
              onMore={() =>
                setInfoSheet({
                  kind: "shinsal",
                  name: selectedShinsalEntry.name,
                  source: "auto",
                  trigger: selectedShinsalEntry.triggerDetail || undefined,
                })
              }
            />
          ) : null}

          {dayStem && dayBranch && shinsalComboNotes.length > 0 ? (
            <div>
              <ShinsalCombinationsCard combinations={shinsalComboNotes} />
            </div>
          ) : null}

          <div id="yuan-oheung-card" className="ds-card shadow-none overflow-visible scroll-mt-4">
            <div className="border-b border-border bg-muted/20 px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">오행·십성 구조</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">원국 표와 함께 읽는 구조 데이터(개수·비율 중심)</p>
            </div>
            <div className="ds-card-pad space-y-6 overflow-visible">
              <div id="yuan-five-el" className="scroll-mt-4">
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">오행 분포 (구조)</h3>
                <FiveElementSection
                  variant="structure"
                  counts={effectiveFiveElements}
                  dayStem={dayStem}
                  monthBranch={pillars.month?.hangul?.[1]}
                  dayBranch={dayBranch}
                  allStems={allStems}
                  allBranches={allBranches}
                />
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">십성 분포 (구조)</h3>
                <p className="mb-2 text-[12px] leading-relaxed text-muted-foreground">
                  십성 칸을 누르면 <span className="font-semibold text-foreground">해당 십성 그룹(비겁·식상 등) 블록 바로 아래</span>에 상세가 열립니다. 신살은 원국표에서 선택하세요. 통합 해설은「더보기」로 확인하세요.
                </p>
          {dayStem && tenGodDisplayCounts ? (() => {
            const displayCounts = tenGodDisplayCounts;
            const allTgTotal = Object.values(displayCounts).reduce((s, c) => s + c, 0) || 1;
            const dayEl = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
            // Align group % with 오행 분포(구조) 기준 (same effectiveFiveElements totals)
            const { topLevel, detailed } = computeTenGodDistribution(dayStem, dayEl, allChars, effectiveFiveElements);
            const primary = dominantTenGodPair.primary;
            return (
              <div className="space-y-3">
                {Object.entries(TEN_GOD_GROUPS).map(([group, members]) => {
                  const groupCount = members.reduce((s, tg) => s + (displayCounts[tg] ?? 0), 0);
                  const groupPct = topLevel[group] ?? Math.round((groupCount / allTgTotal) * 100);
                  const openTg =
                    yuanGuoInlineDetail?.kind === "tengod" && members.includes(yuanGuoInlineDetail.tg)
                      ? yuanGuoInlineDetail.tg
                      : null;
                  return (
                    <div key={group}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[12px] font-bold text-foreground inline-flex items-center gap-1.5">
                          {group}
                          {primary?.group === group ? (
                            <span className="rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                              대표
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[12px] font-semibold text-muted-foreground">{groupPct}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {members.map((tg) => {
                          const cnt = displayCounts[tg as TenGod] ?? 0;
                          const pct = (detailed[tg] ?? Math.round((cnt / allTgTotal) * 100));
                          const isActive = yuanGuoInlineDetail?.kind === "tengod" && yuanGuoInlineDetail.tg === tg;
                          const rowEl = getTenGodElement(tg as TenGod, dayStem);
                          const chipStyle = getTenGodChipStyle(tg as TenGod, dayStem);
                          return (
                            <button
                              type="button"
                              key={tg}
                              onClick={() =>
                                setYuanGuoInlineDetail((prev) =>
                                  prev?.kind === "tengod" && prev.tg === tg ? null : { kind: "tengod", tg: tg as TenGod },
                                )
                              }
                              className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all active:scale-95"
                              style={
                                isActive && rowEl
                                  ? {
                                      backgroundColor: elementHslAlpha(rowEl, "strong", 0.09),
                                      border: `1px solid ${elementColorVar(rowEl, "strong")}`,
                                      color: elementColorVar(rowEl, "strong"),
                                    }
                                  : { ...chipStyle, border: "1px solid transparent" }
                              }
                            >
                              <span className="text-[13px] font-bold">{tg}</span>
                              <span className="text-[13px] font-semibold">{pct}%</span>
                            </button>
                          );
                        })}
                      </div>
                      {openTg && dayStem && tenGodDisplayCounts ? (
                        <div className="mt-2">
                          <TenGodNatalInlineBlock
                            dayStem={dayStem}
                            tg={openTg}
                            displayCounts={tenGodDisplayCounts}
                            onClose={() => setYuanGuoInlineDetail(null)}
                            onMore={() =>
                              setInfoSheet({ kind: "tengodNatal", tenGod: openTg, dayStem })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })() : (
                <p className="text-sm text-muted-foreground">일간 정보가 없어 십성 분포를 표시할 수 없습니다.</p>
              )}
              </div>
            </div>
          </div>

          {/* 신강/신약 (single source: sajuPipelineResult.adjusted.strengthResult) */}
          {sajuPipelineResult?.adjusted?.strengthResult && (
            <AccSection id="yuan-strength" title="일간 강도" defaultOpen>
              <DayMasterStrengthCard strength={sajuPipelineResult.adjusted.strengthResult} />
            </AccSection>
          )}

          {/* 격국·조후 */}
          {dayStem && (
            <AccSection id="yuan-gukguk" title="격국·조후" defaultOpen>
              <GukgukSection
                dayStem={dayStem}
                monthBranch={effectivePillars.month?.hangul?.[1]}
                allStems={allStems}
                allBranches={allBranches}
                pipelineGukguk={sajuPipelineResult?.interpretation.gukguk ?? null}
                pipelinePatterns={sajuPipelineResult?.interpretation.structurePatterns ?? []}
              />
              {seasonalNote ? (
                <div className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/40 p-3 shadow-none dark:border-sky-900/50 dark:bg-sky-950/25">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">조후(계절) 보정</p>
                  <div className="ds-inline-detail-nested mt-2 space-y-0">
                    <p className="text-sm leading-relaxed text-foreground break-words">{seasonalNote}</p>
                  </div>
                  {seasonalNote.length > LONG_SEASONAL_CHARS ? (
                    <button
                      type="button"
                      onClick={() => setInfoSheet({ kind: "seasonalDetail", title: "조후(계절) 보정", text: seasonalNote })}
                      className="mt-2 text-[12px] font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      조후 전체 보기 (긴 설명)
                    </button>
                  ) : null}
                </div>
              ) : null}
            </AccSection>
          )}

          {/* 지장간·12운성 */}
          <AccSection title="지장간 · 12운성" defaultOpen={false}>
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground mb-2">지장간</p>
                <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                  칸을 누르면 <span className="font-semibold text-foreground">이 섹션 아래</span>에 지장간 상세가 열립니다.
                </p>
                <div className="grid grid-cols-4 gap-0 rounded-xl overflow-hidden border border-border">
                  {[
                    { label: "시지", branch: pillars.hour?.hangul?.[1], isDay: false },
                    { label: "일지", branch: pillars.day?.hangul?.[1], isDay: true },
                    { label: "월지", branch: pillars.month?.hangul?.[1], isDay: false },
                    { label: "년지", branch: pillars.year?.hangul?.[1], isDay: false },
                  ].map(({ label, branch, isDay }, i) => {
                    const hidden = branch ? getHiddenStems(branch) : [];
                    const isSel =
                      yuanGuoInlineDetail?.kind === "hiddenStem" &&
                      yuanGuoInlineDetail.label === label &&
                      yuanGuoInlineDetail.branch === (branch ?? "");
                    return (
                      <div key={i} className={`border-r last:border-r-0 border-border ${isDay ? "bg-amber-50" : "bg-card"}`}>
                        <div className="text-center text-[13px] font-medium text-muted-foreground py-1.5 border-b border-border bg-muted/40">{label}</div>
                        <button
                          type="button"
                          disabled={!branch}
                          onClick={() => {
                            if (!branch) return;
                            setYuanGuoInlineDetail((prev) =>
                              prev?.kind === "hiddenStem" && prev.label === label && prev.branch === branch
                                ? null
                                : { kind: "hiddenStem", label, branch },
                            );
                          }}
                          className={cn(
                            "flex w-full flex-col items-center gap-1 border border-transparent py-2.5 px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            branch && "hover:bg-muted/20 active:bg-muted/35",
                            isSel && "border border-primary bg-primary/[0.06]",
                          )}
                        >
                          {branch ? (
                            <>
                              <span className="text-base font-bold text-foreground">{branch}</span>
                              {hidden.length > 0 ? (
                                <div className="flex flex-col items-center gap-0.5 mt-1">
                                  {hidden.map((s, j) => {
                                    const el = STEM_ELEMENT[s];
                                    return (
                                      <span
                                        key={j}
                                        className={cn(
                                          "rounded-sm border border-border px-1.5 py-0.5 text-[13px] font-semibold",
                                          el ? cn(elementBgClass(el, "muted"), elementTextClass(el, "strong")) : "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {s}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[13px] text-muted-foreground">-</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">?</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {dayStem && (
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground mb-2">12운성 · 일간 <span className="font-bold text-foreground">{dayStem}</span> 기준</p>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    행을 누르면 <span className="font-semibold text-foreground">이 섹션 아래</span>에 12운성 상세가 열립니다.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "시지", branch: pillars.hour?.hangul?.[1] },
                      { label: "일지", branch: pillars.day?.hangul?.[1] },
                      { label: "월지", branch: pillars.month?.hangul?.[1] },
                      { label: "년지", branch: pillars.year?.hangul?.[1] },
                    ].map(({ label, branch }) => {
                      if (!branch) return null;
                      const stage = getTwelveStage(dayStem, branch);
                      if (!stage) return null;
                      const isSel =
                        yuanGuoInlineDetail?.kind === "twelveStage" &&
                        yuanGuoInlineDetail.label === label &&
                        yuanGuoInlineDetail.branch === branch &&
                        yuanGuoInlineDetail.stage === stage;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setYuanGuoInlineDetail((prev) =>
                              prev?.kind === "twelveStage" &&
                              prev.label === label &&
                              prev.branch === branch &&
                              prev.stage === stage
                                ? null
                                : { kind: "twelveStage", label, branch, stage },
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-left transition-colors hover:bg-muted/15 dark:bg-card",
                            isSel && "border border-primary bg-primary/[0.06]",
                          )}
                        >
                          <span className="text-[13px] text-muted-foreground w-8 shrink-0">{label}</span>
                          <span className="text-base font-bold">{branch}</span>
                          <span className="text-muted-foreground shrink-0">·</span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${TWELVE_STAGE_COLOR[stage]}`}>{stage}</span>
                            <span className="line-clamp-2 text-[11px] text-muted-foreground mt-0.5">{TWELVE_STAGE_DESC[stage]}</span>
                          </div>
                        </button>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
              )}
              {yuanGuoInlineDetail?.kind === "hiddenStem" ? (
                <div className="mt-2">
                  <HiddenStemInlineCard
                    pillarLabel={yuanGuoInlineDetail.label}
                    branch={yuanGuoInlineDetail.branch}
                    stems={getHiddenStems(yuanGuoInlineDetail.branch)}
                    onClose={() => setYuanGuoInlineDetail(null)}
                  />
                </div>
              ) : null}
              {yuanGuoInlineDetail?.kind === "twelveStage" ? (
                <div className="mt-2">
                  <TwelveStageInlineCard
                    label={yuanGuoInlineDetail.label}
                    branch={yuanGuoInlineDetail.branch}
                    stage={yuanGuoInlineDetail.stage}
                    onClose={() => setYuanGuoInlineDetail(null)}
                  />
                </div>
              ) : null}
            </div>
          </AccSection>

          <AccSection id="yuan-branch-relations" title="천간 · 지지 관계" defaultOpen={false}>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                항목을 누르면 <span className="font-semibold text-foreground">바로 아래</span>에 관계 상세가 열립니다. 긴 해석은「더보기」를 이용하세요.
              </p>
              {branchRelations.length === 0 && (
                <p className="text-sm text-muted-foreground py-1">특별한 지지 관계가 없습니다.</p>
              )}
              {branchRelations.map((rel, i) => {
                const isSel =
                  yuanGuoInlineDetail?.kind === "branchRelation" &&
                  yuanGuoInlineDetail.relation.type === rel.type &&
                  yuanGuoInlineDetail.relation.description === rel.description;
                return (
                  <div key={i} className="space-y-2">
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-left transition-colors active:bg-muted/15 dark:bg-card",
                        isSel && "border border-primary bg-primary/[0.06]",
                      )}
                      onClick={() =>
                        setYuanGuoInlineDetail((prev) =>
                          prev?.kind === "branchRelation" &&
                          prev.relation.type === rel.type &&
                          prev.relation.description === rel.description
                            ? null
                            : { kind: "branchRelation", relation: rel },
                        )
                      }
                    >
                      <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full shrink-0 ${RELATION_COLORS[rel.type]}`}>{rel.type}</span>
                      <span className="text-sm font-medium flex-1 min-w-0 break-words">{rel.description}</span>
                    </button>

                    {isSel && (
                      <BranchRelationInlineCard
                        relation={rel}
                        onClose={() => setYuanGuoInlineDetail(null)}
                        onMore={() => {
                          const relBranches = rel.description.match(/[자축인묘진사오미신유술해]/g) ?? [];
                          setInfoSheet({
                            kind: "branchRelation",
                            relationType: rel.type,
                            branches: relBranches,
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </AccSection>

          {/* 계산 설정(전문가) UI는 결과 편집 방지를 위해 숨김 처리 */}

          {/* 수동 지지관계 추가 다이얼로그 */}
          {/* 관계 수동 추가 다이얼로그는 read-only 정책으로 제거 */}

          {/* ── 시주 영향 분석 카드 (비교 모드에서만 표시) ── */}
          {hasHourPillar && hourMode === "비교" && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3.5 space-y-3">
              {/* 헤더: 시주 글자 + 십성 */}
              <div className="flex items-start gap-3">
                <div className="shrink-0 text-center">
                  <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wide mb-0.5">시주</p>
                  <div className="flex gap-0.5">
                    {hourStem && (
                      <span className={`text-2xl font-bold ${STEM_ELEMENT[hourStem] ? elementTextClass(STEM_ELEMENT[hourStem] as FiveElKey, "strong") : ""}`}>{hourStem}</span>
                    )}
                    {hourBranch && (
                      <span className={`text-2xl font-bold ${STEM_ELEMENT[hourBranch] ? elementTextClass(STEM_ELEMENT[hourBranch] as FiveElKey, "strong") : ""}`}>{hourBranch}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-0.5 justify-center">
                    {hourStemTg && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(hourStemTg, dayStem)}`} style={getTenGodChipStyle(hourStemTg, dayStem)}>{hourStemTg}</span>}
                    {hourBranchTg && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(hourBranchTg, dayStem)}`} style={getTenGodChipStyle(hourBranchTg, dayStem)}>{hourBranchTg}</span>}
                  </div>
                </div>
                <div className="ds-inline-detail-nested flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">시주가 사주에 미치는 영향</p>
                  {hourStemTg && (
                    <p className="text-[12px] text-foreground leading-relaxed">
                      {TG_LUCK_MEANING[hourStemTg as TenGod]?.summary ?? ""}
                    </p>
                  )}
                </div>
              </div>

              {/* 오행 변화 */}
              {fiveElDiffBase.length > 0 && (
                <div className="ds-inline-detail-nested space-y-1.5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    시주 포함 시 오행 변화{" "}
                    <span className="font-normal normal-case text-violet-700">(위·아래 수치는 포함 vs 제외 차이)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {fiveElDiffBase.map(({ el, withHour, withoutHour, delta }) => (
                      <div key={el} className="flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2.5 py-1">
                        <span className={`text-[13px] font-black ${elementTextClass(el as FiveElKey, "strong")}`}>{el}</span>
                        <span className="text-[12px] text-muted-foreground">{withoutHour}→{withHour}</span>
                        <span className={`text-[11px] font-bold ${delta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 신살 변화 */}
              {(shinsalDiffBase.added.length > 0 || shinsalDiffBase.removed.length > 0) && (
                <div className="ds-inline-detail-nested space-y-1.5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">신살 변화</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shinsalDiffBase.removed.map((n) => (
                      <span key={`rem-${n}`} className={`text-[12px] font-bold px-2 py-0.5 rounded-full border line-through opacity-50 ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {n}
                      </span>
                    ))}
                    {shinsalDiffBase.added.map((n) => (
                      <span key={`add-${n}`} className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}>
                        +{n}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!anyDiffBase && (
                <p className="text-[12px] text-muted-foreground">시주를 포함해도 오행·신살 구성에 변화가 없습니다.</p>
              )}
            </div>
          )}

          <CopyButton buildText={() => buildPersonClipboardText(record)} label="사주 분석 전체 복사" />
        </div>
      )}

      {/* ── 탭 2: 성격 해석 ── */}
      {reportTab === "성격해석" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">성격 해석</span>은 문장으로 읽는{" "}
            <span className="font-semibold text-foreground">기질·행동·균형</span>을 ‘내 얘기처럼’ 풀어보는 탭이에요. 표·비율·지장간 같은 구조 데이터는{" "}
            <span className="font-semibold text-foreground">원국</span>에서 확인하면 더 편합니다.
          </div>
          {/* 사주 구조 요약 (항상 표시) */}
          {dayStem && (
            <SajuStructureSummary
              dayStem={dayStem}
              counts={effectiveFiveElements}
              monthBranch={pillars.month?.hangul?.[1]}
              dayBranch={dayBranch}
              allStems={allStems}
              allBranches={allBranches}
              pipelineStrength={sajuPipelineResult?.adjusted?.strengthResult ?? null}
              pipelineYongshinPrimary={sajuPipelineResult?.adjusted?.effectiveYongshin ?? null}
              pipelineYongshinSecondary={sajuPipelineResult?.adjusted?.effectiveYongshinSecondary ?? null}
              pipelineSeasonalNote={sajuPipelineResult?.interpretation?.seasonalNote ?? null}
              ruleInsights={ruleInsights}
            />
          )}

          {/* 일간 성향 카드 */}
          {dayStem && (
            <div className="ds-inline-detail overflow-visible">
              <div className="ds-inline-detail-body space-y-0 py-3.5">
                <p className="text-[13px] font-bold text-muted-foreground mb-1.5">일간 성향 · {dayStem}일간</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {getDayMasterSummaryFromStrength(dayStem, sajuPipelineResult?.adjusted?.effectiveStrengthLevel ?? "중화")}
                </p>
              </div>
            </div>
          )}

          {/* 오행 균형 — 원국 탭 오행·십성 카드와 동일 ds-card 패턴 */}
          <div className="ds-card shadow-none overflow-visible">
            <div className="border-b border-border bg-muted/20 px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">오행 균형 (성격·행동)</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                원국의 분포 수치를 ‘내 리듬’ 관점으로 읽어봐요
              </p>
            </div>
            <div className="ds-card-pad space-y-4">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                오행이 내 기질·행동에 어떤 균형을 만드는지 부드럽게 안내해요. 도형·간격·강조 기준은 원국 탭과 동일합니다.
              </p>
              {(() => {
                const acc = getElementBalanceAccent(effectiveFiveElements);
                const style: CSSProperties | undefined = acc
                  ? { backgroundColor: elementHslAlpha(acc, "strong", 0.06), borderColor: elementHslAlpha(acc, "strong", 0.22) }
                  : undefined;
                return (
                  <div className="rounded-xl border px-3 py-2.5" style={style}>
                    <p
                      className="mb-1 text-[13px] font-semibold"
                      style={acc ? { color: elementColorVar(acc, "strong") } : undefined}
                    >
                      오행 균형
                    </p>
                    <p className="text-sm text-foreground/90">{getElementBalanceSummary(effectiveFiveElements)}</p>
                  </div>
                );
              })()}
              <FiveElementSection
                variant="personality"
                counts={effectiveFiveElements}
                dayStem={dayStem}
                monthBranch={pillars.month?.hangul?.[1]}
                dayBranch={dayBranch}
                allStems={allStems}
                allBranches={allBranches}
              />
            </div>
          </div>

          {/* 십성 분포 */}
          <AccSection title="십성 분포 (행동 스타일)" defaultOpen>
            {dayStem ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-muted-foreground mb-2.5">
                    그룹을 누르면 <span className="font-semibold text-foreground">바로 아래</span>에 행동·기질 해석이 열려요. 관계·직업·감정 쪽은 「더보기」로 이어서 볼 수 있어요.
                  </p>
                  <TenGodDistributionSection
                    dayStem={dayStem}
                    dayEl={STEM_ELEMENT[dayStem] as FiveElKey | undefined}
                    allChars={allChars}
                    effectiveFiveElements={effectiveFiveElements}
                    dominantPrimary={dominantTenGodPair.primary}
                    dominantSecondary={dominantTenGodPair.secondary}
                    monthBranch={pillars.month?.hangul?.[1]}
                    dayBranch={dayBranch}
                    allStems={allStems}
                    allBranches={allBranches}
                    rowHighlightMode="personality"
                    personalityUserHasTapped={personalityTengodUserPicked}
                    selectedGroup={selectedTgGroupInline?.group ?? null}
                    selectedGroupInlineSlot={
                      selectedTgGroupInline ? (
                        <TenGodGroupInlineCard
                          group={selectedTgGroupInline.group}
                          pct={selectedTgGroupInline.pct}
                          dayStem={dayStem}
                          onClose={() => {
                            setPersonalityTengodUserPicked(true);
                            setSelectedTgGroupInline(null);
                          }}
                          onMore={() =>
                            setInfoSheet({
                              kind: "tengod-group",
                              group: selectedTgGroupInline.group,
                              dayStem,
                              pct: selectedTgGroupInline.pct,
                            })
                          }
                        />
                      ) : null
                    }
                    onTap={(group, pct) => {
                      setPersonalityTengodUserPicked(true);
                      setSelectedTgGroupInline((prev) => (prev?.group === group ? null : { group, pct }));
                    }}
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
                                <span className={`font-bold ${stemEl ? elementTextClass(stemEl, "strong") : ""}`}>{stem}</span>
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                {stemTg ? (
                                  <span className={`text-[13px] px-1.5 py-0.5 rounded font-bold ${getTenGodTw(stemTg, dayStem)}`} style={getTenGodChipStyle(stemTg, dayStem)}>{stemTg}</span>
                                ) : <span className="text-[13px] text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                <span className={`font-bold ${branchEl ? elementTextClass(branchEl, "strong") : ""}`}>{branch}</span>
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                {branchTg ? (
                                  <span className={`text-[13px] px-1.5 py-0.5 rounded font-bold ${getTenGodTw(branchTg, dayStem)}`} style={getTenGodChipStyle(branchTg, dayStem)}>{branchTg}</span>
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
            <AccSection title="배우자궁" defaultOpen>
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

          {/* 연애·관계 구조 (오늘운세 탭에서 이동) */}
          {(complementary || marriageTiming || relationshipPattern) && (
            <AccSection title="연애·관계 구조" defaultOpen>
              <div className="space-y-3">
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
                            <span
                              key={b}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-sm font-bold",
                                el
                                  ? cn(elementBgClass(el as FiveElKey, "muted"), elementTextClass(el as FiveElKey, "strong"), "border border-border")
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {b}
                            </span>
                          );
                        })}
                        {complementary.elements.map((e) => (
                          <span
                            key={e}
                            className={cn(
                              "rounded-full border border-border px-2 py-1 text-[13px]",
                              cn(elementBgClass(e as FiveElKey, "muted"), elementTextClass(e as FiveElKey, "strong")),
                            )}
                          >
                            {e} 기운
                          </span>
                        ))}
                      </div>
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

                {(lifeFlowData?.relationshipTiming || lifeFlowData?.connectionActivation) && (
                  <Card className="border-rose-100 bg-rose-50/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-rose-700">배우자 운 흐름</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="rounded-lg bg-white/70 border border-border/60 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-muted-foreground mb-1">현재 흐름</p>
                        <p className="text-sm text-foreground">{lifeFlowData.relationshipTiming.current}</p>
                      </div>
                      <div className="rounded-lg bg-white/70 border border-border/60 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-muted-foreground mb-1">다가오는 흐름</p>
                        <p className="text-sm text-foreground">{lifeFlowData.relationshipTiming.upcoming}</p>
                      </div>
                      <div className="rounded-lg bg-white/70 border border-border/60 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-muted-foreground mb-1">인연운 활성</p>
                        <p className="text-sm text-foreground">{lifeFlowData.connectionActivation.summary}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">{lifeFlowData.connectionActivation.period}</p>
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
              </div>
            </AccSection>
          )}
        </div>
      )}

      {/* ── 탭 3: 운세 ── */}
      {reportTab === "운세" && (
        <div className="space-y-3">
          <div className="ds-card overflow-hidden shadow-none">
            <div className="border-b border-border px-4 pb-2 pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                운 흐름
              </h3>
            </div>
            <div className="ds-card-pad">
              <LuckFlowTabs
                luckCycles={luckCycles}
                dayStem={dayStem}
                birthYear={input.year}
                record={record}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 4: 오늘운세 (오늘 하루 기준) ── */}
      {reportTab === "오늘운세" && dayStem && lifeFlowData && (
        <div className="space-y-3">
          {(() => {
            const now = new Date();
            const fortune = todayFortune;
            const dayGanZhi = fortune.dayGanZhiStr ?? "";
            const dayStemChar = dayGanZhi[0] ?? "";
            const dayBranchChar = dayGanZhi[1] ?? "";
            const dayLayer = fortune.luckLayers.find((l) => l.label === "일운") ?? fortune.luckLayers[fortune.luckLayers.length - 1];
            const tgStem = dayLayer?.tenGod as TenGod | undefined;
            const tgBranch = dayLayer?.branchTenGod as TenGod | undefined;
            const hint = tgStem ? (TG_LUCK_MEANING[tgStem]?.summary ?? "") : "";
            const layerCount = fortune.luckLayers?.length ?? 0;

            return (
              <div className="space-y-3">
                {/* 1) 오늘의 한눈에 보기 */}
                {(() => {
                  const KEYWORD_STYLES = [
                    "border-indigo-200/60 bg-indigo-500/10 text-indigo-700",
                    "border-teal-200/60 bg-teal-500/10 text-teal-700",
                    "border-primary/30 bg-primary/10 text-primary",
                  ];
                  const domainToChip = (lvl: "good" | "neutral" | "caution") => {
                    if (lvl === "good") return "border-emerald-200/60 bg-emerald-500/10 text-emerald-700";
                    if (lvl === "caution") return "border-orange-200/60 bg-orange-500/10 text-orange-700";
                    return "border-border bg-muted/50 text-muted-foreground";
                  };
                  const domainToMiniCard = (lvl: "good" | "neutral" | "caution") => {
                    if (lvl === "good") return "border-emerald-200/70 bg-emerald-50/60";
                    if (lvl === "caution") return "border-orange-200/70 bg-orange-50/60";
                    return "border-border/70 bg-muted/20";
                  };

                  return (
                    <div className="space-y-2">
                      {/* Layer 1) Hero gradient 영역 (키워드 칩까지) */}
                      <div className="ds-card relative overflow-hidden border-border/60 shadow-none">
                        {(() => {
                          const elA = (charToElement(dayStemChar) ?? "토") as FiveElKey;
                          const elB = (charToElement(dayBranchChar) ?? elA) as FiveElKey;
                          const c1 = elementHslAlpha(elA, "strong", 0.18);
                          const c2 = elementHslAlpha(elB, "strong", 0.14);
                          return (
                            <div
                              aria-hidden
                              className="absolute inset-0"
                              style={{
                                backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, rgba(255,255,255,0) 100%)`,
                                backgroundColor: "hsl(var(--card))",
                              }}
                            />
                          );
                        })()}

                        <div className="relative border-b border-border/50 bg-white/40 px-4 py-2.5">
                          <p className="ds-caption font-semibold tracking-wide text-[hsl(var(--app-label-accent))]">
                            ✨ 오늘 한눈에 보기 — {fortune.dateLabel}
                          </p>
                        </div>
                        <div className="relative ds-card-pad space-y-2.5">
                          {/* 상단 1줄: 오늘의 일진 + 키워드 칩 (스크린샷 레이아웃) */}
                          <div className="rounded-2xl border border-border/50 bg-white/60 backdrop-blur-sm px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[13px] font-semibold text-muted-foreground shrink-0">오늘의 일진</span>
                                <span className="text-[18px] font-extrabold tracking-wide shrink-0">
                                  <span className={dayStemChar ? elementTextClass((charToElement(dayStemChar) ?? "토") as FiveElKey, "strong") : "text-foreground"}>{dayStemChar}</span>
                                  <span className={dayBranchChar ? elementTextClass((charToElement(dayBranchChar) ?? "토") as FiveElKey, "strong") : "text-foreground"}>{dayBranchChar}</span>
                                </span>
                              </div>

                              {fortune.keywords.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1">
                                  {fortune.keywords.slice(0, 3).map((kw, i) => (
                                    <button
                                      key={kw}
                                      type="button"
                                      onClick={() =>
                                        setTodayHeroInline((prev) =>
                                          prev?.kind === "keyword" && prev.keyword === kw ? null : { kind: "keyword", keyword: kw },
                                        )
                                      }
                                      className={cn("ds-badge text-[10px] font-bold shadow-none", KEYWORD_STYLES[i % KEYWORD_STYLES.length])}
                                    >
                                      {kw}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 키워드 인라인 근거 카드 */}
                          {todayHeroInline?.kind === "keyword" && (
                            <div className="ds-inline-detail overflow-visible">
                              <div className="ds-inline-detail-header">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="ds-badge text-[12px] font-bold shadow-none border-border bg-muted/50 text-foreground">
                                      {todayHeroInline.keyword}
                                    </span>
                                    <span className="text-[12px] font-semibold text-muted-foreground">키워드 근거</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTodayHeroInline(null)}
                                  className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="ds-inline-detail-body">
                                <p className="text-[13px] text-foreground leading-relaxed">
                                  {(todayFortune.basisKeywords?.length ? todayFortune.basisKeywords.slice(0, 6).join(" · ") : "") || "근거 텍스트를 불러올 수 없습니다."}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 핵심 메시지 / 오늘 십성 / 한 줄 설명 */}
                          <div className="rounded-2xl border border-border/50 bg-white/60 backdrop-blur-sm px-4 py-3">
                            <p className="ds-body font-bold text-foreground">{fortune.summary}</p>
                            <div className="mt-2 mb-3 h-px w-full bg-border/60" />
                            {(tgStem || tgBranch) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-muted-foreground/80">오늘 십성</span>
                                {tgStem && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTodayHeroInline((prev) =>
                                        prev?.kind === "tengod" && prev.tenGod === tgStem ? null : { kind: "tengod", tenGod: tgStem },
                                      )
                                    }
                                    className={`ds-badge text-[10px] font-bold shadow-none ${getTenGodTw(tgStem, dayStem)}`}
                                    style={getTenGodChipStyle(tgStem, dayStem)}
                                  >
                                    {tgStem}
                                  </button>
                                )}
                                {tgBranch && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTodayHeroInline((prev) =>
                                        prev?.kind === "tengod" && prev.tenGod === tgBranch ? null : { kind: "tengod", tenGod: tgBranch },
                                      )
                                    }
                                    className={`ds-badge text-[10px] font-bold shadow-none ${getTenGodTw(tgBranch, dayStem)}`}
                                    style={getTenGodChipStyle(tgBranch, dayStem)}
                                  >
                                    {tgBranch}
                                  </button>
                                )}
                              </div>
                            )}
                            {/* 십성 인라인 설명 카드 */}
                            {todayHeroInline?.kind === "tengod" && (
                              <div className="mt-2 ds-inline-detail overflow-visible">
                                <div className="ds-inline-detail-header">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={`ds-badge text-[12px] font-bold shadow-none ${getTenGodTw(todayHeroInline.tenGod, dayStem)}`}
                                        style={getTenGodChipStyle(todayHeroInline.tenGod, dayStem)}
                                      >
                                        {todayHeroInline.tenGod}
                                      </span>
                                      <span className="text-[12px] font-semibold text-muted-foreground">십성 해설</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setTodayHeroInline(null)}
                                    className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground"
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="ds-inline-detail-body">
                                  <p className="text-[13px] text-foreground leading-relaxed">
                                    {TEN_GOD_TOOLTIP[todayHeroInline.tenGod]?.headline ?? ""}
                                    {TEN_GOD_TOOLTIP[todayHeroInline.tenGod]?.lines?.length ? ` — ${TEN_GOD_TOOLTIP[todayHeroInline.tenGod].lines.join(" · ")}` : ""}
                                  </p>
                                </div>
                              </div>
                            )}
                            {fortune.guidance && (
                              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                                오늘은 <span className="font-semibold text-foreground">“{fortune.guidance}”</span> 쪽으로 마음이 더 편하게 기울 수 있어요.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Layer 2) 카테고리 카드 영역 (항상 white) */}
                      <div className="rounded-xl border border-border/60 bg-white px-3.5 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                          {todayScoreRows.rows.map((r) => {
                            const active = todayDomainOpen === r.key;
                            return (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => {
                                  setTodayDomainUserPicked(true);
                                  setTodayDomainOpen((prev) => (prev === r.key ? null : r.key));
                                }}
                                className={cn(
                                  "rounded-lg border px-2.5 py-2 text-left transition-all active:scale-[0.98]",
                                  domainToMiniCard(r.lvl),
                                  active ? "ring-1 ring-primary/30 border-primary/30" : "hover:border-border",
                                )}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[12px] font-extrabold text-foreground/90">{r.key}</span>
                                  <span className="text-base leading-none" aria-hidden>{r.emoji}</span>
                                </div>
                                <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">{r.state}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Layer 3) 선택된 영역 상세 해석 (인라인) */}
                      {todayDomainOpen && (() => {
                          const row = todayScoreRows.rows.find((r) => r.key === todayDomainOpen);
                          if (!row) return null;
                          const sh = todayOrderedShinsalInsights.slice(0, 4).map((x) => x.name);
                          const basis = todayFortune.basisKeywords?.slice(0, 4) ?? [];
                          const layerText = todayFortune.luckLayers?.map((l) => `${l.label} ${l.ganZhi}`) ?? [];
                          const dayLayer =
                            todayFortune.luckLayers.find((l) => l.label === "일운") ??
                            todayFortune.luckLayers[todayFortune.luckLayers.length - 1];
                          const tgStem = (dayLayer?.tenGod ?? null) as TenGod | null;
                          const tgBranch = (dayLayer?.branchTenGod ?? null) as TenGod | null;
                          const both = [tgStem, tgBranch].filter(Boolean) as TenGod[];
                          const uniq = Array.from(new Set(both));
                          const tenGodText = uniq.length > 0 ? `${uniq.join(" · ")} 작동` : "십성 정보 없음";

                          const RECOMMEND_BY_DOMAIN: Record<typeof todayDomainOpen, string[]> = {
                            사랑: ["대화는 짧고 또렷하게 해보세요", "배려 표현은 한 번 먼저 건네보세요", "거리·빈도를 가볍게 조절해보세요"],
                            일: ["우선순위 1~2개만 잡아두면 좋아요", "계획을 짧게 적어보세요", "마감·정리부터 처리해보세요"],
                            돈: ["지출·수입을 한 번만 정리해보세요", "‘필요/욕구’를 잠깐 나눠보면 좋아요", "계약·결제는 한 번 더 확인해보세요"],
                            건강: ["수면·휴식을 먼저 챙겨보세요", "가벼운 산책 정도가 좋아요", "과로·과식은 조금만 줄여봐요"],
                            대인관계: ["약속은 단순하게 잡아두면 편해요", "경계선을 부드럽게 지켜봐요", "오해는 짧게 풀어두면 좋아요"],
                            학업: ["30~60분만 가볍게 시작해봐요", "글/메모로 정리해보면 좋아요", "새로 늘리기보다 복습이 잘 맞아요"],
                          };
                          const CAUTION_BY_DOMAIN: Record<typeof todayDomainOpen, string[]> = {
                            사랑: ["감정이 올라올 때 말로 바로 맞붙는 것", "확답을 서두르게 만드는 것", "상대 마음을 과하게 추측하는 것"],
                            일: ["즉흥적으로 일정을 늘리는 것", "한 번에 큰 결정을 확정하는 것", "불필요한 회의·잡일에 끌려가는 것"],
                            돈: ["충동구매", "무리한 투자·대출", "말로만 약속하는 거래"],
                            건강: ["무리한 운동", "야식·카페인을 과하게 늘리는 것", "스트레스를 그냥 넘기는 것"],
                            대인관계: ["감정적으로 바로 반응하는 것", "단정/험담", "기대·실망을 반복하는 것"],
                            학업: ["멀티태스킹", "완벽주의로 시작이 늦어지는 것", "밤샘 몰아치기"],
                          };

                          const summaryLines: string[] = [];
                          summaryLines.push(`오늘은 ${todayDomainOpen} 쪽에서 ${row.state} 흐름이 더 잘 느껴질 수 있어요.`);
                          if (row.hint) summaryLines.push(`${row.hint}`);
                          summaryLines.push(`오늘은 ${tenGodText} 쪽 기운이 함께 움직여서, ${todayDomainOpen}에서는 “정리·조절·선택”이 특히 편안하게 맞을 수 있어요.`);

                          const inlineTint =
                            row.lvl === "good"
                              ? "border-emerald-200/40 bg-emerald-500/5"
                              : row.lvl === "caution"
                                ? "border-orange-200/40 bg-orange-500/5"
                                : "border-border/60 bg-muted/10";

                          return (
                            <div className={cn("ds-inline-detail overflow-visible", inlineTint)}>
                              <div className="ds-inline-detail-header">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={cn("ds-badge text-[12px] font-bold shadow-none", domainToChip(row.lvl))}>
                                      {todayDomainOpen} {row.emoji} {row.state}
                                    </span>
                                    <span className="text-[12px] font-semibold text-muted-foreground">오늘 기준 상세 해석</span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    오늘 일진·십성·신살·운흐름 보조를 합쳐 요약합니다
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTodayDomainUserPicked(true);
                                    setTodayDomainOpen(null);
                                  }}
                                  className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="ds-inline-detail-body space-y-2">
                                {/* 1) 오늘 해석 요약 */}
                                <div className="ds-inline-detail-nested">
                                  <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">오늘 해석 요약</p>
                                  <div className="mt-1 space-y-1">
                                    {summaryLines.slice(0, 3).map((t, i) => (
                                      <p key={i} className="text-[13px] text-foreground leading-relaxed">{t}</p>
                                    ))}
                                  </div>
                                </div>

                                {/* 2) 추천 행동 */}
                                <div className="ds-inline-detail-nested">
                                  <p className="text-[12px] font-semibold text-emerald-700 mb-1">추천 행동</p>
                                  <ul className="mt-1 space-y-1">
                                    {(RECOMMEND_BY_DOMAIN[todayDomainOpen] ?? []).slice(0, 3).map((t) => (
                                      <li key={t} className="text-[13px] text-foreground leading-relaxed">- {t}</li>
                                    ))}
                                  </ul>
                                </div>

                                {/* 3) 주의 행동 */}
                                <div className="ds-inline-detail-nested">
                                  <p className="text-[12px] font-semibold text-amber-700 mb-1">주의 행동</p>
                                  <ul className="mt-1 space-y-1">
                                    {(CAUTION_BY_DOMAIN[todayDomainOpen] ?? []).slice(0, 3).map((t) => (
                                      <li key={t} className="text-[13px] text-foreground leading-relaxed">- {t}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="h-px w-full bg-border/60" />

                                {/* 4) 근거 영역 */}
                                <div className="ds-inline-detail-nested">
                                  <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">오늘 십성 작동</p>
                                  <p className="mt-1 text-[13px] text-foreground leading-relaxed">
                                    {uniq.length > 0 ? `오늘은 ${uniq.join(" · ")} 작동이 함께 나타납니다.` : "오늘 십성 정보를 계산할 수 없습니다."}
                                  </p>
                                </div>
                                {sh.length > 0 && (
                                  <div className="ds-inline-detail-nested">
                                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">오늘 신살</p>
                                    <p className="mt-1 text-[13px] text-foreground leading-relaxed">{sh.join(" · ")}</p>
                                  </div>
                                )}
                                {(basis.length > 0 || layerText.length > 0) && (
                                  <div className="ds-inline-detail-nested">
                                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">보조 근거</p>
                                    <p className="mt-1 text-[13px] text-foreground leading-relaxed">
                                      {basis.length > 0 ? basis.join(" · ") : layerText.slice(0, 4).join(" · ")}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  );
                })()}

                {/* 2) 오늘 전체 흐름 */}
                <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      오늘 전체 흐름
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <p className="text-sm text-foreground leading-relaxed">{lifeFlowData.overall.fullText}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {[
                        { label: "감정 흐름", text: lifeFlowData.overall.emotional },
                        { label: "결정 타이밍", text: lifeFlowData.overall.decisionTiming },
                        { label: "핵심 포인트", text: lifeFlowData.overall.activityFlow },
                      ].map(({ label, text }) => (
                        <div key={label} className="ds-inline-detail-nested space-y-0">
                          <p className="text-[13px] font-semibold text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-[13px] text-foreground">{text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 3) 오늘 십성 작동 */}
                <Card className="border-violet-100 bg-gradient-to-br from-violet-50/60 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-violet-700 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      오늘 십성 작동
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(() => {
                      const dayLayer =
                        fortune.luckLayers.find((l) => l.label === "일운") ??
                        fortune.luckLayers[fortune.luckLayers.length - 1];
                      const tgStem = (dayLayer?.tenGod ?? null) as TenGod | null;
                      const tgBranch = (dayLayer?.branchTenGod ?? null) as TenGod | null;
                      const both = [tgStem, tgBranch].filter(Boolean) as TenGod[];
                      const uniq = Array.from(new Set(both));
                      const help = tgStem ? (TG_LUCK_MEANING[tgStem]?.summary ?? "") : "";

                      if (uniq.length === 0) return <p className="text-sm text-muted-foreground">오늘 십성 정보를 계산할 수 없습니다.</p>;

                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {uniq.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    setTodayHeroInline((prev) =>
                                      prev?.kind === "tengod" && prev.tenGod === (t as TenGod) ? null : { kind: "tengod", tenGod: t as TenGod },
                                    )
                                  }
                                  className={`ds-badge text-[11px] font-bold shadow-none ${getTenGodTw(t as TenGod, dayStem)}`}
                                  style={getTenGodChipStyle(t as TenGod, dayStem)}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            <span className="text-[13px] text-muted-foreground">
                              오늘 일진 <span className="font-semibold text-foreground">{dayStemChar}</span>
                              {dayBranchChar ? (
                                <>
                                  <span className="mx-1 text-muted-foreground/60">·</span>
                                  <span className="font-semibold text-foreground">{dayBranchChar}</span>
                                </>
                              ) : null}{" "}
                              기준(천간·지지)
                            </span>
                          </div>
                          <div className="ds-inline-detail-nested">
                            <p className="text-[13px] text-foreground leading-relaxed">
                              오늘은 <span className="font-semibold">천간·지지</span>가 내 일간 기준으로 각각 십성으로 작동하며, 그 합이 하루 결의·반응에 영향을 줍니다.
                            </p>
                          </div>
                          {todayHeroInline?.kind === "tengod" && (
                            <div className="ds-inline-detail mt-2 overflow-visible">
                              <div className="ds-inline-detail-header">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`ds-badge text-[12px] font-bold shadow-none ${getTenGodTw(todayHeroInline.tenGod, dayStem)}`}
                                      style={getTenGodChipStyle(todayHeroInline.tenGod, dayStem)}
                                    >
                                      {todayHeroInline.tenGod}
                                    </span>
                                    <span className="text-[12px] font-semibold text-muted-foreground">십성 해설</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTodayHeroInline(null)}
                                  className="shrink-0 px-2 text-sm text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="ds-inline-detail-body space-y-2">
                                <div className="ds-inline-detail-nested">
                                  <p className="text-[13px] text-foreground leading-relaxed">
                                    {TEN_GOD_TOOLTIP[todayHeroInline.tenGod]?.headline ?? ""}
                                  </p>
                                  {TEN_GOD_TOOLTIP[todayHeroInline.tenGod]?.lines?.length ? (
                                    <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                                      {TEN_GOD_TOOLTIP[todayHeroInline.tenGod].lines.join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )}
                          {help ? (
                            <div className="ds-inline-detail-nested">
                              <p className="text-[13px] text-muted-foreground leading-relaxed">{help}</p>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* 4) 오늘 신살 작동 */}
                {todayOrderedShinsalInsights.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5" />
                        오늘 신살 작동
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        기준: <span className="font-semibold text-foreground">오늘 일진(일운) 간지</span> ↔{" "}
                        <span className="font-semibold text-foreground">내 원국(일간·일지)</span> 비교
                      </p>
                      <div className="space-y-2">
                        {todayOrderedShinsalInsights.map(({ name, oneLine }) => (
                          <div key={name} className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setInfoSheet({
                                  kind: "shinsal",
                                  name,
                                  source: "auto",
                                  trigger: oneLine,
                                })
                              }
                              className="inline-flex max-w-full text-left"
                            >
                              <ShinsalChip name={name} />
                            </button>
                            <div className="ds-inline-detail-nested">
                              <p className="text-[13px] text-foreground leading-relaxed">{oneLine}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 5) 오늘 행동 가이드 */}
                <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      오늘 행동 가이드
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div className="ds-inline-detail-nested">
                      <p className="text-[12px] font-semibold text-emerald-700 mb-1">추천 행동</p>
                      <p className="text-[13px] text-foreground leading-relaxed">
                        {fortune.guidance || "오늘은 무리한 확정보다, 우선순위를 정리해 한 가지를 끝내는 쪽이 유리합니다."}
                      </p>
                    </div>
                    <div className="ds-inline-detail-nested">
                      <p className="text-[12px] font-semibold text-amber-700 mb-1">피할 행동</p>
                      <p className="text-[13px] text-foreground leading-relaxed">
                        오늘은 감정이 앞선 즉흥 결정·과도한 약속·한 번에 많은 일을 확정하는 흐름은 피하는 편이 안전합니다.
                      </p>
                    </div>
                    <div className="ds-inline-detail-nested">
                      <p className="text-[12px] font-semibold text-indigo-700 mb-1">오늘 잘 맞는 방식</p>
                      <p className="text-[13px] text-foreground leading-relaxed">{lifeFlowData.overall.activityFlow}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 6) 운 흐름 보조 카드 (참고) */}
                <Card className="border-border/60 bg-muted/15">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      운 흐름 보조 카드
                      <span className="text-[11px] font-normal normal-case text-muted-foreground/80">(오늘 기준 해석을 보조)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <p className="text-[12px] text-muted-foreground">
                      오늘은 <span className="font-semibold text-foreground">일운</span>이 중심이며, 대운·세운·월운은 오늘의 톤을 보조합니다.
                    </p>
                    {layerCount > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {fortune.luckLayers.map((layer) => (
                          <div key={layer.label} className="rounded-lg border border-border/60 bg-white/50 px-2.5 py-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-muted-foreground font-medium w-7 shrink-0">{layer.label}</span>
                              <span className="font-bold text-sm">
                                {layer.ganZhi.split("").map((ch, i) => {
                                  const el = charToElement(ch);
                                  return (
                                    <span key={i} className={el ? elementTextClass(el as FiveElKey, "strong") : ""}>
                                      {ch}
                                    </span>
                                  );
                                })}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {layer.tenGod && (
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${getTenGodTw(layer.tenGod as TenGod, dayStem)}`}
                                  style={getTenGodChipStyle(layer.tenGod as TenGod, dayStem)}
                                >
                                  천:{layer.tenGod}
                                </span>
                              )}
                              {layer.branchTenGod && (
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${getTenGodTw(layer.branchTenGod as TenGod, dayStem)}`}
                                  style={getTenGodChipStyle(layer.branchTenGod as TenGod, dayStem)}
                                >
                                  지:{layer.branchTenGod}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* 개발 디버그 */}
          {import.meta.env.DEV && (
            <details className="rounded-lg border border-dashed border-border text-[13px] text-muted-foreground">
              <summary className="px-3 py-2 cursor-pointer font-mono font-bold hover:bg-muted/30">🛠 해석 입력 상태 (개발용)</summary>
              <div className="px-3 pb-3 pt-1 space-y-1 font-mono">
                <p><span className="font-bold">관계상태:</span> {maritalStatus ?? "미설정"}</p>
                <p><span className="font-bold">todayFinalShinsal 수:</span> {todayFinalShinsalNames.size}개</p>
                <p><span className="font-bold">todayFinalShinsal:</span> {todayFinalShinsalNames.size > 0 ? [...todayFinalShinsalNames].join(", ") : "없음"}</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* 결과(엔진 계산)는 read-only: 초기화/수동편집 UI 제거 */}

      {/* 오행/십성 수동 편집 UI는 read-only 정책으로 제거 */}

      {/* ── Bottom Sheet ── */}
      <InfoBottomSheet info={infoSheet} onClose={() => setInfoSheet(null)} />
    </div>
  );
}
