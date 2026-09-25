import type { ProfileFrameStyle } from "../data/profileFrames";

/**
 * 프로필 테두리의 모양 — Phaser 없이 점만 낸다. 그리는 일은 `ProfileAvatar`가 하고, 장식이 어디까지
 * 뻗는지는 테스트가 같은 점으로 잰다.
 *
 * **테두리는 네모가 아니라 왼쪽 위·오른쪽 아래가 깎인 칩이다.** 장식을 상자의 네 모서리와 네 변
 * 가운데(0)에 세우던 때는 깎인 모서리 밖에 괄호가 허공에 떠 있었고, 변 가운데 보석과 왕관은 깎인
 * 만큼 한쪽으로 쏠려 보였다. 그래서 자리를 전부 **실제 변**에서 구한다 — 변 가운데는 그 변이 남은
 * 구간의 가운데이고(`anchors`), 깎인 모서리에는 그 빗변을 따르는 장식이 선다.
 */
export interface FramePoint { x: number; y: number }

/** 얼굴 칩의 깎인 모서리 비율. 얼굴 액자(`ITEM_FRAME`)와 같은 결로 둔다. */
export const PROFILE_FRAME_BEVEL = 0.24;
/** 얼굴과 테두리 선 사이의 여백(얼굴 한 변 대비). */
export const PROFILE_FRAME_PAD = 0.07;
/**
 * 장식이 얼굴 가운데에서 뻗어도 되는 거리(얼굴 한 변 대비, 가로·세로 각각).
 *
 * 부르는 쪽은 `size × 2 × REACH` 넓이를 비워 두면 된다. 날개·왕관이 이 값을 넘던 때는 프로필 카드에서
 * 왕관이 팝업 윗변과 제목표를, 날개가 팝업 왼쪽 변과 이름줄을 넘었다.
 */
export const PROFILE_FRAME_REACH = 0.72;

export const FRAME_STYLE_RANK: readonly ProfileFrameStyle[] = ["plain", "bracket", "gem", "wing", "vine", "crown"];

export function profileFrameOuter(size: number): number {
  return size * (1 + PROFILE_FRAME_PAD * 2);
}

/** 한 변이 `side`인 깎인 칩 — `chipPoints`와 같은 도형이다(좌상 → 시계 방향). */
export function bevelSquare(side: number): FramePoint[] {
  const h = side / 2;
  const b = side * PROFILE_FRAME_BEVEL;
  return [
    { x: -h, y: -h + b }, { x: -h + b, y: -h }, { x: h, y: -h },
    { x: h, y: h - b }, { x: h - b, y: h }, { x: -h, y: h },
  ];
}

/** 테두리 선 위의 자리들. 변 가운데는 **깎이고 남은 구간**의 가운데다. */
export function profileFrameAnchors(size: number) {
  const outer = profileFrameOuter(size);
  const h = outer / 2;
  const b = outer * PROFILE_FRAME_BEVEL;
  return {
    half: h,
    bevel: b,
    top: { x: b / 2, y: -h },
    right: { x: h, y: -b / 2 },
    bottom: { x: -b / 2, y: h },
    left: { x: -h, y: b / 2 },
    /** 깎이지 않은 두 모서리. */
    topRight: { x: h, y: -h },
    bottomLeft: { x: -h, y: h },
    /** 깎인 두 모서리의 빗변 가운데와, 그 빗변에서 바깥으로 향하는 단위 법선. */
    topLeftCut: { x: -h + b / 2, y: -h + b / 2, nx: -Math.SQRT1_2, ny: -Math.SQRT1_2 },
    bottomRightCut: { x: h - b / 2, y: h - b / 2, nx: Math.SQRT1_2, ny: Math.SQRT1_2 },
  };
}

export interface FrameRing { side: number; width: number; tone: "frame" | "white"; alpha: number }
export interface FrameStroke { points: FramePoint[]; width: number }
export interface FrameDiamond { x: number; y: number; w: number; h: number; tone: "frame" | "light" }
export interface FrameBlade { x: number; y: number; angle: number; length: number; width: number }

export interface ProfileFrameShapes {
  /** 테두리 밖으로 번지는 빛(겹쳐 밝아지는 합성). */
  glow: FrameRing[];
  /** 깃·잎 — 테두리 선 **아래**에 깔아 뿌리가 선 밑으로 숨는다. */
  blades: FrameBlade[];
  rings: FrameRing[];
  strokes: FrameStroke[];
  crown?: FramePoint[];
  diamonds: FrameDiamond[];
}

export function diamondPoints(d: FrameDiamond): FramePoint[] {
  return [{ x: d.x, y: d.y - d.h }, { x: d.x + d.w, y: d.y }, { x: d.x, y: d.y + d.h }, { x: d.x - d.w, y: d.y }];
}

