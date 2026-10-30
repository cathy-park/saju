import { resolveLocalDateTime } from "app/western/time.ts";
import { calculateProfileFromBirth } from "app/sajuEngine.ts";
import { computePersonPipelineSnapshot } from "app/personPipelineSnapshot.ts";
import { buildSajuSummarySections } from "app/sajuSummaryFacts.ts";
import { buildZiweiChart } from "app/ziwei/buildZiweiChart.ts";
import { zhongzhouV1 } from "app/ziwei/ruleSets/zhongzhouV1.ts";
import { spouseReportTimingYears } from "app/ziwei/reports/spouseReport.ts";
import { buildExistingPersonalReports } from "app/integrated/personReports.ts";
import { calculateNatalChart } from "app/western/natalChart.ts";
import { buildWesternPersonalityReport } from "app/western/interpretation/report.ts";
import { resolveWesternPersonalSynthesisForBirth } from "app/western/synthesis/personAdapter.ts";
import {
  adaptSajuPersonal,
  adaptZiweiPersonal,
  adaptWesternPersonal,
} from "app/integrated/adapters.ts";
import { buildIntegratedPersonalReport } from "app/integrated/report.ts";
import { koreanRegions, koreanRegionLocation } from "app/koreanRegions.ts";

export class InputError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const fail = (code: string, message: string, details?: unknown): never => {
  throw new InputError(code, message, details);
};
const clean = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ");
const aliases: Record<string, string> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
};
export function resolveBirthplace(value: unknown) {
  if (typeof value !== "string" || value.length > 100 || !value.trim())
    return fail("INVALID_PLACE", "출생지역을 입력해 주세요.");
  const input = clean(value);
  const expanded = input
    .split(" ")
    .map((v, i) => (i === 0 ? (aliases[v] ?? v) : v))
    .join(" ");
  const direct = koreanRegionLocation(expanded);
  if (direct) return direct;
  const matches = Object.entries(koreanRegions).flatMap(
    ([province, districts]) =>
      Object.keys(districts)
        .filter(
          (d) =>
            d === input || d.replaceAll(" ", "") === input.replaceAll(" ", ""),
        )
        .map((d) => `${province} ${d}`),
  );
  if (matches.length === 1) return koreanRegionLocation(matches[0])!;
  return fail(
    "LOCATION_REQUIRED",
    matches.length > 1
      ? "같은 이름의 지역이 여러 곳입니다. 시·도까지 알려주세요."
      : "국내 지역은 시·도와 시·군·구를 알려주세요. 해외 출생지는 latitude, longitude, timezone을 함께 지정해 주세요.",
    { candidates: matches.slice(0, 12) },
  );
}
export function normalizeInput(raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return fail("INVALID_INPUT", "출생정보를 입력해 주세요.");
  if (!["solar", "lunar"].includes(raw.calendar))
    return fail(
      "CALENDAR_REQUIRED",
      "양력(solar)인지 음력(lunar)인지 알려주세요.",
    );
  if (!["남", "여"].includes(raw.gender))
    return fail(
      "GENDER_REQUIRED",
      "대운 계산에 사용하는 성별(남/여)을 알려주세요.",
    );
  if (raw.leapMonth === true)
    return fail(
      "LEAP_MONTH_UNSUPPORTED",
      "기존 사주 엔진의 음력 윤달 입력은 지원되지 않습니다. 해당 날짜를 양력으로 변환해 입력해 주세요.",
    );
  if (
    typeof raw.birthDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.birthDate)
  )
    return fail("INVALID_DATE", "생년월일을 YYYY-MM-DD로 입력해 주세요.");
  const [year, month, day] = raw.birthDate.split("-").map(Number);
  if (
    year < 1900 ||
    year > 2050 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (raw.calendar === "lunar" ? 30 : 31)
  )
    return fail(
      "INVALID_DATE",
      "지원 범위는 1900~2050년이며 실제 날짜를 입력해야 합니다.",
    );
  if (raw.calendar === "solar") {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    )
      return fail("INVALID_DATE", "존재하지 않는 양력 날짜입니다.");
  }
  if (
    typeof raw.birthTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.birthTime)
  )
    return fail(
      "TIME_REQUIRED",
      "세 가지 명반에는 출생 당시 현지시각 HH:mm이 필요합니다. 시간을 추측하지 마세요.",
    );
  const [hour, minute] = raw.birthTime.split(":").map(Number);
  const hasCoords = ["latitude", "longitude", "timezone"].some(
    (k) => raw[k] !== undefined,
  );
  let location;
  if (hasCoords) {
    if (
      !Number.isFinite(raw.latitude) ||
      Math.abs(raw.latitude) > 90 ||
      !Number.isFinite(raw.longitude) ||
      Math.abs(raw.longitude) > 180 ||
      typeof raw.timezone !== "string" ||
      raw.timezone.length > 100
    )
      return fail(
        "INVALID_LOCATION",
        "위도·경도와 IANA 시간대가 모두 필요합니다.",
      );
    try {
      new Intl.DateTimeFormat("en", { timeZone: raw.timezone });
    } catch {
      return fail("INVALID_TIMEZONE", "유효한 IANA 시간대가 필요합니다.");
    }
    if (
      typeof raw.birthplace !== "string" ||
      !raw.birthplace.trim() ||
      raw.birthplace.length > 100
    )
      return fail("INVALID_PLACE", "출생지역명을 입력해 주세요.");
    location = {
      placeLabel: clean(raw.birthplace),
      latitude: raw.latitude,
      longitude: raw.longitude,
      timezone: raw.timezone,
      resolver: { provider: "explicit-input" },
    };
  } else location = resolveBirthplace(raw.birthplace);
  if (raw.dstFold !== undefined && !["earlier", "later"].includes(raw.dstFold))
    return fail(
      "INVALID_DST_FOLD",
      "서머타임 중복 시각은 earlier/later로 지정해 주세요.",
    );
  const birthInput = {
    name: "private-input",
    gender: raw.gender,
    calendarType: raw.calendar,
    year,
    month,
    day,
    hour,
    minute,
    timeUnknown: false,
    birthplace: location.placeLabel,
    longitude: location.longitude,
  };
  return { birthInput, location, dstFold: raw.dstFold };
}
export function calculateThreeCharts(raw: unknown) {
  const { birthInput, location, dstFold } = normalizeInput(raw);
  const profile = calculateProfileFromBirth(birthInput);
  const pad = (n: number) => String(n).padStart(2, "0");
  const solar = profile.solarDate;
  let resolved;
  try {
    resolved = resolveLocalDateTime({
      localDateTime: `${solar.year}-${pad(solar.month)}-${pad(solar.day)}T${pad(birthInput.hour)}:${pad(birthInput.minute)}:00`,
      timezone: location.timezone,
      ...(dstFold ? { dstFold } : {}),
    });
  } catch (error: any) {
    return fail(
      error.code ?? "INVALID_LOCAL_TIME",
      "현지 출생시각의 시간대/DST를 확정할 수 없습니다. 중복 시각은 earlier/later를 지정해 주세요.",
    );
  }
  if (location.timezone !== "Asia/Seoul" || resolved.utcOffsetMinutes !== 540)
    return fail(
      "SAJU_ZIWEI_TIMEZONE_UNSUPPORTED",
      "사주·자미두수의 해외 및 역사적 표준시/DST 변환은 미지원입니다. 이 입력을 삼종 정상 계산으로 제공할 수 없습니다.",
    );
  const person = {
    id: "private-person",
    birthInput,
    profile,
    westernLocation: location,
    createdAt: "",
    updatedAt: "",
  };
  let existing;
  const warnings: string[] = [
    ...(profile.timeAudit?.warnings ?? []),
    "STRENGTH_YONGSHIN_RULE_INDEX_NOT_EMPIRICALLY_VALIDATED",
    "ZIWEI_SCHOOL_SIHUA_PERIODS_NOT_INDEPENDENTLY_VALIDATED",
    "WESTERN_EPHEMERIS_HOUSES_NOT_INDEPENDENTLY_VALIDATED",
  ];
  try {
    existing = buildExistingPersonalReports(person);
  } catch {
    const pipeline = computePersonPipelineSnapshot(person);
    const ziweiChart = buildZiweiChart(
      birthInput,
      zhongzhouV1,
      spouseReportTimingYears(),
    );
    existing = {
      saju: pipeline ? buildSajuSummarySections(pipeline, [], []) : [],
      ziwei: null,
      ziweiChart,
    };
    warnings.push(
      "기존 자미두수 종합 해석이 현재 나이의 대한 구간을 처리하지 못했습니다. 명반만 제공하며 해석을 생성하지 않습니다.",
    );
  }
  const westernBirth = {
    ...birthInput,
    ...solar,
    calendarType: "solar" as const,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    ...(dstFold ? { dstFold } : {}),
  };
  const natal = calculateNatalChart({
    localDateTime: `${solar.year}-${pad(solar.month)}-${pad(solar.day)}T${pad(birthInput.hour)}:${pad(birthInput.minute)}:00`,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    ...(dstFold ? { dstFold } : {}),
  });
  const synthesis = resolveWesternPersonalSynthesisForBirth(
    person.id,
    westernBirth,
  );
  const western =
    natal.ok && synthesis.ok
      ? {
          status: "calculated",
          chart: natal.chart,
          sections: buildWesternPersonalityReport(natal.chart).sections,
          synthesis: synthesis.report,
        }
      : {
          status: "unavailable",
          errors: !natal.ok
            ? natal.errors
            : !synthesis.ok
              ? synthesis.errors
              : [],
        };
  const sources = [
    ...adaptSajuPersonal(existing.saju, person.id),
    ...(existing.ziwei ? adaptZiweiPersonal(existing.ziwei, person.id) : []),
    ...(synthesis.ok ? adaptWesternPersonal(synthesis.report) : []),
  ];
  const integrated = buildIntegratedPersonalReport({
    personId: person.id,
    sources,
  });
  return {
    schemaVersion: "three-charts/v1",
    status:
      western.status === "calculated" && existing.ziwei
        ? "calculated"
        : "partial",
    algorithm: "existing-saju-app",
    engineVersion: "0.2.0-candidate",
    timeAudit: {
      saju: profile.timeAudit,
      ziwei: {
        basis: "original-civil",
        longitudeCorrectionApplied: false,
        ruleSet: zhongzhouV1,
      },
      western: { basis: "original-civil-to-utc", ...resolved },
      validation: {
        strengthYongshin: "rule-index-not-empirical-probability",
        ziweiSchoolSihuaPeriods: "independent-validation-pending",
        westernEphemerisHouses: "independent-validation-pending",
      },
    },
    warnings,
    input: { ...birthInput, location },
    solarDate: solar,
    lunarDate: profile.lunarDate,
    saju: {
      status: "calculated",
      pillars: profile.computedPillars,
      fiveElements: profile.fiveElementDistribution,
      timeCorrection: {
        applied: profile.isTimeCorrected,
        correctedTime: profile.correctedTime,
      },
      timeAudit: profile.timeAudit,
      sections: existing.saju,
    },
    ziwei: {
      status: existing.ziweiChart ? "calculated" : "unavailable",
      chart: existing.ziweiChart,
      report: existing.ziwei,
    },
    western,
    integrated,
    instructions:
      "미검증 경고가 있는 점수·용신·유파·천문력 항목은 검증 완료 또는 확정 해석으로 쓰지 않는다. 시진 경계 경고가 있으면 원본 날짜를 함께 이월해 ±5분 민감도 재계산을 수행하고 바뀐 항목만 비교한다. 계산값과 근거를 우선한다. 사주·자미두수·서양점성술을 각각 설명한 뒤 통합한다. 일치·차이·누락을 구분하고, 없는 계산값이나 사건·시기를 만들지 않는다. 출생정보는 서버에서 저장하지 않는다. 기존 앱의 자동 계산 기준이며 앱에서 수동 수정한 개인 설정은 포함하지 않는다.",
  };
}
