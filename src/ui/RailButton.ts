import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";
import { UI_ICON, type UiIconKey } from "./icons";
import { pressIn, pressOut } from "./pressFeedback";
import { addPadlock } from "./Padlock";
import { LOCK_DIM } from "./lockStyle";
import { playUnlockSequence } from "./contentLock";
import type { ContentId } from "../core/contentUnlock";

export interface RailButtonOptions {
  /** 작은 선 glyph와 로딩된 전용 SVG가 동일한 카드 경로를 공유한다. */
  icon: GlyphName | UiIconKey;
  label: string;
  size?: number;
  /** 강조 버튼은 강조색 면과 밝은 선을 쓴다. 교류처럼 새 화면으로 나가는 입구에 쓴다. */
  accent?: boolean;
  /**
   * 노란 이벤트 입구. 강조(금빛)와 따로 두는 이유는 금빛이 이미 임무·보상을 뜻해서다 —
   * 같은 색이면 "받을 것이 있다"와 "행사가 열려 있다"가 한 신호로 읽힌다.
   */
  event?: boolean;
  onClick: () => void;
}

/**
 * 화면 옆줄에 세로로 쌓는 작은 아이콘 버튼.
 *
 * 상점·우편·친구처럼 로비에 늘 떠 있어야 하지만 주인공(캐릭터)을 가리면 안 되는 것들을 위한
 * 자리다. 글자는 아이콘 아래 한 줄만 두고, 칩은 왼쪽 위·오른쪽 아래를 깎아 방향을 준다.
 */
export class RailButton extends Phaser.GameObjects.Container {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly iconY: number;
  private readonly iconSize: number;
  private padlock?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, options: RailButtonOptions) {
    super(scene, x, y);
    const size = options.size ?? 96;
    const color = options.event ? COLOR.event : options.accent ? COLOR.accent : 0xd2d6dc;
    const lit = Boolean(options.accent || options.event);

    this.plate = drawLayer(scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.32, topRight: 0, bottomRight: size * 0.32, bottomLeft: 0 },
    }), {
      fill: options.event ? 0x2e2710 : options.accent ? 0x2a2418 : 0x1a1f27,
      alpha: HOLO.glass,
      edge: options.event ? COLOR.event : COLOR.accent,
      edgeAlpha: lit ? 0.85 : 0.35,
    });
    this.add(this.plate);
    // 글자는 칩 안 아래쪽에 둔다. 칩 밖으로 내리면 배경 원화 위에 놓여 읽히지 않는다.
    // UI SVG 키는 등록 목록으로 판별해 GlyphName 문자열과 우연히 겹쳐도 렌더 경계가 흔들리지 않는다.
    const isUiIcon = (Object.values(UI_ICON) as string[]).includes(options.icon);
    this.iconY = -size * 0.12;
    this.iconSize = size * 0.42;
    this.icon = isUiIcon
      ? scene.add.image(0, this.iconY, options.icon).setDisplaySize(size * 0.5, size * 0.5)
      : drawGlyph(scene, options.icon as GlyphName, 0, this.iconY, this.iconSize, color);
    this.add(this.icon);
    this.labelText = scene.add
      .text(0, size * 0.2, options.label, textStyle({ role: "emphasis", size: 19, color: options.event ? COLOR.eventText : options.accent ? COLOR.accentText : COLOR.ink }))
      .setOrigin(0.5, 0);
    this.add(this.labelText);

    const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this));
    hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(this);
      options.onClick();
    });
    this.add(hit);

    this.setSize(size, size);
    scene.add.existing(this);
  }

  /**
   * 잠긴 칩은 **꺼진 것처럼** 선다 — 판과 글자가 반투명하게 가라앉고, 아이콘 자리에 회색 자물쇠가 대신 선다.
   * 덮개를 한 장 더 얹지 않는다: 작은 칩 위에 어두운 면을 깔면 칩이 두 겹으로 보인다.
   */
  setLocked(): this {
    if (this.padlock) return this;
    this.plate.setAlpha(LOCK_DIM.plateAlpha);
    this.labelText.setAlpha(LOCK_DIM.labelAlpha);
    this.icon.setVisible(false);
    this.padlock = addPadlock(this.scene, 0, this.iconY, this.iconSize * 0.92, { color: LOCK_DIM.lockColor, alpha: LOCK_DIM.lockAlpha });
    // 입력면(맨 위)보다 아래에 끼운다 — 자물쇠가 누름을 가로채지 않는다.
    this.addAt(this.padlock, this.getIndex(this.icon) + 1);
    return this;
  }

  /** 잠긴 칩을 연다 — 칩이 밝아지는 동안 자물쇠가 풀리고, 놓는 순간 원래 아이콘이 그 자리에 들어선다. */
  unlock(id: ContentId): void {
    const lock = this.padlock;
    if (!lock) return;
    this.padlock = undefined;
    playUnlockSequence(this.scene, lock, {
      id,
      onStart: () => this.scene.tweens.add({ targets: [this.plate, this.labelText], alpha: 1, duration: 420, ease: "Sine.easeOut" }),
      onOpen: () => {
        if (!this.active) return;
        const scaleX = this.icon.scaleX;
        const scaleY = this.icon.scaleY;
        this.icon.setVisible(true).setAlpha(0).setScale(scaleX * 0.6, scaleY * 0.6);
        this.scene.tweens.add({ targets: this.icon, alpha: 1, scaleX, scaleY, duration: 320, ease: "Back.easeOut" });
      },
    });
  }
}
