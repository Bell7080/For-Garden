import Phaser from "phaser";
import { t } from "../i18n";
import type { DuelOpponentDto, DuelStatusResponse } from "../api/contracts";
import { DUEL_FREE_REFRESHES, duelDivisionNumeral } from "../core/duelArena";
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
 * 줄 하나가 상대 하나이고, 왼쪽의 얼굴(그 상대의 애착 렐릭)과 이름·티어 옆의 점수가 "누구인가"를, 가운데의
 * 방어덱 셋이 "무엇과 붙나"를 말한다. 가려진 칸은 `?` 액자다. 이기고 지면 얼마나 오르내리는지는
 * 적지 않는다 — 고르는 근거는 상대의 점수·티어·덱이고, 증감까지 서면 늘 가장 많이 오르는 줄만 누르게 된다.
 * 이미 싸운 상대는 줄이 가라앉고 도전 자리에 「대전 완료」가 선다. 다섯 모두와 싸우거나 티어가 오르면 새 상대가 선다.
 */
export function openDuelOpponentPopup(scene: Phaser.Scene, popups: PopupLayer, status: DuelStatusResponse, handlers: DuelOpponentPopupHandlers): void {
  const count = status.opponents.length;
  const height = duelOpponentPopupHeight(count);
  popups.open({ width: P.width, height, title: t("duel.opponents.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: true, backButton: true }, (body, close) => {
    status.opponents.forEach((opponent, index) => paintRow(scene, body, status, opponent, duelOpponentRowY(index, count), () => { close(); handlers.onChallenge(opponent); }));
    const refreshPrice = status.nextRefreshPrice;
    body.add(new Button(scene, 0, height / 2 - P.bottomRoom / 2 - 6, {
      width: P.refresh.width, height: P.refresh.height, fontSize: 28,
      // 무료분은 남은 수를 `3/3`으로 말하고, 다 쓰면 그 자리에 오늘 다음 한 번의 젬 값이 선다.
      label: refreshPrice === 0 ? t("duel.refresh.free", { left: status.freeRefreshesLeft, limit: DUEL_FREE_REFRESHES }) : t("duel.refresh.title"),
      cost: refreshPrice === 0 ? undefined : { icon: CURRENCY_ICON_BY_WALLET.gems, amount: refreshPrice },
      onClick: () => handlers.onRefresh(close),
    }));
  });
}

function paintRow(scene: Phaser.Scene, popupBody: Phaser.GameObjects.Container, status: DuelStatusResponse, opponent: DuelOpponentDto, y: number, onChallenge: () => void): void {
  // 줄 하나를 한 덩어리로 담아, 싸운 상대는 덩어리째 가라앉힌다.
  const body = scene.add.container(0, 0);
  popupBody.add(body);
  const tone = DUEL_TIER_COLOR[opponent.tierId];
  body.add(drawLayer(scene, 0, y, chipPoints(P.rowWidth, P.rowHeight), { fill: 0x171d25, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: 0.55 }));
  // 얼굴 — 드러나 있는 렐릭 중 가장 아끼는 얼굴이다(가린 칸은 서버가 이미 비켜 준다).
  body.add(new FaceFrame(scene, P.faceX, y, { portraitAssetId: getRelic(opponent.favoriteRelicId).portraitAssetId, size: P.faceSize, color: tone.fill }));

  body.add(squeezeTextToWidth(scene.add.text(P.textX, y - 62, opponent.displayName, textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0.5), P.textRoom));
  addDuelTierEmblem(scene, body, P.textX + 20, y - 8, 40, opponent.tierId);
  const tierName = `${t(`duel.tier.${opponent.tierId}`)} ${duelDivisionNumeral(opponent.division)}`.trim();
  // 점수는 티어 바로 옆 — 같은 티어 안에서 얼마나 위인지를 한 줄로 읽는다.
  const tierLine = scene.add.text(P.textX + 50, y - 8, `${tierName}  ${t("duel.score", { score: opponent.score.toLocaleString() })}`, textStyle({ role: "emphasis", size: 24, color: tone.text })).setOrigin(0, 0.5);
  body.add(squeezeTextToWidth(tierLine, P.textRoom - 50));
  body.add(scene.add.text(P.textX, y + 40, t("duel.power", { power: opponent.totalPower.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));

  opponent.units.forEach((unit, index) => {
    const x = P.unitX + index * P.unitGap;
    if (unit.relicId) body.add(new FaceFrame(scene, x, y - 20, { portraitAssetId: getRelic(unit.relicId).portraitAssetId, size: P.unitSize, color: tone.fill }));
    else {
      body.add(addItemFrame(scene, x, y - 20, P.unitSize, { color: COLOR.inkDimHex }));
      body.add(scene.add.text(x, y - 20, "?", textStyle({ role: "display", size: 52, color: COLOR.inkDim })).setOrigin(0.5));
    }
    // 가려진 칸은 레벨도 말하지 않는다 — 레벨이 서면 그 칸이 누구인지 좁혀진다.
    if (unit.relicId) body.add(scene.add.text(x, y + P.unitSize / 2 - 14, `LV.${unit.level}`, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5, 0));
  });

  if (opponent.fought) {
    body.setAlpha(0.42);
    popupBody.add(scene.add.text(P.challengeX, y, t("duel.fought"), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
    return;
  }
  body.add(new Button(scene, P.challengeX, y, {
    width: P.challengeWidth, height: P.challengeHeight, label: t("duel.challenge"), fontSize: 32, variant: "primary",
    onClick: onChallenge,
  }).setEnabled(status.attemptsLeft > 0));
}
