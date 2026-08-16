// ── Saju Relationship Engine ────────────────────────────────────────
// 천간합/지지육합/삼합/방합, 천간충/지지충, 형/파/해/원진/공망

export type RelationType =
  | "천간합"
  | "지지육합"
  | "지지삼합"
  | "지지방합"
  | "천간충"
  | "지지충"
  | "형"
  | "파"
  | "해"
  | "원진"
  | "공망"
  // legacy values kept for manual-add backward compat
  | "합"
  | "충";

export interface BranchRelation {
  branch1: string;
  branch2: string;
  type: RelationType;
  /** Short Korean label for badge display */
  label: string;
  /** Human-readable description e.g. "자축 지지육합" */
  description: string;
}

// ── Stem (천간) lookup tables ────────────────────────────────────────

/** 천간합 (甲己合, 乙庚合, 丙辛合, 丁壬合, 戊癸合) */
const STEM_COMBINE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["갑", "기"], ["을", "경"], ["병", "신"], ["정", "임"], ["무", "계"],
] as const;

/** 천간충 (甲庚, 乙辛, 丙壬, 丁癸) */
const STEM_CLASH_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["갑", "경"], ["을", "신"], ["병", "임"], ["정", "계"],
] as const;

// ── Branch (지지) lookup tables ──────────────────────────────────────

/** 지지육합 (六合) */
const HAP_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자", "축"], ["인", "해"], ["묘", "술"],
  ["진", "유"], ["사", "신"], ["오", "미"],
] as const;

/** 지지충 (六沖) */
const CHUNG_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자", "오"], ["축", "미"], ["인", "신"],
  ["묘", "유"], ["진", "술"], ["사", "해"],
] as const;

/**
 * 지지삼합 (三合) — each group: any 2+ branches form 삼합
 * 인오술(火), 사유축(金), 신자진(水), 해묘미(木)
 */
const BRANCH_THREE_COMBINE_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["인", "오", "술"]),
  new Set(["사", "유", "축"]),
  new Set(["신", "자", "진"]),
  new Set(["해", "묘", "미"]),
];

/**
 * 지지방합 (方合) — each group: any 2+ branches from same direction
 * 인묘진(木/동), 사오미(火/남), 신유술(金/서), 해자축(水/북)
 */
const BRANCH_DIR_COMBINE_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["인", "묘", "진"]),
  new Set(["사", "오", "미"]),
  new Set(["신", "유", "술"]),
  new Set(["해", "자", "축"]),
];

/**
 * 형 (刑)
 *  · Triple-group: any pair within {인,사,신} or {축,술,미}
 *  · Pair: 자–묘
 *  · Self: 진 오 유 해 (fires when same branch appears 2+ times)
 */
const HYEONG_TRIPLES: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["인", "사", "신"]),
  new Set(["축", "술", "미"]),
];
const HYEONG_PAIR: readonly [string, string] = ["자", "묘"] as const;
const HYEONG_SELF = new Set(["진", "오", "유", "해"]);

/** 파 (破) */
const PA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자", "유"], ["묘", "오"], ["진", "축"], ["미", "술"],
] as const;

/** 해 (害) */
const HAE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자", "미"], ["축", "오"], ["인", "사"],
  ["묘", "진"], ["신", "해"], ["유", "술"],
] as const;

/** 원진 (怨嗔) */
const WONJIN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자", "미"], ["축", "오"], ["인", "유"],
  ["묘", "신"], ["진", "해"], ["사", "술"],
] as const;

/**
 * 공망 (空亡) — 60간지 by day pillar.
 */
