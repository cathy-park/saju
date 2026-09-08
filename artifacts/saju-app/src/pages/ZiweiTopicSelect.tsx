import { Link, useParams } from "wouter";
import { ArrowLeft, ChevronRight, Heart } from "lucide-react";
import { getMyProfile, getPeople } from "@/lib/storage";

const TOPICS: { key: string; label: string; ready: boolean; icon?: typeof Heart }[] = [
  { key: "spouse",        label: "배우자",       ready: true,  icon: Heart },
  { key: "overview",      label: "종합",         ready: false },
  { key: "nature",        label: "타고난 성향",   ready: false },
  { key: "wealth",        label: "재물",         ready: true  },
  { key: "career",        label: "커리어",       ready: true  },
  { key: "romance",       label: "연애",         ready: false },
  { key: "marriageTiming",label: "결혼시기",     ready: false },
];

function findPerson(personId: string) {
  const my = getMyProfile();
  if (my && my.id === personId) return my;
  return getPeople().find((p) => p.id === personId) ?? null;
}

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

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
      <Link href="/ziwei" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </Link>
      <h1 className="ds-title-lg">{person.birthInput.name}님의 자미두수</h1>
      <p className="ds-subtitle -mt-2">어떤 주제가 궁금하세요?</p>

      <div className="space-y-2">
        {TOPICS.map((t) => {
          const content = (
            <div
              className={`ds-card ds-card-pad flex items-center gap-3 shadow-none ${t.ready ? "cursor-pointer active-elevate" : "opacity-50"}`}
            >
              <div className="flex-1">
                <span className="font-semibold text-foreground">{t.label}</span>
                {!t.ready && <span className="ml-2 text-xs text-muted-foreground">준비중</span>}
              </div>
              {t.ready && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          );
          return t.ready ? (
            <Link key={t.key} href={`/ziwei/${personId}/${t.key}`}>{content}</Link>
          ) : (
            <div key={t.key}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