/** 한쪽 끝이 뾰족한 잎·깃 한 장 — 뿌리 → 한쪽 배 → 끝 → 반대쪽 배. */
export function bladePoints(blade: FrameBlade): FramePoint[] {
  const cos = Math.cos(blade.angle);
  const sin = Math.sin(blade.angle);
  const at = (t: number, side: number): FramePoint => ({
    x: blade.x + cos * blade.length * t - sin * blade.width * side,
    y: blade.y + sin * blade.length * t + cos * blade.width * side,
  });
  return [{ x: blade.x, y: blade.y }, at(0.45, 1), at(1, 0), at(0.45, -1)];
}

/** 깎인 모서리 한 곳의 괄호 — 빗변과 나란한 막대에 얼굴 쪽으로 꺾인 끝 두 개. */
function cutBracket(cut: { x: number; y: number; nx: number; ny: number }, offset: number, length: number, tick: number): FramePoint[] {
  // 빗변의 방향은 법선을 90° 돌린 것.
  const dx = -cut.ny;
  const dy = cut.nx;
  const cx = cut.x + cut.nx * offset;
  const cy = cut.y + cut.ny * offset;
  const a = { x: cx - dx * length / 2, y: cy - dy * length / 2 };
  const b = { x: cx + dx * length / 2, y: cy + dy * length / 2 };
  return [
    { x: a.x - cut.nx * tick, y: a.y - cut.ny * tick }, a,
    b, { x: b.x - cut.nx * tick, y: b.y - cut.ny * tick },
  ];
}

