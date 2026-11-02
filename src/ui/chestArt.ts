import Phaser from "phaser";

/**
 * 보물상자의 상자 그림. 단계마다 재질이 바뀐다 — 나무·쇠 → 청동 → 은 → 칠기 → 금과 루비 →
 * 남빛과 사파이어 → 보랏빛과 에메랄드 → 진주와 장미금.
 *
 * 전용 원화가 없으므로 캔버스에 한 번 굽고 같은 그림을 다시 쓴다(`chestTextureKey`). 도형 몇 개를
 * 매 프레임 다시 그리는 대신 그러데이션·나뭇결·리벳·보석을 갖춘 한 장을 만든다. 윤곽은 전장의
 * 잉크선과 같은 짙은 선이다. 난수를 쓰지 않아 같은 단계는 언제나 같은 그림이다.
 */
export const CHEST_ART = { width: 520, height: 480 } as const;

interface ChestPalette {
  wood: readonly [string, string];
  metal: readonly [string, string, string];
  gems: readonly string[];
  glow: string;
  aura: number;
  filigree: boolean;
  crest: boolean;
}

const IRON = ["#d9dde3", "#858d98", "#3a3f47"] as const;
const BRONZE = ["#ffd7a6", "#b8743c", "#5a3214"] as const;
const SILVER = ["#ffffff", "#bccadb", "#566276"] as const;
const GOLD = ["#fff4b8", "#e3a92c", "#764a0a"] as const;
const ROSE_GOLD = ["#fff3ea", "#f0a59c", "#8f3f4c"] as const;

const PALETTES: readonly ChestPalette[] = [
  { wood: ["#b27b48", "#5c391d"], metal: IRON, gems: [], glow: "#ffd9a0", aura: 0.1, filigree: false, crest: false },
  { wood: ["#c28a52", "#663d1d"], metal: BRONZE, gems: [], glow: "#ffcf8a", aura: 0.14, filigree: false, crest: false },
  { wood: ["#93603a", "#45271a"], metal: SILVER, gems: [], glow: "#e6f1ff", aura: 0.18, filigree: false, crest: false },
  { wood: ["#cf4a3e", "#561313"], metal: SILVER, gems: ["#7fe3ff"], glow: "#ffd6cc", aura: 0.22, filigree: true, crest: false },
  { wood: ["#7d4b2c", "#331b10"], metal: GOLD, gems: ["#ff3d5e"], glow: "#ffe9a0", aura: 0.27, filigree: true, crest: false },
  { wood: ["#3f63b8", "#121b44"], metal: GOLD, gems: ["#56c8ff", "#56c8ff", "#56c8ff"], glow: "#c4e6ff", aura: 0.32, filigree: true, crest: false },
  { wood: ["#8f55d6", "#2a1052"], metal: GOLD, gems: ["#3de08a", "#ff4f8b", "#3de08a", "#ff4f8b", "#3de08a"], glow: "#f0d8ff", aura: 0.38, filigree: true, crest: true },
  { wood: ["#fff8f0", "#bfa7bf"], metal: ROSE_GOLD, gems: ["#ff5f8f", "#ffc94a", "#5fe3a8", "#5fb8ff", "#c38bff"], glow: "#fff0f8", aura: 0.48, filigree: true, crest: true },
];

const INK = "#1d0e1b";
// 상자의 뼈대(캔버스 좌표).
const CX = 260, L = 92, R = 428, BODY_TOP = 236, BODY_BOTTOM = 404, DOME = 112;
const BAND = [[L + 46, L + 80], [R - 80, R - 46]] as const;

export function chestPaletteIndex(stage: number): number {
  return Math.max(0, Math.min(PALETTES.length - 1, Math.round(stage)));
}

export function chestTextureKey(stage: number, open: boolean): string {
  return `chest-forge-${chestPaletteIndex(stage)}-${open ? "open" : "closed"}`;
}

