import { useEffect, useMemo, useState } from "react";
import type { SajuPipelineResult } from "@/lib/sajuPipeline";
import type { BranchRelation } from "@/lib/branchRelations";
import type { ShinsalInterpretationEntry } from "@/lib/shinsalInterpretation";
import { buildSajuSummarySections, type SajuEvidenceItem, type SajuSummarySection } from "@/lib/sajuSummaryFacts";
import { polishStatementText } from "@/lib/prosePolish";

const PROSE_TOPIC = "sajuSummary";

const CATEGORY_LABEL: Record<SajuEvidenceItem["category"], string> = {
  strength: "강약",
  gukguk: "격국",
  yongshin: "용신·희신",
  fiveElement: "오행",
  tenGod: "십성",
  interaction: "합충형파해원진",
  shinsal: "신살",
  ruleInsight: "규칙",
};

function evidenceLabel(e: SajuEvidenceItem): string {
  return `[${CATEGORY_LABEL[e.category]}] ${e.label}`;
}

const PREVIEW_COUNT = 8;

/** 사주 전용 근거 토글 — 자미두수의 EvidenceToggle과 UI 톤은 맞추되, saju 쪽 evidence
 * 타입(SajuEvidenceItem)을 직접 쓴다(계산·타입 모두 자미두수 모듈에 의존하지 않기 위함 —
 * 12단계 UI 대정리 때 공용 컴포넌트로 합칠 수 있다). */
function SajuEvidenceToggle({ evidence }: { evidence: SajuEvidenceItem[] }) {
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

function SectionCard({ section, polishedText }: { section: SajuSummarySection; polishedText?: string }) {
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

export function SajuCoreSummary({
  personId, pipeline, branchRelations, shinsalEntries,
}: {
  personId: string;
  pipeline: SajuPipelineResult;
  branchRelations: BranchRelation[];
  shinsalEntries: ShinsalInterpretationEntry[];
}) {
  const sections = useMemo(
    () => buildSajuSummarySections(pipeline, branchRelations, shinsalEntries),
    [pipeline, branchRelations, shinsalEntries],
  );

  // sections는 pipeline/branchRelations 등 상위 참조가 바뀔 때마다(같은 세운·월운을
  // 다시 계산하는 등 실제 fact 내용은 그대로여도) 새 객체로 만들어진다. AI 호출 여부는
  // 객체 참조가 아니라 "실제 fact 내용"으로 판단해야, 상위 상태(selectedSeunYear 등)가
  // 흔들려도 같은 문장에 대해 재호출하지 않는다. section.text는 이미 facts로만 결정되는
  // deterministic 문자열이므로, 이를 그대로 이어붙인 문자열을 content key로 쓴다.
  const sectionsContentKey = useMemo(
    () => sections.map((s) => `${s.key}:${s.text}`).join("|"),
    [sections],
  );

  // AI 문장 다듬기 — 자미두수와 동일한 공통 구조(polishStatementText, sourceHash 캐시) 재사용.
  // 섹션당 정확히 1회, 총 6회만 호출한다. facts는 이미 deterministic하게 완성돼 있고, AI는
  // 자연어 표현만 다듬을 뿐 새 해석을 추가하지 않는다(서버 프롬프트가 이미 강제).
  // 원국 페이지는 초기 로드 중 여러 비동기 계산이 순차 완료되며 sections가 잠깐씩 여러 번
  // 바뀔 수 있어, 값이 안정된 뒤(1200ms 무변동) 한 번만 호출하도록 디바운스한다.
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setPolishedTexts({});
      for (const section of sections) {
        if (section.facts.length === 0) continue;
        polishStatementText(section.facts, section.text, PROSE_TOPIC, section.key).then((result) => {
          if (cancelled || result.source === "fallback") return;
          setPolishedTexts((prev) => ({ ...prev, [section.key]: result.text }));
        });
      }
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
    // sections 참조가 아니라 sectionsContentKey(내용)로만 재실행 여부를 판단한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsContentKey, personId]);

  return (
    <div className="ds-stack-2">
      <p className="ds-caption font-semibold uppercase tracking-wide">원국 핵심 요약</p>
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} polishedText={polishedTexts[section.key]} />
      ))}
    </div>
  );
}
