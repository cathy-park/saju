import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BirthForm } from "@/components/BirthForm";
import { SajuReport } from "@/components/SajuReport";
import { calculateProfileFromBirth, type BirthInput } from "@/lib/sajuEngine";
import {
  getMyProfile,
  saveMyProfile,
  deleteMyProfile,
  saveMaritalStatus,
  createRecord,
  type PersonRecord,
  type MaritalStatus,
} from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { getFinalPillars } from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, deleteMyProfileFromDb } from "@/lib/db";
import { Pencil, Trash2 } from "lucide-react";
import { MaritalField, MaritalBadge } from "@/components/MaritalField";
import { charToElement, elementBgClass, type FiveElKey } from "@/lib/element-color";
import { cn } from "@/lib/utils";

export default function MyProfile() {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    let newRecord: PersonRecord;
    try {
      const profile = calculateProfileFromBirth(input);
      if (record) {
        // Editing existing profile — preserve the same ID so Supabase UPSERT
        // matches by ID and updates the row rather than inserting a duplicate.
        const now = new Date().toISOString();
        newRecord = {
          ...record,
          birthInput: input,
          profile,
          maritalStatus: formMarital,
          manualPillars:      {},
          manualFiveElements: undefined,
          updatedAt: now,
        };
      } else {
        newRecord = { ...createRecord(input, profile), maritalStatus: formMarital };
      }
    } catch (e: unknown) {
      alert("계산 오류: " + ((e as Error)?.message ?? "알 수 없는 오류"));
      return;
    }
    saveMyProfile(newRecord);
    setRecord(newRecord);
    setEditing(false);
    if (user) {
      try {
        await upsertMyProfile(user.id, newRecord);
        console.log("[MyProfile] upsertMyProfile ✓ id=", newRecord.id);
      } catch (e) {
        const msg = (e as Error)?.message ?? "알 수 없는 오류";
        console.error("[MyProfile] upsert failed:", msg);
        toast({
          title: "클라우드 저장 실패",
          description: `로컬에는 저장되었지만 클라우드 동기화에 실패했습니다: ${msg.substring(0, 80)}`,
          variant: "destructive",
        });
      }
    }
  }

  async function handleDelete() {
    deleteMyProfile();
    setRecord(null);
    setShowDeleteConfirm(false);
    if (user) {
      try {
        await deleteMyProfileFromDb(user.id);
      } catch (e) {
        console.error("[MyProfile] delete from db failed:", e);
      }
    }
    toast({ description: "내 사주가 삭제되었습니다", duration: 3000 });
  }

  if (!record || editing) {
    return (
      <div className="ds-app-shell ds-page-pad py-8">
        <div className="mb-8">
          <h1 className="ds-title-lg">내 사주 등록</h1>
          <p className="ds-subtitle mt-2 block font-normal">
            정확한 생년월일시를 입력하면 사주팔자를 계산합니다
          </p>
        </div>
        <div className="ds-card shadow-none">
          <div className="ds-card-pad pt-6">
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
          </div>
        </div>

        {editing && (
          <Button variant="ghost" className="mt-3 w-full shadow-none" onClick={() => setEditing(false)}>
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
  const dayEl = (dayStem ? charToElement(dayStem) : null) as FiveElKey | null;
  const thumbBgClass = dayEl ? elementBgClass(dayEl, "muted") : "bg-muted";

  return (
    <div className="ds-app-shell ds-page-pad py-8 ds-section-gap">

      {/* ── Unified Identity Card ── */}
      <div className="ds-card ds-card-pad relative shadow-none">
        <div className="absolute right-4 top-4 flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
            title="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── 삭제 확인 오버레이 ── */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-card/95 p-5 backdrop-blur-sm">
            <p className="text-center text-sm font-semibold text-foreground">
              내 사주를 삭제할까요?
            </p>
            <p className="text-center text-xs text-muted-foreground">
              모든 설정과 분석 데이터가 사라지며 되돌릴 수 없습니다.
            </p>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="shadow-none"
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </Button>
              <Button type="button" variant="destructive" className="shadow-none" onClick={handleDelete}>
                삭제
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden ${thumbBgClass}`}>
            {zodiac ? (
              <img src={zodiac.src} alt={zodiac.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{input.name.charAt(0)}</span>
            )}
          </div>

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

            <div className="mt-1"><MaritalBadge status={record.maritalStatus} /></div>
          </div>
        </div>

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

      <SajuReport record={record} />
    </div>
  );
}
