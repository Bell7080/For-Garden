import Phaser from "phaser";
import { drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { COLOR, textStyle } from "./theme";
import { drawGlyph, type GlyphName } from "./glyphs";

export interface TextInputFieldOptions {
  width: number;
  height: number;
  value: string;
  /** 화면에 서는 글자 수(유니코드 문자) 상한. 넘치는 입력은 그 자리에서 잘린다. */
  maxGlyphs: number;
  ariaLabel: string;
  fontSize?: number;
  /** 여러 줄 입력. 줄바꿈이 들어가고 칸에 다 안 들어가면 캐럿이 있는 줄이 보이도록 윗줄이 밀려난다. */
  multiline?: boolean;
  onChange?: (value: string) => void;
  /** 비밀번호 칸. 화면에는 글자 수만큼 점만 그리고, 자판은 비밀번호 모드로 연다(자동 완성·미리보기 방지). */
  mask?: boolean;
  /** 한 줄 칸의 자동 완성 힌트. 비밀번호 칸은 `current-password`/`new-password`를 넘긴다. */
  autocomplete?: string;
  /** 비었을 때 흐리게 서는 안내 글. Phaser가 그린다 — DOM `placeholder`는 브라우저 글꼴로 한 겹 더 그려져 쓰지 않는다. */
  placeholder?: string;
  /** 글자 앞에 서는 선 아이콘(검색 칸의 돋보기). 그만큼 글자가 오른쪽으로 물러난다. */
  icon?: GlyphName;
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
  private readonly placeholderText?: Phaser.GameObjects.Text;
  /** 여러 줄 칸에서 줄 폭을 재는 보이지 않는 글자. 캐럿 x를 구하는 데만 쓴다. */
  private readonly measure?: Phaser.GameObjects.Text;
  /** 여러 줄 칸에서 지금 맨 위에 서 있는 줄. 캐럿이 창 밖으로 나갈 때만 움직인다. */
  private firstLine = 0;
  private lineHeight = 0;
  private visibleLines = 1;
  private caretTween?: Phaser.Tweens.Tween;
  private readonly follow: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: TextInputFieldOptions) {
    super(scene, x, y);
    const { width, height } = options;
    const shape = slantedRect(width, height, 16);
    // 판보다 한 톤 밝은 면이라야 "여기에 쓴다"가 읽힌다 — 판과 같은 어둠이면 밑줄만 떠 있다.
    this.add(drawLayer(scene, 0, 0, shape, { fill: 0x1c2633, alpha: 0.96, shadow: false }));
    this.add(drawShapeEdge(scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.7, width: 3 }));
    if (options.icon) this.add(drawGlyph(scene, options.icon, -width / 2 + 32, 1, Math.min(32, height * 0.5), COLOR.accent, 0.8, 3));
    const left = -width / 2 + (options.icon ? 60 : 28);
    const fontSize = options.fontSize ?? 30;
    if (options.placeholder) {
      this.placeholderText = scene.add.text(left, options.multiline ? -height / 2 + 16 : 0, options.placeholder, textStyle({ role: "body", size: Math.round(fontSize * 0.9), color: COLOR.inkDim }))
        .setOrigin(0, options.multiline ? 0 : 0.5);
      this.add(this.placeholderText);
    }
    if (options.multiline) {
      const style = textStyle({ role: "emphasis", size: fontSize, color: COLOR.ink, lineSpacing: Math.round(fontSize * 0.25), wrap: width - 56 });
      this.text = scene.add.text(left, -height / 2 + 16, "", style).setOrigin(0, 0);
      this.text.setWordWrapWidth(width - 56, true);
      this.measure = scene.add.text(0, 0, "", textStyle({ role: "emphasis", size: fontSize, color: COLOR.ink })).setVisible(false);
      // 줄 간격은 글꼴 지표·접근성 배율에 따라 달라지므로 두 줄을 재서 실제 보폭을 구한다.
      this.text.setText("M"); const one = this.text.height;
      this.text.setText("M\nM"); this.lineHeight = Math.max(1, this.text.height - one);
      this.text.setText("");
      this.visibleLines = Math.max(1, Math.floor((height - 28) / this.lineHeight));
      this.caret = scene.add.rectangle(left, -height / 2 + 16, 3, fontSize * 1.1, COLOR.accent, 1).setOrigin(0, 0).setVisible(false);
      this.add([this.text, this.measure, this.caret]);
    } else {
      this.text = scene.add.text(left, 0, "", textStyle({ role: "emphasis", size: fontSize, color: COLOR.ink })).setOrigin(0, 0.5);
      this.caret = scene.add.rectangle(left, 0, 3, height * 0.5, COLOR.accent, 1).setVisible(false);
      this.add([this.text, this.caret]);
    }

    this.field = (options.multiline ? document.createElement("textarea") : document.createElement("input")) as HTMLInputElement;
    if (!options.multiline) this.field.type = options.mask ? "password" : "text";
    this.field.value = options.value;
    this.field.maxLength = options.maxGlyphs * 2;
    this.field.setAttribute("aria-label", options.ariaLabel);
    this.field.setAttribute("autocomplete", options.autocomplete ?? "off");
    if (!options.multiline) { this.field.setAttribute("autocapitalize", "none"); this.field.setAttribute("autocorrect", "off"); this.field.spellcheck = false; }
    this.field.style.cssText = [
      `width:${width - 40}px`, `height:${height - 12}px`, "background:transparent", "border:0", "outline:none",
      "padding:0", "margin:0", "color:transparent", "caret-color:transparent", ...(options.multiline ? ["resize:none", "overflow:hidden"] : []),
      // iOS는 16px보다 작은 입력 칸에 초점이 가면 화면을 확대한다. 보이지 않는 글자라 값만 맞춘다.
      "font-size:16px", "-webkit-appearance:none",
    ].join(";");
    this.dom = scene.add.dom(0, 0, this.field).setOrigin(0.5);
    this.field.addEventListener("input", () => this.sync(true));
    // 한 줄 칸은 Enter로 끝내고, 여러 줄 칸은 줄을 바꾼다. 커서를 옮기는 입력도 캐럿 자리를 다시 잡는다.
    this.field.addEventListener("keydown", (event) => { if (event.key === "Enter" && !options.multiline) this.field.blur(); });
    if (options.multiline) for (const type of ["keyup", "click", "select"]) this.field.addEventListener(type, () => this.sync(false));
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

  /** 값을 바꾼다(조건 초기화 등). 바뀐 값을 `onChange`로 다시 알리지 않는다 — 부른 쪽이 이미 안다. */
  setValue(value: string): void {
    this.field.value = value;
    this.sync(false);
  }

  /** 자판을 내린다. 위에 다른 판이 덮일 때 부른다 — 보이지 않는 칸에 초점이 남으면 자판만 떠 있다. */
  blur(): void { this.field.blur(); }

  private sync(notify: boolean): void {
    this.placeholderText?.setVisible(this.field.value === "");
    // 화면에 서는 글자 수로 자른다 — 이모지 하나가 둘로 세어지지 않게.
    const glyphs = Array.from(this.field.value);
    if (glyphs.length > this.options.maxGlyphs) this.field.value = glyphs.slice(0, this.options.maxGlyphs).join("");
    if (this.options.multiline) this.layoutMultiline();
    else {
      this.text.setText(this.options.mask ? "•".repeat(Array.from(this.field.value).length) : this.field.value);
      this.caret.x = this.text.x + this.text.width + 4;
    }
    if (notify) this.options.onChange?.(this.field.value);
  }

  /** 줄바꿈된 글을 창에 맞게 자르고 캐럿을 그 줄 끝에 놓는다. 윗줄은 캐럿이 창 밖으로 나갈 때만 밀려난다. */
  private layoutMultiline(): void {
    const value = this.field.value;
    const lines = this.text.getWrappedText(value);
    const caretIndex = Math.min(this.field.selectionStart ?? value.length, value.length);
    const beforeCaret = this.text.getWrappedText(value.slice(0, caretIndex));
    // 캐럿 앞 글이 줄바꿈으로 끝나면 getWrappedText가 빈 줄을 돌려주지 않을 수 있어 직접 센다.
    let caretLine = Math.max(0, beforeCaret.length - 1);
    let lastLine = beforeCaret[beforeCaret.length - 1] ?? "";
    if (value.slice(0, caretIndex).endsWith("\n")) { caretLine = beforeCaret.length; lastLine = ""; }
    if (caretLine < this.firstLine) this.firstLine = caretLine;
    if (caretLine >= this.firstLine + this.visibleLines) this.firstLine = caretLine - this.visibleLines + 1;
    this.firstLine = Math.max(0, Math.min(this.firstLine, Math.max(0, lines.length - this.visibleLines)));
    if (caretLine >= this.firstLine + this.visibleLines) this.firstLine = caretLine - this.visibleLines + 1;
    this.text.setText(lines.slice(this.firstLine, this.firstLine + this.visibleLines).join("\n"));
    this.measure?.setText(lastLine);
    this.caret.x = this.text.x + (lastLine === "" ? 0 : (this.measure?.width ?? 0)) + 4;
    this.caret.y = this.text.y + (caretLine - this.firstLine) * this.lineHeight + 4;
  }

  private setCaretVisible(visible: boolean): void {
    this.caretTween?.remove();
    this.caretTween = undefined;
    this.caret.setVisible(visible).setAlpha(1);
    if (!visible) return;
    this.caretTween = this.scene.tweens.add({ targets: this.caret, alpha: 0.1, duration: 480, yoyo: true, repeat: -1 });
  }
}
