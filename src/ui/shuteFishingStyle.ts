import Phaser from "phaser";

/**
 * 슈테의 결 — 원화(아이보리 천·노란 후드·검은 줄무늬·검은 패드·시안 신호 고리·삼각 스터드)에서 뽑은 색.
 * 리듬 낚시 창과 로비 카드 장면이 같은 표를 읽는다.
 */
export const SHUTE_TONE = {
  ink: 0x22222a,
  inkSoft: 0x3a3a46,
  track: 0x30303b,
  ivory: 0xfdf6e3,
  cream: 0xf1e3bd,
  yellow: 0xffc93c,
  yellowDeep: 0xd99a10,
  cyan: 0x5fe6ea,
  cyanDeep: 0x1aa7b0,
  dim: 0x5a5a66,
} as const;

/** 왼쪽 위·오른쪽 아래만 깎은 판 — 이 게임의 판·칩 실루엣과 같은 방향이다. */
export function chamferPoints(left: number, top: number, width: number, height: number, cut: number): Phaser.Geom.Point[] {
  const right = left + width, bottom = top + height;
  return [
    new Phaser.Geom.Point(left + cut, top), new Phaser.Geom.Point(right, top), new Phaser.Geom.Point(right, bottom - cut),
    new Phaser.Geom.Point(right - cut, bottom), new Phaser.Geom.Point(left, bottom), new Phaser.Geom.Point(left, top + cut),
  ];
}

/** 노랑·검정 경고 줄무늬 띠 — 빗금은 띠 안으로만 잘라 그린다. */
export function drawHazard(g: Phaser.GameObjects.Graphics, left: number, top: number, width: number, height: number, stripe = 14, base: number = SHUTE_TONE.yellow): void {
  const right = left + width;
  g.fillStyle(base, 1).fillRect(left, top, width, height);
  g.fillStyle(SHUTE_TONE.ink, 1);
  const clamp = (x: number): number => Math.max(left, Math.min(right, x));
  for (let x = left - height; x < right + height; x += stripe * 2) {
    const points = [
      new Phaser.Geom.Point(clamp(x + height), top), new Phaser.Geom.Point(clamp(x + height + stripe), top),
      new Phaser.Geom.Point(clamp(x + stripe), top + height), new Phaser.Geom.Point(clamp(x), top + height),
    ];
    if (points[1].x - points[0].x <= 0 && points[2].x - points[3].x <= 0) continue;
    g.fillPoints(points, true);
  }
}

/** 위로 솟은 삼각 스터드 — 원화의 가시 장식. 켜진 것은 노랗고 꺼진 것은 잿빛이다. */
export function drawStud(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, on: boolean, color: number = SHUTE_TONE.yellow): void {
  const ink = size * 0.28;
  g.fillStyle(SHUTE_TONE.ink, 1).fillTriangle(x - size / 2 - ink, y + size * 0.42 + ink * 0.6, x + size / 2 + ink, y + size * 0.42 + ink * 0.6, x, y - size * 0.58 - ink);
  g.fillStyle(on ? color : SHUTE_TONE.dim, 1).fillTriangle(x - size / 2, y + size * 0.42, x + size / 2, y + size * 0.42, x, y - size * 0.58);
  if (on) g.fillStyle(0xffffff, 0.55).fillTriangle(x - size * 0.12, y + size * 0.1, x + size * 0.04, y + size * 0.1, x - size * 0.04, y - size * 0.3);
}

/** 게이지 판 안쪽에서 바늘이 오가는 칸 — 양 끝의 경고 테이프를 뺀 자리다. */
export function shuteGaugeTrack(width: number, height: number): { left: number; width: number } {
  const cap = height * 0.6;
  return { left: -width / 2 + cap, width: width - cap * 2 };
}

export interface ShuteGaugeState {
  width: number;
  height: number;
  /** 빛나는 칸 — 비우면 칸 없이 바늘만 선다. */
  zone?: { center: number; width: number };
  /** 바늘 자리(0~1). */
  position: number;
  /** 캐치 직후의 번쩍임(0~1). */
  flash: number;
  /** 카드 위의 작은 게이지 — 그림자·눈금을 줄인다. */
  compact?: boolean;
}

/**
 * 슈테 게이지 — 검은 패드 몸통, 양 끝 노랑·검정 경고 테이프, 시안 신호 칸(가운데 PERFECT 띠는 더 밝다), 노란 삼각 바늘.
 * 바늘은 매 프레임 다시 그린다. 칸 좌표는 `shuteGaugeTrack`의 안쪽 칸 기준이다.
 */
