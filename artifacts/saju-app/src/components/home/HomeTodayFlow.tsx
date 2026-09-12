// 홈 "오늘 나의 흐름" — 21단계 대표 지시로 기존 사주 전용 "오늘의 운세"를 사주/자미두수/
// 서양점성술/종합 4개 탭으로 확장한다. 새 운세 계산 로직은 전혀 만들지 않는다 — 각 탭은
// 이미 존재하는 계산 결과만 가져와 2~4개 핵심 문장 + 짧은 설명 + "자세히 보기"로 압축한다.
//   - 사주: Home.tsx가 이미 계산해 둔 fortune/lifeFlow(오늘의 운세)를 그대로 재사용.
//   - 자미두수: comprehensiveReport.ts의 "현재 삶의 중심축"(身宮·현재 大限·올해 결혼시기
//     신호만 읽는 기존 섹션)을 그대로 재사용 — 새 판정 기준 없음.
//   - 서양점성술: /api/western-overview(이번 달 range로 조회)가 이미 계산해 둔
//     fact.timing.active(그 기간에 실제 트랜짓으로 활성화된 fact)만 필터링한다 — 트랜짓
//     엔진을 새로 호출하지 않고, 이미 계산된 신호를 고르기만 한다.
//   - 종합: integrated/report.ts의 timingConvergences(체계 간 겹치는 시기)를 우선 쓰고,
//     이번 달 기준으로 겹치는 시기 신호가 없으면 이미 계산된 "한눈에 보는 나"(overview)
//     섹션으로 대체한다. 종합 가능한 체계가 2개 미만이면 그 사실을 그대로 안내한다.
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { PersonRecord } from "@/lib/storage";
import type { TodayFortuneData } from "@/lib/todayFortune";
import type { LifeFlowInsightResult } from "@/lib/lifeFlowInsight";
import { buildExistingPersonalReports } from "@/lib/integrated/personReports";
import {
  adaptSajuPersonal, adaptWesternPersonal, adaptZiweiPersonal,
  buildIntegratedPersonalReport, type IntegratedReport,
} from "@/lib/integrated";
import { monthInTimezone, monthRange, westernBirthSource } from "@/lib/western/uiModel";
import type { WesternPersonalSynthesisReport } from "@/lib/western/synthesis";
import { SystemSelector } from "@/components/SystemSelector";

type FlowTabKey = "synthesis" | "saju" | "ziwei" | "western";

interface FlowContent {
  /** 각 탭의 짧은 설명(1줄) — 고정 문구, AI 생성 아님. */
  caption: string;
  /** 핵심 흐름 2~4개 — fact.meaning만 사용(원시 근거·전문용어 노출 없음). */
  bullets: string[];
  /** 표시할 데이터 자체가 없을 때(체계 미보유 등)의 안내문. bullets가 비어 있을 때만 쓴다. */
  emptyNote?: string;
  detailHref: string;
  detailLabel: string;
  /** 상세 보기 이동 직전에 실행 — 사주 탭은 "오늘운세" 탭으로 바로 열리도록 sessionStorage에
   * 표시를 남긴다(기존 Home 대시보드의 goToTodayFortune()과 동일한 계약). */
  onNavigate?: () => void;
}

function buildSajuFlow(fortune: TodayFortuneData, lifeFlow: LifeFlowInsightResult | null): FlowContent {
  const bullets = [
    fortune.guidance,
    lifeFlow?.overall.emotional,
    lifeFlow?.overall.decisionTiming,
    lifeFlow?.overall.activityFlow,
  ].filter((v): v is string => !!v && v.trim().length > 0).slice(0, 4);
  return {
    caption: "오늘의 일진과 대운·세운·월운·일운을 반영한 흐름입니다.",
    bullets,
    detailHref: "/saju",
    detailLabel: "사주 리포트 자세히 보기",
    onNavigate: () => sessionStorage.setItem("openReportTab", "오늘운세"),
  };
}

