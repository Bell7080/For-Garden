/** 서버 함수(`api/game.js`)를 FakeServer 규칙째 한 장으로 묶는다. 생성물이라 손으로 고치지 않는다. */
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/vercelEntry.ts"],
  outfile: "api/game.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  legalComments: "none",
  define: { "import.meta.env": "{}", "import.meta.env.MODE": '"production"', "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" },
  banner: { js: "/* 생성물: npm run build:server */" },
});
console.log("[build-server] api/game.js");
