import Phaser from "phaser";
import { chipPoints } from "./holo";
import { ITEM_FRAME } from "./itemFrame";

/**
 * 얼굴 액자에 담을 그림을 **액자 실루엣대로 한 번만 구워** 둔다.
 *
 * 액자는 왼쪽 위·오른쪽 아래가 비스듬히 깎인 도형이라, 얼굴을 액자 한 변까지 채우면 그 두
 * 모서리에서 그림이 밖으로 나간다. 지금까지 그것을 푸는 방법이 셋 있었고 둘은 막혔다:
 *
 * - **삐져나온 삼각형을 판 색으로 덮기** — 그 삼각형은 액자 **바깥**이라 외곽선 너머로 검게
 *   삐져나온 뿔이 된다(원정 순위 줄·기여도 줄이 그랬다).
 * - **기하 마스크로 자르기** — 컨테이너 이동을 물려받지 않아 스크롤하는 목록에서 어긋난다.
 * - **그림을 안쪽 정사각(78%)에 들이기** — 뿔은 없어지지만 액자 안에 빈 테가 한 겹 남아
 *   얼굴이 작아진다. 재화 아이콘은 그 여백이 규격이지만 **얼굴은 꽉 차야 누구인지 읽힌다.**
 *
 * 그래서 네 번째 방법을 쓴다 — **굽는다.** 그림을 액자 크기 캔버스에 그린 뒤 `destination-in`
 * 으로 칩 도형만 남기면, 깎인 두 모서리가 그림 자체에서 잘려 나간다. 덮는 것도 마스크도 아니라
 * 스크롤·컨테이너 이동과 무관하고, 대각선은 캔버스가 부드럽게 다듬어 준다.
 *
 * **한 번만 굽는다**(`텍스처 키 = 원화 + 액자 크기`). 원정 순위 줄은 100줄이 서므로 줄마다
 * 구우면 그만큼이 그대로 첫 프레임 비용이 되는데, 같은 개체·같은 크기는 그림도 같다.
 */
export function bakeFaceTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  size: number,
  crop: { x: number; y: number; side: number },
): string {
  const key = `face:${sourceKey}:${Math.round(size)}:${Math.round(crop.x)}:${Math.round(crop.y)}:${Math.round(crop.side)}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage();
  // 캔버스 텍스처는 전역 TextureManager가 갖는다 — 씬이 바뀌어도 살아남아 다시 굽지 않는다.
  const canvas = scene.textures.createCanvas(key, Math.round(size), Math.round(size));
  if (!canvas) return sourceKey;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source as CanvasImageSource, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size);
  // 액자 밖으로 나간 두 모서리를 **덮지 않고 지운다.** 남는 것이 투명이라 뒤 화면이 그대로 보인다.
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  const shape = faceClipShape(size);
  for (let index = 0; index < shape.length; index += 2) {
    const x = shape[index] + size / 2;
    const y = shape[index + 1] + size / 2;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}

/** 얼굴 액자의 칩 도형. 굽는 쪽과 위에 얹히는 결(유리 띠)이 같은 도형을 읽는다. */
export function faceClipShape(size: number): number[] {
  return chipPoints(size, size, {
    bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 },
  });
}

/**
 * 네모를 액자 도형 안으로 잘라 낸다(Sutherland–Hodgman).
 *
 * 얼굴 위에 얹히는 유리 띠도 같은 문제를 겪는다 — 액자 한 변까지 칠하면 깎인 모서리로 빛이
 * 새어 액자 밖에 색 조각이 남는다. 마스크 대신 **칠할 도형 자체를 잘라** 둔다(룬 액자 뒷배경과
 * 같은 방법이다).
 */
export function clipRectToShape(
  rect: { left: number; top: number; width: number; height: number },
  shape: readonly number[],
): number[] {
  // 네 변을 차례로 지나며 바깥쪽을 잘라 낸다. 들어온 도형이 액자 자신이므로 결과는 언제나
  // 액자 **안**이고, 깎인 모서리든 어떤 비율이든 칠이 틀을 넘지 않는다.
  const edges: Array<(x: number, y: number) => number> = [
    (x) => x - rect.left,
    (_x, y) => y - rect.top,
    (x) => rect.left + rect.width - x,
    (_x, y) => rect.top + rect.height - y,
  ];
  let polygon = [...shape];
  for (const inside of edges) {
    const next: number[] = [];
    const count = polygon.length / 2;
    for (let i = 0; i < count; i += 1) {
      const ax = polygon[i * 2];
      const ay = polygon[i * 2 + 1];
      const bx = polygon[((i + 1) % count) * 2];
      const by = polygon[((i + 1) % count) * 2 + 1];
      const av = inside(ax, ay);
      const bv = inside(bx, by);
      if (av >= 0) next.push(ax, ay);
      if ((av >= 0) !== (bv >= 0)) {
        // 부호가 다르면 그 사이에서 반드시 변을 지난다 — 나누는 값이 0이 될 수 없다.
        const t = av / (av - bv);
        next.push(ax + (bx - ax) * t, ay + (by - ay) * t);
      }
    }
    polygon = next;
    if (polygon.length === 0) return polygon;
  }
  return polygon;
}

/**
 * 가로로 긴 판 하나를 **판 실루엣대로** 굽는다 — 원화는 판의 오른쪽을 채우고 왼쪽으로 스며든다.
 *
 * 레이드 층처럼 목록으로 흐르는 판은 기하 마스크를 쓸 수 없다(컨테이너 이동을 물려받지 않는다).
 * 얼굴 액자와 같은 이유로 **굽는다**: 원화를 `from`(판 폭 대비)부터 오른쪽 끝까지 그리고,
 * 판 도형(`shape`, 판 가운데가 0인 좌표)만 남긴 뒤 왼쪽 가장자리를 `fade` 폭만큼 투명으로 녹인다 —
 * 글이 서는 왼쪽은 판의 어둠이 받치고, 얼굴은 오른쪽에서 판을 꽉 채운다.
 */
export function bakeBandTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  size: { width: number; height: number },
  crop: { cropX: number; cropY: number; cropWidth: number; cropHeight: number },
  options: { shape: readonly number[]; from: number; fade: number },
): string {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  const key = `band:${sourceKey}:${width}x${height}:${Math.round(crop.cropX)}:${Math.round(crop.cropY)}:${Math.round(crop.cropWidth)}:${options.from}:${options.fade}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage();
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return sourceKey;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, width, height);
  const left = Math.round(width * options.from);
  ctx.drawImage(source as CanvasImageSource, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, left, 0, width - left, height);
  // 판 밖으로 나간 자리를 **덮지 않고 지운다**(얼굴 액자와 같은 규칙).
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  for (let index = 0; index < options.shape.length; index += 2) {
    const x = options.shape[index] + width / 2;
    const y = options.shape[index + 1] + height / 2;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // 왼쪽 가장자리를 녹인다 — 원화가 판 한가운데에서 세로로 뚝 끊기면 붙인 사진처럼 보인다.
  const gradient = ctx.createLinearGradient(left, 0, left + width * options.fade, 0);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}
