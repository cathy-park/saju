// 21단계 추가 지시 — 사용자는 출생지 "이름"만 입력한다. 위도·경도·IANA 시간대는 이 화면이
// /api/geocode(Nominatim 기반, api/geocode.ts 주석 참고)로 자동으로 찾는다. 결과가
// 명확하면(장소 후보 1개 + 그 나라의 시간대 1개) 바로 저장 가능한 상태로 보여주고, 동명
// 후보가 여럿이거나 나라 안에 시간대가 여럿이면 그 목록에서 직접 고르게 한다. 위도·경도·
// 시간대 직접 입력은 "고급 설정"에 접어 넣어 fallback으로만 제공한다 — 기본 경로가 아니다.
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getMyProfile, getPeople, saveMyProfile, savePerson, type PersonRecord } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { validateWesternLocation } from "@/lib/western/uiModel";
import { geocodePlace, type GeocodeCandidate } from "@/lib/western/geocode";

const findPerson = (id: string) => { const mine = getMyProfile(); return mine?.id === id ? mine : getPeople().find((person) => person.id === id) ?? null; };

interface ResolvedLocation {
  placeLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
  provider: "nominatim" | "manual-exact-input";
}

export default function WesternLocationSettings() {
  const { personId } = useParams<{ personId: string }>();
  const person = personId ? findPerson(personId) : null;
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [query, setQuery] = useState(person?.westernLocation?.placeLabel ?? person?.birthInput.birthplace ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<GeocodeCandidate | null>(null);
  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState({
    placeLabel: person?.westernLocation?.placeLabel ?? "",
    latitude: person?.westernLocation?.latitude?.toString() ?? "",
    longitude: person?.westernLocation?.longitude?.toString() ?? "",
    timezone: person?.westernLocation?.timezone ?? "",
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSelectedPlace(null);
    setSelectedTimezone(null);
    const results = await geocodePlace(q);
    setSearching(false);
    if (results.length === 0) {
      setCandidates([]);
      setSearchError("출생지를 찾을 수 없습니다. 다른 이름으로 검색하거나 고급 설정에서 직접 입력해주세요.");
      setAdvancedOpen(true);
      return;
    }
    setCandidates(results);
    // 후보가 1개뿐이면(동명 문제 없음) 바로 선택된 것으로 취급한다 — 시간대까지 유일하면
    // 아래 resolved 계산에서 곧바로 저장 가능한 상태가 된다.
    if (results.length === 1) setSelectedPlace(results[0]);
  }

  // 기존 birthplace가 있고 아직 westernLocation이 없으면, 이 화면에 들어오자마자 자동으로
  // 한 번 찾아본다(대표 지시: "Western 진입 시 자동 resolve 시도"). 이미 westernLocation이
  // 있으면(설정을 바꾸러 온 것) 자동 검색하지 않는다.
  useEffect(() => {
    if (person && !person.westernLocation && person.birthInput.birthplace) {
      runSearch(person.birthInput.birthplace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);

  if (!person) return <main className="ds-app-shell ds-page-pad py-8"><p>사람을 찾을 수 없습니다.</p></main>;

  const resolved: ResolvedLocation | null = selectedPlace
    ? (selectedPlace.timezones.length === 1
      ? { placeLabel: selectedPlace.label, latitude: selectedPlace.latitude, longitude: selectedPlace.longitude, timezone: selectedPlace.timezones[0].value, provider: "nominatim" }
      : selectedTimezone
      ? { placeLabel: selectedPlace.label, latitude: selectedPlace.latitude, longitude: selectedPlace.longitude, timezone: selectedTimezone, provider: "nominatim" }
      : null)
    : null;

  async function persist(location: ResolvedLocation) {
    if (!person) return;
    const westernLocation: NonNullable<PersonRecord["westernLocation"]> = {
      placeLabel: location.placeLabel, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone,
      resolver: { provider: location.provider, version: "1" },
    };
    const issue = validateWesternLocation(westernLocation);
    if (issue) { setSaveError(issue); return; }
    const updated = { ...person, westernLocation, updatedAt: new Date().toISOString() };
    const isMine = getMyProfile()?.id === person.id;
    isMine ? saveMyProfile(updated) : savePerson(updated);
    setSaving(true);
    try {
      if (user) await (isMine ? upsertMyProfile(user.id, updated) : upsertPartnerProfile(user.id, updated));
      navigate(`/western/${person.id}/overview`);
    } catch {
      setSaveError("로컬에는 저장했지만 클라우드 동기화에 실패했습니다. 다시 시도해주세요.");
    } finally { setSaving(false); }
  }

  function saveAdvanced() {
    persist({
      placeLabel: advanced.placeLabel.trim(),
      latitude: Number(advanced.latitude),
      longitude: Number(advanced.longitude),
      timezone: advanced.timezone.trim(),
      provider: "manual-exact-input",
    });
  }

  return <main className="ds-app-shell ds-page-pad py-8 ds-section-gap">
    <header>
      <p className="text-xs font-semibold text-primary">서양점성술 설정</p>
      <h1 className="mt-1 text-2xl font-bold">{person.birthInput.name}님의 출생 위치</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">출생지 이름만 입력하면 위도·경도·시간대를 자동으로 찾습니다. 동명 지역이거나 나라 안에 시간대가 여럿이면 직접 골라주세요.</p>
    </header>

    <section className="ds-card ds-card-pad space-y-4 shadow-none">
      <div>
        <Label htmlFor="western-place-search">출생지</Label>
        <div className="mt-1 flex gap-2">
          <Input id="western-place-search" className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 인천" onKeyDown={(event) => { if (event.key === "Enter") runSearch(query); }} />
          <Button type="button" onClick={() => runSearch(query)} disabled={searching || !query.trim()}>{searching ? "찾는 중" : "찾기"}</Button>
        </div>
        {searchError && <p className="mt-2 text-sm text-destructive" role="alert">{searchError}</p>}
      </div>

      {candidates && candidates.length > 1 && (
        <div>
          <p className="text-sm font-semibold text-foreground">같은 이름의 지역이 여러 곳 있습니다. 맞는 곳을 골라주세요.</p>
          <div className="mt-2 space-y-2">
            {candidates.map((candidate, i) => (
              <button
                key={i} type="button"
                onClick={() => { setSelectedPlace(candidate); setSelectedTimezone(null); }}
                className={cn(
                  "flex w-full min-h-11 items-center rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  selectedPlace === candidate ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedPlace && selectedPlace.timezones.length > 1 && (
        <div>
          <p className="text-sm font-semibold text-foreground">이 나라는 시간대가 여러 개입니다. 출생 당시 시간대를 골라주세요.</p>
          <div className="mt-2 space-y-2">
            {selectedPlace.timezones.map((tz) => (
              <button
                key={tz.value} type="button"
                onClick={() => setSelectedTimezone(tz.value)}
                className={cn(
                  "flex w-full min-h-11 items-center rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  selectedTimezone === tz.value ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                {tz.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {resolved && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <p className="font-semibold text-foreground">{resolved.placeLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{resolved.timezone} · 위도 {resolved.latitude.toFixed(4)} · 경도 {resolved.longitude.toFixed(4)}</p>
        </div>
      )}

      {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}

      <div className="flex gap-2">
        <Link href={`/western/${person.id}/overview`} className="flex-1"><Button type="button" variant="outline" className="w-full">취소</Button></Link>
        <Button type="button" className="flex-1" disabled={!resolved || saving} onClick={() => resolved && persist(resolved)}>{saving ? "저장 중" : "저장"}</Button>
      </div>
    </section>

    <section className="ds-card shadow-none overflow-visible">
      <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span>
          <span className="text-sm font-bold text-foreground">고급 설정</span>
          <span className="ml-2 text-xs text-muted-foreground">위도·경도·시간대 직접 입력</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", advancedOpen && "rotate-180")} />
      </button>
      {advancedOpen && (
        <div className="ds-card-pad space-y-4 border-t border-border">
          <div><Label htmlFor="western-place">출생지 표시 이름</Label><Input id="western-place" className="mt-1" value={advanced.placeLabel} onChange={(event) => setAdvanced({ ...advanced, placeLabel: event.target.value })} placeholder="예: 인천, 대한민국" /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="western-latitude">위도</Label><Input id="western-latitude" inputMode="decimal" className="mt-1" value={advanced.latitude} onChange={(event) => setAdvanced({ ...advanced, latitude: event.target.value })} placeholder="37.4563" /></div><div><Label htmlFor="western-longitude">경도</Label><Input id="western-longitude" inputMode="decimal" className="mt-1" value={advanced.longitude} onChange={(event) => setAdvanced({ ...advanced, longitude: event.target.value })} placeholder="126.7052" /></div></div>
          <div><Label htmlFor="western-timezone">IANA 시간대</Label><Input id="western-timezone" className="mt-1" value={advanced.timezone} onChange={(event) => setAdvanced({ ...advanced, timezone: event.target.value })} placeholder="Asia/Seoul" /><p className="mt-1 text-xs text-muted-foreground">UTC+9 같은 고정 오프셋이 아닌 `Asia/Seoul` 형식입니다.</p></div>
          <Button type="button" className="w-full" disabled={saving} onClick={saveAdvanced}>{saving ? "저장 중" : "이 값으로 저장"}</Button>
        </div>
      )}
    </section>
  </main>;
}
