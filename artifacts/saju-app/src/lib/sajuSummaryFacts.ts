// 사주 개인 원국 핵심 요약 — 이미 계산된 computeSajuPipeline() 결과와 SajuReport.tsx가 이미
// 계산해 둔 신살·합충형파해 리스트를 그대로 재사용해 6개 섹션으로 재구성한다. 새 계산 로직·새
// 채점 기준은 만들지 않는다(대표 지시). 자미두수 리포트와는 공용 타입(ReportFact/Polarity,
// src/lib/reportFacts.ts)만 같이 쓰고, 계산 엔진끼리는 서로 의존하지 않는다. 문장 합성은
// 별도 구현이다 — 아래 synthesizeSajuSection 주석 참고.
//
// fact 생성 우선순위는 항상 고정한다: 일간 강약 → 격국 → 용신·희신 → 오행 → 십성 →
// 합충형파해원진 → 신살(보조).
//
// [메인 fact vs evidence 분리 — 대표 지시]
// 각 섹션은 "메인"(섹션당 2~4개, AI 다듬기/텍스트 합성에 쓰는 대표 해석)과 "evidence"(원자료
// 전부, [왜 이런 결과인가요?] 토글용)를 분리한다. 메인은 전역 우선순위 상위 N개를 자르는 게
// 아니라, 섹션 목적에 맞는 fact만 고른다(RULE_SECTION_MAP 참고). evidence는 그 섹션이 참조한
// 모든 원자료(강약 점수, 격국명, 용신 오행, 십성 카운트, 합충형파해원진 원문, 신살 원문)를
// 그대로 보존한다 — 메인에서 빠진 fact라도 evidence 자체는 잃지 않는다.
//
// [메인 본문 기술용어 제거 — 대표 지시] 일간·격국명·용신·재성/식상/관성/비겁/인성·합충형파해
// 명칭·신살명 같은 명리 기술용어는 메인 문장에 원칙적으로 노출하지 않고 사람의 행동/성향
// 언어로 옮긴다. 기술용어는 evidence(label)에만 남긴다 — stripTechnicalTerms()/
// gukgukPlainText() 참고. 엔진이 낸 원문 문자열 자체(계산 로직)는 바꾸지 않고, 화면에 내보내기
// 직전 요약 레이어에서만 치환한다.
//
// polarity 원칙(대표 지시 — 엔진이 명시적으로 방향을 준 경우만 positive/risk, 나머지는 neutral):
//   - 격국.tone("길"/"흉"/"중")은 gukguk.ts가 이미 명시한 값 → 길=positive, 흉=risk, 중=neutral.
//   - 용신·희신(adjusted.effectiveYongshin/-Secondary)은 "이 사람에게 필요한/도움이 되는
//     오행"이라는 정의 자체가 방향을 담고 있으므로 positive로 쓴다(새 판단이 아니라 개념 정의).
//   - 강약 설명, 오행/십성 분포, 합충형파해원진, ruleInsights(신강약/십성/조후/궁합 카테고리),
//     신살은 이 자체로 길흉을 명시하는 필드가 없으므로 전부 neutral로 보존한다 — 애매한 구조를
//     positive/risk로 밀어넣지 않는다. "강점"/"주의할 점" 섹션에 배치되더라도 polarity 자체는
//     바꾸지 않는다(섹션 배치는 주제 관련성일 뿐, 새로운 길흉 판단이 아니다).
//
// [신살 = evidence only, 절대 main fallback으로 쓰지 않음 — 대표 지시] 조용민 사례(신살
// 12개가 "핵심 성향" main에 전부 쏟아져 들어간 회귀) 이후로, 신살은 핵심 fact가 부족한
// 경우에도 main의 빈칸을 채우는 용도로 절대 쓰지 않는다. shinsalFacts는 언제나
// evidenceOnlyFacts로만 들어가고(section.evidence에는 남음), section.facts·text에는 전혀
// 반영되지 않는다 — "참고로 ~" 문구 자체를 아예 만들지 않는다. 신살 oneLine에 timing 표현이
// 섞여 있어도(실제로 있었다) main에 안 쓰이므로 자동으로 걸러진다.
//
// [핵심 fact 부족 시 억지로 채우지 않기 — 대표 지시] 상위 구조(강약/격국/용희기신/십성) fact가
// 부족하면 다른 출처로 2~4개를 억지로 채우지 않고, 있는 그대로 짧게(때로 1문장) 유지한다.
// 어떤 섹션이든 main fact가 0개면 generic filler를 만들지 않고 섹션 자체를 숨긴다
// (SajuCoreSummary.tsx가 facts.length===0인 섹션을 렌더링하지 않음).
import type { SajuPipelineResult } from "./sajuPipeline";
import type { BranchRelation, RelationType } from "./branchRelations";
import type { ShinsalInterpretationEntry } from "./shinsalInterpretation";
import { type ReportFact, type Polarity } from "./reportFacts";

export interface SajuEvidenceItem {
  category:
    | "strength" | "gukguk" | "yongshin" | "fiveElement" | "tenGod" | "interaction" | "shinsal" | "ruleInsight"
    // 10단계(월별운세 핵심 요약)가 추가한 시점 출처 카테고리 — 원국 요약과 달리 "어떤 판단인지"가
    // 아니라 "어느 시점(원국/대운/세운/월운)에서 나온 근거인지"를 구분해야 해서 별도로 둔다.
    | "natal" | "daewoon" | "saeun" | "wolun"
    // 11단계(궁합 핵심 요약)가 추가한 카테고리 — 두 사람 사이의 궁합 근거 출처를 구분한다.
    | "compatScore" | "compatDetail" | "compatAxis" | "compatMarriage";
  label: string;
}

