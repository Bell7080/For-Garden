import Phaser from "phaser";
import { scrollHintSides, type ScrollHintRange } from "../core/scrollHint";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { COLOR } from "./theme";

export interface ScrollHintOptions {
  /** 보이는 창의 가운데(부모 좌표)와 크기. 표식은 창의 안쪽 끝에 선다. */
  x: number;
  y: number;
  width: number;
  height: number;
  axis?: "y" | "x";
  /** 지금 오프셋과 한계. 부를 때마다 읽으므로 목록이 바뀌어도 따라간다. */
  read: () => ScrollHintRange;
  /** 이 개체가 죽으면 표식도 함께 내려간다(목록을 다시 세울 때 쌓이지 않게). */
  owner?: Phaser.GameObjects.GameObject;
  depth?: number;
}

/** 꺾쇠의 크기·진하기·떠오르는 폭. 판 위의 글을 가리지 않게 옅고, 숨 쉬듯 한 뼘만 오간다. */
export const SCROLL_HINT_STYLE = { half: 20, depth: 11, line: 7, alpha: 0.5, fadeMs: 160, bob: 7, bobMs: 820, inset: 26 } as const;

function chevron(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const s = SCROLL_HINT_STYLE;
  const g = scene.add.graphics();
  const points = [{ x: -s.half, y: -s.depth / 2 }, { x: 0, y: s.depth / 2 }, { x: s.half, y: -s.depth / 2 }];
  g.lineStyle(s.line + 5, 0x05070a, 0.55).strokePoints(points.map((p) => ({ x: p.x, y: p.y + 2 })));
  g.lineStyle(s.line, COLOR.inkHex, 1).strokePoints(points);
  return g;
}

/**
 * 「이 판은 더 내려(넘겨) 볼 수 있다」를 알리는 약한 꺾쇠.
 *
 * 남은 내용이 있는 쪽 끝에서만 서고 글은 적지 않는다. 끝에 닿으면 사라진다. 움직임 줄이기에서는 떠오르지 않는다.
 * 목록마다 제 비교식을 적지 않도록 오프셋만 받아 `scrollHintSides`가 가른다.
 */
export function addScrollHint(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | undefined, options: ScrollHintOptions): { destroy: () => void } {
  const s = SCROLL_HINT_STYLE;
  const axis = options.axis ?? "y";
  const half = (axis === "y" ? options.height : options.width) / 2 - s.inset;
  const center = axis === "y" ? options.y : options.x;
  const place = (sign: 1 | -1): { x: number; y: number } => axis === "y" ? { x: options.x, y: center + sign * half } : { x: center + sign * half, y: options.y };
  // 뒤쪽(위·왼쪽)과 앞쪽(아래·오른쪽) 꺾쇠. 꺾쇠는 아래를 가리키는 모양을 돌려 쓴다.
  const rotation = { yBefore: Math.PI, yAfter: 0, xBefore: Math.PI / 2, xAfter: -Math.PI / 2 };
  const make = (sign: 1 | -1): Phaser.GameObjects.Container => {
    const at = place(sign);
    const node = scene.add.container(at.x, at.y).setAlpha(0).setVisible(false);
    if (options.depth !== undefined) node.setDepth(options.depth);
    const g = chevron(scene);
    g.setRotation(axis === "y" ? (sign < 0 ? rotation.yBefore : rotation.yAfter) : (sign < 0 ? rotation.xBefore : rotation.xAfter));
    node.add(g);
    parent?.add(node);
    return node;
  };
  const before = make(-1);
  const after = make(1);
  const still = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
  const bobs: Phaser.Tweens.Tween[] = [];
  if (!still) {
    // 꺾쇠가 가리키는 쪽으로 한 뼘 나갔다 돌아온다.
    for (const [node, sign] of [[before, -1], [after, 1]] as const) {
      const target = axis === "y" ? { y: node.y + sign * s.bob } : { x: node.x + sign * s.bob };
      bobs.push(scene.tweens.add({ targets: node, ...target, duration: s.bobMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
    }
  }
  const shown = new Map<Phaser.GameObjects.Container, boolean>([[before, false], [after, false]]);
  const sync = (node: Phaser.GameObjects.Container, on: boolean): void => {
    if (shown.get(node) === on || !node.active) return;
    shown.set(node, on);
    if (on) node.setVisible(true);
    scene.tweens.add({ targets: node, alpha: on ? s.alpha : 0, duration: s.fadeMs, onComplete: () => { if (!on && node.active) node.setVisible(false); } });
  };
  const update = (): void => {
    const sides = scrollHintSides(options.read());
    sync(before, sides.before);
    sync(after, sides.after);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  let done = false;
  const destroy = (): void => {
    if (done) return;
    done = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    bobs.forEach((tween) => tween.remove());
    before.destroy(); after.destroy();
  };
  options.owner?.once(Phaser.GameObjects.Events.DESTROY, destroy);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  return { destroy };
}
