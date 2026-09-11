import { analyzeEvidenceIndependence } from "./provenance.js";
import { personalitySources, romanceSources, synastrySources, transitSources } from "./sources.js";
import type { PersonalSynthesisInput, RelationshipSynthesisInput, SynthesisRelationKind, SynthesisSourceRef, WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport, WesternSynthesisFact, WesternSynthesisSection } from "./types.js";

const take = (refs: SynthesisSourceRef[], pattern: RegExp) => refs.find((ref) => pattern.test(ref.factId));
const compact = <T>(items: (T | null | undefined)[]): T[] => items.filter((item): item is T => !!item);
function makeFact(id: string, owner: string, meaning: string, relationKind: SynthesisRelationKind | undefined, baseRefs: SynthesisSourceRef[], transitRefs: SynthesisSourceRef[] = []): WesternSynthesisFact | null {
  if (!baseRefs.length && !transitRefs.length) return null;
  const independence = analyzeEvidenceIndependence(baseRefs);
  if (relationKind === "consensus" && !independence.independentConsensusEligible) return null;
  if (relationKind && relationKind !== "consensus" && baseRefs.length > 1 && !independence.allSourcesRetainUniqueEvidence) return null;
  return { id, meaning, relationKind, timing: { active: transitRefs.length > 0, transitFactIds: transitRefs.map((ref) => ref.factId).sort() }, sourceRefs: [...baseRefs.map((ref, index) => ({ ...ref, role: index ? "supporting" as const : "primary" as const })), ...transitRefs], independence, primaryOwnerSection: owner };
}
function section(key: string, title: string, facts: WesternSynthesisFact[], referencedFactIds: string[] = []): WesternSynthesisSection {
  return { key, title, text: facts.map((fact) => `${fact.meaning.replace(/[.!?]+$/, "")}.`).join(" "), facts, primarySourceRefs: facts.flatMap((fact) => fact.sourceRefs), referencedFactIds };
}
function timingFor(refs: SynthesisSourceRef[], facts: SynthesisSourceRef[]) {
  const ids = new Set(refs.map((ref) => `${ref.personId}:${ref.factId}`));
  return facts.filter((ref) => ref.linkedNatalFactIds?.some((id) => ids.has(id)));
}

export function buildWesternPersonalSynthesis(input: PersonalSynthesisInput): WesternPersonalSynthesisReport {
  const personality = personalitySources(input.personId, input.personality), romance = romanceSources(input.personId, input.romance), transit = transitSources(input.personId, input.transit);
  const coreRefs = compact([take(personality, /^core:identity$/), take(romance, /^relationship:attraction-style$/)]);
  const emotionRefs = compact([take(personality, /^emotion:/), take(romance, /^relationship:emotional-clarity$/)]);
  const actionRefs = compact([take(personality, /^action:/), take(personality, /^caution:venus:/)]);
  const strengthRefs = compact([take(personality, /^strength:/), take(romance, /^relationship:seventh-co-ruler$/)]);
  const core = compact([makeFact(`synthesis:${input.personId}:core`, "coreLife", "자기 기준을 세우는 방식과 관계에서 호감을 표현하는 방식 모두 각자의 개성을 지키면서 선택하려는 흐름을 보여줍니다", "consensus", coreRefs, timingFor(coreRefs, transit))]);
  const emotion = compact([makeFact(`synthesis:${input.personId}:emotion`, "emotionRelationship", "정서적 안전을 먼저 확인하는 성향에 상대의 분위기를 세심하게 읽는 관계 욕구가 더해져, 짐작과 실제 필요를 구분하는 과정이 중요합니다", "complement", emotionRefs, timingFor(emotionRefs, transit))]);
  const action = compact([makeFact(`synthesis:${input.personId}:action`, "workAction", "끝까지 밀어붙이는 추진력이 강하지만 좋아하는 방향과 당장 행동하려는 방향이 어긋날 수 있어, 힘을 쓸 범위와 속도를 함께 정해야 합니다", "tension", actionRefs, timingFor(actionRefs, transit))]);
  const strength = compact([makeFact(`synthesis:${input.personId}:strength`, "growth", "이상과 가능성을 생활에서 지속 가능한 구조로 바꾸는 힘이 관계의 안정 기준과도 연결됩니다", "complement", strengthRefs, timingFor(strengthRefs, transit))]);
  const usedTransit = new Set([...core, ...emotion, ...action, ...strength].flatMap((fact) => fact.timing.transitFactIds));
  const timingOnlyRefs = transit.filter((ref) => !usedTransit.has(ref.factId)).slice(0, 3);
  const timingOnly = compact(timingOnlyRefs.map((ref, index) => makeFact(`synthesis:${input.personId}:timing:${index}`, "currentFlow", "현재 기간에는 기존 상세 종합 fact와 직접 묶이지 않은 흐름도 별도의 timing activation으로 작동하고 있습니다", undefined, [], [ref])));
  const details = [section("coreLife", "핵심 성향과 삶의 방식", core), section("emotionRelationship", "감정·관계", emotion), section("workAction", "일·행동 방식", action), section("growth", "강점과 성장 포인트", strength), section("currentFlow", "현재 활성화된 흐름", timingOnly)];
  const overviewSources = details.flatMap((item) => item.facts).slice(0, 4);
  const overview = section("overview", "한눈에 보는 나", [{ id: `synthesis:${input.personId}:overview`, meaning: overviewSources.map((fact) => fact.meaning.replace(/[.!?]+$/, "")).join(". "), timing: { active: overviewSources.some((fact) => fact.timing.active), transitFactIds: [...new Set(overviewSources.flatMap((fact) => fact.timing.transitFactIds))].sort() }, sourceRefs: [], independence: analyzeEvidenceIndependence([]), primaryOwnerSection: "overview" }], overviewSources.map((fact) => fact.id));
  return { schemaVersion: "western-personal-synthesis/v1", personId: input.personId, sections: [overview, ...details] };
}