/** 단계의 빛 색 — 둘레의 반짝임이 같은 색을 쓴다. */
export function chestGlowColor(stage: number): number {
  return Phaser.Display.Color.HexStringToColor(PALETTES[chestPaletteIndex(stage)].glow).color;
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

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(L, BODY_TOP); ctx.lineTo(R, BODY_TOP); ctx.lineTo(R - 6, BODY_BOTTOM); ctx.lineTo(L + 6, BODY_BOTTOM); ctx.closePath();
}

function lidPath(ctx: CanvasRenderingContext2D, lift = 0): void {
  ctx.beginPath();
  ctx.moveTo(L - 4, BODY_TOP - lift);
  ctx.lineTo(L - 4, 176 - lift);
  ctx.bezierCurveTo(L - 4, 126 - lift, L + 66, DOME - lift, CX, DOME - lift);
  ctx.bezierCurveTo(R - 66, DOME - lift, R + 4, 126 - lift, R + 4, 176 - lift);
  ctx.lineTo(R + 4, BODY_TOP - lift);
  ctx.closePath();
}

/** 둥근 원통처럼 양 끝이 어두워지는 겹. */
function cylinderShade(ctx: CanvasRenderingContext2D, top: number, bottom: number, strength: number): void {
  const shade = ctx.createLinearGradient(L, 0, R, 0);
  shade.addColorStop(0, `rgba(0,0,0,${strength})`);
  shade.addColorStop(0.22, "rgba(0,0,0,0)");
  shade.addColorStop(0.62, "rgba(255,255,255,0.06)");
  shade.addColorStop(1, `rgba(0,0,0,${strength * 1.2})`);
  ctx.fillStyle = shade;
  ctx.fillRect(L - 10, top, R - L + 20, bottom - top);
}

