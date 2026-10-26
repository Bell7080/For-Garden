import { contentSecurityPolicy } from "./src/securityPolicy";
import { defineConfig, loadEnv } from "vite";
import { currentBuildCommit } from "./tests/e2e/buildIdentity";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_APP_TARGET ?? "web";
  if (!["web", "android", "ios"].includes(target)) throw new Error("INVALID_APP_TARGET");
  if (target !== "web" && !env.VITE_GAME_API_ORIGIN) throw new Error("NATIVE_API_ORIGIN_REQUIRED");
  return {
  plugins: command === "build" ? [{ name: "forgarden-security-policy", transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(env.VITE_GAME_API_ORIGIN, true, env.VITE_SUPABASE_URL) }, injectTo: "head-prepend" }, { tag: "meta", attrs: { name: "forgarden-app-target", content: target }, injectTo: "head-prepend" }] }] : [],
  build: { sourcemap: false },
  base: "./",
  // 번들 자체에 checkout 정체성을 새겨, 이미 떠 있던 preview를 테스트가 구별할 수 있게 한다.
  define: { __PF_BUILD_COMMIT__: JSON.stringify(currentBuildCommit()) },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
};
});
