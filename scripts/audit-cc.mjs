/** Standalone Node runner: compile the shared engine, then execute the diagnostic CLI. No remote service. */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory=mkdtempSync(join(tmpdir(),'for-garden-cc-audit-'));
try{
 const outfile=join(directory,'audit.mjs');
 await build({entryPoints:['scripts/cc-density-entry.ts'],outfile,bundle:true,platform:'node',format:'esm',target:'node22',define:{'import.meta.env':'{}','__PF_BUILD_COMMIT__':'"cc-audit"'},logLevel:'silent'});
 await import(pathToFileURL(outfile).href);
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{rmSync(directory,{recursive:true,force:true});}
