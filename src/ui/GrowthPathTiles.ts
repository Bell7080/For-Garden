import Phaser from "phaser";
import { t } from "../i18n";
import type { GrowthPath } from "../core/growthPaths";
import { Button } from "./Button";
import { addGrowthPathScene, type GrowthSceneHost } from "./growthPathScenes";
import { chipPoints, drawHairline, drawLayer } from "./holo";

/**
 * 진 판 뒤의 **강해지는 길 타일** — 위에 그 길의 작은 SD 장면(`growthPathScenes`), 아래에 이름 버튼 한 장씩 나란히 선다.
 *
 * 세로로 글자 버튼을 쌓던 때는 길이 늘 때마다 판 아래로 넘쳤고 모드마다 다른 말을 적었다.
 * 어느 길이 서는지는 `growthPaths`가 편성 상태에서 정하고, 이 줄은 그 결과를 같은 모양으로 세운다.
 */
export const GROWTH_TILES = {
  width: 270, height: 244, gap: 20,
  buttonHeight: 64, buttonInset: 14,
  /** SD가 발을 딛는 줄 — 이름 버튼 윗변에서 이만큼 위다. */
  groundAboveButton: 18,
} as const;

/** 길마다 판을 물들이는 색 — 그 길이 가는 화면의 결을 빌린다(연구소 호박 · 고고학 흙빛 청록 · 편성 하늘빛 · 강화 연두 · 룬 분홍). */
const PATH_TONE: Record<GrowthPath["id"], number> = {
  lab: 0xffb54a, archaeology: 0x4fc7a8, party: 0x6fb8ff, relicEnhance: 0x9be070, runeCraft: 0xff7fd0,
};

/** 타일 이름. 문구는 그 길이 가는 화면이 이미 쓰는 낱말을 빌린다. */
function pathLabel(path: GrowthPath): string {
  switch (path.id) {
    case "relicEnhance": return t("growth.relicEnhance");
    case "runeCraft": return t("growth.runeCraft");
    case "lab": return t("nav.lab");
    case "party": return t("growth.party");
    case "archaeology": return t("nav.archaeology");
  }
}

/** 장면에 설 렐릭 — 그 길이 가리키는 렐릭이 먼저, 나머지는 타일마다 다른 편성원이 서도록 돌려 쓴다. */
function sceneCast(path: GrowthPath, index: number, party: readonly string[]): string[] {
  if (path.relicId) return [path.relicId];
  if (party.length === 0) return [];
  const rotated = party.map((_, i) => party[(i + index) % party.length]);
  return rotated;
}

/**
 * 타일 줄을 `y`(타일 윗변, 몸판 좌표)에 세운다. 눌린 길은 `onPick`이 맡고, 판을 닫는 것은 부르는 쪽이다.
 * 장면(`addGrowthPathScene`)은 `host.layer`(화면 좌표)에 서므로 몸판의 화면 원점 `origin`을 함께 받는다.
 * 돌려주는 함수가 장면의 트윈을 멈춘다.
 */
export function addGrowthPathTiles(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  y: number,
  paths: readonly GrowthPath[],
  onPick: (path: GrowthPath) => void,
  stage?: { host: GrowthSceneHost; origin: { x: number; y: number }; party: readonly string[] },
): () => void {
  const G = GROWTH_TILES;
  const total = paths.length * G.width + (paths.length - 1) * G.gap;
  const stops: Array<() => void> = [];
  paths.forEach((path, index) => {
    const x = -total / 2 + G.width / 2 + index * (G.width + G.gap);
    const tile = scene.add.container(x, y + G.height / 2);
    body.add(tile);
    const tone = PATH_TONE[path.id];
    const shape = chipPoints(G.width, G.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } });
    tile.add(drawLayer(scene, 0, 0, shape, { fill: 0x101720, alpha: 0.9, edge: tone, edgeAlpha: 0.55 }));
    // 판 위쪽이 그 길의 색으로 은은하게 물든다 — 장면의 무대다.
    tile.add(drawLayer(scene, 0, 0, shape, { fill: tone, alpha: 0.1, shadow: false }));
    const ground = G.height / 2 - G.buttonInset - G.buttonHeight - G.groundAboveButton;
    tile.add(drawHairline(scene, 0, ground + 8, G.width - 56, { color: tone, alpha: 0.35 }));
    if (stage) {
      stops.push(addGrowthPathScene(scene, stage.host, path.id, { x: stage.origin.x + x, ground: stage.origin.y + y + G.height / 2 + ground, index }, sceneCast(path, index, stage.party), tone));
    }
    // 장면 칸도 같은 길을 누른다 — 이름 버튼만 눌리면 큰 면이 죽은 면으로 읽힌다.
    const zone = scene.add.rectangle(0, -G.buttonHeight / 2, G.width, G.height - G.buttonHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => onPick(path));
    tile.add(zone);
    tile.add(new Button(scene, 0, G.height / 2 - G.buttonInset - G.buttonHeight / 2, {
      width: G.width - G.buttonInset * 2, height: G.buttonHeight, label: pathLabel(path), fontSize: 28, onClick: () => onPick(path),
    }));
  });
  return () => { for (const stop of stops) stop(); };
}
