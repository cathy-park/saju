import { useState, useMemo, useRef, useCallback } from "react";
import type { ComputedPillars, FiveElementCount } from "@/lib/sajuEngine";
import { ELEMENT_BG_COLORS, ELEMENT_COLORS, countFiveElements, calculateProfileFromBirth } from "@/lib/sajuEngine";
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
  STRENGTH_LEVEL_INDEX,
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
import { TodayFortuneCard } from "@/components/TodayFortuneCard";
import { getFortuneForDate } from "@/lib/todayFortune";
import { buildLifeFlowInsights } from "@/lib/lifeFlowInsight";
import {
  getTenGod,
  getTenGodChipStyle,
  getTenGodTw,
  TEN_GOD_KEYWORDS, TEN_GOD_TOOLTIP, TEN_GOD_ELEMENT,
  tenGodCountsToFiveElements, autoCountTenGods,
  ALL_TEN_GOD_NAMES, TEN_GOD_GROUPS,
  type TenGod,
} from "@/lib/tenGods";
import { getHiddenStems, HIDDEN_STEMS_HANJA } from "@/lib/hiddenStems";
import { InfoBottomSheet, TG_LUCK_MEANING, TG_NATAL_MEANING } from "@/components/InfoBottomSheet";
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
  Sparkles,
  Layers,
  ChevronDown,
  User,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}: {
  title: string;
  defaultOpen?: boolean;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/40 pt-1">
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

const DAY_STEM_KEYWORD_BASIS: Record<string, Record<string, string>> = {
  갑: {
    리더십: "갑목은 천간의 첫 번째 자리로, 처음을 여는 양간입니다. 하늘을 향해 곧게 뻗는 큰 나무처럼 앞장서서 이끄는 성질이 강해 리더십이 자연스럽게 발현됩니다.",
    성장: "갑목의 본질은 끊임없이 위로 뻗어나가는 성장 에너지입니다. 현재에 안주하지 않고 더 높은 곳을 향해 나아가려는 의지가 강하게 작용합니다.",
    도전: "양목의 에너지는 장애물을 뚫고 나아가는 힘입니다. 어떤 어려움에도 굴하지 않고 새로운 길을 개척하려는 도전 정신이 핵심 기질로 나타납니다.",
  },
  을: {
    유연함: "을목은 바람에 휘어지면서도 꺾이지 않는 덩굴식물의 기운입니다. 상황에 따라 적절히 굽히며 적응하는 유연한 지혜가 본질입니다.",
    섬세함: "음목의 기운은 작은 것까지 세밀하게 관찰하는 능력을 줍니다. 타인의 마음과 환경의 미묘한 변화를 민감하게 감지하는 섬세한 감수성이 특성입니다.",
    조화: "을목은 주변과 어울리며 함께 자라는 성질을 지닙니다. 갈등보다 균형과 공존을 추구하며 자연스럽게 화합의 분위기를 만들어냅니다.",
  },
  병: {
    열정: "병화는 태양의 기운으로 불꽃처럼 타오르는 양간입니다. 내면에서 뿜어져 나오는 뜨거운 에너지가 열정이라는 키워드로 나타납니다.",
    표현력: "태양처럼 빛을 발산하는 병화는 자신을 드러내는 힘이 강합니다. 감정과 생각을 솔직하고 풍부하게 표현하는 능력이 자연스럽게 발현됩니다.",
    활력: "병화는 하루를 밝히는 태양처럼 주변에 생기를 불어넣습니다. 스스로 에너지가 넘치고 주위 사람들도 활기차게 만드는 특성을 지닙니다.",
  },
  정: {
    직관: "정화는 촛불처럼 은은하게 타는 음화입니다. 강렬한 외표보다 내면에서 빛나는 예리한 통찰과 직관이 강점으로 발현됩니다.",
    헌신: "촛불은 자신을 태워 주변을 밝힙니다. 정화 일간은 이처럼 아끼는 사람과 목표를 위해 자신을 아낌없이 내어주는 헌신의 기질이 강합니다.",
    세심함: "정화는 작고 세밀한 빛으로 구석구석을 비춥니다. 타인의 감정과 상황을 세심하게 살피고 배려하는 능력이 뛰어난 특성입니다.",
  },
  무: {
    신뢰: "무토는 거대한 산의 기운입니다. 흔들리지 않는 산처럼 일관된 태도를 유지하며 주변에서 믿고 의지할 수 있는 신뢰의 존재로 여겨집니다.",
    안정: "산은 오랜 시간 한자리를 지킵니다. 무토 일간은 이처럼 요동치지 않는 안정감을 지니며 주변에 심리적 안전감을 제공합니다.",
    중용: "무토는 오행의 중심에서 균형을 잡는 토 기운 중 가장 강한 형태입니다. 어느 한쪽으로 치우치지 않는 중용의 지혜가 핵심 특성입니다.",
  },
  기: {
    꼼꼼함: "기토는 비옥한 논밭의 기운으로 음토입니다. 세세한 것까지 챙기고 관리하는 능력이 뛰어나 꼼꼼함이 자연스럽게 발현됩니다.",
    인내: "기토는 씨앗이 뿌리를 내리고 싹을 틔울 수 있는 토양입니다. 결과가 나올 때까지 묵묵히 기다리는 인내력이 강한 특성입니다.",
    실용: "논밭은 실질적인 결실을 위한 공간입니다. 기토 일간은 현실적이고 실용적인 관점으로 문제를 해결하는 능력이 뛰어납니다.",
  },
  경: {
    결단력: "경금은 바위처럼 단단한 양금의 기운입니다. 흔들리지 않는 강한 의지와 과감한 결단으로 상황을 돌파하는 능력이 강합니다.",
    원칙: "단단한 금속처럼 경금은 자신의 기준을 쉽게 구부리지 않습니다. 원칙과 규칙을 중시하며 일관된 기준으로 행동하는 특성이 나타납니다.",
    강직함: "경금의 기운은 날카롭고 곧은 검과 같습니다. 불의에 굴하지 않고 옳다고 믿는 것을 직접적으로 말하고 행동하는 강직한 성품이 특성입니다.",
  },
  신: {
    완벽주의: "신금은 가공된 보석과 귀금속의 기운으로 음금입니다. 흠집 없이 완벽한 보석을 추구하듯 높은 기준을 추구하는 완벽주의적 성향이 나타납니다.",
    예민함: "신금은 아주 미세한 흠도 감지하는 예리함을 지닙니다. 환경과 사람의 미묘한 변화에 민감하게 반응하며 섬세하게 느끼는 예민한 감수성이 특성입니다.",
    정밀함: "귀금속 가공에는 높은 정밀도가 필요합니다. 신금 일간은 어떤 일이든 디테일을 놓치지 않고 정교하게 처리하는 정밀함이 강점입니다.",
  },
  임: {
    창의: "임수는 넓고 깊은 바다의 기운으로 양수입니다. 끝없이 넓은 바다처럼 무한한 상상력과 창의적인 아이디어가 넘치는 특성입니다.",
    유연성: "물은 어떤 그릇에도 담깁니다. 임수 일간은 다양한 상황과 사람에 자연스럽게 적응하는 뛰어난 유연성이 강점으로 발현됩니다.",
    통찰: "깊은 바다는 수면 아래 많은 것을 품습니다. 임수는 표면 너머의 본질을 꿰뚫어 보는 깊은 통찰력과 지혜를 타고납니다.",
  },
  계: {
    감성: "계수는 이슬·빗물처럼 섬세한 음수입니다. 풍부한 감수성으로 세상의 아름다움과 타인의 감정을 깊이 느끼는 감성적 기질이 강합니다.",
    적응력: "계수는 작은 물방울처럼 어디든 스며드는 성질을 지닙니다. 어떤 환경이든 유연하게 적응하며 자신의 자리를 만들어나가는 능력이 뛰어납니다.",
    지혜: "계수는 조용히 스며드는 물처럼 깊이 생각하고 느끼는 능력을 지닙니다. 직접적인 경험과 내면의 성찰로 세상의 이치를 파악하는 지혜가 특성입니다.",
  },
};

const ELEMENT_ENERGY_MEANING: Record<string, { title: string; nature: string; traits: string; inLife: string }> = {
  목: {
    title: "목 — 봄의 에너지",
    nature: "목은 씨앗이 땅을 뚫고 솟아나는 봄의 기운입니다. 위로 뻗어나가고 성장하려는 강한 의지가 핵심이며, 생명력과 창조의 에너지를 상징합니다.",
    traits: "인·사랑·리더십·시작하는 힘·뻗어나가는 의지. 강하게 뿌리를 내리면서도 위로 자라나는 이중적 에너지를 지닙니다.",
    inLife: "목 기운이 강한 사주는 성장과 도전을 즐기며 새로운 것을 시작하는 힘이 강합니다. 리더십과 추진력이 뛰어나지만 고집이 생길 수 있으니 유연함을 기르는 것이 좋습니다.",
  },
  화: {
    title: "화 — 여름의 에너지",
    nature: "화는 태양과 불꽃처럼 밝게 타오르는 여름의 기운입니다. 열정·표현·확산의 에너지로 주변을 밝히고 따뜻하게 만드는 힘을 상징합니다.",
    traits: "예·열정·표현력·사교성·빛과 따뜻함. 밝게 타오르며 주변에 에너지를 전파하는 기운입니다.",
    inLife: "화 기운이 강한 사주는 밝고 사교적이며 표현력이 뛰어납니다. 열정적으로 살아가지만 과열되면 조급함이나 감정 기복이 생길 수 있어 여유를 갖는 것이 도움됩니다.",
  },
  토: {
    title: "토 — 환절기의 에너지",
    nature: "토는 모든 계절의 전환점에서 중심을 잡아주는 대지의 기운입니다. 오행의 중심에서 균형을 유지하고 조화를 이루는 신뢰와 안정의 에너지입니다.",
    traits: "신·신뢰·안정·중용·포용력. 흔들리지 않는 토대처럼 모든 것을 받아들이고 중심을 잡습니다.",
    inLife: "토 기운이 강한 사주는 신뢰감이 높고 안정적입니다. 흔들리지 않는 강인함이 있지만 변화를 싫어하거나 고집스러울 수 있어 유연성을 갖는 것이 중요합니다.",
  },
  금: {
    title: "금 — 가을의 에너지",
    nature: "금은 단단한 광석과 보석의 기운으로 가을의 결실을 상징합니다. 정제·결단·수확의 에너지이며 불필요한 것을 걸러내는 의의 힘입니다.",
    traits: "의·결단력·원칙·강직함·정밀함. 날카롭고 단단하게 본질을 꿰뚫는 힘을 지닙니다.",
    inLife: "금 기운이 강한 사주는 결단력이 강하고 원칙을 중시합니다. 강직함이 장점이지만 지나치면 냉정하거나 고집스러워 보일 수 있어 따뜻함을 더하는 것이 좋습니다.",
  },
  수: {
    title: "수 — 겨울의 에너지",
    nature: "수는 바다와 강처럼 깊고 유연한 겨울의 기운입니다. 지혜·통찰·적응·저장의 에너지이며 모든 것을 품고 흘려보내는 지의 힘을 상징합니다.",
    traits: "지·지혜·감수성·유연성·통찰. 깊은 곳에서 흐르며 본질을 꿰뚫어 보는 힘입니다.",
    inLife: "수 기운이 강한 사주는 지혜롭고 감수성이 풍부합니다. 적응력이 뛰어나지만 과도하면 우유부단해지거나 감정에 빠질 수 있어 결단력을 기르는 것이 도움됩니다.",
  },
};

const ELEMENT_EXTRA_LABEL: Record<string, string> = {
  목: "목 기운 강",
  화: "화 기운 강",
  토: "토 기운 강",
  금: "금 기운 강",
  수: "수 기운 강",
};

type KeywordInfo = { title: string; basis: string; isElement?: boolean; elementKey?: string };

function CoreInsightChips({
  dayStem,
  fiveElement,
}: {
  dayStem: string;
  fiveElement: FiveElementCount;
}) {
  const [activeInfo, setActiveInfo] = useState<KeywordInfo | null>(null);
  const keywords = DAY_STEM_KEYWORDS[dayStem] ?? [];
  const dayEl = STEM_ELEMENT[dayStem];
  const sorted = (Object.entries(fiveElement) as [keyof FiveElementCount, number][])
    .filter(([el]) => el !== dayEl)
    .sort(([, a], [, b]) => b - a);
  const strongestExtra = sorted[0];

  return (
    <>
      <div className="flex flex-wrap gap-2 px-1 pb-1">
        {keywords.map((kw, idx) => {
          const basis = DAY_STEM_KEYWORD_BASIS[dayStem]?.[kw] ?? "";
          return (
            <button
              key={kw}
              onClick={() => setActiveInfo({ title: kw, basis })}
              className={`text-[13px] font-bold px-3 py-1 rounded-full border transition-all active:scale-95 hover:shadow-sm ${KEYWORD_COLORS[idx % KEYWORD_COLORS.length]}`}
            >
              {kw}
            </button>
          );
        })}
        {strongestExtra && strongestExtra[1] >= 2 && ELEMENT_EXTRA_LABEL[strongestExtra[0]] && (() => {
          const elKey = strongestExtra[0] as string;
          const elMeaning = ELEMENT_ENERGY_MEANING[elKey];
          return (
            <button
              onClick={() => elMeaning && setActiveInfo({
                title: ELEMENT_EXTRA_LABEL[elKey],
                basis: elMeaning.nature,
                isElement: true,
                elementKey: elKey,
              })}
              className={`text-[13px] font-bold px-3 py-1 rounded-full border transition-all active:scale-95 hover:shadow-sm ${
                elementBgClass(elKey as FiveElKey, "muted")
              } ${elementBorderClass(elKey as FiveElKey, "base")} ${elementTextClass(elKey as FiveElKey, "strong")}`}
            >
              {ELEMENT_EXTRA_LABEL[elKey]}
            </button>
          );
        })()}
      </div>

      <Drawer open={!!activeInfo} onOpenChange={(open) => !open && setActiveInfo(null)}>
        <DrawerContent>
          <div className="max-w-lg mx-auto w-full px-5 pb-8 pt-1">
            <DrawerHeader className="text-left px-0 pb-3">
              <DrawerTitle className="text-xl font-bold">{activeInfo?.title}</DrawerTitle>
            </DrawerHeader>
            {activeInfo && (
              <div className="space-y-3 text-sm">
                {activeInfo.isElement && activeInfo.elementKey ? (() => {
                  const em = ELEMENT_ENERGY_MEANING[activeInfo.elementKey];
                  if (!em) return null;
                  return (
                    <>
                      <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">기운의 본질</p>
                        <p className="leading-relaxed">{em.nature}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">핵심 특성</p>
                        <p className="leading-relaxed">{em.traits}</p>
                      </div>
                      <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3">
                        <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wide mb-1.5">삶에서의 발현</p>
                        <p className="leading-relaxed">{em.inLife}</p>
                      </div>
                    </>
                  );
                })() : (
                  <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">이 키워드가 뜬 이유</p>
                    <p className="leading-relaxed">{activeInfo?.basis}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
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
          {editMode && (
            <>
              <button onClick={handleSave} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-primary text-primary-foreground transition-all active:scale-95">저장</button>
              <button onClick={handleCancel} className="text-[12px] font-medium px-3 py-1 rounded-lg border border-border text-muted-foreground transition-all active:scale-95">취소</button>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-border">
        <table className="w-full border-collapse table-fixed">
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
                        {c.stemChar}
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
                <td key={i} className={`text-center py-1.5 px-0.5 border-l border-border/40 ${c.isDayMaster ? "bg-amber-50" : ""}`}>
                  {c.isUnknown ? <span className="text-xl text-muted-foreground">?</span> : (
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-bold leading-tight ${c.branchEl ? ELEMENT_COLORS[c.branchEl] : ""}`}>
                        {c.branchChar}
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
                    <span className="text-[10px] text-muted-foreground leading-tight block whitespace-normal break-words">{c.effShinsal || "-"}</span>
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

/** 오행도 원 하단 채움 — 베이스 파스텔에서 약 10% 진하게(원색→검정 10% 블렌드) */
const ELEMENT_PENTAGON_FILL: Record<FiveElKey, string> = {
  수: "#C9D5DD",
  목: "#CBDCD2",
  화: "#E1CBCA",
  토: "#DFD5BD",
  금: "#D1D3D5",
};

function FiveElementSection({
  counts,
  dayStem,
  monthBranch,
  dayBranch,
  allStems,
  allBranches,
}: {
  counts: FiveElementCount;
  dayStem?: string;
  monthBranch?: string;
  dayBranch?: string;
  allStems?: string[];
  allBranches?: string[];
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
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          오행 분포: <span className="font-semibold text-foreground">천간+지지</span> 기준
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          용신 계산: <span className="font-semibold text-foreground">지장간 가중치 포함</span>
        </p>
      </div>
      <div className="flex gap-4 text-[12px] self-start">
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="text-blue-500 font-bold">→</span> 상생
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="text-red-500 font-bold">→</span> 상극
        </span>
      </div>
      <div className="self-start flex items-center gap-2">
        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${elementBgClass(primaryEl, "muted")} ${elementBorderClass(primaryEl, "strong")}`}>
          대표 오행
        </span>
        <span className={`text-[13px] font-black ${elementTextClass(primaryEl, "strong")}`}>{primaryEl}</span>
      </div>
      <svg viewBox="0 0 296 296" width="100%" style={{ maxWidth: 444 }}>
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
          /* 대표 원 테두리 = 십성 분포 %·칩 글자 strong 토큰 */
          const stroke = isPrimary ? elementColorVar(el, "strong") : "hsl(var(--border))";
          const strokeW = isPrimary ? 1.75 : 1.5;
          /* 십성 분포 행 라벨과 동일: 대표 오행만 strong, 나머지 foreground */
          const elLabelFill = isPrimary ? elementColorVar(el, "strong") : "hsl(var(--foreground))";
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
              {/* 채움 위에 테두리가 오도록 stroke 전용 원을 맨 위(텍스트 제외)에 둠 */}
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
                <text x={x} y={y + 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="hsl(var(--muted-foreground))">({tenGodGroup})</text>
              )}
              <text x={x} y={y + (tenGodGroup ? 18 : 11)} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
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

/** 십성 그룹 행 UI 색 — 일간과 무관하게 木→火→土→金→水 범례(참고 UI와 동일) */
type TenGodGroupKey = "비겁" | "식상" | "재성" | "관성" | "인성";
const TEN_GOD_GROUP_ROW_ELEMENT: Record<TenGodGroupKey, FiveElKey> = {
  비겁: "목",
  식상: "화",
  재성: "토",
  관성: "금",
  인성: "수",
};

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

  return { topLevel, detailed };
}

function TenGodDistributionSection({
  dayStem,
  dayEl,
  allChars,
  effectiveFiveElements,
  onTap,
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
  monthBranch?: string;
  dayBranch?: string;
  allStems?: string[];
  allBranches?: string[];
}) {
  const groups = ["비겁", "식상", "재성", "관성", "인성"] as const;
  const { topLevel, detailed } = computeTenGodDistribution(dayStem, dayEl, allChars, effectiveFiveElements);

  const primaryEl = computePrimaryElement({
    counts: effectiveFiveElements,
    monthBranch,
    dayBranch,
    allStems,
    allBranches,
  });

  return (
    <div className="space-y-3">
      {/* Bar rows with sub-categories */}
      <div className="space-y-3">
        {groups.map((g) => {
          const pct = topLevel[g];
          const rowEl = TEN_GOD_GROUP_ROW_ELEMENT[g as TenGodGroupKey];
          const [s1, s2] = TG_SUB_PAIRS[g];
          const p1 = detailed[s1] ?? 0;
          const p2 = detailed[s2] ?? 0;
          /* 대표 오행(오행 분포와 동일) = 이 행의 고정 범례 오행일 때만 강조 */
          const isPrimaryRow = primaryEl === rowEl;
          const rowSurface =
            isPrimaryRow
              ? {
                  backgroundColor: elementHslAlpha(rowEl, "base", 0.1),
                  borderColor: elementHslAlpha(rowEl, "base", 0.22),
                  borderWidth: 1,
                  borderStyle: "solid" as const,
                }
              : undefined;
          return (
            <div
              key={g}
              className="rounded-xl px-2 py-1 transition-colors"
              style={rowSurface}
            >
              <button
                type="button"
                onClick={() => onTap(g, pct)}
                className="w-full flex items-center gap-3 text-left rounded px-1 py-0.5 transition-opacity hover:opacity-90"
              >
                <span
                  className={`w-10 text-[13px] font-semibold shrink-0 ${isPrimaryRow ? "" : "text-foreground"}`}
                  style={isPrimaryRow ? { color: elementColorVar(rowEl, "strong") } : undefined}
                >
                  {g}
                </span>
                <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: elementColorVar(rowEl, "base"),
                    }}
                  />
                </div>
                <span
                  className="text-[13px] font-bold whitespace-nowrap text-right px-2 py-0.5 rounded-full border border-solid"
                  style={{
                    backgroundColor: elementHslAlpha(rowEl, "base", 0.1),
                    color: elementColorVar(rowEl, "strong"),
                    borderColor: elementHslAlpha(rowEl, "base", 0.28),
                  }}
                >
                  {pct}%
                </span>
              </button>
              {/* Subcategory pills — 범주색 ~10% 배경 + 연한 테두리 */}
              <div className="flex gap-1.5 mt-1 ml-11">
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-solid text-[11px]"
                  style={{
                    backgroundColor: elementHslAlpha(rowEl, "base", 0.1),
                    borderColor: elementHslAlpha(rowEl, "base", 0.28),
                    color: elementColorVar(rowEl, "strong"),
                  }}
                >
                  <span className="font-semibold">{s1}</span>
                  <span className="opacity-80">{p1}%</span>
                </span>
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-solid text-[11px]"
                  style={{
                    backgroundColor: elementHslAlpha(rowEl, "base", 0.1),
                    borderColor: elementHslAlpha(rowEl, "base", 0.28),
                    color: elementColorVar(rowEl, "strong"),
                  }}
                >
                  <span className="font-semibold">{s2}</span>
                  <span className="opacity-80">{p2}%</span>
                </span>
              </div>
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
    <div className="rounded-2xl border px-4 py-4 bg-gradient-to-br from-sky-50/70 to-white border-sky-200 space-y-2.5">
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
  overrideStrengthLevel?: string | null;
  overrideYongshinData?: YongshinEntry[] | null;
  onStrengthLevelChange?: (lv: string | null) => void;
  onYongshinDataChange?: (data: YongshinEntry[]) => void;
}) {
  const [editMode, setEditMode] = useState<"none" | "strength" | "yongshin">("none");
  const [activeYongshinType, setActiveYongshinType] = useState<YongshinType>("억부용신");
  const [localYongshinData, setLocalYongshinData] = useState<YongshinEntry[]>(overrideYongshinData ?? []);

  // Use buildInterpretSchema only for display metadata (대표 오행 등).
  // Strength/Yongshin/Johu must come from pipeline to avoid mismatches across screens.
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
          <p className={`text-base font-bold ${ELEMENT_COLORS[baseSchema.dominantElement]}`}>
            {baseSchema.dominantElement}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{ELEMENT_KO[baseSchema.dominantElement].split(" ")[1] ?? ""}</p>
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
          <p className="text-base font-bold text-foreground">{strengthDisplayLabel}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {strengthDesc}
            {typeof strengthScore === "number" && Number.isFinite(strengthScore) ? ` · ${strengthScore}점` : ""}
          </p>
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
              <span className="text-[9px] font-bold text-orange-500 bg-orange-50 rounded px-1 align-middle">자동</span>
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
              <p className={`text-base font-bold ${ELEMENT_COLORS[yongshinPrimary]}`}>{yongshinPrimary}</p>
              {yongshinSecondary && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  희신: <span className={ELEMENT_COLORS[yongshinSecondary]}>{yongshinSecondary}</span>
                </p>
              )}
            </>
          )}
        </button>
      </div>

      {pipelineSeasonalNote && (
        <p className="text-[12px] text-amber-700/80 leading-relaxed border-l-2 border-amber-300 pl-2">
          {pipelineSeasonalNote}
        </p>
      )}

      <StrengthGraph level={strengthLevelEffective} />

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
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 space-y-1">
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
                <span style={{ color: stemEl ? elementColorVar(stemEl, "base") : "hsl(var(--muted-foreground))" }}>{ganjiStr[0] ?? ""}</span>
                <span style={{ color: branchEl ? elementColorVar(branchEl, "base") : "hsl(var(--muted-foreground))" }}>{ganjiStr[1] ?? ""}</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: dot }} />
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
            <div className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3">
              <p className="text-[13px] text-muted-foreground mb-1.5">일운 · {viewMonth}월 {selectedDay}일</p>
              <div className="flex gap-0.5 items-baseline">
                <span className={`text-xl font-bold ${se ? ELEMENT_COLORS[se] : ""}`}>{dayGZ.stem}</span>
                <span className={`text-xl font-bold ${be ? ELEMENT_COLORS[be] : ""}`}>{dayGZ.branch}</span>
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
          <span className={se ? ELEMENT_COLORS[se] : ""}>{ganZhi.stem}</span>
          <span className={be ? ELEMENT_COLORS[be] : ""}>{ganZhi.branch}</span>
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
      {/* Tab switcher */}
      <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-all active:scale-95 ${
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
                        <span className={`text-xl font-bold ${stemEl ? ELEMENT_COLORS[stemEl] : ""}`}>{entry.ganZhi.stem}</span>
                        <span className={`text-xl font-bold ${branchEl ? ELEMENT_COLORS[branchEl] : ""}`}>{entry.ganZhi.branch}</span>
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
          <div className="overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" as "none" }}>
            <div className="flex gap-2 min-w-max">
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
                      <span className={`text-lg font-bold ${se ? ELEMENT_COLORS[se] : ""}`}>{ganZhi.stem}</span>
                      <span className={`text-lg font-bold ${be ? ELEMENT_COLORS[be] : ""}`}>{ganZhi.branch}</span>
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
                          <span className={`text-[15px] font-bold leading-tight ${se ? ELEMENT_COLORS[se] : ""}`}>{gz.stem}</span>
                          <span className={`text-[15px] font-bold leading-tight ${be ? ELEMENT_COLORS[be] : ""}`}>{gz.branch}</span>
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
                      <div className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3">
                        <p className="text-[13px] text-muted-foreground mb-1.5">월운 · {selectedWolunYear}년 {selectedWolunMonth}월</p>
                        <div className="flex gap-0.5 items-baseline">
                          <span className={`text-xl font-bold ${se ? ELEMENT_COLORS[se] : ""}`}>{gz.stem}</span>
                          <span className={`text-xl font-bold ${be ? ELEMENT_COLORS[be] : ""}`}>{gz.branch}</span>
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

// ── Main Report ────────────────────────────────────────────────────

const STEM_RELATION_TYPES = new Set(["천간합", "천간충"]);

interface SajuReportProps {
  record: PersonRecord;
  showSaveStatus?: boolean;
}

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
  const [reportTab, setReportTab] = useState<"원국" | "성향" | "운세" | "오늘운세">(() => {
    const saved = sessionStorage.getItem("openReportTab");
    if (saved === "오늘운세") { sessionStorage.removeItem("openReportTab"); return "오늘운세"; }
    if (saved === "운세") { sessionStorage.removeItem("openReportTab"); return "운세"; }
    return "원국";
  });
  const [hourMode, setHourMode] = useState<"포함" | "제외" | "비교">("포함");
  const [selectedTgInfo, setSelectedTgInfo] = useState<TenGod | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
    { label: "생시", hangul: effectivePillars.hour?.hangul ?? "", isUnknown: !effectivePillars.hour || input.timeUnknown || hourMode === "제외" },
    { label: "생일", hangul: effectivePillars.day?.hangul ?? "", isDayMaster: true },
    { label: "생월", hangul: effectivePillars.month?.hangul ?? "" },
    { label: "생년", hangul: effectivePillars.year?.hangul ?? "" },
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

  const shinsalPillars = (dayStem && dayBranch)
    ? calculateShinsalFull(dayStem, dayBranch, input.month, [
        { pillar: "시주", stem: effectivePillars.hour?.hangul?.[0] ?? "", branch: effectivePillars.hour?.hangul?.[1] ?? "" },
        { pillar: "일주", stem: effectivePillars.day?.hangul?.[0] ?? "", branch: effectivePillars.day?.hangul?.[1] ?? "" },
        { pillar: "월주", stem: effectivePillars.month?.hangul?.[0] ?? "", branch: effectivePillars.month?.hangul?.[1] ?? "" },
        { pillar: "년주", stem: effectivePillars.year?.hangul?.[0] ?? "", branch: effectivePillars.year?.hangul?.[1] ?? "" },
      ], fortuneOpts?.shinsalMode ?? "default")
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
      finalShinsalNames.add(n);
    }
    for (const n of branchItems) {
      finalShinsalNames.add(n);
    }
  }

  const lifeFlowData = buildLifeFlowInsights(
    { ...record, maritalStatus },
    { finalShinsalNames }
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
    () => (hasHourPillar ? diffShinsal(Array.from(finalShinsalNames), shinsalNamesNoHour) : { added: [], removed: [] }),
    [hasHourPillar, finalShinsalNames, shinsalNamesNoHour],
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

  // ── 시주 천간/지지 십성 ────────────────────────────────────────
  const hourStem = pillars.hour?.hangul?.[0] ?? null;
  const hourBranch = pillars.hour?.hangul?.[1] ?? null;
  const hourStemTg = hasHourPillar && dayStem && hourStem ? getTenGod(dayStem, hourStem) : null;
  const hourBranchTg = hasHourPillar && dayStem && hourBranch ? getTenGod(dayStem, hourBranch) : null;

  return (
    <div className="space-y-4">

      {/* ── 상단 요약 (항상 표시) ── */}
      {dayStem && (
        <CoreInsightChips dayStem={dayStem} fiveElement={effectiveFiveElements} />
      )}

      {/* ── 시주 모드 토글 (탭 바 위, 출생 시간 있을 때만) ── */}
      {hasHourPillar && (
        <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-xl p-1">
          {(["포함", "제외", "비교"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setHourMode(m)}
              className={`flex-1 py-1.5 text-[12px] font-semibold rounded-lg transition-all active:scale-95 ${
                hourMode === m
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              시주 {m}
            </button>
          ))}
        </div>
      )}

      {/* ── 탭 바 ── */}
      <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
        {(["원국", "성향", "운세", "오늘운세"] as const).map((tab) => (
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

          {/* ── 시주 비교 카드 (비교 모드일 때 원국 위에 표시) ── */}
          {hasHourPillar && hourMode === "비교" && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3 space-y-2.5">
              <div className="flex items-center gap-3">
                {/* 시주 글자 */}
                <div className="shrink-0 text-center">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-0.5">시주</p>
                  <div className="flex gap-0.5">
                    {hourStem && <span className={`text-xl font-bold ${ELEMENT_COLORS[STEM_ELEMENT[hourStem] ?? ""] ?? ""}`}>{hourStem}</span>}
                    {hourBranch && <span className={`text-xl font-bold ${ELEMENT_COLORS[STEM_ELEMENT[hourBranch] ?? ""] ?? ""}`}>{hourBranch}</span>}
                  </div>
                  <div className="flex gap-0.5 mt-0.5 justify-center flex-wrap">
                    {hourStemTg && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${getTenGodTw(hourStemTg, dayStem)}`} style={getTenGodChipStyle(hourStemTg, dayStem)}>{hourStemTg}</span>}
                    {hourBranchTg && <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${getTenGodTw(hourBranchTg, dayStem)}`} style={getTenGodChipStyle(hourBranchTg, dayStem)}>{hourBranchTg}</span>}
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-[11px] font-bold text-violet-600">시주 포함·제외 비교</p>
                  {/* 오행 변화 */}
                  {fiveElDiffBase.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {fiveElDiffBase.map(({ el, withHour, withoutHour, delta }) => (
                        <div key={el} className="flex items-center gap-0.5 rounded-lg border border-border bg-white px-2 py-0.5">
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

          {/* 사주팔자 — 항상 표시 */}
          <PillarTable
            pillars={pillarData}
            dayStem={dayStem}
            shinsalBranchItems={shinsalBranchItems}
          />

          {/* ── 십성 분포 (read-only) ── */}
          {dayStem && (() => {
            const autoTgCounts = autoCountTenGods(dayStem, [
              ...allStems.filter((s) => s !== dayStem), ...allBranches,
            ]) as ManualTenGodCounts;
            const displayCounts: ManualTenGodCounts = autoTgCounts;
            return (
              <AccSection
                title="십성 분포"
                defaultOpen
              >
                {(() => {
                    const allTgTotal = Object.values(displayCounts).reduce((s, c) => s + c, 0) || 1;
                    return (
                  <div className="space-y-3">
                  {Object.entries(TEN_GOD_GROUPS).map(([group, members]) => {
                    const groupCount = members.reduce((s, tg) => s + (displayCounts[tg] ?? 0), 0);
                    const groupPct = Math.round((groupCount / allTgTotal) * 100);
                    return (
                      <div key={group}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-bold text-foreground">{group}</span>
                          <span className="text-[12px] font-semibold text-muted-foreground">{groupPct}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {members.map((tg) => {
                            const cnt = displayCounts[tg as TenGod] ?? 0;
                            const pct = Math.round((cnt / allTgTotal) * 100);
                            const isActive = selectedTgInfo === tg;
                            return (
                            <button
                              type="button"
                              key={tg}
                              onClick={() => setSelectedTgInfo(isActive ? null : tg as TenGod)}
                              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all active:scale-95 ${getTenGodTw(tg, dayStem)} ${isActive ? "ring-2 ring-foreground/30" : ""}`}
                              style={getTenGodChipStyle(tg, dayStem)}
                            >
                              <span className="text-[13px] font-bold">{tg}</span>
                              <span className="text-[13px] font-semibold">{pct}%</span>
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* 선택된 십성 의미 카드 */}
                  {selectedTgInfo && TG_NATAL_MEANING[selectedTgInfo] && (() => {
                    const nm = TG_NATAL_MEANING[selectedTgInfo];
                    const cnt = displayCounts[selectedTgInfo] ?? 0;
                    const allTgTotalForCard = Object.values(displayCounts).reduce((s, c) => s + c, 0) || 1;
                    const pct = Math.round((cnt / allTgTotalForCard) * 100);
                    const pctLabel = pct === 0 ? "없음(0%)" : pct <= 10 ? `매우 약함(${pct}%)` : pct <= 25 ? `적당함(${pct}%)` : pct <= 50 ? `강함(${pct}%)` : `매우 강함(${pct}%)`;
                    const pctContext = pct === 0
                      ? `현재 사주에 ${selectedTgInfo}이(가) 없습니다. 이 기운의 본성적 특질이 약하게 나타나며, 오히려 대운·세운에서 이 기운을 만났을 때 더 민감하게 반응할 수 있습니다.`
                      : pct <= 10
                      ? `${selectedTgInfo}이(가) 사주에 매우 약하게(${pct}%) 자리합니다. 주도적으로 발현되기보다 특수한 상황이나 자극이 있을 때 간헐적으로 나타납니다.`
                      : pct <= 25
                      ? `${selectedTgInfo}이(가) 사주에 적당히(${pct}%) 자리합니다. 다른 기운과 조화롭게 균형을 이루며 발현됩니다.`
                      : pct <= 50
                      ? `${selectedTgInfo}이(가) 사주에 강하게(${pct}%) 자리합니다. 성격과 삶의 흐름에 뚜렷한 영향을 미치는 핵심 기운 중 하나입니다.`
                      : `${selectedTgInfo}이(가) 사주에서 매우 강하게(${pct}%) 작용합니다. 삶 전반에 걸쳐 가장 핵심적인 영향을 미치는 지배적 기운입니다.`;
                    return (
                    <div className={`rounded-xl px-3 py-3 space-y-2 ${getTenGodTw(selectedTgInfo, dayStem)}`} style={getTenGodChipStyle(selectedTgInfo, dayStem)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold">{selectedTgInfo}</span>
                          <span className="text-[11px] font-bold opacity-70 bg-white/40 px-1.5 py-0.5 rounded-full border border-current/20">{pctLabel}</span>
                        </div>
                        <button onClick={() => setSelectedTgInfo(null)} className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 bg-white/60">닫기</button>
                      </div>
                      <div className="rounded-lg bg-amber-50/80 border border-amber-100 px-2.5 py-2">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">내 사주 맞춤 해설</p>
                        <p className="text-[12px] leading-relaxed text-foreground">{pctContext}</p>
                      </div>
                      {pct > 0 && (
                        <>
                          <p className="text-[12px] leading-relaxed">{nm.summary}</p>
                          {nm.traits && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">성향·특성</p>
                              <p className="text-[12px] leading-relaxed">{nm.traits}</p>
                            </div>
                          )}
                          {nm.strengths && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">강점</p>
                              <p className="text-[12px] leading-relaxed">{nm.strengths}</p>
                            </div>
                          )}
                          {nm.caution && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">주의점</p>
                              <p className="text-[12px] leading-relaxed">{nm.caution}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })()}
                  </div>
                    );
                  })()}
              </AccSection>
            );
          })()}

          {/* 格局 및 구조 분석 */}
          {dayStem && (
            <AccSection title="격국 및 구조 분석">
              <GukgukSection
                dayStem={dayStem}
                monthBranch={effectivePillars.month?.hangul?.[1]}
                allStems={allStems}
                allBranches={allBranches}
                pipelineGukguk={sajuPipelineResult?.interpretation.gukguk ?? null}
                pipelinePatterns={sajuPipelineResult?.interpretation.structurePatterns ?? []}
              />
            </AccSection>
          )}

          {/* 신강/신약 (single source: sajuPipelineResult.adjusted.strengthResult) */}
          {sajuPipelineResult?.adjusted?.strengthResult && (
            <AccSection title="일간 강도">
              <DayMasterStrengthCard strength={sajuPipelineResult.adjusted.strengthResult} />
            </AccSection>
          )}

          <AccSection
            title="오행 분포"
          >
            <FiveElementSection
              counts={effectiveFiveElements}
              dayStem={dayStem}
              monthBranch={pillars.month?.hangul?.[1]}
              dayBranch={dayBranch}
              allStems={allStems}
              allBranches={allBranches}
            />
          </AccSection>

          {/* 신살 */}
          {dayStem && dayBranch && (
            <AccSection title="신살">
              <div className="space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  일간 <span className="font-bold text-foreground">{dayStem}</span> · 일지 <span className="font-bold text-foreground">{dayBranch}</span> 기준
                </p>
                {[
                  { pillar: "시주", stemLabel: "시천간", branchLabel: "시지", isDay: false, isUnknown: !effectivePillars.hour || input.timeUnknown || hourMode === "제외" },
                  { pillar: "일주", stemLabel: "일천간", branchLabel: "일지", isDay: true, isUnknown: false },
                  { pillar: "월주", stemLabel: "월천간", branchLabel: "월지", isDay: false, isUnknown: false },
                  { pillar: "년주", stemLabel: "연천간", branchLabel: "연지", isDay: false, isUnknown: false },
                ].map(({ pillar, stemLabel, branchLabel, isDay, isUnknown }) => {
                  const ps = shinsalPillars.find((p) => p.pillar === pillar);
                  const positions = PILLAR_TO_POSITIONS[pillar] ?? { stem: stemLabel, branch: branchLabel };
                  const pillarItems = ps?.pillarItems ?? [];
                  const stemItems = ps?.stemItems ?? [];
                  const branchItems = ps?.branchItems ?? [];
                  // 일주 기반 특수 신살(고란살/음양차착살/일귀인)은 '일지' 행에 표시되도록 정렬
                  // (기존: 일천간 행에 섞여 보이던 케이스로 '누락'처럼 보일 수 있어 조정)
                  const autoStemRaw = pillar === "일주" ? [...stemItems] : [...pillarItems, ...stemItems];
                  const autoBranchRaw = pillar === "일주" ? [...branchItems, ...pillarItems] : branchItems;
                  const visibleAutoStem = autoStemRaw;
                  const visibleAutoBranch = autoBranchRaw;
                  const renderPositionRow = (label: string, _pos: string, autoItems: string[], isLast: boolean) => {
                    const isEmpty = autoItems.length === 0;
                    return (
                      <div className={`flex items-start gap-2 px-3 py-2.5 ${isLast ? "" : "border-b border-border/40"}`}>
                        <span className="text-[13px] text-muted-foreground w-14 shrink-0 pt-1 font-medium">{label}</span>
                        {isUnknown ? (
                          <span className="text-[13px] text-muted-foreground italic pt-0.5">미상</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {autoItems.map((n) => (
                              <div key={`auto-${label}-${n}`} className="flex items-center gap-0.5">
                                <button
                                  onClick={() =>
                                    setInfoSheet({
                                      kind: "shinsal",
                                      name: n,
                                      source: "auto",
                                      trigger: ps?.triggerInfo?.[n],
                                    })
                                  }
                                  className={`text-[13px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 hover:brightness-95 ${SHINSAL_COLOR[n] ?? "bg-muted text-muted-foreground border-border"}`}
                                >
                                  {n}
                                </button>
                              </div>
                            ))}
                            {isEmpty && <span className="text-[13px] text-muted-foreground opacity-50">없음</span>}
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
                      {renderPositionRow(stemLabel, positions.stem, visibleAutoStem, false)}
                      {renderPositionRow(branchLabel, positions.branch, visibleAutoBranch, true)}
                    </div>
                  );
                })}
              </div>
            </AccSection>
          )}

          {/* 지장간·12운성 */}
          <AccSection title="지장간 · 12운성">
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground mb-2">지장간</p>
                <div className="grid grid-cols-4 gap-0 rounded-xl overflow-hidden border border-border">
                  {[
                    { label: "시지", branch: pillars.hour?.hangul?.[1], isDay: false },
                    { label: "일지", branch: pillars.day?.hangul?.[1], isDay: true },
                    { label: "월지", branch: pillars.month?.hangul?.[1], isDay: false },
                    { label: "년지", branch: pillars.year?.hangul?.[1], isDay: false },
                  ].map(({ label, branch, isDay }, i) => {
                    const hidden = branch ? getHiddenStems(branch) : [];
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
                                        {s}
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
          <AccSection title="천간 · 지지 관계">
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">탭하면 상세 해석</p>
              {branchRelations.length === 0 && (
                <p className="text-sm text-muted-foreground py-1">특별한 지지 관계가 없습니다.</p>
              )}
              {branchRelations.map((rel, i) => {
                const relBranches = rel.description.match(/[자축인묘진사오미신유술해]/g) ?? [];
                return (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-left active:bg-muted/30 transition-colors"
                    onClick={() => setInfoSheet({ kind: "branchRelation", relationType: rel.type, branches: relBranches })}
                  >
                    <span className={`text-[13px] font-bold px-2 py-0.5 rounded-full shrink-0 ${RELATION_COLORS[rel.type]}`}>{rel.type}</span>
                    <span className="text-sm font-medium flex-1">{rel.description}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">›</span>
                  </button>
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
                      <span className={`text-2xl font-bold ${ELEMENT_COLORS[STEM_ELEMENT[hourStem] ?? ""] ?? ""}`}>{hourStem}</span>
                    )}
                    {hourBranch && (
                      <span className={`text-2xl font-bold ${ELEMENT_COLORS[STEM_ELEMENT[hourBranch] ?? ""] ?? ""}`}>{hourBranch}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-0.5 justify-center">
                    {hourStemTg && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(hourStemTg, dayStem)}`} style={getTenGodChipStyle(hourStemTg, dayStem)}>{hourStemTg}</span>}
                    {hourBranchTg && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getTenGodTw(hourBranchTg, dayStem)}`} style={getTenGodChipStyle(hourBranchTg, dayStem)}>{hourBranchTg}</span>}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wide mb-1">시주가 사주에 미치는 영향</p>
                  {hourStemTg && (
                    <p className="text-[12px] text-foreground leading-relaxed">
                      {TG_LUCK_MEANING[hourStemTg as TenGod]?.summary ?? ""}
                      {hourMode === "제외" && (
                        <span className="ml-1 text-[11px] text-muted-foreground">(현재 해석에서 제외됨)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* 오행 변화 */}
              {fiveElDiffBase.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                    시주 포함 시 오행 변화 {hourMode === "제외" ? <span className="text-rose-400">(현재 미적용)</span> : hourMode === "포함" ? <span className="text-emerald-600">(현재 적용)</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {fiveElDiffBase.map(({ el, withHour, withoutHour, delta }) => (
                      <div key={el} className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1">
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
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">신살 변화</p>
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
        </div>
      )}

      {/* ── 탭 2: 성향 ── */}
      {reportTab === "성향" && (
        <div className="space-y-3">
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
            />
          )}

          {/* 일간 성향 카드 */}
          {dayStem && (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5">
              <p className="text-[13px] font-bold text-muted-foreground mb-1.5">일간 성향 · {dayStem}일간</p>
              <p className="text-sm text-foreground leading-relaxed">
                {getDayMasterSummaryFromStrength(dayStem, sajuPipelineResult?.adjusted?.effectiveStrengthLevel ?? "중화")}
              </p>
            </div>
          )}

          {/* 오행 균형 */}
          <AccSection title="오행 균형">
            <div className="rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2.5">
              <p className="text-sm">{getElementBalanceSummary(effectiveFiveElements)}</p>
            </div>
            <FiveElementSection
              counts={effectiveFiveElements}
              dayStem={dayStem}
              monthBranch={pillars.month?.hangul?.[1]}
              dayBranch={dayBranch}
              allStems={allStems}
              allBranches={allBranches}
            />
          </AccSection>

          {/* 십성 분포 */}
          <AccSection title="십성 분포" defaultOpen>
            {dayStem ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-muted-foreground mb-2.5">각 항목을 탭하면 자세한 설명을 볼 수 있습니다</p>
                  <TenGodDistributionSection
                    dayStem={dayStem}
                    dayEl={STEM_ELEMENT[dayStem] as FiveElKey | undefined}
                    allChars={allChars}
                    effectiveFiveElements={effectiveFiveElements}
                    monthBranch={pillars.month?.hangul?.[1]}
                    dayBranch={dayBranch}
                    allStems={allStems}
                    allBranches={allBranches}
                    onTap={(group, pct) => setInfoSheet({ kind: "tengod-group", group, dayStem, pct })}
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
                                  <span className={`text-[13px] px-1.5 py-0.5 rounded font-bold ${getTenGodTw(stemTg, dayStem)}`} style={getTenGodChipStyle(stemTg, dayStem)}>{stemTg}</span>
                                ) : <span className="text-[13px] text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border">
                                <span className={`font-bold ${branchEl ? ELEMENT_COLORS[branchEl] : ""}`}>{branch}</span>
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
        </div>
      )}

      {/* ── 탭 3: 운세 ── */}
      {reportTab === "운세" && (
        <div className="space-y-3">
          <Card className="border-[#EBEBEB] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                운 흐름
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LuckFlowTabs
                luckCycles={luckCycles}
                dayStem={dayStem}
                birthYear={input.year}
                record={record}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 탭 4: 해석 ── */}
      {reportTab === "오늘운세" && dayStem && lifeFlowData && (
        <div className="space-y-3">
          {/* 해석 서브탭 */}
          <div className="overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" as "none" }}>
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

          {/* ── 이번주 기운 미니 차트 (도메인 탭에서만 표시) ── */}
          {(interpretTab === "사랑" || interpretTab === "재물" || interpretTab === "건강" || interpretTab === "일성과") && (() => {
            const domainMap: Record<string, "관계" | "재물" | "건강" | "일"> = {
              사랑: "관계", 재물: "재물", 건강: "건강", 일성과: "일",
            };
            const domain = domainMap[interpretTab];
            const now = new Date();
            const dow = now.getDay();
            const sunday = new Date(now);
            sunday.setDate(now.getDate() - dow);
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(sunday);
              d.setDate(sunday.getDate() + i);
              return d;
            });
            const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
            const startLabel = `${weekDays[0].getMonth() + 1}/${weekDays[0].getDate()}`;
            const endLabel = `${weekDays[6].getMonth() + 1}/${weekDays[6].getDate()}`;
            return (
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-transparent px-3 py-2.5">
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-2">
                  이번주 기운 <span className="font-normal text-indigo-400">({startLabel}~{endLabel})</span>
                </p>
                <div className="flex justify-between gap-1">
                  {weekDays.map((d, i) => {
                    const fortune = getFortuneForDate(record, d.getFullYear(), d.getMonth() + 1, d.getDate());
                    const df = fortune.domainFortunes.find((f) => f.domain === domain);
                    const level = df?.level ?? "neutral";
                    const emoji = level === "good" ? "☀️" : level === "caution" ? "🌧️" : "⛅";
                    const isToday = i === dow;
                    return (
                      <div
                        key={i}
                        className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${isToday ? "bg-indigo-100/70 ring-1 ring-indigo-300" : ""}`}
                      >
                        <span className={`text-[11px] font-bold ${isToday ? "text-indigo-600" : "text-muted-foreground"}`}>
                          {DAY_LABELS[i]}
                        </span>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className={`text-[10px] font-semibold ${level === "good" ? "text-emerald-600" : level === "caution" ? "text-orange-500" : "text-muted-foreground"}`}>
                          {df?.label ?? "보통"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── 사주 구조 분석 (규칙 기반) — 전체 탭 ── */}
          {interpretTab === "전체" && ruleInsights.length > 0 && (
            <Card className="border-violet-100 bg-gradient-to-br from-violet-50/60 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-violet-700 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  사주 구조 분석
                  {structureType && (
                    <span className="ml-1 text-[11px] font-normal bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full border border-violet-200">
                      {structureType}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {seasonalNote && (
                  <p className="text-[12px] text-violet-600/80 border-l-2 border-violet-300 pl-2 leading-relaxed">
                    {seasonalNote}
                  </p>
                )}
                {ruleInsights.map((insight, i) => (
                  <div key={i} className="rounded-xl bg-white/70 border border-violet-100 px-3 py-2.5">
                    <p className="text-[13px] text-foreground leading-relaxed">{insight}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                <p className="text-sm">
                  {getDayMasterSummaryFromStrength(dayStem, sajuPipelineResult?.adjusted?.effectiveStrengthLevel ?? "중화")}
                </p>
              </div>
              <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                <p className="text-[13px] font-semibold text-sky-700 mb-1">오행 균형</p>
                <p className="text-sm">{getElementBalanceSummary(effectiveFiveElements)}</p>
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

      {/* 결과(엔진 계산)는 read-only: 초기화/수동편집 UI 제거 */}

      {/* 오행/십성 수동 편집 UI는 read-only 정책으로 제거 */}

      {/* ── Bottom Sheet ── */}
      <InfoBottomSheet info={infoSheet} onClose={() => setInfoSheet(null)} />
    </div>
  );
}
