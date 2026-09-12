import type { IntegratedReport } from "./types";
import { supabase } from "../supabase";
import { SHARED_PROSE_PROMPT_VERSION, INTEGRATED_HOLISTIC_PROMPT_VERSION } from "../prosePromptVersion";
import { areasForScope } from "./areas";
import { buildDeterministicPresentedAreas, isUserFacingInterpretation } from "./presentation";

const holisticInFlight = new Map<string, Promise<unknown>>();
const holisticCompleted = new Map<string, unknown>();

/** Module-scope single-flight: React unmount/remount 사이에도 동일 요청 Promise를 재사용한다.
 *
 * 중요: key 계산과 이 함수 호출 사이에 어떤 await도 있으면 안 된다. 호출부(예전 버전의
 * polishIntegratedHolistic)가 `await supabase.auth.getSession()`을 먼저 하고 나서야 이
 * 함수를 불렀는데, 그 await 지점에서 두 번째 호출이 끼어들면 둘 다 아직 Map에 아무것도
 * 없는 상태로 통과해 동시에 request()를 두 번 실행하는 레이스가 있었다(production에서
 * 실제로 동일 key로 /api/integrated-holistic이 거의 동시에 2번 호출되는 것을 확인). 그래서
 * 이 함수 자체는 완전히 동기적이고(Map 조회·설정 사이에 await 없음), session 조회처럼 진짜
 * 비동기인 작업은 반드시 `request` 콜백 "안"에서 하도록 호출부를 고쳤다 — key는 그 전에
 * 동기적으로 다 계산해 넘긴다. */
export function runHolisticSingleFlight<T>(key: string, request: () => Promise<T>): Promise<T> {
  if (holisticCompleted.has(key)) return Promise.resolve(holisticCompleted.get(key) as T);
  const active = holisticInFlight.get(key);
  if (active) return active as Promise<T>;
  const promise = request().then((result) => {
    holisticCompleted.set(key, result);
    if (holisticCompleted.size > 50) holisticCompleted.delete(holisticCompleted.keys().next().value!);
    return result;
  }).finally(() => holisticInFlight.delete(key));
  holisticInFlight.set(key, promise);
  return promise;
}

/** api/polish-prose.ts의 공유 프롬프트를 바꿀 때마다 올려야 하는 값은 이제
 * src/lib/prosePromptVersion.ts(SHARED_PROSE_PROMPT_VERSION) 하나뿐이다 — 사주·자미두수·
 * 서양점성술과 같은 상수를 그대로 재노출한다(21단계, 캐시 버전 드리프트 방지). */
export const INTEGRATED_PROMPT_VERSION = SHARED_PROSE_PROMPT_VERSION;
export interface IntegratedRawPromptParts { saju: string; ziwei: string; western: string }
export function buildIntegratedCopyPrompt(parts: IntegratedRawPromptParts): string {
  return ["아래는 한 사람에 대해 계산된 사주, 자미두수, 서양점성술의 원자료입니다.", "", "각 체계를 따로 요약하는 데서 끝내지 말고, 세 체계가 공통으로 말하는 성향, 서로 보완되는 부분, 서로 다르게 보이는 부분을 함께 검토해서 이 사람을 하나의 사람으로 이해할 수 있도록 종합적으로 해석해주세요.", "", "성격, 감정 처리, 관계, 연애·배우자, 일·커리어, 재물, 강점과 약점, 현재 시기의 흐름을 연결해서 설명해주세요.", "", "제공된 계산 결과 밖의 별·궁·aspect·십성·사화 등을 임의로 만들어내지 마세요.", "", "# 1. 사주", parts.saju, "", "# 2. 자미두수", parts.ziwei, "", "# 3. 서양점성술", parts.western].join("\n");
}
export function buildIntegratedRelationshipCopyPrompt(parts: IntegratedRawPromptParts): string {
  return ["아래는 두 사람에 대해 계산된 사주, 자미두수, 서양점성술 관계 원자료입니다.", "", "각 체계를 따로 나열하는 데서 끝내지 말고 관계의 핵심, 감정·애착, 대화·갈등, 끌림·친밀감, 결혼·장기 지속성, 현실·생활 궁합을 연결해 상담해주세요.", "", "제공된 계산 결과 밖의 별·궁·aspect·십성·사화나 사건을 만들지 마세요.", "", "# 1. 두 사람 사주와 사주 궁합", parts.saju, "", "# 2. 두 사람 자미두수 관계 구조", parts.ziwei, "", "# 3. 두 사람 Western natal과 synastry", parts.western].join("\n");
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
  return buildDeterministicPresentedAreas(report)[0]?.text ?? "";
}

export interface HolisticArea { key: string; title: string; text: string }

/** 서버가 돌려준 {key,text}만으로는 화면에 쓸 제목·순서가 없다 — 항상 areas.ts의 고정
 * 목록(canonical) 순서·제목을 기준으로 다시 정렬한다. 서버가 이미 허용된 key만 필터링해
 * 보내지만, 클라이언트에서도 한 번 더 걸러 방어한다(모르는 key·중복 key 무시). */
