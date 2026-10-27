import { APP_TARGET } from "../core/appRuntime";
/**
 * 웹 빌드의 게스트 토큰 보관소. 웹에는 플랫폼 보안 저장소가 없어 브라우저 저장소(`localStorage`)에 둔다.
 *
 * **출시 차단 항목이다 — 결제가 붙기 전, 정식 출시 전에 반드시 없앤다**(응태 결정, 2026-10-16). 출시 전이라
 * 플레이어와 결제가 없어 계정 탈취의 손해가 없다는 전제로만 허용한 임시 예외이며, 결제·실유저가 생기면
 * 스크립트가 토큰을 읽을 수 있다는 점이 곧 계정 탈취 경로가 된다. 없애는 법: 앱 빌드는 키체인/키스토어
 * 어댑터를 `TokenStore`로 주입하고(`installBackend({ store })`), 웹 배포가 남으면 HttpOnly 서버 세션으로
 * 바꾼 뒤 이 파일과 `docs/release-fixture-cleanup.md`의 항목을 함께 지운다.
 * 토큰은 `SupabaseAccountApi` 안에서만 읽고 쓰며 `Session`·`SaveData`·화면으로 새지 않는다.
 */
import { defaultLocalStorage } from "../core/safeStorage";
import type { StoredTokens, TokenStore } from "./SupabaseAccountApi";

export const WEB_TOKEN_STORAGE_KEY = "forgarden.web.tokens";
const KEY = WEB_TOKEN_STORAGE_KEY;

export function createWebTokenStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = defaultLocalStorage()): TokenStore | null {
  if (APP_TARGET !== "web" || !storage) return null;
  const store = {
    [Symbol.toStringTag]: "ForGardenWebTokenStore",
    async load() {
      try {
        const raw = storage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<StoredTokens>;
        return typeof v.accessToken === "string" && typeof v.refreshToken === "string" && typeof v.expiresAtMs === "number" && typeof v.userId === "string"
          ? (v as StoredTokens)
          : null;
      } catch { return null; }
    },
    async save(tokens: StoredTokens) { try { storage.setItem(KEY, JSON.stringify(tokens)); } catch { /* 저장 차단 시 이번 방문의 메모리 세션은 유지한다. */ } },
    async clear() { try { storage.removeItem(KEY); } catch { /* 차단된 저장소 때문에 로그아웃을 막지 않는다. */ } },
  };
  return store;
}
