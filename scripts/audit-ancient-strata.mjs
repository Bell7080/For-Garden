import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = mkdtempSync(join(tmpdir(), "ancient-strata-audit-"));
try {
  const outfile = join(dir, "audit.mjs");
  await build({ entryPoints: [process.argv.includes("--search") ? "scripts/ancient-strata-search.ts" : process.argv.includes("--robustness") ? "scripts/ancient-strata-robustness.ts" : "scripts/ancient-strata-entry.ts"], outfile, bundle: true, platform: "node", format: "esm", target: "node22", define: { "import.meta.env": "{}", "__PF_BUILD_COMMIT__": '"ancient-audit"' }, logLevel: "silent" });
  await import(pathToFileURL(outfile).href);
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { rmSync(dir, { recursive: true, force: true }); }
