import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(path.resolve("chatgpt-plugin/node_modules/esbuild"));
const ref = JSON.parse(
  await fs.readFile(process.env.ORACLE_JSON ?? "/tmp/saju-independent-swiss-oracles.json", "utf8"),
);
const results = [];
for (const minutes of [720, 180, 60, 1]) {
  const b = await build({
    entryPoints: ["scripts/independent-three-charts/engine-entry.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    drop: ["console"],
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "sample-window",
        setup(b) {
          b.onLoad({ filter: /\/western\/astronomy\.ts$/ }, async (a) => ({
            loader: "ts",
            contents: (await fs.readFile(a.path, "utf8"))
              .replace(
                "const halfDay = 12 * 60 * 60 * 1000;",
                `const halfDay = ${minutes} * 60 * 1000;`,
              )
              .replace(
                "return { ...position, speedLongitude };",
                "speedLongitude *= 86400000 / (2 * halfDay);\n  return { ...position, speedLongitude };",
              ),
          }));
        },
      },
    ],
  });
  const e = await import(
    "data:text/javascript;base64," +
      Buffer.from(b.outputFiles[0].text).toString("base64")
  );
  const r = {
    minutes,
    stationSignMismatches: 0,
    maxStationSpeedError: 0,
    maxPlanetSpeedError: {},
    mismatchSamples: [],
  };
  for (const s of ref.stations) {
    const a = e.calculatePlanet(s.body, new Date(s.iso));
    r.maxStationSpeedError = Math.max(
      r.maxStationSpeedError,
      Math.abs(a.speedLongitude - s.reference.speedLongitude),
    );
    if (a.speedLongitude < 0 !== s.reference.speedLongitude < 0) {
      r.stationSignMismatches++;
      r.mismatchSamples.push({
        body: s.body,
        iso: s.iso,
        offset: s.offsetMinutes,
        engineSpeed: a.speedLongitude,
        referenceSpeed: s.reference.speedLongitude,
      });
    }
  }
  for (const s of ref.astronomy)
    for (const [body, p] of Object.entries(s.points)) {
      const a = e.calculatePlanet(body, new Date(s.iso));
      r.maxPlanetSpeedError[body] = Math.max(
        r.maxPlanetSpeedError[body] ?? 0,
        Math.abs(a.speedLongitude - p.speedLongitude),
      );
    }
  results.push(r);
}
await fs.writeFile(
  "/tmp/saju-independent-speed.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
