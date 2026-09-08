import { Link } from "wouter";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";
import { GenderSymbol } from "@/components/GenderSymbol";
import { ChevronRight, Sparkles } from "lucide-react";

function PersonRow({ id, person, subtitle }: { id: string; person: PersonRecord; subtitle: string }) {
  return (
    <Link href={`/ziwei/${id}`}>
      <div className="ds-card ds-card-pad flex items-center gap-3 shadow-none active-elevate cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{person.birthInput.name}</span>
            <GenderSymbol gender={person.birthInput.gender} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}

export default function ZiweiHome() {
  const myProfile = getMyProfile();
  const people = getPeople();

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="ds-title-lg">자미두수</h1>
      </div>
      <p className="ds-subtitle -mt-2">누구의 자미두수를 볼까요?</p>

      <div className="space-y-2">
        {myProfile && <PersonRow id={myProfile.id} person={myProfile} subtitle="나" />}
        {people.map((p) => (
          <PersonRow key={p.id} id={p.id} person={p} subtitle="상대" />
        ))}
      </div>

      {!myProfile && people.length === 0 && (
        <div className="ds-card ds-card-pad text-center text-sm text-muted-foreground shadow-none">
          먼저 내 사주 또는 상대 정보를 등록해주세요.
        </div>
      )}
    </div>
  );
}
