/**
 * Vercel 빌드 진입점 — 같은 저장소를 두 프로젝트가 함께 빌드한다.
 *
 * `vercel.json`의 `buildCommand`는 대시보드의 빌드 명령보다 앞서므로, 테스트 프로젝트에서
 * 대시보드에 `npm run build:qa`를 적어도 무시되고 두 주소가 똑같은 일반 빌드가 된다.
 * 그래서 모드는 여기 한 곳이 프로젝트를 보고 고른다.
 *
 * - 환경 변수 `FORGARDEN_BUILD`가 있으면 그 값(`qa` · `production`)이 이긴다.
 * - 없으면 프로젝트의 프로덕션 주소(`VERCEL_PROJECT_PRODUCTION_URL`)가 `forgarden.test`·
 *   `forgarden-test`로 시작할 때만 QA 빌드다.
 * - 그 밖에는 언제나 일반 빌드다 — 모르면 치트가 꺼진 쪽으로 떨어진다.
 */
import { spawnSync } from "node:child_process";

const explicit = (process.env.FORGARDEN_BUILD ?? "").trim().toLowerCase();
const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim().toLowerCase();
const isTestProject = /^forgarden[.-]test/.test(host);
const mode = explicit === "qa" || explicit === "production" ? explicit : isTestProject ? "qa" : "production";

console.log(`[vercel-build] mode=${mode} (FORGARDEN_BUILD=${explicit || "-"}, host=${host || "-"})`);
const result = spawnSync("npx", ["vite", "build", "--mode", mode], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
