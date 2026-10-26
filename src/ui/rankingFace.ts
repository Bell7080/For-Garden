import type Phaser from "phaser";
import { getRelic } from "../data/relics";
import { FaceFrame } from "./FaceFrame";
import { itemFrameShape } from "./itemFrame";
import { drawLayer } from "./holo";
import { RANKING_LIST } from "./expeditionRankingLayout";
import { textStyle } from "./theme";

/**
 * 순위 줄의 얼굴 — 애착 렐릭이 공개되어 있으면 그 얼굴, 아니면 **같은 액자에 이름 첫 글자**다.
 * 얼굴 자리를 비워 두던 때는 그 줄만 이름이 왼쪽으로 붙은 것처럼 보여 목록의 세로 줄이 흐트러졌다.
 */
export function addRankingFace(scene: Phaser.Scene, row: Phaser.GameObjects.Container, favoriteRelicId: string | undefined, name: string, accent: number, at: { x: number; size: number } = { x: RANKING_LIST.faceX, size: RANKING_LIST.faceSize }): void {
  const { x: faceX, size: faceSize } = at;
  if (favoriteRelicId) {
    row.add(new FaceFrame(scene, faceX, 0, { portraitAssetId: getRelic(favoriteRelicId).portraitAssetId, size: faceSize, color: accent }));
    return;
  }
  row.add(drawLayer(scene, faceX, 0, itemFrameShape(faceSize), { fill: 0x0b1016, alpha: 0.95, edge: accent, edgeAlpha: 0.7, shadow: false }));
  const initial = Array.from(name.trim())[0] ?? "?";
  row.add(scene.add.text(faceX, 0, initial, textStyle({ role: "display", size: Math.round(faceSize * 0.42), color: "#d6dbe2" })).setOrigin(0.5));
}
