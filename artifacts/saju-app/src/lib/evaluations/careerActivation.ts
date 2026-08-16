/**
 * 커리어 활성도 / 전개 방향 (Career Activation / Direction) — 대운·세운 기반 timing layer.
 *
 * 기존 "관성 활성도"(officerActivationNow, luckTimingActivation.ts)는 관성 한 축만
 * 본다. 관성은 커리어를 구성하는 일부 요소일 뿐이고, 특히 여성 사주에서는 배우자성과도
 * 겹치므로 관성 활성도를 그대로 "커리어 활성도"로 표시하면 의미가 왜곡된다.
 *
 * 이 모듈은 원국 커리어 점수(structureDomains.career.score, 변경하지 않음)를 기준값으로
 * 두고, 커리어를 구성하는 세 축 — 식상(생산·표현) / 관성(조직·책임) / 인성(학습·전문성) —
 * 이 대운·세운에서 각각 얼마나 자극되는지를 격국(어느 축이 이 사람의 커리어 축인지)과
 * 용신·희신·기신 방향으로 가중해 evidence ledger에 쌓는다. 원국 계산 요소(식상·관성·인성·
 * 격국·용신)는 재사용만 하고 새로 만들지 않는다.
 *
 * ── magnitude(활성도) vs quality(전개 방향) 분리 ──────────────────────────
 * "이 시기에 커리어 관련 사건이 얼마나 크게 움직이는가"(활성도)와 "그 움직임이 확장·성과
 * 쪽인지 압박·축소 쪽인지"(전개 방향)는 다른 질문이다. 같은 근거라도:
 *  - 그룹 오행(식상/관성/인성) 자체가 대운·세운에 등장하는 것 = 크기 신호(방향 중립)
 *  - 그 오행을 생하는 기운(순조로운 흐름) 등장 = 우호 방향 신호
 *  - 그 오행을 극하는 기운(충돌) 등장 = 비우호 방향 신호
 *  - 그 오행이 이 사람의 용신·희신/기신인지 = 우호/비우호 방향 신호
 * 이 네 종류를 모두 activationScore(절댓값 합)에는 포함하고, directionScore(부호 합)에는
 * 방향이 있는 것만 반영한다 — "관성이 등장하면서 동시에 기신이고 재생관 구조까지 겹치는" 경우,
 * 등장은 활성도에 한 번만, 기신/재생관은 서로 상충하는 evidence로 방향에 각각 남긴다(어느
 * 한쪽을 삭제하거나 이중 가산하지 않음).
 *
 * ── category cap ─────────────────────────────────────────────────────────
 * 근거가 여러 경로(대운/세운 × 천간/지지 × 여러 규칙)로 겹쳐도 한 그룹이 무제한으로
 * 불어나지 않도록, 그룹별로 절댓값 상한을 적용한 뒤 axis 합산한다.
 */

