import Phaser from "phaser";
import { padlockGeometry } from "./lockStyle";

/**
 * 자물쇠 한 벌 — 흰 실루엣 두 장(몸통·고리)을 한 번만 굽고 `tint`로 색을 입힌다.
 *
 * 몸통과 고리를 갈라 굽는 이유는 개방 연출에서 **고리만** 튀어 올라 젖혀지기 때문이다. 한 장이면 자물쇠 전체를 흔들고
 * 터뜨리는 것밖에 할 수 없어 「열린다」가 아니라 「깨진다」로 읽혔다. 열쇠 구멍은 몸통에서 뚫어 내므로 아래 판이 비친다.
 * 같은 그림을 검게 한 겹 비껴 깔면(`shadow`) 판 없이도 밝은 원화 위에서 떠오른다.
 */
const TEXTURE = { body: "ui-padlock-body", shackle: "ui-padlock-shackle" } as const;
/** 굽는 자물쇠의 기준 한 변과 캔버스 — 고리 두께가 기준 정사각을 살짝 넘으므로 캔버스에 여유를 둔다. */
const BAKE_SIZE = 128;
const CANVAS = 160;

function bake(scene: Phaser.Scene, key: string, paint: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, CANVAS, CANVAS);
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.save();
  ctx.translate(CANVAS / 2, CANVAS / 2);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  paint(ctx);
  ctx.restore();
  canvas.refresh();
}

function ensurePadlockTextures(scene: Phaser.Scene): void {
  const geo = padlockGeometry(BAKE_SIZE);
  bake(scene, TEXTURE.shackle, (ctx) => {
    ctx.lineWidth = geo.shackleWidth;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(geo.shackle[0], geo.shackle[1]);
    for (let i = 2; i < geo.shackle.length; i += 2) ctx.lineTo(geo.shackle[i], geo.shackle[i + 1]);
    ctx.stroke();
  });
  bake(scene, TEXTURE.body, (ctx) => {
    const { x, y, width, height, bevel } = geo.body;
    ctx.beginPath();
    ctx.moveTo(x + bevel, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height - bevel);
    ctx.lineTo(x + width - bevel, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + bevel);
    ctx.closePath();
    ctx.fill();
    // 열쇠 구멍은 칠하지 않고 뚫는다 — 덮은 색이 아니라 빈자리라 어느 판 위에서도 같은 그림이다.
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(geo.keyhole[0], geo.keyhole[1]);
    for (let i = 2; i < geo.keyhole.length; i += 2) ctx.lineTo(geo.keyhole[i], geo.keyhole[i + 1]);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(geo.keyslot.x, geo.keyslot.y, geo.keyslot.width, geo.keyslot.height);
  });
}

export interface PadlockOptions {
  color?: number;
  alpha?: number;
  /** 같은 그림을 검게 한 겹 비껴 깐다(판 없이 원화 위에 설 때). */
  shadow?: boolean;
}

/** 개방 연출이 움직이는 조각들. */
export interface PadlockParts {
  size: number;
  /** 고리 묶음 — 축(왼쪽 다리 밑동)에 서 있어 돌리면 그 자리를 중심으로 젖혀진다. 그림자의 고리도 함께 든다. */
  shackles: Phaser.GameObjects.Container[];
  /** 하얗게 번쩍일 때 알파만 오가는 흰 사본. */
  whites: Phaser.GameObjects.Image[];
}

/** 몸통 + 고리 한 겹. `fill`이면 tint가 아니라 그 색으로 꽉 채운다(그림자·섬광). */
function addLayer(scene: Phaser.Scene, box: Phaser.GameObjects.Container, size: number, color: number, fill: boolean): { shackle: Phaser.GameObjects.Container; images: Phaser.GameObjects.Image[] } {
  const geo = padlockGeometry(size);
  const scale = size / BAKE_SIZE;
  const shackle = scene.add.container(geo.pivot.x, geo.pivot.y);
  const shackleImage = scene.add.image(-geo.pivot.x, -geo.pivot.y, TEXTURE.shackle).setScale(scale);
  const bodyImage = scene.add.image(0, 0, TEXTURE.body).setScale(scale);
  for (const image of [shackleImage, bodyImage]) {
    if (fill) image.setTintFill(color); else image.setTint(color);
  }
  shackle.add(shackleImage);
  box.add(shackle);
  box.add(bodyImage);
  return { shackle, images: [shackleImage, bodyImage] };
}

/** 자물쇠 하나를 세운다. 가운데 기준 컨테이너이고 `size`는 한 변이다. */
export function addPadlock(scene: Phaser.Scene, x: number, y: number, size: number, options: PadlockOptions = {}): Phaser.GameObjects.Container {
  ensurePadlockTextures(scene);
  const box = scene.add.container(x, y).setAlpha(options.alpha ?? 1);
  const shackles: Phaser.GameObjects.Container[] = [];
  if (options.shadow) {
    const shade = scene.add.container(size * 0.05, size * 0.07).setAlpha(0.6);
    shackles.push(addLayer(scene, shade, size, 0x05070a, true).shackle);
    box.add(shade);
  }
  shackles.push(addLayer(scene, box, size, options.color ?? 0xffffff, false).shackle);
  const white = scene.add.container(0, 0);
  const flash = addLayer(scene, white, size, 0xffffff, true);
  shackles.push(flash.shackle);
  for (const image of flash.images) image.setAlpha(0);
  box.add(white);
  const parts: PadlockParts = { size, shackles, whites: flash.images };
  box.setData("padlock", parts);
  return box;
}

export function padlockParts(box: Phaser.GameObjects.Container): PadlockParts | undefined {
  return box.getData("padlock") as PadlockParts | undefined;
}