export type SajuFact = ReportFact<SajuEvidenceItem>;

export type SajuSectionKey = "atAGlance" | "coreNature" | "strengths" | "cautions" | "workWealth" | "romanceRelationship";

export interface SajuSummarySection {
  key: SajuSectionKey;
  title: string;
  /** deterministic 합성 문단 — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback. */
  text: string;
  /** prose layer에 보낼 fact 목록(섹션당 2~4개, 섹션 목적에 맞게 선택) — 섹션당 딱 1회만
   * polishStatementText를 호출한다. */
  facts: SajuFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거(강약/격국/용신/오행/십성/합충형파해원진/신살 원자료).
   * 메인 fact 선택과 무관하게, 이 섹션이 참조한 원자료는 전부 보존한다. */
  evidence: SajuEvidenceItem[];
}

const GUKGUK_TONE_POLARITY: Record<"길" | "흉" | "중", Polarity> = { 길: "positive", 흉: "risk", 중: "neutral" };

/** [원국 성향에 어긋나는 timing 표현 가드] "~시기/증가한다/전환점/기회가 생긴다" 같은 문장은
 * 운세(대운·세운·월운·일운)의 몫이고, 원국 성향(타고난 구조)에는 섞이지 않아야 한다(대표
 * 지시). 지금 붙는 11개 규칙 문장에는 해당 표현이 없지만, 향후 규칙이 늘어날 때를 대비한
 * 방어 필터다 — 이 필터가 걸러도 evidence의 원문 자체는 그대로 남는다(참조만 안 할 뿐). */
const TIMING_LANGUAGE_PATTERN = /시기|증가한다|전환점|기회가 생긴다/;
function isTimingSentence(text: string): boolean {
  return TIMING_LANGUAGE_PATTERN.test(text);
}

/** interpretationRules.ts가 이미 만들어 둔 11개 규칙 해석 문장을 어느 요약 섹션의 "현실 언어"로
 * 배치할지 정하는 매핑이다 — 규칙의 조건/판정 자체(어떤 조건에서 발동하는지)는 전혀 바꾸지
 * 않고, 이미 성립한 해석 문장의 배치만 정한다(새 명리 판단이 아니다). 규칙 하나는 정확히 한
 * 섹션에만 배치해 같은 내용이 여러 섹션에 중복되지 않게 한다(유사 fact 병합 원칙).
 *   R01 압박형 권위 구조   → 주의할 점 (관성 압박·스트레스 과잉 패턴)
 *   R02 계획형 재물 구조   → 일·재물 (재물 감각·계획/전략)
 *   R03 조후 화 필요       → 핵심 성향 (기질·필요 환경)
 *   R04 조후 수 필요       → 핵심 성향 (기질·필요 환경, R03의 반대 계절)
 *   R05 경쟁형 에너지 구조 → 핵심 성향 (자기주도성·판단 방식)
 *   R06 창의형 표현가 구조 → 강점 (실제 잘 쓰이는 능력)
 *   R07 스트레스 과부하    → 주의할 점 (과잉될 때 나타나는 패턴)
 *   R08 균형형 다재다능    → 핵심 성향 (판단·역할 방식)
 *   R09 극신강 독립·사업형 → 강점 (실제 잘 쓰이는 능력)
 *   R10 인성강 학습형      → 강점 (실제 잘 쓰이는 능력)
 *   R11 오행 결핍 보완     → 주의할 점 (공백·보완이 필요한 패턴)
 */
const RULE_SECTION_MAP: Record<string, SajuSectionKey> = {
  R01: "cautions",
  R02: "workWealth",
  R03: "coreNature",
  R04: "coreNature",
  R05: "coreNature",
  R06: "strengths",
  R07: "cautions",
  R08: "coreNature",
  R09: "strengths",
  R10: "strengths",
  R11: "cautions",
};

/** interpretationRules.ts R11이 이미 쓰는 십성 그룹→개념 매핑을 그대로 재사용한다(새 정의
 * 아님) — 재성·식상, 관성·비겁 같은 원자료를 메인에 그대로 쓰지 않고, 그 그룹이 가리키는
 * 이미 확립된 개념으로만 옮겨 표현한다(대표 지시: 기술용어 노출 금지 → 행동/성향 언어로). */
const TEN_GOD_CONCEPT_LABEL: Record<string, string> = {
  비겁: "독립·의지", 식상: "표현·창의", 재성: "재물·현실", 관성: "명예·규범", 인성: "학습·보호",
};

/** 상위 5개 그룹의 고정 순서 — 여러 그룹이 함께 STRONG일 때 결합 문장의 순서를 결정적으로
 * 만든다(대표 지시: 5개 십성 전체 분포를 보되 새 개념은 추가하지 않음). */
const ALL_TEN_GOD_GROUPS = ["비겁", "식상", "재성", "관성", "인성"] as const;

/** gukguk.description 등에는 세부 십성 10종(비견/겁재/식신/상관/정재/편재/정관/편관/정인/편인)이
 * 그대로 쓰인다 — 이것도 기술용어이므로, 이미 있는 상위 그룹 개념(TEN_GOD_CONCEPT_LABEL)으로만
 * 옮긴다(새 개념 발명 아님, 상위 5개 그룹 매핑을 세분화 십성에 적용한 것뿐). */
const SPECIFIC_TEN_GOD_TO_GROUP: Record<string, string> = {
  비견: "비겁", 겁재: "비겁",
  식신: "식상", 상관: "식상",
  정재: "재성", 편재: "재성",
  정관: "관성", 편관: "관성",
  정인: "인성", 편인: "인성",
};

