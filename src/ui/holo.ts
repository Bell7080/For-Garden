import Phaser from "phaser";
import { COLOR } from "./theme";

/**
 * 홀로그램 UI의 생김새 토큰.
 *
 * 근미래 장비의 투영 화면을 흉내 낸다. 규칙은 셋뿐이다.
 * 1. 테두리로 무언가를 감싸지 않는다. 경계는 얇은 선이나 레이어의 그림자로만 만든다.
 * 2. 면은 단색 플랫이고, 살짝 기울여 3차원처럼 보이게 한다.
 * 3. 깊이는 그림자와 겹침으로만 만든다. 광택·입체 테두리는 쓰지 않는다.
 */
export const HOLO = {
  /** 레이어를 기울여 보이게 하는 가로 밀림. 위쪽이 오른쪽으로 밀린다. */
  slant: 12,
  /** 칩의 잘린 모서리 길이. */
  bevel: 26,
  /** 레이어가 떠 보이게 하는 그림자. */
  shadow: { x: 9, y: 13, alpha: 0.45 },
  /** 유리면 불투명도. 뒤 배경이 비쳐야 하지만 글자는 읽혀야 한다. */
  glass: 0.82,
  /** 유리면보다 옅은 보조면. */
  glassLight: 0.5,
  /** 경계에 쓰는 얇은 선. */
  lineWidth: 2,
} as const;

/** 기울어진 사각형(평행사변형)의 좌표. 중심이 (0,0)이다. */
export function slantedRect(width: number, height: number, slant: number = HOLO.slant): number[] {
  const hw = width / 2;
  const hh = height / 2;
  const s = slant / 2;
  return [-hw + s, -hh, hw + s, -hh, hw - s, hh, -hw - s, hh];
}

/** 네 모서리를 각각 다르게 깎기 위한 값. 0이면 직각으로 둔다. */
export interface Bevels {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

/**
 * 원근이 들어간 사다리꼴.
 *
 * 화면 밖에서 안으로 들어오는 판처럼 보이게 한다. `tall`로 준 변이 높이를 그대로 쓰고
 * 반대쪽이 `taper`만큼 짧아져, 가까운 바깥쪽이 크고 먼 안쪽이 작은 그림이 된다.
 */
export function perspectiveRect(
  width: number,
  height: number,
  options: { taper?: number; tall?: "left" | "right" } = {},
): number[] {
  const taper = options.taper ?? 0.2;
  const hw = width / 2;
  const hh = height / 2;
  const short = hh * (1 - taper);
  return options.tall === "left"
    ? [-hw, -hh, hw, -short, hw, short, -hw, hh]
    : [-hw, -short, hw, -hh, hw, hh, -hw, short];
}

export interface ChipOptions {
  /** 모서리별로 잘라낼 길이. 숫자 하나를 주면 위쪽 두 모서리에만 쓴다. */
  bevel?: number | Bevels;
  /** 위쪽 가운데를 얼마나 열어 둘지(원화의 머리가 빠져나갈 폭). 0이면 열지 않는다. */
  openWidth?: number;
  /** 열린 구간이 위로 얼마나 뻗는지. */
  openHeight?: number;
}

/**
 * 모서리를 깎아 낸 칩 모양.
 *
 * 네 모서리를 서로 다르게 깎는 것이 기본이다. 같은 길이로 깎으면 반듯한 팔각형이 되어
 * 정면에서 찍어 낸 판처럼 보이고, 어긋나게 깎아야 비스듬히 잘린 조각처럼 읽힌다.
 *
 * `openWidth`를 주면 윗변 가운데가 위로 뚫린다. 카드에서 캐릭터 머리만 칩 밖으로 나오게 하는
 * 구멍이라, 잘린 모서리는 그대로 두고 가운데만 연다.
 */
export function chipPoints(width: number, height: number, options: ChipOptions = {}): number[] {
  const given = options.bevel ?? HOLO.bevel;
  const bevels: Required<Bevels> = typeof given === "number"
    ? { topLeft: given, topRight: given, bottomRight: 0, bottomLeft: 0 }
    : { topLeft: given.topLeft ?? 0, topRight: given.topRight ?? 0, bottomRight: given.bottomRight ?? 0, bottomLeft: given.bottomLeft ?? 0 };
  const open = options.openWidth ?? 0;
  const openTop = -height / 2 - (options.openHeight ?? 0);
  const hw = width / 2;
  const hh = height / 2;
  const points = [-hw, -hh + bevels.topLeft, -hw + bevels.topLeft, -hh];
  if (open > 0) {
    points.push(-open / 2, -hh, -open / 2, openTop, open / 2, openTop, open / 2, -hh);
  }
  points.push(
    hw - bevels.topRight, -hh,
    hw, -hh + bevels.topRight,
    hw, hh - bevels.bottomRight,
    hw - bevels.bottomRight, hh,
    -hw + bevels.bottomLeft, hh,
    -hw, hh - bevels.bottomLeft,
  );
  return points;
}

/** 좌표 배열을 Phaser Graphics가 받는 점 목록으로 바꾼다. */
export function toPoints(flat: number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
  return points;
}

export interface LayerOptions {
  fill: number;
  alpha?: number;
  /** 그림자를 깔지 여부. 겹쳐 놓는 얇은 보조 레이어는 끈다. */
  shadow?: boolean;
  /** 윗변에만 긋는 얇은 강조선 색. 사방을 두르는 테두리는 만들지 않는다. */
  edge?: number;
  edgeAlpha?: number;
  /**
   * 유리 광택. 면의 위쪽에만 아주 옅은 흰빛을 얹어 빛을 받은 유리처럼 보이게 한다.
   * 값은 흰빛의 진하기(0~1)이며 0.07 언저리가 넘어 보이지 않는 한계다.
   */
  sheen?: number;
}

/**
 * 다각형을 가로선 위쪽만 남기고 잘라 낸다.
 *
 * 광택은 면의 위쪽에만 얹어야 하는데, 깎인 칩과 기울어진 판은 단순한 사각형이 아니라
 * 좌표를 그때그때 계산해야 한다. Sutherland-Hodgman 절단을 가로선 한 변에만 쓴다.
 */
function clipAbove(points: Phaser.Geom.Point[], limit: number): Phaser.Geom.Point[] {
  const inside = (point: Phaser.Geom.Point): boolean => point.y <= limit;
  const cross = (a: Phaser.Geom.Point, b: Phaser.Geom.Point): Phaser.Geom.Point => {
    const t = (limit - a.y) / (b.y - a.y);
    return new Phaser.Geom.Point(a.x + (b.x - a.x) * t, limit);
  };
  const result: Phaser.Geom.Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[(i + points.length - 1) % points.length];
    if (inside(current)) {
      if (!inside(previous)) result.push(cross(previous, current));
      result.push(current);
    } else if (inside(previous)) {
      result.push(cross(previous, current));
    }
  }
  return result;
}

