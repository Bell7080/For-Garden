import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { findExposedSecrets, forbiddenPublicArtifact, androidManifestRisks, iosPlistRisks } from "../src/security/releaseAudit";

const args = process.argv.slice(2);
let target: "android" | "ios" | null = null;
let dist = "dist";
let publicOnly = false;
for (let i=0;i<args.length;i++) {
  if (args[i] === "--public-only") publicOnly = true;
  else if (args[i] === "--dist") { if (!args[i+1] || args[i+1].startsWith("--")) throw new Error("--dist requires a directory"); dist=args[++i]; }
  else if (args[i] === "--android" || args[i] === "--ios") { if (target) throw new Error("Choose one native target"); target=args[i] === "--android" ? "android" : "ios"; }
  else throw new Error("Use --android|--ios and optional --dist directory");
}
const root = process.cwd();
const findings: Array<{ file: string; line?: number; code: string }> = [];
const tracked = publicOnly ? [] : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(file => file && !file.startsWith("work/"));
const textFile = /(?:\.(?:[cm]?[jt]sx?|json|html|css|sql|md|txt|ya?ml|xml|plist|entitlements|properties|env)|(?:^|\/)\.env(?:\.[^/]*)?)$/i;
function scan(file: string, publishedRoot?: string) {
  if (!existsSync(file) || !statSync(file).isFile()) return;
  const name = relative(root, file).replaceAll("\\", "/");
  if (publishedRoot && forbiddenPublicArtifact(relative(publishedRoot, file).replaceAll("\\", "/"))) findings.push({ file: name, code: "public-server-or-secret-artifact" });
  if (textFile.test(name)) {
    const text = readFileSync(file, "utf8");
    findings.push(...findExposedSecrets(name, text));
    if (publishedRoot && /\bSUPABASE_SERVICE_ROLE_KEY\b/.test(text)) findings.push({ file: name, code: "server-credential-config-in-public-bundle" });
  }
}
function walk(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(folder, item.name)) : item.isFile() ? [join(folder, item.name)] : []);
}
for (const file of tracked) scan(resolve(root, file));
for (const folder of ["public", dist]) for (const file of walk(folder)) scan(resolve(root, file), resolve(folder));
if (!existsSync(join(dist,"index.html"))) findings.push({ file: "dist/index.html", code: "build-required" });
else if (!readFileSync(join(dist,"index.html"), "utf8").includes('http-equiv="Content-Security-Policy"')) findings.push({ file: "dist/index.html", code: "csp-missing" });
if (target) {
  if (!existsSync(join(dist,"index.html")) || !readFileSync(join(dist,"index.html"), "utf8").includes(`name="forgarden-app-target" content="${target}"`)) findings.push({ file: "dist/index.html", code: "wrong-build-target" });
  const configFile = target === "android" ? "android/app/src/main/assets/capacitor.config.json" : "ios/App/App/capacitor.config.json";
  if (!existsSync(configFile)) findings.push({ file: configFile, code: "native-project-not-generated" });
  else {
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    if (config.server?.url || config.server?.cleartext || config.server?.allowNavigation?.length || config.android?.allowMixedContent || config.android?.webContentsDebuggingEnabled) findings.push({ file: configFile, code: "unsafe-webview-config" });
  }
  const manifest = target === "android" ? "android/app/src/main/AndroidManifest.xml" : "ios/App/App/Info.plist";
  if (!existsSync(manifest)) findings.push({ file: manifest, code: "native-manifest-missing" });
  else for (const code of (target === "android" ? androidManifestRisks : iosPlistRisks)(readFileSync(manifest, "utf8"))) findings.push({ file: manifest, code });
  if (target === "ios") for (const file of walk("ios").filter(file => file.endsWith(".entitlements"))) for (const code of iosPlistRisks(readFileSync(file, "utf8"))) findings.push({ file, code });
  const bundle = walk(dist).filter(file => /\.js$/.test(file)).map(file => readFileSync(file, "utf8")).join("\n");
  // 빌드의 토큰 저장소 선택이 잘못돼 브라우저 영구 저장소로 돌아가는 것까지 검사한다.
  if (bundle.includes("ForGardenWebTokenStore")) findings.push({ file: "dist", code: "web-token-store-in-native-bundle" });
}
console.log(JSON.stringify({ target: target ?? (publicOnly ? "public-web-bundle" : "repository-and-web-bundle"), findings, note: target ? "Source configuration checks only; signed APK/AAB/IPA, store SDK verification and device tests remain required." : "No secret values are included in this report." }, null, 2));
if (findings.length) process.exitCode = 1;
