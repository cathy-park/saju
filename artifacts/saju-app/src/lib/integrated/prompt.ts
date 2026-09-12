import type { IntegratedReport } from "./types";
import { supabase } from "../supabase";
import { SHARED_PROSE_PROMPT_VERSION, INTEGRATED_HOLISTIC_PROMPT_VERSION } from "../prosePromptVersion";

/** api/polish-prose.ts의 공유 프롬프트를 바꿀 때마다 올려야 하는 값은 이제
 * src/lib/prosePromptVersion.ts(SHARED_PROSE_PROMPT_VERSION) 하나뿐이다 — 사주·자미두수·
 * 서양점성술과 같은 상수를 그대로 재노출한다(21단계, 캐시 버전 드리프트 방지). */
export const INTEGRATED_PROMPT_VERSION = SHARED_PROSE_PROMPT_VERSION;
export function buildIntegratedCopyPrompt(report: IntegratedReport): string {
  const facts = report.sections.flatMap((section) => section.facts.map((fact) => ({ section: section.title, meaning: fact.meaning, relationKind: fact.relationKind, sourceSystems: fact.sourceSystems, provenance: fact.sources.map((source) => ({ system: source.system, module: source.module, factId: source.factId, evidenceLabels: source.evidence.map((item) => item.label), role: source.evidenceRole })) })));
  return JSON.stringify({ instruction: "아래 확정 synthesis fact만 자연스러운 상담문으로 표현하세요. 새로운 계산, 점수, 사건 예측, 사주·자미두수·점성술 판단을 추가하지 마세요.", promptVersion: INTEGRATED_PROMPT_VERSION, scope: report.scope, sourceSystems: report.availableSystems, missingSystems: report.missingSystems, synthesisFacts: facts, timingConvergences: report.timingConvergences }, null, 2);
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
