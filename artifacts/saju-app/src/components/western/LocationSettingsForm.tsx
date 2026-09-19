import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { KoreanRegionField } from "@/components/KoreanRegionField";
import { koreanRegionLocation } from "@/lib/koreanRegions";
import { getMyProfile, getPeople, saveMyProfile, savePerson, type PersonRecord } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";

const findPerson = (id: string) => {
  const mine = getMyProfile();
  return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null;
};

export function LocationSettingsForm({ personId, field, heading, description, overviewPath }: {
  personId: string;
  field: "westernLocation" | "currentLocation";
  heading: string;
  description: string;
  overviewPath: (personId: string) => string;
}) {
  const person = personId ? findPerson(personId) : null;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [label, setLabel] = useState(person?.[field]?.placeLabel ?? (field === "westernLocation" ? person?.birthInput.birthplace : person?.currentPlaceName) ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selected = koreanRegionLocation(label);

  async function save() {
    if (!person || !selected) return;
    const updated: PersonRecord = {
      ...person,
      [field]: selected,
      ...(field === "westernLocation"
        ? { birthInput: { ...person.birthInput, birthplace: label } }
        : { currentPlaceName: label }),
      updatedAt: new Date().toISOString(),
    };
    const isMine = getMyProfile()?.id === person.id;
    isMine ? saveMyProfile(updated) : savePerson(updated);
    setSaving(true);
    try {
      if (user) await (isMine ? upsertMyProfile(user.id, updated) : upsertPartnerProfile(user.id, updated));
      navigate(overviewPath(person.id));
    } catch {
      setSaveError("로컬에는 저장했지만 클라우드 동기화에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (!person) return <main className="ds-app-shell ds-page-pad py-8"><p>사람을 찾을 수 없습니다.</p></main>;
  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <header>
      <p className="text-xs font-semibold text-primary">서양점성술 설정</p>
      <h1 className="mt-1 text-2xl font-bold">{person.birthInput.name}님의 {heading}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </header>
    <section className="ds-card ds-card-pad space-y-4 shadow-none">
      <KoreanRegionField id="location" label={heading} value={label} onChange={setLabel} />
      {selected && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
        {selected.placeLabel} · 위도 {selected.latitude.toFixed(4)} · 경도 {selected.longitude.toFixed(4)}
      </p>}
      {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
      <div className="flex gap-2">
        <Link href={overviewPath(person.id)} className="flex-1"><Button type="button" variant="outline" className="w-full">취소</Button></Link>
        <Button type="button" className="flex-1" disabled={!selected || saving} onClick={save}>{saving ? "저장 중" : "저장"}</Button>
      </div>
    </section>
  </main>;
}
