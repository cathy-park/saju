import { Link } from "wouter";
import { ZIWEI_TOPICS } from "@/lib/ziwei/topics";

/** 7개 자미두수 주제를 가로 스크롤 pill로 보여준다 — 본문 공간을 많이 차지하지 않도록 큰
 * 카드가 아니라 작은 탭 형태로만 둔다. 주제 선택 화면으로 돌아가지 않고 바로 다른 주제로
 * 넘어갈 수 있게 하는 것이 목적. */
export function TopicTabs({ personId, activeKey }: { personId: string; activeKey: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-1.5 pb-1">
        {ZIWEI_TOPICS.map((topic) => {
          const active = topic.key === activeKey;
          const Icon = topic.icon;
          return (
            <Link key={topic.key} href={`/ziwei/${personId}/${topic.key}`}>
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {topic.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