const VOID_BY_GANJI: Readonly<Record<string, readonly [string, string]>> = {
  갑자: ["술","해"], 을축: ["술","해"], 병인: ["술","해"], 정묘: ["술","해"],
  무진: ["술","해"], 기사: ["술","해"], 경오: ["술","해"], 신미: ["술","해"],
  임신: ["술","해"], 계유: ["술","해"],

  갑술: ["신","유"], 을해: ["신","유"], 병자: ["신","유"], 정축: ["신","유"],
  무인: ["신","유"], 기묘: ["신","유"], 경진: ["신","유"], 신사: ["신","유"],
  임오: ["신","유"], 계미: ["신","유"],

  갑신: ["오","미"], 을유: ["오","미"], 병술: ["오","미"], 정해: ["오","미"],
  무자: ["오","미"], 기축: ["오","미"], 경인: ["오","미"], 신묘: ["오","미"],
  임진: ["오","미"], 계사: ["오","미"],

  갑오: ["진","사"], 을미: ["진","사"], 병신: ["진","사"], 정유: ["진","사"],
  무술: ["진","사"], 기해: ["진","사"], 경자: ["진","사"], 신축: ["진","사"],
  임인: ["진","사"], 계묘: ["진","사"],

  갑진: ["인","묘"], 을사: ["인","묘"], 병오: ["인","묘"], 정미: ["인","묘"],
  무신: ["인","묘"], 기유: ["인","묘"], 경술: ["인","묘"], 신해: ["인","묘"],
  임자: ["인","묘"], 계축: ["인","묘"],

  갑인: ["자","축"], 을묘: ["자","축"], 병진: ["자","축"], 정사: ["자","축"],
  무오: ["자","축"], 기미: ["자","축"], 경신: ["자","축"], 신유: ["자","축"],
  임술: ["자","축"], 계해: ["자","축"],
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function matchPair(
  a: string, b: string,
  pairs: ReadonlyArray<readonly [string, string]>,
): boolean {
  for (const [x, y] of pairs) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}

function makeRel(
  a: string, b: string,
  type: RelationType,
  label: string,
  desc?: string,
): BranchRelation {
  return {
    branch1: a, branch2: b, type, label,
    description: desc ?? `${a}${b} ${label}`,
  };
}

// ── Stem relations ───────────────────────────────────────────────────

/**
 * Compute 천간합 and 천간충 for a list of stems.
 */
export function computeStemRelations(stems: string[]): BranchRelation[] {
  const results: BranchRelation[] = [];
  const dedup = new Set<string>();

  function push(rel: BranchRelation) {
    const key = `${rel.type}|${[rel.branch1, rel.branch2].sort().join(",")}`;
    if (!dedup.has(key)) { dedup.add(key); results.push(rel); }
  }

  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const a = stems[i], b = stems[j];
      if (matchPair(a, b, STEM_COMBINE_PAIRS))
        push(makeRel(a, b, "천간합", "천간합", `${a}${b} 천간합`));
      if (matchPair(a, b, STEM_CLASH_PAIRS))
        push(makeRel(a, b, "천간충", "천간충", `${a}${b} 천간충`));
    }
  }
  return results;
}

// ── Branch relations ─────────────────────────────────────────────────

/**
 * Compute all inter-branch relations: 지지육합/삼합/방합/지지충/형/파/해/원진.
 */
