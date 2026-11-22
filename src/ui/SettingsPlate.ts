import Phaser from "phaser";
import { chipPoints, drawLayer, slantedRect, toPoints } from "./holo";
import { SETTINGS_PLATE as P, SETTINGS_ROW } from "./settingsLayout";
import { COLOR } from "./theme";

export type SettingsPlateTone = "normal" | "danger" | "note";

/** 줄 판의 실루엣 — 화면의 다른 칩과 같이 왼쪽 위·오른쪽 아래만 깎는다. */
function plateShape(width: number, height: number): number[] {
  return chipPoints(width, height, { bevel: { topLeft: P.bevel, bottomRight: P.bevel } });
}

/**
 * 환경설정 줄 하나 뒤에 까는 판(`SETTINGS_PLATE`). 반환한 컨테이너는 씬에 이미 올라가 있으므로
 * 부르는 쪽이 목록 컨테이너의 **줄보다 앞 순서**에 넣는다(컨테이너는 넣은 순서대로 그린다).
 *
 * @param y 줄의 세로 중심(목록 안쪽 좌표).
 * @param height 판 높이. 문단처럼 줄보다 큰 것을 품을 때만 준다.
 */
export function addSettingsPlate(scene: Phaser.Scene, y: number, tone: SettingsPlateTone = "normal", height: number = P.height, width: number = P.width, centerX = (SETTINGS_ROW.left + SETTINGS_ROW.right) / 2): Phaser.GameObjects.Container {
  const accent = tone === "danger" ? COLOR.danger : COLOR.accent;
  const fill = tone === "danger" ? P.danger.fill : P.fill;
  const alpha = tone === "danger" ? P.danger.alpha : tone === "note" ? P.note.alpha : P.alpha;
  const plate = scene.add.container(centerX, y);
  plate.add(drawLayer(scene, 0, 0, plateShape(width, height), { fill, alpha, shadow: false, edge: accent, edgeAlpha: tone === "note" ? P.edgeAlpha * 0.6 : P.edgeAlpha }));
  // 왼쪽 빗금 — 제목표의 빗금과 같은 모양이라 줄이 그 판에 묶인 것으로 읽힌다.
  const bar = scene.add.graphics();
  bar.fillStyle(accent, tone === "note" ? P.marker.alpha * 0.6 : P.marker.alpha);
  const markerHeight = Math.min(P.marker.height, height - 24);
  bar.fillPoints(toPoints(slantedRect(P.marker.width, markerHeight, 4)).map((point) => new Phaser.Geom.Point(point.x - width / 2 + P.marker.x + P.marker.width / 2, point.y)), true);
  plate.add(bar);
  return plate;
}
