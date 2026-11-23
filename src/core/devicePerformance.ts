import type { DeviceProfile, GraphicsQuality } from "./settings";

/**
 * 기기 성능에 맞춰 GPU·메모리 부담을 줄이는 순수 규칙(2026-11-20 발열 진단 — VERSION v0.511.2).
 *
 * 로비에 가만히 있어도 매 프레임 화면 전체를 다시 그리는 GPU 몫이 발열의 대부분이었다. 화면을 바꾸지 않고
 * 줄일 수 있는 것은 v0.511.1에서 걷었고, 여기 남은 것은 **저사양 기기와 절전 모드에서만** 조금 덜 그리는 값이다.
 */

/** 절전 모드가 켜지면 프레임 제한을 이 값 아래로 내린다. 저장된 선택은 그대로 두고 적용만 낮춘다. */
export const POWER_SAVING_FRAME_RATE = 30 as const;

/**
 * 첫 실행(과 설정 초기화)에서 고를 프레임 제한. 품질과 무관하게 30이다(2026-11-23 응태 결정 — 아이폰16 발열·배터리).
 * 60·120은 플레이어가 설정에서 직접 고를 때만 든다.
 */
export function deviceFrameRateLimit(_quality: GraphicsQuality): 30 {
  return 30;
}

/** 실제로 TimeStep에 걸 프레임 제한. 절전은 30에서 멈추고, 끄면 저장된 값이 그대로 돌아온다. */
export function effectiveFrameRateLimit(presentation: { frameRateLimit: 30 | 60 | 120; powerSaving: boolean }): 30 | 60 | 120 {
  return presentation.powerSaving ? Math.min(presentation.frameRateLimit, POWER_SAVING_FRAME_RATE) as 30 : presentation.frameRateLimit;
}

/**
 * 렌더러의 안티앨리어싱(MSAA)은 설정의 「안티에일리어싱」(`presentation.antialias`) 하나가 정한다(2026-11-23 응태 —
 * 모든 기기에서 켜고 끌 수 있다). v0.523.0에서 iPhone·iPad는 발열 때문에 늘 껐는데(측정상 약 14% 가벼움) 가장자리가
 * 깨져 보여 기본을 켬으로 되돌리고 끄는 것은 플레이어가 고르게 했다. 값이 없던 저장·첫 실행은 그래픽 품질에서 고른다 —
 * 낮음이면 끔(저사양 안드로이드의 예전 동작 그대로), 나머지는 켬.
 * WebGL 컨텍스트를 만들 때 정해지므로 바꾸면 다음 실행부터 든다.
 */
export function defaultAntialias(quality: GraphicsQuality): boolean {
  return quality !== "low";
}

/** 쓰지 않게 된 원화를 GPU에 몇 장까지 남겨 둘지. 메모리가 적은 기기일수록 덜 붙잡는다. */
export interface IdleKeep { background: number; puppet: number }

/** 기본값은 각 거주 규칙의 상수(배경 2장 · Puppet 8벌)다. 메모리를 말하지 않는 기기는 기본값을 쓴다. */
export const DEFAULT_IDLE_KEEP: IdleKeep = { background: 2, puppet: 8 };

export function deviceIdleKeep(device: DeviceProfile): IdleKeep {
  const memory = typeof device.deviceMemory === "number" && Number.isFinite(device.deviceMemory) && device.deviceMemory > 0 ? device.deviceMemory : undefined;
  if (memory === undefined || memory > 4) return DEFAULT_IDLE_KEEP;
  if (memory <= 2) return { background: 1, puppet: 3 };
  return { background: 1, puppet: 5 };
}

/**
 * 게임을 만들기 **전에** 저장에서 그래픽 품질만 읽는다(안티앨리어싱은 컨텍스트를 만들 때 정해진다).
 * 저장이 없거나 읽을 수 없으면 첫 실행과 같이 기기 단서로 고른다. 저장 검증은 부트가 따로 한다.
 */
export function savedGraphicsQuality(raw: string | null | undefined, fallback: GraphicsQuality): GraphicsQuality {
  if (!raw) return fallback;
  try {
    const quality = (JSON.parse(raw) as { settings?: { presentation?: { graphicsQuality?: unknown } } })?.settings?.presentation?.graphicsQuality;
    return quality === "high" || quality === "balanced" || quality === "low" ? quality : fallback;
  } catch { return fallback; }
}

/**
 * 게임을 만들기 **전에** 저장에서 안티에일리어싱 선택만 읽는다. 값이 없으면 저장(없으면 기기)의 그래픽 품질에서 고른다.
 */
export function savedAntialias(raw: string | null | undefined, fallback: GraphicsQuality): boolean {
  if (raw) {
    try {
      const value = (JSON.parse(raw) as { settings?: { presentation?: { antialias?: unknown } } })?.settings?.presentation?.antialias;
      if (typeof value === "boolean") return value;
    } catch { /* 깨진 저장은 품질로 고른다 */ }
  }
  return defaultAntialias(savedGraphicsQuality(raw, fallback));
}

/** 브라우저가 말해 주는 성능 단서. 없는 환경(서버·시험)은 빈 값이다. Phaser는 읽지 않는다. */
export function navigatorDeviceProfile(): DeviceProfile {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

let cachedIdleKeep: IdleKeep | undefined;
/** 이 기기의 유휴 보관 수. 기기 단서는 실행 중에 바뀌지 않으므로 한 번만 읽는다. */
export function currentIdleKeep(): IdleKeep {
  return cachedIdleKeep ??= deviceIdleKeep(navigatorDeviceProfile());
}