function woodFill(ctx: CanvasRenderingContext2D, palette: ChestPalette, top: number, bottom: number): void {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, palette.wood[0]);
  gradient.addColorStop(1, palette.wood[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(L - 10, top, R - L + 20, bottom - top);
  // 나뭇결 — 물결치는 가는 선.
  ctx.lineWidth = 2;
  for (let line = 0; line * 9 < bottom - top; line += 1) {
    const y = top + 6 + line * 9;
    ctx.strokeStyle = `rgba(0,0,0,${0.07 + (line % 3) * 0.035})`;
    ctx.beginPath();
    for (let x = L - 10; x <= R + 10; x += 12) {
      const wave = Math.sin(x * 0.031 + line * 1.7) * 2.4 + Math.sin(x * 0.083 + line) * 1.1;
      if (x === L - 10) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

function metalGradient(ctx: CanvasRenderingContext2D, palette: ChestPalette, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, palette.metal[0]);
  gradient.addColorStop(0.35, palette.metal[1]);
  gradient.addColorStop(0.7, palette.metal[2]);
  gradient.addColorStop(1, palette.metal[1]);
  return gradient;
}

function rivet(ctx: CanvasRenderingContext2D, palette: ChestPalette, x: number, y: number, r = 5): void {
  const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0.5, x, y, r);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, palette.metal[0]);
  gradient.addColorStop(1, palette.metal[2]);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
}

function strip(ctx: CanvasRenderingContext2D, palette: ChestPalette, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = metalGradient(ctx, palette, 0, y, 0, y + h);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(x + 3, y + 3, w - 6, 2.5);
}

function gem(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number): void {
  // 은은한 빛 → 면이 깎인 마름모 → 위쪽 반사.
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  halo.addColorStop(0, rgba(color, 0.55)); halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  const points: [number, number][] = [[x, y - r * 1.15], [x + r, y - r * 0.3], [x + r * 0.62, y + r], [x - r * 0.62, y + r], [x - r, y - r * 0.3]];
  const body = ctx.createLinearGradient(x, y - r, x, y + r);
  body.addColorStop(0, "#ffffff"); body.addColorStop(0.25, color); body.addColorStop(1, rgba("#000000", 0.6));
  ctx.beginPath(); points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = body; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  // 면 — 가운데 작은 오각형과 꼭짓점을 잇는 선.
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  points.forEach(([px, py]) => { ctx.moveTo(x + (px - x) * 0.45, y + (py - y) * 0.45); ctx.lineTo(px, py); });
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.45, r * 0.28, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
}

function filigree(ctx: CanvasRenderingContext2D, palette: ChestPalette): void {
  // 몸통을 가로지르는 장식 띠 — 가는 쇠 띠 위에 마름모 징이 박힌다.
  const y = BODY_TOP + 112;
  ctx.fillStyle = metalGradient(ctx, palette, 0, y - 7, 0, y + 7);
  ctx.fillRect(L, y - 7, R - L, 14);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(L, y - 7, R - L, 14);
  for (let x = L + 24; x < R - 10; x += 34) {
    if (BAND.some(([x0, x1]) => x > x0 - 10 && x < x1 + 10)) continue;
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.closePath();
    ctx.fillStyle = palette.metal[0]; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  }
}

function lockPlate(ctx: CanvasRenderingContext2D, palette: ChestPalette, y: number): void {
  ctx.beginPath();
  ctx.moveTo(CX - 42, y - 40); ctx.lineTo(CX + 42, y - 40); ctx.lineTo(CX + 42, y + 26);
  ctx.quadraticCurveTo(CX + 40, y + 50, CX, y + 66); ctx.quadraticCurveTo(CX - 40, y + 50, CX - 42, y + 26); ctx.closePath();
  ctx.fillStyle = metalGradient(ctx, palette, CX - 42, y - 40, CX + 42, y + 66); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CX - 34, y + 20); ctx.lineTo(CX - 34, y - 32); ctx.lineTo(CX + 34, y - 32); ctx.stroke();
  if (palette.gems.length) gem(ctx, palette.gems[0], CX, y - 14, 12);
  // 열쇠 구멍.
  const keyY = palette.gems.length ? y + 20 : y + 6;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(CX, keyY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(CX - 5, keyY + 2); ctx.lineTo(CX + 5, keyY + 2); ctx.lineTo(CX + 8, keyY + 26); ctx.lineTo(CX - 8, keyY + 26); ctx.closePath(); ctx.fill();
}

function crest(ctx: CanvasRenderingContext2D, palette: ChestPalette, y: number): void {
  // 뚜껑 꼭대기의 날개 장식 — 마지막 두 단계만.
  ctx.fillStyle = metalGradient(ctx, palette, CX - 70, y - 30, CX + 70, y + 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX, y + 4);
    ctx.bezierCurveTo(CX + side * 30, y - 6, CX + side * 56, y - 30, CX + side * 76, y - 22);
    ctx.bezierCurveTo(CX + side * 60, y - 12, CX + side * 54, y + 2, CX + side * 30, y + 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  gem(ctx, palette.gems[palette.gems.length - 1], CX, y - 4, 14);
}

function bands(ctx: CanvasRenderingContext2D, palette: ChestPalette, top: number, bottom: number): void {
  for (const [x0, x1] of BAND) {
    ctx.fillStyle = metalGradient(ctx, palette, x0, 0, x1, 0);
    ctx.fillRect(x0, top, x1 - x0, bottom - top);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.moveTo(x1, top); ctx.lineTo(x1, bottom); ctx.stroke();
  }
}

function paintChest(ctx: CanvasRenderingContext2D, palette: ChestPalette, open: boolean): void {
  ctx.clearRect(0, 0, CHEST_ART.width, CHEST_ART.height);
  ctx.lineJoin = "round";
  // 둘레의 빛 — 단계가 오를수록 짙다.
  const aura = ctx.createRadialGradient(CX, 250, 30, CX, 250, 250);
  aura.addColorStop(0, rgba(palette.glow, palette.aura + (open ? 0.3 : 0)));
  aura.addColorStop(1, rgba(palette.glow, 0));
  ctx.fillStyle = aura; ctx.fillRect(0, 0, CHEST_ART.width, CHEST_ART.height);
  // 바닥 그림자.
  const shadow = ctx.createRadialGradient(CX, BODY_BOTTOM + 14, 10, CX, BODY_BOTTOM + 14, 210);
  shadow.addColorStop(0, "rgba(0,0,0,0.6)"); shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.scale(1, 0.18); ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(CX, (BODY_BOTTOM + 14) / 0.18, 210, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  if (open) paintOpenLid(ctx, palette);
  else paintLid(ctx, palette);

  // 몸통.
  ctx.save(); bodyPath(ctx); ctx.clip();
  woodFill(ctx, palette, BODY_TOP, BODY_BOTTOM);
  // 판자 이음매.
  for (const y of palette.filigree ? [BODY_TOP + 56] : [BODY_TOP + 56, BODY_TOP + 112]) {
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(L, y, R - L, 3);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(L, y + 3, R - L, 2);
  }
  cylinderShade(ctx, BODY_TOP, BODY_BOTTOM, 0.32);
  bands(ctx, palette, BODY_TOP, BODY_BOTTOM);
  if (palette.filigree) filigree(ctx, palette);
  ctx.restore();
  bodyPath(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();

  // 테두리 띠·모서리 쇠.
  strip(ctx, palette, L - 10, BODY_BOTTOM - 22, R - L + 20, 24);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? L - 10 : R + 10;
    ctx.beginPath();
    ctx.moveTo(edge, BODY_BOTTOM + 2); ctx.lineTo(edge, BODY_BOTTOM - 74); ctx.lineTo(edge - side * 58, BODY_BOTTOM + 2); ctx.closePath();
    ctx.fillStyle = metalGradient(ctx, palette, edge, BODY_BOTTOM - 74, edge - side * 58, BODY_BOTTOM); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    rivet(ctx, palette, edge - side * 14, BODY_BOTTOM - 18);
    ctx.beginPath();
    ctx.moveTo(edge, BODY_TOP + 8); ctx.lineTo(edge - side * 50, BODY_TOP + 8); ctx.lineTo(edge, BODY_TOP + 60); ctx.closePath();
    ctx.fillStyle = metalGradient(ctx, palette, edge, BODY_TOP, edge - side * 50, BODY_TOP + 60); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    rivet(ctx, palette, edge - side * 14, BODY_TOP + 22);
  }
  for (const [x0, x1] of BAND) {
    for (let y = BODY_TOP + 34; y < BODY_BOTTOM - 30; y += 40) rivet(ctx, palette, (x0 + x1) / 2, y);
  }
  if (palette.gems.length >= 5) {
    BAND.forEach(([x0, x1], index) => gem(ctx, palette.gems[(index + 1) % palette.gems.length], (x0 + x1) / 2, BODY_BOTTOM - 54, 10));
  }
  if (!open) {
    strip(ctx, palette, L - 10, BODY_TOP - 12, R - L + 20, 22);
    lockPlate(ctx, palette, BODY_TOP + 18);
  } else {
    strip(ctx, palette, L - 10, BODY_TOP - 6, R - L + 20, 18);
    lockPlate(ctx, palette, BODY_TOP + 40);
  }
}

function paintLid(ctx: CanvasRenderingContext2D, palette: ChestPalette): void {
  ctx.save(); lidPath(ctx); ctx.clip();
  woodFill(ctx, palette, DOME - 4, BODY_TOP);
  cylinderShade(ctx, DOME - 4, BODY_TOP, 0.4);
  // 둥근 뚜껑의 윗면 반사.
  const shine = ctx.createLinearGradient(0, DOME, 0, DOME + 60);
  shine.addColorStop(0, "rgba(255,255,255,0.28)"); shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine; ctx.fillRect(L, DOME, R - L, 60);
  bands(ctx, palette, DOME - 4, BODY_TOP);
  ctx.restore();
  lidPath(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  // 뚜껑 가장자리의 가는 반사선.
  ctx.save(); ctx.translate(0, 10); ctx.scale(1, 1);
  ctx.beginPath(); ctx.moveTo(L + 16, 170); ctx.bezierCurveTo(L + 18, 132, L + 80, DOME + 6, CX, DOME + 4);
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  for (const [x0, x1] of BAND) {
    const x = (x0 + x1) / 2;
    for (const y of [150, 196]) rivet(ctx, palette, x, y);
  }
  palette.gems.slice(1, 3).forEach((color, index) => gem(ctx, color, (BAND[index][0] + BAND[index][1]) / 2, 172, 11));
  if (palette.crest) crest(ctx, palette, DOME - 2);
}

function paintOpenLid(ctx: CanvasRenderingContext2D, palette: ChestPalette): void {
  // 젖혀진 뚜껑의 안쪽.
  const top = BODY_TOP - 168;
  ctx.beginPath();
  ctx.moveTo(L - 4, BODY_TOP - 8); ctx.lineTo(L + 16, top); ctx.lineTo(R - 16, top); ctx.lineTo(R + 4, BODY_TOP - 8); ctx.closePath();
  const inner = ctx.createLinearGradient(0, top, 0, BODY_TOP);
  inner.addColorStop(0, palette.wood[1]); inner.addColorStop(1, rgba("#000000", 0.85));
  ctx.fillStyle = palette.wood[1]; ctx.fill();
  ctx.fillStyle = inner; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  strip(ctx, palette, L + 10, top - 6, R - L - 20, 18);
  // 빛줄기.
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let ray = 0; ray < 7; ray += 1) {
    const spread = (ray - 3) * 34;
    const gradient = ctx.createLinearGradient(0, BODY_TOP, 0, 0);
    gradient.addColorStop(0, rgba("#fff6d0", 0.85)); gradient.addColorStop(0.4, rgba(palette.glow, 0.45)); gradient.addColorStop(1, rgba(palette.glow, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.moveTo(CX + spread * 0.6 - 14, BODY_TOP - 10); ctx.lineTo(CX + spread * 0.6 + 14, BODY_TOP - 10); ctx.lineTo(CX + spread * 2.4 + 24, 0); ctx.lineTo(CX + spread * 2.4 - 24, 0); ctx.closePath(); ctx.fill();
  }
  const core = ctx.createRadialGradient(CX, BODY_TOP - 10, 4, CX, BODY_TOP - 10, 150);
  core.addColorStop(0, "rgba(255,248,214,0.9)"); core.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = core; ctx.fillRect(L, BODY_TOP - 160, R - L, 160);
  ctx.restore();
  // 보물 더미 — 금화가 봉긋하게 쌓인다.
  const pile = ctx.createRadialGradient(CX, BODY_TOP - 10, 6, CX, BODY_TOP - 10, 170);
  pile.addColorStop(0, "#fff6c8"); pile.addColorStop(0.5, "#f2b53a"); pile.addColorStop(1, "#8a5410");
  ctx.fillStyle = pile;
  ctx.beginPath(); ctx.ellipse(CX, BODY_TOP - 2, (R - L) / 2 - 6, 30, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  for (let coin = 0; coin < 14; coin += 1) {
    const x = CX + Math.sin(coin * 2.399) * 130 * ((coin % 5) / 5 + 0.2);
    const y = BODY_TOP - 6 - Math.abs(Math.cos(coin * 1.3)) * 18 * (1 - Math.abs(x - CX) / 170);
    ctx.fillStyle = "#ffd257"; ctx.beginPath(); ctx.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2; ctx.stroke();
  }
  palette.gems.forEach((color, index) => gem(ctx, color, CX - 70 + index * 35, BODY_TOP - 20 - (index % 2) * 8, 9));
}
