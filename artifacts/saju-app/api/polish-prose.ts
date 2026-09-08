// 자미두수 리포트의 deterministic 문장을 AI(OpenAI)로 "자연어 다듬기"만 하는 서버리스 함수.
// 새로운 해석/사실을 추가하지 않고, 전달된 fact만 자연스러운 문장으로 재표현하도록 프롬프트로
// 강하게 제한한다. 클라이언트 입력은 신뢰하지 않는다:
//   - 인증: Supabase 세션 토큰을 서버에서 검증(auth.getUser) — 미인증 요청은 401.
//   - rate limit: 계정당 분당 요청 수 제한(ziwei_prose_requests_log 테이블 기준).
//   - 입력 크기 제한: body 전체 크기, facts 개수, 문자열 길이를 서버에서 검증.
//   - sourceHash: 클라이언트가 보낸 해시를 쓰지 않고, 서버가 facts를 직접 정규화해 재계산한다
//     (클라이언트가 임의 해시로 캐시를 오염/우회하지 못하게 함).
//   - 캐시: user_id + source_hash + prompt_version + topic + section_key로 조회/저장 —
//     같은 계정이면 기기·브라우저와 무관하게 재사용된다.
//   - API 실패 시 502를 반환하고, deterministic 문장으로의 폴백은 클라이언트(proseLayer.ts)가
//     처리한다(이 함수는 폴백 문장을 모른다).
//
// 필요한 서버 전용 환경변수(Vercel Production, 코드에 하드코딩하지 않음):
//   - OPENAI_API_KEY
//   - SUPABASE_SERVICE_ROLE_KEY (Supabase 대시보드 → Settings → API → service_role secret)
//   - VITE_SUPABASE_URL(이미 설정되어 있으면 재사용 — URL 자체는 비밀 값이 아님)
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_BODY_CHARS = 20_000;
const MAX_FACTS = 60;
const MAX_MEANING_LEN = 300;
const MAX_TEXT_LEN = 6_000;
const RATE_LIMIT_PER_MINUTE = 10;
const VALID_POLARITY = new Set(["positive", "mixed", "risk"]);

interface FactInput {
  domain: string;
  meaning: string;
  polarity: string;
}

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
}

function parseBody(req: VercelLikeRequest): { raw: string; parsed: unknown } {
  if (typeof req.body === "string") return { raw: req.body, parsed: JSON.parse(req.body || "{}") };
  const raw = JSON.stringify(req.body ?? {});
  return { raw, parsed: req.body ?? {} };
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  let raw: string;
  let parsed: unknown;
  try {
    ({ raw, parsed } = parseBody(req));
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (raw.length > MAX_BODY_CHARS) {
    res.status(400).json({ error: "Request body too large" });
    return;
  }

  const body = parsed as {
    facts?: FactInput[];
    deterministicText?: string;
    topic?: string;
    sectionKey?: string;
    promptVersion?: string;
  };
  const { facts, deterministicText, topic, sectionKey, promptVersion } = body;

  if (!Array.isArray(facts) || facts.length === 0 || facts.length > MAX_FACTS) {
    res.status(400).json({ error: "Invalid facts" });
    return;
  }
  for (const f of facts) {
    if (!f || typeof f.meaning !== "string" || f.meaning.length === 0 || f.meaning.length > MAX_MEANING_LEN) {
      res.status(400).json({ error: "Invalid fact.meaning" });
      return;
    }
    if (typeof f.domain !== "string" || f.domain.length > 100) {
      res.status(400).json({ error: "Invalid fact.domain" });
      return;
    }
    if (!VALID_POLARITY.has(f.polarity)) {
      res.status(400).json({ error: "Invalid fact.polarity" });
      return;
    }
  }
  if (typeof deterministicText !== "string" || deterministicText.length === 0 || deterministicText.length > MAX_TEXT_LEN) {
    res.status(400).json({ error: "Invalid deterministicText" });
    return;
  }
  if (typeof topic !== "string" || !topic || topic.length > 50) {
    res.status(400).json({ error: "Invalid topic" });
    return;
  }
  if (typeof sectionKey !== "string" || !sectionKey || sectionKey.length > 50) {
    res.status(400).json({ error: "Invalid sectionKey" });
    return;
  }
  if (typeof promptVersion !== "string" || !promptVersion || promptVersion.length > 20) {
    res.status(400).json({ error: "Invalid promptVersion" });
    return;
  }

  const authHeader = req.headers.authorization ?? req.headers.Authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = authValue?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  const userId = userData.user.id;

  // rate limit: 계정당 최근 1분 요청 수 제한(캐시 히트 여부와 무관하게 요청 자체를 카운트).
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("ziwei_prose_requests_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("requested_at", oneMinuteAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }
  await supabase.from("ziwei_prose_requests_log").insert({ user_id: userId });

  // sourceHash는 서버가 직접 계산한다 — 클라이언트가 보낸 해시는 애초에 받지 않는다.
  const normalized = facts
    .map((f) => `${f.domain}|${f.polarity}|${f.meaning}`)
    .sort()
    .join("\n");
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

  if (cached?.prose) {
    res.status(200).json({ prose: cached.prose, cached: true });
    return;
  }

  const factLines = facts.map((f) => `- (${f.polarity}) ${f.meaning}`).join("\n");
  const prompt = [
    "다음은 이미 확정된 사실(fact) 목록과, 그 사실들을 규칙 기반으로 이어붙인 초안 문장입니다.",
    "이 사실 목록에 없는 새로운 내용, 조언, 해석, 판단을 절대 추가하지 마세요.",
    "사실을 생략하거나 왜곡하지 말고, 자연스러운 한국어 문장으로만 다듬어 주세요.",
    "결과는 다듬어진 문장만 출력하세요(설명, 따옴표, 목록 형식, 접두사 금지).",
    "",
    "[사실 목록]",
    factLines,
    "",
    "[초안 문장]",
    deterministicText,
  ].join("\n");

  let polished: string | undefined;
  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });
    if (!aiRes.ok) throw new Error(`OpenAI error: ${aiRes.status}`);
    const data = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    polished = data?.choices?.[0]?.message?.content?.trim();
  } catch {
    polished = undefined;
  }

  if (!polished) {
    res.status(502).json({ error: "AI polish failed" });
    return;
  }

  await supabase.from("ziwei_prose_cache").upsert({
    user_id: userId,
    source_hash: sourceHash,
    prompt_version: promptVersion,
    topic,
    section_key: sectionKey,
    prose: polished,
  });

  res.status(200).json({ prose: polished, cached: false });
}
