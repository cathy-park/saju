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

      // 삼합: any pair within a 삼합 group
      for (const group of BRANCH_THREE_COMBINE_GROUPS) {
        if (group.has(a) && group.has(b))
          push(makeRel(a, b, "지지삼합", "지지삼합", `${a}${b} 지지삼합`));
      }

      // 방합: any pair within a 방합 group
      for (const group of BRANCH_DIR_COMBINE_GROUPS) {
        if (group.has(a) && group.has(b))
          push(makeRel(a, b, "지지방합", "지지방합", `${a}${b} 지지방합`));
      }

      // 형 — triple group
      if (a !== b) {
        for (const group of HYEONG_TRIPLES) {
          if (group.has(a) && group.has(b)) push(makeRel(a, b, "형", "형", `${a}${b} 형`));
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
    meaning: "천간(天干) 두 글자가 합을 이루어 표면적 태도와 의지가 융화됩니다.",
    interpretation: "생각이나 말, 행동 방식이 상대와 자연스럽게 맞아 들어갑니다. 협력과 소통이 원활해지고, 공통된 방향성이 생깁니다. 다만 합이 되면 본래 천간의 성질이 변화합니다.",
    caution: "합이 되어 기운이 바뀌면 원래 의도와 다른 방향으로 흘러갈 수 있습니다. 결과를 열린 마음으로 받아들이세요.",
    domain: "의지·소통·협력",
  },
  지지육합: {
    meaning: "지지(地支) 두 글자가 육합을 이루어 생활과 정서가 밀착됩니다.",
    interpretation: "일상 속에서 서로에게 자연스럽게 끌리고 정서적으로 안정감을 줍니다. 가족이나 친밀한 관계에서 특히 따뜻하고 안정적인 인연으로 나타납니다.",
    caution: "합이 되면 지지의 성질이 변화합니다. 지나치게 의존하면 독립성이 약해질 수 있습니다.",
    domain: "인연·정서·생활",
  },
  지지삼합: {
    meaning: "세 지지가 삼합을 이루어 특정 오행의 기운이 크게 강화됩니다.",
    interpretation: "구조적으로 강력한 에너지 흐름이 만들어집니다. 해당 오행이 의미하는 분야(재물·관계·명예 등)에서 큰 힘이 발휘됩니다. 두 지지가 만나는 반합도 유효합니다.",
    caution: "특정 기운이 너무 강해지면 과잉 현상이 나타날 수 있습니다. 균형을 유지하는 것이 중요합니다.",
    domain: "기운 강화·역량·구조",
  },
  지지방합: {
    meaning: "같은 방위의 지지들이 모여 계절·환경의 기운을 강화합니다.",
    interpretation: "특정 계절의 에너지가 집중됩니다. 환경적 조건이 한 방향으로 모이며, 해당 방위·계절의 특성이 삶에 강하게 영향을 미칩니다.",
    caution: "방합은 계절적 편중을 의미하기도 합니다. 그 계절의 기운에 너무 치우치지 않도록 주의하세요.",
    domain: "환경·계절·방향성",
  },
  천간충: {
    meaning: "천간끼리 충돌하여 생각과 표현이 마찰합니다.",
    interpretation: "의견 차이가 명확하고 서로 다른 방식으로 행동하려 합니다. 갈등이 생기지만 동시에 새로운 관점을 얻고 성장하는 계기가 됩니다.",
    caution: "충동적인 언행을 조심하고 논리적 소통을 유지하세요. 결정이나 계획이 자주 바뀔 수 있습니다.",
    domain: "생각·표현·의지 충돌",
  },
  지지충: {
    meaning: "지지끼리 충돌하여 생활 패턴과 환경에 변화가 옵니다.",
    interpretation: "이동, 이직, 이사 등 물리적·환경적 변화가 생기기 쉽습니다. 사람과의 관계에서도 급작스러운 갈등이나 이별이 발생할 수 있으나, 새로운 시작의 기회이기도 합니다.",
    caution: "감정적 충돌을 직접 대응하지 말고 변화를 자연스럽게 수용하세요. 중요한 결정은 신중히 하세요.",
    domain: "생활 변화·이동·전환",
  },
  형: {
    meaning: "긴장과 갈등 구조를 만드는 형벌적 관계입니다.",
    interpretation: "판단 속도 차이나 감정 오해로 나타납니다. 법적 문제, 수술, 갑작스러운 사건과 연결되기도 하지만 강인한 의지로 극복할 힘도 줍니다.",
    caution: "결정 과정에서 충분한 소통이 필요합니다. 형이 있는 시기에는 법적 분쟁이나 건강에 주의하세요.",
    domain: "긴장·건강·법률",
  },
  파: {
    meaning: "두 기운이 서로를 손상시키는 분리 구조입니다.",
    interpretation: "진행 중인 일이 중단되거나 관계에 균열이 생기는 흐름입니다. 합이 있는 곳에 파가 함께 있으면 모인 것이 다시 흩어지는 패턴이 나타납니다.",
    caution: "완성 직전에 방해받을 수 있으니 끝까지 집중력을 유지하세요.",
    domain: "방해·분리·손상",
  },
  해: {
    meaning: "서로를 방해하고 저해하는 구조입니다.",
    interpretation: "좋은 인연이나 계획이 방해를 받는 흐름입니다. 오해나 질투, 기대했던 지원이 무산되는 경험을 할 수 있습니다.",
    caution: "인간관계에서 시기와 질투에 휘말리지 않도록 주의하세요.",
    domain: "방해·오해·저해",
  },
  원진: {
    meaning: "서로 반목하고 멀어지려는 반목 구조입니다.",
    interpretation: "처음에는 이끌리지만 점점 피로감이 쌓이는 경향이 있습니다. 오해가 잦고 마찰이 생기기 쉽습니다.",
    caution: "무리하게 관계를 이어가려 하지 말고, 충분한 거리두기가 오히려 건강한 관계를 유지하는 방법입니다.",
    domain: "반목·오해·피로",
  },
  공망: {
    meaning: "해당 지지의 기운이 비어 있는 상태입니다.",
    interpretation: "공망이 든 지지가 의미하는 영역(배우자·자녀·재물·명예 등)에서 기대와 현실의 차이가 생기기 쉽습니다.",
    caution: "공망 영역에 지나치게 집착하거나 욕심을 내면 오히려 힘들어집니다.",
    domain: "허망·공허·소멸",
  },
  합: {
    meaning: "두 기운이 합쳐져 하나로 융화되는 결합 구조입니다.",
    interpretation: "관계에서 자연스러운 조화를 이끌어냅니다. 협력과 인연의 가능성이 높아집니다.",
    caution: "합이 되면 기운의 성질이 바뀔 수 있습니다. 결과를 열린 마음으로 받아들이세요.",
    domain: "인연·협력·관계",
  },
  충: {
    meaning: "두 기운이 정면으로 충돌하는 구조입니다.",
    interpretation: "큰 변화와 활동성이 강해집니다. 새로운 시작과 돌파구가 열리는 시기이기도 합니다.",
    caution: "감정적 충돌을 직접적으로 대응하지 말고 변화를 자연스럽게 수용하세요.",
    domain: "변화·활동·전환",
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
