import Phaser from "phaser";
import { t } from "../i18n";
import type { DuelOpponentDto } from "../api/contracts";
import { duelDivisionNumeral } from "../core/duelArena";
import { getRelic } from "../data/relics";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { Button, DESTRUCTIVE_BUTTON_STYLE } from "./Button";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_TIER_COLOR } from "./duelLayout";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer } from "./holo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addSdFootShadow } from "./SdFootShadow";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { addUnitNameplate, addUnitPower } from "./unitNameplate";

/** 방어팀 미리보기의 자리. 머리 줄 → 세 칸이 선 무대 → 출격 순이고 창 높이는 그 합이다. */
export const DUEL_DEFENSE_PREVIEW = {
  width: 980,
  pad: { top: 92, bottom: 64 },
  head: { height: 170, face: 128, faceX: -370, textX: -280, powerX: 430 },
  stage: { width: 900, height: 660, gap: 26, ground: 175, sd: 300, slotX: 285, frontLift: 46, shadow: 200 },
  blind: 54,
  sortie: { width: 820, height: 132 },
} as const;

export function duelDefensePreviewLayout(): { height: number; headY: number; stageY: number; blindY: number; sortieY: number } {
  const L = DUEL_DEFENSE_PREVIEW;
  const height = L.pad.top + L.head.height + L.stage.gap + L.stage.height + L.blind + L.sortie.height + L.pad.bottom;
  let top = -height / 2 + L.pad.top;
  const headY = top + L.head.height / 2;
  top += L.head.height + L.stage.gap;
  const stageY = top + L.stage.height / 2;
  top += L.stage.height;
  return { height, headY, stageY, blindY: top + L.blind / 2, sortieY: top + L.blind + L.sortie.height / 2 };
}

/**
 * 결투장 상대의 **방어팀** — 상대 선택에서 도전을 누르면 먼저 이 창이 선다.
 *
 * 줄 한 칸의 얼굴 셋으로는 무엇과 붙는지가 다 읽히지 않는다. 결투 전장 원화 위에 방어팀 셋이 SD로 서고(가운데가
 * 한 걸음 앞으로 나선 편성 자리), 발밑에 레벨·이름과 개체 전투력이 선다. 가려진 칸은 누구인지도 레벨도 말하지
 * 않고 `?`로만 선다 — 그 몫은 머리 줄의 총 전투력에만 든다. 맨 아래 **출격**이 공격팀 편성 화면을 연다.
 * 뒤로 나가면 상대 선택으로 돌아간다.
 */
