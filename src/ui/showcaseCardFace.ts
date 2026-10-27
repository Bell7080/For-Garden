import Phaser from "phaser";

/**
 * 상품 카드 **면 자체의 무늬** — 전시대 카드(`paintShowcaseCard`)·광고 칸·구매 확인판이 함께 쓴다.
 *
 * 단색 유리면 위에 액자만 서면 카드가 비어 보인다. 무늬는 두 겹이다.
 * ① **◆ 격자** — 마름모 칸과 꼭짓점의 작은 ◆가 오른쪽 위에서 가장 진하고 왼쪽 위로 흐르며 옅어지고,
 *    아래로는 상품 줄에 닿기 전에 사라진다. 카드가 여러 장 쌓이므로 은은하게 둔다 — 진하면 줄마다
 *    무늬가 겹쳐 눈이 아프다.
 * ② **광휘** — 상품 뒤에서 강조색 빛살이 부채처럼 퍼진다.
 *
 * 면은 **절반 해상도 캔버스에 한 번 굽고**(같은 크기·색이면 다시 굽지 않는다) 카드 도형으로 잘라 늘려
 * 그린다 — 그림 파일 없이 그라데이션·무늬만 쓰고, 다각형 채우기로는 그라데이션을 못 그려서 굽는다.
 * 기하 마스크는 컨테이너 이동을 물려받지 않아 스크롤 목록에서 어긋나므로, 모서리는 굽는 단계에서
 * 지운다(`chipArtTexture`와 같은 방법).
 */
const BAKE_SCALE = 0.5;

function css(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
}

export interface ShowcaseFaceOptions {
  width: number;
  height: number;
  /** 카드 도형(중심 기준 평면 좌표). 이 밖은 굽는 단계에서 지운다. */
  shape: readonly number[];
  accent: number;
  /** 상품이 놓이는 높이(중심 기준 y). 받침·빛이 이 줄을 기준으로 선다. 비우면 위에서 40% 자리다. */
  stageY?: number;
  /** 소진처럼 눌러 둔 카드 — 무늬를 반쯤만 낸다. */
  dim?: boolean;
}

/** 카드 면을 한 장 세운다. 부르는 쪽은 몸판 바로 위·글자 아래에 넣는다. */
export function addShowcaseFace(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, options: ShowcaseFaceOptions): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, bakeFace(scene, options)).setDisplaySize(options.width, options.height);
  if (options.dim) image.setAlpha(0.5);
  parent.add(image);
  return image;
}

function bakeFace(scene: Phaser.Scene, options: ShowcaseFaceOptions): string {
  const { width, height, accent } = options;
  const w = Math.max(2, Math.round(width * BAKE_SCALE));
  const h = Math.max(2, Math.round(height * BAKE_SCALE));
  const stage = (options.stageY ?? -height * 0.1) * BAKE_SCALE + h / 2;
  const key = `showcase-face:${w}x${h}:${Math.round(stage)}:${accent.toString(16)}:${options.shape.length}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return "__DEFAULT";
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < options.shape.length; i += 2) {
    const px = options.shape[i] * BAKE_SCALE + w / 2;
    const py = options.shape[i + 1] * BAKE_SCALE + h / 2;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();
  paintBurst(ctx, w, h, stage, accent);
  paintLattice(ctx, w, h, accent);
  ctx.restore();
  canvas.refresh();
  return key;
}

/** 격자 한 칸(굽는 해상도 기준). 마름모의 가로·세로 대각선이다. */
const LATTICE = { cellW: 22, cellH: 14, line: 0.16, gem: 0.3, gemSize: 1.6 } as const;

/** ① ◆ 격자 — 오른쪽 위에서 왼쪽 위로 흐르며 옅어지고, 아래로는 사라진다. */
function paintLattice(ctx: CanvasRenderingContext2D, w: number, h: number, accent: number): void {
  const layer = document.createElement("canvas");
  layer.width = w; layer.height = h;
  const g = layer.getContext("2d");
  if (!g) return;
  const { cellW, cellH } = LATTICE;
  g.strokeStyle = css(accent, LATTICE.line);
  g.lineWidth = 1;
  g.beginPath();
  // 마름모 칸 — 두 방향의 사선이 cellW × cellH 마름모를 만든다.
  const slope = cellH / cellW;
  for (let x = -h / slope; x < w + h / slope; x += cellW) {
    g.moveTo(x, 0); g.lineTo(x + h / slope, h);
    g.moveTo(x, 0); g.lineTo(x - h / slope, h);
  }
  g.stroke();
  // 꼭짓점마다 작은 ◆.
  g.fillStyle = css(accent, LATTICE.gem);
  const s = LATTICE.gemSize;
  for (let row = 0; row * (cellH / 2) <= h + cellH; row += 1) {
    const y = row * (cellH / 2);
    for (let x = (row % 2) * (cellW / 2); x <= w + cellW; x += cellW) {
      g.beginPath();
      g.moveTo(x, y - s * 1.4); g.lineTo(x + s, y); g.lineTo(x, y + s * 1.4); g.lineTo(x - s, y);
      g.closePath(); g.fill();
    }
  }
  // 흐름 — 오른쪽 위가 가장 진하고 왼쪽으로 갈수록 옅다.
  g.globalCompositeOperation = "destination-in";
  const across = g.createLinearGradient(w, 0, 0, 0);
  across.addColorStop(0, "rgba(0,0,0,1)"); across.addColorStop(0.6, "rgba(0,0,0,0.45)"); across.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = across; g.fillRect(0, 0, w, h);
  // 아래로는 사라진다 — 상품 줄과 값 줄 뒤까지 무늬가 오면 글자보다 먼저 읽힌다.
  const down = g.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, "rgba(0,0,0,1)"); down.addColorStop(0.45, "rgba(0,0,0,0.4)"); down.addColorStop(0.8, "rgba(0,0,0,0)");
  g.fillStyle = down; g.fillRect(0, 0, w, h);
  ctx.drawImage(layer, 0, 0);
  // 오른쪽 위 모서리에 고이는 빛 — 격자가 흘러나오는 자리.
  const corner = ctx.createRadialGradient(w, 0, 0, w, 0, Math.max(w, h) * 0.55);
  corner.addColorStop(0, css(accent, 0.14)); corner.addColorStop(1, css(accent, 0));
  ctx.fillStyle = corner; ctx.fillRect(0, 0, w, h);
}

/** ② 광휘 — 상품 뒤에서 강조색 빛살이 부채처럼 퍼진다. 카드가 여러 장이라 옅게 둔다. */
function paintBurst(ctx: CanvasRenderingContext2D, w: number, h: number, stage: number, accent: number): void {
  const cx = w / 2;
  const cy = stage - h * 0.12;
  const reach = Math.max(w, h) * 1.2;
  const rays = 18;
  for (let i = 0; i < rays; i += 1) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / rays / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.55);
    grad.addColorStop(0, css(accent, 0.15)); grad.addColorStop(1, css(accent, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
    ctx.lineTo(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
    ctx.closePath(); ctx.fill();
  }
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.28);
  core.addColorStop(0, css(accent, 0.18)); core.addColorStop(1, css(accent, 0));
  ctx.fillStyle = core; ctx.fillRect(0, 0, w, h);
  const floor = ctx.createLinearGradient(0, h * 0.55, 0, h);
  floor.addColorStop(0, "rgba(0,0,0,0)"); floor.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = floor; ctx.fillRect(0, h * 0.55, w, h * 0.45);
}
