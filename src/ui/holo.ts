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
  /**
   * 열린 구간의 중심을 좌우로 미는 값. 머리 장식(모자·깃털·후드)이 한쪽으로 쏠린 원화가
   * 그 쪽 대각선 모서리 안쪽에서 잘리는 것을 막을 때만 쓴다. 0이면 가운데 그대로다.
   */
  openOffsetX?: number;
  /**
   * 열린 구간의 **꼭대기** 폭. 비우면 `openWidth` 그대로라 옆 변이 수직으로 선다.
   *
   * 잘린 모서리를 피해야 하는 것은 홈이 윗변과 만나는 한 줄뿐이고 그보다 위에는 면이 없다.
   * 그래서 꼭대기를 더 넓게 열면 홈이 위로 벌어지는 사다리꼴이 되어, 좁아진 아랫폭이 머리
   * 끝까지 따라 올라가 정수리 옆을 세로로 베는 일이 없어진다.
   */
  openTopWidth?: number;
  /** 꼭대기 폭의 중심이 밀린 거리. 비우면 `openOffsetX`를 그대로 쓴다. */
  openTopOffsetX?: number;
}

/**
 * 모서리를 깎아 낸 칩 모양.
 *
 * 네 모서리를 서로 다르게 깎는 것이 기본이다. 같은 길이로 깎으면 반듯한 팔각형이 되어
 * 정면에서 찍어 낸 판처럼 보이고, 어긋나게 깎아야 비스듬히 잘린 조각처럼 읽힌다.
 *
 * `openWidth`를 주면 윗변 가운데가 위로 뚫린다. 카드에서 캐릭터 머리만 칩 밖으로 나오게 하는
 * 구멍이라, 잘린 모서리는 그대로 두고 가운데만 연다. `openTopWidth`로 꼭대기를 더 넓히면
 * 구멍이 위로 벌어지는 사다리꼴이 된다.
 */
export function chipPoints(width: number, height: number, options: ChipOptions = {}): number[] {
  const given = options.bevel ?? HOLO.bevel;
  const bevels: Required<Bevels> = typeof given === "number"
    ? { topLeft: given, topRight: given, bottomRight: 0, bottomLeft: 0 }
    : { topLeft: given.topLeft ?? 0, topRight: given.topRight ?? 0, bottomRight: given.bottomRight ?? 0, bottomLeft: given.bottomLeft ?? 0 };
  const open = options.openWidth ?? 0;
  const openShift = options.openOffsetX ?? 0;
  const openTopHalf = Math.max(open, options.openTopWidth ?? open) / 2;
  const openTopShift = options.openTopOffsetX ?? openShift;
  const openTop = -height / 2 - (options.openHeight ?? 0);
  const hw = width / 2;
  const hh = height / 2;
  const points = [-hw, -hh + bevels.topLeft, -hw + bevels.topLeft, -hh];
  if (open > 0) {
    points.push(
      -open / 2 + openShift, -hh,
      -openTopHalf + openTopShift, openTop,
      openTopHalf + openTopShift, openTop,
      open / 2 + openShift, -hh,
    );
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
  /** 윗변 강조선의 두께. 색으로 뜻을 알리는 자리(능력치 칩)는 굵게 긋는다. */
  edgeWidth?: number;
  /**
   * 면 **안쪽** 위에서 아래로 사라지는 색 발광.
   *
   * 테두리로 색을 알리면 면 밖으로 선이 튀어나와 홀로그램의 결이 깨진다. 대신 면을 잘라 낸
   * 조각을 겹겹이 칠해, 마스크 없이도 위쪽만 은은하게 물든 그라데이션을 만든다.
   */
  glow?: { color: number; strength?: number; height?: number };
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
  if (options.glow) {
    // 같은 알파로 점점 작게 잘라 낸 조각을 겹친다. 위로 갈수록 여러 겹이 포개져 저절로
    // 위가 진하고 아래로 사라지는 결이 된다 — 다각형 채우기에는 그라데이션이 없기 때문이다.
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    const span = (bottom - top) * (options.glow.height ?? 0.55);
    const bands = 9;
    graphics.fillStyle(options.glow.color, (options.glow.strength ?? 0.5) / bands);
    for (let i = 1; i <= bands; i += 1) {
      graphics.fillPoints(clipAbove(points, top + (span * i) / bands), true);
    }
  }
  if (options.edge !== undefined) {
    // 사방을 두르면 옛 금속 테두리로 되돌아간다. 빛이 닿는 윗변 한 줄만 긋는다.
    const top = [...points].sort((a, b) => a.y - b.y).slice(0, 2).sort((a, b) => a.x - b.x);
    graphics.lineStyle(options.edgeWidth ?? HOLO.lineWidth, options.edge, options.edgeAlpha ?? 1);
    graphics.lineBetween(top[0].x, top[0].y, top[1].x, top[1].y);
  }
  return graphics;
}

/**
 * 모서리를 둥글린 면 하나.
 *
 * 화면의 판은 기울이는 것이 기본이지만, 상단 재화 줄처럼 **여러 칸이 나란히 서는 자리**는
 * 예외다. 칸마다 기울면 숫자와 아이콘까지 함께 비뚤어 보여 줄이 어수선해진다. 곧고 둥근
 * 면 하나로 값만 담는다.
 */
export function drawRoundedLayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill: number; alpha?: number; radius?: number } = { fill: 0x05070a },
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics({ x, y });
  graphics.fillStyle(options.fill, options.alpha ?? HOLO.glass);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, options.radius ?? height / 2);
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

