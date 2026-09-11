import type { SynastryBirthSubject } from "../src/lib/western/synastry/personAdapter.js";

interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void }
interface Body { first: SynastryBirthSubject; second: SynastryBirthSubject }
const parseBody = (body: unknown) => typeof body === "string" ? JSON.parse(body) : body;

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  let body: unknown; try { body = parseBody(req.body); } catch { res.status(400).json({ error: "Invalid JSON body" }); return; }
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 12_000) { res.status(400).json({ error: "Invalid synastry input" }); return; }
  const candidate = body as Partial<Body>;
  if (!candidate.first?.personId || !candidate.first.birth || !candidate.second?.personId || !candidate.second.birth || candidate.first.personId === candidate.second.personId) { res.status(400).json({ error: "Two distinct birth subjects are required" }); return; }
  try {
    const { resolveWesternSynastryForBirths } = await import("../src/lib/western/synastry/personAdapter.js");
    const result = resolveWesternSynastryForBirths(candidate.first, candidate.second);
    if (!result.ok) { res.status(422).json({ errors: result.errors }); return; }
    res.status(200).json({ report: result.report });
  } catch (error) {
    console.error("western-synastry initialization failed", error);
    res.status(500).json({ errors: [{ code: "CALCULATION_FAILED", message: "Western synastry service failed to initialize" }] });
  }
}
