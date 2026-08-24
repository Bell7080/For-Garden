import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import type { CurrencyIconKey } from "./currencyIcons";
import { chipPoints, drawLayer, HOLO, perspectiveRect, slantedRect } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 판 양 끝에서 안쪽으로 사라지는 점 패턴.
 *
 * 점의 크기와 진하기가 안쪽으로 갈수록 줄어 그라데이션처럼 읽힌다. 판이 기울어지거나 모서리가
 * 깎여도 삐져나오지 않도록, 실제 판 모양 안에 들어오는 점만 찍는다.
 */
function dotPattern(scene: Phaser.Scene, shape: number[], color: number): Phaser.GameObjects.Graphics {
  const points = toShapePoints(shape);
  const polygon = new Phaser.Geom.Polygon(points.map((point) => new Phaser.Geom.Point(point.x, point.y)));
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  const step = 15;
  // 점이 흩어지는 깊이. 판 폭의 절반을 넘기면 가운데에서 두 무늬가 만나 지저분해진다.
  const reach = (right - left) * 0.34;
  const graphics = scene.add.graphics();
  for (let y = top + step / 2; y < bottom; y += step) {
    // 줄마다 반 칸씩 어긋나게 찍어 격자가 아니라 흩뿌린 것처럼 보이게 한다.
    const offset = Math.round((y - top) / step) % 2 === 0 ? 0 : step / 2;
    for (let x = left + offset; x < right; x += step) {
      const depth = Math.min(x - left, right - x);
      if (depth > reach) continue;
      const fade = 1 - depth / reach;
      if (!polygon.contains(x, y)) continue;
      graphics.fillStyle(color, 0.5 * fade * fade);
      graphics.fillCircle(x, y, 1.2 + 1.8 * fade);
    }
  }
  return graphics;
}

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
   * 라벨 오른쪽에 박는 비용.
   *
   * "얼마가 드는가"는 버튼 밖의 안내문이 아니라 **누르는 것 위**에 있어야 한다. 재화 이름은
   * 글자로 적지 않고 그림으로 둔다 — 아이콘 하나가 "골드"라는 두 글자보다 빨리 읽힌다.
   */
  cost?: { icon: CurrencyIconKey; amount: number; affordable?: boolean };
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
   * 판 양 끝에 점을 촘촘히 찍어 안쪽으로 흩어지게 한다. 그라데이션 대신 점의 밀도로 농담을
   * 만드는 옛 인쇄 방식이라, 평평한 유리판에 얹어도 광택처럼 들뜨지 않는다.
   * 화면에서 가장 중요한 버튼 하나에만 쓴다.
   */
  decorDots?: boolean;
  /**
   * 원근. **키가 큰 변**을 알려 주면 반대쪽이 좁아진 사다리꼴이 된다.
   * 화면 가장자리 쪽이 커야 바깥에서 안으로 들어오는 판처럼 보이므로, 왼쪽 끝 버튼은
   * `left`, 오른쪽 끝 버튼은 `right`다.
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
  /** 누른 동일 포인터만 클릭을 끝낼 수 있게 기억하는 포인터 ID다. */
  private pressedPointerId?: number;
  private pressX = 0;
  private pressY = 0;
  private pressDragged = false;

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
      ? perspectiveRect(width, height, { tall: opts.perspective, taper: 0.42 })
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
    if (opts.cost) {
      // 라벨과 비용을 한 덩어리로 보고 판 가운데에 세운다. 값이 길어져도 덩어리째 가운데다.
      const coin = fontSize * 1.06;
      const gap = fontSize * 0.42;
      // 재화 수는 라벨보다 굵고 크게, 그러나 **세로로만** 늘인다. 가로로 키우면 자릿수가
      // 늘었을 때 덩어리가 판을 넘는다. 아이콘과는 손가락 하나가 아니라 한 뼘만 띄운다.
      const costStyle = textStyle({ role: "display", size: fontSize * 0.96, color: opts.cost.affordable === false ? COLOR.dangerText : COLOR.ink });
      const amount = scene.add.text(0, hasSub ? -14 : 0, opts.cost.amount.toLocaleString(), costStyle).setOrigin(0, 0.5).setScale(1, 1.14);
      const total = label.width + gap + coin + gap * 0.24 + amount.width;
      const left = -total / 2;
      label.setX(left + label.width / 2);
      const coinX = left + label.width + gap + coin / 2;
      // 그림자를 한 겹 깔아 상단 재화 줄과 같은 방식으로 앉는다.
      plate.add(scene.add.image(coinX + 3, (hasSub ? -14 : 0) + 4, opts.cost.icon).setDisplaySize(coin, coin).setTint(0x05070a).setAlpha(0.55));
      plate.add(scene.add.image(coinX, hasSub ? -14 : 0, opts.cost.icon).setDisplaySize(coin, coin));
      amount.setX(coinX + coin / 2 + gap * 0.24);
      plate.add(amount);
    }
    if (opts.decorDots) plate.add(dotPattern(scene, shape, accent));
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
    // 손떨림은 허용하되 스크롤/드래그 의도는 클릭으로 오인하지 않는 게임 좌표 거리다.
    const dragCancelDistance = 24;
    const finishPress = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== this.pressedPointerId) return;
      const shouldClick = this.enabledState && !this.pressDragged;
      this.pressedPointerId = undefined;
      this.setScale(1);
      if (shouldClick) opts.onClick();
    };
    const cancelPress = (): void => {
      this.pressedPointerId = undefined;
      this.pressDragged = false;
      this.setScale(1);
    };
    const trackPressMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== this.pressedPointerId) return;
      // 경계를 살짝 벗어나도 작은 이동이면 유지하고, 누적 거리가 임계값을 넘으면 실제 드래그로 취소한다.
      if (Phaser.Math.Distance.Between(this.pressX, this.pressY, pointer.worldX, pointer.worldY) > dragCancelDistance) {
        this.pressDragged = true;
        this.setScale(1);
      }
    };

    this.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Phaser의 pointer 이벤트는 touchstart와 마우스를 함께 추상화해 모바일/PC 테스트를 모두 지원한다.
      if (!this.enabledState || this.pressedPointerId !== undefined) return;
      this.pressedPointerId = pointer.id;
      this.pressX = pointer.worldX;
      this.pressY = pointer.worldY;
      this.pressDragged = false;
      this.setScale(1.05);
    });
    scene.input.on("pointermove", trackPressMove);
    // 전역 pointerup을 받아 버튼 경계의 작은 이동도 클릭으로 인정하되 시작 포인터 ID는 반드시 일치시킨다.
    scene.input.on("pointerup", finishPress);
    // 브라우저/캔버스가 포인터를 잃으면 클릭 없이 눌림 상태만 해제한다.
    scene.input.on("gameout", cancelPress);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off("pointermove", trackPressMove);
      scene.input.off("pointerup", finishPress);
      scene.input.off("gameout", cancelPress);
    });

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
