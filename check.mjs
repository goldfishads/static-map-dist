#!/usr/bin/env node
/**
 * Release gate for the files that become public. Fails the build when the
 * bundle or a data file contains anything that must stay private, grows past
 * its budget, or when the data hashes baked into the bundle do not match the
 * data files on disk (a stale build would fail every load with SRI errors).
 * Runs after every build; the public copy runs it again in its own CI.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [/pk\.eyJ/, /sk\.eyJ/, /goldfishads/i, /media-dooh/, /dooh-llm/, /audience-ai/, /api-dev/, /mcp\./, /mapbox:\/\//, /api\.mapbox\.com/, /access_token/, /npm\.pkg\.github\.com/];
const BUDGET_KB = { "static-map.js": 80, "us-counties.js": 1000, "us-states.js": 150, "us-interstates.js": 300, "us-highways.js": 1000, "us-towns.js": 400, "world-countries.js": 900, "world-lakes.js": 200, "world-regions.js": 900, "world-cities.js": 800 };

const bundle = readFileSync("dist/static-map.js", "utf8");
const dataFiles = readdirSync("dist/data").filter((f) => f.endsWith(".js")).map((f) => join("dist/data", f));
let failed = false;
const fail = (msg) => { failed = true; process.stderr.write(`${msg}\n`); };

for (const file of ["dist/static-map.js", ...dataFiles]) {
  const text = readFileSync(file, "utf8");
  for (const re of FORBIDDEN) if (re.test(text)) fail(`${file}: contains ${re}`);
  const kb = statSync(file).size / 1024;
  const budget = BUDGET_KB[file.split("/").pop()];
  if (!budget) fail(`${file}: no size budget set`);
  else if (kb > budget) fail(`${file}: ${kb.toFixed(0)} KB over the ${budget} KB budget`);
}
for (const file of dataFiles) {
  const hash = `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`;
  if (!bundle.includes(hash)) fail(`${file}: its hash is not in the bundle; run build:data before build`);
}
process.stdout.write(`checked ${dataFiles.length + 1} file(s)\n`);
if (failed) process.exitCode = 1;
