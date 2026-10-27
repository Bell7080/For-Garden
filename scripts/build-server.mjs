/** 서버 함수(`api/game.js`)를 FakeServer 규칙째 한 장으로 묶는다. 생성물이라 손으로 고치지 않는다. */
import { build } from "esbuild";

// 테스트 프로젝트(qa)만 서버 번들에도 QA 도구(임시 광고 토큰)를 켠다. 커밋되는 api/game.js는 늘 production.
const serverMode = process.argv[2] === "qa" ? "qa" : "production";
const qa = serverMode === "qa";

await build({
  entryPoints: ["src/server/vercelEntry.ts"],
  outfile: "api/game.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
  define: { "import.meta.env": "{}", "import.meta.env.MODE": JSON.stringify(serverMode), "import.meta.env.DEV": "false", "import.meta.env.PROD": qa ? "false" : "true" },
  banner: { js: "/* 생성물: npm run build:server */\nimport { createRequire as __cr } from \"node:module\";\nconst require = __cr(import.meta.url);" },
});
console.log("[build-server] api/game.js");
await build({ entryPoints: ["src/server/accountEntry.ts"], outfile: "api/account.js", bundle: true, platform: "node", format: "esm", target: "node20", legalComments: "none", banner: { js: "/* 생성물: npm run build:server */" } });
console.log("[build-server] api/account.js");
