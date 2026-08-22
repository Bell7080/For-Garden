import Phaser from "phaser";

/**
 * 화면에서 쓰는 선 아이콘 모음.
 *
 * 아직 아트가 없어 도형으로 그린다. 채운 덩어리 대신 얇은 선을 쓰는 이유는, 판때기 없는
 * 유리면 위에서 굵은 실루엣이 얼룩처럼 보이기 때문이다. 아트가 나오면 이 파일만 바꾸면 된다.
 * 모든 글리프는 (0,0)을 중심으로 하고, `size`는 한 변의 지름이다.
 */
export type GlyphName =
  | "sortie"
  | "expedition"
  | "shop"
  | "mail"
  | "friends"
  | "exchange"
  | "settings"
  | "auto"
  | "speed"
  | "heart"
  | "bookmark"
  | "scroll"
  | "magnifier"
  | "costume"
  | "ferocity";

function points(...pairs: number[]): Phaser.Geom.Point[] {
  const list: Phaser.Geom.Point[] = [];
  for (let i = 0; i < pairs.length; i += 2) list.push(new Phaser.Geom.Point(pairs[i], pairs[i + 1]));
  return list;
}

/** 글리프 하나를 그린다. 반환한 Graphics는 이미 씬에 올라가 있다. */
export function drawGlyph(
  scene: Phaser.Scene,
  name: GlyphName,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha = 1,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const r = size / 2;
  g.lineStyle(Math.max(2, size * 0.09), color, alpha);
  switch (name) {
    case "sortie":
      // 앞으로 내미는 화살촉 둘. 출격의 방향을 보여 준다.
      g.strokePoints(points(-r * 0.9, -r * 0.7, r * 0.1, 0, -r * 0.9, r * 0.7), false);
      g.strokePoints(points(-r * 0.1, -r * 0.7, r * 0.9, 0, -r * 0.1, r * 0.7), false);
      break;
    case "expedition":
      // 깃발 — 멀리 나가 꽂고 오는 원정.
      g.lineBetween(-r * 0.5, -r * 0.9, -r * 0.5, r * 0.9);
      g.strokePoints(points(-r * 0.5, -r * 0.85, r * 0.8, -r * 0.45, -r * 0.5, -r * 0.05), true);
      break;
    case "ferocity":
      // 각진 불꽃 — 야성이 끓어오르는 표시다. 큰 혀 하나와 그 앞에 겹치는 작은 혀 하나로
      // 세운다. 곡선 없이 꺾어서 그려야 다른 아이콘과 같은 결로 읽힌다.
      g.fillStyle(color, alpha);
      g.fillPoints(points(
        r * 0.05, -r,
        r * 0.72, -r * 0.02,
        r * 0.5, r * 0.34,
        r * 0.62, r * 0.92,
        -r * 0.62, r * 0.92,
        -r * 0.74, r * 0.14,
        -r * 0.3, -r * 0.34,
        -r * 0.36, r * 0.2,
      ), true);
      g.fillStyle(color, alpha * 0.45);
      g.fillPoints(points(
        r * 0.02, -r * 0.24,
        r * 0.34, r * 0.3,
        r * 0.2, r * 0.9,
        -r * 0.28, r * 0.9,
        -r * 0.34, r * 0.28,
      ), true);
      break;
    case "shop":
      // 손잡이 달린 가방.
      g.strokeRoundedRect(-r * 0.85, -r * 0.25, r * 1.7, r * 1.2, r * 0.2);
      g.beginPath();
      g.arc(0, -r * 0.25, r * 0.45, Math.PI, 0);
      g.strokePath();
      break;
    case "mail":
      // 봉투.
      g.strokeRect(-r * 0.9, -r * 0.6, r * 1.8, r * 1.2);
      g.strokePoints(points(-r * 0.9, -r * 0.6, 0, r * 0.15, r * 0.9, -r * 0.6), false);
      break;
    case "friends":
      // 어깨를 나란히 한 둘.
      g.strokeCircle(-r * 0.4, -r * 0.35, r * 0.32);
      g.strokeCircle(r * 0.45, -r * 0.45, r * 0.26);
      g.beginPath();
      g.arc(-r * 0.4, r * 0.55, r * 0.6, Math.PI, 0);
      g.strokePath();
      g.beginPath();
      g.arc(r * 0.45, r * 0.5, r * 0.45, Math.PI, Math.PI * 1.85);
      g.strokePath();
      break;
    case "exchange":
      // 오가는 화살표 둘 — 다른 연구 도시와의 교류.
      g.lineBetween(-r * 0.85, -r * 0.35, r * 0.85, -r * 0.35);
      g.strokePoints(points(r * 0.4, -r * 0.75, r * 0.85, -r * 0.35, r * 0.4, r * 0.05), false);
      g.lineBetween(r * 0.85, r * 0.45, -r * 0.85, r * 0.45);
      g.strokePoints(points(-r * 0.4, r * 0.05, -r * 0.85, r * 0.45, -r * 0.4, r * 0.85), false);
      break;
    case "settings":
      // 톱니 — 굵은 선 여섯 줄과 가운데 원.
      g.strokeCircle(0, 0, r * 0.42);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        g.lineBetween(Math.cos(angle) * r * 0.6, Math.sin(angle) * r * 0.6, Math.cos(angle) * r * 0.95, Math.sin(angle) * r * 0.95);
      }
      break;
    case "auto":
      // 순환 화살표와 가운데 각성점으로 자동 발동을 표현한다.
      g.beginPath();
      g.arc(0, 0, r * 0.68, Math.PI * 0.15, Math.PI * 1.55);
      g.strokePath();
      g.strokePoints(points(-r * 0.65, -r * 0.25, -r * 0.82, r * 0.35, -r * 0.22, r * 0.22), false);
      g.fillStyle(color, alpha);
      g.fillCircle(0, 0, r * 0.16);
      break;
    case "speed":
      // 세 개의 각진 진행 표식은 1~3배속 순환을 뜻한다.
      for (let i = -1; i <= 1; i++) {
        const offset = i * r * 0.5;
        g.strokePoints(points(offset - r * 0.25, -r * 0.62, offset + r * 0.2, 0, offset - r * 0.25, r * 0.62), false);
      }
      break;
    case "heart":
      // 애착 — 채운 하트.
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(0, r * 0.85);
      g.lineTo(-r * 0.9, -r * 0.15);
      g.arc(-r * 0.45, -r * 0.35, r * 0.5, Math.PI * 0.85, Math.PI * 1.9);
      g.arc(r * 0.45, -r * 0.35, r * 0.5, Math.PI * 1.1, Math.PI * 0.15);
      g.lineTo(0, r * 0.85);
      g.closePath();
      g.fillPath();
      break;
    case "scroll":
      // 파피루스 두루마리 — 관찰 일지. 양 끝을 말아 둔 축 두 개와 펼친 면.
      g.strokeRect(-r * 0.55, -r * 0.72, r * 1.1, r * 1.44);
      g.beginPath();
      g.arc(-r * 0.55, -r * 0.72, r * 0.26, Math.PI * 0.5, Math.PI * 1.5, true);
      g.strokePath();
      g.beginPath();
      g.arc(r * 0.55, r * 0.72, r * 0.26, Math.PI * 1.5, Math.PI * 0.5, true);
      g.strokePath();
      g.lineBetween(-r * 0.28, -r * 0.28, r * 0.28, -r * 0.28);
      g.lineBetween(-r * 0.28, r * 0.06, r * 0.28, r * 0.06);
      break;
    case "magnifier":
      // 돋보기 — 더 볼 것이 있다는 표시.
      g.strokeCircle(-r * 0.14, -r * 0.14, r * 0.55);
      g.lineBetween(r * 0.26, r * 0.26, r * 0.86, r * 0.86);
      break;
    case "costume":
      // 옷걸이에 걸린 옷 — 코스튬.
      g.strokePoints(points(-r * 0.9, -r * 0.2, -r * 0.35, -r * 0.62, r * 0.35, -r * 0.62, r * 0.9, -r * 0.2, r * 0.5, r * 0.1, r * 0.5, r * 0.85, -r * 0.5, r * 0.85, -r * 0.5, r * 0.1), true);
      g.lineBetween(0, -r * 0.62, 0, -r * 0.9);
      break;
    case "bookmark":
      // 즐겨찾기 — 아래가 갈라진 책갈피.
      g.fillStyle(color, alpha);
      g.fillPoints(points(-r * 0.6, -r * 0.85, r * 0.6, -r * 0.85, r * 0.6, r * 0.85, 0, r * 0.3, -r * 0.6, r * 0.85), true);
      break;
  }
  return g;
}
