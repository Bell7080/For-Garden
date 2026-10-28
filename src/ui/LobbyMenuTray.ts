import Phaser from "phaser";
import type { GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { LOBBY_MENU_BUTTON, LOBBY_MENU_TRAY, lobbyMenuTrayLayout } from "./lobbyMenuLayout";
import { RailButton } from "./RailButton";
import { pressIn, pressOut } from "./pressFeedback";
import { session } from "../state/session";
import { COLOR } from "./theme";
import type { NotificationKey } from "../core/notifications";
import { notificationManager } from "../managers/NotificationManager";
import { bindNotificationDot } from "./NotificationDot";

export interface LobbyMenuItem {
  icon: GlyphName;
  label: string;
  onClick: () => void;
  /** 받을 것이 남았을 때 칩과 접힌 단추에 빨간 점을 세우는 알림. */
  notice?: NotificationKey;
}

/**
 * 로비 메뉴 — 가방 아래 햄버거 단추와, 누르면 단추가 사라지고 그 자리에서 펼쳐지는 한 줄짜리 판.
 *
 * 판은 전투 기여도 판과 같은 문법이다: 화면 밖에서 밀려 들어오고, 접으면 **완전히** 나간다. 판 밖을
 * 누르면 접힌다. 칩을 눌러 연 창(회고 등)이 떠 있는 동안과 창을 닫는 누름에는 접히지 않고 판이 그대로
 * 남는다 — 창을 닫고 돌아왔을 때 다른 칩을 바로 이어 고를 수 있어야 한다.
 */
export class LobbyMenuTray {
  private readonly tray: Phaser.GameObjects.Container;
  private readonly layout: ReturnType<typeof lobbyMenuTrayLayout>;
  private open = false;
  private button?: Phaser.GameObjects.Container;
  private slide?: Phaser.Tweens.Tween;
  private outsideTap?: (pointer: Phaser.Input.Pointer) => void;
  private outsideDown?: () => void;
  /** 누르기 시작한 순간 창이 떠 있었는가 — 창을 닫는 누름이 떼는 시점에 판까지 접지 않게 한다. */
  private pressedOverPopup = false;

  constructor(private readonly scene: Phaser.Scene, items: readonly LobbyMenuItem[], depth = 320, private readonly isPopupOpen: () => boolean = () => false) {
    this.layout = lobbyMenuTrayLayout(items.length);
    const { bounds, chips, slideOut } = this.layout;

    // 판은 접힌 자리(화면 밖)에서 시작한다.
    this.tray = scene.add.container(slideOut, 0).setDepth(depth).setVisible(false);
    const shape = chipPoints(bounds.width, bounds.height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
    this.tray.add(drawLayer(scene, bounds.x, bounds.y, shape, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
    items.forEach((item, index) => {
      const chip = new RailButton(scene, chips[index].x, chips[index].y, {
        icon: item.icon, label: item.label, size: LOBBY_MENU_TRAY.chip,
        onClick: () => item.onClick(),
      });
      this.tray.add(chip);
      if (item.notice) bindNotificationDot(scene, chip, { x: 42, y: -42 }, (listener) => notificationManager.subscribe(item.notice!, listener));
    });

    this.buildButton(depth + 1);
    // 접힌 단추도 같은 점을 단다 — 판을 열기 전에 안에 받을 것이 있다는 것이 보여야 한다.
    const notices = items.flatMap((item) => (item.notice ? [item.notice] : []));
    if (this.button && notices.length > 0) bindNotificationDot(scene, this.button, { x: LOBBY_MENU_BUTTON.width / 2 - 8, y: -LOBBY_MENU_BUTTON.width / 2 + 8 }, (listener) => {
      const visible = new Map<NotificationKey, boolean>();
      const offs = notices.map((key) => notificationManager.subscribe(key, (on) => { visible.set(key, on); listener([...visible.values()].some(Boolean)); }));
      return () => offs.forEach((off) => off());
    });
  }

  /** 가로줄 셋짜리 단추. 칸 하나가 곧 입력면이다. */
  private buildButton(depth: number): void {
    const { x, y, width } = LOBBY_MENU_BUTTON;
    const button = this.scene.add.container(x, y).setDepth(depth);
    this.button = button;
    const shape = chipPoints(width, width, { bevel: { topLeft: width * 0.3, topRight: 0, bottomRight: width * 0.3, bottomLeft: 0 } });
    button.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const lines = this.scene.add.graphics();
    lines.fillStyle(0xd2d6dc, 1);
    const barW = width * 0.46;
    const barH = 6;
    for (const dy of [-16, 0, 16]) lines.fillRect(-barW / 2, dy - barH / 2, barW, barH);
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
    this.button?.setVisible(false);
    this.tray.setVisible(true);
    this.moveTo(0);
    // 판 밖을 누르면 접힌다. 칩을 누른 같은 틱에 닫히지 않도록 다음 틱에 건다.
    this.scene.time.delayedCall(0, () => {
      if (!this.open) return;
      this.outsideDown = () => { this.pressedOverPopup = this.isPopupOpen(); };
      this.outsideTap = (pointer) => {
        const blocked = this.pressedOverPopup || this.isPopupOpen();
        this.pressedOverPopup = false;
        if (!blocked && !this.contains(pointer)) this.close();
      };
      this.scene.input.on("pointerdown", this.outsideDown);
      this.scene.input.on("pointerup", this.outsideTap);
    });
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.button?.setVisible(true);
    if (this.outsideDown) { this.scene.input.off("pointerdown", this.outsideDown); this.outsideDown = undefined; }
    if (this.outsideTap) { this.scene.input.off("pointerup", this.outsideTap); this.outsideTap = undefined; }
    this.pressedOverPopup = false;
    this.moveTo(this.layout.slideOut, () => this.tray.setVisible(false));
  }

  private contains(pointer: Phaser.Input.Pointer): boolean {
    const { bounds } = this.layout;
    return Math.abs(pointer.worldX - bounds.x) <= bounds.width / 2 && Math.abs(pointer.worldY - bounds.y) <= bounds.height / 2;
  }

  private moveTo(x: number, onDone?: () => void): void {
    this.slide?.stop();
    const duration = session.settings.accessibility.reduceMotion ? 0 : LOBBY_MENU_TRAY.slideMs;
    if (duration === 0) { this.tray.x = x; onDone?.(); return; }
    this.slide = this.scene.tweens.add({ targets: this.tray, x, duration, ease: "Cubic.easeOut", onComplete: onDone });
  }
}

/** 칩에 쓰는 글리프 이름을 한곳에서 정한다. */
export const LOBBY_MENU_GLYPH = { recollection: "scroll", achievement: "trophy" } as const satisfies Record<string, GlyphName>;
