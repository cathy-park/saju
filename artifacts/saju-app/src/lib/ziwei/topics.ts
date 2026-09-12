// 자미두수 7개 주제의 공용 메타데이터 — 주제 선택 화면, 각 리포트 헤더, 가로 스크롤 탭이 모두
// 이 한 곳만 참조한다(라벨·설명·아이콘을 페이지마다 따로 정의하지 않기 위함). 라우팅 key는
// App.tsx의 실제 경로(/ziwei/:personId/:key)와 정확히 일치해야 한다.
import type { LucideIcon } from "lucide-react";
import { Layers, Compass, Coins, Briefcase, Heart, Users, CalendarClock } from "lucide-react";

export type ZiweiTopicGroup = "overview" | "nature" | "workWealth" | "relationship";

export interface ZiweiTopicMeta {
  key: string;
  label: string;
  /** 주제 카드·리포트 상단·탭에서 공통으로 쓰는 1줄 설명. */
  description: string;
  icon: LucideIcon;
  group: ZiweiTopicGroup;
}

export const ZIWEI_GROUP_LABEL: Record<ZiweiTopicGroup, string> = {
  overview: "",
  nature: "핵심 성향",
  workWealth: "일·재물",
  relationship: "연애·배우자",
};

/** 종합을 가장 먼저 두고, 이후 핵심 성향 → 일·재물 → 연애·배우자 순으로 그룹핑한다. */
export const ZIWEI_TOPICS: ZiweiTopicMeta[] = [
  { key: "overview", label: "종합", description: "일곱 리포트를 하나의 흐름으로 정리합니다", icon: Layers, group: "overview" },
  { key: "nature", label: "타고난 성향", description: "타고난 기질과 시간에 따라 힘이 실리는 방향", icon: Compass, group: "nature" },
  { key: "wealth", label: "재물", description: "돈을 버는 방식과 소비·축적 습관", icon: Coins, group: "workWealth" },
  { key: "career", label: "커리어", description: "일하는 방식과 성취가 따르는 분야", icon: Briefcase, group: "workWealth" },
  { key: "romance", label: "연애", description: "끌림·표현·갈등·관계 운영 방식", icon: Heart, group: "relationship" },
  { key: "spouse", label: "배우자상·관계 패턴", description: "끌리기 쉬운 파트너 특성과 반복되는 관계 방식", icon: Users, group: "relationship" },
  { key: "marriageTiming", label: "결혼시기", description: "연도별 활성화·안정화·공식화·변동성 신호", icon: CalendarClock, group: "relationship" },
];

export function findZiweiTopic(key: string): ZiweiTopicMeta {
  const topic = ZIWEI_TOPICS.find((t) => t.key === key);
  if (!topic) throw new Error(`알 수 없는 자미두수 주제 key: ${key}`);
  return topic;
}
