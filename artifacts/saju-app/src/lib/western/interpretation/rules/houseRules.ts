export const HOUSE_RULES: Record<number, { theme: string; arena: string }> = {
  1: { theme: "self", arena: "첫 반응과 자기표현" },
  2: { theme: "resources", arena: "소유·가치 판단" },
  3: { theme: "learning", arena: "학습과 일상 소통" },
  4: { theme: "foundation", arena: "사적인 기반과 정서적 뿌리" },
  5: { theme: "creation", arena: "창작·취향·즐거움" },
  6: { theme: "craft", arena: "일상 운영과 실무 개선" },
  7: { theme: "partnership", arena: "일대일 관계와 협력" },
  8: { theme: "depth", arena: "공동 자원과 깊은 변화" },
  9: { theme: "worldview", arena: "배움·신념·경험 확장" },
  10: { theme: "publicRole", arena: "사회적 역할과 성취" },
  11: { theme: "community", arena: "집단·친구·장기 목표" },
  12: { theme: "innerWorld", arena: "혼자 정리하는 내면과 회복" },
};

export const HOUSE_THEME_EMPHASIS: Record<string, string> = {
  foundation: "삶의 기반을 안정적으로 세우고 안쪽 질서를 관리하는 문제가 반복해서 중요해집니다.",
  creation: "자기 생각과 취향을 고유한 결과물로 표현하는 문제가 반복해서 중요해집니다.",
  worldview: "배움과 경험을 통해 판단 기준을 넓히는 문제가 반복해서 중요해집니다.",
};