/** 일간 강도(엔진의 StrengthLevel 원문)를 메인 문장에서 쓸 짧은 수식어로만 옮긴다 — 등급
 * 이름(신약/태강 등)은 evidence에는 그대로 남고, 메인 문장에서는 이 수식어로 대체된다. */
const STRENGTH_LEVEL_PLAIN: Record<string, string> = {
  극신약: "매우 약한", 태약: "약한", 신약: "다소 약한",
  중화: "균형 잡힌",
  신강: "다소 강한", 태강: "강한", 극신강: "매우 강한",
};

function endsWithBatchim(text: string): boolean {
  const last = text.trim().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 받침 유무로 형태가 바뀌는 조사만 보정한다(이/가, 은/는, 을/를, 과/와, 으로/로) — "의"처럼
 * 받침과 무관한 조사는 그대로 둔다. 대체어의 받침에 맞는 형태로 다시 골라준다. */
const PARTICLE_PAIRS: [string, string][] = [["이", "가"], ["은", "는"], ["을", "를"], ["과", "와"], ["으로", "로"]];
function fixParticle(original: string, replacement: string): string {
  const pair = PARTICLE_PAIRS.find(([a, b]) => a === original || b === original);
  if (!pair) return original;
  const [batchimForm, noBatchimForm] = pair;
  return endsWithBatchim(replacement) ? batchimForm : noBatchimForm;
}

/** interpretationRules.ts 문장에는 "관성(압박·책임)", "일간", "신약", "용신(목)", "희신" 같은
 * 명리 기술용어가 이미 섞여 있다 — 엔진 문장(계산 로직) 자체는 바꾸지 않고, 화면에 내보내기
 * 직전에만 사람 언어로 치환한다. 원문은 evidence(ruleInsight label)에 그대로 남긴다. */
function stripTechnicalTerms(text: string): string {
  let out = text;

  // "관성(압박·책임)이" → "명예·규범이" (이미 붙어 있던 개념 설명을 그대로 쓰고, 조사만 보정).
  // "정관"/"편재" 같은 세부 십성명은 SPECIFIC_TEN_GOD_TO_GROUP으로 상위 그룹을 찾아 같은
  // 개념 라벨로 옮긴다(둘 다 결국 TEN_GOD_CONCEPT_LABEL 범위 안).
  out = out.replace(
    /(비견|겁재|식신|상관|정재|편재|정관|편관|정인|편인|비겁|식상|재성|관성|인성)(?:\(([^)]+)\))?(이|가|은|는|을|를|과|와|으로|로)?/g,
    (_m, term: string, paren: string | undefined, particle: string | undefined) => {
      const group = SPECIFIC_TEN_GOD_TO_GROUP[term] ?? term;
      const label = paren ?? TEN_GOD_CONCEPT_LABEL[group];
      return particle ? `${label}${fixParticle(particle, label)}` : label;
    },
  );

  // "용신(목)" → "목 기운", "조후용신으로" → 삭제, "희신" → "보조 기운", "일간(기운/에너지)" →
  // "타고난 기운"(뒤에 "기운"/"에너지"가 이미 따라오면 중복("타고난 기운 기운")이 안 되게 그
  // 구간까지 통째로 치환한다), 단독 "일간"도 같은 방식으로 치환.
  out = out.replace(/용신\(([^)]+)\)/g, (_m, el: string) => `${el} 기운`);
  out = out.replace(/조후용신으로\s*/g, "");
  out = out.replace(/희신/g, "보조 기운");
  const ILGAN_PARTICLE = "(이|가|은|는|을|를|과|와|으로|로)?";
  out = out.replace(new RegExp(`일간\\s*(?:기운|에너지)${ILGAN_PARTICLE}`, "g"), (_m, particle?: string) =>
    particle ? `타고난 기운${fixParticle(particle, "타고난 기운")}` : "타고난 기운");
  out = out.replace(new RegExp(`일간${ILGAN_PARTICLE}`, "g"), (_m, particle?: string) =>
    particle ? `타고난 기운${fixParticle(particle, "타고난 기운")}` : "타고난 기운");

  // 강도 등급 이름(신약/태강 등)을 짧은 수식어로.
  out = out.replace(
    new RegExp(Object.keys(STRENGTH_LEVEL_PLAIN).join("|"), "g"),
    (m) => STRENGTH_LEVEL_PLAIN[m],
  );

  return out;
}

