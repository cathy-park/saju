import { Link, useParams } from "wouter";
import { ChevronRight } from "lucide-react";
import { getMyProfile, getPeople } from "@/lib/storage";
import { ZIWEI_TOPICS, ZIWEI_GROUP_LABEL, type ZiweiTopicGroup } from "@/lib/ziwei/topics";
import { SystemSelector } from "@/components/SystemSelector";

function findPerson(personId: string) {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

const GROUP_ORDER: ZiweiTopicGroup[] = ["overview", "nature", "workWealth", "relationship"];

export default function ZiweiTopicSelect() {
  const { personId } = useParams<{ personId: string }>();
  const person = personId ? findPerson(personId) : null;

  if (!person) {
    return (
      <div className="ds-app-shell ds-page-pad py-8 text-center">
        <p className="ds-subtitle mb-4 block">사람을 찾을 수 없습니다</p>
        <Link href="/ziwei">
          <span className="text-sm text-primary underline">목록으로</span>
        </Link>
      </div>
    );
  }

  const myProfile = getMyProfile();
  const sajuHref = myProfile && myProfile.id === personId ? "/saju" : `/people/${personId}`;

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
      <div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <SystemSelector personId={personId!} sajuHref={sajuHref} />
      </div>
      <h1 className="ds-title-lg">{person.birthInput.name}님의 자미두수</h1>
      <p className="ds-subtitle -mt-2">어떤 주제가 궁금하세요?</p>

      {GROUP_ORDER.map((group) => {
        const topics = ZIWEI_TOPICS.filter((t) => t.group === group);
        const groupLabel = ZIWEI_GROUP_LABEL[group];
        return (
          <div key={group} className="ds-stack-2">
            {groupLabel && <p className="ds-caption font-semibold uppercase tracking-wide">{groupLabel}</p>}
            <div className="space-y-2">
              {topics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <Link key={topic.key} href={`/ziwei/${personId}/${topic.key}`}>
                    <div className="ds-card ds-card-pad flex cursor-pointer items-center gap-3 shadow-none active-elevate">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </div>
                      <div className="flex-1">
                        <span className="block font-semibold text-foreground">{topic.label}</span>
                        <span className="block text-xs text-muted-foreground">{topic.description}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
