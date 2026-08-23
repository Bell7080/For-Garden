/** Phaser와 무관한 궁극기 직렬화 큐. 씬은 토큰을 연출 취소 식별자로만 사용한다. */
export interface UltimateSequenceState {
  activeToken: number | null;
  queue: string[];
  nextToken: number;
}

export function createUltimateSequenceState(): UltimateSequenceState {
  return { activeToken: null, queue: [], nextToken: 1 };
}

/** 이미 연출 중인 전투원의 중복 예약을 막고 자동 궁극기는 편성 순서대로 쌓는다. */
export function enqueueUltimate(state: UltimateSequenceState, fighterId: string): boolean {
  if (state.queue.includes(fighterId)) return false;
  state.queue.push(fighterId);
  return true;
}

/** 활성 연출이 없을 때만 다음 전투원을 꺼내며 고유 토큰을 잠금으로 남긴다. */
export function beginNextUltimate(state: UltimateSequenceState): { fighterId: string; token: number } | null {
  if (state.activeToken !== null) return null;
  const fighterId = state.queue.shift();
  if (!fighterId) return null;
  const token = state.nextToken++;
  state.activeToken = token;
  return { fighterId, token };
}

/** 오래된 비동기 완료가 새 잠금을 풀지 못하도록 토큰이 같은 경우에만 해제한다. */
export function releaseUltimate(state: UltimateSequenceState, token: number): boolean {
  if (state.activeToken !== token) return false;
  state.activeToken = null;
  return true;
}

/** 씬 종료·전투 종료에서는 예약과 활성 토큰을 한 번에 무효화한다. */
export function cancelUltimateSequence(state: UltimateSequenceState): void {
  state.queue.length = 0;
  state.activeToken = null;
  state.nextToken += 1;
}