function toOrderedAreas(scope: IntegratedReport["scope"], raw: { key: string; text: string }[]): HolisticArea[] {
  const byKey = new Map<string, string>();
  for (const item of raw) if (item?.key && item.text && !byKey.has(item.key)) byKey.set(item.key, item.text);
  return areasForScope(scope)
    .filter((def) => byKey.has(def.key))
    .map((def) => ({ key: def.key, title: def.title, text: byKey.get(def.key)! }));
}

/** 21단계 — "종합" 화면을 각 섹션을 개별로 다듬는 수준을 넘어, 리포트 전체를 고정된 7개
 * 다면 영역(areas.ts)으로 통합하는 AI holistic 레이어. 20단계 deterministic synthesis
 * (consensus/complement/tension 판정, provenance)는 그대로 유지하고 이 함수의 입력으로만
 * 쓴다 — api/integrated-holistic.ts가 새 계산·사건 예측·임의 점수 생성을 프롬프트로 강하게
 * 금지한다. AI 실패/미로그인/근거 부족 시 기존 deterministic 개요 문장 1개짜리 영역으로
 * fallback한다(7개를 억지로 채우지 않는다). */
export async function polishIntegratedHolistic(report: IntegratedReport): Promise<HolisticArea[]> {
  const deterministicText = buildHolisticDeterministicText(report);
  const fallback: HolisticArea[] = buildDeterministicPresentedAreas(report);
  const facts = report.sections.flatMap((section) => section.facts).map((fact) => ({
    theme: fact.theme, concept: fact.concept, meaning: fact.meaning,
    relationKind: fact.relationKind, sourceSystems: fact.sourceSystems,
    sources: fact.sources.map((source) => ({ system: source.system, module: source.module, meaning: source.meaning, evidenceLabels: source.evidence.map((item) => item.label), evidenceRole: source.evidenceRole })),
  }));
  const sourceFacts = report.standaloneFacts.map((source) => ({ theme: source.mapping.theme, concept: source.mapping.concept, meaning: source.meaning, system: source.system, module: source.module, evidenceLabels: source.evidence.map((item) => item.label), evidenceRole: source.evidenceRole }));
  if (facts.length === 0 && sourceFacts.length === 0) return fallback;

  const topic = `integrated-holistic-${report.scope}`;
  const sectionKey = report.subjectId;
  const timing = report.timingConvergences.map((t) => ({ theme: t.theme, meaning: t.meaning }));
  // key는 report 내용만으로 "동기적으로" 계산한다 — session 조회(비동기)는 절대 이 앞에 두지
  // 않는다. session/user id를 key에 넣지 않는 이유: 클라이언트 single-flight는 브라우저 탭
  // 하나=사용자 한 명 범위라 필요 없고, 넣으려면 session await를 key 계산보다 먼저 해야 해서
  // 바로 그 지점에서 두 요청이 동시에 Map을 통과하는 레이스가 생긴다(21단계 회귀 원인).
  // 서로 다른 사람/다른 화면은 facts·timing·subjectId가 달라 key가 자동으로 달라진다.
  const sourceIdentity = [
    report.availableSystems.slice().sort().join(","),
    report.missingSystems.slice().sort().join(","),
    facts.map((f) => `${f.theme}|${f.concept}|${f.relationKind}|${f.sourceSystems.slice().sort().join(",")}|${f.meaning}|${f.sources.map((s) => `${s.system}:${s.module}:${s.evidenceRole}:${s.meaning}:${s.evidenceLabels.join(",")}`).sort().join(";")}`).sort().join("\n"),
    sourceFacts.map((f) => `${f.system}|${f.module}|${f.evidenceRole}|${f.theme}|${f.concept}|${f.meaning}|${f.evidenceLabels.join(",")}`).sort().join("\n"),
    timing.map((t) => `${t.theme}|${t.meaning}`).sort().join("\n"),
    deterministicText,
  ].join("\n---\n");
  const requestKey = [sourceIdentity, INTEGRATED_HOLISTIC_PROMPT_VERSION, topic, sectionKey].join("\n===\n");

  try {
    const raw = await runHolisticSingleFlight(requestKey, async () => {
      // 진짜 비동기 작업(로그인 세션 조회·네트워크 호출)은 전부 여기, single-flight가 이미
      // key를 등록한 "뒤"에서만 한다.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("not logged in");
      const response = await fetch("/api/integrated-holistic", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ scope: report.scope, availableSystems: report.availableSystems, missingSystems: report.missingSystems, facts, sourceFacts, timingConvergences: timing, deterministicText, sectionKey, promptVersion: INTEGRATED_HOLISTIC_PROMPT_VERSION }),
      });
      if (!response.ok) throw new Error(`AI holistic synthesis failed: ${response.status}`);
      const responseData = await response.json() as { areas?: { key: string; text: string }[] };
      if (!responseData.areas?.length) throw new Error("AI holistic synthesis returned no areas");
      return responseData.areas;
    });
    const ordered = toOrderedAreas(report.scope, raw);
    const safe = ordered.filter((area) => isUserFacingInterpretation(area.text));
    return safe.length > 0 ? safe : fallback;
  } catch {
    return fallback;
  }
}
