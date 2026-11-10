/**
 * 시작 관문. 앱을 켠 뒤 한 번 서버에 운영 설정(점검·최소 버전)과 서버 시각을 묻는다.
 * 서버를 부를 수 없으면(설정 없음·네트워크 실패·시간 초과) 막지 않고 연다 — 서버가 잠깐 느리다고
 * 오프라인으로도 되는 화면까지 못 들어가게 하지 않는다. 점검이 켜져 있거나 앱 버전이 최소 버전보다
 * 낮을 때만 막는다.
 */
import { configGate, fetchPublicConfig, type ConfigGate, type PublicConfig } from "./backendConfig";
import { pingBackend } from "./backendPing";
import { syncServerClock } from "./serverClock";
import { setLiveSchedule } from "../core/liveSchedule";
import { setLaunchAt } from "../core/launchAnchor";
import { rememberLaunchAt, storedLaunchAt } from "./launchEpoch";

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
  // 공개 설정이 오기 전(또는 끝내 못 받으면)에는 기기가 마지막으로 본 출시 시각으로 주기를 센다.
  setLaunchAt(storedLaunchAt());
  const run = async (): Promise<StartupGateResult> => {
    const before = now();
    // 시각 동기화 실패·지연이 이미 도착한 초기화 세대 응답을 가리지 않게 한다.
    const ping = url === undefined ? pingBackend(fetchImpl) : pingBackend(fetchImpl, url, key);
    void ping.then(pinged => { if (pinged.ok) syncServerClock(pinged.serverNow, before, now()); }).catch(() => undefined);
    const loaded = await (url === undefined ? fetchPublicConfig(fetchImpl) : fetchPublicConfig(fetchImpl, url, key));
    if (!loaded.ok) return OPEN;
    // 배너·상품·이벤트의 운영 일정은 화면이 열리기 전에 들어와야 연구소·로비가 같은 기간을 읽는다.
    setLiveSchedule(loaded.config.schedule);
    // 출시 시각도 같은 때 들어와야 시즌 번호·이벤트 교대·출시 전 유예가 화면이 열리기 전에 정해진다.
    if (loaded.config.launchAt !== undefined) {
      setLaunchAt(loaded.config.launchAt);
      rememberLaunchAt(loaded.config.launchAt);
    }
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
