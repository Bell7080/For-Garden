import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type DuelStatusResponse } from "../api/contracts";
import { DUEL_DIVISION_SPAN, DUEL_TIERS, duelDivisionNumeral, duelStanding, type DuelTierId } from "../core/duelArena";
import { playerProfileDisplay, profileAvatarContent } from "../state/playerProfile";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addCategoryTab } from "../ui/CategoryTab";
import { openCurrencyGuide } from "../ui/currencyGuideEntry";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { paintDuelHistory } from "../ui/DuelHistoryList";
import { openDuelOpponentPopup } from "../ui/DuelOpponentPopup";
import { openDuelTicketPopup } from "../ui/DuelTicketPopup";
import { DuelRankingPopup } from "../ui/DuelRankingPopup";
import { addDuelTierEmblem } from "../ui/DuelTierEmblem";
import { DUEL_PROFILE as P, DUEL_SCREEN as S, DUEL_TIER_COLOR, duelProfileRowY, duelTabX } from "../ui/duelLayout";
import { FaceFrame } from "../ui/FaceFrame";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { chipPoints, drawLayer, drawVignette, HoloBar, slantedRect } from "../ui/holo";
import { addSectionTitle } from "../ui/SectionTitle";
import { squeezeTextToWidth } from "../ui/textFit";
import { addBackButton } from "../ui/IconButton";
import { PopupLayer } from "../ui/PopupLayer";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { RailButton } from "../ui/RailButton";
import { openRewardPopup } from "../ui/RewardPopup";
import { currencyRecordToRewardItems } from "../ui/rewardPopupModel";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
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
 * 「대전」 탭은 **내 자리를 보여 주는 무대**다: 티어 휘장과 점수 게이지, 그 아래 **전투 프로필**
 * (이름·레벨·애착 렐릭 카드·현재/시즌 최고/지난 시즌 티어·연승), 맨 아래 방어·도전 두 조작. 오늘 남은 도전권은 상단 줄이 말하고, 누르면 충전 창이 열린다. 상대는 [도전]이 여는 창이, 순위는 왼쪽 칩이 연다. 「전적」 탭은 최근 판의 목록이다.
 * 싸움은 공용 편성 화면(`PartyScene`의 `duel`)과 전투 씬이 맡고, 점수·도전권·상대는 전부 서버
 * (`getDuelStatus`)가 정한다 — 화면이 점수를 셈하거나 상대를 고르지 않는다.
 */
