// 서양점성술 출생지 자동 해석(21단계 추가 지시) — 사용자는 출생지 "이름"만 입력하고, 이
// 서버 함수가 위도/경도/IANA 시간대를 찾아준다. 좌표를 하드코딩하지 않는다(예: "인천"을
// 임의 상수로 매핑하지 않음) — 실제 지오코딩 서비스를 호출한다.
//
// Provider 선정 근거(대표 지시로 짧게 비교 후 결정):
//   - Nominatim(OpenStreetMap): API 키 없이 즉시 사용 가능, 무료. 사용 정책상 요청당
//     User-Agent 식별 필수, 초당 1회 정도로 가볍게 쓰는 것을 권장(상용 대량 트래픽 금지).
//     한국 주요 지명(도시명 단위)은 OSM 데이터에 한글/영문 라벨이 있어 충분히 인식된다.
//   - Kakao/Google 지오코딩: 한국 주소 품질은 더 좋지만 API 키 발급(대표의 별도 계정 생성)이
//     필요해 이번 단계에서 자동으로 구성할 수 없다.
//   - 결론: 지금 당장 키 없이 안전하게 동작하는 Nominatim을 쓴다. 나중에 주소 품질을 더
//     올리고 싶으면 Kakao Local API(무료 3만/일)로 교체를 검토할 것.
//
// 시간대는 좌표→시간대 변환용 대용량 지리 경계 데이터(geo-tz 등, 수십MB)를 새로 들이는 대신,
// Nominatim이 함께 주는 country_code를 countries-and-timezones(수백KB, 순수 국가→시간대
// 매핑)로 변환한다. 시간대가 국가 안에서 유일하면(한국·일본 등 대부분) 그대로 확정하고,
// 여러 개면(미국·러시아 등) "불확실" 상태로 두어 클라이언트가 사용자에게 직접 고르게 한다 —
// 새로운 판정 로직을이 만들지 않고, 모르면 사용자에게 묻는다는 원칙을 지킨다.
import ct from "countries-and-timezones";

interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

export interface TimezoneOption {
  /** IANA 시간대 이름(예: Asia/Seoul) — westernLocation.timezone에 그대로 저장된다. */
  value: string;
  /** 사용자에게 보여줄 라벨(예: "Asia/Seoul (UTC+09:00)") — countries-and-timezones가 이미
   * 계산해 둔 UTC 오프셋을 그대로 쓴다(클라이언트에 그 패키지를 따로 번들하지 않기 위해
   * 서버에서 미리 문자열로 만들어 내려준다). */
  label: string;
}

export interface GeocodeCandidate {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  /** 국가 안에서 시간대가 유일하면 이 배열은 원소 1개 — 클라이언트는 그 값을 바로 쓰면 된다.
   * 2개 이상이면 사용자가 직접 골라야 한다(불확실). 0개면 국가 코드를 모르거나 매핑이 없는
   * 경우로, 고급 설정(직접 입력)으로 안내한다. */
  timezones: TimezoneOption[];
}

const parse = (body: unknown): unknown => (typeof body === "string" ? JSON.parse(body) : body);

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body: unknown;
  try {
    body = parse(req.body);
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const query = (body as { query?: unknown } | null)?.query;
  if (typeof query !== "string" || query.trim().length === 0 || query.length > 200) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "ko");

    const nominatimRes = await fetch(url, {
      headers: {
        // Nominatim 사용 정책: 요청을 보내는 애플리케이션을 식별할 수 있는 User-Agent 필수.
        "User-Agent": "NaeuiHeureum-SajuApp/1.0 (+https://saju-app-silk.vercel.app)",
      },
    });
    if (!nominatimRes.ok) {
      res.status(502).json({ error: "Geocoding service unavailable" });
      return;
    }
    const results = (await nominatimRes.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: { country_code?: string };
    }>;

    const candidates: GeocodeCandidate[] = results.map((item) => {
      const countryCode = item.address?.country_code ? item.address.country_code.toUpperCase() : null;
      const tzNames = countryCode ? (ct.getCountry(countryCode)?.timezones ?? []) : [];
      const timezones: TimezoneOption[] = tzNames.map((name) => {
        const tz = ct.getTimezone(name);
        return { value: name, label: tz ? `${name} (UTC${tz.utcOffsetStr})` : name };
      });
      return {
        label: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        countryCode,
        timezones,
      };
    });

    res.status(200).json({ candidates });
  } catch (error) {
    console.error("geocode failed", error);
    res.status(500).json({ error: "Geocoding failed" });
  }
}
