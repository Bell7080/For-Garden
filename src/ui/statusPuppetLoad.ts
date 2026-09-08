/** Puppet 로더의 성공·실패·지연 완료를 Phaser 없이 검증할 수 있게 만든 비동기 소유권 경계다. */
export interface DisposablePuppet {
  destroy(): void;
}

export type PuppetLoadResult = { status: "adopted" } | { status: "failed"; error: unknown } | { status: "discarded"; reason: "stale" | "not-displayable" };

/** 완료 결과를 현재 화면이 한 번만 소유하거나 한 번만 폐기하도록 판정한다. */
export async function loadOwnedPuppet<T extends DisposablePuppet>(options: {
  spawn: () => Promise<T>;
  isCurrent: () => boolean;
  isDisplayable: (puppet: T) => boolean;
  adopt: (puppet: T) => void;
}): Promise<PuppetLoadResult> {
  let puppet: T;
  try { puppet = await options.spawn(); } catch (error) { return { status: "failed", error }; }
  // 한 분기에서만 destroy하므로 늦은 완료와 표시 검증 실패가 겹쳐도 GPU 자원을 중복 폐기하지 않는다.
  if (!options.isCurrent()) { puppet.destroy(); return { status: "discarded", reason: "stale" }; }
  if (!options.isDisplayable(puppet)) { puppet.destroy(); return { status: "discarded", reason: "not-displayable" }; }
  options.adopt(puppet);
  return { status: "adopted" };
}

/**
 * 본체와 선택 장식을 병렬로 준비한 뒤 본체가 준비된 한 프레임에 함께 소유한다.
 *
 * 그림자를 먼저 `await`하고 본체를 나중에 만들면 느린 기기에서는 그림자만 오래 남는다. 반대로
 * 장식 실패가 본체까지 막아서는 안 되므로, 본체만 필수로 삼고 성공한 장식은 본체보다 먼저 붙인다.
 */
export async function loadOwnedPuppetPair<T extends DisposablePuppet>(options: {
  spawnPrimary: () => Promise<T>;
  spawnCompanion: () => Promise<T>;
  isCurrent: () => boolean;
  isDisplayable: (puppet: T) => boolean;
  adoptPrimary: (puppet: T) => void;
  adoptCompanion: (puppet: T) => void;
}): Promise<PuppetLoadResult> {
  // 둘을 동시에 조립해 그림자의 로딩 시간이 본체 로딩 앞에 직렬로 더해지지 않게 한다.
  const [primaryResult, companionResult] = await Promise.allSettled([options.spawnPrimary(), options.spawnCompanion()]);
  const companion = companionResult.status === "fulfilled" ? companionResult.value : undefined;
  if (primaryResult.status === "rejected") {
    companion?.destroy();
    return { status: "failed", error: primaryResult.reason };
  }

  const primary = primaryResult.value;
  if (!options.isCurrent()) {
    primary.destroy(); companion?.destroy();
    return { status: "discarded", reason: "stale" };
  }
  if (!options.isDisplayable(primary)) {
    primary.destroy(); companion?.destroy();
    return { status: "discarded", reason: "not-displayable" };
  }

  // 장식을 먼저 넣어 컨테이너의 그리기 순서에서도 본체가 반드시 마지막(앞)에 오게 한다.
  if (companion && options.isDisplayable(companion)) options.adoptCompanion(companion);
  else companion?.destroy();
  options.adoptPrimary(primary);
  return { status: "adopted" };
}
