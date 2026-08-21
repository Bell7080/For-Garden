import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO, perspectiveRect, slantedRect } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 평평한 좌표 배열을 점 목록으로 바꾼다. 아래 변을 찾을 때만 쓴다. */
function toShapePoints(flat: number[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
  return points;
}

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  /** 아래에 작게 붙는 보조 문구. */
  sub?: string;
  fontSize?: number;
  fill?: number;
  /** 라벨 왼쪽에 붙는 선 아이콘. */
  icon?: GlyphName;
  /**
   * 화면에서 가장 중요한 버튼인지.
   *
   * `primary`는 강조색 면과 두 겹의 밝은 선을 쓰고 모서리를 크게 깎는다. 한 화면에 하나만 둔다.
   */
  variant?: "default" | "primary";
  /** 판을 실제로 기울이는 각도(도). 출격처럼 비스듬히 꽂힌 판을 만들 때 쓴다. */
  tilt?: number;
  /** 강조색을 바꾼다. 출격(금)과 성격이 다른 입구를 색으로 가를 때만 쓴다. */
  accentColor?: number;
  /** 강조색과 함께 쓸 글자색. 넘기지 않으면 기본 잉크색이다. */
  accentTextColor?: string;
  /**
   * 원근. 화면 가운데를 향한 변을 알려 주면 판이 그쪽으로 쏠린 사다리꼴이 된다.
   * 왼쪽 끝 버튼은 `right`, 오른쪽 끝 버튼은 `left`다.
   */
  perspective?: "left" | "right";
  onClick: () => void;
}

/**
 * 눌리는 버튼.
 *
 * 테두리를 두르지 않는다. 살짝 기울어진 단색 레이어와 그 아래 그림자만으로 눌리는 판임을
 * 알리고, 누르는 동안 커졌다가 제자리로 돌아온다. 비활성화하면 흐려지고 입력을 받지 않는다.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly subText?: Phaser.GameObjects.Text;
  private enabledState = true;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    const primary = opts.variant === "primary";
    const { width, height } = opts;
    const accent = opts.accentColor ?? COLOR.accent;
    const accentText = opts.accentTextColor ?? (opts.accentColor === undefined ? COLOR.accentText : COLOR.ink);

    // 판 자체를 기울인다. 안에 얹는 글자와 아이콘도 함께 돌아 하나의 조각처럼 보인다.
    const plate = scene.add.container(0, 0);
    if (opts.tilt) plate.setRotation(Phaser.Math.DegToRad(opts.tilt));

    const shape = opts.perspective
      ? perspectiveRect(width, height, { inner: opts.perspective, taper: 0.32 })
      : primary
        ? chipPoints(width, height, {
            bevel: { topLeft: height * 0.52, topRight: 0, bottomRight: height * 0.52, bottomLeft: 0 },
          })
        : slantedRect(width, height);
    plate.add(drawLayer(scene, 0, 0, shape, {
      // 유리판이라 바탕을 짙게 칠하지 않는다. 뒤 배경이 비쳐야 두께가 느껴진다.
      fill: opts.fill ?? (primary ? 0x0d1219 : 0x1b2029),
      alpha: primary ? 0.74 : HOLO.glass,
      sheen: primary ? 0.07 : 0.04,
      // 사방을 두르지 않고 빛이 닿는 윗변 한 줄만 긋는다.
      edge: accent,
      edgeAlpha: primary ? 0.95 : 0.4,
    }));
    if (primary && !opts.perspective) {
      // 강조 버튼만 아래에도 한 줄을 그어 유리판의 두께를 만든다.
      const underline = scene.add.graphics();
      underline.lineStyle(3, accent, 0.6);
      underline.lineBetween(-width / 2 + height * 0.52, height / 2 - 5, width / 2 - height * 0.52, height / 2 - 5);
      plate.add(underline);
    }
    if (opts.perspective) {
      // 사다리꼴은 아래 변도 기울어 있다. 그 변을 따라 한 줄 그어 원근을 한 번 더 알린다.
      const bottom = [...toShapePoints(shape)].sort((a, b) => b.y - a.y).slice(0, 2).sort((a, b) => a.x - b.x);
      const line = scene.add.graphics();
      line.lineStyle(3, accent, 0.55);
      line.lineBetween(bottom[0].x, bottom[0].y, bottom[1].x, bottom[1].y);
      plate.add(line);
    }

    const hasSub = opts.sub !== undefined;
    const fontSize = opts.fontSize ?? 36;
    const iconSize = fontSize * 1.35;
    const label = scene.add
      .text(0, hasSub ? -14 : 0, opts.label, textStyle({ role: "display", size: fontSize }))
      .setOrigin(0.5);
    plate.add(label);
    if (opts.icon) {
      // 아이콘은 글자 왼쪽에 붙고, 둘을 합친 폭이 판 가운데에 오도록 함께 민다.
      const gap = fontSize * 0.5;
      const total = iconSize + gap + label.width;
      label.setX(-total / 2 + iconSize + gap + label.width / 2);
      plate.add(drawGlyph(scene, opts.icon, -total / 2 + iconSize / 2, hasSub ? -14 : 0, iconSize, primary ? accent : 0xd8d5cf));
    }
    if (hasSub) {
      this.subText = scene.add
        .text(label.x, 26, opts.sub ?? "", textStyle({ role: "body", size: 26, color: primary ? accentText : COLOR.inkDim }))
        .setOrigin(0.5);
      plate.add(this.subText);
    }
    this.add(plate);

    // 입력만 받는 투명 판. 기울어진 모양과 달리 직사각이라 손가락이 모서리에서 빠지지 않는다.
    this.bg = scene.add.rectangle(0, 0, width, height, 0xffffff, 0);
    this.add(this.bg);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on("pointerdown", () => {
      // Phaser의 pointer 이벤트는 touchstart와 마우스를 함께 추상화해 모바일/PC 테스트를 모두 지원한다.
      if (this.enabledState) this.setScale(1.05);
    });
    this.bg.on("pointerup", () => {
      // touchend에 해당하는 시점에 실행해 스크롤하려던 손가락의 오발을 줄인다.
      this.setScale(1);
      if (this.enabledState) opts.onClick();
    });
    this.bg.on("pointerout", () => this.setScale(1));

    scene.add.existing(this);
  }

  /** 보조 문구를 갈아끼운다. 진형이 바뀌면 버튼이 가리키는 대상도 바뀐다. */
  setSub(text: string): this {
    this.subText?.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    this.setAlpha(enabled ? 1 : 0.35);
    return this;
  }
}
