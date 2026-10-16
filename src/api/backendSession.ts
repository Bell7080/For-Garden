/**
 * 서버 계정 연결의 시작점. 보안 저장소(`TokenStore`)가 있고 서버 설정이 있을 때만 `SupabaseAccountApi`를
 * 세우고, 없으면 `UnsupportedAccountApi`에 머문다(성공을 흉내 내지 않는다). 지금은 QA 빌드의 임시 보관소만
 * 쓰며, 앱 빌드는 네이티브 어댑터를 `store`로 넘겨 같은 함수를 부른다.
 */
import { CURRENT_SAVE_VERSION } from "../state/SaveManager";
import { installAccountApi } from "./AccountApi";
import { createQaTokenStore } from "./qaTokenStore";
import { SupabaseAccountApi, type TokenStore } from "./SupabaseAccountApi";

let account: SupabaseAccountApi | null = null;

/** 서버에 연결된 계정. 연결되지 않은 빌드는 null이다. */
export function backendAccount(): SupabaseAccountApi | null { return account; }

export function installBackend(options: {
  url?: string; key?: string; store?: TokenStore | null; fetchImpl?: typeof fetch;
} = {}): SupabaseAccountApi | null {
  const url = options.url ?? import.meta.env?.VITE_SUPABASE_URL;
  const key = options.key ?? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  const store = options.store === undefined ? createQaTokenStore() : options.store;
  if (!url || !key || !store) return null;
  account = new SupabaseAccountApi({ url, key, store, fetchImpl: options.fetchImpl, saveVersion: () => CURRENT_SAVE_VERSION });
  installAccountApi(account);
  return account;
}