/**
 * 도형의 변을 그대로 따라 긋는 선.
 *
 * 기울어진 판 위에 수평선을 그으면 변과 어긋나 판이 두 겹으로 보인다. 판을 만든 좌표를 그대로
 * 넘겨 같은 변을 다시 긋게 해서, 꾸미는 선이 언제나 판에 붙어 있게 한다.
 * `inset`은 양 끝을 안쪽으로 당기는 길이다.
 */
export function drawShapeEdge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: number[],
  edge: "top" | "bottom",
  options: { color?: number; alpha?: number; width?: number; inset?: number } = {},
): Phaser.GameObjects.Graphics {
  const points = toPoints(shape);
  const sorted = [...points].sort((a, b) => (edge === "top" ? a.y - b.y : b.y - a.y));
  const [left, right] = [sorted[0], sorted[1]].sort((a, b) => a.x - b.x);
  const inset = options.inset ?? 0;
  const span = Math.hypot(right.x - left.x, right.y - left.y) || 1;
  const ux = (right.x - left.x) / span;
  const uy = (right.y - left.y) / span;
  const graphics = scene.add.graphics({ x, y });
  graphics.lineStyle(options.width ?? HOLO.lineWidth, options.color ?? COLOR.accent, options.alpha ?? 0.55);
  graphics.lineBetween(left.x + ux * inset, left.y + uy * inset, right.x - ux * inset, right.y - uy * inset);
  return graphics;
}

/**
 * 도형 둘레를 한 줄로 두른다.
 *
 * 화면의 판때기에는 쓰지 않는다(윗변 한 줄이 원칙이다). **액자**에만 쓴다 — 스킬 아이콘처럼
 * 그림 한 장을 담는 칸은 어디까지가 그림인지 사방이 알려 줘야 배경 원화 위에서 흐물거리지 않는다.
 */
export function drawShapeOutline(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: number[],
  options: { color?: number; alpha?: number; width?: number } = {},
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics({ x, y });
  graphics.lineStyle(options.width ?? HOLO.lineWidth, options.color ?? COLOR.accent, options.alpha ?? 0.8);
  graphics.strokePoints(toPoints(shape), true);
  return graphics;
}

/**
 * 테두리 안쪽으로 스며드는 어둠.
 *
 * 다각형 채우기에는 그라데이션이 없으므로, 같은 도형을 조금씩 줄여 여러 겹 겹친다. 바깥쪽
 * 겹이 여러 번 포개져 가장자리가 진하고 가운데로 갈수록 사라진다 — 그림이 액자 안으로
 * 들어앉아 보이게 하는 최소한의 깊이다.
 */
export function drawInnerVignette(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: number[],
  options: { strength?: number; bands?: number; depth?: number } = {},
): Phaser.GameObjects.Graphics {
  const bands = options.bands ?? 8;
  const depth = options.depth ?? 0.3;
  const strength = options.strength ?? 0.5;
  const points = toPoints(shape);
  const graphics = scene.add.graphics({ x, y });
  // 채우기를 겹치면 가운데가 가장 진해진다. 그래서 채우지 않고 **줄여 가며 두른다** —
  // 바깥 줄이 가장 진하고 안쪽으로 갈수록 옅어져, 가장자리만 어두워진다.
  for (let i = 0; i < bands; i += 1) {
    const factor = 1 - (depth * i) / bands;
    const fade = 1 - i / bands;
    graphics.lineStyle(Math.max(2, (depth * 100) / bands), 0x000000, strength * fade * fade);
    graphics.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x * factor, point.y * factor)), true);
  }
  return graphics;
}

/**
 * 액자 안쪽 가장자리에서 번지는 빛.
 *
 * `drawInnerVignette`의 반대다 — 어둠 대신 색을 두르고 겹쳐 밝아지는 합성을 쓴다. 같은
 * 도형을 조금씩 줄여 가며 두르므로 빛이 액자 **안쪽**에 머물고 틀 밖으로 새지 않는다.
 * 무엇이 다 자란 것인지 표식을 따로 붙이지 않고 액자 자체가 말하게 하는 자리에 쓴다.
 */
