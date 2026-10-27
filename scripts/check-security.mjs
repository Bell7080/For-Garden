import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const directory = mkdtempSync(join(tmpdir(), "forgarden-security-"));
try {
  const outfile = join(directory, "audit.mjs");
  await build({ entryPoints: ["scripts/security-entry.ts"], outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent" });
  await import(pathToFileURL(outfile).href);
} finally { rmSync(directory, { recursive: true, force: true }); }
