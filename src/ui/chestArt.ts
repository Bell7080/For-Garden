import Phaser from "phaser";

/**
 * 보물상자의 상자 그림. 바탕(크림·복숭아·분홍)에 어울리는 **납작한 파스텔 그림**이다 — 그러데이션·나뭇결·
 * 리벳 같은 사실적인 결은 쓰지 않고, 둥근 면 몇 장과 같은 계열의 짙은 윤곽, 한 줄 반사만 둔다.
 * 단계는 색이 말한다(복숭아 → 살구 → 민트 → 하늘 → 레몬 → 라일락 → 분홍 → 진주).
 *
 * 캔버스에 한 번 굽고 다시 쓴다(`chestTextureKey`). 난수를 쓰지 않아 같은 단계는 언제나 같은 그림이다.
 */
export const CHEST_ART = { width: 520, height: 480 } as const;

interface ChestPalette { body: string; lid: string; accent: string; line: string }

const PALETTES: readonly ChestPalette[] = [
  { body: "#e9b48c", lid: "#f3caa6", accent: "#fff0c4", line: "#9a6448" },
  { body: "#f5a982", lid: "#fac4a6", accent: "#ffe5a3", line: "#a65e44" },
  { body: "#8fd5bd", lid: "#b6e8d6", accent: "#fff3c4", line: "#4f8f7b" },
  { body: "#94c4ef", lid: "#bad9f6", accent: "#fff3c4", line: "#5480ad" },
  { body: "#f3c552", lid: "#f9dc8a", accent: "#fff6da", line: "#a57a1c" },
  { body: "#b8a2ec", lid: "#d3c4f6", accent: "#ffe28a", line: "#7660ad" },
  { body: "#f29abd", lid: "#f8bdd5", accent: "#ffe28a", line: "#ad5a7c" },
  { body: "#fbe9f3", lid: "#ffffff", accent: "#ffcf5a", line: "#c08aa6" },
];

const CX = 260;
const BODY = { left: 112, right: 408, top: 246, bottom: 398, radius: 30 } as const;
const LID = { left: 100, right: 420, top: 150, bottom: 258, radius: 62 } as const;

export function chestPaletteIndex(stage: number): number {
  return Math.max(0, Math.min(PALETTES.length - 1, Math.round(stage)));
}

export function chestTextureKey(stage: number, open: boolean): string {
  return `chest-simple-${chestPaletteIndex(stage)}-${open ? "open" : "closed"}`;
}

/** 단계의 빛 색 — 둘레의 반짝임이 같은 색을 쓴다. */
export function chestGlowColor(stage: number): number {
  return Phaser.Display.Color.HexStringToColor(PALETTES[chestPaletteIndex(stage)].body).color;
}

/** 굽지 않았으면 굽고 키를 돌려준다. */
export function ensureChestTexture(scene: Phaser.Scene, stage: number, open: boolean): string {
  const key = chestTextureKey(stage, open);
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, CHEST_ART.width, CHEST_ART.height);
  if (!canvas) return key;
  paintChest(canvas.getContext(), PALETTES[chestPaletteIndex(stage)], open);
  canvas.refresh();
  return key;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function outline(ctx: CanvasRenderingContext2D, palette: ChestPalette, width = 7): void {
  ctx.strokeStyle = palette.line; ctx.lineWidth = width; ctx.stroke();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.3, y + size * 0.05, x - size * 0.75, y - size * 0.95, x, y - size * 0.35);
  ctx.bezierCurveTo(x + size * 0.75, y - size * 0.95, x + size * 1.3, y + size * 0.05, x, y + size * 0.9);
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size); ctx.quadraticCurveTo(x, y, x + size, y); ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y); ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

