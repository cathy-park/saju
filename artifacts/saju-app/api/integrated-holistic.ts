// 종합("/integrated") 화면을 위한 AI holistic 통합 상담 생성(21단계 추가 지시, 이후
// 다면 구조 복원 지시로 갱신).
//
// api/polish-prose.ts는 "섹션 하나의 fact를 자연어로 다듬기"만 한다 — 이 함수는 그와 달리
// 리포트 전체(모든 섹션의 synthesis fact + provenance + 체계 간 시기 겹침)를 한 번에
// 넘겨받아, 고정된 7개 영역(src/lib/integrated/areas.ts) 중 실제 근거가 있는 영역만 골라
// 각각 서로 다른 관점의 상담 내용을 작성하게 한다. 7개를 억지로 다 채우지 않는다 — 근거가
// 없는 영역은 AI가 응답 배열에서 아예 빼도록 프롬프트로 명시한다.
//
// 20단계 deterministic synthesis(consensus/complement/tension 판정, provenance)는 이
// 함수의 "입력"일 뿐 절대 바꾸지 않는다 — AI는 그 판정 결과와 fact.meaning만 재료로 받고,
// 새 계산·새 사실(별자리 배치·궁·aspect·십성·사화 등)을 추가하거나 사건을 예측하거나 점수를
// 새로 만들 수 없다(프롬프트로 강하게 금지). consensus/complement/tension이라는 용어 자체도
// 화면에 노출되는 최종 글의 구조로 쓰지 않도록 명시적으로 지시한다.
//
// 인증·rate limit·캐시·서버 sourceHash 재계산 원칙은 api/polish-prose.ts와 동일하게
// ziwei_prose_requests_log / ziwei_prose_cache 테이블을 그대로 재사용한다(새 테이블·컬럼
// 없음 — areas 배열은 JSON 문자열로 기존 prose text 컬럼에 그대로 저장한다).
// topic을 "integrated-holistic-personal" / "integrated-holistic-relationship"로 구분해
// 기존 섹션별 polish 캐시(topic: "integrated-personal" 등)와 절대 섞이지 않게 한다.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_BODY_CHARS = 40_000;
const MAX_FACTS = 120;
const MAX_MEANING_LEN = 300;
const MAX_TEXT_LEN = 8_000;
const MAX_TIMING = 20;
const MAX_AREA_TEXT_LEN = 1_200;
const RATE_LIMIT_PER_MINUTE = 10;
const VALID_RELATION_KIND = new Set(["consensus", "complement", "tension"]);
const VALID_SCOPE = new Set(["personal", "relationship"]);
const VALID_SYSTEM = new Set(["saju", "ziwei", "western"]);