function buildZiweiFlow(existing: ReturnType<typeof buildExistingPersonalReports>, personId: string): FlowContent {
  const currentFocus = existing.ziwei?.sections.find((section) => section.key === "currentFocus");
  const bullets = (currentFocus?.facts ?? []).map((fact) => fact.meaning).slice(0, 4);
  return {
    caption: "지금 이어지는 대한과 올해 신호를 반영한 흐름입니다.",
    bullets,
    emptyNote: existing.ziwei
      ? "지금 뚜렷하게 말할 수 있는 신호가 없습니다."
      : "출생 시간이 없어 자미두수 흐름을 볼 수 없습니다. 출생 시간을 입력하면 볼 수 있어요.",
    detailHref: `/ziwei/${personId}/overview`,
    detailLabel: "자미두수 종합 리포트 자세히 보기",
  };
}

function buildWesternFlow(
  westernReport: WesternPersonalSynthesisReport | null,
  hasLocation: boolean,
  personId: string,
): FlowContent {
  const activeMeanings = westernReport
    ? [...new Set(
        westernReport.sections.flatMap((section) => section.facts.filter((fact) => fact.timing.active).map((fact) => fact.meaning)),
      )]
    : [];
  return {
    caption: "이번 달 실제로 활성화된 트랜짓을 반영한 흐름입니다.",
    bullets: activeMeanings.slice(0, 4),
    emptyNote: hasLocation
      ? "이번 달에는 뚜렷하게 겹치는 트랜짓 신호가 없습니다."
      : "서양점성술 위치 정보가 없어 이 흐름을 볼 수 없습니다. 위치를 설정하면 볼 수 있어요.",
    detailHref: hasLocation ? `/western/${personId}/transit` : `/western/${personId}/location`,
    detailLabel: hasLocation ? "서양점성술 시기운 자세히 보기" : "위치 설정하러 가기",
  };
}

function buildIntegratedFlow(report: IntegratedReport | null, personId: string): FlowContent {
  const detailHref = `/integrated/${personId}/overview`;
  if (!report) {
    return { caption: "여러 체계를 종합하고 있습니다.", bullets: [], detailHref, detailLabel: "종합 리포트 자세히 보기" };
  }
  if (report.availableSystems.length < 2) {
    return {
      caption: "여러 체계를 함께 볼 때 종합할 수 있습니다.",
      bullets: [],
      emptyNote: "지금은 한 체계만 확인할 수 있어 종합 흐름을 만들 수 없습니다. 다른 체계도 채우면 종합 흐름을 볼 수 있어요.",
      detailHref, detailLabel: "종합 리포트 자세히 보기",
    };
  }
  const convergenceBullets = report.timingConvergences.map((t) => t.meaning).slice(0, 4);
  if (convergenceBullets.length > 0) {
    return {
      caption: "여러 체계에서 지금 함께 확인되는 흐름입니다.",
      bullets: convergenceBullets,
      detailHref, detailLabel: "종합 리포트 자세히 보기",
    };
  }
  // synthesisMeaning()의 "정확도·확률 상승이 아니다" 같은 부연 문장은 여러 fact에서 똑같이
  // 반복되는 경우가 많다 — 문장 단위로 쪼갠 뒤 완전히 같은 문장은 한 번만 남긴다(새 문구를
  // 만들지 않고, 이미 있는 overview.text를 홈에 압축해 보여주는 중이므로 중복 제거만 한다).
  const overview = report.sections.find((section) => section.key === "overview");
  const seenSentences = new Set<string>();
  const overviewBullets = (overview?.text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || seenSentences.has(s)) return false;
      seenSentences.add(s);
      return true;
    })
    .slice(0, 4);
  return {
    caption: "지금 시점에 겹치는 신호 대신, 체계 간 공통적으로 확인되는 핵심을 보여드려요.",
    bullets: overviewBullets,
    emptyNote: overviewBullets.length === 0 ? "지금 종합해서 보여드릴 만한 근거가 부족합니다." : undefined,
    detailHref, detailLabel: "종합 리포트 자세히 보기",
  };
}

