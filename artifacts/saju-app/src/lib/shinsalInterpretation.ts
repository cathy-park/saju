/**
 * 신살 표시용 해석 레이어 — calculateShinsalFull(엔진) 결과만 입력으로 받고
 * UI/해석 메타데이터를 확장합니다. 계산 로직은 luckCycles.calculateShinsalFull 에 유지합니다.
 */
import type { BranchRelation } from "@/lib/branchRelations";
import type { PillarShinsal } from "@/lib/luckCycles";
import { SHINSAL_DESC } from "@/lib/luckCycles";

export type ShinsalAnchor = "천간" | "지지" | "주전체";

export type ShinsalBasisKind =
  | "day_stem"
  | "day_branch"
  | "day_pillar_special"
  | "birth_month"
  | "year_branch_rule"
  | "chart_wide"
  | "stem_shape"
  | "branch_pair"
  | "void_rule"
  | "other";

export interface ShinsalInterpretationEntry {
  /** 안정적인 리스트 키 */
  id: string;
  name: string;
  /** 년주 | 월주 | 일주 | 시주 */
  pillar: string;
  anchor: ShinsalAnchor;
  basisKind: ShinsalBasisKind;
  /** 짧은 기준 라벨 (예: 일간 기준) */
  basisLabel: string;
  /** 엔진 triggerInfo 원문 */
  triggerDetail: string;
  /** 영향 생활 영역 (사주 위치 기준 매핑) */
  influenceDomain: string;
  /** 활성·연동 상태 태그 */
  activationStates: string[];
  /** SHINSAL_DESC 기반 한 줄 */
  oneLine: string;
}

export interface ShinsalCombinationNote {
  title: string;
  text: string;
  members: string[];
}

const PILLAR_INFLUENCE: Record<string, string> = {
  년주: "사회·대외관계·집안 배경",
  월주: "직업·사회적 역할·조직생활",
  일주: "배우자권·가까운 관계·자기 중심축",
  시주: "자녀·말년·내면·후반기 흐름",
};

const CONDITIONAL_BY_TRIGGER: RegExp[] = [
  /출생월/,
  /년지 다음/,
  /연지/,
  /사주 지지에/,
  /모두 있어/,
  /함께 있어/,
  /중복/,
];

const LUCK_SENSITIVE = new Set([
  "역마", "천살", "월살", "지살", "홍염", "도화", "재살", "망신살", "급각살",
]);

const NEGATIVE_SAL = new Set([
  "겁살", "재살", "양인살", "육해살", "원진살", "귀문관살", "망신살", "천살", "월살", "지살",
  "괴강살", "백호살", "고신살", "과숙살", "고란살",
]);

function classifyBasis(trigger: string): { kind: ShinsalBasisKind; label: string } {
  const t = trigger;
  if (/일간/.test(t) && !/일지/.test(t) && !/일주/.test(t)) return { kind: "day_stem", label: "일간 기준" };
  if (/일지/.test(t)) return { kind: "day_branch", label: "일지 기준" };
  if (/일주.*일주|일주.*고란|일주.*음양|일주.*일귀인|해당 일주/.test(t)) return { kind: "day_pillar_special", label: "일주(간지) 기준" };
  if (/출생월/.test(t)) return { kind: "birth_month", label: "출생 월 기준" };
  if (/년지 다음|천의성/.test(t)) return { kind: "year_branch_rule", label: "연지·연도 흐름 기준" };
  if (/사주 지지에/.test(t)) return { kind: "chart_wide", label: "사주 전체 지지 조합" };
  if (/날카로운 획|현침/.test(t)) return { kind: "stem_shape", label: "천간 형태 기준" };
  if (/조합|형성/.test(t) && /일지/.test(t)) return { kind: "branch_pair", label: "지지 조합 기준" };
  if (/공망/.test(t)) return { kind: "void_rule", label: "일주 공망(旬空) 기준" };
  return { kind: "other", label: "조건 충족 시" };
}

function branchTouchFlags(branch: string, relations: BranchRelation[]) {
  let chung = false;
  let hap = false;
  for (const r of relations) {
    if (r.branch1 !== branch && r.branch2 !== branch) continue;
    if (r.type === "지지충" || r.type === "충") chung = true;
    if (r.type === "지지육합" || r.type === "지지삼합" || r.type === "지지방합" || r.type === "합") hap = true;
  }
  return { chung, hap };
}

function stemTouchFlags(stem: string, relations: BranchRelation[]) {
  let chung = false;
  let hap = false;
  for (const r of relations) {
    if (r.type !== "천간합" && r.type !== "천간충") continue;
    if (r.branch1 !== stem && r.branch2 !== stem) continue;
    if (r.type === "천간충") chung = true;
    if (r.type === "천간합") hap = true;
  }
  return { chung, hap };
}

