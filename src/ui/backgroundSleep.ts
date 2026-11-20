/**
 * 앱이 뒤로 가면 게임 루프를 **실제로** 재운다.
 *
 * Phaser 3.90의 숨김 처리(`Game.onHidden` → `TimeStep.pause`)는 멈춘 시각만 적고 `requestAnimationFrame`은
 * 그대로 둔다 — 화면을 멈추는 일을 브라우저의 rAF 감속에 맡긴 셈이다. 데스크톱 브라우저 탭은 그렇게 멈추지만,
 * 앱을 홈으로 내리거나 다른 앱 위로 덮은 모바일 웹뷰는 rAF를 계속 주는 경우가 있어 보이지 않는 화면을 60fps로
 * 그리며 발열·배터리를 쓴다(게임을 끈 뒤에도 폰이 뜨겁고 느린 원인 후보). 숨김에서 `sleep`으로 rAF를 멈추고
 * 돌아오면 `wake`한다. 복귀 시 큰 delta는 Phaser의 `onVisible`(먼저 등록된 리스너)이 `resetDelta`로 이미
 * 지운 뒤라, 전투·트윈이 그 사이 시간을 한 번에 몰아 돌리지 않는다 — 지금 탭이 숨었다 돌아올 때와 같다.
 */

/** Phaser `Core.Events.HIDDEN`·`VISIBLE`과 같은 값(테스트가 Phaser를 읽지 않도록 문자열로 둔다). */
export const GAME_HIDDEN_EVENT = "hidden";
export const GAME_VISIBLE_EVENT = "visible";

interface SleepableGame {
  events: { on(event: string, fn: () => void): unknown };
  loop: { sleep(): void; wake(seamless?: boolean): void };
}

export function installBackgroundSleep(game: SleepableGame): void {
  game.events.on(GAME_HIDDEN_EVENT, () => game.loop.sleep());
  game.events.on(GAME_VISIBLE_EVENT, () => game.loop.wake());
}
