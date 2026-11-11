/**
 * 화면을 채우는 조회가 한 번 실패해도 빈 판으로 굳지 않게 다시 묻는다.
 *
 * 게임에 막 들어온 순간에는 로비가 여러 호출을 한꺼번에 내보내고 인증 토큰도 갓 갱신되는 중이라, 상점 목록 조회
 * 한 번이 네트워크 끊김·시간 초과·오래된 응답(stale)으로 떨어질 수 있다. 예전에는 그 한 번이 실패하면 화면이
 * 아무것도 그리지 않은 채 남아 「상품이 보이지 않는」 프리미엄·상점이 되었다.
 *
 * 기다림은 씬 시계가 아니라 `setTimeout`이다 — 씬 타이머는 프레임이 돌아야 깨어나 바쁜 기기에서 한참 늦는다.
 * `alive`가 거짓이 되면(화면을 떠났거나 더 새 조회가 시작됐으면) 더 묻지 않고 `undefined`로 끝난다.
 * 규칙이 거절한 호출(`retryable`이 거짓)은 다시 물어도 같은 답이므로 곧바로 던진다.
 */
export const READ_RETRY_DELAYS_MS: readonly number[] = [400, 1000, 2000, 4000, 8000];

export interface ReadRetryOptions {
  alive: () => boolean;
  delays?: readonly number[];
  /** 다시 물을 만한 실패인가. 기본은 모두 다시 묻는다. */
  retryable?: (error: unknown) => boolean;
  wait?: (ms: number) => Promise<void>;
}

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function readWithRetry<T>(read: () => Promise<T>, options: ReadRetryOptions): Promise<T | undefined> {
  const delays = options.delays ?? READ_RETRY_DELAYS_MS;
  const wait = options.wait ?? defaultWait;
  for (let attempt = 0; ; attempt += 1) {
    if (!options.alive()) return undefined;
    try {
      return await read();
    } catch (error) {
      if (options.retryable && !options.retryable(error)) throw error;
      if (attempt >= delays.length) throw error;
      await wait(delays[attempt]!);
    }
  }
}