export function openDuelDefensePreview(scene: Phaser.Scene, popups: PopupLayer, opponent: DuelOpponentDto, handlers: { onSortie: () => void; onBack: () => void }): void {
  const L = DUEL_DEFENSE_PREVIEW;
  const layout = duelDefensePreviewLayout();
  const tone = DUEL_TIER_COLOR[opponent.tierId];
  let sortied = false;
  popups.open({
    width: L.width, height: layout.height, title: t("duel.defense.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.78, backButton: true,
    onClose: () => { if (!sortied) handlers.onBack(); },
  }, (body, close) => {
    paintHead(scene, body, layout.headY, opponent);
    paintStage(scene, body, layout.stageY, opponent, tone.fill);
    const hidden = opponent.units.filter((unit) => !unit.relicId).length;
    if (hidden > 0) body.add(scene.add.text(0, layout.blindY, t("duel.defense.blind", { count: hidden }), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
    body.add(new Button(scene, 0, layout.sortieY, {
      width: L.sortie.width, height: L.sortie.height, fontSize: 50, label: t("duel.defense.sortie"), ...DESTRUCTIVE_BUTTON_STYLE,
      onClick: () => { sortied = true; close(); handlers.onSortie(); },
    }));
  });
}

/** 누구의 방어팀인가 — 얼굴 · 이름 · 티어와 점수, 오른쪽에 총 전투력. */
function paintHead(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, opponent: DuelOpponentDto): void {
  const H = DUEL_DEFENSE_PREVIEW.head;
  const tone = DUEL_TIER_COLOR[opponent.tierId];
  body.add(drawLayer(scene, 0, y, chipPoints(DUEL_DEFENSE_PREVIEW.stage.width, H.height, { bevel: { topLeft: 30, bottomRight: 30 } }), { fill: 0x141a22, alpha: 0.94, edge: tone.fill, edgeAlpha: 0.7 }));
  body.add(new FaceFrame(scene, H.faceX, y, { portraitAssetId: getRelic(opponent.favoriteRelicId).portraitAssetId, size: H.face, color: tone.fill }));
  body.add(squeezeTextToWidth(scene.add.text(H.textX, y - 32, opponent.displayName, textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0, 0.5), 400));
  addDuelTierEmblem(scene, body, H.textX + 22, y + 28, 44, opponent.tierId);
  const tierName = `${t(`duel.tier.${opponent.tierId}`)} ${duelDivisionNumeral(opponent.division)}`.trim();
  body.add(squeezeTextToWidth(scene.add.text(H.textX + 56, y + 28, `${tierName}  ${t("duel.score", { score: opponent.score.toLocaleString() })}`, textStyle({ role: "emphasis", size: 26, color: tone.text })).setOrigin(0, 0.5), 340));
  body.add(scene.add.text(H.powerX, y - 28, t("duel.defense.totalPower"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
  body.add(scene.add.text(H.powerX, y + 18, opponent.totalPower.toLocaleString(), textStyle({ role: "display", size: 52, color: "#ff8a8a" })).setOrigin(1, 0.5).setStroke("#05070a", 6));
}

/** 결투 전장 위의 세 칸. 가운데는 한 걸음 앞으로 나선다(편성의 2번 자리). */
function paintStage(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, opponent: DuelOpponentDto, edge: number): void {
  const S = DUEL_DEFENSE_PREVIEW.stage;
  const shape = chipPoints(S.width, S.height, { bevel: { topLeft: 44, bottomRight: 44 } });
  body.add(drawLayer(scene, 0, y, shape, { fill: 0x0b0f14, alpha: 1 }));
  addPopupBackgroundImage(scene, body, BACKGROUND.duelField, { x: 0, y, width: S.width, height: S.height, maskShape: shape, overlayStrength: 0.75 });
  body.add(drawLayer(scene, 0, y, shape, { fill: 0x000000, alpha: 0, edge, edgeAlpha: 0.8, shadow: false }));
  // 층은 셋 — 발밑 그림자 → SD → 이름줄. 늦게 도착한 SD가 그림자 위·글자 아래에 끼어든다.
  const stage = scene.add.container(0, 0), figures = scene.add.container(0, 0), labels = scene.add.container(0, 0);
  body.add([stage, figures, labels]);
  opponent.units.forEach((unit, index) => {
    const x = (index - 1) * S.slotX;
    const ground = y + S.ground + (index === 1 ? S.frontLift : 0);
    addSdFootShadow(scene, x, ground, S.shadow, stage);
    if (!unit.relicId) {
      // 가려진 칸 — 누구인지도 레벨도 말하지 않는다.
      const plateY = ground - S.sd * 0.48;
      stage.add(drawLayer(scene, x, plateY, chipPoints(200, 260, { bevel: { topLeft: 34, bottomRight: 34 } }), { fill: 0x05070a, alpha: 0.82, edge: COLOR.inkDimHex, edgeAlpha: 0.6 }));
      stage.add(scene.add.text(x, plateY, "?", textStyle({ role: "display", size: 140, color: COLOR.inkDim })).setOrigin(0.5));
      labels.add(scene.add.text(x, ground + 30, "???", textStyle({ role: "display", size: 28, color: COLOR.inkDim })).setOrigin(0.5, 0).setStroke("#05070a", 4));
      return;
    }
    const def = getRelic(unit.relicId);
    addUnitNameplate(scene, labels, x, ground + 30, unit.level, def.name, 28);
    addUnitPower(scene, labels, x, ground + 104, unit.power, 26, "#ff9f9f");
    void spawnPuppet(scene, battleAssetFor(unit.relicId), { x, groundY: ground, height: S.sd, depth: 0, flipX: true }).then((puppet) => {
      if (!figures.active) { puppet.destroy(); return; }
      puppet.disableInteractive();
      figures.add(puppet);
      puppet.setAlpha(0);
      scene.tweens.add({ targets: puppet, alpha: 1, duration: 220, delay: index * 80 });
    }).catch((error) => console.warn("방어팀 SD 표시 실패", error));
  });
}
