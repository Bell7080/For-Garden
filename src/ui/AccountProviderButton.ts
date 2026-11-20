import Phaser from "phaser";
import { ACCOUNT_BUTTON as B, ACCOUNT_BUTTON_TONE, type AccountButtonKind } from "./accountButtonStyle";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { textStyle } from "./theme";

const MARK: Readonly<Record<AccountButtonKind, GlyphName>> = {
  guest: "sortie", google: "brand-google", apple: "brand-apple", password: "id-card", email: "mail", history: "receipt", restore: "restore",
};

export interface AccountProviderButtonOptions {
  kind: AccountButtonKind;
  label: string;
  /** 이미 이어진 수단 — 판 오른쪽에 체크가 서고 면이 한 톤 가라앉는다. */
  linked?: boolean;
  /** 누를 일. 없으면 눌리지 않는 표시판이다(이미 이어진 아이디처럼 해제할 길이 없는 수단). */
  onClick?: () => void;
  /** 판 크기. 없으면 계정 판의 두 칸 격자 크기(`ACCOUNT_BUTTON`)다 — 타이틀의 로그인 줄은 한 줄짜리라 넓다. */
  width?: number;
  height?: number;
  labelSize?: number;
  /** 아직 열리지 않은 수단 — 오른쪽에 「준비 중」 딱지가 서고 판이 한 톤 가라앉는다. 눌리면 안내가 뜬다. */
  soonLabel?: string;
}

/**
 * 계정 판의 로그인 수단·결제 버튼 한 장.
 *
 * 생김새는 `ACCOUNT_BUTTON_TONE`이 정한다 — 상표 버튼은 상표의 면·표식, 게임 수단은 게임 팔레트 안의
 * 갈라진 색이다. 판은 칩 실루엣이고 표식은 왼쪽, 글자는 그 오른쪽에서 시작하며 넘치면 가로로만 누른다.
 * 누르면 다른 버튼과 같은 손맛(`pressIn`·`pressOut`)으로 눌린다.
 */
export class AccountProviderButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: AccountProviderButtonOptions) {
    super(scene, x, y);
    const tone = ACCOUNT_BUTTON_TONE[options.kind];
    const width = options.width ?? B.width;
    const height = options.height ?? B.height;
    const shape = chipPoints(width, height, { bevel: { topLeft: B.bevel, bottomRight: B.bevel } });
    const left = -width / 2;
    this.add(drawLayer(scene, 0, 0, shape, { fill: tone.fill, alpha: tone.alpha * (options.linked ? 0.82 : 1), shadow: { x: 0, y: 8 } }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: tone.outline, alpha: tone.outlineAlpha, width: 2 }));
    this.add(drawGlyph(scene, MARK[options.kind], left + B.markX, 0, B.markSize, tone.mark, 1, Math.max(3, B.markSize * 0.09)));
    const label = scene.add.text(left + B.labelX, 0, options.label, textStyle({ role: "emphasis", size: options.labelSize ?? B.labelSize, color: tone.ink })).setOrigin(0, 0.5);
    let labelRoom = width - B.labelX - B.labelRight;
    if (options.soonLabel) {
      const soon = B.soon;
      const tag = scene.add.text(0, 0, options.soonLabel, textStyle({ role: "emphasis", size: soon.fontSize, color: soon.ink })).setOrigin(0.5);
      const tagWidth = tag.width + soon.padX * 2;
      const tagX = width / 2 - soon.right - tagWidth / 2;
      tag.setX(tagX);
      this.add([drawLayer(scene, tagX, 0, chipPoints(tagWidth, soon.height, { bevel: { topLeft: 9, bottomRight: 9 } }), { fill: soon.fill, alpha: soon.alpha, shadow: false }), tag]);
      labelRoom = Math.min(labelRoom, width - B.labelX - tagWidth - soon.right - 16);
    }
    squeezeTextToWidth(label, labelRoom);
    this.add(label);
    if (options.linked) this.add(drawGlyph(scene, "check", width / 2 - B.checkX, 0, B.checkSize, options.kind === "google" ? 0x34a853 : tone.mark));
    if (options.soonLabel) this.setAlpha(B.soonAlpha);
    if (options.onClick) {
      const action = options.onClick;
      const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(this));
      hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(this); action(); });
      this.add(hit);
    } else {
      this.setAlpha(0.92);
    }
    scene.add.existing(this);
  }
}
