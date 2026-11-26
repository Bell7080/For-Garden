import type Phaser from "phaser";
import { portraitCardZoom } from "./portraitPlacement";
import type { PortraitAssetId } from "../core/types";
import { computeFaceFrame, computeHeadCardFrame } from "../puppets/anchors";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
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
/**
 * 굽는 중인 그림. **결과가 아니라 약속을 기억한다** — 미리 굽기(`prewarmCinematicArt`)와 카드 채우기가 같은 순간에
 * 같은 개체를 부르면, 결과만 기억하던 때는 둘 다 캐시가 빈 것을 보고 묶음을 두 번 읽고 GPU에 두 번 올리고 두 번
 * 인코딩했다(뽑기 직후 렉의 큰 몫).
 */
const pending = new Map<string, Promise<string | undefined>>();

/**
 * 동시에 굽는 개체 수. 묶음 하나를 GPU에 올리고 2D로 옮기는 일은 메인 스레드 몫이라, 열 장을 한꺼번에 던지면
 * 3D 연출이 도는 그 순간에 몰려 프레임이 끊긴다. 둘씩 카드 순서대로 굽는다 — 먼저 열릴 카드가 먼저 선다.
 */
export const CINEMATIC_BAKE_CONCURRENCY = 2;
let running = 0;
const waiting: Array<() => void> = [];

function queued<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = (): void => {
      running += 1;
      job().then(resolve, reject).finally(() => {
        running -= 1;
        waiting.shift()?.();
      });
    };
    if (running < CINEMATIC_BAKE_CONCURRENCY) run();
    else waiting.push(run);
  });
}

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

/** WebP가 없는 기기도 있으므로 실패하면 PNG로 되돌아간다. 작은 아이콘만 쓰는 동기 인코딩이다. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL("image/webp", 0.92);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/**
 * 큰 그림은 **메인 스레드 밖에서** 인코딩한다. `toDataURL`은 그 자리에서 압축을 끝낼 때까지 멈춰 서고(440×667 한 장이
 * 모바일에서 수십 ms) 그것이 카드 열 장 × 연출 한가운데에 겹쳤다. `toBlob`은 브라우저가 따로 압축하고 기다리지 않는다.
 * 주소는 앱이 사는 동안 캐시가 들고 있으므로 풀지 않는다(개체 수만큼, 한 장 수십 KB).
 */
function encodeAsync(canvas: HTMLCanvasElement): Promise<string> {
  if (typeof canvas.toBlob !== "function" || typeof URL.createObjectURL !== "function") return Promise.resolve(encode(canvas));
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : encode(canvas)), "image/webp", 0.92);
  });
}

function cardKey(id: PortraitAssetId, width: number, height: number): string { return `card:${id}:${width}x${height}`; }
function faceKey(id: PortraitAssetId, size: number): string { return `face:${id}:${size}`; }

function remembered(key: string): Promise<string | undefined> | undefined {
  const done = baked.get(key);
  if (done) return Promise.resolve(done);
  return pending.get(key);
}

/**
 * 한 개체의 카드 원화와(필요하면) 파편 얼굴을 **원화를 한 번만 붙잡고** 함께 굽는다. 따로 구우면 얼굴을 굽는 차례에
 * 묶음을 다시 읽고 GPU에 다시 올렸다.
 */
