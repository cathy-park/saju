import type { IntegratedReport } from "./types";
import { supabase } from "../supabase";
import { SHARED_PROSE_PROMPT_VERSION, INTEGRATED_HOLISTIC_PROMPT_VERSION } from "../prosePromptVersion";

/** api/polish-prose.ts의 공유 프롬프트를 바꿀 때마다 올려야 하는 값은 이제
 * src/lib/prosePromptVersion.ts(SHARED_PROSE_PROMPT_VERSION) 하나뿐이다 — 사주·자미두수·
 * 서양점성술과 같은 상수를 그대로 재노출한다(21단계, 캐시 버전 드리프트 방지). */
export const INTEGRATED_PROMPT_VERSION = SHARED_PROSE_PROMPT_VERSION;
export interface IntegratedRawPromptParts { saju: string; ziwei: string; western: string }
export function buildIntegratedCopyPrompt(parts: IntegratedRawPromptParts): string {
  return ["아래는 한 사람에 대해 계산된 사주, 자미두수, 서양점성술의 원자료입니다.", "", "각 체계를 따로 요약하는 데서 끝내지 말고, 세 체계가 공통으로 말하는 성향, 서로 보완되는 부분, 서로 다르게 보이는 부분을 함께 검토해서 이 사람을 하나의 사람으로 이해할 수 있도록 종합적으로 해석해주세요.", "", "성격, 감정 처리, 관계, 연애·배우자, 일·커리어, 재물, 강점과 약점, 현재 시기의 흐름을 연결해서 설명해주세요.", "", "제공된 계산 결과 밖의 별·궁·aspect·십성·사화 등을 임의로 만들어내지 마세요.", "", "# 1. 사주", parts.saju, "", "# 2. 자미두수", parts.ziwei, "", "# 3. 서양점성술", parts.western].join("\n");
}

export async function polishIntegratedSection(report: IntegratedReport, sectionKey: string, deterministicText: string) {
  const section = report.sections.find((item) => item.key === sectionKey);
  if (!section?.facts.length || !deterministicText) return deterministicText;
  try {
    const { data: { session } } = await supabase.auth.getSession(); if (!session?.access_token) return deterministicText;
    const response = await fetch("/api/polish-prose", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ facts: section.facts.map((fact) => ({ domain: fact.theme, meaning: fact.meaning, polarity: "neutral", relationKind: fact.relationKind, sourceSystems: fact.sourceSystems, provenanceLabels: fact.sources.flatMap((source) => source.evidence.map((item) => item.label)).slice(0, 20), timing: report.timingConvergences.filter((timing) => timing.theme === fact.theme).map((timing) => timing.meaning).join(" ") })), deterministicText, topic: `integrated-${report.scope}`, sectionKey, promptVersion: INTEGRATED_PROMPT_VERSION }) });
    if (!response.ok) return deterministicText; const data = await response.json() as { prose?: string }; return data.prose?.trim() || deterministicText;
  } catch { return deterministicText; }
}

/** 21단계 — "종합" 화면을 각 섹션을 개별로 다듬는 수준을 넘어, 리포트 전체를 하나의 사람/
 * 관계를 설명하는 상담문으로 통합하는 AI holistic 레이어. 20단계 deterministic synthesis
 * (consensus/complement/tension 판정, provenance)는 그대로 유지하고 이 함수의 입력으로만
 * 쓴다 — api/integrated-holistic.ts가 새 계산·사건 예측·임의 점수 생성을 프롬프트로 강하게
 * 금지한다. AI 실패/미로그인 시 기존 deterministic 개요 문장으로 그대로 fallback한다. */
export function buildHolisticDeterministicText(report: IntegratedReport): string {
  const overviewKey = report.scope === "personal" ? "overview" : "relationshipCore";
  return report.sections.find((section) => section.key === overviewKey)?.text
    || report.sections.map((section) => section.text).filter(Boolean).join(" ");
}

export async function polishIntegratedHolistic(report: IntegratedReport): Promise<string> {
  const deterministicText = buildHolisticDeterministicText(report);
  const facts = report.sections.flatMap((section) => section.facts).map((fact) => ({
    theme: fact.theme, concept: fact.concept, meaning: fact.meaning,
    relationKind: fact.relationKind, sourceSystems: fact.sourceSystems,
    sources: fact.sources.map((source) => ({ system: source.system, module: source.module, meaning: source.meaning, evidenceLabels: source.evidence.map((item) => item.label) })),
  }));
  if (facts.length === 0 || !deterministicText) return deterministicText;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return deterministicText;
    const response = await fetch("/api/integrated-holistic", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        scope: report.scope,
        availableSystems: report.availableSystems,
        missingSystems: report.missingSystems,
        facts,
        timingConvergences: report.timingConvergences.map((t) => ({ theme: t.theme, meaning: t.meaning })),
        deterministicText,
        sectionKey: report.subjectId,
        promptVersion: INTEGRATED_HOLISTIC_PROMPT_VERSION,
      }),
    });
    if (!response.ok) return deterministicText;
    const data = await response.json() as { prose?: string };
    return data.prose?.trim() || deterministicText;
  } catch {
    return deterministicText;
  }
}
