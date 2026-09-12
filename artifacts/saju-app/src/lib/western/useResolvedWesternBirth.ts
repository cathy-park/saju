// 21단계 추가 지시 — "출생지 이름만 있으면 서양점성술 진입 시 자동으로 위도/경도/IANA
// 시간대를 확보한다"를 리포트 페이지 6곳(개인 4개 + 관계 2개)이 공통으로 쓰는 훅 하나로
// 구현한다. 결과가 명확한 경우(모든 후보가 같은 나라 + 같은 시간대 1개로 수렴, 자세한 조건은
// selectUnambiguousCandidate 참고)에만 조용히 westernLocation에 저장하고 재사용한다 — 그
// 외(다른 나라·다른 시간대 후보가 섞임, 지오코딩 실패)에는 아무것도 추측하지 않고 기존처럼
// [출생지 설정] 화면으로 안내한다(그 화면에서 후보를 직접 고르거나 고급 설정으로 직접 입력할
// 수 있다).
import { useEffect, useMemo, useRef, useState } from "react";
import { getMyProfile, saveMyProfile, savePerson, type PersonRecord } from "@/lib/storage";
import { useAuth } from "@/lib/authContext";
import { upsertMyProfile, upsertPartnerProfile } from "@/lib/db";
import { geocodePlace, type GeocodeCandidate } from "./geocode";
import { westernBirthSource } from "./uiModel";
import type { WesternBirthSource } from "./adapter";

export type ResolvedWesternBirthStatus = "unavailable" | "resolving" | "ready";

// 후보가 여러 개여도 전부 같은 나라 + 같은 시간대 1개로 수렴하면(예: "전주"처럼 도로·랜드마크
// 단위로 쪼개진 동명 후보들) 좌표 몇 km 차이는 서양점성술 계산에 영향을 주지 않으므로 대표
// 후보(candidates[0])를 자동 채택한다. 나라나 시간대가 실제로 섞여 있으면(동명이지) 여전히
// 아무것도 추측하지 않고 [출생지 설정]으로 안내한다.
export function selectUnambiguousCandidate(candidates: GeocodeCandidate[]): GeocodeCandidate | null {
  if (candidates.length === 0) return null;
  if (!candidates.every((c) => c.timezones.length === 1)) return null;
  const timezones = new Set(candidates.map((c) => c.timezones[0].value));
  const countries = new Set(candidates.map((c) => c.countryCode));
  if (timezones.size !== 1 || countries.size !== 1) return null;
  return candidates[0];
}

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
      const candidate = selectUnambiguousCandidate(candidates);
      if (!candidate) {
        setResolving(false);
        return;
      }
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

  // birth는 반드시 참조 안정성을 지켜야 한다 — 호출부(리포트 페이지)가 이 값을 useEffect
  // 의존성으로 쓰기 때문에, 매 렌더마다 새 객체를 만들면(location 값은 그대로인데도) effect가
  // 계속 재실행되어 fetch → setState → 재렌더 → 새 객체 → effect 재실행이 무한 반복된다
  // (실제로 production에서 이 버그로 /api/western-overview가 초당 수십 회 호출된 적 있음 —
  // 21단계 회귀, useMemo로 고쳤다). location의 실제 값(문자열·숫자)이 바뀔 때만 새로 만든다.
  const birth = useMemo(() => {
    if (!person || !location) return null;
    return westernBirthSource({ ...person, westernLocation: location });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id, location?.latitude, location?.longitude, location?.timezone, location?.placeLabel]);

  if (!person) return { birth: null, status: "unavailable" };
  if (birth) return { birth, status: "ready" };
  return { birth: null, status: resolving ? "resolving" : "unavailable" };
}
