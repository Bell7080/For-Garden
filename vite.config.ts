import { defineConfig } from "vite";
import { currentBuildCommit } from "./tests/e2e/buildIdentity";

export default defineConfig({
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
});
