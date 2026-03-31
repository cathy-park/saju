import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SajuReport } from "@/components/SajuReport";
import { getPeople, getFinalPillars } from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { ArrowLeft, Pencil, Heart } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { buildPersonClipboardText } from "@/lib/clipboardExport";

const STEM_EL: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};
const EL_PASTEL: Record<string, string> = {
  목: "#DFF4E4", 화: "#FFE3E3", 토: "#FFF1D6", 금: "#F2F2F2", 수: "#E3F1FF",
};

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const person = getPeople().find((p) => p.id === id);

  if (!person) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground mb-4">사람을 찾을 수 없습니다</p>
        <Link href="/people">
          <Button variant="outline">목록으로</Button>
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
  const thumbBg = dayStem ? (EL_PASTEL[STEM_EL[dayStem]] ?? "#F0F0F0") : "#F0F0F0";

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

      {/* ── Unified Identity Card (same structure as MyProfile) ── */}
      <div className="rounded-2xl border border-border bg-card p-5 relative">
        <Link href={`/people/${person.id}/edit`}>
          <button className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </Link>

        <div className="flex items-start gap-4">
          {/* Zodiac mascot — element-based pastel background (same as PeopleList card) */}
          <div
            className="shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ background: `radial-gradient(circle at 50% 60%, ${thumbBg} 0%, ${thumbBg}88 100%)` }}
          >
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
              <span className={`text-sm font-bold ${input.gender === "여" ? "text-pink-500" : "text-blue-500"}`}>
                {input.gender === "여" ? "♀" : "♂"}
              </span>
            </div>
            {dayStem && (
              <p className="text-sm text-muted-foreground mt-0.5">
                일주 <span className="font-semibold text-foreground">{dayStem}{dayBranch}</span>
              </p>
            )}
          </div>
        </div>

        {/* Secondary info row */}
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 gap-1 text-[12px] text-muted-foreground">
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

      <CopyButton buildText={() => buildPersonClipboardText(person)} label="상대 사주 분석 전체 복사" />

      <SajuReport record={person} showSaveStatus={true} />

      {/* Bottom actions */}
      <div className="flex gap-3 pt-2">
        <Link href="/people" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <Link href={`/compatibility/${person.id}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <Heart className="h-4 w-4" />
            궁합 보기
          </Button>
        </Link>
      </div>
    </div>
  );
}
