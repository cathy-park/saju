import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BirthForm } from "@/components/BirthForm";
import { MaritalField, MaritalBadge } from "@/components/MaritalField";
import { SajuDisplay } from "@/components/SajuDisplay";
import { calculateProfileFromBirth, type BirthInput, type Pillar } from "@/lib/sajuEngine";
import {
  getPeople,
  savePerson,
  createRecord,
  getFinalPillars,
  type PersonRecord,
  type RelationshipType,
  type MaritalStatus,
  RELATIONSHIP_TYPE_LABEL,
  RELATIONSHIP_TYPE_EMOJI,
} from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertPartnerProfile } from "@/lib/db";
import { cn } from "@/lib/utils";

const REL_TYPES: RelationshipType[] = ["lover", "spouse", "friend", "coworker", "family", "other"];

export default function EditPerson() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [record, setRecord] = useState<PersonRecord | null>(() => {
    return getPeople().find((p) => p.id === id) ?? null;
  });

  const [manualPillars, setManualPillars] = useState(record?.manualPillars ?? {});
  const [relType, setRelType] = useState<RelationshipType>(record?.relationshipType ?? "friend");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | undefined>(record?.maritalStatus);

  if (!record) {
    return (
      <div className="ds-app-shell ds-page-pad py-8">
        <p className="ds-body text-muted-foreground">해당 사람을 찾을 수 없습니다.</p>
      </div>
    );
  }

  async function handleBirthSubmit(input: BirthInput) {
    let updated: PersonRecord;
    try {
      const profile = calculateProfileFromBirth(input);
      updated = {
        ...record!,
        birthInput: input,
        profile,
        manualPillars: {},
        relationshipType: relType,
        maritalStatus,
        updatedAt: new Date().toISOString(),
      };
    } catch (e: unknown) {
      alert("계산 오류: " + ((e as Error)?.message ?? "알 수 없는 오류"));
      return;
    }
    savePerson(updated);
    if (user) {
      upsertPartnerProfile(user.id, updated).catch((e) => {
        console.error("[EditPerson] upsert failed:", e);
      });
    }
    navigate("/people");
  }

  function handleManualSave() {
    const updated: PersonRecord = {
      ...record!,
      manualPillars,
      relationshipType: relType,
      maritalStatus,
      updatedAt: new Date().toISOString(),
    };
    savePerson(updated);
    setRecord(updated);
    if (user) {
      upsertPartnerProfile(user.id, updated).catch((e) => {
        console.error("[EditPerson] manual upsert failed:", e);
      });
    }
    navigate("/people");
  }

  const finalPillars = getFinalPillars({ ...record, manualPillars });

  const updatePillar = (
    key: "year" | "month" | "day" | "hour",
    field: "hangul" | "hanja",
    value: string
  ) => {
    const current = (manualPillars as any)[key] ?? record!.profile.computedPillars[key] ?? { hangul: "", hanja: "" };
    setManualPillars((prev) => ({
      ...prev,
      [key]: { ...current, [field]: value },
    }));
  };

  const defaultBirthValues: Partial<BirthInput> = { ...record.birthInput };

  return (
    <div className="ds-app-shell ds-page-pad py-8 space-y-6">
      <div>
        <h1 className="ds-title-lg">사주 편집</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="ds-body text-muted-foreground">{record.birthInput.name}님</p>
          <MaritalBadge status={record.maritalStatus} />
        </div>
      </div>

      {/* 관계 유형 */}
      <div>
        <p className="ds-subtitle mb-2 block text-foreground">관계</p>
        <div className="flex flex-wrap gap-2">
          {REL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRelType(t)}
              className={cn(
                "ds-badge px-3 py-2 text-sm shadow-none transition-colors",
                relType === t ? "ds-badge-active border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
              )}
            >
              {RELATIONSHIP_TYPE_EMOJI[t]} {RELATIONSHIP_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="birth">
        <TabsList className="w-full">
          <TabsTrigger value="birth" className="flex-1">생년월일 수정</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">사주 직접 수정</TabsTrigger>
        </TabsList>

        <TabsContent value="birth">
          <div className="ds-card shadow-none">
            <div className="ds-card-pad pt-6">
              <BirthForm
                defaultValues={defaultBirthValues}
                onSubmit={handleBirthSubmit}
                submitLabel="다시 계산 & 저장"
                renderExtra={
                  <MaritalField
                    value={maritalStatus}
                    onChange={setMaritalStatus}
                  />
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="ds-card shadow-none">
            <div className="border-b border-border px-4 pb-3 pt-4">
              <h2 className="text-base font-semibold text-foreground">현재 사주 (미리보기)</h2>
            </div>
            <div className="ds-card-pad">
              <SajuDisplay
                pillars={finalPillars}
                fiveElements={record.profile.fiveElementDistribution}
                timeUnknown={record.birthInput.timeUnknown}
                compact
              />
            </div>
          </div>

          <div className="ds-card shadow-none">
            <div className="border-b border-border px-4 pb-3 pt-4">
              <h2 className="text-base font-semibold text-foreground">사주 직접 수정</h2>
            </div>
            <div className="ds-card-pad space-y-4">
              <p className="text-[13px] text-muted-foreground">
                계산된 값이 잘못된 경우 직접 수정할 수 있습니다. 한글과 한자를 각각 입력하세요.
              </p>

              {(["year", "month", "day", "hour"] as const).map((key) => {
                const labels: Record<string, string> = {
                  year: "년주", month: "월주", day: "일주", hour: "시주"
                };
                const current = (manualPillars as any)[key] ?? record.profile.computedPillars[key];
                return (
                  <div key={key} className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[13px]">{labels[key]} (한글)</Label>
                      <Input
                        className="mt-1"
                        value={current?.hangul ?? ""}
                        onChange={(e) => updatePillar(key, "hangul", e.target.value)}
                        placeholder={key === "hour" && record.birthInput.timeUnknown ? "미상" : "예: 갑자"}
                        disabled={key === "hour" && record.birthInput.timeUnknown}
                      />
                    </div>
                    <div>
                      <Label className="text-[13px]">{labels[key]} (한자)</Label>
                      <Input
                        className="mt-1"
                        value={current?.hanja ?? ""}
                        onChange={(e) => updatePillar(key, "hanja", e.target.value)}
                        placeholder={key === "hour" && record.birthInput.timeUnknown ? "미상" : "예: 甲子"}
                        disabled={key === "hour" && record.birthInput.timeUnknown}
                      />
                    </div>
                  </div>
                );
              })}

              <MaritalField value={maritalStatus} onChange={setMaritalStatus} />

              <Button className="w-full shadow-none" onClick={handleManualSave}>
                수정 저장
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
