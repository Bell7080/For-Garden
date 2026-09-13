import Phaser from "phaser";
import { chipPoints } from "./holo";

/**
 * 칩(깎인 네모) 액자를 **꽉 채우는 그림을 한 번만 구워** 둔다.
 *
 * 액자는 왼쪽 위·오른쪽 아래가 비스듬히 깎인 도형이다. 그림을 액자 한 변까지 채우면 그 두
 * 모서리에서 그림이 밖으로 나가는데, 그것을 푸는 방법은 `faceTexture.ts` 머리에 적어 둔 그대로
 * **굽는 것**뿐이다 — 판 색으로 덮으면 외곽선 너머로 삐져나온 뿔이 되고, 기하 마스크는 컨테이너
 * 이동·배율을 물려받지 않아 눌러서 커지는 액자에서 어긋난다.
 *
 * 얼굴 액자(`bakeFaceTexture`)와 하는 일은 같고 **담는 방식이 다르다** — 그쪽은 원화에서 정사각
 * 창을 잘라 오고, 이쪽은 **정사각 그림을 비정사각 칸에 `cover`로 채운다.** 스킬 액자의 안쪽 칸은
 * 이름이 들어갈 만큼 아래가 낮아 정사각이 아니다.
 *
 * **화면 크기가 아니라 고정 해상도로 굽는다.** 같은 그림이 정보창(150)·돌파 표(작은 칸)·적
 * 정보창에서 저마다 다른 크기로 서는데, 크기마다 구우면 같은 그림의 캔버스가 개수만큼 쌓인다.
 * 비율만 맞춰 한 번 굽고 표시 크기는 `setDisplaySize`가 정한다.
 */
const BAKE_WIDTH = 256;

export function bakeChipArt(
  scene: Phaser.Scene,
  sourceKey: string,
  /** 담을 칸의 가로세로. 비율만 쓰고 실제 굽는 크기는 `BAKE_WIDTH`가 정한다. */
  width: number,
  height: number,
  /** 깎임 깊이 — 칸 **가로**에 대한 비율이다(액자를 그리는 `chipPoints`와 같은 기준). */
  bevelRatio: number,
): string {
  if (!scene.textures.exists(sourceKey)) return sourceKey;
  const ratio = height / width;
  const w = BAKE_WIDTH;
  const h = Math.max(1, Math.round(BAKE_WIDTH * ratio));
  const key = `chip-art:${sourceKey}:${h}:${Math.round(bevelRatio * 1000)}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage();
  // 캔버스 텍스처는 전역 TextureManager가 갖는다 — 씬이 바뀌어도 살아남아 다시 굽지 않는다.
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return sourceKey;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, w, h);
  // **`cover`로 채운다.** 칸 비율에 맞춰 늘이면 그림이 찌그러지므로, 짧은 쪽을 기준으로 키우고
  // 넘치는 쪽만 잘라 낸다(배경 원화를 판에 앉힐 때와 같은 규칙이다).
  const sw = (source as HTMLImageElement).width || w;
  const sh = (source as HTMLImageElement).height || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source as CanvasImageSource, (w - dw) / 2, (h - dh) / 2, dw, dh);
  // 칸 밖으로 나간 두 모서리를 **덮지 않고 지운다.** 남는 것이 투명이라 뒤 판이 그대로 보인다.
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  const shape = chipArtShape(w, h, bevelRatio);
  for (let index = 0; index < shape.length; index += 2) {
    const x = shape[index] + w / 2;
    const y = shape[index + 1] + h / 2;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}

/** 굽는 쪽과 액자를 그리는 쪽이 **같은 도형**을 읽게 한 경계다. */
export function chipArtShape(width: number, height: number, bevelRatio: number): number[] {
  return chipPoints(width, height, {
    bevel: { topLeft: width * bevelRatio, topRight: 0, bottomRight: width * bevelRatio, bottomLeft: 0 },
  });
}
