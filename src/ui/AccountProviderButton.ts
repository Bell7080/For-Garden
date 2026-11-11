import Phaser from "phaser";
import { ACCOUNT_BUTTON as B, ACCOUNT_BUTTON_TONE, type AccountButtonKind } from "./accountButtonStyle";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { textStyle } from "./theme";

const MARK: Readonly<Record<AccountButtonKind, GlyphName>> = {
  google: "brand-google", apple: "brand-apple", password: "id-card", email: "mail", history: "receipt", restore: "restore",
};

export interface AccountProviderButtonOptions {
  kind: AccountButtonKind;
  label: string;
  /** 이미 이어진 수단 — 판 오른쪽에 체크가 서고 면이 한 톤 가라앉는다. */
  linked?: boolean;
  /** 누를 일. 없으면 눌리지 않는 표시판이다(이미 이어진 아이디처럼 해제할 길이 없는 수단). */
  onClick?: () => void;
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
    const shape = chipPoints(B.width, B.height, { bevel: { topLeft: B.bevel, bottomRight: B.bevel } });
    const left = -B.width / 2;
    this.add(drawLayer(scene, 0, 0, shape, { fill: tone.fill, alpha: tone.alpha * (options.linked ? 0.82 : 1), shadow: { x: 0, y: 8 } }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: tone.outline, alpha: tone.outlineAlpha, width: 2 }));
    this.add(drawGlyph(scene, MARK[options.kind], left + B.markX, 0, B.markSize, tone.mark, 1, Math.max(3, B.markSize * 0.09)));
    const label = scene.add.text(left + B.labelX, 0, options.label, textStyle({ role: "emphasis", size: B.labelSize, color: tone.ink })).setOrigin(0, 0.5);
    squeezeTextToWidth(label, B.width - B.labelX - B.labelRight);
    this.add(label);
    if (options.linked) this.add(drawGlyph(scene, "check", B.width / 2 - B.checkX, 0, B.checkSize, options.kind === "google" ? 0x34a853 : tone.mark));
    if (options.onClick) {
      const action = options.onClick;
      const hit = scene.add.rectangle(0, 0, B.width, B.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
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
