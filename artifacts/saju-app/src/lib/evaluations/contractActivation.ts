/**
 * 📝 계약운(계약 체결·수익성) — 대운·세운 기반 timing layer.
 *
 * 계약이라는 사건을 식상(제안·결과물·협상) / 재성(거래·대가·매출) / 관성(공식성·책임·구속력) /
 * 인성(계약서·문서·검토·승인) 네 축으로 나눠서 본다. 특히 인성을 반드시 포함시키는 이유는,
 * 식상생재(협상이 돈으로 연결)와 재생관(그 돈이 공식적 책임으로 굳어짐)만으로는 "계약서·문서·
 * 검토·승인" 단계가 빠진 채 그냥 돈과 책임이 움직이는 시기를 계약 체결로 오인할 수 있기
 * 때문이다 — 인성 evidence가 없으면 interpretation에서 체결을 단정하지 않고 별도 확인이
 * 필요하다고 명시한다.
 *
 * ── 계약 체결운 vs 계약 수익성 분리 ────────────────────────────────────────
 * "체결 가능성"(활성도+방향)과 "그 계약의 조건·수익성"(재성 축의 방향만)은 다른 질문이다.
 * 체결운이 좋아도 재성 방향이 불리하면 "체결 가능성은 있으나 조건·수익성 검토 필요"처럼
 * 두 축을 함께 보여준다. 활성도가 높다는 이유만으로 "계약 성사"라고 단정하지 않는다.
 *
 * ── 합·충형파해는 보조 evidence일 뿐 단독 판정 근거가 아님 ─────────────────
 * 대운·세운이 서로 천간합/지지합을 이루면 그 시기 흐름이 안정적으로 결합한다는 보조
 * evidence(합=성사 보조)로, 충·형·파·해는 변경·지연·분쟁 위험 evidence로 각각 작은 비중만
 * 반영한다 — 이 자체가 category cap과 diminishing 합산에 걸려 있어 합이 있다고 해서 다른
 * 근거 없이 activation·direction이 크게 움직이지 않는다.
 */

import {
  type FiveElKey,
  STEM_TO_ELEMENT,
} from "../element-color";
import { computeBranchRelations, computeStemRelations } from "../branchRelations";
import {
  type TenGodEvidenceFactor,
  parsePillar,
  charElement,
  pushTenGodGroupEvidence,
  diminishingAxisTotal,
  tenGodGroupElement,
} from "./tenGodTimingEvidence";

export type ContractLevel = "강함" | "보통" | "약함";
export type ContractDirectionLevel = "우호 우세" | "중립" | "부담 우세";
export type ContractProfitLevel = "유리" | "보통" | "불리";

export interface ContractEvidenceFactor {
  label: string;
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
}

export interface ContractActivationResult {
  /** 계약 체결운 — 계약 관련 사건(제안·거래·공식화·문서화)이 얼마나 크게 움직이는가 */
  activationScore: number;
  activationLevel: ContractLevel;
  /** 체결 방향 — 우호(성사·안정 쪽)인지 부담(경쟁·지연·분쟁 쪽)인지. "체결 확정"을 뜻하지 않음 */
  directionScore: number;
  directionLevel: ContractDirectionLevel;
  /** 계약 수익성 — 재성(거래·대가) 축의 방향만 별도로 본 값. 체결운과 반드시 같은 방향은 아님 */
  profitabilityScore: number;
  profitabilityLevel: ContractProfitLevel;
  /** 인성(문서·검토·승인) evidence가 이 시기에 확인됐는지 — false면 체결 단정을 피해야 함 */
  hasDocumentationEvidence: boolean;
  factors: ContractEvidenceFactor[];
  interpretation: string;
}

export interface ContractActivationContext {
  dayStem: string;
  daewoonHangul?: string;
  saeunHangul?: string;
  /** 선택된 월운 간지(한글 2글자). 대운·세운의 절반 가중(WOLUN_SCALE)으로 반영 — 월별 조견표 계산용 */
  wolunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
}

type ContractGroup = "식상" | "재성" | "관성" | "인성" | "bond" | "risk";
const CATEGORY_CAP = 30;

// 월운은 대운(10년)·세운(1년)보다 영향 지속 기간이 훨씬 짧아, 같은 가중치를 그대로 쓰면
// 과대평가된다 — spouseActivation.ts·luckTimingActivation.ts와 같은 비율로 깎아서 반영한다.
const WOLUN_SCALE = 0.5;

