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
    geocodePlace(placeName).then(async (candidates) => {
      if (cancelled) return;
      const candidate = selectUnambiguousCandidate(candidates);
      if (!candidate) return;
      const currentLocation: WesternGeoLocation = {
        placeLabel: candidate.label,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezones[0].value,
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
      if (!cancelled) setLocation(currentLocation);
    });
    return () => { cancelled = true; };
  }, [person, user]);

  return location;
}