/** "관성이 강하지만 인성이 이를..." 처럼 한 규칙의 원문 안에 성격 서술과 조언/약점/직업
 * 예시가 함께 있으면, stripTechnicalTerms만으로는 "섹션 목적에 안 맞는 절"까지 그대로
 * 남는다(예: '핵심 성향'에 재물 조언이 섞이거나, '강점'에 약점·보완 조언이 섞임). 그래서
 * 11개 규칙마다 "이 섹션에서 보여줄 결"만 손으로 다시 쓴다 — 규칙의 조건/판정과 의미는
 * 그대로 두고(새 명리 판단 아님), 표현만 그 섹션 목적(성격/능력/과잉패턴 등)에 맞게 추리고
 * 문장을 다듬은 것이다. 원문 전체는 항상 evidence(ruleInsight)에 그대로 남는다.
 *
 *   R01 압박형 권위 구조   → 주의할 점: 조언(인성으로 보충) 제거, 과잉 패턴만.
 *   R02 계획형 재물 구조   → 일·재물: "핵심"이라는 단정과 실행력 조언 완화.
 *   R03/R04 조후 화·수 필요 → 핵심 성향: 마지막 "~보조하세요" 명령형 조언 제거.
 *   R05 경쟁형 에너지 구조 → 핵심 성향: 재물 결과·파트너/멘토 조언 제거, 성향/행동만.
 *   R06 창의형 표현가 구조 → 강점: 약점(학습·안정 부족)·조언(명상) 제거, 능력만.
 *   R07 스트레스 과부하    → 주의할 점: 휴식·충전 루틴 조언 제거, 패턴 서술로.
 *   R08 균형형 다재다능    → 핵심 성향: 장기 노력 조언 제거.
 *   R09 극신강 독립·사업형 → 강점: 구체 직업 예시(사업/전문직) 대신 일반화된 능력 서술.
 *   R10 인성강 학습형      → 강점: 약점(행동력 저하)·조언(실행 루틴) 제거, 능력만.
 *   R11 오행 결핍 보완     → 주의할 점: "OO의 공백" 같은 추상 표현 대신 실제 의사결정
 *     패턴으로. 결핍 그룹은 conditions 문자열에서 그대로 읽어와 새 판단을 만들지 않는다.
 */
const RULE_MAIN_TEXT_OVERRIDE: Record<string, (r: SajuPipelineResult["interpretation"]["rulesApplied"][number]) => string> = {
  R01: () => "책임과 의무를 과하게 짊어지려는 경향이 있어, 권위나 규범이 동기부여보다 스트레스로 다가올 수 있습니다.",
  R02: () => "재물에 대한 감각과 욕구는 강하지만 이를 행동으로 옮기는 힘은 상대적으로 약해, 계획과 전략 위주로 재물을 다루는 편입니다.",
  R03: () => "차분하고 다소 냉정한 기운이 강하게 자리잡고 있어, 따뜻하고 활동적인 환경에서 에너지가 더 잘 풀리는 편입니다.",
  R04: () => "열정과 에너지가 넘쳐 마음이 쉽게 달아오르는 편이라, 차분하고 여유 있는 환경에서 안정을 찾는 성향입니다.",
  R05: () => "자아와 독립심이 강하고 경쟁심이 높아, 협력보다는 스스로 판단하고 행동하는 것을 선호하는 편입니다.",
  R06: () => "창의적인 표현력과 행동력이 뛰어나 아이디어를 빠르게 실행으로 옮기는 능력이 있습니다.",
  R07: () => "외부의 요구와 책임이 내면의 여유보다 앞서기 쉬워, 스스로도 모르게 무리하다가 과로나 번아웃으로 이어질 수 있는 패턴입니다.",
  R08: () => "여러 영역에서 고르게 능력을 발휘하는 균형 잡힌 편으로, 한 분야에 강하게 몰두하기보다 협업하거나 조율하는 역할에서 판단력을 발휘합니다.",
  R09: () => "에너지가 강해 조직에 얽매이지 않고 독립적으로 판단하고 주도하는 능력이 뛰어납니다.",
  R10: () => "학습과 탐구, 직관이 발달해 지식을 받아들이고 깊이 파고드는 능력이 뛰어납니다.",
  R11: (r) => {
    const missing = r.conditions[0]?.match(/결핍 십성 그룹: (.+)/)?.[1]?.split("·") ?? [];
    const primary = missing[0];
    return TEN_GOD_DEFICIT_PATTERN[primary]
      ?? "특정 영역의 기운이 매우 부족해, 그 영역과 관련된 의사결정에서 공백이 나타날 수 있습니다.";
  },
};

/** R11(오행 결핍)이 결핍된 그룹에 따라 실제 어떤 의사결정 패턴으로 나타날 수 있는지를
 * 서술한다 — "OO의 공백" 같은 추상적 표현 대신, 이미 R11이 판정한 "이 그룹이 부족하다"는
 * 사실을 실제 행동 패턴으로만 옮긴 것이다(새 판단 아님). */
const TEN_GOD_DEFICIT_PATTERN: Record<string, string> = {
  비겁: "결단을 내려야 하는 순간에 스스로 확신하지 못하고 주저하는 경향이 나타날 수 있습니다.",
  식상: "생각을 표현하거나 행동으로 옮기는 힘이 약해, 기회 앞에서 머뭇거리는 경향이 나타날 수 있습니다.",
  재성: "현실적인 판단이나 재물 감각이 약해, 계획이 실제 성과로 이어지기 어려운 경향이 나타날 수 있습니다.",
  관성: "책임이나 원칙을 지키는 기준이 흔들려, 결정과 행동이 상황에 따라 오락가락하는 경향이 나타날 수 있습니다.",
  인성: "배움이나 조언을 받아들이는 여유가 부족해, 자기 판단만으로 밀어붙이다 어려움을 겪는 경향이 나타날 수 있습니다.",
};

/** interpretationRules.ts가 이미 낸 문장 중 timing 표현이 없고, 이 섹션에 배치된 규칙(fired)만
 * 골라 SajuFact로 감싼다. 메인 문장은 RULE_MAIN_TEXT_OVERRIDE(섹션 목적에 맞게 다시 쓴 결)를
 * 우선 쓰고, 아직 override가 없는 규칙(향후 추가분)은 stripTechnicalTerms로 안전하게
 * fallback한다. 원문은 항상 evidence(ruleInsight label)에 그대로 남는다. ruleId는 "이미
 * 성립한 규칙의 의미를 현실 언어로 옮기는" 용도로만 쓰고, 여기서 새로 명리 판단을 내리지
 * 않는다. */