import {
  type FiveElKey,
  GENERATES,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";

export type CareerLevel = "강함" | "보통" | "약함";
export type CareerDirectionLevel = "우호 우세" | "중립" | "부담 우세";

export interface CareerEvidenceFactor {
  label: string;
  /** 항상 양수 — activation은 이 값의 절댓값 합, direction은 부호 있는 합 */
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
  /** category cap 적용 단위(그룹명) */
  category: CareerGroup;
}

export interface CareerActivationResult {
  activationScore: number;
  activationLevel: CareerLevel;
  directionScore: number;
  directionLevel: CareerDirectionLevel;
  factors: CareerEvidenceFactor[];
  interpretation: string;
}

export interface CareerActivationContext {
  dayStem: string;
  /** structureDomains.career.score — 원국 커리어 점수. 여기서 재계산하지 않고 기준값으로만 사용 */
  baseCareerScore: number;
  /** interpretation.gukguk?.name — 어느 축(식상/관성/인성)이 이 사람의 커리어 중심인지 가중하는 데만 사용 */
  gukgukName?: string;
  daewoonHangul?: string;
  saeunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
}

type CareerGroup = "식상" | "관성" | "인성";
const CAREER_GROUP_LABEL: Record<CareerGroup, string> = {
  식상: "식상(생산·표현)",
  관성: "관성(조직·책임)",
  인성: "인성(학습·전문성)",
};
/** 그룹별 절댓값 상한 — activation·direction 각각 독립적으로 이 상한을 적용한다.
 * (아래 diminishing-returns 가중이 그룹 간 합산 폭주를 이미 억제하므로, 이 cap은 한 그룹
 * 내에서 같은 캐릭터가 반복 등장하는 극단적 경우에 대한 안전망 정도로만 넉넉하게 둔다 —
 * 너무 낮게 잡으면 diminishing 가중과 겹쳐 활성도 상한 자체가 너무 낮아진다.) */
const CATEGORY_CAP = 32;
/**
 * 식상/관성/인성 3개 그룹이 5개 오행 중 3개를 차지하다 보니, 대운·세운 글자가 "그중 하나"에
 * 걸릴 확률이 구조적으로 매우 높다 — 즉 3그룹 모두 어느 정도씩 활성화되는 게 예외가 아니라
 * 거의 매년의 기본값이다. 그룹별 cap 후 단순 선형 합산(overall cap)을 했더니 실측 회귀에서
 * 총합이 상한 근처(≈57점)에 거의 매년 고정되고 연도 간 변별력이 사라지는 게 확인됐다.
 * → 그룹 간 합산은 선형이 아니라 체감(diminishing returns)으로 한다: 가장 강한 그룹은
 * 100%, 두 번째는 50%, 세 번째는 25%만 반영 — "여러 그룹이 동시에 약하게 걸리는 흔한 해"와
 * "한 그룹이 강하게 몰리는 특별한 해"가 실제로 다른 점수로 구분되도록 한다.
 */
const GROUP_DIMINISHING_WEIGHTS = [1, 0.5, 0.25];

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ⚠️ 잠정값(provisional) — 식상·관성·인성 3그룹이 5개 오행 중 3개를 차지해 매년 어느
// 정도 evidence가 있는 게 구조적 기본값이라, 65/35 같은 원래 절대 임계값으로는 활성도가
// "강함"에 거의 도달하지 못했다. 지금 50/38은 박소연·김혁 2명 × 20년(40개 연도) 표본의
// 실측 분포(38~51)에 맞춰 급하게 맞춘 값으로, 공식 구조(diminishing-returns 합산·evidence
// 우선순위) 수정과는 성격이 다르다 — 이 값 자체는 소표본 과최적화 위험이 있으므로,
// 더 넓은 synthetic/random 원국 표본 회귀 또는 전통 명리 정의(예: 대운·세운이 몇 개
// 유력 십성을 동시에 자극하는 해를 "강함"으로 보는 기준 등)로 재검증하기 전까지 최종
// 확정값으로 취급하지 말 것.
function activationLevelFromScore(s: number): CareerLevel {
  if (s >= 50) return "강함";
  if (s >= 38) return "보통";
  return "약함";
}

function directionLevelFromScore(s: number): CareerDirectionLevel {
  if (s >= 62) return "우호 우세";
  if (s <= 38) return "부담 우세";
  return "중립";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

function charElement(kind: "천간" | "지지", ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return (kind === "천간" ? STEM_TO_ELEMENT[ch] : BRANCH_TO_ELEMENT[ch]) as FiveElKey | undefined;
}

/** 일간 기준 커리어 3축의 오행. 식상=일간이 생하는 오행, 관성=일간을 극하는 오행, 인성=일간을 생하는 오행. */
function careerGroupElement(dm: FiveElKey, group: CareerGroup): FiveElKey {
  if (group === "식상") return GENERATES[dm];
  if (group === "관성") return getController(dm);
  return getGenerator(dm); // 인성
}

/** 격국명에서 어느 축이 이 사람의 커리어 중심축인지 읽어 가중치만 살짝 준다(격국 재계산 없음). */
function gukgukEmphasis(gukgukName: string | undefined): Record<CareerGroup, number> {
  const w: Record<CareerGroup, number> = { 식상: 1, 관성: 1, 인성: 1 };
  if (!gukgukName) return w;
  if (gukgukName.includes("식") || gukgukName.includes("상관")) w.식상 = 1.3;
  if (gukgukName.includes("관")) w.관성 = 1.3;
  if (gukgukName.includes("인")) w.인성 = 1.3;
  return w;
}

/**
 * 한 글자(천간 또는 지지)가 이 그룹에 대해 어떤 evidence를 만드는지 판정해서 push한다.
 *
 * 글자 하나당 이 그룹에 대해 evidence를 "하나만" 남긴다(등장/생조/극제/용신/희신/기신 중
 * 가장 구체적인 것 하나, 우선순위: 생조·극제 > 용신 > 희신·기신 > 단순 등장). 식상·관성·
 * 인성 3그룹이 5개 오행 중 3개를 차지해서 대운·세운 글자가 우연히 여러 조건에 동시에
 * 걸리기 쉬운데(예: 그룹 오행 자체가 이 사람 용신이면 "등장"과 "용신 일치"가 같은 글자에서
 * 동시에 발생), 이걸 각각 별도 evidence로 다 더하면 실측 회귀에서 거의 매년 상한 근처로
 * 점수가 몰려 연도별 변별력이 사라지는 게 확인됐다. 하나의 글자는 하나의 사실이므로,
 * 가장 구체적인 관계 하나만 evidence로 남기고 그 방향을 그대로 쓴다.
 */
function pushGroupEvidence(
  factors: CareerEvidenceFactor[],
  luckLabel: "대운" | "세운",
  charKind: "천간" | "지지",
  ch: string | undefined,
  group: CareerGroup,
  groupEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
  emphasis: number,
) {
  const el = charElement(charKind, ch);
  if (!el || !ch) return;
  const tag = `${luckLabel} ${charKind} ${ch}(${el}) → ${CAREER_GROUP_LABEL[group]}`;
  const push = (label: string, magnitude: number, direction: "우호" | "비우호" | "중립") => {
    const m = Math.round(magnitude * emphasis);
    if (m > 0) factors.push({ label, magnitude: m, direction, category: group });
  };

  if (el === getGenerator(groupEl)) { push(`${tag} 생조 구조(순조로운 흐름)`, 5, "우호"); return; }
  if (el === getController(groupEl)) { push(`${tag} 극제 구조(충돌·저항)`, 6, "비우호"); return; }
  if (el === yongshin) { push(`${tag} 용신 일치`, 5, "우호"); return; }
  if (gisin && el === gisin) { push(`${tag} 기신 일치(부담)`, 5, "비우호"); return; }
  if (heesin && el === heesin) { push(`${tag} 희신 일치`, 3, "우호"); return; }
  // 위 어느 것도 아니면서 그룹 오행 자체와만 일치 — 순수 배경 크기 신호(방향 중립)
  if (el === groupEl) push(`${tag} 등장(사건 크기)`, 4, "중립");
}

/** evidence ledger에서 그룹별로 category cap을 적용한 뒤 axis 합산한다. */
function axisTotal(factors: CareerEvidenceFactor[], signed: boolean): number {
  const byGroup = new Map<CareerGroup, number>();
  for (const f of factors) {
    const value = signed
      ? f.direction === "우호" ? f.magnitude : f.direction === "비우호" ? -f.magnitude : 0
      : f.magnitude;
    byGroup.set(f.category, (byGroup.get(f.category) ?? 0) + value);
  }
  const capped = [...byGroup.values()].map((v) => Math.max(-CATEGORY_CAP, Math.min(CATEGORY_CAP, v)));
  // 절댓값(신호 강도) 기준 내림차순 정렬 후 체감 가중 — 부호는 그대로 유지해서 서로 반대
  // 방향인 그룹끼리는 자연스럽게 상쇄되고(삭제 아님), 같은 방향끼리는 조금씩만 더해진다.
  capped.sort((a, b) => Math.abs(b) - Math.abs(a));
  return capped.reduce((sum, v, i) => sum + v * (GROUP_DIMINISHING_WEIGHTS[i] ?? 0), 0);
}

export function computeCareerActivation(ctx: CareerActivationContext): CareerActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  if (!dmEl) {
    return {
      activationScore: 0, activationLevel: "약함",
      directionScore: 50, directionLevel: "중립",
      factors: [],
      interpretation: "일간 정보가 없어 커리어 활성도를 계산할 수 없습니다.",
    };
  }

  const emphasis = gukgukEmphasis(ctx.gukgukName);
  const factors: CareerEvidenceFactor[] = [];

  for (const group of ["식상", "관성", "인성"] as CareerGroup[]) {
    const groupEl = careerGroupElement(dmEl, group);
    for (const [luckLabel, hangul] of [["대운", ctx.daewoonHangul], ["세운", ctx.saeunHangul]] as const) {
      const { stem, branch } = parsePillar(hangul);
      pushGroupEvidence(factors, luckLabel, "천간", stem, group, groupEl, ctx.yongshin, ctx.heesin, ctx.gisin, emphasis[group]);
      pushGroupEvidence(factors, luckLabel, "지지", branch, group, groupEl, ctx.yongshin, ctx.heesin, ctx.gisin, emphasis[group]);
    }
  }

  const activationRaw = axisTotal(factors, false);
  const activationScore = clamp100(15 + activationRaw);
  const activationLevel = activationLevelFromScore(activationScore);

  const directionRaw = axisTotal(factors, true);
  const directionScore = clamp100(50 + directionRaw);
  const directionLevel = directionLevelFromScore(directionScore);

  const interpretation = buildInterpretation(activationLevel, directionLevel);

  return { activationScore, activationLevel, directionScore, directionLevel, factors, interpretation };
}

function buildInterpretation(activation: CareerLevel, direction: CareerDirectionLevel): string {
  if (activation === "약함") {
    return "직업·역할·조직 관련 이슈가 크게 부각되지 않는 평이한 시기입니다.";
  }
  if (activation === "강함" && direction === "우호 우세") {
    return "직업·프로젝트·역할과 관련된 움직임이 강화되는 시기이며, 방향도 우호적이라 새로운 역할 제안·성과 평가·확장이 기대되는 흐름입니다.";
  }
  if (activation === "강함" && direction === "부담 우세") {
    return "커리어 관련 사건·변화는 강하게 움직이지만 방향은 압박·충돌 쪽에 가깝습니다. 조직 갈등, 과책임, 성과 압박 등에 대비가 필요한 시기입니다.";
  }
  if (activation === "강함") {
    return "커리어 관련 움직임이 강화되는 시기이지만 우호·부담 요인이 혼재해 방향이 뚜렷하지 않습니다. 아래 근거를 함께 참고하세요.";
  }
  // 보통 activation
  if (direction === "부담 우세") {
    return "큰 사건은 아니지만 방향은 압박 쪽에 가깝습니다. 무리한 확장보다 현재 역할을 다지는 편이 안전합니다.";
  }
  return "커리어 관련 흐름은 무난한 수준입니다.";
}
