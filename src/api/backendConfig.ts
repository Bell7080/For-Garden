/**
 * 서버 운영 설정(점검·최소 버전) 조회. 로그인 전에도 부르는 공개 함수 `get_public_config`만 쓴다.
 * 인증 토큰을 다루지 않고 공개 키만 쓰며, 설정이 없는 빌드는 성공을 흉내 내지 않고 `unsupported`를 돌려준다.
 * 점검 중이거나 앱 버전이 최소 버전보다 낮으면 화면이 진입을 막는 데 쓸 판정(`gate`)도 함께 준다.
 */
export interface PublicConfig {
  maintenance: boolean;
  maintenanceMessage: string;
  maintenanceEndsAt: string | null;
  minAppVersion: string;
  latestAppVersion: string;
  /** 서버가 출시 초기화를 한 세대. 빈 문자열이면 한 번도 하지 않았거나 서버가 값을 주지 않았다. */
  launchEpoch: string;
}
export type BackendConfigResult =
  | { ok: true; config: PublicConfig }
  | { ok: false; code: "unsupported" | "network-error" };
export type ConfigGate = "open" | "maintenance" | "update-required";

/** "0.285.1" 같은 점 구분 숫자 버전을 비교한다. 숫자가 아닌 조각은 0으로 본다. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** 점검이 우선이고, 그다음이 강제 업데이트다. */
export function configGate(config: PublicConfig, appVersion: string): ConfigGate {
  if (config.maintenance) return "maintenance";
  if (config.minAppVersion && compareVersions(appVersion, config.minAppVersion) < 0) return "update-required";
  return "open";
}

export async function fetchPublicConfig(
  fetchImpl: typeof fetch = fetch,
  url: string | undefined = import.meta.env?.VITE_SUPABASE_URL,
  key: string | undefined = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
): Promise<BackendConfigResult> {
  if (!url || !key) return { ok: false, code: "unsupported" };
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/get_public_config`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return { ok: false, code: "network-error" };
    const b = (await res.json()) as Record<string, unknown>;
    if (typeof b?.maintenance !== "boolean") return { ok: false, code: "network-error" };
    return {
      ok: true,
      config: {
        maintenance: b.maintenance,
        maintenanceMessage: typeof b.message === "string" ? b.message : "",
        maintenanceEndsAt: typeof b.ends_at === "string" ? b.ends_at : null,
        minAppVersion: typeof b.min_version === "string" ? b.min_version : "",
        latestAppVersion: typeof b.latest_version === "string" ? b.latest_version : "",
        launchEpoch: typeof b.launch_epoch === "string" ? b.launch_epoch : "",
      },
    };
  } catch {
    return { ok: false, code: "network-error" };
  }
}