export function drawShapeInnerGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: number[],
  options: { color?: number; strength?: number; bands?: number; depth?: number } = {},
): Phaser.GameObjects.Graphics {
  const bands = options.bands ?? 7;
  const depth = options.depth ?? 0.26;
  const strength = options.strength ?? 0.5;
  const points = toPoints(shape);
  const graphics = scene.add.graphics({ x, y });
  graphics.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < bands; i += 1) {
    const factor = 1 - (depth * i) / bands;
    const fade = 1 - i / bands;
    graphics.lineStyle(Math.max(2, (depth * 100) / bands), options.color ?? COLOR.accent, strength * fade * fade);
    graphics.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x * factor, point.y * factor)), true);
  }
  return graphics;
}

/**
 * 판 하나의 가장자리만 고르게 눌러 주는 비네팅.
 *
 * 같은 도형을 조금씩 줄여 여러 번 두르는 방식(`drawInnerVignette`)은 가로로 긴 판에서 좌우가
 * 세로보다 훨씬 많이 줄어들어, 검은 줄이 여러 겹 어긋나 **테두리 잔상**으로 남는다. 화면
 * 비네트와 같이 네 변에서 안쪽으로 빠지는 그라데이션 네 장을 쓰면 어느 비율에서도 고르게
 * 어두워지고 선이 남지 않는다. 도형 밖으로 새지 않도록 부르는 쪽이 마스크를 씌운다.
 */
export function drawFrameVignette(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { strength?: number; spread?: number } = {},
): Phaser.GameObjects.Graphics {
  const strength = options.strength ?? 0.6;
  const spread = options.spread ?? 0.3;
  const bandX = Math.round(width * spread);
  const bandY = Math.round(height * spread);
  const left = -width / 2;
  const top = -height / 2;
  const black = 0x000000;
  const g = scene.add.graphics({ x, y });
  g.fillGradientStyle(black, black, black, black, strength, strength, 0, 0);
  g.fillRect(left, top, width, bandY);
  g.fillGradientStyle(black, black, black, black, 0, 0, strength, strength);
  g.fillRect(left, top + height - bandY, width, bandY);
  g.fillGradientStyle(black, black, black, black, strength, 0, strength, 0);
  g.fillRect(left, top, bandX, height);
  g.fillGradientStyle(black, black, black, black, 0, strength, 0, strength);
  g.fillRect(left + width - bandX, top, bandX, height);
  return g;
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
  /** 홈도 채움과 같은 생명주기로 제거해 탭 재구성 시 잔상이 남지 않게 한다. */
  private readonly track: Phaser.GameObjects.Graphics;
  /** 최대치 테두리와 칸 나눔. 켜지 않은 게이지에는 없다. */
  private readonly frame?: Phaser.GameObjects.Graphics;
  private ratio = 1;
  private color: number;

  /** 복합 UI가 게이지 두 겹을 자신의 컨테이너 생명주기에 함께 묶을 때 쓰는 표시 객체다. */
  get objects(): readonly Phaser.GameObjects.Graphics[] {
    return this.frame ? [this.track, this.fill, this.frame] : [this.track, this.fill];
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
    options: {
      color: number;
      trackAlpha?: number;
      slant?: number;
      /**
       * 최대치를 흰 선으로 둘러 배경에서 떼어 놓는다.
       *
       * 밝은 배경 원화 위에서는 채움만으로 "어디까지가 이 게이지인가"가 보이지 않는다.
       * 판때기 위에 놓이는 게이지(설정·임무)는 그럴 일이 없으므로 켜지 않는다.
       */
      outline?: boolean;
      /** 칸을 나누는 흰 선의 개수. 얼마나 남았는지를 눈금으로 셈하게 한다. */
      ticks?: number;
    },
  ) {
    this.color = options.color;
    const slant = options.slant ?? Math.min(HOLO.slant, height);
    this.track = scene.add.graphics({ x, y });
    this.track.fillStyle(0x000000, options.trackAlpha ?? 0.55);
    this.track.fillPoints(toPoints(slantedRect(width, height, slant)), true);
    this.fill = scene.add.graphics({ x, y });
    // 테두리와 눈금은 채움 위에 얹혀야 채워진 자리에서도 칸이 보인다.
    this.frame = options.outline || options.ticks ? scene.add.graphics({ x, y }) : undefined;
    if (this.frame) {
      const half = { w: width / 2, h: height / 2 };
      for (let i = 1; i <= (options.ticks ?? 0); i += 1) {
        const tick = -half.w + (width * i) / ((options.ticks ?? 0) + 1);
        this.frame.lineStyle(2, 0xffffff, 0.45);
        this.frame.lineBetween(tick + slant / 2, -half.h, tick - slant / 2, half.h);
      }
      if (options.outline) {
        this.frame.lineStyle(2, 0xffffff, 0.72);
        this.frame.strokePoints(toPoints(slantedRect(width, height, slant)), true);
      }
    }
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

  /** 팝업 같은 컨테이너 프리팹 안에서도 홈과 채움을 한 묶음으로 이동시킨다. */
  addTo(container: Phaser.GameObjects.Container): this {
    container.add([...this.objects]);
    return this;
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
    this.track.destroy();
    this.fill.destroy();
    this.frame?.destroy();
  }
}
