import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SajuReport } from "@/components/SajuReport";
import { getPeople, getFinalPillars, type PersonRecord } from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { ArrowLeft, Heart } from "lucide-react";
import { charToElement, elementBgClass, type FiveElKey } from "@/lib/element-color";
import { MaritalBadge, type MaritalBadgeStatus } from "@/components/MaritalField";
import { cn } from "@/lib/utils";

function partnerBadgeStatus(person: PersonRecord): MaritalBadgeStatus | undefined {
  if (person.maritalStatus) return person.maritalStatus;
  const r = person.relationshipStatus;
  if (r) {
    if (r === "single") return "솔로";
    if (r === "dating") return "연애중";
    if (r === "married") return "기혼";
    return "기타";
  }
  // 생년 입력 폼에만 있던 구형 필드 (로컬/구 데이터)
  const legacy = person.birthInput.relationshipStatus;
  if (legacy === "기혼") return "기혼";
  if (legacy === "연애중") return "연애중";
  if (legacy === "미혼") return "솔로";
  return undefined;
}

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const person = getPeople().find((p) => p.id === id);

  if (!person) {
    return (
      <div className="ds-app-shell ds-page-pad py-8 text-center">
        <p className="ds-subtitle mb-4 block">사람을 찾을 수 없습니다</p>
        <Link href="/people">
          <Button variant="outline" className="shadow-none">목록으로</Button>
        </Link>
      </div>
    );
  }

  const input = person.birthInput;
  const pillars = getFinalPillars(person);
  const dayHangul = pillars.day?.hangul ?? "";
  const dayStem = dayHangul[0] ?? "";
  const dayBranch = dayHangul[1] ?? "";
  const zodiac = getZodiacFromDayPillar(dayHangul);
  const dayEl = (dayStem ? charToElement(dayStem) : null) as FiveElKey | null;
  const thumbBgClass = dayEl ? elementBgClass(dayEl, "muted") : "bg-muted";
  const badgeStatus = partnerBadgeStatus(person);

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">

      {/* ── Unified Identity Card (same structure as MyProfile) ── */}
      <div className="ds-card ds-card-pad relative shadow-none">
        <div className="flex items-start gap-4">
          {/* Zodiac mascot — element-based pastel background (same as PeopleList card) */}
          <div className={`shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden ${thumbBgClass}`}>
            {zodiac ? (
              <img src={zodiac.src} alt={zodiac.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{input.name.charAt(0)}</span>
            )}
          </div>

          {/* Primary info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{input.name}</h1>
              <span
                className={cn(
                  "text-sm font-bold",
                  input.gender === "여" ? "text-chart-3" : "text-chart-5",
                )}
              >
                {input.gender === "여" ? "♀" : "♂"}
              </span>
            </div>
            {dayStem && (
              <p className="text-sm text-muted-foreground mt-0.5">
                일주 <span className="font-semibold text-foreground">{dayStem}{dayBranch}</span>
              </p>
            )}
            <div className="mt-1">
              <MaritalBadge status={badgeStatus} />
            </div>
          </div>
        </div>

        {/* Secondary info row */}
        <div className="mt-4 grid grid-cols-1 gap-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground/70">생년월일</span>{" "}
            {input.year}년 {input.month}월 {input.day}일
            <span className="ml-1">({input.calendarType === "solar" ? "양력" : "음력"})</span>
          </span>
          {!input.timeUnknown ? (
            <span>
              <span className="font-medium text-foreground/70">출생시</span>{" "}
              {String(input.hour ?? 0).padStart(2, "0")}:{String(input.minute ?? 0).padStart(2, "0")}
            </span>
          ) : (
            <span><span className="font-medium text-foreground/70">출생시</span> 미상</span>
          )}
          {person.profile.lunarDate && input.calendarType === "solar" && (
            <span>
              <span className="font-medium text-foreground/70">음력</span>{" "}
              {person.profile.lunarDate.year}년 {person.profile.lunarDate.month}월 {person.profile.lunarDate.day}일
              {person.profile.lunarDate.isLeapMonth ? " (윤달)" : ""}
            </span>
          )}
          {input.birthplace && (
            <span>
              <span className="font-medium text-foreground/70">출생지</span> {input.birthplace}
            </span>
          )}
        </div>
      </div>

      <SajuReport record={person} />

      {/* Bottom actions */}
      <div className="flex gap-3 pt-2">
        <Link href="/people" className="flex-1">
          <Button variant="outline" className="w-full gap-2 shadow-none">
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <Link href={`/compatibility/${person.id}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2 shadow-none">
            <Heart className="h-4 w-4" />
            궁합 보기
          </Button>
        </Link>
      </div>
    </div>
  );
}
