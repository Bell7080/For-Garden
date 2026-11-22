/**
 * WebGL 컨텍스트를 잃고 돌아오지 않을 때의 규칙(순수 계산 — 시계와 저장소는 부르는 쪽이 넘긴다).
 *
 * 모바일 브라우저는 GPU 메모리가 모자라거나 GPU 프로세스가 죽으면 컨텍스트를 거둔다. 대개 곧 되돌려 주고
 * Phaser가 다시 그리지만, 같은 일이 되풀이되면 브라우저가 그 페이지의 WebGL을 막아 **복구 사건이 영영 오지 않는다** —
 * 화면은 까맣게 굳고 오디오만 계속 나온다(2026-11-22 갤럭시 노트20 제보). 그때는 페이지를 새로 띄우는 것 말고는
 * 화면을 되살릴 길이 없다. 다만 새로 띄운 뒤 같은 화면에서 또 잃으면 무한히 새로 띄우게 되므로 횟수를 묶는다.
 */
export const WEBGL_RECOVERY = {
  /** 잃은 뒤 이만큼 (보이는 동안) 기다려도 돌아오지 않으면 새로 띄운다. */
  restoreWaitMs: 4_000,
  /** 새로 띄우기 직전에 보고가 나갈 틈. */
  reportGraceMs: 1_500,
  /** 이 시간 안에 */
  windowMs: 10 * 60_000,
  /** 이만큼 새로 띄웠으면 더는 새로 띄우지 않는다. */
  maxReloads: 2,
} as const;

/** 지난 새로 띄우기 시각 목록에서 지금 또 새로 띄워도 되는가. */
export function mayReloadAfterContextLoss(history: readonly number[], now: number): boolean {
  const recent = history.filter((at) => Number.isFinite(at) && now - at >= 0 && now - at < WEBGL_RECOVERY.windowMs);
  return recent.length < WEBGL_RECOVERY.maxReloads;
}

/** 저장해 둘 목록 — 창 밖의 오래된 기록은 버리고 지금을 더한다. */
export function nextReloadHistory(history: readonly number[], now: number): number[] {
  return [...history.filter((at) => Number.isFinite(at) && now - at >= 0 && now - at < WEBGL_RECOVERY.windowMs), now];
}

/** 저장소에서 읽은 글을 시각 목록으로. 깨진 값은 빈 목록이다. */
export function parseReloadHistory(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((at): at is number => typeof at === "number" && Number.isFinite(at)) : [];
  } catch {
    return [];
  }
}