export function computeBranchRelations(
  branches: string[],
  opponentBranches?: string[],
): BranchRelation[] {
  const all = opponentBranches ? [...branches, ...opponentBranches] : branches;
  const results: BranchRelation[] = [];
  const dedup = new Set<string>();
  const presentSet = new Set(all);

  function push(rel: BranchRelation) {
    const key = `${rel.type}|${[rel.branch1, rel.branch2].sort().join(",")}`;
    if (!dedup.has(key)) { dedup.add(key); results.push(rel); }
  }

  // Pair-based relations
  for (let i = 0; i < all.length; i++) {
    const a = all[i];

    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];

      if (matchPair(a, b, HAP_PAIRS))    push(makeRel(a, b, "지지육합", "지지육합", `${a}${b} 지지육합`));
      if (matchPair(a, b, CHUNG_PAIRS))  push(makeRel(a, b, "지지충",  "지지충",  `${a}${b} 지지충`));
      if (matchPair(a, b, PA_PAIRS))     push(makeRel(a, b, "파",      "파",      `${a}${b} 파`));
      if (matchPair(a, b, HAE_PAIRS))    push(makeRel(a, b, "해",      "해",      `${a}${b} 해`));
      if (matchPair(a, b, WONJIN_PAIRS)) push(makeRel(a, b, "원진",    "원진",    `${a}${b} 원진`));

      // 삼합: any pair within a 삼합 group — 3지 모두 있으면 "완성", 2지만 있으면 "흐름"
      for (const group of BRANCH_THREE_COMBINE_GROUPS) {
        if (group.has(a) && group.has(b)) {
          const full = Array.from(group).every((x) => presentSet.has(x));
          const groupLabel = Array.from(group).join("");
          push(makeRel(a, b, "지지삼합", "지지삼합", `${groupLabel} 삼합${full ? "" : " 흐름"}`));
        }
      }

      // 방합: any pair within a 방합 group — 3지 모두 있으면 "완성", 2지만 있으면 "흐름"
      for (const group of BRANCH_DIR_COMBINE_GROUPS) {
        if (group.has(a) && group.has(b)) {
          const full = Array.from(group).every((x) => presentSet.has(x));
          const groupLabel = Array.from(group).join("");
          push(makeRel(a, b, "지지방합", "지지방합", `${groupLabel} 방합${full ? "" : " 흐름"}`));
        }
      }

      // 형 — triple group
      if (a !== b) {
        for (const group of HYEONG_TRIPLES) {
          // 전문 만세력/명리 해석에서:
          // - 인사신/축술미는 2지지(부분형)도 형 작용이 있다고 보는 견해가 널리 쓰임
          // - 3지지 완성(삼형)은 작용이 더 강하므로 설명에 표시
          if (group.has(a) && group.has(b)) {
            const full = Array.from(group).every((x) => presentSet.has(x));
            push(makeRel(a, b, "형", "형", `${a}${b} 형${full ? " (삼형 완성)" : " (부분형)"}`));
          }
        }
      }
      if (matchPair(a, b, [HYEONG_PAIR])) push(makeRel(a, b, "형", "형", `${a}${b} 형`));
    }

    // 형 self (자형)
    if (HYEONG_SELF.has(a)) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[j] === a) {
          const key = `형|${a},${a}`;
          if (!dedup.has(key)) {
            dedup.add(key);
            results.push({ branch1: a, branch2: a, type: "형", label: "형", description: `${a} 자형` });
          }
        }
      }
    }
  }

  return results;
}

/**
 * Return the two void (공망) branches for a day pillar hangul string.
 */
export function getVoidBranches(
  dayPillarHangul: string,
): readonly [string, string] | null {
  if (!dayPillarHangul || dayPillarHangul.length < 2) return null;
  const ganji = dayPillarHangul.slice(0, 2);
  return VOID_BY_GANJI[ganji] ?? null;
}

/** Whether a branch is void (공망) given the user's day pillar. */
export function isBranchVoid(branch: string, dayPillarHangul: string): boolean {
  const v = getVoidBranches(dayPillarHangul);
  return v != null && (v[0] === branch || v[1] === branch);
}

/**
 * Compute 공망 relations.
 */
export function computeVoidRelations(
  branches: string[],
  dayPillarHangul: string,
): BranchRelation[] {
  const v = getVoidBranches(dayPillarHangul);
  if (!v) return [];
  const voidSet = new Set(v);
  const seen = new Set<string>();
  return branches
    .filter((b) => voidSet.has(b))
    .filter((b) => { if (seen.has(b)) return false; seen.add(b); return true; })
    .map((b) => ({ branch1: b, branch2: b, type: "공망" as RelationType, label: "공망", description: `${b} 공망` }));
}

/**
 * Full pipeline: 천간합/천간충 + 지지 모든 관계 + 공망.
 * Pass stems for 천간 relations.
 */
export function analyzeAllRelations(
  branches: string[],
  dayPillarHangul: string,
  opponentBranches?: string[],
  stems?: string[],
  opponentStems?: string[],
): BranchRelation[] {
  const allStems = [
    ...(stems ?? []),
    ...(opponentStems ?? []),
  ];
  return [
    ...(allStems.length >= 2 ? computeStemRelations(allStems) : []),
    ...computeBranchRelations(branches, opponentBranches),
    ...computeVoidRelations(branches, dayPillarHangul),
    ...(opponentBranches ? computeVoidRelations(opponentBranches, dayPillarHangul) : []),
  ];
}

/**
 * Extract the 4 branches (지지) from a ComputedPillars object.
 */
export function extractBranches(pillars: {
  year?:  { hangul: string } | null;
  month?: { hangul: string } | null;
  day?:   { hangul: string } | null;
  hour?:  { hangul: string } | null;
}): string[] {
  const raw = [pillars.year, pillars.month, pillars.day, pillars.hour];
  return raw
    .filter((p): p is { hangul: string } => !!p && p.hangul.length >= 2)
    .map((p) => p.hangul[1]);
}

