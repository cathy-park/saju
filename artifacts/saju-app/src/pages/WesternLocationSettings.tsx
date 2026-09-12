import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, getPeople, saveMyProfile, savePerson, type PersonRecord } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { validateWesternLocation } from "@/lib/western/uiModel";

const findPerson = (id: string) => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };

export default function WesternLocationSettings() {
  const { personId } = useParams<{ personId: string }>();
  const person = personId ? findPerson(personId) : null;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [values, setValues] = useState({ placeLabel: person?.westernLocation?.placeLabel ?? "", latitude: person?.westernLocation?.latitude?.toString() ?? "", longitude: person?.westernLocation?.longitude?.toString() ?? "", timezone: person?.westernLocation?.timezone ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!person) return <main className="ds-app-shell ds-page-pad py-8"><p>사람을 찾을 수 없습니다.</p></main>;

  async function save() {
    if (!person) return;
    const westernLocation: NonNullable<PersonRecord["westernLocation"]> = { placeLabel: values.placeLabel.trim(), latitude: Number(values.latitude), longitude: Number(values.longitude), timezone: values.timezone.trim(), resolver: { provider: "manual-exact-input", version: "1" } };
    const issue = validateWesternLocation(westernLocation);
    if (issue) { setError(issue); return; }
    const updated = { ...person, westernLocation, updatedAt: new Date().toISOString() };
    const isMine = getMyProfile()?.id === person.id;
    isMine ? saveMyProfile(updated) : savePerson(updated);
    setSaving(true);
    try {
      if (user) await (isMine ? upsertMyProfile(user.id, updated) : upsertPartnerProfile(user.id, updated));
      navigate(`/western/${person.id}/overview`);
    } catch {
      setError("로컬에는 저장했지만 클라우드 동기화에 실패했습니다. 다시 시도해주세요.");
    } finally { setSaving(false); }
  }

  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <header><p className="text-xs font-semibold text-primary">서양점성술 설정</p><h1 className="mt-1 text-2xl font-bold">{person.birthInput.name}님의 출생 위치</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">현재 위치 검색 서비스가 연결되지 않아, 확인한 정확한 좌표와 IANA 시간대만 직접 저장할 수 있습니다. 출생지 이름만으로 값을 추정하지 않습니다.</p></header>
    <section className="ds-card ds-card-pad space-y-4 shadow-none">
      <div><Label htmlFor="western-place">출생지 표시 이름</Label><Input id="western-place" className="mt-1" value={values.placeLabel} onChange={(event) => setValues({ ...values, placeLabel: event.target.value })} placeholder="예: 인천, 대한민국" /></div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="western-latitude">위도</Label><Input id="western-latitude" inputMode="decimal" className="mt-1" value={values.latitude} onChange={(event) => setValues({ ...values, latitude: event.target.value })} placeholder="37.4563" /></div><div><Label htmlFor="western-longitude">경도</Label><Input id="western-longitude" inputMode="decimal" className="mt-1" value={values.longitude} onChange={(event) => setValues({ ...values, longitude: event.target.value })} placeholder="126.7052" /></div></div>
      <div><Label htmlFor="western-timezone">IANA 시간대</Label><Input id="western-timezone" className="mt-1" value={values.timezone} onChange={(event) => setValues({ ...values, timezone: event.target.value })} placeholder="Asia/Seoul" /><p className="mt-1 text-xs text-muted-foreground">UTC+9 같은 고정 오프셋이 아닌 `Asia/Seoul` 형식입니다.</p></div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex gap-2"><Link href={`/western/${person.id}/overview`} className="flex-1"><Button variant="outline" className="w-full">취소</Button></Link><Button className="flex-1" disabled={saving} onClick={save}>{saving ? "저장 중" : "저장"}</Button></div>
    </section>
  </main>;
}
