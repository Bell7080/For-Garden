import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type DuelOpponentDto, type DuelStatusResponse } from "../api/contracts";
import { duelDivisionNumeral } from "../core/duelArena";
import { getRelic } from "../data/relics";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addDuelTierEmblem } from "../ui/DuelTierEmblem";
import { DuelRankingPopup } from "../ui/DuelRankingPopup";
import { openDuelHistoryPopup, openDuelTierGuide } from "../ui/DuelGuidePopups";
import { DUEL_SCREEN, DUEL_TIER_COLOR, duelOpponentY } from "../ui/duelLayout";
import { FaceFrame } from "../ui/FaceFrame";
import { drawLayer, drawVignette, HOLO, slantedRect } from "../ui/holo";
import { addBackButton } from "../ui/IconButton";
import { addItemFrame } from "../ui/itemFrame";
import { PopupLayer } from "../ui/PopupLayer";
import { openRewardPopup } from "../ui/RewardPopup";
import { currencyRecordToRewardItems } from "../ui/rewardPopupModel";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { openCurrencyGuide } from "../ui/currencyGuideEntry";
import { LOBBY_RETURN } from "./lobbyEntry";

const S = DUEL_SCREEN;

/**
 * 결투장 — 3대3 자동전투 방어전.
 *
 * 화면은 **고르는 곳**이다. 싸움은 공용 편성 화면(`PartyScene`의 `duel`)과 전투 씬이 맡고, 점수·도전권·
 * 상대는 전부 서버(`getDuelStatus`)가 정한다 — 화면이 점수를 셈하거나 상대를 고르지 않는다.
 */
export class DuelScene extends Phaser.Scene {
  private popups!: PopupLayer;
  private root?: Phaser.GameObjects.Container;
  private busy = false;

  constructor() {
    super("duel");
  }

