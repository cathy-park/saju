// useResolvedWesternBirth.ts와 같은 원칙 — 사용자는 "현재 거주지역" 이름만 입력하고, 이
// 훅이 백그라운드에서 지오코딩해 위도/경도/IANA 시간대를 채운다. 결과가 애매하면(동명 지역,
// 여러 시간대) 아무것도 추측하지 않고 person.currentLocation을 비워 둔다 — 이 경우 [현재
// 지역 설정] 화면(/western/:id/current-location)에서 직접 고르거나 고급 설정으로 입력해야
// 한다.
import { useEffect, useRef, useState } from "react";
import { getMyProfile, saveMyProfile, savePerson, type PersonRecord, type WesternGeoLocation } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { geocodePlace } from "./geocode";
import { selectUnambiguousCandidate } from "./useResolvedWesternBirth";
import { koreanRegionLocation } from "@/lib/koreanRegions";

/** 지오코딩해서 애매하지 않으면(동명 지역·시간대 여럿 아니면) 바로 저장까지 한다. 후보가
 * 없거나 애매하면 아무것도 하지 않고 조용히 끝난다(추측 안 함 — [현재 지역 설정] 화면에서
 * 사용자가 직접 고르는 경로로 남겨둔다). 프로필 저장 시점(즉시 반영)과 서양점성술 화면
 * 진입 시점(뒤늦게라도 채우기) 두 군데에서 공통으로 쓴다. */
export async function resolveAndSaveCurrentLocation(
  person: PersonRecord,
  user: { id: string } | null,
): Promise<WesternGeoLocation | null> {
  const placeName = person.currentPlaceName?.trim();
  if (!placeName || person.currentLocation) return person.currentLocation ?? null;

  const local = koreanRegionLocation(placeName);
  const candidate = local ? null : selectUnambiguousCandidate(await geocodePlace(placeName));
  if (!local && !candidate) return null;

  const currentLocation: WesternGeoLocation = local ?? {
    placeLabel: candidate!.label,
    latitude: candidate!.latitude,
    longitude: candidate!.longitude,
    timezone: candidate!.timezones[0].value,
    resolver: { provider: "nominatim", version: "1" },
  };
  const updated: PersonRecord = { ...person, currentLocation, updatedAt: new Date().toISOString() };
  const isMine = getMyProfile()?.id === person.id;
  isMine ? saveMyProfile(updated) : savePerson(updated);
  if (user) {
    try {
      await (isMine ? upsertMyProfile(user.id, updated) : upsertPartnerProfile(user.id, updated));
    } catch {
      // 클라우드 동기화 실패는 무시 — 로컬 저장은 이미 끝났고 다음 방문 때 다시 시도된다.
    }
  }
  return currentLocation;
}

export function useResolvedCurrentLocation(person: PersonRecord | null): WesternGeoLocation | null {
  const { user } = useAuth();
  const [location, setLocation] = useState(person?.currentLocation ?? null);
  const attemptedKey = useRef<string | null>(null);

  useEffect(() => {
    setLocation(person?.currentLocation ?? null);
  }, [person?.id, person?.currentLocation]);

  useEffect(() => {
    if (!person || person.currentLocation) return;
    const placeName = person.currentPlaceName?.trim();
    if (!placeName) return;
    const key = `${person.id}:${placeName}`;
    if (attemptedKey.current === key) return;
    attemptedKey.current = key;

    let cancelled = false;
    resolveAndSaveCurrentLocation(person, user).then((resolved) => {
      if (!cancelled && resolved) setLocation(resolved);
    });
    return () => { cancelled = true; };
  }, [person, user]);

  return location;
}
