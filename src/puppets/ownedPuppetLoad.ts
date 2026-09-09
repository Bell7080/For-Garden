/** 화면이 비동기 Puppet 결과를 정확히 한 번 소유하거나 폐기하게 하는 공용 경계다. */
export interface DisposablePuppet {
  destroy(): void;
}

/** 소유 Puppet 한 개가 제한 재시도 경계에서 거치는 사용자 가시 준비 단계다. */
export type PuppetLoadAttemptState = "loading" | "retrying" | "failed";

export type PuppetLoadResult = { status: "adopted" } | { status: "failed"; error: unknown } | { status: "discarded"; reason: "stale" | "not-displayable" };

/** 완료 결과의 세대와 표시 가능성을 검사한 뒤 단일 분기에서만 destroy한다. */
export async function loadOwnedPuppet<T extends DisposablePuppet>(options: {
  spawn: () => Promise<T>;
  isCurrent: () => boolean;
  isDisplayable: (puppet: T) => boolean;
  adopt: (puppet: T) => void;
}): Promise<PuppetLoadResult> {
  let puppet: T;
  try { puppet = await options.spawn(); } catch (error) { return { status: "failed", error }; }
  // 늦은 완료와 표시 검증 실패가 겹쳐도 아래 한 분기만 자원을 폐기한다.
  if (!options.isCurrent()) { puppet.destroy(); return { status: "discarded", reason: "stale" }; }
  if (!options.isDisplayable(puppet)) { puppet.destroy(); return { status: "discarded", reason: "not-displayable" }; }
  options.adopt(puppet);
  return { status: "adopted" };
}

/** 캐시에서 실패 Promise가 빠질 microtask와 짧은 간격을 보장하며 새 spawn 요청을 제한 횟수만 보낸다. */
export async function loadOwnedPuppetWithRetry<T extends DisposablePuppet>(options: {
  spawn: () => Promise<T>;
  isCurrent: () => boolean;
  isDisplayable: (puppet: T) => boolean;
  adopt: (puppet: T) => void;
  attempts?: number;
  retryDelayMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
  /** 호출 화면이 원인을 해석하지 않고 준비 표현만 바꿀 수 있도록 시도 단계만 알린다. */
  onStateChange?: (state: PuppetLoadAttemptState) => void;
}): Promise<PuppetLoadResult> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let last: PuppetLoadResult = { status: "failed", error: new Error("Puppet load was not attempted") };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // 세대가 바뀐 뒤에는 네트워크/GPU 작업 자체를 새로 시작하지 않는다.
    if (!options.isCurrent()) return { status: "discarded", reason: "stale" };
    options.onStateChange?.(attempt === 0 ? "loading" : "retrying");
    last = await loadOwnedPuppet(options);
    if (last.status !== "failed") return last;
    if (attempt + 1 < attempts) await wait(options.retryDelayMs ?? 120);
  }
  // 모든 시도가 끝난 뒤에만 최종 실패를 게시해 일시 오류가 경고로 번쩍이지 않게 한다.
  options.onStateChange?.("failed");
  return last;
}

/** 본체와 장식을 병렬 준비하되 본체 성공 프레임에만 둘을 함께 소유한다. */
export async function loadOwnedPuppetPair<T extends DisposablePuppet>(options: {
  spawnPrimary: () => Promise<T>; spawnCompanion: () => Promise<T>;
  isCurrent: () => boolean; isDisplayable: (puppet: T) => boolean;
  adoptPrimary: (puppet: T) => void; adoptCompanion: (puppet: T) => void;
}): Promise<PuppetLoadResult> {
  const [primaryResult, companionResult] = await Promise.allSettled([options.spawnPrimary(), options.spawnCompanion()]);
  const companion = companionResult.status === "fulfilled" ? companionResult.value : undefined;
  if (primaryResult.status === "rejected") { companion?.destroy(); return { status: "failed", error: primaryResult.reason }; }
  const primary = primaryResult.value;
  if (!options.isCurrent()) { primary.destroy(); companion?.destroy(); return { status: "discarded", reason: "stale" }; }
  if (!options.isDisplayable(primary)) { primary.destroy(); companion?.destroy(); return { status: "discarded", reason: "not-displayable" }; }
  // 장식을 먼저 채택해 본체가 최종 그리기 순서에서도 앞에 오게 한다.
  if (companion && options.isDisplayable(companion)) options.adoptCompanion(companion); else companion?.destroy();
  options.adoptPrimary(primary);
  return { status: "adopted" };
}
