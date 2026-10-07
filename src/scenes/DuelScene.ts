import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type DuelStatusResponse } from "../api/contracts";
import { DUEL_DAILY_ATTEMPTS, DUEL_DIVISION_SPAN, DUEL_TIERS, duelDivisionNumeral, duelStanding } from "../core/duelArena";
import { findItem } from "../data/items";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { spawnPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addCategoryTab } from "../ui/CategoryTab";
import { openCurrencyGuide, openItemGuide } from "../ui/currencyGuideEntry";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { paintDuelHistory } from "../ui/DuelHistoryList";
import { openDuelOpponentPopup } from "../ui/DuelOpponentPopup";
import { DuelRankingPopup } from "../ui/DuelRankingPopup";
import { addDuelTierEmblem } from "../ui/DuelTierEmblem";
import { DUEL_SCREEN as S, DUEL_TIER_COLOR, duelTabX } from "../ui/duelLayout";
import { FaceFrame } from "../ui/FaceFrame";
import { chipPoints, drawLayer, drawVignette, HoloBar } from "../ui/holo";
import { addBackButton } from "../ui/IconButton";
import { PopupLayer } from "../ui/PopupLayer";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { RailButton } from "../ui/RailButton";
import { openRewardPopup } from "../ui/RewardPopup";
import { currencyRecordToRewardItems } from "../ui/rewardPopupModel";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
import { addSdFootShadow } from "../ui/SdFootShadow";
import { addSideShopButton } from "../ui/sideShop";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { getRelic } from "../data/relics";
import { LOBBY_RETURN } from "./lobbyEntry";

/** 두 갈래. 씬 하나 안에서 판만 갈아 끼운다(가방·고고학과 같은 좌하단 라벨). */
type DuelTab = "battle" | "history";
const TABS: ReadonlyArray<{ key: DuelTab; labelKey: TextKey }> = [
  { key: "battle", labelKey: "duel.tab.battle" },
  { key: "history", labelKey: "duel.tab.history" },
];
/** 결투 도전권 — 하루 다섯 장이 채워지는 몫의 그림이다(발굴권과 같은 방식, 전용 원화는 자리표시). */
const DUEL_TICKET_ICON = "item-duel-ticket";

/**
 * 결투장 — 3대3 자동전투 방어전.
 *
 * 「대전」 탭은 **내 자리를 보여 주는 무대**다: 티어 휘장과 점수 게이지, 애착 렐릭, 그 아래 도전권 줄과
 * 방어·도전 두 조작. 상대는 [도전]이 여는 창이, 순위는 왼쪽 칩이 연다. 「전적」 탭은 최근 판의 목록이다.
 * 싸움은 공용 편성 화면(`PartyScene`의 `duel`)과 전투 씬이 맡고, 점수·도전권·상대는 전부 서버
 * (`getDuelStatus`)가 정한다 — 화면이 점수를 셈하거나 상대를 고르지 않는다.
 */
export class DuelScene extends Phaser.Scene {
  private popups!: PopupLayer;
  private view!: Phaser.GameObjects.Container;
  private stage!: Phaser.GameObjects.Container;
  private tabRow!: Phaser.GameObjects.Container;
  private tab: DuelTab = "battle";
  private status?: DuelStatusResponse;
  private busy = false;

  constructor() {
    super("duel");
  }