function paintBody(ctx: CanvasRenderingContext2D, palette: ChestPalette): void {
  const { left, right, top, bottom, radius } = BODY;
  roundRect(ctx, left, top, right - left, bottom - top, [8, 8, radius, radius]);
  ctx.fillStyle = palette.body; ctx.fill();
  // 아래 한 띠만 조금 짙게 — 납작한 그늘.
  ctx.save(); ctx.clip();
  ctx.fillStyle = "rgba(120,60,60,0.12)"; ctx.fillRect(left, bottom - 34, right - left, 34);
  ctx.restore();
  roundRect(ctx, left, top, right - left, bottom - top, [8, 8, radius, radius]);
  outline(ctx, palette);
}

function paintLock(ctx: CanvasRenderingContext2D, palette: ChestPalette, y: number): void {
  roundRect(ctx, CX - 40, y - 34, 80, 78, 22);
  ctx.fillStyle = palette.accent; ctx.fill(); outline(ctx, palette, 6);
  heart(ctx, CX, y + 4, 17);
  ctx.fillStyle = palette.line; ctx.fill();
}

function paintChest(ctx: CanvasRenderingContext2D, palette: ChestPalette, open: boolean): void {
  ctx.clearRect(0, 0, CHEST_ART.width, CHEST_ART.height);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // 바닥 그림자 — 납작한 타원 하나.
  ctx.fillStyle = "rgba(150,80,90,0.16)";
  ctx.beginPath(); ctx.ellipse(CX, BODY.bottom + 10, 186, 22, 0, 0, Math.PI * 2); ctx.fill();

  if (open) {
    // 뒤로 젖혀진 뚜껑.
    roundRect(ctx, LID.left + 14, 96, LID.right - LID.left - 28, 112, [54, 54, 10, 10]);
    ctx.fillStyle = palette.lid; ctx.fill(); outline(ctx, palette);
    roundRect(ctx, LID.left + 40, 122, LID.right - LID.left - 80, 70, [36, 36, 6, 6]);
    ctx.fillStyle = "rgba(120,60,60,0.12)"; ctx.fill();
    // 은은한 빛 — 단색 원 두 겹.
    ctx.fillStyle = "rgba(255,247,214,0.55)"; ctx.beginPath(); ctx.ellipse(CX, 200, 190, 120, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.ellipse(CX, 214, 120, 66, 0, 0, Math.PI * 2); ctx.fill();
    // 안쪽과 금화 더미.
    roundRect(ctx, BODY.left + 6, BODY.top - 30, BODY.right - BODY.left - 12, 44, 22);
    ctx.fillStyle = "#ffd76a"; ctx.fill(); outline(ctx, palette, 6);
    const coins: readonly [number, number][] = [[-96, -34], [-50, -48], [0, -54], [48, -46], [94, -32], [-70, -18], [26, -24], [-20, -28], [72, -14]];
    for (const [dx, dy] of coins) {
      ctx.fillStyle = "#ffe48f"; ctx.beginPath(); ctx.ellipse(CX + dx, BODY.top + dy, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#d39a2b"; ctx.lineWidth = 3; ctx.stroke();
    }
    paintBody(ctx, palette);
    paintLock(ctx, palette, BODY.top + 52);
    for (const [x, y, size] of [[150, 110, 18], [372, 96, 22], [430, 196, 14], [96, 196, 12]] as const) sparkle(ctx, x, y, size, "#ffffff");
    return;
  }

  paintBody(ctx, palette);
  // 뚜껑 — 위가 둥근 면 하나.
  const { left, right, top, bottom, radius } = LID;
  roundRect(ctx, left, top, right - left, bottom - top, [radius, radius, 12, 12]);
  ctx.fillStyle = palette.lid; ctx.fill(); outline(ctx, palette);
  // 한 줄 반사.
  roundRect(ctx, left + 46, top + 18, 120, 14, 7);
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fill();
  // 뚜껑과 몸통을 잇는 띠.
  roundRect(ctx, left - 4, bottom - 22, right - left + 8, 30, 15);
  ctx.fillStyle = palette.accent; ctx.fill(); outline(ctx, palette, 6);
  paintLock(ctx, palette, bottom + 22);
}
