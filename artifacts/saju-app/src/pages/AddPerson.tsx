import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">사람 추가</h1>
        <p className="text-muted-foreground text-sm mt-1">
          사주를 계산할 사람의 정보를 입력하세요
        </p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-foreground mb-2">관계</p>
        <div className="flex gap-2 flex-wrap">
          {REL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setRelType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                relType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              }`}
            >
              {RELATIONSHIP_TYPE_EMOJI[t]} {RELATIONSHIP_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