  create(): void {
    setDebugScene("duel");
    this.busy = false;
    this.tab = "battle";
    this.status = undefined;
    addSceneBackground(this, BACKGROUND.sortieDuel);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.42).setDepth(-25);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.7 });
    this.popups = new PopupLayer(this, 2000);
    // 무대(애착 렐릭)는 상태를 다시 그려도 그대로 선다 — 도전권 하나 샀다고 SD가 빠졌다 들어오면 새로 연 화면처럼 읽힌다.
    this.stage = this.add.container(0, 0);
    this.view = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    new TopBar(this, 40, { profile: false, currencies: "duel", onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency) });
    this.add.text(S.side, S.title.y, t("lobby.duel"), textStyle({ role: "display", size: 54, color: COLOR.ink })).setOrigin(0, 0.5)
      .setShadow(0, 4, "#05070a", 6, false, true);
    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.duel));
    this.paintTabs();
    this.paintStage();
    void this.fetchStatus();
    playSceneEntrance(this);
  }

  private async fetchStatus(): Promise<void> {
    try {
      const status = await gameApi.getDuelStatus();
      if (this.scene.isActive()) this.paint(status);
    } catch {
      if (!this.scene.isActive()) return;
      this.view.removeAll(true);
      this.view.add(new Button(this, BASE_WIDTH / 2, BASE_HEIGHT / 2, { width: 360, height: 90, label: t("battle.result.retry"), onClick: () => void this.fetchStatus() }));
    }
  }

  /** 서버가 준 상태 한 장으로 지금 탭을 다시 그린다. 화면에 따로 기억하는 값은 그 상태뿐이다. */
  private paint(status: DuelStatusResponse): void {
    this.status = status;
    setDebugScene("duel", `${status.tierId}:${status.score}:${this.tab}`);
    this.view.removeAll(true);
    this.stage.setVisible(this.tab === "battle");
    if (this.tab === "battle") this.paintBattle(status);
    else paintDuelHistory(this, this.view, status.history, Date.parse(status.serverTime));
  }

  /** 좌하단 라벨 두 장. 다시 그리기 전에 옛 라벨을 지운다(남기면 누를 때마다 한 겹씩 쌓인다). */
  private paintTabs(): void {
    this.tabRow.removeAll(true);
    TABS.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, this.tabRow, {
        x: duelTabX(index), y: S.tabs.y, width: S.tabs.width, height: S.tabs.height,
        label: t(labelKey), selected: this.tab === key,
        onSelect: () => {
          if (this.tab === key) return;
          const from = TABS.findIndex((tab) => tab.key === this.tab);
          this.tab = key;
          this.paintTabs();
          if (this.status) this.paint(this.status);
          slideTabPage(this, [this.view, this.stage], from, index);
        },
      });
    });
  }

  /* ── 대전 ─────────────────────────────────────────────────────────────── */

  private paintBattle(status: DuelStatusResponse): void {
    const view = this.view;
    const days = Math.max(0, (Date.parse(status.seasonEndsAt) - Date.parse(status.serverTime)) / 86_400_000);
    view.add(this.add.text(S.side, S.season.y, t("duel.season.endsIn", { days: Math.floor(days), hours: Math.floor((days % 1) * 24) }), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
    this.paintSideChips(status);
    this.paintStanding(status);
    view.add(this.add.text(S.stage.x, S.record.y, t("duel.record", { wins: status.wins, losses: status.losses }), textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 6));
    if (status.pendingSeasonReward) {
      view.add(new Button(this, S.stage.x, S.seasonReward.y, {
        width: S.seasonReward.width, height: S.seasonReward.height, label: t("duel.seasonReward.claim"), fontSize: 26, variant: "primary",
        onClick: () => void this.claimSeasonReward(),
      }));
    }
    this.paintTicket(status);
    this.paintDefense(status);
    this.paintChallenge(status);
  }

  /** 왼쪽 칩 둘 — 순위(누르면 순위표, 그 안에서 티어 안내)와 결투 상점. */
  private paintSideChips(status: DuelStatusResponse): void {
    const { rankChip, shopChip } = S;
    this.view.add(new RailButton(this, rankChip.x, rankChip.y, {
      icon: "arena-tier", label: t("duel.link.ranking"), size: rankChip.size,
      onClick: () => new DuelRankingPopup(this, this.popups, status.tierId).open(),
    }));
    const rank = status.rank === null ? t("duel.rank.none") : t("duel.rank.value", { rank: status.rank.toLocaleString() });
    this.view.add(this.add.text(rankChip.x + rankChip.size / 2 + 18, rankChip.y, rank, textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0, 0.5).setStroke("#05070a", 6));
    this.view.add(addSideShopButton(this, shopChip.x, shopChip.y, shopChip.size, t("shop.duel.title"),
      () => startScene(this, "shop", { storefront: "duel", returnScene: "duel" })));
  }

  /** 가운데 위 — 티어 휘장, 티어·단계, 다음 단계까지의 점수 게이지와 그 끝의 다음 휘장. */
  private paintStanding(status: DuelStatusResponse): void {
    const { emblem, tierName, gauge } = S;
    const tone = DUEL_TIER_COLOR[status.tierId];
    // 휘장 뒤에 판을 깔지 않는다 — 휘장이 제 빛무리를 이미 두른다.
    addDuelTierEmblem(this, this.view, emblem.x, emblem.y, emblem.size, status.tierId, status.division);
    const name = `${t(`duel.tier.${status.tierId}`)} ${duelDivisionNumeral(status.division)}`.trim();
    this.view.add(this.add.text(emblem.x, tierName.y, name, textStyle({ role: "display", size: 46, color: tone.text })).setOrigin(0.5).setShadow(0, 4, "#05070a", 6, false, true));

    const standing = duelStanding(status.score);
    const tierIndex = DUEL_TIERS.indexOf(standing.tier);
    const top = tierIndex === DUEL_TIERS.length - 1;
    const nextFloor = standing.division !== null
      ? standing.tier.floor + (standing.tier.divisions - standing.division + 1) * DUEL_DIVISION_SPAN
      : DUEL_TIERS[tierIndex + 1]?.floor ?? status.score;
    const bar = new HoloBar(this, emblem.x - 30, gauge.y, gauge.width, gauge.height, { color: tone.fill, outline: true, ticks: 3, trackAlpha: 0.82, shadow: {} });
    bar.addTo(this.view);
    bar.setValue(top ? 1 : standing.progress);
    const label = top ? t("duel.gauge.max") : `${status.score.toLocaleString()} / ${nextFloor.toLocaleString()}`;
    this.view.add(this.add.text(emblem.x - 30, gauge.y, label, textStyle({ role: "display", size: 24, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 5));
    if (!top) {
      const next = duelStanding(nextFloor);
      addDuelTierEmblem(this, this.view, emblem.x - 30 + gauge.width / 2 + 16 + gauge.nextSize / 2, gauge.y, gauge.nextSize, next.tier.id, next.division);
    }
  }

  /** 애착 렐릭이 투영 바닥 위에서 숨 쉰다. 씬이 사는 동안 한 번만 세운다. */
  private paintStage(): void {
    const { x, groundY, height, shadow } = S.stage;
    addSdFootShadow(this, x, groundY, shadow, this.stage);
    const relicId = session.favorite;
    if (!relicId) return;
    void spawnPuppet(this, relicAppearanceManager.sdAssetFor(relicId), { x, groundY, height, depth: 0 }).then((puppet) => {
      if (!this.stage.active) { puppet.destroy(); return; }
      puppet.setAlpha(0);
      this.stage.add(puppet);
      this.tweens.add({ targets: puppet, alpha: 1, duration: 260 });
    }).catch(() => undefined);
  }

  /** 도전권 줄 — 입장권 그림(누르면 안내창)·이름·남은 수, 오른쪽 끝에 젬으로 한 장 더. */
  private paintTicket(status: DuelStatusResponse): void {
    const { y, icon, buyX, buyWidth, buyHeight } = S.ticket;
    const iconX = S.side + icon / 2 + 4;
    const holder = this.add.container(iconX, y, [this.add.image(0, 0, DUEL_TICKET_ICON).setDisplaySize(icon, icon)]);
    const ticket = findItem("duel-ticket");
    if (ticket) {
      const hit = this.add.rectangle(0, 0, icon + 24, icon + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(holder));
      hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(holder); openItemGuide({ scene: this, popups: this.popups }, ticket); });
      holder.add(hit);
    }
    this.view.add(holder);
    const textX = iconX + icon / 2 + 16;
    this.view.add(this.add.text(textX, y - 16, t("duel.ticket.label"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
    this.view.add(this.add.text(textX, y + 18, `${status.attemptsLeft}/${DUEL_DAILY_ATTEMPTS}`, textStyle({ role: "display", size: 34, color: status.attemptsLeft > 0 ? COLOR.accentText : COLOR.dangerText })).setOrigin(0, 0.5));

    const price = status.nextAttemptPrice;
    this.view.add(new Button(this, buyX, y, {
      width: buyWidth, height: buyHeight, fontSize: 24,
      label: price === null ? t("duel.attempts.soldOut") : t("duel.attempts.buyTitle"),
      cost: price === null ? undefined : { icon: CURRENCY_ICON_BY_WALLET.gems, amount: price, affordable: session.wallet.gems >= price },
      onClick: () => {
        if (price === null) return;
        this.popups.confirm({
          title: t("duel.attempts.buyTitle"), message: t("duel.attempts.buyMessage"), confirmLabel: t("duel.attempts.buyTitle"),
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: price }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - price },
        }, () => void this.run(() => gameApi.buyDuelAttempt()));
      },
    }).setEnabled(price !== null));
  }

  /** 왼쪽 아래 [방어] — 게시한 방어덱 셋의 얼굴이 판 안에 서고, 누르면 방어덱 편성으로 간다. */
  private paintDefense(status: DuelStatusResponse): void {
    const { y, height, defense, faceSize, faceGap } = S.actions;
    const x = defense.x + defense.width / 2;
    const panel = this.add.container(x, y);
    this.view.add(panel);
    const empty = status.defense.length === 0;
    panel.add(drawLayer(this, 0, 0, chipPoints(defense.width, height), { fill: 0x141b24, alpha: 0.94, edge: empty ? COLOR.danger : COLOR.accent, edgeAlpha: 0.75 }));
    for (let index = 0; index < 3; index += 1) {
      const relicId = status.defense[index];
      const fx = (index - 1) * faceGap;
      if (relicId) panel.add(new FaceFrame(this, fx, -22, { portraitAssetId: getRelic(relicId).portraitAssetId, size: faceSize }));
      else panel.add(drawLayer(this, fx, -22, chipPoints(faceSize, faceSize), { fill: 0x05070a, alpha: 0.6, shadow: false }));
    }
    panel.add(this.add.text(0, height / 2 - 28, t("duel.defense.label"), textStyle({ role: "display", size: 32, color: empty ? COLOR.dangerText : COLOR.ink })).setOrigin(0.5));
    const hit = this.add.rectangle(0, 0, defense.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(panel));
    hit.on("pointerout", () => pressOut(panel, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(panel);
      if (this.busy) return;
      startScene(this, "party", { content: "duelDefense", defense: status.defense, blindChoice: status.blindChoice });
    });
    panel.add(hit);
  }

  /** 오른쪽 아래 [도전] — 이 화면의 주 조작. 상대 선택 창을 연다. */
  private paintChallenge(status: DuelStatusResponse): void {
    const { y, height, challenge } = S.actions;
    this.view.add(new Button(this, challenge.x + challenge.width / 2, y, {
      width: challenge.width, height, label: t("duel.challenge"), fontSize: 52, variant: "primary", decorDots: true, art: DUEL_TICKET_ICON,
      onClick: () => this.openOpponents(),
    }).setEnabled(status.opponents.length > 0));
  }

  private openOpponents(): void {
    const status = this.status;
    if (!status || this.busy) return;
    openDuelOpponentPopup(this, this.popups, status, {
      onChallenge: (opponent) => startScene(this, "party", { content: "duel", opponent, attack: status.attack }),
      onRefresh: (close) => {
        const price = status.nextRefreshPrice;
        // 옛 창을 닫고 새 상태로 같은 창을 다시 연다 — 같은 제목이라 갈아 끼우기로 읽힌다.
        const refresh = (): void => { close(); void this.run(() => gameApi.refreshDuelOpponents(), () => this.openOpponents()); };
        if (price === 0) { refresh(); return; }
        this.popups.confirm({
          title: t("duel.refresh.title"), message: t("duel.refresh.message"), confirmLabel: t("duel.refresh.title"),
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: price }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - price },
        }, refresh);
      },
    });
  }

  /** 상태를 바꾸는 조작 하나. 응답이 곧 새 상태이므로 그대로 다시 그린다. */
  private async run(action: () => Promise<DuelStatusResponse>, after?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const status = await action();
      if (!this.scene.isActive()) return;
      this.paint(status);
      this.busy = false;
      after?.();
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