/**
 * Extract the 4 stems (천간) from a ComputedPillars object.
 */
export function extractStems(pillars: {
  year?:  { hangul: string } | null;
  month?: { hangul: string } | null;
  day?:   { hangul: string } | null;
  hour?:  { hangul: string } | null;
}): string[] {
  const raw = [pillars.year, pillars.month, pillars.day, pillars.hour];
  return raw
    .filter((p): p is { hangul: string } => !!p && p.hangul.length >= 2)
    .map((p) => p.hangul[0]);
}

// ── Backward-compatible shim ─────────────────────────────────────────

/**
 * @deprecated Use analyzeAllRelations() for new code.
 */
export function analyzeBranchRelations(pillars: {
  year?:  { hangul: string } | null;
  month?: { hangul: string } | null;
  day?:   { hangul: string } | null;
  hour?:  { hangul: string } | null;
}): BranchRelation[] {
  const branches = extractBranches(pillars);
  const stems = extractStems(pillars);
  const dayPillarHangul = pillars.day?.hangul?.slice(0, 2) ?? "";
  return analyzeAllRelations(branches, dayPillarHangul, undefined, stems);
}

// ── Display helpers ──────────────────────────────────────────────────

/** Badge colors for each relation type */
export const RELATION_COLORS: Record<RelationType, string> = {
  천간합:   "bg-pink-100 text-pink-800",
  지지육합: "bg-rose-100 text-rose-700",
  지지삼합: "bg-fuchsia-100 text-fuchsia-800",
  지지방합: "bg-purple-100 text-purple-700",
  천간충:   "bg-red-200 text-red-900",
  지지충:   "bg-red-100 text-red-800",
  형:       "bg-orange-100 text-orange-800",
  파:       "bg-yellow-100 text-yellow-800",
  해:       "bg-violet-100 text-violet-800",
  원진:     "bg-blue-100 text-blue-800",
  공망:     "bg-gray-100 text-gray-700",
  합:       "bg-pink-100 text-pink-800",   // legacy
  충:       "bg-red-100 text-red-800",     // legacy
};

export const RELATION_BADGE_STYLE: Record<RelationType, { bg: string; text: string }> = {
  천간합:   { bg: "#FDF2F8", text: "#9D174D" },
  지지육합: { bg: "#FFF1F2", text: "#BE123C" },
  지지삼합: { bg: "#FDF4FF", text: "#86198F" },
  지지방합: { bg: "#F5F3FF", text: "#7E22CE" },
  천간충:   { bg: "#FEE2E2", text: "#991B1B" },
  지지충:   { bg: "#FEF2F2", text: "#B91C1C" },
  형:       { bg: "#FFF7ED", text: "#C2410C" },
  파:       { bg: "#FEFCE8", text: "#92400E" },
  해:       { bg: "#F5F3FF", text: "#6D28D9" },
  원진:     { bg: "#EFF6FF", text: "#1E40AF" },
  공망:     { bg: "#F9FAFB", text: "#374151" },
  합:       { bg: "#FDF2F8", text: "#9D174D" },
  충:       { bg: "#FEF2F2", text: "#B91C1C" },
};

export const RELATION_MEANING: Record<RelationType, string> = {
  천간합:   "천간끼리 합쳐지는 표면 태도/의지의 융화",
  지지육합: "지지끼리 결합하는 생활·정서의 밀착",
  지지삼합: "세 지지가 결합해 오행 기운을 강화하는 구조적 흐름",
  지지방합: "방위 기운이 모여 계절·환경 에너지를 강화",
  천간충:   "천간끼리 충돌하는 생각·표현의 마찰",
  지지충:   "지지끼리 충돌하는 생활 패턴·환경의 변화",
  형:       "긴장·갈등·형벌적 관계",
  파:       "분리·손상",
  해:       "방해·저해",
  원진:     "반목·오해·거리낌",
  공망:     "허망·공허·소멸",
  합:       "조화·결합·융화",
  충:       "충돌·변화·활동",
};

export const RELATION_DESC: Record<RelationType, string> = RELATION_MEANING;

export interface RelationDetail {
  meaning: string;
  interpretation: string;
  caution: string;
  domain: string;
}

