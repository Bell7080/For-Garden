/**
 * 한 프레임에서 예외가 터져도 게임 루프가 멈추지 않게 감싸는 순수 규칙.
 *
 * Phaser는 프레임 콜백을 부른 **다음에** 다음 `requestAnimationFrame`을 예약한다. 그래서 어느 한
 * 프레임의 업데이트·렌더에서 예외가 하나만 나가도 루프가 통째로 죽어 화면이 그 자리에 얼어붙는다
 * (플레이어에게는 "게임이 멎었다 / 튕겼다"로 읽힌다). 죽은 마스크를 가리킨 렌더가 그랬다.
 * 감싼 콜백은 예외를 삼키지 않고 `onError`로 알리되 루프는 계속 돌려, 일시적인 오류는 다음
 * 프레임에 스스로 회복하게 한다.
 *
 * **같은 오류가 계속되면 멈춘다는 신호를 낸다**(`onStuck`) — 매 프레임 터지는 오류를 모른 척하고
 * 검은 화면을 그리는 것은 회복이 아니기 때문이다. 연속 실패가 `stuckAfter`에 닿으면 한 번만 알린다.
 */
export function guardFrame<Args extends unknown[]>(
  frame: (...args: Args) => void,
  onError: (error: unknown, consecutive: number) => void,
  onStuck: (error: unknown) => void,
  stuckAfter = 120,
): (...args: Args) => void {
  let consecutive = 0;
  let reportedStuck = false;
  return (...args: Args): void => {
    try {
      frame(...args);
      consecutive = 0;
      reportedStuck = false;
    } catch (error) {
      consecutive += 1;
      onError(error, consecutive);
      if (consecutive >= stuckAfter && !reportedStuck) {
        reportedStuck = true;
        onStuck(error);
      }
    }
  };
}
