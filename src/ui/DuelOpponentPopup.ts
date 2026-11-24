import Phaser from "phaser";
import { t } from "../i18n";
import type { DuelOpponentDto, DuelStatusResponse } from "../api/contracts";
import { DUEL_FREE_REFRESHES, duelDailyResetAt, duelDivisionNumeral } from "../core/duelArena";
import { formatCountdown } from "../core/formatCountdown";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { getRelic } from "../data/relics";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_OPPONENT_POPUP as P, DUEL_TIER_COLOR, duelOpponentPopupHeight, duelOpponentRefreshY, duelOpponentResetY, duelOpponentRowY } from "./duelLayout";
import { drawGlyph } from "./glyphs";
import { FaceFrame } from "./FaceFrame";
import { addRankingFace } from "./rankingFace";
import { addPlayerProfileTap, duelOpponentProfileTarget } from "./PlayerProfileLink";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addItemFrame } from "./itemFrame";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface DuelOpponentPopupHandlers {
  /** 줄의 도전. 공격덱 편성 화면으로 간다 — 도전권은 거기서 전투를 시작할 때 쓴다. */
  onChallenge: (opponent: DuelOpponentDto) => void;
  /**
   * 상대 새로고침. 값이 드는 판이면 부른 쪽이 먼저 묻고, 실제로 서버에 요청하는 순간 `begin`에 그 약속을 넘긴다 —
   * 창은 닫히지 않고 그 자리에서 지금 줄을 걷고 새 줄을 쌓는다. 약속이 `null`로 끝나면(거절·실패) 옛 줄을 다시 쌓는다.
   */
  onRefresh: (price: number, begin: (pending: Promise<DuelStatusResponse | null>) => void) => void;
}

/**
 * 상대 선택 — 결투장 무대의 [도전]이 여는 창.
 *
 * 줄 하나가 상대 하나이고, 왼쪽의 얼굴(그 상대의 애착 렐릭)과 이름·티어 옆의 점수가 "누구인가"를, 가운데의
 * 방어덱 셋이 "무엇과 붙나"를 말한다. 가려진 칸은 `?` 액자다. 이기고 지면 얼마나 오르내리는지는
 * 적지 않는다 — 고르는 근거는 상대의 점수·티어·덱이고, 증감까지 서면 늘 가장 많이 오르는 줄만 누르게 된다.
 * 이미 싸운 상대는 줄이 가라앉고 도전 자리에 「대전 완료」가 선다. 다섯 모두와 싸우거나 티어가 오르면 새 상대가 선다.
 *
 * **새로고침은 창을 닫지 않는다.** 누르면 아이콘이 돌고 지금 줄들이 아래 줄부터 걷히며, 새 명단이 오면 위 줄부터
 * 한 줄씩 떠올라 쌓인다. 창을 처음 열 때도 같은 쌓임으로 선다. 버튼 아래 회색 한 줄은 무료 횟수가 처음으로
 * 돌아가는 시각(서버 UTC 자정)까지 남은 시간이다.
 */