function bakeRelic(
  scene: Phaser.Scene,
  id: PortraitAssetId,
  card: { width: number; height: number } | undefined,
  faceSize: number | undefined,
): void {
  const wantCard = card && !remembered(cardKey(id, card.width, card.height)) ? card : undefined;
  const wantFace = faceSize !== undefined && !remembered(faceKey(id, faceSize)) ? faceSize : undefined;
  if (!wantCard && wantFace === undefined) return;
  const job = queued(async () => {
    const asset = portraitAssetFor(id);
    // 구워 낸 그림이 제 텍스처를 갖고 원본은 더 쓰지 않으므로, 옮겨 그리는 동안만 붙잡는다.
    const canvases = await withPuppetTexture(scene, asset, ({ key, anchors }) => {
      const source = scene.textures.get(key).getSourceImage() as CanvasImageSource;
      let cardCanvas: HTMLCanvasElement | undefined;
      let faceCanvas: HTMLCanvasElement | undefined;
      if (wantCard) {
        const frame = computeHeadCardFrame(asset, anchors.head, {
          width: wantCard.width,
          height: wantCard.height,
          fillRatio: 0.56 / portraitCardZoom(asset),
          headroom: 0,
          cardTop: asset.cardTop,
        });
        const target = canvasOf(wantCard.width, wantCard.height);
        if (target) {
          target.ctx.drawImage(
            source,
            frame.cropX, frame.cropY, frame.cropWidth, frame.cropHeight,
            0, 0, frame.cropWidth * frame.scale, frame.cropHeight * frame.scale,
          );
          cardCanvas = target.canvas;
        }
      }
      if (wantFace !== undefined) {
        const size = wantFace;
        const face = computeFaceFrame(asset, anchors.head, {
          size,
          crop: FACE_CROP / portraitCardZoom(asset),
          anchorY: FACE_ANCHOR_Y,
        });
        const target = canvasOf(size, size);
        if (target) {
          target.ctx.drawImage(source, face.cropX, face.cropY, face.cropWidth, face.cropWidth, 0, 0, size, size);
          // 깎인 두 모서리를 그림 자체에서 지운다 — DOM에서 덮으면 외곽선 너머로 검은 뿔이 남는다(`faceTexture.ts`와 같은 도형).
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
          faceCanvas = target.canvas;
        }
      }
      return { cardCanvas, faceCanvas };
    });
    // 텍스처를 놓은 뒤 인코딩한다 — 원본을 붙잡은 채 압축을 기다리지 않는다.
    const [cardUrl, faceUrl] = await Promise.all([
      canvases.cardCanvas ? encodeAsync(canvases.cardCanvas) : undefined,
      canvases.faceCanvas ? encodeAsync(canvases.faceCanvas) : undefined,
    ]);
    return { cardUrl, faceUrl };
  }).catch(() => ({ cardUrl: undefined, faceUrl: undefined }));
  // 묶음 하나를 못 읽어도 연출은 멈추지 않는다. 그 칸만 그림 없이 선다.
  const settle = (key: string, pick: (value: { cardUrl?: string; faceUrl?: string }) => string | undefined): void => {
    const promise = job.then((value) => {
      const url = pick(value);
      pending.delete(key);
      if (url) baked.set(key, url);
      return url;
    });
    pending.set(key, promise);
  };
  if (wantCard) settle(cardKey(id, wantCard.width, wantCard.height), (value) => value.cardUrl);
  if (wantFace !== undefined) settle(faceKey(id, wantFace), (value) => value.faceUrl);
}

/**
 * 카드에 세울 전신 잘라내기.
 *
 * 그리드 카드와 같은 `fillRatio`·`headroom`·`cardTop`을 쓴다 — 정수리를 한 줄도 자르지 않고,
 * 얼굴 크기는 카드와 같은 공용 얼굴 규격(`portraitCardZoom`)으로 맞춰 한 판에서 크기가 튀지 않게 한다.
 */
export function bakeCinematicPortrait(
  scene: Phaser.Scene,
  portraitAssetId: PortraitAssetId,
  width: number,
  height: number,
): Promise<string | undefined> {
  const key = cardKey(portraitAssetId, width, height);
  bakeRelic(scene, portraitAssetId, { width, height }, undefined);
  return remembered(key) ?? Promise.resolve(undefined);
}

/**
 * 파편 액자에 들어갈 얼굴.
 *
 * 액자와 같은 크기로 굽고 깎인 두 모서리를 **그림 자체에서** 지운다 — DOM에서 덮으면 외곽선
 * 너머로 검은 뿔이 남고, `clip-path`는 그림과 액자가 따로 깎여 한 픽셀씩 어긋난다
 * (`faceTexture.ts`와 같은 이유·같은 도형이다).
 */
export function bakeCinematicFace(
  scene: Phaser.Scene,
  portraitAssetId: PortraitAssetId,
  size: number,
): Promise<string | undefined> {
  const key = faceKey(portraitAssetId, size);
  bakeRelic(scene, portraitAssetId, undefined, size);
  return remembered(key) ?? Promise.resolve(undefined);
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

/**
 * 카드 그림을 미리 굽는다.
 *
 * 시네마틱 묶음(560KB 남짓)을 내려받는 동안 놀릴 이유가 없다 — 그때 원화를 먼저 구워 두면
 * 판이 뜨자마자 카드가 제 그림을 갖는다. 결과는 키로 캐시되므로 화면이 다시 부를 때 그대로
 * 쓰인다. 기다리지 않고 던져 두며, 실패는 각 함수가 제 안에서 삼킨다.
 */
export function prewarmCinematicArt(
  scene: Phaser.Scene,
  slots: ReadonlyArray<{ frame: string; portraitAssetId?: PortraitAssetId; iconKey?: string }>,
  portrait: { width: number; height: number },
  faceSize: number,
): void {
  for (const slot of slots) {
    if (slot.portraitAssetId) {
      // 카드와 파편 얼굴을 한 번에 굽는다 — 같은 원화를 두 번 읽지 않는다.
      bakeRelic(scene, slot.portraitAssetId, portrait, slot.frame === "face" ? faceSize : undefined);
    } else if (slot.iconKey) {
      bakeCinematicIcon(scene, slot.iconKey, faceSize);
    }
  }
}
