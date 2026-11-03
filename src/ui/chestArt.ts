import type Phaser from "phaser";

/** 승인된 SD 원화 두 장은 타이틀의 공용 콘텐츠 적재 단계에서 읽는다. */
export const CHEST_ART_ASSETS = [
  ["content-chest-closed", "sprites/content/chest_closed.webp"],
  ["content-chest-open", "sprites/content/chest_open.webp"],
] as const;

/** 기존 팝업·연출의 좌표계는 유지하고 원화만 같은 발밑 기준으로 맞춘다. */
export const CHEST_ART = { width: 520, height: 480 } as const;
const ART_FRAME = { x: 34, y: -5, width: 452, height: 452 } as const;
const STAGE_GLOW_COLORS = [0xe9b48c, 0xf5a982, 0x8fd5bd, 0x94c4ef, 0xf3c552, 0xb8a2ec, 0xf29abd, 0xfbe9f3] as const;

export function chestPaletteIndex(stage: number): number {
  return Math.max(0, Math.min(STAGE_GLOW_COLORS.length - 1, Math.round(stage)));
}

/** 원화는 단계 간 공유한다. 단계 구분은 숫자와 주변 반짝임 색이 맡는다. */
export function chestTextureKey(_stage: number, open: boolean): string {
  return `chest-illustrated-${open ? "open" : "closed"}`;
}

export function chestGlowColor(stage: number): number {
  return STAGE_GLOW_COLORS[chestPaletteIndex(stage)];
}

/** 같은 투명 캔버스에 원화를 배치해 닫힘·열림 전환 때 크기와 발밑이 흔들리지 않게 한다. */
export function ensureChestTexture(scene: Phaser.Scene, stage: number, open: boolean): string {
  const key = chestTextureKey(stage, open);
  if (scene.textures.exists(key)) return key;
  const sourceKey = CHEST_ART_ASSETS[open ? 1 : 0][0];
  const canvas = scene.textures.createCanvas(key, CHEST_ART.width, CHEST_ART.height);
  if (!canvas) return key;
  if (scene.textures.exists(sourceKey)) {
    const image = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, ART_FRAME.x, ART_FRAME.y, ART_FRAME.width, ART_FRAME.height);
  }
  canvas.refresh();
  return key;
}
