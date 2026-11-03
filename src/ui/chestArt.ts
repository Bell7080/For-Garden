import type Phaser from "phaser";
import { CHEST_GRADE_LOOKS, recolorChestPixels } from "../core/chestRecolor";

/** 승인된 SD 원화 두 장은 타이틀의 공용 콘텐츠 적재 단계에서 읽는다. */
export const CHEST_ART_ASSETS = [
  ["content-chest-closed", "sprites/content/chest_closed.webp"],
  ["content-chest-open", "sprites/content/chest_open.webp"],
] as const;

/** 닫힘·열림이 같은 투명 캔버스·같은 발밑에 서서 바꿔 끼울 때 크기와 자리가 흔들리지 않는다. */
export const CHEST_ART = { width: 520, height: 480 } as const;
const ART_FRAME = { x: 34, y: -5, width: 452, height: 452 } as const;
/** 열린 원화에서 보물이 담긴 칸(캔버스 좌표) — 딸기의 붉은빛을 몸통으로 칠하지 않는다. */
const OPEN_TREASURE = { x: 110, y: 150, width: 285, height: 135 } as const;
/**
 * 원화 안에서 상자가 실제로 차지한 자리(캔버스 좌표, 알파 실측). 닫힌 원화는 뚜껑이 낮아 캔버스 아래쪽에 앉는다 —
 * 카드가 날아 들어갈 입구와 보물이 튀어나올 자리를 이 값에서 잡는다.
 */
export const CHEST_ART_CONTENT = {
  closed: { top: 159, bottom: 402, left: 88, right: 428 },
  open: { top: 45, bottom: 402, left: 87, right: 425 },
} as const;

export function chestGlowColor(grade: number): number {
  return CHEST_GRADE_LOOKS[Math.max(0, Math.min(CHEST_GRADE_LOOKS.length - 1, grade))].glow;
}

export function chestTextureKey(grade: number, open: boolean): string {
  return `chest-illustrated-${open ? "open" : "closed"}-${grade}`;
}

/** 등급의 색으로 다시 칠한 상자 그림을 한 번만 굽는다. 원화가 아직 없으면 빈 캔버스로 두고 다음에 다시 굽는다. */
/** 원화로 실제로 구운 키 — 원화가 늦게 오면 빈 캔버스를 한 번 더 굽는다. */
const BAKED = new Set<string>();

export function ensureChestTexture(scene: Phaser.Scene, grade: number, open: boolean): string {
  const safeGrade = Math.max(0, Math.min(CHEST_GRADE_LOOKS.length - 1, Math.round(grade)));
  const key = chestTextureKey(safeGrade, open);
  const sourceKey = CHEST_ART_ASSETS[open ? 1 : 0][0];
  if (scene.textures.exists(key)) {
    if (BAKED.has(key) || !scene.textures.exists(sourceKey)) return key;
    scene.textures.remove(key);
    BAKED.delete(key);
  }
  const canvas = scene.textures.createCanvas(key, CHEST_ART.width, CHEST_ART.height);
  if (!canvas) return key;
  if (scene.textures.exists(sourceKey)) {
    const image = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, ART_FRAME.x, ART_FRAME.y, ART_FRAME.width, ART_FRAME.height);
    const look = CHEST_GRADE_LOOKS[safeGrade];
    if (look.body || look.band) {
      const pixels = ctx.getImageData(0, 0, CHEST_ART.width, CHEST_ART.height);
      recolorChestPixels(pixels.data, CHEST_ART.width, look, open ? { protect: OPEN_TREASURE } : {});
      ctx.putImageData(pixels, 0, 0);
    }
    BAKED.add(key);
  }
  canvas.refresh();
  return key;
}