export function paintShuteGauge(g: Phaser.GameObjects.Graphics, state: ShuteGaugeState): void {
  const { width, height, zone, flash, compact } = state;
  const left = -width / 2, top = -height / 2, cut = height * 0.32;
  const track = shuteGaugeTrack(width, height);
  const inset = compact ? 5 : 9;
  g.clear();
  if (!compact) g.fillStyle(0x000000, 0.28).fillPoints(chamferPoints(left + 6, top + 12, width, height, cut), true);
  g.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(left - 5, top - 5, width + 10, height + 10, cut + 3), true);
  const capWidth = track.left - left - 4;
  drawHazard(g, left + cut * 0.6, top + inset, capWidth - cut * 0.6, height - inset * 2, compact ? 7 : 12);
  drawHazard(g, track.left + track.width + 4, top + inset, capWidth - cut * 0.6, height - inset * 2, compact ? 7 : 12);
  g.fillStyle(SHUTE_TONE.track, 1).fillRect(track.left, top + inset, track.width, height - inset * 2);
  if (!compact) {
    g.fillStyle(SHUTE_TONE.ivory, 0.1);
    for (let index = 1; index < 8; index += 1) g.fillRect(track.left + (track.width * index) / 8 - 1, top + inset + 8, 2, height - inset * 2 - 16);
  }
  if (zone) {
    const zx = track.left + (zone.center - zone.width / 2) * track.width, zw = zone.width * track.width;
    const zTop = top + inset + 3, zHeight = height - inset * 2 - 6;
    g.fillStyle(SHUTE_TONE.cyan, 0.4 + 0.45 * flash).fillRect(zx, zTop, zw, zHeight);
    const pw = zw * 0.4;
    g.fillStyle(0xc9fbfd, 0.95).fillRect(track.left + zone.center * track.width - pw / 2, zTop, pw, zHeight);
    g.lineStyle(compact ? 2 : 3, 0xffffff, 0.95).strokeRect(zx, zTop, zw, zHeight);
    if (flash > 0) g.lineStyle(compact ? 3 : 6, SHUTE_TONE.cyan, flash * 0.8).strokeRect(zx - 6, zTop - 6, zw + 12, zHeight + 12);
  }
  const nx = track.left + Math.max(0, Math.min(1, state.position)) * track.width;
  const tip = compact ? 9 : 16;
  g.fillStyle(SHUTE_TONE.ink, 1).fillRect(nx - 5, top - 2, 10, height + 4);
  g.fillStyle(SHUTE_TONE.yellow, 1).fillRect(nx - 2.5, top + 1, 5, height - 2);
  // 위·아래 삼각 바늘 — 검은 테를 두른 노란 촉이 칸을 가리킨다.
  g.fillStyle(SHUTE_TONE.ink, 1).fillTriangle(nx - tip - 4, top - tip * 1.4 - 4, nx + tip + 4, top - tip * 1.4 - 4, nx, top + 4);
  g.fillStyle(SHUTE_TONE.yellow, 1).fillTriangle(nx - tip, top - tip * 1.4, nx + tip, top - tip * 1.4, nx, top - 2);
  g.fillStyle(SHUTE_TONE.ink, 1).fillTriangle(nx - tip - 4, top + height + tip * 1.4 + 4, nx + tip + 4, top + height + tip * 1.4 + 4, nx, top + height - 4);
  g.fillStyle(SHUTE_TONE.yellow, 1).fillTriangle(nx - tip, top + height + tip * 1.4, nx + tip, top + height + tip * 1.4, nx, top + height + 2);
}

/** 시안 신호 고리 — 원화의 동심 고리를 마름모로 눕힌 것(이 게임의 연출은 동그라미를 쓰지 않는다). */
export function drawSignalRings(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, alpha = 1): void {
  for (let ring = 0; ring < 3; ring += 1) {
    const rx = size * (0.45 + ring * 0.3), ry = rx * 0.7;
    g.lineStyle(ring === 0 ? 5 : 3, SHUTE_TONE.cyan, alpha * (1 - ring * 0.28));
    g.strokePoints([new Phaser.Geom.Point(x, y - ry), new Phaser.Geom.Point(x + rx, y), new Phaser.Geom.Point(x, y + ry), new Phaser.Geom.Point(x - rx, y)], true);
  }
}
