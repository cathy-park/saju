import type { WesternBirthSource } from "../src/lib/western/adapter.js";
import type { TransitQuery } from "../src/lib/western/transit/types.js";

interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }
interface Body { personId: string; birth: WesternBirthSource; query?: TransitQuery }
const parse = (body: unknown) => typeof body === "string" ? JSON.parse(body) : body;
export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  let body: unknown; try { body = parse(req.body); } catch { res.status(400).json({ error: "Invalid JSON body" }); return; }
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 10_000) { res.status(400).json({ error: "Invalid comprehensive input" }); return; }
  const candidate = body as Partial<Body>;
  if (!candidate.personId || !candidate.birth) { res.status(400).json({ error: "Person and birth input are required" }); return; }
  try {
    const { resolveWesternPersonalSynthesisForBirth } = await import("../src/lib/western/synthesis/personAdapter.js");
    const result = resolveWesternPersonalSynthesisForBirth(candidate.personId, candidate.birth, candidate.query);
    if (!result.ok) { res.status(422).json({ errors: result.errors }); return; }
    res.status(200).json({ report: result.report });
  } catch (error) { console.error("western overview initialization failed", error); res.status(500).json({ errors: [{ code: "CALCULATION_FAILED", message: "Western overview service failed to initialize" }] }); }
}
