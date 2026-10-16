// Run after npm run build. Optional second/third paths inspect actual QA/test bundles too.
import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), "forgarden-isolation-"));
const values = new Map([
  ["eternal-city.local-save", "preserved legacy record"],
]);
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const modules = new Map();
try {
  // Compile the real storage/session/debug modules with each build's environment; do not mock their implementations.
  for (const mode of ["qa", "production", "test"]) {
    const outfile = join(directory, `${mode}.mjs`);
    await build({
      stdin: {
        contents: `import {SaveManager,SAVE_STORAGE_KEY} from './src/state/SaveManager';
          import {createDefaultSession} from './src/state/session';
          import {LOCAL_SAVE_FLAVOR} from './src/core/saveStorage';
          import {setDebugScene,setDebugReady,setDebugProgress,debugPerfEnabled} from './src/debug';
          export function run(storage){const saves=new SaveManager(storage);const before=saves.load();const state=before??createDefaultSession();saves.save(state);setDebugScene('title');setDebugReady(true);setDebugProgress(state.wallet,state.owned);return {before,flavor:LOCAL_SAVE_FLAVOR,key:SAVE_STORAGE_KEY,wallet:saves.load().wallet,perf:debugPerfEnabled};}
          export function read(storage){return new SaveManager(storage).load();}`,
        resolveDir: root,
      },
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      define: {
        "import.meta.env": JSON.stringify({
          MODE: mode,
          DEV: false,
          PROD: true,
        }),
        __PF_BUILD_COMMIT__: JSON.stringify("build-isolation-probe"),
      },
    });
    globalThis.window = {};
    globalThis.location = { search: "?perf=1" };
    const module = await import(pathToFileURL(outfile).href);
    modules.set(mode, module);
    const result = module.run(storage);
    assert.equal(
      result.before,
      null,
      `${mode} imported another namespace or the legacy record`,
    );
    assert.equal(result.flavor, mode);
    assert.equal(result.key, `eternal-city.${mode}.local-save`);
    assert.equal(result.wallet.fossil, mode === "production" ? 0 : 900);
    assert.equal(result.wallet.amber, mode === "production" ? 0 : 450);
    assert.equal(result.perf, mode !== "production");
    assert.equal(Boolean(window.__PF_DEBUG?.ready), mode !== "production");
  }
  assert.equal(modules.get("qa").read(storage).wallet.fossil, 900);
  assert.equal(modules.get("production").read(storage).wallet.fossil, 0);
  assert.equal(
    values.get("eternal-city.local-save"),
    "preserved legacy record",
  );

  const paths = process.argv.slice(2);
  if (!paths.length) paths.push("dist");
  for (const [index, output] of paths.entries()) {
    const assets = resolve(output, "assets");
    const code = (
      await Promise.all(
        (await readdir(assets))
          .filter((p) => p.endsWith(".js"))
          .map((p) => readFile(join(assets, p), "utf8")),
      )
    ).join("\n");
    const expected = index === 0 ? false : true;
    assert.equal(
      code.includes("__PF_DEBUG"),
      expected,
      `${output}: debug global mismatch`,
    );
    assert.equal(
      code.includes("pf-perf"),
      expected,
      `${output}: perf overlay mismatch`,
    );
  }
  console.log(
    `PASS: real production/qa/test storage and debug isolation; legacy untouched; ${paths.length} built bundle(s) inspected.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
