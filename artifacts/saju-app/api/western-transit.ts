import type { WesternBirthSource } from "../src/lib/western/adapter.js";
import type { TransitQuery } from "../src/lib/western/transit/types.js";

interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }
interface TransitRequestBody { birth: WesternBirthSource; query: TransitQuery }
const parseBody = (body: unknown): unknown => typeof body === "string" ? JSON.parse(body) : body;

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  let body: unknown;
  try { body = parseBody(req.body); } catch { res.status(400).json({ error: "Invalid JSON body" }); return; }
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 8_000) { res.status(400).json({ error: "Invalid transit input" }); return; }
  const candidate = body as Partial<TransitRequestBody>;
  if (!candidate.birth || !candidate.query?.startLocalDate || !candidate.query.endLocalDate) { res.status(400).json({ error: "Birth and local-date query are required" }); return; }
  try {
    const { resolveWesternTransitForBirth } = await import("../src/lib/western/transit/personAdapter.js");
    const result = resolveWesternTransitForBirth(candidate.birth, { ...candidate.query, timezone: candidate.query.timezone || candidate.birth.timezone || "" });
    if (!result.ok) { res.status(422).json({ errors: result.errors }); return; }
    res.status(200).json({ report: result.report });
  } catch (error) {
    console.error("western-transit initialization failed", error);
    const invalidRange = error instanceof Error && error.message === "INVALID_TRANSIT_RANGE";
    res.status(invalidRange ? 400 : 500).json({ errors: [{ code: invalidRange ? "INVALID_LOCAL_DATE_TIME" : "CALCULATION_FAILED", message: invalidRange ? "Invalid transit date range" : "Western transit service failed to initialize" }] });
  }
}
