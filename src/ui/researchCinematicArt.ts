import type Phaser from "phaser";
import type { PortraitAssetId } from "../core/types";
import { computeFaceFrame, computeHeadCardFrame } from "../puppets/anchors";
import { loadPortraitTexture, portraitAssetFor } from "../puppets/assets";
import { faceClipShape } from "./faceTexture";
import { ITEM_FRAME } from "./itemFrame";

/**
 * 시네마틱 카드에 실제 원화를 넣는다.
 *
 * 시네마틱은 Phaser가 아니라 DOM 한 겹이라 `PortraitCard`·`FaceFrame`을 그대로 세울 수 없다.
 * 그렇다고 도형 아이콘으로 대신하면 **그리드·결과판과 다른 그림**이 뽑기에서만 서게 된다 —
 * 그래서 원화를 그리는 대신 **같은 잘라내기 규칙으로 구워** 그림 한 장으로 넘긴다.
 *
 * 잘라내기 값을 여기서 다시 정하지 않는다. 카드는 `computeHeadCardFrame`, 파편 얼굴은
 * `computeFaceFrame`으로 게임 화면과 **같은 함수·같은 배율 보정**을 지난다. 두 곳이 갈리면
 * 같은 개체가 도감과 뽑기에서 다른 크기로 선다.
 */

/** 구운 그림은 같은 개체·같은 크기면 다시 굽지 않는다. 10연이 같은 개체를 여러 번 낸다. */
const baked = new Map<string, string>();

/** 액자 안 그림이 차지하는 비율. 재화 아이콘만 사방 여백이 규격이다. */
export const CINEMATIC_ICON_RATIO = ITEM_FRAME.icon;

/** `FaceFrame`이 쓰는 값과 같아야 한다 — 파편 얼굴이 결과판과 뽑기에서 다른 크기로 서지 않게. */
const FACE_CROP = 0.34;
const FACE_ANCHOR_Y = 0.52;


function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : undefined;
}

/** WebP가 없는 기기도 있으므로 실패하면 PNG로 되돌아간다. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL("image/webp", 0.92);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/**
 * 카드에 세울 전신 잘라내기.
 *
 * 그리드 카드와 같은 `fillRatio`·`headroom`·`cardTop`을 쓴다 — 정수리를 한 줄도 자르지 않고,
 * 등신이 낮은 원화는 제 `cardZoom`으로 되돌려 한 판에서 크기가 튀지 않게 한다.
 */
export async function bakeCinematicPortrait(
  scene: Phaser.Scene,
  portraitAssetId: PortraitAssetId,
  width: number,
  height: number,
): Promise<string | undefined> {
  const cacheKey = `card:${portraitAssetId}:${width}x${height}`;
  const cached = baked.get(cacheKey);
  if (cached) return cached;
  try {
    const asset = portraitAssetFor(portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(scene, asset);
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const frame = computeHeadCardFrame(asset, anchors.head, {
      width,
      height,
      fillRatio: 0.56 / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      headroom: 0,
      cardTop: asset.cardTop,
    });
    const target = canvasOf(width, height);
    if (!target) return undefined;
    target.ctx.drawImage(
      source,
      frame.cropX, frame.cropY, frame.cropWidth, frame.cropHeight,
      0, 0, frame.cropWidth * frame.scale, frame.cropHeight * frame.scale,
    );
    const url = encode(target.canvas);
    baked.set(cacheKey, url);
    return url;
  } catch {
    // 묶음 하나를 못 읽어도 연출은 멈추지 않는다. 그 칸만 그림 없이 선다.
    return undefined;
  }
}

/**
 * 파편 액자에 들어갈 얼굴.
 *
 * 액자와 같은 크기로 굽고 깎인 두 모서리를 **그림 자체에서** 지운다 — DOM에서 덮으면 외곽선
 * 너머로 검은 뿔이 남고, `clip-path`는 그림과 액자가 따로 깎여 한 픽셀씩 어긋난다
 * (`faceTexture.ts`와 같은 이유·같은 도형이다).
 */
export async function bakeCinematicFace(
  scene: Phaser.Scene,
  portraitAssetId: PortraitAssetId,
  size: number,
): Promise<string | undefined> {
  const cacheKey = `face:${portraitAssetId}:${size}`;
  const cached = baked.get(cacheKey);
  if (cached) return cached;
  try {
    const asset = portraitAssetFor(portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(scene, asset);
    const source = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const face = computeFaceFrame(asset, anchors.head, {
      size,
      crop: FACE_CROP / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      anchorY: FACE_ANCHOR_Y,
    });
    const target = canvasOf(size, size);
    if (!target) return undefined;
    target.ctx.drawImage(source, face.cropX, face.cropY, face.cropWidth, face.cropWidth, 0, 0, size, size);
    target.ctx.globalCompositeOperation = "destination-in";
    target.ctx.beginPath();
    const shape = faceClipShape(size);
    for (let index = 0; index < shape.length; index += 2) {
      const x = shape[index] + size / 2;
      const y = shape[index + 1] + size / 2;
      if (index === 0) target.ctx.moveTo(x, y); else target.ctx.lineTo(x, y);
    }
    target.ctx.closePath();
    target.ctx.fill();
    target.ctx.globalCompositeOperation = "source-over";
    const url = encode(target.canvas);
    baked.set(cacheKey, url);
    return url;
  } catch {
    return undefined;
  }
}

/**
 * 재화·DNA 조각 아이콘.
 *
 * 파일 경로가 아니라 **이미 올라와 있는 텍스처**에서 굽는다 — 로딩 단계가 읽어 둔 그림이라
 * 다시 내려받지 않고, 배포 경로가 하위 폴더로 바뀌어도 어긋나지 않는다.
 */
export function bakeCinematicIcon(scene: Phaser.Scene, textureKey: string, size: number): string | undefined {
  const cacheKey = `icon:${textureKey}:${size}`;
  const cached = baked.get(cacheKey);
  if (cached) return cached;
  if (!scene.textures.exists(textureKey)) return undefined;
  try {
    const source = scene.textures.get(textureKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const target = canvasOf(size, size);
    if (!target) return undefined;
    // 액자 안에서 그림은 사방 여백(78%)을 남기고 가운데에 선다 — 재화 아이콘의 규격이다.
    const inner = size * CINEMATIC_ICON_RATIO;
    const scale = Math.min(inner / source.width, inner / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    target.ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
    const url = encode(target.canvas);
    baked.set(cacheKey, url);
    return url;
  } catch {
    return undefined;
  }
}