/** 테두리 한 장의 도형. 레벨이 연 테두리일수록 장식이 늘어난다. */
export function profileFrameShapes(size: number, style: ProfileFrameStyle): ProfileFrameShapes {
  const outer = profileFrameOuter(size);
  const anchor = profileFrameAnchors(size);
  const rank = FRAME_STYLE_RANK.indexOf(style);
  const shapes: ProfileFrameShapes = { glow: [], blades: [], rings: [], strokes: [], diamonds: [] };
  const diamond = (point: FramePoint, w: number, h: number, tone: FrameDiamond["tone"] = "frame"): void => {
    shapes.diamonds.push({ x: point.x, y: point.y, w: w * size, h: h * size, tone });
  };
  const cuts = [anchor.topLeftCut, anchor.bottomRightCut];

  if (rank >= 2) {
    for (let band = 0; band < 4; band += 1) {
      shapes.glow.push({ side: outer + size * 0.04 * (band + 1), width: size * 0.03, tone: "frame", alpha: (0.05 + rank * 0.012) * (1 - band / 4) });
    }
  }
  // 바탕 테두리 — 굵은 색 선 한 줄과 그 안쪽의 가는 흰 선. 가장 높은 테두리만 바깥에 한 겹 더.
  shapes.rings.push({ side: outer, width: size * 0.05, tone: "frame", alpha: 1 });
  shapes.rings.push({ side: outer - size * 0.07, width: Math.max(1.5, size * 0.012), tone: "white", alpha: 0.45 });
  if (style === "crown") shapes.rings.push({ side: outer + size * 0.09, width: Math.max(2, size * 0.018), tone: "frame", alpha: 0.7 });

  switch (style) {
    case "plain":
      break;
    case "bracket": {
      // 조준경처럼 얼굴을 붙잡는 괄호. 깎이지 않은 모서리는 ㄱ자, 깎인 모서리는 빗변을 따르는 막대다.
      const gap = size * 0.06;
      const reach = anchor.half + gap;
      const arm = size * 0.2;
      const width = size * 0.035;
      for (const [sx, sy] of [[1, -1], [-1, 1]] as const) {
        shapes.strokes.push({ width, points: [
          { x: sx * reach - sx * arm, y: sy * reach }, { x: sx * reach, y: sy * reach }, { x: sx * reach, y: sy * reach - sy * arm },
        ] });
      }
      for (const cut of cuts) shapes.strokes.push({ width, points: cutBracket(cut, gap, anchor.bevel * Math.SQRT2 * 0.78, arm * 0.4) });
      break;
    }
    case "gem": {
      // 네 변 가운데에 보석(윗변이 가장 크다), 모서리마다 작은 보석 — 깎인 모서리는 빗변 가운데에 앉는다.
      diamond(anchor.top, 0.09, 0.13);
      for (const point of [anchor.bottom, anchor.left, anchor.right]) diamond(point, 0.075, 0.11);
      for (const point of [anchor.topRight, anchor.bottomLeft, ...cuts]) diamond(point, 0.045, 0.066);
      break;
    }
    case "wing": {
      // 좌우 변에서 위로 솟는 깃 세 장씩. 뿌리를 테두리 선 밑에 두어 선에서 돋아난 것처럼 선다.
      const root = anchor.half - size * 0.03;
      const feathers = [
        { y: -0.06, lift: 60, length: 0.27 },
        { y: 0.04, lift: 38, length: 0.2 },
        { y: 0.14, lift: 15, length: 0.15 },
      ];
      for (const side of [-1, 1] as const) {
        for (const feather of feathers) {
          const lift = (feather.lift * Math.PI) / 180;
          shapes.blades.push({ x: side * root, y: feather.y * size, angle: side > 0 ? -lift : Math.PI + lift, length: feather.length * size, width: size * 0.06 });
        }
      }
      diamond(anchor.top, 0.08, 0.12);
      break;
    }
    case "vine": {
      // 깎이지 않은 두 모서리에서 뻗는 잎 무리. 깎인 모서리와 위·아래 변 가운데에는 보석.
      const inset = size * 0.04;
      for (const [corner, base] of [[anchor.topRight, -Math.PI / 4], [anchor.bottomLeft, (Math.PI * 3) / 4]] as const) {
        const x = corner.x - Math.sign(corner.x) * inset;
        const y = corner.y - Math.sign(corner.y) * inset;
        [-0.7, 0, 0.7].forEach((offset, index) => shapes.blades.push({ x, y, angle: base + offset, length: size * (index === 1 ? 0.24 : 0.17), width: size * 0.055 }));
      }
      diamond(anchor.top, 0.07, 0.1);
      diamond(anchor.bottom, 0.07, 0.1);
      for (const cut of cuts) diamond(cut, 0.045, 0.066);
      break;
    }
    case "crown": {
      // 윗변(깎이고 남은 구간) 가운데에 선 왕관 — 다섯 봉우리, 봉우리마다 보석. 밑동은 테두리 선에 걸친다.
      const baseY = -anchor.half + size * 0.02;
      const width = size * 0.56;
      const centerX = anchor.top.x;
      const peaks = [0.07, 0.13, 0.09, 0.13, 0.07].map((h) => h * size);
      const step = width / peaks.length;
      const points: FramePoint[] = [{ x: centerX - width / 2, y: baseY }];
      peaks.forEach((h, index) => {
        const x = centerX - width / 2 + step * (index + 0.5);
        points.push({ x: x - step / 2 + 2, y: baseY - h * 0.45 }, { x, y: baseY - h });
      });
      points.push({ x: centerX + width / 2, y: baseY - peaks[4] * 0.45 }, { x: centerX + width / 2, y: baseY });
      shapes.crown = points;
      peaks.forEach((h, index) => diamond({ x: centerX - width / 2 + step * (index + 0.5), y: baseY - h }, 0.022, 0.03, "light"));
      diamond(anchor.left, 0.08, 0.12);
      diamond(anchor.right, 0.08, 0.12);
      diamond(anchor.bottom, 0.1, 0.13);
      for (const cut of cuts) diamond(cut, 0.045, 0.066, "light");
      break;
    }
  }
  return shapes;
}

/** 그려지는 모든 점과 그 점을 둘러싼 선 두께의 절반 — 경계 검사에 쓴다. */
export function profileFrameExtentPoints(size: number, style: ProfileFrameStyle): { x: number; y: number; pad: number }[] {
  const shapes = profileFrameShapes(size, style);
  const out: { x: number; y: number; pad: number }[] = [];
  // 칩의 빗변은 두께를 법선 방향으로 벌리므로 꼭짓점에서는 절반 두께를 대각으로 넉넉히 잡는다.
  for (const ring of [...shapes.glow, ...shapes.rings]) for (const p of bevelSquare(ring.side)) out.push({ ...p, pad: ring.width / 2 });
  for (const stroke of shapes.strokes) for (const p of stroke.points) out.push({ ...p, pad: stroke.width / 2 });
  for (const blade of shapes.blades) for (const p of bladePoints(blade)) out.push({ ...p, pad: 1 });
  for (const p of shapes.crown ?? []) out.push({ ...p, pad: Math.max(1.5, size * 0.01) / 2 });
  for (const d of shapes.diamonds) for (const p of diamondPoints(d)) out.push({ ...p, pad: Math.max(1, size * 0.008) / 2 });
  return out;
}

/** 장식이 가운데에서 가장 멀리 뻗는 거리(가로·세로 중 큰 쪽). */
export function profileFrameReach(size: number, style: ProfileFrameStyle): number {
  return Math.max(...profileFrameExtentPoints(size, style).map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)) + p.pad));
}
