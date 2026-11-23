import { hasRemoteState } from "../api/resultState";
import { notificationCorner } from "./notificationDotStyle";
import { addClaimHalo } from "./claimHalo";
import Phaser from "phaser";
import { t } from "../i18n";
import type { ClaimCodexRewardsResponse, CodexEntryDto, CodexResponse, GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { getRelic } from "../data/relics";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { notificationManager } from "../managers/NotificationManager";
import { relicCollection } from "../managers/RelicCollectionManager";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { reportError } from "../managers/ErrorReporter";
import { session } from "../state/session";
import { Button, CLAIM_ALL_BUTTON_STYLE } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { slideTabPage } from "./screenTransition";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer, drawShapeEdge, HoloBar } from "./holo";
import { shapeClipMask } from "./popupArt";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { openRewardPopup } from "./RewardPopup";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { RARITY_TONE } from "./rarityMark";
import { pressIn, pressOut } from "./pressFeedback";
import { withBusy } from "./BusyOverlay";
import { NotificationDot } from "./NotificationDot";
import { EnemyInfoPopup } from "./EnemyInfoPopup";
import { CODEX_POPUP_LAYOUT, CODEX_SORTS, CODEX_TABS, codexGridPlan, groupCodexEntries, type CodexSort, type CodexTab } from "./codexPopupLayout";
import { CodexStandee } from "./CodexStandee";
import { addSectionTitle } from "./SectionTitle";
import { addFactionMark } from "./FactionMark";
import { SQUADS } from "../data/factions";
import type { SquadId } from "../core/types";

/** 창을 닫았다 다시 열어도 고른 정렬은 남는다(기기·계정에 저장하지 않는 화면 안의 선택). */
let lastSort: CodexSort = "number";
const SQUAD_ORDER = Object.keys(SQUADS);
const SORT_LABEL: Record<CodexSort, "codex.sort.number" | "codex.sort.rarity" | "codex.sort.squad"> = { number: "codex.sort.number", rarity: "codex.sort.rarity", squad: "codex.sort.squad" };

/**
 * 도감 — 이제껏 마주한 아군과 적의 기록.
 *
 * 함께 싸운 렐릭(보유)과 전장에서 맞선 적이 모두 칸을 채운다. 만나지 않은 칸은 물음표 액자와 「???」로만
 * 서고, 만난 칸을 누르면 그 개체의 정보창이 열린다. 칸마다 등급이 정한 기록 점수가 오르고, 점수가 마디에
 * 닿으면 젬을 받는다 — 받는 손은 요약의 보상 액자와 하단의 모두 받기 둘이고 둘 다 닿은 마디를 전부 걷는다.
 */
