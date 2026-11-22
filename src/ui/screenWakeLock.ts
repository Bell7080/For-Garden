/**
 * 게임이 앞에 떠 있는 동안 화면이 저절로 꺼지지 않게 한다.
 *
 * 전투를 자동으로 돌려 두고 지켜보는 게임이라 손을 대지 않는 시간이 길고, 그 사이 기기 설정의 자동 잠금이
 * 화면을 끄면 판이 백그라운드로 내려가 흐름이 끊긴다. 앱 셸(Capacitor)이 화면 유지 플러그인(`KeepAwake`)을
 * 실어 두었으면 그것을 먼저 쓰고, 없으면 웹 표준 Screen Wake Lock(`navigator.wakeLock`)을 쓴다. 둘 다 없으면
 * 아무것도 하지 않는다(성공을 흉내 내지 않는다).
 *
 * 웹의 잠금은 화면이 숨으면 브라우저가 스스로 풀고, 사용자 조작 없이는 거절되기도 한다 — 그래서 화면이 돌아올
 * 때와 손이 닿을 때마다 다시 묻는다. 잡고 있는 동안에는 다시 묻지 않는다.
 */

interface WakeLockSentinelLike {
  released: boolean;
  addEventListener(type: "release", listener: () => void): void;
}

export interface WakeLockHost {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
  keepAwake?: () => Promise<unknown>;
  visible(): boolean;
  onVisibilityChange(listener: () => void): void;
  onPointerDown(listener: () => void): void;
}

/** 잠금을 붙잡는 일을 맡는다. 돌려준 함수는 지금 잡아 보라고 한 번 묻는다(테스트용). */
export function installScreenWakeLock(host: WakeLockHost): () => Promise<void> {
  if (host.keepAwake) {
    const keepAwake = host.keepAwake;
    // 네이티브 플러그인은 앱이 떠 있는 동안 한 번이면 유지된다. 앞으로 돌아올 때만 다시 걸어 둔다.
    const ask = async (): Promise<void> => { if (host.visible()) await keepAwake().catch(() => undefined); };
    host.onVisibilityChange(() => { void ask(); });
    void ask();
    return ask;
  }
  const api = host.wakeLock;
  if (!api) return async () => undefined;
  let held: WakeLockSentinelLike | null = null;
  let asking = false;
  const ask = async (): Promise<void> => {
    if (asking || !host.visible() || (held && !held.released)) return;
    asking = true;
    try {
      const sentinel = await api.request("screen");
      held = sentinel;
      sentinel.addEventListener("release", () => { if (held === sentinel) held = null; });
    } catch {
      // 조작 없이 물었거나 절전 모드라 거절됐다 — 다음 손길이나 복귀에서 다시 묻는다.
    } finally {
      asking = false;
    }
  };
  host.onVisibilityChange(() => { void ask(); });
  host.onPointerDown(() => { void ask(); });
  void ask();
  return ask;
}

/** 브라우저·앱 셸에서 실제 연결을 짓는다. */
export function installBrowserScreenWakeLock(): void {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  const bridge = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { KeepAwake?: { keepAwake(): Promise<unknown> } } } }).Capacitor;
  const plugin = bridge?.isNativePlatform?.() === true ? bridge.Plugins?.KeepAwake : undefined;
  const wakeLock = (navigator as { wakeLock?: WakeLockHost["wakeLock"] }).wakeLock;
  installScreenWakeLock({
    wakeLock,
    keepAwake: plugin ? () => plugin.keepAwake() : undefined,
    visible: () => document.visibilityState !== "hidden",
    onVisibilityChange: (listener) => document.addEventListener("visibilitychange", listener),
    onPointerDown: (listener) => window.addEventListener("pointerdown", listener, { passive: true }),
  });
}