function activationLevelFromScore(s: number): ContractLevel {
  if (s >= 50) return "강함";
  if (s >= 35) return "보통";
  return "약함";
}

function directionLevelFromScore(s: number): ContractDirectionLevel {
  if (s >= 62) return "우호 우세";
  if (s <= 38) return "부담 우세";
  return "중립";
}

function profitLevelFromScore(s: number): ContractProfitLevel {
  if (s >= 62) return "유리";
  if (s <= 38) return "불리";
  return "보통";
}

export function computeContractActivation(ctx: ContractActivationContext): ContractActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  if (!dmEl) {
    return {
      activationScore: 0, activationLevel: "약함",
      directionScore: 50, directionLevel: "중립",
      profitabilityScore: 50, profitabilityLevel: "보통",
      hasDocumentationEvidence: false,
      factors: [],
      interpretation: "일간 정보가 없어 계약운을 계산할 수 없습니다.",
    };
  }

  const sikEl = tenGodGroupElement(dmEl, "식상");
  const jaeEl = tenGodGroupElement(dmEl, "재성");
  const gwanEl = tenGodGroupElement(dmEl, "관성");
  const seongEl = tenGodGroupElement(dmEl, "인성");

  const factors: TenGodEvidenceFactor<ContractGroup>[] = [];

  const { stem: dwStem, branch: dwBranch } = parsePillar(ctx.daewoonHangul);
  const { stem: seStem, branch: seBranch } = parsePillar(ctx.saeunHangul);
  const { stem: woStem, branch: woBranch } = parsePillar(ctx.wolunHangul);
  const points: Array<{ label: "대운" | "세운" | "월운"; stem?: string; branch?: string; scale: number }> = [
    { label: "대운", stem: dwStem, branch: dwBranch, scale: 1 },
    { label: "세운", stem: seStem, branch: seBranch, scale: 1 },
    { label: "월운", stem: woStem, branch: woBranch, scale: WOLUN_SCALE },
  ];

  // ① 식상·재성·관성·인성 네 축 각각의 등장/생조/극제/용희신·기신 evidence
  for (const [group, groupEl, label] of [
    ["식상", sikEl, "식상(제안·결과물·협상)"],
    ["재성", jaeEl, "재성(거래·대가·매출)"],
    ["관성", gwanEl, "관성(공식성·책임·구속력)"],
    ["인성", seongEl, "인성(계약서·문서·검토·승인)"],
  ] as const) {
    for (const p of points) {
      for (const [kind, ch] of [["천간", p.stem], ["지지", p.branch]] as const) {
        const el = charElement(kind, ch);
        if (!el || !ch) continue;
        const tag = `${p.label} ${kind} ${ch}(${el}) → ${label}`;
        pushTenGodGroupEvidence(factors, tag, group, el, groupEl, ctx.yongshin, ctx.heesin, ctx.gisin, p.scale);
      }
    }
  }

  // ② 대운·세운 상호 합(보조 evidence, 성사 쪽) / 충형파해원진(위험 evidence, 변경·지연·분쟁)
  if (dwStem && seStem && dwStem !== seStem) {
    const rels = computeStemRelations([dwStem, seStem]);
    for (const r of rels) {
      if (r.type === "천간합") {
        factors.push({ label: `대운·세운 천간합(${dwStem}·${seStem}) — 이 시기 흐름이 결속(성사 보조 evidence)`, magnitude: 6, direction: "우호", category: "bond" });
      } else if (r.type === "천간충") {
        factors.push({ label: `대운·세운 천간충(${dwStem}·${seStem}) — 변경·번복 위험`, magnitude: 7, direction: "비우호", category: "risk" });
      }
    }
  }
  if (dwBranch && seBranch) {
    const rels = computeBranchRelations([dwBranch, seBranch]);
    for (const r of rels) {
      const tag = `대운·세운 지지(${dwBranch}·${seBranch})`;
      switch (r.type) {
        case "지지육합":
        case "지지삼합":
        case "지지방합":
          factors.push({ label: `${tag} ${r.type} — 이 시기 흐름이 결속(성사 보조 evidence)`, magnitude: 6, direction: "우호", category: "bond" });
          break;
        case "지지충":
          factors.push({ label: `${tag} 충 — 변경·번복 위험`, magnitude: 8, direction: "비우호", category: "risk" });
          break;
        case "형":
          factors.push({ label: `${tag} 형 — 분쟁·마찰 위험`, magnitude: 6, direction: "비우호", category: "risk" });
          break;
        case "파":
          factors.push({ label: `${tag} 파 — 지연·이행 흔들림 위험`, magnitude: 4, direction: "비우호", category: "risk" });
          break;
        case "해":
          factors.push({ label: `${tag} 해 — 지연·이견 위험`, magnitude: 4, direction: "비우호", category: "risk" });
          break;
        case "원진":
          factors.push({ label: `${tag} 원진 — 신뢰·이견 위험`, magnitude: 4, direction: "비우호", category: "risk" });
          break;
        default:
          break;
      }
    }
  }

  const hasDocumentationEvidence = factors.some((f) => f.category === "인성");

  const activationRaw = diminishingAxisTotal(factors, false, CATEGORY_CAP, [1, 0.5, 0.25, 0.15, 0.1, 0.05]);
  const activationScore = Math.max(0, Math.min(100, Math.round(15 + activationRaw)));
  const activationLevel = activationLevelFromScore(activationScore);

  const directionRaw = diminishingAxisTotal(factors, true, CATEGORY_CAP, [1, 0.5, 0.25, 0.15, 0.1, 0.05]);
  const directionScore = Math.max(0, Math.min(100, Math.round(50 + directionRaw)));
  const directionLevel = directionLevelFromScore(directionScore);

  // 계약 수익성 — 재성 축의 방향만 별도로 본다(체결운과 독립적인 축)
  const profitFactors = factors.filter((f) => f.category === "재성");
  const profitRaw = diminishingAxisTotal(profitFactors, true, CATEGORY_CAP, [1]);
  const profitabilityScore = Math.max(0, Math.min(100, Math.round(50 + profitRaw)));
  const profitabilityLevel = profitLevelFromScore(profitabilityScore);

  const interpretation = buildContractInterpretation(
    activationLevel, directionLevel, profitabilityLevel, hasDocumentationEvidence,
  );

  return {
    activationScore, activationLevel, directionScore, directionLevel,
    profitabilityScore, profitabilityLevel, hasDocumentationEvidence,
    factors: factors.map(({ label, magnitude, direction }) => ({ label, magnitude, direction })),
    interpretation,
  };
}

