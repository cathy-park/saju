import { resolveWesternPersonalityForBirth } from "../src/lib/western/interpretation/personAdapter.js";
import type { WesternBirthSource } from "../src/lib/western/adapter.js";

interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }

function parseBody(body: unknown): unknown {
  return typeof body === "string" ? JSON.parse(body) : body;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body: unknown;
  try { body = parseBody(req.body); } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 4_000) {
    res.status(400).json({ error: "Invalid birth input" });
    return;
  }
  const result = resolveWesternPersonalityForBirth(body as WesternBirthSource);
  if (!result.ok) {
    res.status(422).json({ errors: result.errors });
    return;
  }
  res.status(200).json({ report: result.report });
}