/**
 * 단색 플랫 레이어 하나를 그린다.
 *
 * Graphics로 그리는 이유는, Polygon 게임오브젝트가 좌표에 따라 원점이 흔들려 여러 장을 겹칠 때
 * 어긋나기 때문이다. 반환값은 씬에 이미 올라간 Graphics다.
 */
export function drawLayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: number[],
  options: LayerOptions,
): Phaser.GameObjects.Graphics {
  const points = toPoints(shape);
  const graphics = scene.add.graphics({ x, y });
  if (options.shadow !== false) {
    graphics.fillStyle(0x000000, HOLO.shadow.alpha);
    graphics.translateCanvas(HOLO.shadow.x, HOLO.shadow.y);
    graphics.fillPoints(points, true);
    graphics.translateCanvas(-HOLO.shadow.x, -HOLO.shadow.y);
  }
  graphics.fillStyle(options.fill, options.alpha ?? HOLO.glass);
  graphics.fillPoints(points, true);
  if (options.sheen) {
    // 위쪽 절반에만 흰빛을 얹는다. 아래로 갈수록 사라지는 그라데이션은 다각형 채우기에
    // 쓸 수 없으므로, 절단한 윗면 하나로 대신한다.
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    const upper = clipAbove(points, top + (bottom - top) * 0.45);
    graphics.fillStyle(0xffffff, options.sheen);
    graphics.fillPoints(upper, true);
  }
  if (options.edge !== undefined) {
    // 사방을 두르면 옛 금속 테두리로 되돌아간다. 빛이 닿는 윗변 한 줄만 긋는다.
    const top = [...points].sort((a, b) => a.y - b.y).slice(0, 2).sort((a, b) => a.x - b.x);
    graphics.lineStyle(HOLO.lineWidth, options.edge, options.edgeAlpha ?? 1);
    graphics.lineBetween(top[0].x, top[0].y, top[1].x, top[1].y);
  }
  return graphics;
}

/** 레이어와 같은 모양의 마스크를 만든다. 그림에만 씌우고 화면에는 보이지 않는다. */
export function shapeMask(scene: Phaser.Scene, x: number, y: number, shape: number[]): Phaser.Display.Masks.GeometryMask {
  const graphics = scene.make.graphics({ x, y });
  graphics.fillStyle(0xffffff, 1);
  graphics.fillPoints(toPoints(shape), true);
  return graphics.createGeometryMask();
}

