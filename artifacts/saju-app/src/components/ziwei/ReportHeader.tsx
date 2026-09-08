import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { findZiweiTopic } from "@/lib/ziwei/topics";
import { TopicTabs } from "./TopicTabs";

/** 7개 리포트 페이지가 공유하는 상단 요약 구조 — 뒤로가기, 주제 가로탭, 제목, 1줄 설명,
 * (있으면) 안내 배너 순서를 항상 동일하게 유지한다. */
export function ReportHeader({
  personId, personName, activeKey, disclaimer,
}: {
  personId: string;
  personName: string;
  activeKey: string;
  disclaimer?: string;
}) {
  const topic = findZiweiTopic(activeKey);
  return (
    <div className="ds-stack-2">
      <Link href={`/ziwei/${personId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 주제 선택으로
      </Link>
      <TopicTabs personId={personId} activeKey={activeKey} />
      <h1 className="ds-title-lg">{personName}님의 {topic.label} 리포트</h1>
      <p className="ds-subtitle -mt-1">{topic.description}</p>
      {disclaimer && (
        <div className="ds-card ds-card-pad shadow-none text-xs text-muted-foreground leading-relaxed">{disclaimer}</div>
      )}
    </div>
  );
}
