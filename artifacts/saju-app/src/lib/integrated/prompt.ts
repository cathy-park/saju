// 앱 내부 OpenAI 해석 호출은 전부 제거됐다 — 이 파일은 "AI 해석용 원자료/프롬프트 복사"
// 도구만 남는다. buildIntegratedCopyPrompt/buildIntegratedRelationshipCopyPrompt는 세 체계의
// 계산 원자료를 그대로 이어붙여 사용자가 직접 ChatGPT 등에 복사해 쓰는 텍스트를 만들 뿐,
// fetch를 전혀 포함하지 않는다.
export interface IntegratedRawPromptParts { saju: string; ziwei: string; western: string }
export function buildIntegratedCopyPrompt(parts: IntegratedRawPromptParts): string {
  return ["아래는 한 사람에 대해 계산된 사주, 자미두수, 서양점성술의 원자료입니다.", "", "각 체계를 따로 요약하는 데서 끝내지 말고, 세 체계가 공통으로 말하는 성향, 서로 보완되는 부분, 서로 다르게 보이는 부분을 함께 검토해서 이 사람을 하나의 사람으로 이해할 수 있도록 종합적으로 해석해주세요.", "", "성격, 감정 처리, 관계, 연애·배우자, 일·커리어, 재물, 강점과 약점, 현재 시기의 흐름을 연결해서 설명해주세요.", "", "제공된 계산 결과 밖의 별·궁·aspect·십성·사화 등을 임의로 만들어내지 마세요.", "", "# 1. 사주", parts.saju, "", "# 2. 자미두수", parts.ziwei, "", "# 3. 서양점성술", parts.western].join("\n");
}
export function buildIntegratedRelationshipCopyPrompt(parts: IntegratedRawPromptParts): string {
  return ["아래는 두 사람에 대해 계산된 사주, 자미두수, 서양점성술 관계 원자료입니다.", "", "각 체계를 따로 나열하는 데서 끝내지 말고 관계의 핵심, 감정·애착, 대화·갈등, 끌림·친밀감, 결혼·장기 지속성, 현실·생활 궁합을 연결해 상담해주세요.", "", "제공된 계산 결과 밖의 별·궁·aspect·십성·사화나 사건을 만들지 마세요.", "", "# 1. 두 사람 사주와 사주 궁합", parts.saju, "", "# 2. 두 사람 자미두수 관계 구조", parts.ziwei, "", "# 3. 두 사람 Western natal과 synastry", parts.western].join("\n");
}