// src/lib/integrated/areas.ts와 내용을 그대로 맞춘 서버 전용 사본 — 원래는 그 파일 하나를
// import해서 공유하려 했으나, `await import("../src/lib/integrated/areas.js")`가 production
// 런타임에서 Error [ERR_REQUIRE_ESM]로 즉시 500을 냈다(2026-09-12 실제 확인 — saju-app/
// package.json이 "type":"module"이라 areas.js가 ESM으로 로드되는데, api/tsconfig.json의
// module:"commonjs" 출력이 그 dynamic import를 require()로 내려써서 충돌). 다른 api 파일들의
// `../src/lib/western/...` dynamic import는 우연히 그 파일들의 무거운 의존성 그래프 덕에
// 번들링 방식이 달라져 문제가 안 됐을 뿐, 일반적으로 안전하다고 보장된 패턴이 아니다. 이
// 파일은 그 위험을 피하려고 값을 그대로 복제한다 — 7개 영역 목록을 바꿀 때는 두 파일을
// 함께 고쳐야 한다(자주 바뀌는 목록이 아니라 드리프트 위험은 낮다고 판단).
const AREA_DEFS: Record<"personal" | "relationship", { key: string; title: string; hint: string }[]> = {
  personal: [
    { key: "coreNatureAndLife", title: "핵심 성향과 삶의 방식", hint: "전반적인 성격 구조와 삶을 대하는 태도" },
    { key: "emotionInner", title: "감정과 내면", hint: "감정 처리 방식, 불안/안정, 내적 갈등" },
    { key: "relationshipRomance", title: "관계·연애·배우자", hint: "친밀감, 관계 욕구, 갈등 방식, 배우자 기준" },
    { key: "careerWork", title: "일·커리어", hint: "추진 방식, 리더십, 조직/독립성, 성취 패턴" },
    { key: "wealthReality", title: "재물·현실 감각", hint: "돈을 다루는 방식, 축적/확장 성향, 현실 판단" },
    { key: "strengthWeaknessGrowth", title: "강점·약점·성장 포인트", hint: "반복되는 강점과 취약점, 보완 방향" },
    { key: "currentFlow", title: "현재 흐름", hint: "타고난(natal) 구조와 지금 시기(timing)가 어떻게 맞물리는지" },
  ],
  relationship: [
    { key: "relationshipCoreStructure", title: "관계의 핵심 구조", hint: "두 사람이 만나는 방식의 전반적인 골격" },
    { key: "emotionAttachment", title: "감정·애착", hint: "서로에게 느끼는 정서적 안정감과 애착 방식" },
    { key: "communicationConflict", title: "대화·갈등", hint: "대화 방식, 갈등이 생기고 풀리는 패턴" },
    { key: "attractionIntimacy", title: "끌림·친밀감", hint: "서로 끌리는 지점과 친밀감을 쌓는 방식" },
    { key: "longTermSustainability", title: "장기 지속성", hint: "관계를 오래 유지하는 데 영향을 주는 구조" },
    { key: "realityCompatibility", title: "현실·생활 궁합", hint: "생활 방식, 현실적인 조율이 필요한 지점" },
    { key: "currentRelationshipFlow", title: "현재 관계 흐름", hint: "지금 시기에 두 사람의 관계에 맞물리는 흐름" },
  ],
};

interface HolisticFactInput {
  theme: string;
  concept: string;
  meaning: string;
  relationKind: "consensus" | "complement" | "tension";
  sourceSystems: string[];
  sources: { system: string; module: string; meaning: string; evidenceLabels: string[] }[];
}
interface HolisticTimingInput {
  theme: string;
  meaning: string;
}
interface HolisticArea {
  key: string;
  text: string;
}

