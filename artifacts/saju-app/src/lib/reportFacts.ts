// 도메인 중립 공용 타입/유틸 — 자미두수와 사주 리포트 레이어가 함께 쓰지만, 서로의 계산
// 엔진에는 의존하지 않는다(대표 지시: 두 체계의 계산 엔진 간 결합 금지). 여기에는 "fact를
// 어떻게 표현하고 하나의 문단으로 합성하는가"라는 순수 텍스트 합성 로직만 둔다 — 어느 쪽
// 궁·오행·별자리 개념도 이 파일에 들어오지 않는다. evidence는 각 도메인이 자기 shape를
// 정의해서 제네릭으로 채운다(자미두수=EvidenceItem, 사주=자체 정의 타입).
export type Polarity = "positive" | "mixed" | "risk" | "neutral";

export interface ReportFact<TEvidence = unknown> {
  id: string;
  /** 리포트마다 자유롭게 정의하는 도메인 태그. */
  domain: string;
  /** 메인 리포트에 그대로 보이는 순수 자연어 문구 — 기술적 표기(궁명·별명·사화, 격국명 등)는
   * 절대 여기 섞지 않는다. 출처는 evidence에만 담고 근거 토글에서만 노출한다. */
  meaning: string;
  polarity: Polarity;
  strength: number;
  evidence: TEvidence[];
  /** 본궁이 空宮이라 다른 궁에서 빌려온 경우처럼, meaning 문자열에 표식을 남기지 않고 이
   * 필드로만 신뢰도를 판단하고 싶을 때 쓴다. */
  borrowed?: boolean;
}

/** 메인 리포트 문장은 순수 자연어만 이어붙인다. */
function joinMeanings(facts: ReportFact<unknown>[]): string {
  return facts.map((f) => f.meaning).join(", ");
}

/** 한글 주격 조사(이/가) 선택 — 마지막 음절에 받침이 있으면 "이", 없으면 "가". 한글 음절이
 * 아닌 문자로 끝나면(드물게 영문·기호 등) 안전하게 "이"를 기본값으로 쓴다. */
export function subjectParticle(text: string): "이" | "가" {
  const lastChar = text.trim().at(-1);
  if (!lastChar) return "이";
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "이";
  return (code - 0xac00) % 28 === 0 ? "가" : "이";
}

/** facts를 하나의 결합 문단으로 합성한다. 서로 다른 결론(polarity)이 섞여 있을 때 "다만...
 * 동시에...다만..."처럼 계속 병렬로 나열하지 않는다 — 우호적(positive+mixed) 진영과 위험(risk)
 * 진영 중 evidence가 더 많은 쪽을 주절로 삼아 하나의 해석으로 조정하고, 소수 진영은 양보절
 * 하나로만 요약한다(접속어 전환은 최대 1번).
 *
 * 계약: 이 함수는 risk 여부만 보고 나머지(positive/mixed)는 전부 "favorable"로 묶는다.
 * "neutral"(엔진이 방향을 명시하지 않은 fact)은 이 함수에 넣지 않아야 한다 — 방향성 판단에
 * 끼워 넣으면 안 되는 fact이므로, 호출부가 neutral을 걸러낸 뒤 나머지만 넘겨야 한다(사주
 * 리포트가 이 계약을 지킨다 — synthesizeSajuSection 참고). */
export function synthesizeText(facts: ReportFact<unknown>[]): string {
  if (facts.length === 0) return "";
  const favorable = facts.filter((f) => f.polarity !== "risk");
  const risk = facts.filter((f) => f.polarity === "risk");

  if (risk.length === 0) {
    const clause = joinMeanings(favorable);
    return `${clause}${subjectParticle(clause)} 함께 나타납니다.`;
  }
  if (favorable.length === 0) {
    const clause = joinMeanings(risk);
    return `${clause}${subjectParticle(clause)} 함께 나타납니다.`;
  }
  if (favorable.length >= risk.length) {
    const riskClause = joinMeanings(risk);
    return `${joinMeanings(favorable)}. 다만 ${riskClause}${subjectParticle(riskClause)} 함께 나타납니다.`;
  }
  const favorableClause = joinMeanings(favorable);
  return `${joinMeanings(risk)}. 그럼에도 ${favorableClause}${subjectParticle(favorableClause)} 함께 나타납니다.`;
}

export { joinMeanings };
