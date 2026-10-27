/// <reference types="vite/client" />

/** Vite가 빌드 시점에 치환하는, 실행 번들의 Git 커밋 식별자다. */
declare const __PF_BUILD_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_APP_TARGET?: "web" | "android" | "ios";
  readonly VITE_GAME_API_ORIGIN?: string;
  /** 앱 패키징 빌드의 게임 서버 주소. 비우면 같은 출처 상대 경로다(`core/apiBase.ts`). */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
