/**
 * QA(테스트) 빌드 전용 토큰 보관소. 웹 빌드에는 플랫폼 보안 저장소가 없어서, 테스트 주소에서 서버 연결을
 * 끝까지 검증하려고만 `localStorage`에 둔다 — 토큰을 `Session`·`SaveData`에 넣지 않는다는 규칙의 유일한 예외다.
 * 일반 빌드는 `QA_TOOLS_ENABLED`가 거짓이라 이 함수가 `null`을 돌려주고 분기째 번들에서 지워진다.
 * 출시(앱) 빌드는 키체인/키스토어 어댑터를 `TokenStore`로 주입한다.
 */
import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import type { StoredTokens, TokenStore } from "./SupabaseAccountApi";

const KEY = "forgarden.qa.tokens";

export function createQaTokenStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): TokenStore | null {
  if (!QA_TOOLS_ENABLED || !storage) return null;
  return {
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
    async save(tokens) { storage.setItem(KEY, JSON.stringify(tokens)); },
    async clear() { storage.removeItem(KEY); },
  };
}
