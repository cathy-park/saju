import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OpenAI prose model routing", () => {
  it("uses Terra for individual prose polish and Sol for holistic synthesis", () => {
    const prose = readFileSync("api/polish-prose.ts", "utf8");
    const holistic = readFileSync("api/integrated-holistic.ts", "utf8");
    expect(prose).toContain('model: "gpt-5.6-terra"');
    expect(holistic).toContain('model: "gpt-5.6-sol"');
    expect(`${prose}\n${holistic}`).not.toContain('model: "gpt-4o-mini"');
  });

  it("isolates Terra/Sol results from the previous model cache", () => {
    const versions = readFileSync("src/lib/prosePromptVersion.ts", "utf8");
    expect(versions).toContain('SHARED_PROSE_PROMPT_VERSION = "v5"');
    expect(versions).toContain('INTEGRATED_HOLISTIC_PROMPT_VERSION = "holistic-v2"');
  });
});
