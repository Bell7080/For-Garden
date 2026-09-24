import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { profileFrameOrDefault, type ProfileFrameDefinition } from "../data/profileFrames";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, toPoints } from "./holo";
import { textStyle } from "./theme";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
/** 얼굴 칩의 깎인 모서리 비율. 얼굴 액자(`ITEM_FRAME`)와 같은 결로 둔다. */
const BEVEL = 0.24;

export interface ProfileAvatarOptions {
  size: number;
  frameId: string;
  /** 비어 있으면 머리글자(`fallback`)가 선다. */
  portraitAssetId?: PortraitAssetId;
  fallback: string;
}

/**
 * 프로필 얼굴 + 아이콘 테두리 — 상단 줄·프로필 카드·선택창이 **같은 한 장**을 쓴다.
 *
 * 테두리는 색만 바꾸는 선이 아니라 **모양이 다른 장식**이다(`ProfileFrameDefinition.style`).
 * 수집형 RPG의 아이콘 테두리가 레벨마다 모서리 장식·보석·날개·왕관으로 화려해지듯, 레벨이 연
 * 테두리일수록 장식이 늘어난다. 장식은 얼굴 밖으로 조금 내밀어 그리므로 부르는 쪽은 `size`보다
 * 한 뼘(약 30%) 큰 자리를 비워 둔다.
 */
export class ProfileAvatar extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: ProfileAvatarOptions) {
    super(scene, x, y);
    const frame = profileFrameOrDefault(options.frameId);
    const size = options.size;
    const pad = size * 0.07;
    const outer = size + pad * 2;
    const shape = chipPoints(outer, outer, { bevel: { topLeft: outer * BEVEL, topRight: 0, bottomRight: outer * BEVEL, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: frame.wash, alpha: 0.96 }));
    if (options.portraitAssetId) {
      this.add(new FaceFrame(scene, 0, 0, { portraitAssetId: options.portraitAssetId, size, color: frame.color }));
    } else {
      this.add(scene.add.text(0, 0, options.fallback, textStyle({ role: "display", size: Math.round(size * 0.42), color: hex(frame.color) })).setOrigin(0.5));
    }
    this.add(drawFrameOrnament(scene, size, frame));
  }
}