interface VercelLikeRequest { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface VercelLikeResponse { status: (code: number) => VercelLikeResponse; json: (body: unknown) => void }

function parseBody(req: VercelLikeRequest): { raw: string; parsed: unknown } {
  if (typeof req.body === "string") return { raw: req.body, parsed: JSON.parse(req.body || "{}") };
  const raw = JSON.stringify(req.body ?? {});
  return { raw, parsed: req.body ?? {} };
}

/** 모델이 코드블록(```json ... ```)이나 앞뒤 설명을 붙여 보내는 경우까지 방어적으로 처리한다
 * — 그래도 파싱이 안 되면 null을 반환해 호출부가 502로 처리하게 한다(새 문장을 지어내
 * 대체하지 않는다). */
function parseAreasResponse(raw: string): unknown[] | null {
  const attempts = [raw.trim()];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) attempts.push(braceMatch[0]);
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as { areas?: unknown };
      if (Array.isArray(parsed?.areas)) return parsed.areas;
    } catch {
      continue;
    }
  }
  return null;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) { res.status(500).json({ error: "Server not configured" }); return; }

  let raw: string; let parsed: unknown;
  try { ({ raw, parsed } = parseBody(req)); } catch { res.status(400).json({ error: "Invalid JSON body" }); return; }
  if (raw.length > MAX_BODY_CHARS) { res.status(400).json({ error: "Request body too large" }); return; }

  const body = parsed as {
    scope?: string;
    availableSystems?: string[];
    missingSystems?: string[];
    facts?: HolisticFactInput[];
    timingConvergences?: HolisticTimingInput[];
    deterministicText?: string;
    sectionKey?: string;
    promptVersion?: string;
  };
  const { scope, availableSystems, missingSystems, facts, timingConvergences, deterministicText, sectionKey, promptVersion } = body;

  if (typeof scope !== "string" || !VALID_SCOPE.has(scope)) { res.status(400).json({ error: "Invalid scope" }); return; }
  if (!Array.isArray(availableSystems) || availableSystems.some((s) => !VALID_SYSTEM.has(s))) { res.status(400).json({ error: "Invalid availableSystems" }); return; }
  if (!Array.isArray(missingSystems) || missingSystems.some((s) => !VALID_SYSTEM.has(s))) { res.status(400).json({ error: "Invalid missingSystems" }); return; }
  if (!Array.isArray(facts) || facts.length === 0 || facts.length > MAX_FACTS) { res.status(400).json({ error: "Invalid facts" }); return; }
  for (const f of facts) {
    if (!f || typeof f.meaning !== "string" || f.meaning.length === 0 || f.meaning.length > MAX_MEANING_LEN) { res.status(400).json({ error: "Invalid fact.meaning" }); return; }
    if (typeof f.theme !== "string" || f.theme.length > 100 || typeof f.concept !== "string" || f.concept.length > 100) { res.status(400).json({ error: "Invalid fact.theme/concept" }); return; }
    if (!VALID_RELATION_KIND.has(f.relationKind)) { res.status(400).json({ error: "Invalid fact.relationKind" }); return; }
    if (!Array.isArray(f.sourceSystems) || f.sourceSystems.length === 0 || f.sourceSystems.length > 3 || f.sourceSystems.some((s) => !VALID_SYSTEM.has(s))) { res.status(400).json({ error: "Invalid fact.sourceSystems" }); return; }
    if (!Array.isArray(f.sources) || f.sources.length === 0 || f.sources.length > 12 || f.sources.some((s) => !VALID_SYSTEM.has(s.system) || typeof s.module !== "string" || typeof s.meaning !== "string" || s.meaning.length > MAX_MEANING_LEN || !Array.isArray(s.evidenceLabels) || s.evidenceLabels.length > 20 || s.evidenceLabels.some((label) => typeof label !== "string" || label.length > 200))) { res.status(400).json({ error: "Invalid fact.sources" }); return; }
  }
  const timing = Array.isArray(timingConvergences) ? timingConvergences : [];
  if (timing.length > MAX_TIMING || timing.some((t) => !t || typeof t.meaning !== "string" || t.meaning.length > MAX_MEANING_LEN || typeof t.theme !== "string")) {
    res.status(400).json({ error: "Invalid timingConvergences" }); return;
  }
  if (typeof deterministicText !== "string" || deterministicText.length === 0 || deterministicText.length > MAX_TEXT_LEN) { res.status(400).json({ error: "Invalid deterministicText" }); return; }
  if (typeof sectionKey !== "string" || !sectionKey || sectionKey.length > 50) { res.status(400).json({ error: "Invalid sectionKey" }); return; }
  if (typeof promptVersion !== "string" || !promptVersion || promptVersion.length > 20) { res.status(400).json({ error: "Invalid promptVersion" }); return; }

  const authHeader = req.headers.authorization ?? req.headers.Authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = authValue?.replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401).json({ error: "Missing auth token" }); return; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) { res.status(401).json({ error: "Invalid session" }); return; }
  const userId = userData.user.id;

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("ziwei_prose_requests_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("requested_at", oneMinuteAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) { res.status(429).json({ error: "Rate limit exceeded" }); return; }
  await supabase.from("ziwei_prose_requests_log").insert({ user_id: userId });

  const topic = `integrated-holistic-${scope}`;
  const normalized = [
    availableSystems.slice().sort().join(","),
    missingSystems.slice().sort().join(","),
    facts.map((f) => `${f.theme}|${f.concept}|${f.relationKind}|${f.sourceSystems.slice().sort().join(",")}|${f.meaning}|${f.sources.map((s) => `${s.system}:${s.module}:${s.meaning}:${s.evidenceLabels.join(",")}`).sort().join(";")}`).sort().join("\n"),
    timing.map((t) => `${t.theme}|${t.meaning}`).sort().join("\n"),
    deterministicText,
  ].join("\n---\n");
  const sourceHash = createHash("sha256").update(normalized).digest("hex");

  const { data: cached } = await supabase
    .from("ziwei_prose_cache")
    .select("prose")
    .eq("user_id", userId)
    .eq("source_hash", sourceHash)
    .eq("prompt_version", promptVersion)
    .eq("topic", topic)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (cached?.prose) { console.info("[prose-cache] hit", { topic, promptVersion, model: "gpt-5.6-sol" }); res.status(200).json({ areas: JSON.parse(cached.prose), cached: true }); return; }

  const areaDefs = AREA_DEFS[scope as "personal" | "relationship"];
  const allowedKeys = new Set(areaDefs.map((area) => area.key));

  const SYSTEM_LABEL: Record<string, string> = { saju: "사주", ziwei: "자미두수", western: "서양점성술" };
  const factLines = facts.map((f) => `- [${f.relationKind}] ${f.meaning}\n  확정 source: ${f.sources.map((s) => `${SYSTEM_LABEL[s.system]} ${s.meaning}${s.evidenceLabels.length ? ` (근거: ${s.evidenceLabels.join(", ")})` : ""}`).join(" / ")}`).join("\n");
  const timingLines = timing.map((t) => `- ${t.meaning}`).join("\n");
  const missingLine = missingSystems.length > 0 ? `이 사람(관계)은 ${missingSystems.map((s) => SYSTEM_LABEL[s]).join(", ")} 정보가 없습니다. 없는 체계를 있는 것처럼 언급하지 마세요.` : "";
  const areaListText = areaDefs.map((area, i) => `${i + 1}. key="${area.key}" — "${area.title}" (${area.hint})`).join("\n");

  const prompt = [
    `다음은 ${scope === "relationship" ? "두 사람의 관계" : "한 사람"}에 대해 사주·자미두수·서양점성술 중 이미 계산이 끝난 체계(${availableSystems.map((s) => SYSTEM_LABEL[s]).join(", ")})에서 나온 synthesis fact와 각 fact의 확정 근거(provenance)입니다.`,
    "각 fact 앞의 [consensus]는 여러 체계가 같은 방향을 가리킨다는 뜻이고, [complement]는 서로 다른 측면을 보완한다는 뜻이며, [tension]은 서로 반대되는 요구가 함께 있다는 뜻입니다 — 이는 내부 참고용 표시일 뿐입니다.",
    missingLine,
    "",
    "아래는 분석해야 할 고정된 영역 목록입니다(key와 제목이 정해져 있습니다):",
    areaListText,
    "",
    "당신의 역할(허용됨):",
    "1. 위 영역 중 실제로 관련 fact/근거가 있는 영역만 골라 분석하세요. 근거가 없는 영역은 응답에서 아예 빼세요 — 내용 없는 뻔한 문장으로 억지로 채우지 마세요.",
    "2. 각 영역은 그 영역에 실제로 관련된 fact를 골라, 서로 다른 관점의 실제 상담 내용을 쓰세요. 여러 영역이 겉보기에 비슷해 보여도 같은 문장을 제목만 바꿔 반복하지 마세요 — 영역마다 다른 근거·다른 각도로 써야 합니다.",
    "3. 서로 다른 체계의 결과를 하나의 실제 성향/행동 패턴으로 통합해서 설명하세요.",
    "4. [tension]처럼 상충하는 신호가 있다면 숨기지 말고 \"보통은 X하지만, Y한 상황에서는 Z하게 나타난다\"처럼 상황에 따른 차이로 설명하세요.",
    "5. 강점과 약점을 다룰 때는 같은 성향이 어떻게 강점이자 동시에 주의점이 될 수 있는지 연결해서 보여주세요.",
    "6. '현재 흐름'(또는 '현재 관계 흐름') 영역은 시기 정보가 있을 때만 포함하고, 지금 시기가 타고난 구조와 어떻게 맞물리는지 설명하세요.",
    "",
    "절대 금지:",
    "- 아래 fact 목록에 없는 새로운 계산, 사실, 별자리 배치, 궁, aspect, 십성, 사화를 지어내지 마세요.",
    "- 미래 사건을 확정적으로 예측하지 마세요(\"결혼합니다\", \"성공합니다\" 같은 단정 금지 — \"~수 있습니다\", \"~경향이 있습니다\" 같은 표현을 쓰세요).",
    "- 새로운 점수나 확률을 만들지 마세요.",
    "- consensus/complement/tension, \"공통점\", \"차이점\", \"상충\" 같은 체계 비교 용어를 화면에 보이는 글의 표현으로 쓰지 마세요 — 이 사람(관계) 자체를 설명하는 자연스러운 상담문으로 쓰세요. 그 표시는 근거일 뿐입니다.",
    "- \"사주에서는 X, 서양점성술에서는 Y\"처럼 체계 이름을 나열하며 병렬로 쓰지 말고, 통합된 하나의 설명으로 쓰세요.",
    "- 위에 나열된 key 목록에 없는 새 영역을 만들지 마세요.",
    "",
    "출력 형식: 다른 설명이나 코드블록 표시 없이, 순수 JSON만 출력하세요. 각 영역은 2~5문장, 목록·번호 없이 이어지는 문장으로 쓰세요.",
    '{"areas":[{"key":"<위 key 중 하나>","text":"..."}]}',
    "",
    "[synthesis fact 목록]",
    factLines,
    timingLines ? "\n[지금 시기에 겹치는 신호]\n" + timingLines : "",
    "",
    "[기존 규칙 기반 문장 — 참고용, 그대로 베끼지 말고 위 지시대로 다시 쓸 것]",
    deterministicText,
  ].join("\n");

  let areas: HolisticArea[] | undefined;
  try {
    console.info("[prose-cache] openai-call", { topic, promptVersion, model: "gpt-5.6-sol" });
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 1800,
      }),
    });
    if (!aiRes.ok) { console.error("[prose-cache] openai-error", { status: aiRes.status, detail: (await aiRes.text()).slice(0, 500) }); throw new Error(`OpenAI error: ${aiRes.status}`); }
    const data = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content?.trim();
    const rawAreas = content ? parseAreasResponse(content) : null;
    if (!rawAreas) throw new Error("AI response was not valid areas JSON");
    // 방어적 필터링 — 허용된 key만, text가 실제로 있는 항목만, 같은 key 중복 제거(첫 항목만
    // 유지), 길이 상한 적용. 새 키를 지어내거나 빈 영역을 억지로 만든 경우를 여기서 걸러낸다.
    const seen = new Set<string>();
    areas = rawAreas
      .filter((item): item is { key: unknown; text: unknown } => !!item && typeof item === "object")
      .map((item) => ({ key: String((item as { key: unknown }).key ?? ""), text: String((item as { text: unknown }).text ?? "").trim() }))
      .filter((item) => allowedKeys.has(item.key) && item.text.length > 0 && item.text.length <= MAX_AREA_TEXT_LEN)
      .filter((item) => { if (seen.has(item.key)) return false; seen.add(item.key); return true; });
    if (areas.length === 0) throw new Error("AI response had no valid areas after filtering");
  } catch (error) {
    console.error("[prose-cache] holistic-parse-error", error instanceof Error ? error.message : error);
    areas = undefined;
  }

  if (!areas) { res.status(502).json({ error: "AI holistic synthesis failed" }); return; }

  const serialized = JSON.stringify(areas);
  await supabase.from("ziwei_prose_cache").upsert({
    user_id: userId,
    source_hash: sourceHash,
    prompt_version: promptVersion,
    topic,
    section_key: sectionKey,
    prose: serialized,
  });

  res.status(200).json({ areas, cached: false });
}
