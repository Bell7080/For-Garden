/**
 * 서버 계정 연결의 시작점. 보안 저장소(`TokenStore`)가 있고 서버 설정이 있을 때만 `SupabaseAccountApi`를
 * 세우고, 없으면 `UnsupportedAccountApi`에 머문다(성공을 흉내 내지 않는다). 지금은 웹 보관소(출시 차단 항목)만
 * 쓰며, 앱 빌드는 네이티브 어댑터를 `store`로 넘겨 같은 함수를 부른다.
 */
import { CURRENT_SAVE_VERSION, saveManager } from "../state/SaveManager";
import { installSocialApi } from "./FakeSocialServer";
import { installGameApi } from "./FakeServer";
import { installGuildApi } from "./guildApi";
import { connectServerProgress, createLinkMarker, type ServerProgressDeps, type ServerProgressResult } from "./serverProgress";
import { installAccountApi } from "./AccountApi";
import { createWebTokenStore } from "./webTokenStore";
import { SupabaseAccountApi, type TokenStore } from "./SupabaseAccountApi";

let account: SupabaseAccountApi | null = null;

/** 서버에 연결된 계정. 연결되지 않은 빌드는 null이다. */
export function backendAccount(): SupabaseAccountApi | null { return account; }

export function installBackend(options: {
  url?: string; key?: string; store?: TokenStore | null; fetchImpl?: typeof fetch;
} = {}): SupabaseAccountApi | null {
  const url = options.url ?? import.meta.env?.VITE_SUPABASE_URL;
  const key = options.key ?? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  const store = options.store === undefined ? createWebTokenStore() : options.store;
  if (!url || !key || !store) return null;
  account = new SupabaseAccountApi({ url, key, store, fetchImpl: options.fetchImpl, saveVersion: () => CURRENT_SAVE_VERSION });
  installAccountApi(account);
  return account;
}

/**
 * 서버가 진행을 소유하도록 켠다(타이틀에서 부른다). 서버가 없는 빌드와 E2E는 이 기기의 임시 구현에 머문다.
 * 결과는 화면이 문구로 바꾼다 — 실패하면 진행을 이 기기에서 이어 가지 않고 다시 시도하게 한다.
 */
export function connectProgress(choose: ServerProgressDeps["choose"]): Promise<ServerProgressResult> {
  return connectServerProgress({ account, saves: saveManager, marker: createLinkMarker(), choose });
}

/** 계정을 바꾸기 전에 서버 연결을 내린다. 이전 계정의 호출이 새 게스트로 나가지 않게 한다. */
export function disconnectProgress(): void {
  installGameApi(null);
  installSocialApi(null);
  installGuildApi(null);
  createLinkMarker().set(null);
}
