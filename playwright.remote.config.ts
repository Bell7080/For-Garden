import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** 원격 API 주입을 위한 Vite 소스 모듈 검사다. 일반 배포 산출물 E2E와 별도로 실행한다. */
export default defineConfig({
  ...base,
  testMatch: 'remoteBattleLoop.spec.ts',
  globalSetup: undefined,
  expect: { timeout: 30_000 },
  use: { ...base.use, trace: 'off' },
  webServer: {
    command: 'npx vite --mode test --host 127.0.0.1 --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