function buildContractInterpretation(
  activation: ContractLevel,
  direction: ContractDirectionLevel,
  profit: ContractProfitLevel,
  hasDocEvidence: boolean,
): string {
  const docCaveat = hasDocEvidence
    ? ""
    : " (문서·검토·승인(인성) 근거가 이 시기에 뚜렷하지 않아, 실제 계약서 확정 여부는 별도 확인이 필요합니다.)";

  if (activation === "약함") {
    return `계약·거래 관련 이슈가 크게 부각되지 않는 평이한 시기입니다.${docCaveat}`;
  }
  if (direction === "우호 우세" && profit === "유리") {
    return `계약 체결과 관련된 움직임이 활발하고 방향도 우호적이며, 조건·수익성 방향도 나쁘지 않습니다. 다만 활성도·방향은 사건이 얼마나 부각되는지를 뜻할 뿐 체결 자체를 확정하지 않습니다.${docCaveat}`;
  }
  if (direction === "우호 우세" && profit === "불리") {
    return `체결 가능성은 있으나 조건·수익성 검토가 필요합니다 — 계약 관련 흐름 자체는 우호적이지만, 재성(거래·대가) 방향은 약한 편입니다.${docCaveat}`;
  }
  if (direction === "부담 우세" && profit === "유리") {
    return `조건·수익성 방향은 나쁘지 않지만, 체결 과정 자체는 경쟁·지연·이견 등으로 순탄치 않을 수 있는 시기입니다.${docCaveat}`;
  }
  if (direction === "부담 우세" && profit === "불리") {
    return `체결 과정과 조건·수익성 모두 신중한 검토가 필요한 시기입니다. 서두르기보다 조건을 꼼꼼히 확인하는 편이 안전합니다.${docCaveat}`;
  }
  if (activation === "강함") {
    return `계약·거래 관련 움직임이 강하지만 우호·부담 요인이 혼재해 방향이 뚜렷하지 않습니다. 아래 근거를 함께 참고하세요.${docCaveat}`;
  }
  return `계약 관련 흐름은 무난한 수준입니다. 활성도·방향·수익성을 함께 참고하세요.${docCaveat}`;
}
