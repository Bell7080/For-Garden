import Phaser from "phaser";
import { t } from "../i18n";
import { getRelic } from "../data/relics";
import type { GrowthPath } from "../core/growthPaths";
import { drawIcon } from "./BottomNav";
import { Button } from "./Button";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 진 판 뒤의 **강해지는 길 타일** — 위에 아이콘, 아래에 이름 버튼 한 장씩 나란히 선다.
 *
 * 세로로 글자 버튼을 쌓던 때는 길이 늘 때마다 판 아래로 넘쳤고 모드마다 다른 말을 적었다.
 * 어느 길이 서는지는 `growthPaths`가 편성 상태에서 정하고, 이 줄은 그 결과를 같은 모양으로 세운다.
 */
export const GROWTH_TILES = { width: 270, height: 176, gap: 20, iconY: -46, iconSize: 64, buttonHeight: 66, buttonInset: 14, nameY: -6, nameSize: 20 } as const;

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

function drawPathIcon(scene: Phaser.Scene, path: GrowthPath, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
  switch (path.id) {
    case "relicEnhance": return drawIcon(scene, "relics", x, y, color);
    case "lab": return drawIcon(scene, "lab", x, y, color);
    case "archaeology": return drawIcon(scene, "archaeology", x, y, color);
    case "runeCraft": return drawGlyph(scene, "heart", x, y, size * 0.72, color);
    case "party": return drawGlyph(scene, "friends", x, y, size * 0.78, color);
  }
}

/** 타일 줄을 `y`(타일 윗변)에 세운다. 눌린 길은 `onPick`이 맡고, 판을 닫는 것은 부르는 쪽이다. */
export function addGrowthPathTiles(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, paths: readonly GrowthPath[], onPick: (path: GrowthPath) => void): void {
  const G = GROWTH_TILES;
  const total = paths.length * G.width + (paths.length - 1) * G.gap;
  paths.forEach((path, index) => {
    const x = -total / 2 + G.width / 2 + index * (G.width + G.gap);
    const tile = scene.add.container(x, y + G.height / 2);
    body.add(tile);
    tile.add(drawLayer(scene, 0, 0, chipPoints(G.width, G.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } }), { fill: 0x101720, alpha: 0.88, edge: COLOR.accent, edgeAlpha: 0.32 }));
    tile.add(drawPathIcon(scene, path, 0, G.iconY, G.iconSize, COLOR.accent));
    // 누구를 위한 길인지는 작게만 — 렐릭 강화·룬 세공은 편성 속 한 명으로 곧장 열린다.
    if (path.relicId) {
      tile.add(scene.add.text(0, G.nameY, getRelic(path.relicId).name, textStyle({ role: "body", size: G.nameSize, color: COLOR.inkDim })).setOrigin(0.5));
    }
    // 아이콘 칸도 같은 길을 누른다 — 이름 버튼만 눌리면 큰 면이 죽은 면으로 읽힌다.
    const zone = scene.add.rectangle(0, -G.buttonHeight / 2, G.width, G.height - G.buttonHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => onPick(path));
    tile.add(zone);
    tile.add(new Button(scene, 0, G.height / 2 - G.buttonInset - G.buttonHeight / 2, {
      width: G.width - G.buttonInset * 2, height: G.buttonHeight, label: pathLabel(path), fontSize: 28, onClick: () => onPick(path),
    }));
  });
}
