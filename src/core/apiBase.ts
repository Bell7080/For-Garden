import { apiEndpoint } from "./appRuntime";

/** 앱과 웹의 API 주소는 같은 HTTPS 검증 경계를 사용한다. 두 빌드 설정 이름을 호환한다. */
export function apiUrl(path: "/api/game" | "/api/account", base: string | undefined = import.meta.env?.VITE_API_BASE_URL ?? import.meta.env?.VITE_GAME_API_ORIGIN): string {
  return apiEndpoint(path, base?.trim().replace(/\/+$/, "") || undefined);
}
