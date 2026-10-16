/**
 * 시작 관문. 앱을 켠 뒤 한 번 서버에 운영 설정(점검·최소 버전)과 서버 시각을 묻는다.
 * 서버를 부를 수 없으면(설정 없음·네트워크 실패·시간 초과) 막지 않고 연다 — 서버가 잠깐 느리다고
 * 오프라인으로도 되는 화면까지 못 들어가게 하지 않는다. 점검이 켜져 있거나 앱 버전이 최소 버전보다
 * 낮을 때만 막는다.
 */
import { configGate, fetchPublicConfig, type ConfigGate, type PublicConfig } from "./backendConfig";
import { pingBackend } from "./backendPing";
import { syncServerClock } from "./serverClock";

export interface StartupGateResult {
  gate: ConfigGate;
  config: PublicConfig | null;
}

export const STARTUP_GATE_TIMEOUT_MS = 4000;

const OPEN: StartupGateResult = { gate: "open", config: null };

export async function checkStartupGate(
  appVersion: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; url?: string; key?: string; now?: () => number } = {},
): Promise<StartupGateResult> {
  const { timeoutMs = STARTUP_GATE_TIMEOUT_MS, fetchImpl = fetch, url, key, now = Date.now } = options;
  const run = async (): Promise<StartupGateResult> => {
    const before = now();
    // 두 호출을 나란히 보내 왕복을 한 번만 기다린다.
    const [pinged, loaded] = await Promise.all([
      url === undefined ? pingBackend(fetchImpl) : pingBackend(fetchImpl, url, key),
      url === undefined ? fetchPublicConfig(fetchImpl) : fetchPublicConfig(fetchImpl, url, key),
    ]);
    if (pinged.ok) syncServerClock(pinged.serverNow, before, now());
    if (!loaded.ok) return OPEN;
    return { gate: configGate(loaded.config, appVersion), config: loaded.config };
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<StartupGateResult>((resolve) => {
    timer = setTimeout(() => resolve(OPEN), timeoutMs);
  });
  try {
    return await Promise.race([run(), timeout]);
  } catch {
    return OPEN;
  } finally {
    clearTimeout(timer);
  }
}