export class DuelScene extends Phaser.Scene {
  private popups!: PopupLayer;
  private view!: Phaser.GameObjects.Container;
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
    this.view = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    // 상단은 휘장과 **오늘 남은 도전권**이다. 도전권 칸을 누르면 젬 구매·광고 충전이 있는 창이 열린다.
    new TopBar(this, 40, {
      profile: false, currencies: "duelArena", onDuelTicket: () => this.openTicketPopup(),
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency),
    });
    this.add.text(S.side, S.title.y, t("lobby.duel"), textStyle({ role: "display", size: 54, color: COLOR.ink })).setOrigin(0, 0.5)
      .setShadow(0, 4, "#05070a", 6, false, true);
    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.duel));
    this.paintTabs();
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
          slideTabPage(this, [this.view], from, index);
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
    this.paintProfile(status);
    if (status.pendingSeasonReward) {
      view.add(new Button(this, BASE_WIDTH / 2, S.seasonReward.y, {
        width: S.seasonReward.width, height: S.seasonReward.height, label: t("duel.seasonReward.claim"), fontSize: 26, variant: "primary",
        onClick: () => void this.claimSeasonReward(),
      }));
    }
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

  /**
   * 가운데 — **전투 프로필**. 누구인가(프로필 사진·테두리 · 이름 · 연구원 레벨 · 전적) → 어디까지 왔나
   * (현재·이번 시즌 최고·지난 시즌 티어, 연승)를 한 판에 모은다. 애착 렐릭 SD 하나만 서 있던 때는 이 화면이
   * 내 자리를 보여 주는 무대인데 정작 내 기록은 휘장 하나뿐이었다.
   *
   * 얼굴·이름·레벨은 프로필 카드와 같은 모델(`playerProfileDisplay`)에서, 티어·연승은 서버 상태에서만 읽는다.
   */
  private paintProfile(status: DuelStatusResponse): void {
    const panel = this.add.container(BASE_WIDTH / 2, P.y);
    this.view.add(panel);
    const halfW = P.width / 2; const halfH = P.height / 2;
    panel.add(drawLayer(this, 0, 0, chipPoints(P.width, P.height), { fill: 0x101720, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.4 }));
    panel.add(addSectionTitle(this, -halfW, -halfH, t("duel.profile.title"), { size: 28 }));

    // 왼쪽 — 플레이어 얼굴. 상단 줄·프로필 카드와 **같은 한 장**(`ProfileAvatar`)이라 사진·테두리를 바꾸면 여기도 함께 바뀐다.
    const profile = playerProfileDisplay(session);
    const avatar = P.avatar;
    panel.add(new ProfileAvatar(this, avatar.x, avatar.y, {
      size: avatar.size, frameId: profile.frameId,
      portraitAssetId: profile.avatar?.portraitAssetId, fallback: profileAvatarContent(profile, () => false).fallback,
    }));
    panel.add(squeezeTextToWidth(this.add.text(avatar.x, avatar.nameY, profile.displayName, textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 5), avatar.nameRoom));
    panel.add(this.add.text(avatar.x, avatar.levelY, `LV.${profile.level}`, textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0.5));
    panel.add(this.add.text(avatar.x, avatar.recordY, t("duel.record", { wins: status.wins, losses: status.losses }), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));

    // 오른쪽 — 티어 셋과 연승. 줄마다 이름표(회색) · 휘장 · 값.
    const division = duelDivisionNumeral(status.division);
    this.paintProfileTier(panel, 0, t("duel.profile.current"), status.tierId, `${t(`duel.tier.${status.tierId}`)} ${division}`.trim(), t("duel.score", { score: status.score.toLocaleString() }));
    this.paintProfileTier(panel, 1, t("duel.profile.seasonBest"), status.seasonBestTierId, t(`duel.tier.${status.seasonBestTierId}`), t("duel.score", { score: status.seasonBestScore.toLocaleString() }));
    this.paintProfileTier(panel, 2, t("duel.profile.lastSeason"), status.lastSeasonTierId, status.lastSeasonTierId ? t(`duel.tier.${status.lastSeasonTierId}`) : t("duel.profile.noRecord"),
      status.lastSeasonTierId && status.lastSeasonScore !== null ? t("duel.score", { score: status.lastSeasonScore.toLocaleString() }) : undefined);

    const y = duelProfileRowY(3);
    panel.add(this.add.rectangle((P.rows.labelX + halfW - P.padX) / 2, y - P.rows.gap / 2, halfW - P.padX - P.rows.labelX, 1, COLOR.panelEdge, 0.35));
    panel.add(this.add.text(P.rows.labelX, y, t("duel.profile.streak"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const streakColor = status.winStreak > 0 ? COLOR.accentText : COLOR.inkDim;
    panel.add(this.add.text(P.rows.emblemX - P.rows.emblemSize / 2, y, t("duel.profile.streakValue", { streak: status.winStreak }), textStyle({ role: "display", size: 34, color: streakColor })).setOrigin(0, 0.5));
    if (status.nextStreakBonus > 0) {
      // 다음 판을 이기면 얹히는 몫. 연승이 이어지는 동안만 서는 칩이다.
      const chip = P.rows.bonusChip;
      const cx = halfW - P.padX - chip.width / 2;
      panel.add(drawLayer(this, cx, y, slantedRect(chip.width, chip.height), { fill: 0x3a2a10, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.9, glow: { color: COLOR.accent, strength: 0.25, height: 0.8 } }));
      panel.add(this.add.text(cx, y, t("duel.profile.streakBonus", { bonus: status.nextStreakBonus }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5));
    } else {
      panel.add(this.add.text(halfW - P.padX, y, t("duel.profile.bestStreak", { streak: status.bestStreak }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5));
    }
  }

  /** 전투 프로필의 티어 한 줄. 티어가 없으면(지난 시즌을 치르지 않았으면) 휘장 없이 흐린 글만 선다. */
  private paintProfileTier(panel: Phaser.GameObjects.Container, index: number, label: string, tierId: DuelTierId | null, value: string, sub?: string): void {
    const { rows } = P;
    const y = duelProfileRowY(index);
    panel.add(this.add.text(rows.labelX, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    if (tierId) addDuelTierEmblem(this, panel, rows.emblemX, y, rows.emblemSize, tierId);
    const color = tierId ? DUEL_TIER_COLOR[tierId].text : COLOR.inkDim;
    const style = tierId ? textStyle({ role: "display", size: 30, color }) : textStyle({ role: "emphasis", size: 24, color });
    panel.add(this.add.text(tierId ? rows.valueX : rows.emblemX - rows.emblemSize / 2, y, value, style).setOrigin(0, 0.5));
    if (sub) panel.add(this.add.text(P.width / 2 - P.padX, y, sub, textStyle({ role: "emphasis", size: 24, color: COLOR.ink })).setOrigin(1, 0.5));
    if (index > 0) panel.add(this.add.rectangle((rows.labelX + P.width / 2 - P.padX) / 2, y - rows.gap / 2, P.width / 2 - P.padX - rows.labelX, 1, COLOR.panelEdge, 0.35));
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

  /**
   * 오른쪽 아래 [도전] — 이 화면의 주 조작. 상대 선택 창을 연다.
   *
   * **유리판이 아니라 강조색으로 꽉 채운 평판이다.** 옆의 [방어]가 어두운 유리판이라 같은 문법의 강조 버튼(점 무늬·
   * 윤곽선)을 두면 두 판의 무게가 비슷하게 읽혔다 — 색 면 하나와 어두운 글자로 "여기를 누른다"를 말한다.
   * 모양은 [방어]와 같은 깎인 칩이라 두 판이 한 줄로 묶인다.
   */
  private paintChallenge(status: DuelStatusResponse): void {
    const { y, height, challenge } = S.actions;
    const panel = this.add.container(challenge.x + challenge.width / 2, y);
    this.view.add(panel);
    const enabled = status.opponents.length > 0;
    panel.add(drawLayer(this, 0, 0, chipPoints(challenge.width, height), { fill: COLOR.accent, alpha: 0.96 }));
    // 윗변 아래 한 줄만 밝게 — 평판에 두께를 얹지 않고 빛이 닿는 변만 말한다.
    panel.add(this.add.rectangle(0, -height / 2 + 10, challenge.width - height * 0.9, 3, 0xffffff, 0.35));
    const label = this.add.text(0, 0, t("duel.challenge"), textStyle({ role: "display", size: 56, color: "#141820" })).setOrigin(0.5);
    const art = 92;
    const gap = 18;
    const total = art + gap + label.width;
    label.setX(-total / 2 + art + gap + label.width / 2);
    panel.add(this.add.image(-total / 2 + art / 2, 0, DUEL_TICKET_ICON).setDisplaySize(art, art));
    panel.add(label);
    if (!enabled) { panel.setAlpha(0.4); return; }
    const hit = this.add.rectangle(0, 0, challenge.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(panel, "primary"));
    hit.on("pointerout", () => pressOut(panel, "primary", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(panel, "primary");
      if (this.busy) return;
      // 도전권이 없으면 상대를 고르게 한 뒤 막지 않고, 곧바로 채우는 창을 연다.
      if (status.attemptsLeft > 0) this.openOpponents(); else this.openTicketPopup();
    });
    panel.add(hit);
  }

  /** 결투 도전권 창. 사거나 광고로 받으면 새 상태로 화면을 다시 그린다. */
  private openTicketPopup(): void {
    const status = this.status;
    if (!status || this.busy) return;
    openDuelTicketPopup(this, this.popups, gameApi, status, { onStatus: (next) => { if (this.scene.isActive()) this.paint(next); } });
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
