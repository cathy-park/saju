import { useState } from "react";
import { useLocation } from "wouter";
import { BirthForm } from "@/components/BirthForm";
import { MaritalField } from "@/components/MaritalField";
import { calculateProfileFromBirth, type BirthInput } from "@/lib/sajuEngine";
import {
  savePerson,
  createRecord,
  type RelationshipType,
  type MaritalStatus,
  RELATIONSHIP_TYPE_LABEL,
  RELATIONSHIP_TYPE_EMOJI,
} from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertPartnerProfile } from "@/lib/db";
import { cn } from "@/lib/utils";

const REL_TYPES: RelationshipType[] = ["lover", "spouse", "friend", "coworker", "family", "other"];

export default function AddPerson() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [relType, setRelType] = useState<RelationshipType>("friend");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | undefined>(undefined);

  async function handleSubmit(input: BirthInput) {
    let record;
    try {
      const profile = calculateProfileFromBirth(input);
      record = createRecord(input, profile);
      record.relationshipType = relType;
      record.maritalStatus = maritalStatus;
    } catch (e: unknown) {
      alert("계산 오류: " + ((e as Error)?.message ?? "알 수 없는 오류"));
      return;
    }
    savePerson(record);
    if (user) {
      upsertPartnerProfile(user.id, record).catch((e) => {
        console.error("[AddPerson] upsert failed:", e);
      });
    }
    navigate("/people");
  }

  return (
    <div className="ds-app-shell ds-page-pad py-8">
      <div className="mb-8">
        <h1 className="ds-title-lg">사람 추가</h1>
        <p className="ds-subtitle mt-2 block font-normal">
          사주를 계산할 사람의 정보를 입력하세요
        </p>
      </div>

      <div className="mb-6">
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

      <div className="ds-card shadow-none">
        <div className="ds-card-pad pt-6">
          <BirthForm
            onSubmit={handleSubmit}
            submitLabel="사주 계산 & 저장"
            renderExtra={
              <MaritalField
                value={maritalStatus}
                onChange={setMaritalStatus}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
