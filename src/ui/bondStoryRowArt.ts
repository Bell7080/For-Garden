import Phaser from "phaser";
import { getRelic } from "../data/relics";
import { session } from "../state/session";
import { computeFaceBandFrame } from "../puppets/anchors";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
import { portraitCardZoom } from "./portraitPlacement";
import { bakeBandTexture } from "./faceTexture";
import { useBackgroundTexture } from "./backgrounds";
import { recollectionArtCrop, recollectionArtFocus } from "./recollectionLayout";
import { drawFrameVignette, drawShapeOutline } from "./holo";
import { shapeClipMask } from "./popupArt";
import { COLOR } from "./theme";

/**
 * 애착 스토리 한 줄의 그림 — 무대 원화 · 오른쪽에 은은하게 선 렐릭 · 글 쪽 어둠 · 비네트 · 테두리.
 * 입력은 줄(`BondPopups.addStoryRow`)이 맡고 이 파일은 마스크로 잘라 그리기만 한다.
 */
export interface StoryRowArtSpec {
  relicId: string;
  backdrop: string;
  storyId: string;
  open: boolean;
  width: number;
  height: number;
  shape: number[];
  pink: number;
}

/** 애착 스토리 줄의 얼굴 띠 — 오른쪽에 그 렐릭이 은은하게 선다. */
const ROW_FACE = { from: 0.44, fade: 0.24, crop: 0.5, headX: 0.56, anchorY: 0.38, alpha: 0.82 } as const;

export function paintStoryRowArt(scene: Phaser.Scene, row: Phaser.GameObjects.Container, spec: StoryRowArtSpec): void {
  const { width, height, shape } = spec;
  const clip = shapeClipMask(scene, row, shape);
  const art = scene.add.image(0, 0, "__DEFAULT").setAlpha(0);
  row.add(art);
  useBackgroundTexture(scene, art, spec.backdrop, (loaded) => {
    const crop = recollectionArtCrop(loaded.width, loaded.height, width, height, recollectionArtFocus(spec.storyId));
    loaded.setScale(crop.scale).setPosition(crop.offsetX, crop.offsetY);
    loaded.setCrop(crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight);
    loaded.setMask(clip);
    const alpha = spec.open ? 0.62 : 0.24;
    if (session.settings.accessibility.reduceMotion) loaded.setAlpha(alpha);
    else scene.tweens.add({ targets: loaded, alpha, duration: 180 });
  });
  // 그 렐릭이 오른쪽에 은은하게 — 원화 위, 어둠 아래.
  const face = scene.add.container(0, 0).setAlpha(spec.open ? ROW_FACE.alpha : 0.4);
  row.add(face);
  void loadRowFace(scene, face, spec.relicId, width, height, shape, !spec.open);
  // 글이 서는 왼쪽만 어둠이 짙고, 위에 분홍 기운이 한 겹.
  const scrim = scene.add.graphics();
  scrim.fillStyle(COLOR.void, 0.7).fillRect(-width / 2, -height / 2, width * 0.18, height);
  scrim.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0.7, 0, 0.7, 0);
  scrim.fillRect(-width / 2 + width * 0.18, -height / 2, width * 0.4, height);
  if (spec.open) {
    scrim.fillGradientStyle(spec.pink, spec.pink, spec.pink, spec.pink, 0.22, 0, 0.22, 0);
    scrim.fillRect(-width / 2, -height / 2, width * 0.6, height);
  }
  row.add(scrim.setMask(clip));
  row.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.3 }).setMask(clip));
  row.add(drawShapeOutline(scene, 0, 0, shape, { color: spec.open ? spec.pink : COLOR.inkDimHex, alpha: spec.open ? 0.72 : 0.3, width: 3 }));
}

/** 이 판 줄 크기로 구운 얼굴 띠를 기억한다 — 판을 다시 열 때 얼굴이 빈 칸에서 스며 나오지 않게. */
const ROW_FACE_KEYS = new Map<string, string>();

async function loadRowFace(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, relicId: string, width: number, height: number, shape: readonly number[], dimmed: boolean): Promise<void> {
  const cacheKey = `bond-row:${relicId}:${width}:${height}`;
  const cached = ROW_FACE_KEYS.get(cacheKey);
  const place = (key: string, fade: boolean): void => {
    const image = scene.add.image(0, 0, key);
    if (dimmed) image.setTint(0x6a6f78);
    holder.add(image);
    if (fade && !session.settings.accessibility.reduceMotion) { image.setAlpha(0); scene.tweens.add({ targets: image, alpha: 1, duration: 220 }); }
  };
  if (cached && scene.textures.exists(cached)) { place(cached, false); return; }
  const asset = portraitAssetFor(getRelic(relicId).portraitAssetId);
  const key = await withPuppetTexture(scene, asset, ({ key: source, anchors }) => {
    if (!holder.active) return undefined;
    const crop = computeFaceBandFrame(asset, anchors.head, {
      width: Math.round(width * (1 - ROW_FACE.from)), height,
      crop: ROW_FACE.crop / portraitCardZoom(asset), headX: ROW_FACE.headX, anchorY: ROW_FACE.anchorY,
    });
    return bakeBandTexture(scene, source, { width, height }, crop, { shape, from: ROW_FACE.from, fade: ROW_FACE.fade });
  });
  if (!key) return;
  ROW_FACE_KEYS.set(cacheKey, key);
  if (holder.active) place(key, true);
}