export class CodexPopup {
  private tab: CodexTab = "ally";
  private sort: CodexSort = lastSort;
  private data?: CodexResponse;
  private body?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private footer?: Phaser.GameObjects.Container;
  private bars: HoloBar[] = [];
  private scrollContent?: Phaser.GameObjects.Container;
  private cells: CodexStandee[] = [];
  private scroll = 0;
  private minScroll = 0;
  private scrollTab?: CodexTab;
  private claiming = false;
  private gridClip?: () => ClipRect;
  private allyInfo?: CharacterInfoManager;
  private enemyInfo?: EnemyInfoPopup;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi, private readonly onWalletChanged?: () => void) {}

  open(): void {
    if (this.body) return;
    const { popup } = CODEX_POPUP_LAYOUT;
    this.popups.open({ width: BASE_WIDTH - popup.widthInset, height: BASE_HEIGHT - popup.heightInset, title: t("codex.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: true, backButton: true, onClose: () => { this.destroyContent(); this.footer?.destroy(); this.footer = undefined; this.body = undefined; } }, (body) => {
      this.body = body;
      void this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    this.data = await withBusy(this.scene, this.api.getCodex());
    this.render();
  }

  private select(tab: CodexTab): void {
    if (tab === this.tab) return;
    const from = CODEX_TABS.indexOf(this.tab);
    this.tab = tab; this.render();
    if (this.list) slideTabPage(this.scene, [this.list], from, CODEX_TABS.indexOf(tab));
  }

  private selectSort(sort: CodexSort): void {
    if (sort === this.sort) return;
    const from = CODEX_SORTS.indexOf(this.sort);
    this.sort = sort; lastSort = sort; this.scrollTab = undefined; this.render();
    if (this.scrollContent) slideTabPage(this.scene, [this.scrollContent], from, CODEX_SORTS.indexOf(sort));
  }

  private destroyContent(): void { this.bars.forEach((bar) => bar.destroy()); this.bars = []; this.list?.destroy(); this.list = undefined; this.scrollContent = undefined; this.cells = []; }

  private entriesInTab(): CodexEntryDto[] { return (this.data?.entries ?? []).filter(({ side }) => side === this.tab); }

  private render(): void {
    const keepScroll = this.scrollTab === this.tab ? this.scroll : 0;
    this.destroyContent(); if (!this.body || !this.data) return;
    this.list = this.scene.add.container(0, 0); this.body.add(this.list);
    this.renderSummary(this.data);
    this.renderSortRow();
    const entries = this.entriesInTab().map((entry) => { const def = getRelic(entry.id); return { ...entry, rarity: def.rarity, squad: def.squad }; });
    const groups = groupCodexEntries(entries, this.sort, SQUAD_ORDER);
    const plan = codexGridPlan(groups.map(({ key, entries: inGroup }) => ({ key, count: inGroup.length })));
    const content = this.buildScrollGrid(plan.height);
    plan.headers.forEach(({ key, y }) => this.renderHeader(content, key, y, groups.find((group) => group.key === key)!.entries));
    groups.flatMap(({ entries: inGroup }) => inGroup).forEach((entry, index) => this.renderCell(content, entry, plan.cards[index]));
    this.scrollTab = this.tab;
    this.applyScroll(keepScroll);
    this.renderFooter();
  }

  /** 첫 줄 — 기록 점수와 그 게이지, 오른쪽에 다음(또는 받을) 마디의 보상 액자. */
  private renderSummary(data: CodexResponse): void {
    const list = this.list!;
    const { summary, popup } = CODEX_POPUP_LAYOUT;
    const panelWidth = BASE_WIDTH - popup.widthInset - 60;
    const shape = chipPoints(panelWidth, summary.panelHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    list.add(drawLayer(this.scene, 0, summary.panelY, shape, { fill: 0x0b1118, alpha: 0.86 }));
    list.add(drawShapeEdge(this.scene, 0, summary.panelY, shape, "top", { color: COLOR.missionClaim, alpha: 0.8, width: 3 }));
    const left = -panelWidth / 2 + 40;
    const caption = this.scene.add.text(left, summary.headerY, t("codex.summary.score"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const value = this.scene.add.text(left + caption.width + 16, summary.headerY, formatCurrency(data.score), textStyle({ role: "display", size: 40, color: "#ffcf7a" })).setOrigin(0, 0.5);
    value.setShadow(0, 3, "#000000", 4, false, true);
    const total = this.scene.add.text(value.x + value.width + 10, summary.headerY + 4, `/ ${formatCurrency(data.maxScore)}`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    list.add([caption, value, total]);

    const rewardRight = panelWidth / 2 - 36;
    const barRight = rewardRight - summary.rewardWidth - 28;
    const barWidth = barRight - left;
    // 기록한 칸 수는 점수 옆이 아니라 게이지 오른쪽 끝 위에 작게 — 점수가 먼저 읽힌다.
    const recorded = data.entries.filter(({ recorded }) => recorded).length;
    const count = this.scene.add.text(barRight, summary.headerY + 4, t("codex.summary.recorded", { recorded, total: data.entries.length }), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
    squeezeTextToWidth(count, barRight - (total.x + total.width + 24));
    list.add(count);
    const bar = new HoloBar(this.scene, left + barWidth / 2, summary.barY, barWidth, summary.barHeight, { color: COLOR.missionClaim, trackAlpha: 0.88, outline: true, ticks: Math.max(0, data.milestones.length - 1), shadow: { offsetX: 3, offsetY: 6, alpha: 0.6 }, glow: { spread: 8, alpha: 0.22 } }).addTo(list);
    bar.setValue(data.score / Math.max(1, data.maxScore)); this.bars.push(bar);

    // 다음 마디 — 받을 마디가 있으면 그 첫 마디(누르면 닿은 마디를 모두 받는다), 없으면 다음 목표, 다 받았으면 마지막.
    const claimable = data.milestones.find(({ state }) => state === "claimable");
    const locked = data.milestones.find(({ state }) => state === "locked");
    const shown = claimable ?? locked ?? data.milestones[data.milestones.length - 1];
    if (!shown) return;
    const holderX = rewardRight - summary.rewardWidth / 2;
    const holderY = summary.panelY;
    const label = this.scene.add.text(holderX - summary.rewardSize / 2 - 14, holderY, t("codex.summary.next", { score: formatCurrency(shown.score) }), textStyle({ role: "emphasis", size: 22, color: claimable ? "#ffcf7a" : COLOR.inkDim, align: "right" })).setOrigin(1, 0.5);
    squeezeTextToWidth(label, 120);
    list.add(label);
    const holder = this.scene.add.container(holderX + 40, holderY);
    list.add(holder);
    const size = summary.rewardSize;
    if (claimable) {
      holder.add(addClaimHalo(this.scene, { size }).image);
    }
    const allClaimed = !claimable && !locked;
    const reward = new RewardFrame(this.scene, 0, 0, { icon: CURRENCY_ICON_BY_WALLET[shown.reward.currency], amount: shown.reward.amount, size, state: allClaimed ? "claimed" : claimable ? "claimable" : "normal", onClick: claimable ? () => void this.claim() : undefined });
    if (!claimable && !allClaimed) reward.setAlpha(0.55);
    holder.add(reward);
    if (claimable) new NotificationDot(this.scene, holder, notificationCorner("frame", size, size));
    if (data.claimableCount > 1) {
      holder.add(this.scene.add.text(-size / 2 + 16, -size / 2 + 14, `×${data.claimableCount}`, textStyle({ role: "display", size: 24, color: "#ffcf7a" })).setOrigin(0.5).setStroke("#05070a", 6));
    }
    if (claimable && motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
      this.scene.tweens.add({ targets: holder, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  /** 정렬 줄 — 번호순 · 등급별 · 소속별. 목록이 아래에 있어 라벨이 아래로 솟는다. */
  private renderSortRow(): void {
    const { sort } = CODEX_POPUP_LAYOUT;
    const row = this.scene.add.container(0, 0); this.list!.add(row);
    CODEX_SORTS.forEach((option, index) => {
      const x = (index - (CODEX_SORTS.length - 1) / 2) * (sort.tab.width + sort.tab.gap);
      addCategoryTab(this.scene, row, { x, y: sort.y, width: sort.tab.width, height: sort.tab.height, label: t(SORT_LABEL[option]), selected: option === this.sort, face: "down", onSelect: () => this.selectSort(option) });
    });
  }

  /** 구역 제목 — 공용 제목표. 소속 구역은 엠블럼을, 모든 구역은 그 구역의 기록 수를 곁들인다. */
  private renderHeader(content: Phaser.GameObjects.Container, key: string, y: number, entries: readonly CodexEntryDto[]): void {
    const { grid } = CODEX_POPUP_LAYOUT;
    const left = -grid.width / 2;
    const squad = this.sort === "squad" ? (key as SquadId) : undefined;
    const label = squad ? SQUADS[squad].name : key;
    const title = addSectionTitle(this.scene, left + (squad ? 58 : 0), y, label, { size: 28 });
    content.add(title);
    if (squad) { const mark = addFactionMark(this.scene, left + 26, y, squad, { size: 52 }); if (mark) content.add(mark); }
    if (this.sort === "rarity") title.list.forEach((child) => { if (child instanceof Phaser.GameObjects.Text) child.setColor(RARITY_TONE[key as keyof typeof RARITY_TONE]?.ink ?? COLOR.accentText); });
    const recorded = entries.filter((entry) => entry.recorded).length;
    content.add(this.scene.add.text(grid.width / 2, y, `${recorded} / ${entries.length}`, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
    const line = this.scene.add.graphics();
    line.fillStyle(COLOR.accent, 0.25).fillRect(left, y + grid.headerHeight / 2 - 4, grid.width, 2);
    content.add(line);
  }

  private buildScrollGrid(contentHeight: number): Phaser.GameObjects.Container {
    const { grid } = CODEX_POPUP_LAYOUT;
    const frame = this.scene.add.container(0, grid.top);
    this.list!.add(frame);
    const viewHeight = grid.bottom - grid.top;
    const half = grid.width / 2 + 20;
    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - half * scale, right: matrix.tx + half * scale, top: matrix.ty, bottom: matrix.ty + viewHeight * scale };
    };
    this.gridClip = clip;
    const drag = addClippedHit(this.scene, frame, 0, viewHeight / 2, half * 2, viewHeight, clip, { useHandCursor: false });
    const content = this.scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(this.scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    this.scrollContent = content;
    this.minScroll = Math.min(0, viewHeight - contentHeight);
    attachDragScroll(this.scene, {
      owner: drag, root: frame,
      bounds: () => { const c = clip(); return new Phaser.Geom.Rectangle(c.left, c.top, c.right - c.left, c.bottom - c.top); },
      onDelta: (dy) => this.applyScroll(this.scroll + dy / (frame.getWorldTransformMatrix().scaleY || 1)),
    });
    addScrollHint(this.scene, frame, { x: 0, y: viewHeight / 2, width: half * 2, height: viewHeight, owner: frame, read: () => ({ offset: this.scroll, min: this.minScroll }) });
    return content;
  }

  private applyScroll(value: number): void {
    const content = this.scrollContent; if (!content?.active) return;
    const { grid } = CODEX_POPUP_LAYOUT;
    this.scroll = Phaser.Math.Clamp(value, this.minScroll, 0);
    content.y = this.scroll;
    const viewHeight = grid.bottom - grid.top;
    // 창 밖으로 나간 칸은 감추고, 처음 보이는 칸만 원화를 굽는다 — 한 줄 아래까지 미리 읽어 넘길 때 비지 않게 한다.
    for (const cell of this.cells) {
      const top = cell.y + this.scroll - grid.cardHeight / 2;
      const bottom = cell.y + this.scroll + grid.cardHeight / 2;
      const visible = bottom > 0 && top < viewHeight;
      cell.setVisible(visible);
      if (bottom > -grid.cardHeight && top < viewHeight + grid.cardHeight) cell.reveal();
    }
  }

  /** 한 칸 — 세로로 긴 스탠딩 전시 칸(`CodexStandee`). 만나지 않은 칸은 물음표와 「???」다. */
  private renderCell(content: Phaser.GameObjects.Container, entry: CodexEntryDto, spot: { x: number; y: number }): void {
    const { grid } = CODEX_POPUP_LAYOUT;
    const def = getRelic(entry.id);
    const cell = new CodexStandee(this.scene, spot.x, spot.y, def, entry.recorded, { width: grid.cardWidth, height: grid.cardHeight });
    content.add(cell); this.cells.push(cell);
    if (!entry.recorded) return;
    // 창 밖으로 걸친 칸이 판 밖의 손을 받지 않도록 격자 창으로 자른 입력면을 단다.
    const hit = addClippedHit(this.scene, cell, 0, 0, grid.cardWidth, grid.cardHeight, this.gridClip!, { useHandCursor: true });
    hit.on("pointerdown", () => pressIn(cell));
    hit.on("pointerout", () => pressOut(cell, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(cell); this.inspect(entry); });
  }

  /** 만난 칸의 정보 — 아군은 정보창(보유하지 않았으면 실루엣 미리보기), 적은 적 정보창이다. */
  private inspect(entry: CodexEntryDto): void {
    const def = getRelic(entry.id);
    if (entry.side === "enemy") {
      this.enemyInfo ??= new EnemyInfoPopup(this.scene, new PopupLayer(this.scene, 2200));
      this.enemyInfo.show({ def, level: 1, breakthrough: 0 });
      return;
    }
    this.allyInfo ??= new CharacterInfoManager(this.scene, 2301, "owner", 2300);
    this.allyInfo.showRelic(def, relicCollection.owns(def.id));
  }

  /** 하단 줄 — 아군·적 탭(기록 수)과 모두 받기. */
  private renderFooter(): void {
    if (!this.body || !this.data) return;
    this.footer?.destroy();
    const footer = this.scene.add.container(0, 0); this.footer = footer; this.body.add(footer);
    const { footer: layout } = CODEX_POPUP_LAYOUT;
    const entries = this.data.entries;
    CODEX_TABS.forEach((tab, index) => {
      const inTab = entries.filter(({ side }) => side === tab);
      const recorded = inTab.filter(({ recorded }) => recorded).length;
      const label = t(tab === "ally" ? "codex.tab.ally" : "codex.tab.enemy", { recorded, total: inTab.length });
      const x = (index - (CODEX_TABS.length - 1) / 2) * (layout.tab.width + layout.tab.gap);
      addCategoryTab(this.scene, footer, { x, y: layout.tabY, width: layout.tab.width, height: layout.tab.height, label, selected: tab === this.tab, onSelect: () => this.select(tab) });
    });
    const claim = new Button(this.scene, layout.claim.x, layout.claim.y, { width: layout.claim.width, height: layout.claim.height, label: t("codex.claimAll"), ...CLAIM_ALL_BUTTON_STYLE, onClick: () => void this.claim() });
    if (this.data.claimableCount === 0) claim.setEnabled(false);
    footer.add(claim);
  }

  private async claim(): Promise<void> {
    if (this.claiming || !this.data || this.data.claimableCount === 0) return;
    this.claiming = true;
    try {
      let result: ClaimCodexRewardsResponse;
      try { result = await withBusy(this.scene, this.api.claimCodexRewards()); } catch (error) { reportError("codex.claim", error); await this.refresh().catch(() => undefined); return; }
      if (!hasRemoteState(result)) session.wallet = { ...result.wallet }; this.onWalletChanged?.();
      // 지급은 이미 확정됐다. 목록/알림 재조회 실패가 영수증을 막지 않는다.
      this.data = await this.api.getCodex().catch(() => this.data);
      this.render();
      await notificationManager.refresh().catch(() => undefined);
      const items = result.granted.filter(({ amount }) => amount > 0).map(({ currency, amount }) => ({ icon: CURRENCY_ICON_BY_WALLET[currency], amount }));
      if (items.length) openRewardPopup(this.scene, this.popups, { title: t("codex.rewardTitle"), items });
    } finally {
      this.claiming = false;
      this.render();
    }
  }
}
