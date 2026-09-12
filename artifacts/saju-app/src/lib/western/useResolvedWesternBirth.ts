// 21단계 추가 지시 — "출생지 이름만 있으면 서양점성술 진입 시 자동으로 위도/경도/IANA
// 시간대를 확보한다"를 리포트 페이지 6곳(개인 4개 + 관계 2개)이 공통으로 쓰는 훅 하나로
// 구현한다. 결과가 명확한 경우(지오코딩 후보가 1개 + 그 국가의 시간대가 1개)에만 조용히
// westernLocation에 저장하고 재사용한다 — 그 외(동명 후보 여러 개, 국가 내 시간대 여러 개,
// 지오코딩 실패)에는 아무것도 추측하지 않고 기존처럼 [출생지 설정] 화면으로 안내한다(그
// 화면에서 후보를 직접 고르거나 고급 설정으로 직접 입력할 수 있다).
import { useEffect, useRef, useState } from "react";
import { getMyProfile, saveMyProfile, savePerson, type PersonRecord } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { geocodePlace } from "./geocode";
import { westernBirthSource } from "./uiModel";
import type { WesternBirthSource } from "./adapter";

export type ResolvedWesternBirthStatus = "unavailable" | "resolving" | "ready";

export function useResolvedWesternBirth(person: PersonRecord | null): {
  birth: WesternBirthSource | null;
  status: ResolvedWesternBirthStatus;
} {
  const { user } = useAuth();
  const [location, setLocation] = useState(person?.westernLocation ?? null);
  const [resolving, setResolving] = useState(false);
  const attemptedKey = useRef<string | null>(null);

  useEffect(() => {
    setLocation(person?.westernLocation ?? null);
  }, [person?.id, person?.westernLocation]);

  useEffect(() => {
    if (!person || person.westernLocation) return;
    const birthplace = person.birthInput.birthplace?.trim();
    if (!birthplace) return;
    const key = `${person.id}:${birthplace}`;
    if (attemptedKey.current === key) return;
    attemptedKey.current = key;

    let cancelled = false;
    setResolving(true);
    geocodePlace(birthplace).then(async (candidates) => {
      if (cancelled) return;
      // 후보가 정확히 1개이고, 그 국가의 시간대도 정확히 1개일 때만 "명확하다"고 본다 —
      // 그 외에는 조용히 확정하지 않고 사용자가 [출생지 설정]에서 직접 고르게 둔다.
      if (candidates.length !== 1 || candidates[0].timezones.length !== 1) {
        setResolving(false);
        return;
      }
      const candidate = candidates[0];
      const westernLocation: NonNullable<PersonRecord["westernLocation"]> = {
        placeLabel: candidate.label,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezones[0].value,
        resolver: { provider: "nominatim", version: "1" },
      };
      const updated: PersonRecord = { ...person, westernLocation, updatedAt: new Date().toISOString() };
      const isMine = getMyProfile()?.id === person.id;
      isMine ? saveMyProfile(updated) : savePerson(updated);
      if (user) {
        try {
          await (isMine ? upsertMyProfile(user.id, updated) : upsertPartnerProfile(user.id, updated));
        } catch {
          // 클라우드 동기화 실패는 무시한다 — 로컬 저장은 이미 끝났고, 다음 방문 때 다시
          // 시도된다(westernLocation이 로컬에는 있으니 이번 세션에서는 재계산하지 않는다).
        }
      }
      if (!cancelled) {
        setLocation(westernLocation);
        setResolving(false);
      }
    });
    return () => { cancelled = true; };
  }, [person, user]);

  if (!person) return { birth: null, status: "unavailable" };
  if (location) return { birth: westernBirthSource({ ...person, westernLocation: location }), status: "ready" };
  return { birth: null, status: resolving ? "resolving" : "unavailable" };
}
