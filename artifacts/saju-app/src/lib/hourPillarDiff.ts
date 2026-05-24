import type { FiveElementCount, ComputedPillars } from "./sajuEngine";
import { countFiveElements } from "./sajuEngine";

// ── Five-element diff ─────────────────────────────────────────────

/** Compute five-element counts excluding the hour pillar */
export function countFiveElementsNoHour(pillars: ComputedPillars): FiveElementCount {
  const noHour: ComputedPillars = {
    year: pillars.year,
    month: pillars.month,
    day: pillars.day,
    hour: undefined as unknown as typeof pillars.hour,
  };
  return countFiveElements(noHour);
}

export interface FiveElDiffEntry {
  el: string;
  withHour: number;
  withoutHour: number;
  delta: number;
}

/** Returns only elements whose count changes when hour is excluded */
export function diffFiveElements(
  withHour: FiveElementCount,
  withoutHour: FiveElementCount,
): FiveElDiffEntry[] {
  return (Object.keys(withHour) as (keyof FiveElementCount)[])
    .map((el) => ({
      el,
      withHour: withHour[el],
      withoutHour: withoutHour[el],
      delta: withoutHour[el] - withHour[el],
    }))
    .filter((d) => d.delta !== 0);
}

// ── Shinsal diff ──────────────────────────────────────────────────

export interface ShinsalDiff {
  added: string[];
  removed: string[];
}

/** Compare two shinsal name sets; added = appear in without, removed = disappear */
export function diffShinsal(withHour: string[], withoutHour: string[]): ShinsalDiff {
  const setWith = new Set(withHour);
  const setWithout = new Set(withoutHour);
  return {
    added: withoutHour.filter((n) => !setWith.has(n)),
    removed: withHour.filter((n) => !setWithout.has(n)),
  };
}

// ── Overall "any change?" check ───────────────────────────────────

export function hasAnyHourDiff(
  fiveElDiff: FiveElDiffEntry[],
  shinsalDiff: ShinsalDiff,
): boolean {
  return (
    fiveElDiff.length > 0 ||
    shinsalDiff.added.length > 0 ||
    shinsalDiff.removed.length > 0
  );
}