function buildActivationStates(
  name: string,
  anchor: ShinsalAnchor,
  trigger: string,
  pillarBranch: string,
  pillarStem: string,
  relations: BranchRelation[],
  ctx: { seunBranch?: string; daewoonBranch?: string },
): string[] {
  const tags: string[] = [];
  tags.push("원국 명반에서 기저로 참고");

  const conditional = CONDITIONAL_BY_TRIGGER.some((re) => re.test(trigger));
  if (conditional || name === "천의성" || name === "천복귀인" || name === "공망") {
    tags.push("조건부·연동 요소 있음");
  } else {
    tags.push("상시 작용(원국 고정)");
  }

  if (anchor === "지지" && pillarBranch) {
    const { chung, hap } = branchTouchFlags(pillarBranch, relations);
    if (hap && NEGATIVE_SAL.has(name)) tags.push("지지 합으로 뾰족함 완화 가능");
    if (hap && !NEGATIVE_SAL.has(name)) tags.push("지지 합으로 기운 재편·완충");
    if (chung) tags.push("지지 충으로 변동·자극 증폭 가능");
  }
  if (anchor === "천간" && pillarStem) {
    const { chung, hap } = stemTouchFlags(pillarStem, relations);
    if (hap) tags.push("천간 합으로 표면 의지 융화");
    if (chung) tags.push("천간 충으로 표현·결정 요동");
  }

  if (LUCK_SENSITIVE.has(name)) {
    tags.push("세운·월운 흐름에 민감");
  }
  if (ctx.seunBranch && anchor === "지지" && pillarBranch && ctx.seunBranch === pillarBranch) {
    tags.push("올해 세운 지지와 동일 — 가시화");
  }
  if (ctx.daewoonBranch && anchor === "지지" && pillarBranch && ctx.daewoonBranch === pillarBranch) {
    tags.push("현재 대운 지지와 동일 — 장기 영향");
  }

  return [...new Set(tags)];
}

const KNOWN_COMBOS: Array<{ keys: [string, string]; title: string; text: string }> = [
  {
    keys: ["홍염", "도화"],
    title: "홍염 + 도화",
    text: "이성·인기 기운이 겹쳐 주목도가 높아질 수 있으나, 관계의 깊이와 변덕·과소비에 더욱 신경 쓰는 것이 좋습니다.",
  },
  {
    keys: ["천을귀인", "문창귀인"],
    title: "천을귀인 + 문창귀인",
    text: "따뜻한 귀인과 문서·학문 귀인이 함께하면 시험·이직·학습에서 돕는 연결이 잘 이어질 수 있습니다.",
  },
  {
    keys: ["화개", "문창귀인"],
    title: "화개 + 문창귀인",
    text: "내면·체험을 중시하는 화개와 표현의 문창이 만나면 예술·종교·상담 등 내면 숙성이 결과로 드러나기 쉽습니다.",
  },
];

export function buildShinsalCombinationNotes(activeNames: Set<string>): ShinsalCombinationNote[] {
  const out: ShinsalCombinationNote[] = [];
  for (const row of KNOWN_COMBOS) {
    const [a, b] = row.keys;
    if (activeNames.has(a) && activeNames.has(b)) {
      out.push({ title: row.title, text: row.text, members: [a, b] });
    }
  }
  return out;
}

export function buildShinsalInterpretationList(
  shinsalPillars: PillarShinsal[],
  relations: BranchRelation[],
  ctx: { seunBranch?: string; daewoonBranch?: string } = {},
): ShinsalInterpretationEntry[] {
  const list: ShinsalInterpretationEntry[] = [];
  let seq = 0;

  for (const ps of shinsalPillars) {
    const domain = PILLAR_INFLUENCE[ps.pillar] ?? "생활 전반";

    const pushOne = (name: string, anchor: ShinsalAnchor) => {
      const triggerDetail = ps.triggerInfo[name] ?? "";
      const { kind, label } = classifyBasis(triggerDetail);
      const oneLine = SHINSAL_DESC[name] ?? "이 신살은 사주 맥락에 따라 작용 강도가 달라질 수 있습니다.";
      const branch = anchor === "지지" || anchor === "주전체" ? ps.branch : "";
      const stem = anchor === "천간" || anchor === "주전체" ? ps.stem : "";
      const activationStates = buildActivationStates(
        name,
        anchor,
        triggerDetail,
        ps.branch,
        ps.stem,
        relations,
        ctx,
      );
      seq += 1;
      list.push({
        id: `shinsal-${ps.pillar}-${anchor}-${name}-${seq}`,
        name,
        pillar: ps.pillar,
        anchor,
        basisKind: kind,
        basisLabel: label,
        triggerDetail,
        influenceDomain: domain,
        activationStates,
        oneLine,
      });
    };

    for (const name of ps.pillarItems ?? []) pushOne(name, "주전체");
    for (const name of ps.stemItems ?? []) pushOne(name, "천간");
    for (const name of ps.branchItems ?? []) pushOne(name, "지지");
  }

  return list;
}

export function formatTodayShinsalOneLine(name: string): string {
  // 오늘운세 탭 전용: 원국 설명(SHINSAL_DESC)과 문장을 분리하고, 반드시 '오늘/현재' 시제로 통일합니다.
  if (/귀인/.test(name)) return `오늘 ${name} 도움 흐름이 들어올 수 있습니다. 연결과 지원을 적극적으로 활용하세요.`;
  if (name === "도화" || name === "홍염") return `오늘 ${name} 기운이 활성화될 수 있습니다. 호감·표현이 커질수록 경계도 함께 잡아주세요.`;
  if (/(충|형|파|해|원진)/.test(name)) return `오늘 ${name} 자극이 생길 수 있어 주의가 필요합니다. 반응보다 정리·완충이 유리합니다.`;
  if (/(살)$/.test(name)) return `오늘 ${name} 기운이 작동할 수 있습니다. 과속·과열을 피하고 안전하게 조절하세요.`;
  return `오늘 ${name} 기운이 작동할 수 있습니다. 오늘의 흐름에 맞춰 강약을 조절해보세요.`;
}
