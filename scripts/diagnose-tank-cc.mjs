/** Read-only native CC diagnosis; counterfactuals never mutate the source character definitions. */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'for-garden-tank-cc-'));
try {
 const outfile=join(dir,'diagnosis.mjs');
 await build({entryPoints:['scripts/tank-cc-diagnosis.ts'],outfile,bundle:true,platform:'node',format:'esm',target:'node22',define:{'import.meta.env':'{}','__PF_BUILD_COMMIT__':'"tank-cc-diagnosis"'},logLevel:'silent'});
 await import(pathToFileURL(outfile).href);
} catch(error){console.error(error);process.exitCode=1;}
finally {rmSync(dir,{recursive:true,force:true});}
