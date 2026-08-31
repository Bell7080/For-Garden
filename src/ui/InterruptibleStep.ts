/**
 * 외부 런타임의 완료 콜백을 Promise로 바꾸고, 소유 객체가 사라질 때 같은 대기를 해제한다.
 * Phaser 타입을 의존하지 않아 tween·timer·Scene 종료가 공유하는 수명주기 계약을 단위 테스트할 수 있다.
 */
export class InterruptibleStep {
  private pending?: { finish: () => void; cleanup: () => void };

  /** 한 번에 한 단계만 소유하며 complete와 stop이 겹쳐 와도 최초 신호만 처리한다. */
  wait(start: (finish: () => void) => (() => void)): Promise<void> {
    // 잘못 겹친 단계도 이전 호출자를 방치하지 않고 먼저 중단한다.
    this.cancel();
    return new Promise((resolve) => {
      let settled = false;
      let cleanup = (): void => undefined;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (this.pending?.finish === finish) this.pending = undefined;
        resolve();
      };
      this.pending = { finish, cleanup: () => cleanup() };
      cleanup = start(finish);
      // start가 동기적으로 끝난 경우에는 이미 완료된 자원을 pending으로 되살리지 않는다.
      if (settled) this.pending = undefined;
    });
  }

  /** destroy/Scene shutdown은 Promise를 먼저 풀고 나서 tween 또는 timer를 제거한다. */
  cancel(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = undefined;
    pending.finish();
    pending.cleanup();
  }
}
