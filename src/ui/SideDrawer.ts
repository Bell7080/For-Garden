import Phaser from "phaser";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR } from "./theme";
import { SIDE_DRAWER, sideDrawerHandleX, sideDrawerItemX, sideDrawerOffsetX } from "./sideDrawerLayout";

/**
 * 화면 왼쪽 가장자리에 접혀 들어가는 곁 버튼 서랍(자리 `SIDE_DRAWER`).
 *
 * 닫혀 있으면 가장자리에 손잡이 하나만 남고, 칩들은 **화면 밖에 숨어 손을 받지 않는다**(숨긴 객체는 Phaser가
 * 입력 후보에서 뺀다). 손잡이를 누르면 칩들이 밀려 나오고 꺾쇠가 돌아선다. 다시 누르면 들어간다.
 * 손잡이에는 꺾쇠와 함께 **안에 든 첫 칩의 그림**을 작게 세워 무엇이 들어 있는지 말한다.
 */
export class SideDrawer {
  readonly container: Phaser.GameObjects.Container;
  private readonly items: Phaser.GameObjects.Container;
  private readonly chevron: Phaser.GameObjects.Graphics;
  private readonly count: number;
  private open = false;

  constructor(private readonly scene: Phaser.Scene, children: Phaser.GameObjects.GameObject[], hint: "shop") {
    this.count = Math.max(1, children.length);
    this.container = scene.add.container(sideDrawerOffsetX(this.count, false), SIDE_DRAWER.y);
    this.items = scene.add.container(0, 0);
    children.forEach((child, index) => {
      (child as unknown as Phaser.GameObjects.Components.Transform).setPosition?.(sideDrawerItemX(index), 0);
      this.items.add(child);
    });
    this.items.setVisible(false);
    this.container.add(this.items);

    const { width, height } = SIDE_DRAWER.handle;
    const handle = scene.add.container(sideDrawerHandleX(this.count), 0);
    handle.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: width * 0.4, bottomRight: width * 0.4 } }), {
      fill: 0x2a2418, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.85,
    }));
    handle.add(drawGlyph(scene, hint, 0, -height * 0.22, width * 0.5, COLOR.accent));
    this.chevron = scene.add.graphics();
    handle.add(this.chevron);
    this.paintChevron();
    const hit = scene.add.rectangle(0, 0, width + 28, height + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(handle));
    hit.on("pointerout", () => pressOut(handle, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(handle); this.setOpen(!this.open); });
    handle.add(hit);
    this.container.add(handle);
  }

  get isOpen(): boolean { return this.open; }

  /** 서랍을 연다·닫는다. 닫히는 동안에도 칩은 이미 손을 받지 않는다(움직이는 칩을 누르는 일이 없게). */
  setOpen(open: boolean, instant = false): void {
    if (this.open === open && !instant) return;
    this.open = open;
    this.paintChevron();
    const target = sideDrawerOffsetX(this.count, open);
    this.scene.tweens.killTweensOf(this.container);
    if (open) this.items.setVisible(true);
    this.setItemsInput(false);
    const done = (): void => {
      this.container.x = target;
      this.items.setVisible(this.open);
      this.setItemsInput(this.open);
    };
    if (instant || session.settings.accessibility.reduceMotion) { done(); return; }
    this.scene.tweens.add({ targets: this.container, x: target, duration: SIDE_DRAWER.duration, ease: open ? "Back.Out" : "Quad.In", onComplete: done });
  }

  setVisible(visible: boolean): void {
    if (!visible) this.setOpen(false, true);
    this.container.setVisible(visible);
  }

  setDepth(depth: number): this { this.container.setDepth(depth); return this; }

  /** 칩들의 입력면을 켜고 끈다 — 밀려 나오는 도중에 누른 손이 상점으로 새지 않게 한다. */
  private setItemsInput(enabled: boolean): void {
    const walk = (object: Phaser.GameObjects.GameObject): void => {
      if (object.input) object.input.enabled = enabled;
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(walk);
    };
    walk(this.items);
  }

  /** 닫혀 있으면 `›`(밀어 낸다), 열려 있으면 `‹`(밀어 넣는다). */
  private paintChevron(): void {
    const { width, height } = SIDE_DRAWER.handle;
    const dir = this.open ? -1 : 1;
    const w = width * 0.16; const h = height * 0.13; const cy = height * 0.2;
    const points = [new Phaser.Math.Vector2(-w * dir, cy - h), new Phaser.Math.Vector2(w * dir, cy), new Phaser.Math.Vector2(-w * dir, cy + h)];
    this.chevron.clear();
    this.chevron.lineStyle(9, 0x000000, 0.5).strokePoints(points.map((p) => new Phaser.Math.Vector2(p.x + 1, p.y + 3)), false);
    this.chevron.lineStyle(5, COLOR.accent, 1).strokePoints(points, false);
  }
}