function mappedRuleFacts(pipeline: SajuPipelineResult, section: SajuSectionKey): SajuFact[] {
  return pipeline.interpretation.rulesApplied
    .filter((r) => r.fired && RULE_SECTION_MAP[r.ruleId] === section && !isTimingSentence(r.interpretation))
    .map((r) => fact(
      `rule-${r.ruleId}`,
      RULE_MAIN_TEXT_OVERRIDE[r.ruleId]?.(r) ?? stripTechnicalTerms(r.interpretation),
      "neutral",
      [ev("ruleInsight", `${r.ruleName}(${r.category}): ${r.interpretation}`)],
    ));
}

function ev(category: SajuEvidenceItem["category"], label: string): SajuEvidenceItem {
  return { category, label };
}

function fact(domain: string, meaning: string, polarity: Polarity, evidence: SajuEvidenceItem[]): SajuFact {
  return { id: `${domain}-${evidence.map((e) => e.label).join("|") || meaning}`, domain, meaning, polarity, strength: 1, evidence };
}

/** [구체 직업 예시 제거 — 대표 지시] "군·의료·스포츠 등 강한 직군이 맞습니다", "공직·법조·
 * 관리직에서 뛰어난 능력을 발휘합니다", "무역·사업·금융과 인연이 깊습니다"처럼 격국 설명이
 * 특정 직업/분야를 예로 드는 문장은, 그 직업이 deterministic 근거로 직접 뒷받침된 게 아니라
 * 격국 설명에 곁들여진 예시일 뿐이라 메인에서는 제거한다(문장 단위로만 제거해 나머지 성향
 * 서술은 그대로 둔다). 격국 설명들이 실제로 쓰는 문구 패턴(직군/직업/분야+인연·능력 발휘)을
 * 모두 잡는다 — 걸리는 문장이 없으면 원문을 그대로 반환한다. 원문 전체(직업 예시 포함)는
 * 항상 evidence에 남는다. */
function stripJobExampleSentences(text: string): string {
  const kept = text
    .split(/(?<=[.!?])\s*/)
    .filter((s) => s.trim().length > 0 && !/직군|어울리는 직업|적합한 직업|인연이 깊습니다|분야가 맞습니다|능력을 발휘합니다/.test(s));
  return kept.length > 0 ? kept.join(" ").trim() : text;
}

/** gukguk.description은 이미 행동 언어로 쓰여 있지만 "OO격으로 ..."(격국명 그대로) 또는
 * "정관이/편재가 격을 이루어 ..."(세부 십성명)처럼 명칭을 문장 안에서 반복한다 — 격국명
 * 접두사를 먼저 제거하고, 남은 문장에 세부 십성명이 있으면 stripTechnicalTerms로 상위 그룹
 * 개념 라벨로 옮긴다(패턴이 안 맞아도 원문을 그대로 반환해 문장이 깨지지 않게 한다 — 새
 * 격국명이 추가돼도 안전). 격국명·세부 십성명 자체는 evidence에만 남는다. */
function gukgukPlainText(gukguk: NonNullable<SajuPipelineResult["interpretation"]["gukguk"]>): string {
  const stripped = gukguk.description.replace(new RegExp(`^${gukguk.name}(으로|이라서|이며|은|는)?\\s*`), "");
  return stripJobExampleSentences(stripTechnicalTerms(stripped || gukguk.description));
}

/** [일·재물/연애·관계 fallback 세분화 — 대표 지시] interpretationRules.ts가 이미 쓰는
 * STRONG(>=0.30) 비율 경계를 그대로 재사용한다(새 threshold·새 강약 판정 아님 — 같은 숫자를
 * 이 파일에도 복제해 둔 것뿐이다). 조용민 사례(관성·비겁 딱 2개만 보다 보니 그 2개가 둘 다
 * MEDIUM인 사람이 많아 balanced로 몰리고, 실제로 다른 그룹이 두드러진 사람도 반영이 안 됨)
 * 이후로, 2개 그룹만 비교하지 않고 5개 그룹 전체에서 STRONG인 그룹을 모두 찾는다:
 *   - STRONG이 정확히 1개면 그 그룹 중심 문장.
 *   - STRONG이 2개 이상이면 그 그룹들을 함께 표현하는 문장(어느 조합이 나와도 쓸 수 있는
 *     일반형 템플릿 — 조합마다 손으로 문장을 만들지 않는다).
 *   - STRONG이 0개면(뚜렷한 그룹이 없음) balanced/중립 문장.
 * 어느 경우든 TEN_GOD_CONCEPT_LABEL 5개 라벨 범위 안에서만 표현한다. */
const STRONG_RATIO = 0.30;
function strongTenGodGroups(groups: Record<string, number>): string[] {
  const total = ALL_TEN_GOD_GROUPS.reduce((sum, g) => sum + (groups[g] ?? 0), 0) || 1;
  return ALL_TEN_GOD_GROUPS.filter((g) => (groups[g] ?? 0) / total >= STRONG_RATIO);
}

/** 십성 5개 그룹의 실제 분포를 규칙이 하나도 안 뜬 경우의 guaranteed fallback으로 문장화한다.
 * 그룹명 없이 개념 라벨만 메인에 쓰고, 원자료(그룹별 카운트)는 evidence에 그대로 남긴다. */
