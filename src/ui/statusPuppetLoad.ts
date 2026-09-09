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
