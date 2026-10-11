import Phaser from "phaser";
import type { GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { LOBBY_MENU_BUTTON, LOBBY_MENU_TRAY, lobbyMenuTrayLayout } from "./lobbyMenuLayout";
import { RailButton } from "./RailButton";
import { pressIn, pressOut } from "./pressFeedback";
import { session } from "../state/session";
import { COLOR } from "./theme";

export interface LobbyMenuItem {
  icon: GlyphName;
  label: string;
  onClick: () => void;
}

/**
 * 로비 메뉴 — 가방 아래 햄버거 단추와, 누르면 옆에서 슉 나오는 한 줄짜리 판.
 *
 * 판은 전투 기여도 판과 같은 문법이다: 화면 밖에서 밀려 들어오고, 접으면 **완전히** 나간다. 판 밖을
 * 누르거나 칩을 누르면 접힌다.
 */
export class LobbyMenuTray {
  private readonly tray: Phaser.GameObjects.Container;
  private readonly layout: ReturnType<typeof lobbyMenuTrayLayout>;
  private open = false;
  private slide?: Phaser.Tweens.Tween;
  private outsideTap?: (pointer: Phaser.Input.Pointer) => void;

  constructor(private readonly scene: Phaser.Scene, items: readonly LobbyMenuItem[], depth = 320) {
    this.layout = lobbyMenuTrayLayout(items.length);
    const { bounds, chips, slideOut } = this.layout;

    // 판은 접힌 자리(화면 밖)에서 시작한다.
    this.tray = scene.add.container(slideOut, 0).setDepth(depth).setVisible(false);
    const shape = chipPoints(bounds.width, bounds.height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
    this.tray.add(drawLayer(scene, bounds.x, bounds.y, shape, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
    items.forEach((item, index) => {
      const chip = new RailButton(scene, chips[index].x, chips[index].y, {
        icon: item.icon, label: item.label, size: LOBBY_MENU_TRAY.chip,
        onClick: () => { this.close(); item.onClick(); },
      });
      this.tray.add(chip);
    });

    this.buildButton(depth + 1);
  }

  /** 가로줄 셋짜리 단추. 칸 하나가 곧 입력면이다. */
  private buildButton(depth: number): void {
    const { x, y, width } = LOBBY_MENU_BUTTON;
    const button = this.scene.add.container(x, y).setDepth(depth);
    const shape = chipPoints(width, width, { bevel: { topLeft: width * 0.3, topRight: 0, bottomRight: width * 0.3, bottomLeft: 0 } });
    button.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const lines = this.scene.add.graphics();
    lines.fillStyle(0xd2d6dc, 1);
    const barW = width * 0.46;
    const barH = 5;
    for (const dy of [-12, 0, 12]) lines.fillRect(-barW / 2, dy - barH / 2, barW, barH);
    button.add(lines);
    const hit = this.scene.add.rectangle(0, 0, width, width, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(button));
    hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(button); this.toggle(); });
    button.add(hit);
    button.setSize(width, width);
  }

  toggle(): void { if (this.open) this.close(); else this.show(); }

  private show(): void {
    if (this.open) return;
    this.open = true;
    this.tray.setVisible(true);
    this.moveTo(0);
    // 판 밖을 누르면 접힌다. 칩을 누른 같은 틱에 닫히지 않도록 다음 틱에 건다.
    this.scene.time.delayedCall(0, () => {
      if (!this.open) return;
      this.outsideTap = (pointer) => { if (!this.contains(pointer)) this.close(); };
      this.scene.input.on("pointerup", this.outsideTap);
    });
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    if (this.outsideTap) { this.scene.input.off("pointerup", this.outsideTap); this.outsideTap = undefined; }
    this.moveTo(this.layout.slideOut, () => this.tray.setVisible(false));
  }

  private contains(pointer: Phaser.Input.Pointer): boolean {
    const { bounds } = this.layout;
    const buttonHit = Math.abs(pointer.worldX - LOBBY_MENU_BUTTON.x) <= LOBBY_MENU_BUTTON.width / 2 && Math.abs(pointer.worldY - LOBBY_MENU_BUTTON.y) <= LOBBY_MENU_BUTTON.height / 2;
    const trayHit = Math.abs(pointer.worldX - bounds.x) <= bounds.width / 2 && Math.abs(pointer.worldY - bounds.y) <= bounds.height / 2;
    return buttonHit || trayHit;
  }

  private moveTo(x: number, onDone?: () => void): void {
    this.slide?.stop();
    const duration = session.settings.accessibility.reduceMotion ? 0 : LOBBY_MENU_TRAY.slideMs;
    if (duration === 0) { this.tray.x = x; onDone?.(); return; }
    this.slide = this.scene.tweens.add({ targets: this.tray, x, duration, ease: "Cubic.easeOut", onComplete: onDone });
  }
}

/** 칩에 쓰는 글리프 이름을 한곳에서 정한다. */
export const LOBBY_MENU_GLYPH = { recollection: "scroll", achievement: "arena-tier" } as const satisfies Record<string, GlyphName>;
