import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BirthForm } from "@/components/BirthForm";
import { SajuReport } from "@/components/SajuReport";
import { calculateProfileFromBirth, type BirthInput } from "@/lib/sajuEngine";
import {
  getMyProfile,
  saveMyProfile,
  saveMaritalStatus,
  createRecord,
  type PersonRecord,
  type MaritalStatus,
} from "@/lib/storage";
import { getFinalPillars } from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile } from "@/lib/db";
import { Pencil } from "lucide-react";
import { MaritalField, MaritalBadge, MARITAL_OPTIONS } from "@/components/MaritalField";
import { CopyButton } from "@/components/CopyButton";
import { buildPersonClipboardText } from "@/lib/clipboardExport";

export default function MyProfile() {
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<PersonRecord | null>(() => getMyProfile());
  const [formMarital, setFormMarital] = useState<MaritalStatus | undefined>(() => getMyProfile()?.maritalStatus);
  const { user, dbSynced } = useAuth();

  useEffect(() => {
    if (dbSynced) {
      const latest = getMyProfile();
      if (latest) {
        setRecord(latest);
        setFormMarital(latest.maritalStatus);
      }
    }
  }, [dbSynced]);

  async function handleSubmit(input: BirthInput) {
    try {
      const profile = calculateProfileFromBirth(input);
      const newRecord: PersonRecord = { ...createRecord(input, profile), maritalStatus: formMarital };
      saveMyProfile(newRecord);
      setRecord(newRecord);
      setEditing(false);
      if (user) {
        await upsertMyProfile(user.id, newRecord);
      }
    } catch (e: unknown) {
      alert("계산 오류: " + ((e as Error)?.message ?? "알 수 없는 오류"));
    }
  }

  if (!record || editing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">내 사주 등록</h1>
          <p className="text-muted-foreground text-sm mt-1">
            정확한 생년월일시를 입력하면 사주팔자를 계산합니다
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <BirthForm
              defaultValues={record ? { ...record.birthInput } : undefined}
              onSubmit={handleSubmit}
              submitLabel="내 사주 저장"
              renderExtra={
                <MaritalField
                  value={formMarital}
                  onChange={(v) => {
                    setFormMarital(v);
                    if (record) saveMaritalStatus(record.id, v);
                  }}
                />
              }
            />
          </CardContent>
        </Card>

        {editing && (
          <Button variant="ghost" className="w-full mt-3" onClick={() => setEditing(false)}>
            취소
          </Button>
        )}
      </div>
    );
  }

  const input = record.birthInput;
  const pillars = getFinalPillars(record);
  const dayHangul = pillars.day?.hangul ?? "";
  const dayStem   = dayHangul[0] ?? "";
  const dayBranch = dayHangul[1] ?? "";
  const zodiac    = getZodiacFromDayPillar(dayHangul);
  const STEM_EL: Record<string, string> = { 갑:"목",을:"목",병:"화",정:"화",무:"토",기:"토",경:"금",신:"금",임:"수",계:"수" };
  const EL_PASTEL: Record<string, string> = { 목:"#DFF4E4",화:"#FFE3E3",토:"#FFF1D6",금:"#F2F2F2",수:"#E3F1FF" };
  const thumbBg = dayStem ? (EL_PASTEL[STEM_EL[dayStem]] ?? "#F5F5F5") : "#F5F5F5";

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

      {/* ── Unified Identity Card ── */}
      <div className="rounded-2xl border border-border bg-card p-5 relative">
        <button
          onClick={() => setEditing(true)}
          className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: `radial-gradient(circle at 50% 60%, ${thumbBg} 0%, ${thumbBg}88 100%)` }}>
            {zodiac ? (
              <img src={zodiac.src} alt={zodiac.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{input.name.charAt(0)}</span>
            )}
          </div>

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

            <div className="mt-1"><MaritalBadge status={record.maritalStatus} /></div>
          </div>
        </div>

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
              {record.profile.isTimeCorrected && record.profile.correctedTime && (
                <span className="ml-1 text-[11px]">
                  (진태양시 {record.profile.correctedTime.hour}시{record.profile.correctedTime.minute}분)
                </span>
              )}
            </span>
          ) : (
            <span><span className="font-medium text-foreground/70">출생시</span> 미상</span>
          )}
          {record.profile.lunarDate && input.calendarType === "solar" && (
            <span>
              <span className="font-medium text-foreground/70">음력</span>{" "}
              {record.profile.lunarDate.year}년 {record.profile.lunarDate.month}월 {record.profile.lunarDate.day}일
              {record.profile.lunarDate.isLeapMonth ? " (윤달)" : ""}
            </span>
          )}
          {input.birthplace && (
            <span>
              <span className="font-medium text-foreground/70">출생지</span> {input.birthplace}
            </span>
          )}
        </div>
      </div>

      <CopyButton buildText={() => buildPersonClipboardText(record)} label="내 사주 분석 전체 복사" />

      <SajuReport record={record} />
    </div>
  );
}
