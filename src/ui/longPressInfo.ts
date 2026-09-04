import Phaser from "phaser";
import { COLOR } from "./theme";
import { LONG_PRESS, longPressProgress } from "./longPressGauge";

/**
 * 꾹 눌러 여는 조작 하나.
 *
 * 그리드가 있는 화면마다 타이머를 따로 달면 어디서는 400ms, 어디서는 안 열리는 화면이 남는다.
 * 시간·연출·취소 규칙을 여기 한 곳에 두고 각 화면은 "무엇을 열지"만 넘긴다.
 *
 * **누르는 동안 동그란 게이지가 찬다.** 아무 반응 없이 기다리게 하면 길게 누르는 조작이 있다는
 * 것 자체를 모르고, 손을 언제 떼야 하는지도 알 수 없다. 게이지가 한 바퀴 도는 순간이 곧
 * 열리는 순간이다.
 */
export interface LongPressOptions {
  /** 게이지가 한 바퀴 돌면 부른다. */
  onLongPress: () => void;
  /** 그 전에 손을 떼면 부른다. 없으면 짧은 탭은 아무 일도 하지 않는다. */
  onTap?: () => void;
  /** 게이지를 그릴 깊이. 눌린 카드보다 앞이어야 보인다. */
  depth?: number;
  /** 지금 눌러도 되는지. 잠긴 화면에서는 게이지도 뜨지 않는다. */
  enabled?: () => boolean;
  /** 짧은 탭을 확정해도 되는지. 스크롤 그리드는 끌린 거리로 판단한다. */
  allowTap?: () => boolean;
}

/**
 * 입력면 하나에 짧은 탭과 꾹 누름을 함께 건다.
 *
 * **눌린 시간은 벽시계가 아니라 입력 사건의 시각으로 잰다**(`pointer.downTime`·`upTime`).
 * 벽시계로 재면 화면이 한 번 밀리는 동안 손가락은 이미 뗐는데도 그 사이가 눌린 시간으로 잡혀,
 * 톡 친 손이 꾹 누름으로 읽히고 원래 조작(편성 토글·궁극기)이 통째로 사라진다. 사건 시각은
 * 브라우저가 실제로 그 입력을 받은 때라 메인 스레드가 막혀도 흔들리지 않는다.
 *
 * 게이지가 다 차서 먼저 여는 길도 **손가락이 아직 눌려 있을 때만** 지난다.
 */
export function bindLongPress(
  scene: Phaser.Scene,
  hit: Phaser.GameObjects.GameObject,
  options: LongPressOptions,
): void {
  let startedAt = 0;
  /** 입력 사건이 말하는 누른 시각. 브라우저가 그 입력을 받은 때라 프레임이 밀려도 흔들리지 않는다. */
  let downAt = 0;
  let fired = false;
  let gauge: Phaser.GameObjects.Graphics | undefined;
  let ticker: (() => void) | undefined;

  const stop = (): void => {
    if (ticker) { scene.events.off(Phaser.Scenes.Events.UPDATE, ticker); ticker = undefined; }
    const current = gauge;
    gauge = undefined;
    if (!current) return;
    // 곧바로 지우지 않고 짧게 걷어야 "다 찼다"가 눈에 남는다.
    scene.tweens.add({ targets: current, alpha: 0, duration: LONG_PRESS.fadeMs, onComplete: () => current.destroy() });
  };

  const draw = (x: number, y: number, ratio: number): void => {
    if (!gauge) return;
    gauge.clear();
    gauge.lineStyle(LONG_PRESS.width, COLOR.void, 0.55);
    gauge.strokeCircle(x, y, LONG_PRESS.radius);
    if (ratio <= 0) return;
    gauge.lineStyle(LONG_PRESS.width, COLOR.accent, 0.95);
    gauge.beginPath();
    // 12시에서 시계 방향으로 찬다 — 카드 충전·상태 시계와 같은 방향이다.
    gauge.arc(x, y, LONG_PRESS.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    gauge.strokePath();
  };

  const cancel = (): void => { stop(); startedAt = 0; downAt = 0; };

  hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (options.enabled && !options.enabled()) return;
    fired = false;
    startedAt = Date.now();
    downAt = pointer.downTime;
    stop();
    gauge = scene.add.graphics().setDepth(options.depth ?? 900);
    const { x, y } = pointer;
    draw(x, y, 0);
    ticker = () => {
      // 끌기로 넘어간 손가락은 스크롤이지 꾹 누름이 아니다. 활성 포인터를 직접 보므로
      // 화면마다 pointermove 배선을 다시 깔지 않는다.
      const now = scene.input.activePointer;
      // 손을 이미 뗐으면 여기서 열지 않는다. 프레임이 밀려 pointerup이 늦게 오면 게이지가 그
      // 사이에 한 바퀴를 돌아, 톡 친 손이 꾹 누름으로 열려 버린다.
      if (!now.isDown) { cancel(); return; }
      if (Phaser.Math.Distance.Between(x, y, now.x, now.y) > LONG_PRESS.moveSlop) { cancel(); return; }
      const ratio = longPressProgress(Date.now() - startedAt);
      draw(x, y, ratio);
      if (ratio < 1 || fired) return;
      fired = true;
      stop();
      options.onLongPress();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, ticker);
  });

  hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    stop();
    if (startedAt === 0) return;
    // 사건 시각이 둘 다 있으면 그것만 믿는다. 없을 때만 벽시계로 되돌아간다.
    const byEvent = pointer.upTime - downAt;
    const heldMs = downAt > 0 && Number.isFinite(byEvent) && byEvent >= 0 ? byEvent : Date.now() - startedAt;
    startedAt = 0;
    downAt = 0;
    if (fired) return;
    if (heldMs >= LONG_PRESS.ms) options.onLongPress();
    else if (!options.allowTap || options.allowTap()) options.onTap?.();
  });

  hit.on("pointerout", cancel);
  hit.on("pointerupoutside", cancel);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
}