export const RELATION_DETAIL: Record<RelationType, RelationDetail> = {
  천간합: {
    meaning: "서로의 생각과 마음이 자연스럽게 하나로 스며드는 관계예요.",
    interpretation: "대화를 나누다 보면 '어, 나랑 똑같네?' 하고 놀랄 때가 많을 거예요. 서로의 의도나 표현 방식이 비슷해서 말하지 않아도 마음이 통하는 찰떡궁합이랍니다. 함께 계획을 세우거나 소통할 때 큰 시너지가 납니다.",
    caution: "서로 너무 비슷하다 보니 오히려 쓴소리나 현실적인 조언을 해주는 데 약할 수 있어요. 때로는 객관적인 시선도 필요하답니다.",
    domain: "생각·마음·소통",
  },
  지지육합: {
    meaning: "일상 속에서 곁에 두고 싶은 편안하고 다정한 인연이에요.",
    interpretation: "함께 밥을 먹고, 산책을 하고, 취미를 공유하는 일상적인 순간들이 참 편안하게 느껴집니다. 생활 패턴이 잘 맞고 서로에게 정서적인 안정감을 주는 따뜻한 관계예요. 부부나 연인에게 아주 좋은 궁합이죠.",
    caution: "서로에게 너무 의존하게 되면 각자의 독립성이 약해질 수 있으니, 각자의 시간도 존중해 주는 것이 좋아요.",
    domain: "일상·정서·편안함",
  },
  지지삼합: {
    meaning: "함께 모이면 엄청난 목표와 에너지를 만들어내는 파워풀한 관계예요.",
    interpretation: "각자 다르게 생겼지만 만나면 거대한 시너지를 일으킵니다. 공통의 목표를 향해 나아갈 때 폭발적인 성과를 내거나 관계가 급진전되는 경우가 많아요. 함께 일하거나 큰 뜻을 도모하기에 아주 좋습니다.",
    caution: "목표를 향한 에너지가 너무 강하다 보니, 과정 속에서의 소소한 감정들을 놓칠 수 있어요. 조금 여유를 가져보세요.",
    domain: "목표·시너지·에너지",
  },
  지지방합: {
    meaning: "마치 고향 친구를 만난 것처럼 같은 계절과 환경을 공유하는 관계예요.",
    interpretation: "살아온 배경이나 환경, 가치관이 비슷해서 쉽게 친해지고 무리 없이 어울릴 수 있습니다. 같은 편이라는 든든함을 주며, 가족처럼 편안하게 결속되는 특징이 있어요.",
    caution: "비슷한 사람들끼리 뭉치다 보니 새로운 생각이나 외부의 조언을 받아들이는 데 조금 배타적일 수 있어요.",
    domain: "환경·가치관·소속감",
  },
  천간충: {
    meaning: "생각과 가치관이 정면으로 부딪히며 서로를 강하게 자극해요.",
    interpretation: "서로 생각이 달라서 티격태격할 때가 많아요. 하지만 이 다름은 서로에게 신선한 충격을 주며, 내가 보지 못했던 새로운 세상을 보게 해주는 긍정적인 발전의 계기가 되기도 한답니다.",
    caution: "말투가 날카로워질 수 있으니 감정적인 말다툼은 피하고, 서로의 다름을 존중하는 대화법이 필요해요.",
    domain: "생각 차이·자극·성장",
  },
  지지충: {
    meaning: "서로의 삶에 크고 작은 변화를 일으키는 역동적인 인연이에요.",
    interpretation: "함께 있으면 지루할 틈이 없습니다. 서로를 자극해 이동, 이직, 이사 등 물리적인 변화를 가져오기도 해요. 때로는 강하게 부딪히지만 그로 인해 오랜 정체를 깨고 나아갈 수 있답니다.",
    caution: "관계가 급격히 가까워졌다가 멀어지는 등 기복이 있을 수 있으니, 급한 결정보다는 여유를 가지세요.",
    domain: "변화·활동·역동성",
  },
  형: {
    meaning: "서로를 다듬어가며 맞춰야 하는 약간의 팽팽한 긴장감이 있어요.",
    interpretation: "상대방의 행동이나 판단 방식이 자꾸 신경 쓰이고 고쳐주고 싶은 마음이 들 수 있어요. 이 과정에서 상처를 주기도 하지만, 잘 극복하면 서로를 더 단단하고 성숙하게 만들어주는 인연이 됩니다.",
    caution: "지적이나 간섭이 과해지면 서로 지칠 수 있어요. 상대를 있는 그대로 인정하는 연습이 큰 도움이 됩니다.",
    domain: "긴장·조율·성숙",
  },
  파: {
    meaning: "가까워지려 할 때 무언가 엇갈리거나 틈이 생기기 쉬워요.",
    interpretation: "관계가 순조롭게 흘러가다가도 중요한 순간에 핀트가 어긋나거나 오해가 생기기 쉬운 흐름이 있습니다. 합(合)이 모이는 것이라면, 파(破)는 그것을 다시 풀어헤쳐 재정비하려는 에너지예요.",
    caution: "섣부른 기대나 추측보다는 명확하게 의사를 확인하고 소통하는 것이 오해를 줄이는 지름길이에요.",
    domain: "어긋남·재정비",
  },
  해: {
    meaning: "의도치 않게 서로에게 서운함이나 방해 요소가 될 수 있어요.",
    interpretation: "좋은 마음으로 한 행동이 상대에게는 부담이나 오해로 다가갈 수 있는 인연입니다. 주변 상황이나 타이밍이 안 맞아 관계가 매끄럽지 못할 때도 있어요.",
    caution: "상대방을 위해 무언가를 할 때는 먼저 상대가 진짜 원하는 것인지 물어보는 배려가 필요해요.",
    domain: "방해·오해·서운함",
  },
  원진: {
    meaning: "자석처럼 끌리지만 가까워지면 알 수 없는 피로감이 밀려와요.",
    interpretation: "이상하게 자꾸 신경이 쓰이고 매력을 느끼지만, 막상 너무 가까워지면 이유 없이 밉거나 답답해질 수 있습니다. 애증이 교차하는 아주 미묘하고 깊은 인연이에요.",
    caution: "무리하게 마음을 하나로 맞추려 하기보다, 적당한 심리적·물리적 거리를 두면 오히려 훨씬 좋은 관계를 유지할 수 있어요.",
    domain: "애증·피로·거리두기",
  },
  공망: {
    meaning: "채워도 채워지지 않는 허전함이나 채울 수 없는 이상을 의미해요.",
    interpretation: "상대방에게 거는 기대가 크지만, 그 기대만큼 충족되지 않아 공허함을 느낄 수 있습니다. 혹은 현실적인 계산 없이 그저 순수하게 이끌리는 영적인 연결고리이기도 합니다.",
    caution: "상대에게 너무 많은 것을 바라고 채우려 하지 마세요. 있는 그대로를 바라볼 때 마음이 편안해집니다.",
    domain: "기대·비워둠·순수함",
  },
  합: {
    meaning: "서로의 기운이 둥글게 어우러져 편안한 조화를 이룹니다.",
    interpretation: "특별히 애쓰지 않아도 코드가 잘 맞고, 함께 있는 것만으로도 편안함을 느낍니다. 긍정적인 인연을 맺고 협력하기에 아주 좋은 징조예요.",
    caution: "관계가 너무 편해져서 서로에 대한 기본적인 예의나 긴장감을 잃지 않도록 주의하세요.",
    domain: "조화·편안함·협력",
  },
  충: {
    meaning: "강렬한 스파크가 튀며 서로를 깨워주는 역동적인 관계예요.",
    interpretation: "서로의 다름이 강한 매력으로 다가오며, 서로의 삶에 큰 자극과 동기를 부여합니다. 관계가 빠르게 진전되거나 예상치 못한 변화를 겪게 될 수 있습니다.",
    caution: "충돌 에너지를 긍정적인 성장으로 승화시키려면, 자존심을 내세우기보다 서로를 리스펙트하는 마음이 필요해요.",
    domain: "자극·스파크·성장",
  },
};

/** Category grouping for UI display */
export const RELATION_CATEGORY: Record<RelationType, "합" | "충" | "기타"> = {
  천간합:   "합",
  지지육합: "합",
  지지삼합: "합",
  지지방합: "합",
  합:       "합",
  천간충:   "충",
  지지충:   "충",
  충:       "충",
  형:       "기타",
  파:       "기타",
  해:       "기타",
  원진:     "기타",
  공망:     "기타",
};
