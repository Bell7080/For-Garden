import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// 실제 배포 진입점을 임시 checkout에서 실행해 순서와 실패 전파를 검사한다.
function build(serverExit: number, securityExit = 0) {
  const root = mkdtempSync(join(tmpdir(), "fg-vercel-"));
  try {
    mkdirSync(join(root, "scripts")); mkdirSync(join(root, "bin"));
    writeFileSync(join(root, "scripts/vercel-build.mjs"), readFileSync("scripts/vercel-build.mjs"));
    writeFileSync(join(root, "scripts/build-server.mjs"), `import { appendFileSync } from 'node:fs'; appendFileSync('order', 'server\\n'); process.exit(${serverExit});`);
    writeFileSync(join(root, "scripts/check-security.mjs"), `import {appendFileSync} from 'node:fs';appendFileSync('order','security\\n');if(!process.argv.includes('--public-only'))process.exit(8);process.exit(${securityExit});`);
    writeFileSync(join(root, "bin/npx"), `#!${process.execPath}\nrequire('node:fs').appendFileSync('order', 'client\\n');`, { mode: 0o755 });
    const result = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], {
      cwd: root, env: { ...process.env, PATH: join(root, "bin") + ":" + process.env.PATH, FORGARDEN_BUILD: "production" }, encoding: "utf8",
    });
    return { status: result.status, order: readFileSync(join(root, "order"), "utf8") };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe.skipIf(process.platform === "win32")("Vercel 서버/클라이언트 빌드", () => {
  it("서버·클라이언트 생성 뒤 공개 보안 검사를 통과해야 배포한다", () => expect(build(0)).toEqual({ status: 0, order: "server\nclient\nsecurity\n" }));
  it("보안 검사 실패를 배포 성공으로 숨기지 않는다", () => expect(build(0, 9)).toEqual({ status: 9, order: "server\nclient\nsecurity\n" }));
  it("서버 생성 실패 시 이전 API로 배포하지 않고 즉시 실패한다", () => expect(build(7)).toEqual({ status: 7, order: "server\n" }));
});