  create(): void {
    setDebugScene("duel");
    this.busy = false;
    this.root = undefined;
    addSceneBackground(this, BACKGROUND.sortieDuel);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-25);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.7 });
    this.popups = new PopupLayer(this, 2000);
    new TopBar(this, 40, { profile: false, currencies: "duel", onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency) });
    this.add.text(S.side, S.title.y, t("lobby.duel"), textStyle({ role: "display", size: 54, color: COLOR.ink })).setOrigin(0, 0.5)
      .setShadow(0, 4, "#05070a", 6, false, true);
    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.duel));
    void this.fetchStatus();
    playSceneEntrance(this);
  }

  private async fetchStatus(): Promise<void> {
    try {
      const status = await gameApi.getDuelStatus();
      if (this.scene.isActive()) this.paint(status);
    } catch {
      if (!this.scene.isActive()) return;
      this.resetRoot();
      this.root?.add(new Button(this, BASE_WIDTH / 2, BASE_HEIGHT / 2, { width: 360, height: 90, label: t("battle.result.retry"), onClick: () => void this.fetchStatus() }));
    }
  }

  private resetRoot(): Phaser.GameObjects.Container {
    this.root?.destroy(true);
    this.root = this.add.container(0, 0);
    return this.root;
  }

  /** 서버가 준 상태 한 장을 통째로 다시 그린다. 화면에 따로 기억하는 값은 없다. */
  private paint(status: DuelStatusResponse): void {
    const root = this.resetRoot();
    setDebugScene("duel", `${status.tierId}:${status.score}`);
    const days = Math.max(0, (Date.parse(status.seasonEndsAt) - Date.parse(status.serverTime)) / 86_400_000);
    root.add(this.add.text(S.side, S.season.y, t("duel.season.endsIn", { days: Math.floor(days), hours: Math.floor((days % 1) * 24) }), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
    this.paintStanding(root, status);
    this.paintAttempts(root, status);
    status.opponents.forEach((opponent, index) => this.paintOpponent(root, status, opponent, duelOpponentY(index)));
    this.paintDefense(root, status);
    const links = [
      { label: t("duel.link.ranking"), onClick: () => new DuelRankingPopup(this, this.popups).open() },
      { label: t("duel.link.tiers"), onClick: () => openDuelTierGuide(this, this.popups, status.tierId) },
      { label: t("duel.link.history"), onClick: () => openDuelHistoryPopup(this, this.popups, status.history) },
    ];
    links.forEach((link, index) => root.add(new Button(this, S.links.xs[index], S.links.y, { width: S.links.width, height: S.links.height, label: link.label, fontSize: 28, onClick: link.onClick })));
  }

  /** 내 자리 — 티어 표식, 티어·단계, 점수, 전적·순위. 끝난 시즌의 보상이 남았으면 오른쪽에 받기가 선다. */
  private paintStanding(root: Phaser.GameObjects.Container, status: DuelStatusResponse): void {
    const { y, height, emblemX, emblemSize, textX } = S.standing;
    const tone = DUEL_TIER_COLOR[status.tierId];
    root.add(drawLayer(this, BASE_WIDTH / 2, y, slantedRect(S.width, height), { fill: COLOR.panel, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: 0.8, glow: { color: tone.fill, strength: 0.18 } }));
    addDuelTierEmblem(this, root, emblemX, y, emblemSize, status.tierId, status.division);
    const tierName = `${t(`duel.tier.${status.tierId}`)} ${duelDivisionNumeral(status.division)}`.trim();
    root.add(this.add.text(textX, y - 64, tierName, textStyle({ role: "display", size: 46, color: tone.text })).setOrigin(0, 0.5).setShadow(0, 4, "#05070a", 6, false, true));
    root.add(this.add.text(textX, y - 6, t("duel.score", { score: status.score.toLocaleString() }), textStyle({ role: "emphasis", size: 34, color: COLOR.ink })).setOrigin(0, 0.5));
    const rank = status.rank === null ? t("duel.rank.none") : t("duel.rank.value", { rank: status.rank });
    root.add(this.add.text(textX, y + 46, t("duel.record", { wins: status.wins, losses: status.losses, rank }), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
    if (status.pendingSeasonReward) {
      root.add(new Button(this, S.side + S.width - 150, y + 70, {
        width: 240, height: 72, label: t("duel.seasonReward.claim"), fontSize: 26, variant: "primary",
        onClick: () => void this.claimSeasonReward(),
      }));
    }
  }

  /** 도전권 줄 — 남은 수, 젬으로 한 장 더, 상대 새로고침. */
  private paintAttempts(root: Phaser.GameObjects.Container, status: DuelStatusResponse): void {
    const { y, buyX, refreshX, buttonWidth, buttonHeight } = S.attempts;
    root.add(this.add.text(S.side, y, t("duel.attempts", { left: status.attemptsLeft }), textStyle({ role: "display", size: 34, color: status.attemptsLeft > 0 ? COLOR.ink : COLOR.dangerText })).setOrigin(0, 0.5));
    const buyPrice = status.nextAttemptPrice;
    const buy = new Button(this, buyX, y, {
      width: buttonWidth, height: buttonHeight, fontSize: 24,
      label: buyPrice === null ? t("duel.attempts.soldOut") : t("duel.attempts.buy", { price: buyPrice }),
      onClick: () => {
        if (buyPrice === null) return;
        this.popups.confirm({
          title: t("duel.attempts.buyTitle"), message: t("duel.attempts.buyMessage"), confirmLabel: t("duel.attempts.buyTitle"),
          costs: [{ iconKey: "currency-gems", amount: buyPrice }],
        }, () => void this.run(() => gameApi.buyDuelAttempt()));
      },
    }).setEnabled(buyPrice !== null);
    root.add(buy);
    const refreshPrice = status.nextRefreshPrice;
    root.add(new Button(this, refreshX, y, {
      width: buttonWidth, height: buttonHeight, fontSize: 24,
      label: refreshPrice === 0 ? t("duel.refresh.free") : t("duel.refresh.paid", { price: refreshPrice }),
      onClick: () => {
        if (refreshPrice === 0) { void this.run(() => gameApi.refreshDuelOpponents()); return; }
        this.popups.confirm({
          title: t("duel.refresh.title"), message: t("duel.refresh.message"), confirmLabel: t("duel.refresh.title"),
          costs: [{ iconKey: "currency-gems", amount: refreshPrice }],
        }, () => void this.run(() => gameApi.refreshDuelOpponents()));
      },
    }));
  }

  /**
   * 상대 하나 — 이름·티어·점수·전투력, 이기고 질 때의 점수 변화, 방어덱 셋의 얼굴. 가려진 칸은 `?` 액자다.
   * 도전은 공용 편성 화면을 연다. 도전권은 거기서 전투를 시작할 때 쓴다.
   */
  private paintOpponent(root: Phaser.GameObjects.Container, status: DuelStatusResponse, opponent: DuelOpponentDto, y: number): void {
    const { height, faceSize, faceGap, faceX, challengeX, challengeWidth } = S.opponents;
    const tone = DUEL_TIER_COLOR[opponent.tierId];
    root.add(drawLayer(this, BASE_WIDTH / 2, y, slantedRect(S.width, height), { fill: COLOR.panel, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: 0.6 }));
    const left = S.side + 34;
    root.add(this.add.text(left, y - 66, opponent.displayName, textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0.5));
    const tierName = `${t(`duel.tier.${opponent.tierId}`)} ${duelDivisionNumeral(opponent.division)}`.trim();
    root.add(this.add.text(left, y - 22, `${tierName} · ${t("duel.score", { score: opponent.score.toLocaleString() })}`, textStyle({ role: "emphasis", size: 24, color: tone.text })).setOrigin(0, 0.5));
    root.add(this.add.text(left, y + 18, t("duel.power", { power: opponent.totalPower.toLocaleString() }), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    root.add(this.add.text(left, y + 60, t("duel.delta", { win: `+${opponent.winDelta}`, loss: `${opponent.lossDelta}` }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0.5));
    opponent.units.forEach((unit, index) => {
      const x = faceX + index * faceGap;
      if (unit.relicId) root.add(new FaceFrame(this, x, y - 10, { portraitAssetId: getRelic(unit.relicId).portraitAssetId, size: faceSize, color: tone.fill }));
      else {
        root.add(addItemFrame(this, x, y - 10, faceSize, { color: COLOR.inkDimHex }));
        root.add(this.add.text(x, y - 10, "?", textStyle({ role: "display", size: 60, color: COLOR.inkDim })).setOrigin(0.5));
      }
      root.add(this.add.text(x, y + faceSize / 2 + 8, `LV.${unit.level}`, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5, 0));
    });
    root.add(new Button(this, challengeX, y, {
      width: challengeWidth, height: 96, label: t("duel.challenge"), fontSize: 30, variant: "primary",
      onClick: () => {
        if (this.busy) return;
        startScene(this, "party", { content: "duel", opponent, attack: status.attack });
      },
    }).setEnabled(status.attemptsLeft > 0));
  }

  /** 내 방어덱 — 게시한 셋과 가려지는 순서. 비었으면 편성을 권한다. */
  private paintDefense(root: Phaser.GameObjects.Container, status: DuelStatusResponse): void {
    const { y, height, faceX, editX } = S.defense;
    root.add(drawLayer(this, BASE_WIDTH / 2, y, slantedRect(S.width, height), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
    root.add(this.add.text(S.side + 34, y - 40, t("duel.defense.title"), textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0, 0.5));
    root.add(this.add.text(S.side + 34, y + 12, t("duel.defense.hint"), textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: 300 })).setOrigin(0, 0));
    if (status.defense.length === 0) {
      root.add(this.add.text(faceX + 110, y, t("duel.defense.empty"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    }
    status.defense.forEach((relicId, index) => {
      const x = faceX + index * 116;
      root.add(new FaceFrame(this, x, y - 8, { portraitAssetId: getRelic(relicId).portraitAssetId, size: 100 }));
      const blind = status.defenseBlindOrder.indexOf(relicId);
      if (blind >= 0) root.add(this.add.text(x, y + 54, t("duel.blind.slot", { index: blind + 1 }), textStyle({ role: "emphasis", size: 20, color: COLOR.accentText })).setOrigin(0.5, 0));
    });
    root.add(new Button(this, editX, y, {
      width: 200, height: 86, label: t("duel.defense.edit"), fontSize: 28,
      onClick: () => startScene(this, "party", { content: "duelDefense", defense: status.defense, blindChoice: status.blindChoice }),
    }));
  }

  /** 상태를 바꾸는 조작 하나. 응답이 곧 새 상태이므로 그대로 다시 그린다. */
  private async run(action: () => Promise<DuelStatusResponse>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const status = await action();
      if (this.scene.isActive()) this.paint(status);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.popups.confirm({ title: t("lobby.duel"), message: this.errorMessage(error), confirmLabel: t("duel.ok"), cancelLabel: false });
    } finally {
      this.busy = false;
    }
  }

  private async claimSeasonReward(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const claimed = await gameApi.claimDuelSeasonReward();
      if (!this.scene.isActive()) return;
      openRewardPopup(this, this.popups, { items: currencyRecordToRewardItems({ duelEmblem: claimed.duelEmblem, gems: claimed.gems }), onConfirm: () => void this.fetchStatus() });
    } catch (error) {
      if (this.scene.isActive()) this.popups.confirm({ title: t("lobby.duel"), message: this.errorMessage(error), confirmLabel: t("duel.ok"), cancelLabel: false });
    } finally {
      this.busy = false;
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof GameApiError) {
      if (error.code === "INSUFFICIENT_CURRENCY") return t("duel.error.noGems");
      if (error.code === "DUEL_ATTEMPT_LIMIT") return t("duel.error.attemptLimit");
    }
    return t("partyEntry.failed");
  }
}