export function openDuelOpponentPopup(scene: Phaser.Scene, popups: PopupLayer, status: DuelStatusResponse, handlers: DuelOpponentPopupHandlers): void {
  const count = status.opponents.length;
  const height = duelOpponentPopupHeight(count);
  const R = P.refresh;
  const motion = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  popups.open({ width: P.width, height, title: t("duel.opponents.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: true, backButton: true }, (body, close) => {
    let current = status;
    let busy = false;
    let rows: Phaser.GameObjects.Container[] = [];
    let refreshButton: Button | undefined;
    let refreshIcon: Phaser.GameObjects.Image | undefined;
    let spin: Phaser.Tweens.Tween | undefined;

    const paintRows = (next: DuelStatusResponse): void => {
      rows = next.opponents.map((opponent, index) => {
        const row = scene.add.container(0, 0);
        body.add(row);
        paintRow(scene, popups, row, next, opponent, duelOpponentRowY(index, count), () => { close(); handlers.onChallenge(opponent); });
        return row;
      });
      stackIn(scene, rows, motion);
    };

    const paintButton = (next: DuelStatusResponse): void => {
      refreshButton?.destroy();
      const price = next.nextRefreshPrice;
      const button = new Button(scene, 0, duelOpponentRefreshY(count), {
        width: R.width, height: R.height, fontSize: R.fontSize,
        // 무료분은 남은 수를 `3/3`으로 말하고, 다 쓰면 그 자리에 오늘 다음 한 번의 젬 값이 선다.
        label: price === 0 ? t("duel.refresh.free", { left: next.freeRefreshesLeft, limit: DUEL_FREE_REFRESHES }) : t("duel.refresh.title"),
        cost: price === 0 ? undefined : { icon: CURRENCY_ICON_BY_WALLET.gems, amount: price },
        onClick: () => {
          if (busy) return;
          handlers.onRefresh(price, (pending) => void runRefresh(pending));
        },
      });
      // 라벨(과 값)은 판 가운데에 그대로 두고, 아이콘은 판 안 왼쪽 끝 마름모 받침 위에 선다.
      const iconX = -R.width / 2 + R.iconInset;
      button.add(drawLayer(scene, iconX, 0, chipPoints(R.iconSize * 1.32, R.iconSize * 1.32, { bevel: { topLeft: R.iconSize * 0.3, bottomRight: R.iconSize * 0.3 } }), { fill: 0x0b1017, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.7 }));
      refreshIcon = drawGlyph(scene, "refresh", iconX, 0, R.iconSize, COLOR.accent, 1, Math.max(4, R.iconSize * 0.1));
      button.add(refreshIcon);
      body.add(button);
      refreshButton = button;
    };

    const runRefresh = async (pending: Promise<DuelStatusResponse | null>): Promise<void> => {
      if (busy) return;
      busy = true;
      refreshButton?.setEnabled(false);
      if (refreshIcon && motion) spin = scene.tweens.add({ targets: refreshIcon, angle: 360, duration: 620, repeat: -1, ease: "Linear" });
      const leaving = rows;
      rows = [];
      const [next] = await Promise.all([pending.catch(() => null), stackOut(scene, leaving, motion)]);
      if (!body.active) return;
      leaving.forEach((row) => row.destroy());
      spin?.stop();
      spin = undefined;
      busy = false;
      // 다른 수의 명단이 오면 창 높이가 달라지므로 같은 창을 새로 연다(갈아 끼우기로 읽힌다).
      if (next && next.opponents.length !== count) { close(); openDuelOpponentPopup(scene, popups, next, handlers); return; }
      if (next) current = next;
      paintRows(current);
      paintButton(current);
      paintReset();
    };

    // 초기화 시계 — 서버 시각 기준으로 다음 UTC 자정까지. 기기 시계가 어긋나도 서버가 말한 시각에서 센다.
    const clockOffset = Number.isFinite(Date.parse(status.serverTime)) ? Date.parse(status.serverTime) - Date.now() : 0;
    const resetText = scene.add.text(0, duelOpponentResetY(count), "", textStyle({ role: "body", size: R.resetSize, color: COLOR.inkDim })).setOrigin(0.5);
    body.add(resetText);
    const paintReset = (): void => {
      const now = new Date(Date.now() + clockOffset);
      resetText.setText(t("duel.refresh.reset", { time: formatCountdown(duelDailyResetAt(now).getTime() - now.getTime()) }));
    };
    paintReset();
    const ticker = scene.time.addEvent({ delay: 1000, loop: true, callback: () => { if (resetText.active) paintReset(); } });
    body.once(Phaser.GameObjects.Events.DESTROY, () => { ticker.remove(); spin?.stop(); });

    paintRows(current);
    paintButton(current);
  });
}

/** 줄들이 위 줄부터 한 줄씩 아래에서 떠올라 제자리에 앉는다. 움직임 줄이기에서는 곧바로 선다. */
function stackIn(scene: Phaser.Scene, rows: readonly Phaser.GameObjects.Container[], motion: boolean): void {
  const S = P.stack;
  if (!motion) return;
  rows.forEach((row, index) => {
    row.setAlpha(0).setY(S.rise);
    scene.tweens.add({ targets: row, alpha: 1, y: 0, delay: index * S.stagger, duration: S.duration, ease: "Cubic.Out" });
  });
}

function disableButtons(container: Phaser.GameObjects.Container): void {
  container.each((child: Phaser.GameObjects.GameObject) => {
    if (child instanceof Button) child.setEnabled(false);
    else if (child instanceof Phaser.GameObjects.Container) disableButtons(child);
  });
}

/** 지금 줄들이 아래 줄부터 왼쪽으로 밀리며 걷힌다. 다 걷히면 풀린다. */
function stackOut(scene: Phaser.Scene, rows: readonly Phaser.GameObjects.Container[], motion: boolean): Promise<void> {
  const S = P.stack;
  if (!motion || rows.length === 0) { rows.forEach((row) => row.setVisible(false)); return Promise.resolve(); }
  return new Promise((resolve) => {
    let left = rows.length;
    rows.forEach((row, index) => {
      // 걷히는 줄의 도전 버튼이 그 사이 눌리지 않게 입력부터 내린다.
      disableButtons(row);
      scene.tweens.add({
        targets: row, alpha: 0, x: -S.outShift, delay: (rows.length - 1 - index) * S.outStagger, duration: S.outDuration, ease: "Cubic.In",
        onComplete: () => { left -= 1; if (left === 0) resolve(); },
      });
    });
  });
}

function paintRow(scene: Phaser.Scene, popups: PopupLayer, popupBody: Phaser.GameObjects.Container, status: DuelStatusResponse, opponent: DuelOpponentDto, y: number, onChallenge: () => void): void {
  // 줄 하나를 한 덩어리로 담아, 싸운 상대는 덩어리째 가라앉힌다.
  const body = scene.add.container(0, 0);
  popupBody.add(body);
  const tone = DUEL_TIER_COLOR[opponent.tierId];
  body.add(drawLayer(scene, 0, y, chipPoints(P.rowWidth, P.rowHeight), { fill: 0x171d25, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: 0.55 }));
  // 얼굴 — 그 사람의 프로필(사진 + 테두리). 사진이 가린 방어 칸이면 서버가 비워 드러난 렐릭 얼굴로 선다.
  // 얼굴을 누르면 그 사람의 플레이어 카드가 이 창 위에 겹쳐 뜬다 — 가려진 칸은 카드에서도 드러나지 않는다.
  const face = scene.add.container(P.faceX, y);
  body.add(face);
  addPlayerProfileTap(scene, face, P.avatarSize + 36, P.avatarSize + 36, popups, duelOpponentProfileTarget(opponent));
  addRankingFace(scene, face, opponent, opponent.displayName, { x: 0, y: 0, size: P.avatarSize });

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
