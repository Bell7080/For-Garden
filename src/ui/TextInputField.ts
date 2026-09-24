import Phaser from "phaser";
import { drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { COLOR, textStyle } from "./theme";

export interface TextInputFieldOptions {
  width: number;
  height: number;
  value: string;
  /** 화면에 서는 글자 수(유니코드 문자) 상한. 넘치는 입력은 그 자리에서 잘린다. */
  maxGlyphs: number;
  ariaLabel: string;
  fontSize?: number;
  onChange?: (value: string) => void;
}

/**
 * 판 안에 서는 한 줄 입력 칸.
 *
 * **글자는 Phaser가 그리고 DOM은 자판과 입력만 맡는다**(도감 검색 칸과 같은 방법). 브라우저가
 * 기본 글꼴로 한 겹 더 그리면 한 칸에 글자가 두 벌 겹치므로 DOM 입력은 보이지 않게 둔다.
 * DOM은 컨테이너 변환을 물려받지 않으므로 **매 프레임 부모의 월드 자리로 따라간다** — 팝업이
 * 떠오르는 동안에도 누르는 자리와 그려진 칸이 갈리지 않는다. 칸이 죽으면 DOM도 함께 걷는다.
 */
export class TextInputField extends Phaser.GameObjects.Container {
  private readonly field: HTMLInputElement;
  private readonly dom: Phaser.GameObjects.DOMElement;
  private readonly text: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private caretTween?: Phaser.Tweens.Tween;
  private readonly follow: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: TextInputFieldOptions) {
    super(scene, x, y);
    const { width, height } = options;
    const shape = slantedRect(width, height, 16);
    // 판보다 한 톤 밝은 면이라야 "여기에 쓴다"가 읽힌다 — 판과 같은 어둠이면 밑줄만 떠 있다.
    this.add(drawLayer(scene, 0, 0, shape, { fill: 0x1c2633, alpha: 0.96, shadow: false }));
    this.add(drawShapeEdge(scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.7, width: 3 }));
    const left = -width / 2 + 28;
    this.text = scene.add.text(left, 0, "", textStyle({ role: "emphasis", size: options.fontSize ?? 30, color: COLOR.ink })).setOrigin(0, 0.5);
    this.caret = scene.add.rectangle(left, 0, 3, height * 0.5, COLOR.accent, 1).setVisible(false);
    this.add([this.text, this.caret]);

    this.field = document.createElement("input");
    this.field.type = "text";
    this.field.value = options.value;
    this.field.maxLength = options.maxGlyphs * 2;
    this.field.setAttribute("aria-label", options.ariaLabel);
    this.field.setAttribute("autocomplete", "off");
    this.field.style.cssText = [
      `width:${width - 40}px`, `height:${height - 12}px`, "background:transparent", "border:0", "outline:none",
      "padding:0", "margin:0", "color:transparent", "caret-color:transparent",
      // iOS는 16px보다 작은 입력 칸에 초점이 가면 화면을 확대한다. 보이지 않는 글자라 값만 맞춘다.
      "font-size:16px", "-webkit-appearance:none",
    ].join(";");
    this.dom = scene.add.dom(0, 0, this.field).setOrigin(0.5);
    this.field.addEventListener("input", () => this.sync(true));
    this.field.addEventListener("keydown", (event) => { if (event.key === "Enter") this.field.blur(); });
    this.field.addEventListener("focus", () => this.setCaretVisible(true));
    this.field.addEventListener("blur", () => this.setCaretVisible(false));
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.field.focus());
    this.add(hit);

    this.follow = () => {
      if (!this.active) return;
      const matrix = this.getWorldTransformMatrix();
      this.dom.setPosition(matrix.tx, matrix.ty).setVisible(this.visible && (this.parentContainer?.visible ?? true));
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.follow);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.follow);
      this.caretTween?.remove();
      this.field.blur();
      this.dom.destroy();
    });
    this.sync(false);
  }

  get value(): string { return this.field.value; }

  private sync(notify: boolean): void {
    // 화면에 서는 글자 수로 자른다 — 이모지 하나가 둘로 세어지지 않게.
    const glyphs = Array.from(this.field.value);
    if (glyphs.length > this.options.maxGlyphs) this.field.value = glyphs.slice(0, this.options.maxGlyphs).join("");
    this.text.setText(this.field.value);
    this.caret.x = this.text.x + this.text.width + 4;
    if (notify) this.options.onChange?.(this.field.value);
  }

  private setCaretVisible(visible: boolean): void {
    this.caretTween?.remove();
    this.caretTween = undefined;
    this.caret.setVisible(visible).setAlpha(1);
    if (!visible) return;
    this.caretTween = this.scene.tweens.add({ targets: this.caret, alpha: 0.1, duration: 480, yoyo: true, repeat: -1 });
  }
}
