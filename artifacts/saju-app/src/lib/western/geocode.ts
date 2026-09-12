// /api/geocode 클라이언트 래퍼 — 출생지 이름 → 후보 목록(위도·경도·국가코드·시간대 후보).
// 실제 판단(어느 후보를 쓸지, 시간대가 여러 개일 때 어느 것을 쓸지)은 호출부(UI)와 사용자가
// 한다 — 이 파일은 서버 응답을 그대로 옮기기만 한다.
export interface TimezoneOption {
  value: string;
  label: string;
}

export interface GeocodeCandidate {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  timezones: TimezoneOption[];
}

export async function geocodePlace(query: string): Promise<GeocodeCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates?: GeocodeCandidate[] };
    return data.candidates ?? [];
  } catch {
    return [];
  }
}