export function buildWesternRelationshipSynthesis(input: RelationshipSynthesisInput): WesternRelationshipSynthesisReport {
  const subjects = [input.first, input.second].sort((a, b) => a.personId.localeCompare(b.personId));
  const natal = new Map(subjects.map((subject) => [subject.personId, [...personalitySources(subject.personId, subject.personality), ...romanceSources(subject.personId, subject.romance)]]));
  const syn = synastrySources(input.synastry), used = new Set<string>();
  const synRef = (pattern: RegExp) => syn.find((ref) => !used.has(ref.factId) && pattern.test(ref.factId));
  const natalRef = (personId: string, pattern: RegExp) => natal.get(personId)?.find((ref) => !used.has(`${personId}:${ref.factId}`) && pattern.test(ref.factId));
  const anyNatalRef = (pattern: RegExp) => subjects.map((subject) => natalRef(subject.personId, pattern)).find(Boolean);
  const build = (id: string, owner: string, meaning: string, kind: SynthesisRelationKind, candidates: (SynthesisSourceRef | undefined)[]) => {
    const refs = compact(candidates); const fact = makeFact(`synthesis:${input.synastry.pairId}:${id}`, owner, meaning, kind, refs);
    if (fact) for (const ref of refs) ref.module === "synastry" ? used.add(ref.factId) : used.add(`${ref.personId}:${ref.factId}`);
    return compact([fact]);
  };
  const attraction = build("attraction", "attractionIntimacy", "두 차트의 호감과 욕구가 실제로 맞물리고, 각자가 관계에서 표현하는 애정 방식이 그 끌림의 속도와 경계를 구체화합니다", "complement", [synRef(/mars.*venus|venus.*mars/), natalRef(subjects[0].personId, /^relationship:affection-drive$/)]);
  const emotional = build("emotional", "emotionalCommunication", "두 사람 사이의 감정과 대화 통로는 각자의 정서적 안전 욕구를 말로 확인할 때 더 안정적으로 작동합니다", "complement", [synRef(/mercury.*moon|moon.*mercury/), natalRef(subjects[0].personId, /^relationship:emotional-safety$/), natalRef(subjects[1].personId, /^relationship:emotional-safety$/)]);
  const conflict = build("conflict", "conflictAdjustment", "두 사람의 행동 속도와 주도권이 부딪힐 수 있으며, 각자의 기존 갈등 대응 방식이 맞물리기 전에 멈출 기준을 합의할 필요가 있습니다", "tension", [synRef(/mars.*mars/), anyNatalRef(/^relationship:power-pacing$/)]);
  const longTerm = build("long-term", "longTerm", "책임과 행동을 연결하는 상호작용에 각자의 장기 관계 기준이 더해져, 역할과 생활 기반을 지속 가능한 형태로 조율하는 일이 핵심입니다", "complement", [synRef(/saturn.*mars|mars.*saturn/), natalRef(subjects[0].personId, /^relationship:seventh-ruler$/), natalRef(subjects[1].personId, /^relationship:seventh-ruler$/)]);
  const relationshipFacts = [...attraction, ...emotional, ...conflict, ...longTerm];
  const transit = subjects.flatMap((subject) => transitSources(subject.personId, subject.transit));
  const currentFacts = transit.flatMap((transitRef, index) => {
    const activated = relationshipFacts.filter((fact) => fact.sourceRefs.some((ref) => ref.module === "synastry" && ref.linkedNatalFactIds?.some((id) => transitRef.linkedNatalFactIds?.includes(id)))).slice(0, 1);
    if (!activated.length) return [];
    const fact = makeFact(`synthesis:${input.synastry.pairId}:timing:${index}`, "currentFlow", "현재의 개인 흐름이 두 차트 사이에서 이미 확인된 관계 구조를 직접 활성화하고 있습니다", undefined, [], [transitRef]);
    if (!fact) return [];
    fact.timing.activatedSynthesisFactIds = activated.map((item) => item.id).sort();
    return [fact];
  }).slice(0, 3);
  const details = [section("attractionIntimacy", "끌림과 친밀감", attraction), section("emotionalCommunication", "감정·소통", emotional), section("conflictAdjustment", "갈등과 조율", conflict), section("longTerm", "장기 지속 구조", longTerm), section("currentFlow", "현재 관계 흐름", currentFacts)];
  const overviewSources = details.flatMap((item) => item.facts).slice(0, 4);
  const overview = section("overview", "관계의 핵심 구조", [{ id: `synthesis:${input.synastry.pairId}:overview`, meaning: overviewSources.map((fact) => fact.meaning.replace(/[.!?]+$/, "")).join(". "), timing: { active: false, transitFactIds: [] }, sourceRefs: [], independence: analyzeEvidenceIndependence([]), primaryOwnerSection: "overview" }], overviewSources.map((fact) => fact.id));
  return { schemaVersion: "western-relationship-synthesis/v1", pairId: input.synastry.pairId, sections: [overview, ...details] };
}
