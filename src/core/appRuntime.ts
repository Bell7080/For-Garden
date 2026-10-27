/** 앱 셸은 원격 API와 보안 저장소를 명시적으로 제공해야 한다. 웹의 상대 URL/저장소로 대체하지 않는다. */
export type AppTarget = "web" | "android" | "ios";
export function appTarget(value: string | undefined): AppTarget {
  if (!value || value === "web") return "web";
  if (value === "android" || value === "ios") return value;
  throw new Error("INVALID_APP_TARGET");
}
export const APP_TARGET: AppTarget = (import.meta.env?.VITE_APP_TARGET ?? "web") as AppTarget;

export function apiEndpoint(path: "/api/game" | "/api/account", origin = import.meta.env?.VITE_GAME_API_ORIGIN, target: AppTarget = APP_TARGET): string {
  if (!origin) {
    if (target !== "web") throw new Error("NATIVE_API_ORIGIN_REQUIRED");
    return path;
  }
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("INVALID_API_ORIGIN");
  return new URL(path, url).href;
}