/** 테두리 한 장을 그린다 — 바탕 선 두 겹 위에 그 테두리의 장식을 얹는다. */
export function drawFrameOrnament(scene: Phaser.Scene, size: number, frame: ProfileFrameDefinition): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const pad = size * 0.07;
  const outer = size + pad * 2;
  const bevelShape = (side: number): number[] => chipPoints(side, side, { bevel: { topLeft: side * BEVEL, topRight: 0, bottomRight: side * BEVEL, bottomLeft: 0 } });
  const rank = ["plain", "bracket", "gem", "wing", "vine", "crown"].indexOf(frame.style);

  // 빛 — 레벨이 오를수록 테두리 밖으로 번지는 빛이 한 겹씩 짙어진다. 겹쳐 밝아지는 합성이라 옅게.
  if (rank >= 2) {
    const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let band = 0; band < 4; band += 1) {
      glow.lineStyle(size * 0.03, frame.color, (0.05 + rank * 0.012) * (1 - band / 4));
      glow.strokePoints(toPoints(bevelShape(outer + size * 0.04 * (band + 1))), true);
    }
    root.add(glow);
  }

  const g = scene.add.graphics();
  root.add(g);
  // 바탕 테두리 — 굵은 색 선 한 줄과 그 안쪽의 가는 흰 선.
  g.lineStyle(size * 0.05, frame.color, 1);
  g.strokePoints(toPoints(bevelShape(outer)), true);
  g.lineStyle(Math.max(1.5, size * 0.012), 0xffffff, 0.45);
  g.strokePoints(toPoints(bevelShape(outer - size * 0.07)), true);
  if (frame.style === "crown") {
    // 가장 높은 테두리만 바깥에 한 겹 더 두른다.
    g.lineStyle(Math.max(2, size * 0.018), frame.color, 0.7);
    g.strokePoints(toPoints(bevelShape(outer + size * 0.1)), true);
  }

  const half = outer / 2;
  const diamond = (x: number, y: number, w: number, h: number, fill = frame.color): void => {
    g.fillStyle(fill, 1);
    g.fillPoints([new Phaser.Geom.Point(x, y - h), new Phaser.Geom.Point(x + w, y), new Phaser.Geom.Point(x, y + h), new Phaser.Geom.Point(x - w, y)], true);
    // 윗 절반에만 흰빛을 얹어 보석처럼 세운다.
    g.fillStyle(0xffffff, 0.55);
    g.fillPoints([new Phaser.Geom.Point(x, y - h * 0.8), new Phaser.Geom.Point(x + w * 0.5, y - h * 0.1), new Phaser.Geom.Point(x - w * 0.5, y - h * 0.1)], true);
    g.lineStyle(Math.max(1, size * 0.008), 0x05070a, 0.8);
    g.strokePoints([new Phaser.Geom.Point(x, y - h), new Phaser.Geom.Point(x + w, y), new Phaser.Geom.Point(x, y + h), new Phaser.Geom.Point(x - w, y)], true);
  };
  const blade = (x: number, y: number, angle: number, length: number, width: number): void => {
    // 한쪽 끝이 뾰족한 잎·깃 한 장.
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tip = new Phaser.Geom.Point(x + cos * length, y + sin * length);
    const mid = (t: number, side: number): Phaser.Geom.Point => new Phaser.Geom.Point(x + cos * length * t - sin * width * side, y + sin * length * t + cos * width * side);
    g.fillStyle(frame.color, 0.95);
    g.fillPoints([new Phaser.Geom.Point(x, y), mid(0.45, 1), tip, mid(0.45, -1)], true);
    g.lineStyle(Math.max(1, size * 0.006), 0xffffff, 0.5);
    g.lineBetween(x, y, tip.x, tip.y);
  };

  switch (frame.style) {
    case "plain":
      break;
    case "bracket": {
      // 네 모서리 밖의 ㄱ자 괄호 — 조준경처럼 얼굴을 붙잡는다.
      const reach = half + size * 0.08;
      const arm = size * 0.22;
      g.lineStyle(size * 0.035, frame.color, 1);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        g.lineBetween(sx * reach, sy * reach, sx * reach - sx * arm, sy * reach);
        g.lineBetween(sx * reach, sy * reach, sx * reach, sy * reach - sy * arm);
      }
      break;
    }
    case "gem": {
      // 네 변 가운데에 보석, 깎이지 않은 두 모서리에 작은 보석.
      const w = size * 0.075; const h = size * 0.11;
      diamond(0, -half, w * 1.2, h * 1.2);
      diamond(0, half, w, h);
      diamond(-half, 0, w, h);
      diamond(half, 0, w, h);
      diamond(half, -half, w * 0.6, h * 0.6);
      diamond(-half, half, w * 0.6, h * 0.6);
      break;
    }
    case "wing": {
      // 좌우로 펼친 깃 세 장씩 + 윗변의 보석.
      for (const side of [-1, 1] as const) {
        const baseX = side * (half - size * 0.02);
        [-0.5, -0.1, 0.3].forEach((spread, index) => {
          const angle = (side < 0 ? Math.PI : 0) + side * spread;
          blade(baseX, -size * 0.1 + index * size * 0.12, angle, size * (0.42 - index * 0.08), size * 0.07);
        });
      }
      diamond(0, -half, size * 0.08, size * 0.12);
      break;
    }
    case "vine": {
      // 깎이지 않은 두 모서리에서 뻗는 잎 무리와 윗변·밑변의 보석.
      for (const [cx, cy, base] of [[half, -half, -Math.PI / 4], [-half, half, (Math.PI * 3) / 4]] as const) {
        [-0.7, 0, 0.7].forEach((offset, index) => blade(cx, cy, base + offset, size * (index === 1 ? 0.28 : 0.2), size * 0.055));
      }
      diamond(0, -half, size * 0.07, size * 0.1);
      diamond(0, half, size * 0.07, size * 0.1);
      break;
    }
    case "crown": {
      // 윗변 위의 왕관 — 다섯 봉우리, 봉우리마다 보석.
      const baseY = -half - size * 0.02;
      const width = size * 0.56;
      const peaks = [0.16, 0.3, 0.2, 0.3, 0.16].map((h) => h * size);
      const points: Phaser.Geom.Point[] = [new Phaser.Geom.Point(-width / 2, baseY)];
      peaks.forEach((h, index) => {
        const x = -width / 2 + (width * (index + 0.5)) / peaks.length;
        points.push(new Phaser.Geom.Point(x - width / peaks.length / 2 + 2, baseY - h * 0.45));
        points.push(new Phaser.Geom.Point(x, baseY - h));
      });
      points.push(new Phaser.Geom.Point(width / 2, baseY - peaks[4] * 0.45), new Phaser.Geom.Point(width / 2, baseY));
      g.fillStyle(frame.color, 1);
      g.fillPoints(points, true);
      g.lineStyle(Math.max(1.5, size * 0.01), 0xffe9a8, 0.9);
      g.strokePoints(points, true);
      peaks.forEach((h, index) => diamond(-width / 2 + (width * (index + 0.5)) / peaks.length, baseY - h, size * 0.03, size * 0.045, 0xffe9a8));
      diamond(-half, 0, size * 0.08, size * 0.12);
      diamond(half, 0, size * 0.08, size * 0.12);
      diamond(0, half, size * 0.1, size * 0.13);
      break;
    }
  }
  return root;
}
