import { useState } from "react";
import type { SajuEvidenceItem } from "@/lib/sajuSummaryFacts";

// 12단계 UI·요약 구조 정리 — 9/10/11단계가 각자 파일에 복붙해 두었던 evidence 토글 +
// 요약 카드 래퍼를 이 파일 하나로 합친다. 시각 스타일은 그대로(색상·타이포·카드 스타일
// 변경 없음), 중복 제거와 "fact 0개 섹션은 완전히 숨김" 동작 통일만 한다. 자미두수의
// EvidenceToggle과는 데이터 모양이 달라(confidence 필드 등) 억지로 합치지 않는다 — 사주
// 내부(원국/월운/궁합) 3곳끼리만 통일한다.

const CATEGORY_LABEL: Record<SajuEvidenceItem["category"], string> = {
  strength: "강약",
  gukguk: "격국",
  yongshin: "용신·희신",
  fiveElement: "오행",
  tenGod: "십성",
  interaction: "합충형파해원진",
  shinsal: "신살",
  ruleInsight: "규칙",
  natal: "원국",
  daewoon: "대운",
  saeun: "세운",
  wolun: "월운",
  compatScore: "궁합 점수",
  compatDetail: "궁합 세부",
  compatAxis: "배우자 구조축",
  compatMarriage: "결혼 관점",
};

function evidenceLabel(e: SajuEvidenceItem): string {
  return `[${CATEGORY_LABEL[e.category]}] ${e.label}`;
}

const PREVIEW_COUNT = 8;

/** 사주 전용 근거 토글(원국/월운/궁합 공통) — "[왜 이런 결과인가요?]" 클릭 시 원자료를
 * chip 형태로 보여준다. 이전에는 SajuCoreSummary.tsx에 있었으나 12단계에서 이 파일로
 * 옮겨 순환 참조 없이 세 요약 컴포넌트가 동일하게 재사용한다. */
export function SajuEvidenceToggle({ evidence }: { evidence: SajuEvidenceItem[] }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (evidence.length === 0) return null;

  const hasMore = evidence.length > PREVIEW_COUNT;
  const shown = showAll ? evidence : evidence.slice(0, PREVIEW_COUNT);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary underline underline-offset-2"
      >
        {open ? "근거 숨기기" : "[왜 이런 결과인가요?]"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {shown.map((e, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {evidenceLabel(e)}
              </span>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-[11px] font-semibold text-primary underline underline-offset-2"
            >
              {showAll
                ? `근거 ${evidence.length}개 · 전체 표시 — 접기`
                : `근거 ${evidence.length}개 · ${PREVIEW_COUNT}개 표시 — 전체보기`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 원국/월운/궁합 요약이 공통으로 넘기는 렌더용 섹션 모양 — 각자의 fact 타입(SajuFact/
 * SajuMonthlyFact/SajuCompatFact)은 다르지만 렌더에 필요한 건 이 4개뿐이라 여기서는
 * fact 타입 자체를 몰라도 된다. hasFacts는 호출부가 `section.facts.length > 0`으로
 *넘긴다 — 이 파일은 fact 배열을 직접 들여다보지 않는다(도메인 로직과 분리 유지). */
export interface SajuSummaryCardSection {
  key: string;
  title: string;
  text: string;
  evidence: SajuEvidenceItem[];
  hasFacts: boolean;
}

function SajuSummarySectionCard({ section, polishedText }: { section: SajuSummaryCardSection; polishedText?: string }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h3 className="text-base font-bold text-foreground">{section.title}</h3>
      {section.text ? (
        <>
          <p className="mt-2 text-sm text-foreground leading-relaxed">{polishedText ?? section.text}</p>
          <SajuEvidenceToggle evidence={section.evidence} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      )}
    </div>
  );
}

/** 원국/월운/궁합 3개 요약이 공유하는 바깥 래퍼 — fact가 있는 섹션만 카드로 보여주고,
 * 전부 0개면 캡션까지 포함해 전체를 숨긴다(대표 지시: 3곳 모두 동일하게). */
export function SajuSummaryBlock({
  caption, sections, polishedTexts,
}: {
  caption: string;
  sections: SajuSummaryCardSection[];
  polishedTexts: Record<string, string>;
}) {
  const visible = sections.filter((s) => s.hasFacts);
  if (visible.length === 0) return null;

  return (
    <div className="ds-stack-2">
      <p className="ds-caption font-semibold uppercase tracking-wide">{caption}</p>
      {visible.map((section) => (
        <SajuSummarySectionCard key={section.key} section={section} polishedText={polishedTexts[section.key]} />
      ))}
    </div>
  );
}
