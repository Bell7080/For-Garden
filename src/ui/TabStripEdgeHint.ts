import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { NOTIFICATION_DOT_STYLE } from "./notificationDotStyle";

export interface TabStripEdgeHintOptions {
  /** 창의 왼쪽·오른쪽 끝과 라벨 줄의 세로 가운데·높이(부모 좌표). */
  left: number;
  right: number;
  y: number;
  height: number;
  /** 끝 발광을 누르면 그 쪽의 가려진 라벨로 간다. */
  onTap?: (side: "left" | "right") => void;
}

/** 붉은 기운이 창 안쪽으로 스며드는 폭과 진하기. 점의 색을 그대로 쓰되 라벨 글자를 덮지 않게 옅다. */
const GLOW = { width: 96, alpha: 0.5, pulseLow: 0.45, pulseMs: 760 } as const;

/**
 * 옆으로 흐르는 라벨 줄의 끝에서 「창 밖에 받을 것이 남았다」를 알리는 표식.
 *
 * 가려진 라벨에 붉은 점이 있으면 그 쪽 끝에서 같은 붉은빛이 안쪽으로 스며들고, 끝에 붉은 점과 같은
 * 결(흰 외곽선 · 검은 그림자)의 작은 꺾쇠가 바깥을 가리키며 숨 쉰다. 글은 적지 않는다 — 색과 꺾쇠가
 * 「저쪽에 새 소식」을 이미 말하고, 문장을 세우면 좁은 줄 끝에서 라벨을 가린다.
 */
export class TabStripEdgeHint {
  private readonly sides: Record<"left" | "right", Phaser.GameObjects.Container>;
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | undefined, options: TabStripEdgeHintOptions) {
    const make = (side: "left" | "right"): Phaser.GameObjects.Container => {
      const edgeX = side === "left" ? options.left : options.right;
      const inward = side === "left" ? 1 : -1;
      const node = scene.add.container(edgeX, options.y).setVisible(false);
      const glow = scene.add.graphics();
      const red = NOTIFICATION_DOT_STYLE.fill;
      const outer = GLOW.alpha; const inner = 0;
      // 끝에서 진하고 안쪽으로 갈수록 사라지는 가로 기운.
      if (inward > 0) glow.fillGradientStyle(red, red, red, red, outer, inner, outer, inner);
      else glow.fillGradientStyle(red, red, red, red, inner, outer, inner, outer);
      glow.fillRect(inward > 0 ? 0 : -GLOW.width, -options.height / 2, GLOW.width, options.height);
      // 끝을 긋는 붉은 선 한 줄 — 기운만으로는 밝은 판 위에서 경계가 흐리다.
      glow.fillStyle(red, 0.9).fillRect(inward > 0 ? 0 : -4, -options.height / 2, 4, options.height);
      node.add(glow);
      const chevron = scene.add.graphics();
      const cx = inward * 26; const size = 13;
      const tip = cx - inward * size * 0.6; const back = cx + inward * size * 0.4;
      const vec = [{ x: back, y: -size }, { x: tip, y: 0 }, { x: back, y: size }];
      chevron.lineStyle(13, NOTIFICATION_DOT_STYLE.shadow, NOTIFICATION_DOT_STYLE.shadowAlpha).strokePoints(vec.map((p) => ({ x: p.x, y: p.y + NOTIFICATION_DOT_STYLE.shadowOffsetY })));
      chevron.lineStyle(12, NOTIFICATION_DOT_STYLE.outline, 1).strokePoints(vec);
      chevron.lineStyle(6, red, 1).strokePoints(vec);
      node.add(chevron);
      if (options.onTap) {
        const zone = scene.add.zone(inward * GLOW.width / 2, 0, GLOW.width, options.height).setInteractive({ useHandCursor: true });
        zone.on("pointerup", () => { if (node.visible) options.onTap?.(side); });
        node.add(zone);
      }
      parent?.add(node);
      if (motionPolicy(session.settings).nonEssentialRepeatFactor > 0) {
        this.tweens.push(scene.tweens.add({ targets: node, alpha: GLOW.pulseLow, duration: GLOW.pulseMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
        this.tweens.push(scene.tweens.add({ targets: chevron, x: -inward * 5, duration: GLOW.pulseMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
      }
      return node;
    };
    this.sides = { left: make("left"), right: make("right") };
  }

  setSides(sides: { left: boolean; right: boolean }): void {
    if (this.sides.left.active) this.sides.left.setVisible(sides.left);
    if (this.sides.right.active) this.sides.right.setVisible(sides.right);
  }

  /** 줄을 담은 컨테이너 위에 서야 하므로 깊이를 맞출 때 쓴다(씬 직속일 때). */
  setDepth(depth: number): this { this.sides.left.setDepth(depth); this.sides.right.setDepth(depth); return this; }

  destroy(): void {
    this.tweens.forEach((tween) => tween.remove());
    this.sides.left.destroy(); this.sides.right.destroy();
  }
}