/**
 * 검정에서 투명으로 빠지는 유리면.
 *
 * 하단 바처럼 화면 가장자리를 눌러 주되 판때기로 보이면 안 되는 자리에 쓴다. 캔버스에는 CSS
 * backdrop-filter가 없으므로, 짙은 검정 그라데이션으로 같은 인상을 만든다.
 */
export function drawGlassFade(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { topAlpha?: number; bottomAlpha?: number; color?: number } = {},
): Phaser.GameObjects.Graphics {
  const color = options.color ?? 0x000000;
  const top = options.topAlpha ?? 0;
  const bottom = options.bottomAlpha ?? 0.92;
  const graphics = scene.add.graphics({ x, y });
  graphics.fillGradientStyle(color, color, color, color, top, top, bottom, bottom);
  graphics.fillRect(-width / 2, -height / 2, width, height);
  return graphics;
}

/**
 * 화면 가장자리를 눌러 주는 비네트.
 *
 * 캔버스에는 방사형 그라데이션이 없으므로 네 변에서 안쪽으로 사라지는 띠를 겹쳐 만든다.
 * 배경 원화의 가장자리를 어둡게 눌러 화면 가운데의 캐릭터에 눈이 먼저 가게 한다.
 */
export function drawVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
  options: { depth?: number; strength?: number; thickness?: number } = {},
): Phaser.GameObjects.Graphics {
  const strength = options.strength ?? 0.55;
  const band = options.thickness ?? Math.round(Math.min(width, height) * 0.28);
  const g = scene.add.graphics();
  const black = 0x000000;
  // 위·아래
  g.fillGradientStyle(black, black, black, black, strength, strength, 0, 0);
  g.fillRect(0, 0, width, band);
  g.fillGradientStyle(black, black, black, black, 0, 0, strength, strength);
  g.fillRect(0, height - band, width, band);
  // 좌·우
  g.fillGradientStyle(black, black, black, black, strength, 0, strength, 0);
  g.fillRect(0, 0, band, height);
  g.fillGradientStyle(black, black, black, black, 0, strength, 0, strength);
  g.fillRect(width - band, 0, band, height);
  return g.setDepth(options.depth ?? -25);
}

/** 얇은 구분선. 그라데이션 바 위쪽처럼 경계만 알려야 하는 자리에 쓴다. */
export function drawHairline(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  options: { color?: number; alpha?: number; slant?: number } = {},
): Phaser.GameObjects.Graphics {
  const slant = options.slant ?? 0;
  const graphics = scene.add.graphics({ x, y });
  graphics.lineStyle(HOLO.lineWidth, options.color ?? COLOR.accent, options.alpha ?? 0.55);
  graphics.lineBetween(-width / 2 + slant, 0, width / 2 - slant, 0);
  return graphics;
}

/**
 * 기울어진 게이지 바.
 *
 * 판때기 배경 없이 옅은 홈과 채움 두 겹으로만 만든다. 체력·야성처럼 값이 자주 바뀌는 수치는
 * 전부 이 모양을 공유해 한눈에 같은 종류로 읽히게 한다.
 */
export class HoloBar {
  private readonly fill: Phaser.GameObjects.Graphics;
  private ratio = 1;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
    options: { color: number; trackAlpha?: number; slant?: number },
  ) {
    this.color = options.color;
    const slant = options.slant ?? Math.min(HOLO.slant, height);
    const track = scene.add.graphics({ x, y });
    track.fillStyle(0x000000, options.trackAlpha ?? 0.55);
    track.fillPoints(toPoints(slantedRect(width, height, slant)), true);
    this.fill = scene.add.graphics({ x, y });
    this.redraw();
  }

  setValue(ratio: number, color?: number): void {
    this.ratio = Phaser.Math.Clamp(ratio, 0, 1);
    if (color !== undefined) this.color = color;
    this.redraw();
  }

  setVisible(visible: boolean): void {
    this.fill.setVisible(visible);
  }

  setDepth(depth: number): void {
    this.fill.setDepth(depth);
  }

  private redraw(): void {
    const slant = Math.min(HOLO.slant, this.height);
    const filled = this.width * this.ratio;
    this.fill.clear();
    if (filled <= 0) return;
    this.fill.fillStyle(this.color, 1);
    const left = -this.width / 2;
    const s = slant / 2;
    this.fill.fillPoints(
      toPoints([
        left + s, -this.height / 2,
        left + filled + s, -this.height / 2,
        left + filled - s, this.height / 2,
        left - s, this.height / 2,
      ]),
      true,
    );
  }

  /** 바를 화면에서 지운다. */
  destroy(): void {
    this.fill.destroy();
  }
}
