import Phaser from "phaser";
import { t } from "../i18n";
import type { DuelOpponentDto, DuelStatusResponse } from "../api/contracts";
import { duelDivisionNumeral } from "../core/duelArena";
import { getRelic } from "../data/relics";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_OPPONENT_POPUP as P, DUEL_TIER_COLOR, duelOpponentPopupHeight, duelOpponentRowY } from "./duelLayout";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addItemFrame } from "./itemFrame";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface DuelOpponentPopupHandlers {
  /** 줄의 도전. 공격덱 편성 화면으로 간다 — 도전권은 거기서 전투를 시작할 때 쓴다. */
  onChallenge: (opponent: DuelOpponentDto) => void;
  /** 상대 새로고침. 값이 드는 판이면 부른 쪽이 묻고, 새 상태로 이 창을 다시 연다. */
  onRefresh: (close: () => void) => void;
}

/**
 * 상대 선택 — 결투장 무대의 [도전]이 여는 창.
 *
 * 줄 하나가 상대 하나이고, 왼쪽의 얼굴(그 상대의 애착 렐릭)과 아래 점수가 "누구인가"를, 가운데의
 * 방어덱 셋이 "무엇과 붙나"를 말한다. 가려진 칸은 `?` 액자다. 이기고 지면 얼마나 오르내리는지는
 * 적지 않는다 — 고르는 근거는 상대의 점수·티어·덱이고, 증감까지 서면 늘 가장 많이 오르는 줄만 누르게 된다.
 */
export function openDuelOpponentPopup(scene: Phaser.Scene, popups: PopupLayer, status: DuelStatusResponse, handlers: DuelOpponentPopupHandlers): void {
  const count = status.opponents.length;
  const height = duelOpponentPopupHeight(count);
  popups.open({ width: P.width, height, title: t("duel.opponents.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: true, backButton: true }, (body, close) => {
    status.opponents.forEach((opponent, index) => paintRow(scene, body, status, opponent, duelOpponentRowY(index, count), () => { close(); handlers.onChallenge(opponent); }));
    const refreshPrice = status.nextRefreshPrice;
    body.add(new Button(scene, 0, height / 2 - P.bottomRoom / 2 - 6, {
      width: P.refresh.width, height: P.refresh.height, fontSize: 28,
      label: refreshPrice === 0 ? t("duel.refresh.free") : t("duel.refresh.title"),
      cost: refreshPrice === 0 ? undefined : { icon: CURRENCY_ICON_BY_WALLET.gems, amount: refreshPrice },
      onClick: () => handlers.onRefresh(close),
    }));
  });
}

function paintRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, status: DuelStatusResponse, opponent: DuelOpponentDto, y: number, onChallenge: () => void): void {
  const tone = DUEL_TIER_COLOR[opponent.tierId];
  body.add(drawLayer(scene, 0, y, chipPoints(P.rowWidth, P.rowHeight), { fill: 0x171d25, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: 0.55 }));
  // 얼굴과 그 아래 점수 — 드러나 있는 렐릭 중 가장 아끼는 얼굴이다(가린 칸은 서버가 이미 비켜 준다).
  body.add(new FaceFrame(scene, P.faceX, y - 18, { portraitAssetId: getRelic(opponent.favoriteRelicId).portraitAssetId, size: P.faceSize, color: tone.fill }));
  body.add(scene.add.text(P.faceX, y + P.faceSize / 2 + 2, opponent.score.toLocaleString(), textStyle({ role: "display", size: 26, color: tone.text })).setOrigin(0.5, 0).setStroke("#05070a", 5));

  body.add(squeezeTextToWidth(scene.add.text(P.textX, y - 62, opponent.displayName, textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0.5), P.textRoom));
  addDuelTierEmblem(scene, body, P.textX + 20, y - 8, 40, opponent.tierId);
  const tierName = `${t(`duel.tier.${opponent.tierId}`)} ${duelDivisionNumeral(opponent.division)}`.trim();
  body.add(scene.add.text(P.textX + 50, y - 8, tierName, textStyle({ role: "emphasis", size: 24, color: tone.text })).setOrigin(0, 0.5));
  body.add(scene.add.text(P.textX, y + 40, t("duel.power", { power: opponent.totalPower.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));

  opponent.units.forEach((unit, index) => {
    const x = P.unitX + index * P.unitGap;
    if (unit.relicId) body.add(new FaceFrame(scene, x, y - 20, { portraitAssetId: getRelic(unit.relicId).portraitAssetId, size: P.unitSize, color: tone.fill }));
    else {
      body.add(addItemFrame(scene, x, y - 20, P.unitSize, { color: COLOR.inkDimHex }));
      body.add(scene.add.text(x, y - 20, "?", textStyle({ role: "display", size: 52, color: COLOR.inkDim })).setOrigin(0.5));
    }
    body.add(scene.add.text(x, y + P.unitSize / 2 - 14, `LV.${unit.level}`, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5, 0));
  });

  body.add(new Button(scene, P.challengeX, y, {
    width: P.challengeWidth, height: P.challengeHeight, label: t("duel.challenge"), fontSize: 32, variant: "primary",
    onClick: onChallenge,
  }).setEnabled(status.attemptsLeft > 0));
}
