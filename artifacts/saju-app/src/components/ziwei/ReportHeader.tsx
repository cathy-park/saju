import { findZiweiTopic } from "@/lib/ziwei/topics";
import { TopicTabs } from "./TopicTabs";
import { SystemSelector } from "@/components/SystemSelector";
import { getMyProfile } from "@/lib/storage";

/** 7개 리포트 페이지가 공유하는 상단 요약 구조 — 시스템 탭, 뒤로가기, 주제 가로탭, 제목, 1줄 설명,
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
  const myProfile = getMyProfile();
  const sajuHref = myProfile && myProfile.id === personId ? "/saju" : `/people/${personId}`;
  return (
    <>
      {/* 페이지 전체(ds-app-shell)를 기준으로 스크롤 내내 고정되도록, 아래 ds-stack-2와
       * 형제 요소로 둔다 — ds-stack-2 안에 넣으면 그 짧은 블록이 다 지나가는 순간
       * sticky 요소도 같이 화면 밖으로 밀려난다. */}
      <div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <SystemSelector personId={personId} sajuHref={sajuHref} />
      </div>
      <div className="ds-stack-2">
        <TopicTabs personId={personId} activeKey={activeKey} />
        <h1 className="ds-title-lg">{personName}님의 {topic.label} 리포트</h1>
        <p className="ds-subtitle -mt-1">{topic.description}</p>
        {disclaimer && (
          <div className="ds-card ds-card-pad shadow-none text-xs text-muted-foreground leading-relaxed">{disclaimer}</div>
        )}
      </div>
    </>
  );
}