function FlowCard({ content, missingSystems }: { content: FlowContent; missingSystems?: string[] }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <p className="text-xs text-muted-foreground">{content.caption}</p>
      {missingSystems && missingSystems.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground/80">부족한 체계: {missingSystems.join(", ")}</p>
      )}
      {content.bullets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {content.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{content.emptyNote ?? "표시할 흐름이 없습니다."}</p>
      )}
      <Link
        href={content.detailHref}
        onClick={content.onNavigate}
        className="mt-4 block text-right text-xs font-semibold text-primary underline underline-offset-2"
      >
        {content.detailLabel} →
      </Link>
    </div>
  );
}

const SYSTEM_LABEL: Record<string, string> = { saju: "사주", ziwei: "자미두수", western: "서양점성술" };

export function HomeTodayFlow({
  record, fortune, lifeFlow,
}: {
  record: PersonRecord;
  fortune: TodayFortuneData;
  lifeFlow: LifeFlowInsightResult | null;
}) {
  const [tab, setTab] = useState<FlowTabKey>("synthesis");
  const [westernReport, setWesternReport] = useState<WesternPersonalSynthesisReport | null>(null);
  const [integratedReport, setIntegratedReport] = useState<IntegratedReport | null>(null);

  // 자미두수(existing.ziwei)는 동기 계산이라 렌더 시 바로 필요하지만, 값 자체는 record.id가
  // 바뀔 때만 다시 계산하면 되므로 useMemo로 재계산 낭비를 막는다.
  const existing = useMemo(() => buildExistingPersonalReports(record), [record.id]);

  useEffect(() => {
    let cancelled = false;
    const hasLocation = !!record.westernLocation;
    const timezone = record.westernLocation?.timezone;
    const month = timezone ? monthInTimezone(timezone) : monthInTimezone("Asia/Seoul");
    const range = monthRange(month);
    const scope = { start: range.start, end: range.end, timezone: timezone ?? "Asia/Seoul", granularity: "month" as const, sourcePeriodLabel: month };

    const sajuSources = adaptSajuPersonal(existing.saju, record.id);
    const ziweiSources = existing.ziwei ? adaptZiweiPersonal(existing.ziwei, record.id) : [];

    function finish(western: WesternPersonalSynthesisReport | null) {
      if (cancelled) return;
      setWesternReport(western);
      const westernSources = western ? adaptWesternPersonal(western, scope) : [];
      setIntegratedReport(buildIntegratedPersonalReport({
        personId: record.id,
        sources: [...sajuSources, ...ziweiSources, ...westernSources],
        selectedPeriod: { start: scope.start, end: scope.end, timezone: scope.timezone },
      }));
    }

    if (!hasLocation) { finish(null); return () => { cancelled = true; }; }
    const birth = westernBirthSource(record);
    fetch("/api/western-overview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: record.id, birth, query: { startLocalDate: range.start, endLocalDate: range.end, timezone: birth.timezone } }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { report: WesternPersonalSynthesisReport }) => finish(data.report))
      .catch(() => finish(null));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.westernLocation?.timezone]);

  const content: FlowContent = tab === "saju"
    ? buildSajuFlow(fortune, lifeFlow)
    : tab === "ziwei"
    ? buildZiweiFlow(existing, record.id)
    : tab === "western"
    ? buildWesternFlow(westernReport, !!record.westernLocation, record.id)
    : buildIntegratedFlow(integratedReport, record.id);

  const missingSystems = tab === "synthesis" && integratedReport
    ? integratedReport.missingSystems.map((s) => SYSTEM_LABEL[s] ?? s)
    : undefined;

  return (
    <div className="ds-stack-3">
      <SystemSelector personId={record.id} sajuHref="/saju" activeKey={tab} onSelect={(key) => setTab(key as FlowTabKey)} />
      <FlowCard content={content} missingSystems={missingSystems} />
    </div>
  );
}
