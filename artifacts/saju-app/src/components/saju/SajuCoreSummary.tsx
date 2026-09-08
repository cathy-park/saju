import { useEffect, useMemo, useState } from "react";
import type { SajuPipelineResult } from "@/lib/sajuPipeline";
import type { BranchRelation } from "@/lib/branchRelations";
import type { ShinsalInterpretationEntry } from "@/lib/shinsalInterpretation";
import { buildSajuSummarySections } from "@/lib/sajuSummaryFacts";
import { createPolishRequestCache } from "@/lib/prosePolish";
import { SajuSummaryBlock } from "@/components/saju/SajuSummaryUI";

const PROSE_TOPIC = "sajuSummary";

const requestPolishedTexts = createPolishRequestCache(PROSE_TOPIC);

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
  // facts는 이미 deterministic하게 완성돼 있고, AI는 자연어 표현만 다듬을 뿐 새 해석을
  // 추가하지 않는다(서버 프롬프트가 이미 강제).
  //
  // 이 페이지는 로그인 직후 auth↔DB 동기화가 끝나는 시점(useAuth의 dbSynced)에 상위에서
  // record 객체를 통째로 새로 만들어, 내용은 같아도 이 컴포넌트가 한 번 언마운트→재마운트된다
  // (실측: SajuReport.tsx 리렌더가 아니라 진짜 마운트/언마운트 사이클). useEffect는 마운트마다
  // 항상 한 번 실행되므로 내부 메모이제이션만으로는 막을 수 없어, 요청 자체를 모듈 스코프
  // 캐시(polishRequestCache, content key 기준)로 중복 제거한다 — 언마운트를 넘어 유지된다.
  // 1200ms 디바운스는 위 재마운트가 몰리는 짧은 구간 동안 화면이 깜빡이지 않도록 유지한다.
  const [polishedTexts, setPolishedTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      requestPolishedTexts(sections, sectionsContentKey).then((results) => {
        if (!cancelled) setPolishedTexts(results);
      });
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
    // sections 참조가 아니라 sectionsContentKey(내용)로만 재실행 여부를 판단한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsContentKey, personId]);

  return (
    <SajuSummaryBlock
      caption="원국 핵심 요약"
      polishedTexts={polishedTexts}
      sections={sections.map((s) => ({
        key: s.key, title: s.title, text: s.text, evidence: s.evidence, hasFacts: s.facts.length > 0,
      }))}
    />
  );
}
