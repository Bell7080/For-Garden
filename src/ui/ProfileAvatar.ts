import Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { profileFrameOrDefault, type ProfileFrameDefinition } from "../data/profileFrames";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer } from "./holo";
import { bevelSquare, bladePoints, diamondPoints, PROFILE_FRAME_BEVEL, PROFILE_FRAME_PAD, profileFrameShapes, type FramePoint } from "./profileFrameGeometry";
import { textStyle } from "./theme";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

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
    const pad = size * PROFILE_FRAME_PAD;
    const outer = size + pad * 2;
    const shape = chipPoints(outer, outer, { bevel: { topLeft: outer * PROFILE_FRAME_BEVEL, topRight: 0, bottomRight: outer * PROFILE_FRAME_BEVEL, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: frame.wash, alpha: 0.96 }));
    if (options.portraitAssetId) {
      this.add(new FaceFrame(scene, 0, 0, { portraitAssetId: options.portraitAssetId, size, color: frame.color }));
    } else {
      this.add(scene.add.text(0, 0, options.fallback, textStyle({ role: "display", size: Math.round(size * 0.42), color: hex(frame.color) })).setOrigin(0.5));
    }
    this.add(drawFrameOrnament(scene, size, frame));
  }
}

/** 테두리 한 장을 그린다 — 모양은 `profileFrameShapes`가 정하고 여기서는 칠하기만 한다. */
export function drawFrameOrnament(scene: Phaser.Scene, size: number, frame: ProfileFrameDefinition): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const shapes = profileFrameShapes(size, frame.style);
  const pts = (points: readonly FramePoint[]): Phaser.Geom.Point[] => points.map((p) => new Phaser.Geom.Point(p.x, p.y));
  const toneColor = (tone: "frame" | "white" | "light"): number => (tone === "white" ? 0xffffff : tone === "light" ? 0xffe9a8 : frame.color);

  // 빛 — 레벨이 오를수록 테두리 밖으로 번지는 빛이 한 겹씩 짙어진다. 겹쳐 밝아지는 합성이라 옅게.
  if (shapes.glow.length > 0) {
    const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (const ring of shapes.glow) {
      glow.lineStyle(ring.width, toneColor(ring.tone), ring.alpha);
      glow.strokePoints(pts(bevelSquare(ring.side)), true);
    }
    root.add(glow);
  }

  const g = scene.add.graphics();
  root.add(g);
  // 깃·잎은 테두리 선보다 먼저 — 뿌리가 선 밑으로 숨어 선에서 돋아난 것처럼 선다.
  for (const blade of shapes.blades) {
    const points = bladePoints(blade);
    g.fillStyle(frame.color, 0.95);
    g.fillPoints(pts(points), true);
    g.lineStyle(Math.max(1, size * 0.006), 0xffffff, 0.5);
    g.lineBetween(points[0].x, points[0].y, points[2].x, points[2].y);
  }
  for (const ring of shapes.rings) {
    g.lineStyle(ring.width, toneColor(ring.tone), ring.alpha);
    g.strokePoints(pts(bevelSquare(ring.side)), true);
  }
  for (const stroke of shapes.strokes) {
    g.lineStyle(stroke.width, frame.color, 1);
    g.strokePoints(pts(stroke.points), false);
  }
  if (shapes.crown) {
    g.fillStyle(frame.color, 1);
    g.fillPoints(pts(shapes.crown), true);
    g.lineStyle(Math.max(1.5, size * 0.01), 0xffe9a8, 0.9);
    g.strokePoints(pts(shapes.crown), true);
  }
  for (const diamond of shapes.diamonds) {
    const { x, y, w, h } = diamond;
    g.fillStyle(toneColor(diamond.tone), 1);
    g.fillPoints(pts(diamondPoints(diamond)), true);
    // 윗 절반에만 흰빛을 얹어 보석처럼 세운다.
    g.fillStyle(0xffffff, 0.55);
    g.fillPoints(pts([{ x, y: y - h * 0.8 }, { x: x + w * 0.5, y: y - h * 0.1 }, { x: x - w * 0.5, y: y - h * 0.1 }]), true);
    g.lineStyle(Math.max(1, size * 0.008), 0x05070a, 0.8);
    g.strokePoints(pts(diamondPoints(diamond)), true);
  }
  return root;
}