function tenGodDistributionFact(
  domain: string,
  groups: Record<string, number>,
  sentences: {
    single: Record<string, string>;
    combined: (joinedLabels: string) => string;
    balanced: string;
  },
): SajuFact {
  const strong = strongTenGodGroups(groups);
  const meaning = strong.length === 0
    ? sentences.balanced
    : strong.length === 1
      ? sentences.single[strong[0]]
      : sentences.combined(strong.map((g) => TEN_GOD_CONCEPT_LABEL[g]).join(", "));
  return fact(domain, meaning, "neutral", [
    ev("tenGod", `${ALL_TEN_GOD_GROUPS.map((g) => `${g} ${groups[g] ?? 0}`).join(" · ")} (strong: ${strong.join(",") || "없음"})`),
  ]);
}

/** 자미두수 synthesizeText는 "명사구 조각을 쉼표로 이어붙인 뒤 서술어 하나로 마무리"하는
 * 문체를 전제한다 — 여기서 다루는 fact.meaning은 (엔진이 이미 낸 description/ruleInsights/
 * oneLine이든, 이 파일이 직접 쓴 문장이든) 전부 "습니다/니다"로 끝나는 완결된 문장이라 그
 * 계약과 안 맞는다(억지로 붙이면 "핵심입니다.이 있는 구조입니다." 같은 비문이 된다). 그래서
 * saju는 공용 유틸을 그대로 가져다 쓰지 않고, 같은 전략(우호적/위험 진영 중 우세한 쪽을
 * 주절로, 소수 진영은 "다만" 양보절로)을 완결문 문체에 맞게 자체 구현한다 — 새 계산이 아니라
 * 순수 문장 이어붙이기 방식의 차이일 뿐이다. */
function normalizeSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSentences(facts: SajuFact[]): string {
  return facts.map((f) => normalizeSentence(f.meaning)).join(" ");
}

/** neutral fact는 방향성 계산에 넣지 않고 먼저 평이하게 서술한 뒤, 나머지(positive/risk)만
 * 우세한 쪽을 주절로 소수 진영을 "다만" 양보절로 통합한다.
 *
 * evidenceOnlyFacts(신살 등)는 본문(text)·AI 다듬기용 facts에는 절대 들어가지 않지만,
 * evidence에는 포함된다 — "신살은 main fallback으로 절대 쓰지 않되, evidence는 잃지 않는다"
 * (대표 지시)를 구현한다. facts가 비어 있으면 text도 빈 문자열이 된다 — 억지로 채우지 않고
 * 섹션을 짧게(또는 숨김) 유지한다는 원칙을 그대로 반영한다(호출부가 이 경우 섹션을 숨김). */
function synthesizeSajuSection(
  facts: SajuFact[],
  evidenceOnlyFacts: SajuFact[] = [],
): { text: string; facts: SajuFact[]; evidence: SajuEvidenceItem[] } {
  const neutral = facts.filter((f) => f.polarity === "neutral");
  const favorable = facts.filter((f) => f.polarity === "positive" || f.polarity === "mixed");
  const risk = facts.filter((f) => f.polarity === "risk");

  const neutralText = neutral.length > 0 ? joinSentences(neutral) : "";

  let directionalText = "";
  if (favorable.length > 0 && risk.length > 0) {
    directionalText = favorable.length >= risk.length
      ? `${joinSentences(favorable)} 다만 ${joinSentences(risk)}`
      : `${joinSentences(risk)} 그럼에도 ${joinSentences(favorable)}`;
  } else if (favorable.length > 0 || risk.length > 0) {
    directionalText = joinSentences([...favorable, ...risk]);
  }

  const text = [neutralText, directionalText].filter(Boolean).join(" ").trim();
  const evidence = [...facts, ...evidenceOnlyFacts].flatMap((f) => f.evidence);
  return { text, facts, evidence };
}

function buildAtAGlanceFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const facts: SajuFact[] = [];
  const sr = pipeline.base.strengthResult;
  if (sr.description) {
    facts.push(fact("strength", stripJobExampleSentences(stripTechnicalTerms(sr.description)), "neutral", [
      ev("strength", `강약: ${sr.level}(점수 ${sr.score}) — ${sr.description}`),
    ]));
  }
  const gukguk = pipeline.interpretation.gukguk;
  if (gukguk) {
    facts.push(fact(
      "gukguk",
      gukgukPlainText(gukguk),
      GUKGUK_TONE_POLARITY[gukguk.tone],
      [ev("gukguk", `격국: ${gukguk.name}(${gukguk.tone}) — ${gukguk.description}`)],
    ));
  }
  const yongshin = pipeline.adjusted.effectiveYongshin;
  facts.push(fact(
    "yongshin",
    `${yongshin} 기운을 보완하면 도움이 되는 구조입니다`,
    "positive",
    [ev("yongshin", `용신: ${yongshin}`)],
  ));
  return facts;
}

/** "강점" 섹션 목표(대표 지시): 실제 잘 쓰이는 능력. R06/R09/R10(창의·독립사업·학습형)처럼
 * 이미 능력을 직접 서술하는 규칙이 하나라도 뜨면 그것을 그대로 쓰고, 없으면 격국이 "길"할
 * 때만(이것도 "구조가 유리하게 작용한다"는 실체가 있는 판단이라 남긴다) 그 설명을 쓴다.
 * 용신·희신은 "이 사람에게 필요한 오행"일 뿐 "잘하는 능력"이 아니므로(대표 지시), 그
 * 자체를 강점 fact로 만들지 않는다 — 실제 능력을 서술하는 fact가 전혀 없으면 빈 배열을
 * 반환해 섹션을 짧게 두거나 숨긴다(generic filler로 채우지 않음). */
function buildStrengthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "strengths");
  if (mapped.length > 0) return mapped;

  const gukguk = pipeline.interpretation.gukguk;
  if (gukguk && gukguk.tone === "길") {
    return [fact("gukguk-strength", gukgukPlainText(gukguk), "positive", [
      ev("gukguk", `격국: ${gukguk.name}(길) — ${gukguk.description}`),
    ])];
  }
  return [];
}

/** [합충형파해원진 → 현실 패턴 presentation mapping — 대표 지시] RELATION_MEANING(이미
 * 확립된 개념 사전, branchRelations.ts)의 뜻을 "~하는 편입니다/~수 있습니다" 문장으로만
 * 바꿔 쓴 것이다 — 그 타입이 뒷받침하지 않는 사건·심리(예: 사고, 수술, 이별)는 새로 추론해
 * 넣지 않는다. RELATION_MEANING에 없는 타입이 추가돼도 안전하도록 폴백을 둔다.
 *
 * isCaution은 새로 만든 분류가 아니라, 바로 위 text를 쓸 때 RELATION_MEANING의 뜻 자체가
 * 조화/긍정(천간합·지지육합·지지삼합·지지방합·합 — "융화", "밀착", "강화")인지 충돌/긴장
 * (형·파·해·원진·공망·천간충·지지충·충 — "갈등", "손상", "방해", "반목", "충돌")인지를 그
 * 자리에서 같이 표시해 둔 것이다(대표 지시: 타입 이름을 별도로 하드코딩해서 나누지 말고,
 * 이미 쓴 RELATION_MEANING 해석에 근거해 나눈다). "주의할 점"에는 isCaution만 쓴다 — 긍정
 * 계열은 evidence에는 남지만 "주의"로는 쓰지 않는다. */
const RELATION_TYPE_PATTERN: Partial<Record<RelationType, { text: string; isCaution: boolean }>> = {
  형: { text: "감정이 격해지면 관계에서 긴장이나 갈등으로 표출되기 쉬운 편입니다", isCaution: true },
  충: { text: "생활 패턴이나 환경이 바뀔 때 충돌이 생기기 쉬운 편입니다", isCaution: true },
  파: { text: "관계나 상황이 예상과 다르게 흐트러지는 경우가 있을 수 있습니다", isCaution: true },
  해: { text: "일이 진행될 때 방해나 지연을 겪는 경우가 있을 수 있습니다", isCaution: true },
  원진: { text: "오해나 반목이 쌓여 거리감으로 이어지는 경우가 있을 수 있습니다", isCaution: true },
  공망: { text: "몰입하던 것이 허무하게 느껴지거나 흐지부지되는 경우가 있을 수 있습니다", isCaution: true },
  천간충: { text: "생각이나 표현 방식에서 마찰이 생기기 쉬운 편입니다", isCaution: true },
  지지충: { text: "생활 패턴이나 환경이 바뀔 때 변화의 폭이 크게 나타날 수 있습니다", isCaution: true },
  합: { text: "주변과 쉽게 어우러지고 조화를 이루는 편입니다", isCaution: false },
  천간합: { text: "겉으로 드러나는 태도나 의지가 주변과 잘 맞아떨어지는 편입니다", isCaution: false },
  지지육합: { text: "일상적인 관계에서 편안하고 밀착된 유대를 만드는 편입니다", isCaution: false },
  지지삼합: { text: "여러 요인이 결합해 특정 기운이 강하게 쌓이는 구조적 흐름이 있습니다", isCaution: false },
  지지방합: { text: "환경이나 계절적 기운의 영향을 크게 받는 편입니다", isCaution: false },
};

/** "주의할 점" 섹션 목표(대표 지시): 과잉될 때 나타나는 현실 패턴. R01/R07/R11(압박형 권위·
 * 스트레스 과부하·오행 결핍)을 우선 쓰고, 합충형파해원진은 RELATION_TYPE_PATTERN 중
 * isCaution=true인 것만(긍정/조화 계열인 합 계열은 제외) 실제 행동 패턴 문장으로 옮긴다
 * (명칭은 evidence에만, 제외된 합 계열도 evidence에는 그대로 남는다 — branchRelations를
 * 전부 evidence로 넘기므로). 매핑된 규칙도 없고 주의 성격의 합충형파해원진도 없을 때만
 * 격국(흉)으로 최소 fallback한다 — 그것도 없으면 억지로 채우지 않고 빈 배열을 반환한다
 * (섹션 숨김). */
function buildCautionFacts(pipeline: SajuPipelineResult, branchRelations: BranchRelation[]): SajuFact[] {
  const facts = mappedRuleFacts(pipeline, "cautions");

  // isCaution=true인 타입만 후보로 삼는다(단순 성립 순서로 앞 2개를 자르지 않음) — 여러 개가
  // 동시에 성립해도 전부 나열하면 다시 읽기 어려워지므로, 그중 2개까지만 메인에 쓴다.
  const cautionTypes = [...new Set(branchRelations.map((r) => r.type))]
    .filter((t) => RELATION_TYPE_PATTERN[t]?.isCaution);
  if (cautionTypes.length > 0) {
    const clause = cautionTypes.slice(0, 2).map((t) => RELATION_TYPE_PATTERN[t]!.text).join(". 또한 ");
    facts.push(fact(
      "interaction",
      clause,
      "neutral",
      branchRelations.map((r) => ev("interaction", `${r.type}: ${r.description}`)),
    ));
  }

  if (facts.length === 0) {
    const gukguk = pipeline.interpretation.gukguk;
    if (gukguk && gukguk.tone === "흉") {
      facts.push(fact("gukguk-caution", gukgukPlainText(gukguk), "risk", [
        ev("gukguk", `격국: ${gukguk.name}(흉) — ${gukguk.description}`),
      ]));
    }
  }
  return facts;
}

