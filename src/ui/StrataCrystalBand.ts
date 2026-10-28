import Phaser from "phaser";
import { chipPoints, drawLayer, HOLO, toPoints } from "./holo";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/**
 * 유적 미리보기의 결정 띠.
 *
 * 노란 글 한 줄로 적던 때는 바로 아래 이유 줄(「탐사 가능」)과 같은 색·같은 무게라, 오래 비워
 * 둔 유적에 결정이 맺혔다는 것이 그 창의 가장 큰 소식인데도 읽히지 않았다. 판 아래에
 * **결정색 띠 한 장**을 세운다 — 왼쪽에 단계 수만큼 마름모(맺힌 단계는 채우고 남은 단계는 빈 틀),
 * 오른쪽에 단계·굴착 보너스 한 줄과 다음 단계까지 남은 시간 한 줄이다. 맺힌 결정이 있으면 띠
 * 안쪽 가장자리가 결정색으로 숨 쉬고, 없으면 같은 띠가 어두운 유리로 가라앉는다.
 */
export interface StrataCrystalBandOptions {
  width: number;
  height: number;
  /** 지금 맺힌 단계(0 = 없음). */
  stage: number;
  /** 이 유적에 맺힐 수 있는 단계 수. */
  maxStage: number;
  title: string;
  /** 다음 단계까지 남은 시간 문구. 다 맺혔거나 모르면 비운다. */
  detail?: string;
  /** 움직임 줄이기에서는 숨 쉬지 않는다. */
  still: boolean;
}

const CRYSTAL_TEXT = "#dcc8ff";
const DARK = "#05070a";

export function addStrataCrystalBand(scene: Phaser.Scene, x: number, y: number, options: StrataCrystalBandOptions): Phaser.GameObjects.Container {
  const band = scene.add.container(x, y);
  const lit = options.stage > 0;
  const stone = COLOR.archaeologyStone;
  const shape = chipPoints(options.width, options.height, { bevel: { topLeft: 30, bottomRight: 30 } });

  band.add(drawLayer(scene, 0, 0, shape, lit
    ? { fill: 0x1c1234, alpha: 0.92, edge: stone, edgeAlpha: 0.95, edgeWidth: 3, glow: { color: stone, strength: 0.35, height: 0.6 } }
    : { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.inkDimHex, edgeAlpha: 0.35 }));
  if (lit) {
    // 줄여 가며 두르는 안쪽 빛은 가로로 긴 띠에서 좌우가 어긋난 줄무늬로 남는다 — 같은 도형을 통째로
    // 결정색으로 덮고 그 진하기만 숨 쉬게 한다(지도 노드의 결정 빛과 같은 문법).
    const glow = scene.add.graphics();
    glow.fillStyle(stone, 1).fillPoints(toPoints(shape), true);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setAlpha(0.14);
    band.add(glow);
    if (!options.still) scene.tweens.add({ targets: glow, alpha: 0.3, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  // 단계 마름모. 좌우 꼭짓점 높이를 살짝 어긋나게 깎아 반듯한 보석 아이콘으로 보이지 않게 한다.
  const gemSize = 36;
  const gemGap = 16;
  const gemsLeft = -options.width / 2 + 52;
  const gems = Math.max(1, options.maxStage);
  for (let i = 0; i < gems; i += 1) {
    const cx = gemsLeft + i * (gemSize + gemGap);
    const filled = i < options.stage;
    const points = [0, -gemSize * 0.62, gemSize * 0.5, -gemSize * 0.04, 0, gemSize * 0.62, -gemSize * 0.5, gemSize * 0.04];
    const gem = scene.add.graphics({ x: cx, y: 0 });
    const geomPoints = [] as Phaser.Geom.Point[];
    for (let p = 0; p < points.length; p += 2) geomPoints.push(new Phaser.Geom.Point(points[p], points[p + 1]));
    if (filled) {
      // 같은 마름모를 검게 아래로 한 겹 깔아 밝은 띠 위에서도 실루엣이 떠오르게 한다.
      gem.fillStyle(0x000000, 0.55);
      gem.fillPoints(geomPoints.map((point) => new Phaser.Geom.Point(point.x + 3, point.y + 4)), true);
      gem.fillStyle(stone, 1).fillPoints(geomPoints, true);
      gem.fillStyle(0xffffff, 0.5).fillPoints([geomPoints[0], geomPoints[1], new Phaser.Geom.Point(0, 0), geomPoints[3]], true);
      gem.lineStyle(3, 0x05070a, 0.9).strokePoints(geomPoints, true);
    } else {
      gem.fillStyle(0x000000, 0.35).fillPoints(geomPoints, true);
      gem.lineStyle(3, lit ? stone : COLOR.inkDimHex, lit ? 0.75 : 0.5).strokePoints(geomPoints, true);
    }
    band.add(gem);
    if (filled && !options.still) {
      scene.tweens.add({ targets: gem, scale: 1.12, duration: 900 + i * 180, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  const textLeft = gemsLeft + gems * (gemSize + gemGap) + 10;
  const title = scene.add.text(textLeft, options.detail ? -17 : 0, options.title,
    textStyle({ role: "display", size: 31, color: lit ? CRYSTAL_TEXT : COLOR.inkDim })).setOrigin(0, 0.5).setStroke(DARK, 6);
  const room = options.width / 2 - 28 - textLeft;
  band.add(squeezeTextToWidth(title, room));
  if (options.detail) {
    band.add(squeezeTextToWidth(scene.add.text(textLeft, 22, options.detail,
      textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0.5).setStroke(DARK, 4), room));
  }
  return band;
}