/** "일·재물" 섹션 목표(대표 지시): 일하는 방식·성과·수익·관리. R02(계획형 재물 구조)가 뜨면
 * 그걸 그대로 쓰고, 안 뜨면 십성 5개 그룹 분포를 개념 라벨로만 옮긴 guaranteed fallback을
 * 쓴다(원자료·그룹명 나열 금지). 그룹별 문장은 "이 성향이 일하는 방식에서 어떻게 나타나는가"
 * 만 서술하고 새 판단을 더하지 않는다. */
function buildWorkWealthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "workWealth");
  if (mapped.length > 0) return mapped;

  return [tenGodDistributionFact("tenGod-wealth", pipeline.base.tenGodGroups, {
    single: {
      비겁: "독립적인 추진력이 두드러져, 스스로 판단해 밀고 나가는 방식으로 성과를 만들어가는 편입니다.",
      식상: "표현력과 창의력이 두드러져, 아이디어를 행동으로 옮기며 성과를 만들어가는 편입니다.",
      재성: "현실적인 감각이 두드러져, 안정적으로 자산을 지키고 관리하는 방식으로 성과를 만들어가는 편입니다.",
      관성: "책임감과 원칙이 두드러져, 신뢰와 안정감을 바탕으로 성과를 만들어가는 편입니다.",
      인성: "학습과 통찰이 두드러져, 준비와 숙고를 바탕으로 성과를 만들어가는 편입니다.",
    },
    combined: (joined) => `${joined} 성향이 함께 두드러져, 이를 함께 활용해 성과를 만들어가는 방식입니다.`,
    balanced: "여러 성향이 고르게 나타나, 한쪽으로 치우치지 않고 균형 있게 성과를 만들어가는 방식입니다.",
  })];
}

/** "연애·관계" 섹션 목표(대표 지시): 끌림·표현·갈등·관계 운영. 지금은 이 주제를 직접 다루는
 * 규칙이 없어(향후 궁합 규칙 추가 대비 자리는 남겨둠) 십성 5개 그룹 분포를 개념 라벨로만
 * 옮긴 guaranteed fallback을 쓴다. */
function buildRomanceRelationshipFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "romanceRelationship");
  if (mapped.length > 0) return mapped;

  return [tenGodDistributionFact("tenGod-relationship", pipeline.base.tenGodGroups, {
    single: {
      비겁: "관계에서도 자율성과 독립성을 우선하는 편입니다.",
      식상: "관계에서 표현하고 교류하는 것을 중요하게 여기는 편입니다.",
      재성: "관계에서 현실적인 조건과 실리를 중요하게 보는 편입니다.",
      관성: "관계에서 책임과 안정감을 우선하는 편입니다.",
      인성: "관계에서 배려와 신중함을 바탕으로 신뢰를 쌓아가는 편입니다.",
    },
    combined: (joined) => `${joined} 성향이 함께 나타나, 관계에서 이를 함께 추구하는 편입니다.`,
    balanced: "관계에서 여러 성향이 고르게 나타나, 상황에 따라 균형 있게 관계를 운영하는 편입니다.",
  })];
}

export function buildSajuSummarySections(
  pipeline: SajuPipelineResult,
  branchRelations: BranchRelation[],
  shinsalEntries: ShinsalInterpretationEntry[],
): SajuSummarySection[] {
  const shinsalFacts: SajuFact[] = shinsalEntries.map((s) =>
    fact(`shinsal-${s.id}`, s.oneLine, "neutral", [ev("shinsal", s.name)]),
  );

  // 핵심 성향: R03/R04(조후)·R05(경쟁형)·R08(균형형)을 우선 쓰고, 하나도 안 뜨면(조용민처럼
  // 흔히 있는 경우) atAGlance의 강약 설명 한 줄만 최소 fallback으로 재사용한다 — 그것마저
  // 없으면 억지로 채우지 않고 빈 배열로 둔다(섹션 숨김). 신살은 어떤 경우에도 본문에 쓰지
  // 않고 evidenceOnlyFacts로만 보존한다(대표 지시 — 신살은 main fallback으로 절대 미사용).
  const coreNatureMapped = mappedRuleFacts(pipeline, "coreNature");
  const coreNatureFacts = coreNatureMapped.length > 0
    ? coreNatureMapped
    : buildAtAGlanceFacts(pipeline).filter((f) => f.domain === "strength");

  const atAGlance = synthesizeSajuSection(buildAtAGlanceFacts(pipeline));
  const coreNature = synthesizeSajuSection(coreNatureFacts, shinsalFacts);
  const strengths = synthesizeSajuSection(buildStrengthFacts(pipeline));
  const cautions = synthesizeSajuSection(buildCautionFacts(pipeline, branchRelations));
  const workWealth = synthesizeSajuSection(buildWorkWealthFacts(pipeline));
  const romanceRelationship = synthesizeSajuSection(buildRomanceRelationshipFacts(pipeline));

  const sections: [SajuSectionKey, string, { text: string; facts: SajuFact[]; evidence: SajuEvidenceItem[] }][] = [
    ["atAGlance", "한눈에 보는 나", atAGlance],
    ["coreNature", "핵심 성향", coreNature],
    ["strengths", "강점", strengths],
    ["cautions", "주의할 점", cautions],
    ["workWealth", "일·재물", workWealth],
    ["romanceRelationship", "연애·관계", romanceRelationship],
  ];

  return sections.map(([key, title, { text, facts, evidence }]) => ({ key, title, text, facts, evidence }));
}
