import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { AchievementListResponse, AchievementSeriesDto, ClaimAchievementRewardsResponse, GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { ACHIEVEMENT_CATEGORIES } from "../data/achievements";
import { PROFILE_MODIFIERS } from "../data/profileModifiers";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer, drawShapeEdge, HoloBar, HOLO, slantedRect, toPoints } from "./holo";
import { shapeClipMask } from "./popupArt";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { openRewardPopup } from "./RewardPopup";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, PROFILE_MODIFIER_RARITY_COLOR, textStyle } from "./theme";
import { ACHIEVEMENT_CATEGORY_TONE, ACHIEVEMENTS_POPUP_LAYOUT, achievementListContentHeight, achievementRowY, achievementsTabX, orderAchievements, type AchievementTab } from "./achievementsPopupLayout";
import { withBusy } from "./BusyOverlay";

const TABS: readonly AchievementTab[] = ["all", ...ACHIEVEMENT_CATEGORIES];

function diamond(size: number): Phaser.Geom.Point[] {
  return toPoints([0, -size, size, 0, 0, size, -size, 0]);
}

function hexColor(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }

/**
 * 업적 창 — 기간이 없는, 이제껏 해 온 것의 기록.
 *
 * 임무 기록과 같은 판·같은 하단 줄을 쓰되, 줄 하나가 **점점 어려워지는 단계의 묶음**이다. 줄 머리의
 * 마름모가 몇 단계를 밟았는지, 게이지가 다음 문턱까지 얼마 남았는지 말하고, 오른쪽 액자가 그 단계의
 * 보상이다. 마지막 단계에 수식어가 걸린 줄은 이름 옆에 그 수식어를 희귀도 색으로 미리 보인다 — 무엇을
 * 향해 가는지가 그 줄의 이유다.
 *
 * 받는 것은 액자를 누르는 손 하나이고, 한 줄에 여러 단계가 열려 있으면 한 번에 함께 받는다.
 */
export class AchievementsPopup {
  private tab: AchievementTab = "all";
  private data?: AchievementListResponse;
  private body?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private footer?: Phaser.GameObjects.Container;
  private bars: HoloBar[] = [];
  private scrollContent?: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  private scroll = 0;
  private minScroll = 0;
  private scrollTab?: AchievementTab;
  private claiming = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi, private readonly onWalletChanged?: () => void, private readonly onClose?: () => void) {}

  open(): void {
    if (this.body) return;
    const { popup } = ACHIEVEMENTS_POPUP_LAYOUT;
    this.popups.open({ width: BASE_WIDTH - popup.widthInset, height: BASE_HEIGHT - popup.heightInset, title: t("achievement.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: true, backButton: true, onClose: () => { this.destroyContent(); this.footer?.destroy(); this.footer = undefined; this.body = undefined; this.onClose?.(); } }, (body) => {
      this.body = body;
      void this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    this.data = await withBusy(this.scene, this.api.getAchievements());
    this.render();
  }

  private select(tab: AchievementTab): void {
    if (tab === this.tab) return;
    this.tab = tab; this.render();
  }

  private destroyContent(): void { this.bars.forEach((bar) => bar.destroy()); this.bars = []; this.list?.destroy(); this.list = undefined; this.scrollContent = undefined; this.rows = []; }

  private render(): void {
    const keepScroll = this.scrollTab === this.tab ? this.scroll : 0;
    this.destroyContent(); if (!this.body || !this.data) return;
    this.list = this.scene.add.container(0, 0); this.body.add(this.list);
    this.renderSummary(this.data);
    const inTab = this.data.series.filter((series) => this.tab === "all" || series.category === this.tab);
    const ordered = orderAchievements(inTab.map((series) => ({ ...series, tierCount: series.tiers.length })));
    const content = this.buildScrollList(ordered.length);
    ordered.forEach((series, index) => this.renderSeries(content, series, index));
    this.scrollTab = this.tab;
    this.applyScroll(keepScroll);
    this.renderFooter();
  }

  /** 첫 줄 — 밟은 단계 수와 그 게이지, 오른쪽에 얻은 수식어 수. */
  private renderSummary(data: AchievementListResponse): void {
    const list = this.list!;
    const { summary, popup } = ACHIEVEMENTS_POPUP_LAYOUT;
    const panelWidth = BASE_WIDTH - popup.widthInset - 60;
    const shape = chipPoints(panelWidth, summary.panelHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    list.add(drawLayer(this.scene, 0, summary.panelY, shape, { fill: 0x0b1118, alpha: 0.86 }));
    list.add(drawShapeEdge(this.scene, 0, summary.panelY, shape, "top", { color: COLOR.missionClaim, alpha: 0.8, width: 3 }));
    const left = -panelWidth / 2 + 40;
    const caption = this.scene.add.text(left, summary.headerY, t("achievement.summary.tiers"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const value = this.scene.add.text(left + caption.width + 16, summary.headerY, `${data.completedTiers}`, textStyle({ role: "display", size: 40, color: "#ffcf7a" })).setOrigin(0, 0.5);
    value.setShadow(0, 3, "#000000", 4, false, true);
    const total = this.scene.add.text(value.x + value.width + 10, summary.headerY + 4, `/ ${data.totalTiers}`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    list.add([caption, value, total]);

    const modifierRight = panelWidth / 2 - 36;
    const barRight = modifierRight - summary.modifierWidth - 28;
    const barWidth = barRight - left;
    const bar = new HoloBar(this.scene, left + barWidth / 2, summary.barY, barWidth, summary.barHeight, { color: COLOR.missionClaim, trackAlpha: 0.88, outline: true, shadow: { offsetX: 3, offsetY: 6, alpha: 0.6 }, glow: { spread: 8, alpha: 0.22 } }).addTo(list);
    bar.setValue(data.completedTiers / Math.max(1, data.totalTiers)); this.bars.push(bar);

    // 수식어 칸 — 얻은 수식어가 업적의 끝이라 수를 따로 세운다. 전설색 빗금이 그 칸을 묶는다.
    const chipX = modifierRight - summary.modifierWidth / 2;
    const chipY = (summary.headerY + summary.barY) / 2;
    const chipShape = chipPoints(summary.modifierWidth, 108, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } });
    list.add(drawLayer(this.scene, chipX, chipY, chipShape, { fill: 0x1a1608, alpha: 0.9 }));
    list.add(drawShapeEdge(this.scene, chipX, chipY, chipShape, "top", { color: PROFILE_MODIFIER_RARITY_COLOR.legendary, alpha: 0.9, width: 3 }));
    const label = this.scene.add.text(chipX, chipY, t("achievement.summary.modifiers", { earned: data.earnedModifierCount, total: data.totalModifierCount }), textStyle({ role: "emphasis", size: 26, color: hexColor(PROFILE_MODIFIER_RARITY_COLOR.legendary) })).setOrigin(0.5);
    squeezeTextToWidth(label, summary.modifierWidth - 36);
    list.add(label);
  }

  private buildScrollList(count: number): Phaser.GameObjects.Container {
    const { list } = ACHIEVEMENTS_POPUP_LAYOUT;
    const frame = this.scene.add.container(0, list.top);
    this.list!.add(frame);
    const viewHeight = list.bottom - list.top;
    const half = list.cardWidth / 2 + 20;
    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - half * scale, right: matrix.tx + half * scale, top: matrix.ty, bottom: matrix.ty + viewHeight * scale };
    };
    const drag = addClippedHit(this.scene, frame, 0, viewHeight / 2, half * 2, viewHeight, clip, { useHandCursor: false });
    this.scene.input.setDraggable(drag);
    const content = this.scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(this.scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    this.scrollContent = content;
    this.minScroll = Math.min(0, viewHeight - achievementListContentHeight(count));
    let lastY = 0;
    drag.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
    drag.on("drag", (pointer: Phaser.Input.Pointer) => {
      const scale = frame.getWorldTransformMatrix().scaleY || 1;
      this.applyScroll(this.scroll + (pointer.y - lastY) / scale); lastY = pointer.y;
    });
    drag.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.applyScroll(this.scroll - dy * 0.65));
    return content;
  }

  private applyScroll(value: number): void {
    const content = this.scrollContent; if (!content?.active) return;
    const { list } = ACHIEVEMENTS_POPUP_LAYOUT;
    this.scroll = Phaser.Math.Clamp(value, this.minScroll, 0);
    content.y = this.scroll;
    const viewHeight = list.bottom - list.top;
    // 창 밖으로 나간 줄은 감춘다 — 마스크는 그림만 자르고 액자의 입력을 막지 않는다.
    for (const row of this.rows) {
      const top = row.y + this.scroll - list.cardHeight / 2;
      row.setVisible(top + list.cardHeight > 0 && top < viewHeight);
    }
  }

  /**
   * 업적 한 줄 — 왼쪽 빗금(갈래 색) · 머리 줄(갈래 · 단계 마름모 · n/m단계) · 이름(+수식어) · 다음 목표 ·
   * 게이지, 오른쪽 끝에 다음 단계의 보상 액자. 다 밟은 줄은 마지막 보상을 받은 채로 눌러 두고 「완료」를 단다.
   */
  private renderSeries(content: Phaser.GameObjects.Container, series: AchievementSeriesDto, index: number): void {
    const { list: layout, row: rowLayout } = ACHIEVEMENTS_POPUP_LAYOUT;
    const row = this.scene.add.container(0, achievementRowY(index));
    content.add(row); this.rows.push(row);
    const tierCount = series.tiers.length;
    const complete = series.claimedTiers >= tierCount;
    const claimable = series.claimableTiers > 0;
    const halfW = layout.cardWidth / 2;
    const categoryTone = ACHIEVEMENT_CATEGORY_TONE[series.category];
    const shape = chipPoints(layout.cardWidth, layout.cardHeight, { bevel: { topLeft: 28, topRight: 0, bottomRight: 28, bottomLeft: 0 } });
    row.add(drawLayer(this.scene, 0, 0, shape, { fill: complete ? 0x12161b : claimable ? 0x2e2412 : 0x18202a, alpha: complete ? 0.6 : HOLO.glass }));
    if (!complete) row.add(drawShapeEdge(this.scene, 0, 0, shape, "top", { color: claimable ? COLOR.missionClaim : categoryTone, alpha: claimable ? 0.95 : 0.5, width: claimable ? 3 : 2 }));
    const stripe = this.scene.add.graphics({ x: -halfW + 30, y: 0 });
    stripe.fillStyle(categoryTone, complete ? 0.35 : 0.95);
    stripe.fillPoints(toPoints(slantedRect(10, layout.cardHeight - 52, 8)), true);
    row.add(stripe);

    const rewardSize = rowLayout.rewardSize;
    const rewardX = halfW - 26 - rewardSize / 2;
    const textRight = rewardX - rewardSize / 2 - 26;
    const left = -halfW + 58;
    const dim = complete ? COLOR.inkDim : COLOR.ink;

    // 머리 줄 — 갈래 이름, 단계 마름모, 오른쪽 끝에 n/m단계(또는 완료).
    const eyebrow = this.scene.add.text(left, rowLayout.eyebrowY, t(`achievement.category.${series.category}` as TextKey), textStyle({ role: "emphasis", size: 20, color: hexColor(categoryTone) })).setOrigin(0, 0.5).setAlpha(complete ? 0.6 : 1);
    row.add(eyebrow);
    const pips = this.scene.add.graphics({ x: left + eyebrow.width + 22, y: rowLayout.eyebrowY });
    for (let tier = 0; tier < tierCount; tier += 1) {
      const x = tier * rowLayout.pipGap;
      const claimed = tier < series.claimedTiers;
      const open = !claimed && tier < series.claimedTiers + series.claimableTiers;
      pips.fillStyle(0x05070a, 0.9).fillPoints(diamond(rowLayout.pipSize + 3).map((p) => new Phaser.Geom.Point(p.x + x, p.y)), true);
      if (claimed) pips.fillStyle(complete ? 0x8a8f96 : COLOR.missionClaim, 1).fillPoints(diamond(rowLayout.pipSize).map((p) => new Phaser.Geom.Point(p.x + x, p.y)), true);
      else if (open) pips.fillStyle(0xffcf7a, 1).fillPoints(diamond(rowLayout.pipSize).map((p) => new Phaser.Geom.Point(p.x + x, p.y)), true);
      else pips.lineStyle(2, 0xffffff, 0.55).strokePoints(diamond(rowLayout.pipSize - 1).map((p) => new Phaser.Geom.Point(p.x + x, p.y)), true);
    }
    row.add(pips);
    const stateLabel = complete ? t("achievement.state.complete") : t("achievement.tier", { current: series.claimedTiers, total: tierCount });
    const state = this.scene.add.text(textRight, rowLayout.eyebrowY, stateLabel, textStyle({ role: "emphasis", size: 22, color: claimable ? "#ffcf7a" : COLOR.inkDim })).setOrigin(1, 0.5);
    row.add(state);

    // 이름과, 마지막 단계에 걸린 수식어.
    const title = this.scene.add.text(left, rowLayout.titleY, t(`achievement.series.${series.id}` as TextKey), textStyle({ role: "display", size: 32, color: dim })).setOrigin(0, 0.5);
    row.add(title);
    const modifierDef = series.modifier ? PROFILE_MODIFIERS.find(({ id }) => id === series.modifier!.id) : undefined;
    if (modifierDef && series.modifier) {
      const tone = PROFILE_MODIFIER_RARITY_COLOR[modifierDef.rarity];
      const earned = series.modifier.earned;
      const tag = this.scene.add.container(0, rowLayout.titleY);
      const text = this.scene.add.text(0, 0, modifierDef.displayName, textStyle({ role: "emphasis", size: 20, color: earned ? hexColor(tone) : COLOR.inkDim })).setOrigin(0.5);
      const width = text.width + 32;
      const tagShape = chipPoints(width, 36, { bevel: { topLeft: 10, topRight: 0, bottomRight: 10, bottomLeft: 0 } });
      tag.add(drawLayer(this.scene, 0, 0, tagShape, { fill: 0x0b0e13, alpha: 0.86 }));
      tag.add(drawShapeEdge(this.scene, 0, 0, tagShape, "top", { color: tone, alpha: earned ? 1 : 0.55, width: 2 }));
      tag.add(text);
      const room = textRight - left - width - 20;
      squeezeTextToWidth(title, Math.max(160, room));
      tag.setX(left + title.displayWidth + 18 + width / 2);
      row.add(tag);
    } else {
      squeezeTextToWidth(title, textRight - left);
    }

    // 다음 목표(다 밟았으면 마지막 목표)와 그 게이지.
    const nextIndex = Math.min(series.claimedTiers + series.claimableTiers, tierCount - 1);
    const shownIndex = complete ? tierCount - 1 : claimable ? series.claimedTiers : nextIndex;
    const target = series.tiers[shownIndex].target;
    const objective = this.scene.add.text(left, rowLayout.objectiveY, t(`achievement.objective.${series.metric}` as TextKey, { value: formatCurrency(target) }), textStyle({ role: "body", size: 23, color: complete ? COLOR.inkDim : "#c8ced6" })).setOrigin(0, 0.5);
    squeezeTextToWidth(objective, textRight - left);
    row.add(objective);
    const progress = this.scene.add.text(textRight, rowLayout.barY, `${formatCurrency(Math.min(series.value, target))} / ${formatCurrency(target)}`, textStyle({ role: "emphasis", size: 22, color: dim })).setOrigin(1, 0.5);
    const barWidth = Math.max(200, progress.x - progress.width - 20 - left);
    const bar = new HoloBar(this.scene, left + barWidth / 2, rowLayout.barY, barWidth, 18, { color: claimable || complete ? COLOR.missionClaim : categoryTone, trackAlpha: 0.86, outline: true }).addTo(row);
    bar.setValue(Math.min(1, series.value / Math.max(1, target))); this.bars.push(bar);
    row.add(progress);

    // 보상 액자 — 받을 단계가 있으면 그 단계, 없으면 다음 단계, 다 밟았으면 마지막 단계(받은 채로).
    const rewardTier = series.tiers[shownIndex];
    const holder = this.scene.add.container(rewardX, 0);
    row.add(holder);
    if (claimable) {
      const halo = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      halo.fillStyle(COLOR.missionClaim, 0.4).fillPoints(toPoints(chipPoints(rewardSize + 24, rewardSize + 24, { bevel: { topLeft: rewardSize * 0.28, topRight: 0, bottomRight: rewardSize * 0.28, bottomLeft: 0 } })), true);
      holder.add(halo);
      this.scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    const reward = new RewardFrame(this.scene, 0, 0, { icon: CURRENCY_ICON_BY_WALLET[rewardTier.reward.currency], amount: rewardTier.reward.amount, size: rewardSize, state: complete ? "claimed" : claimable ? "claimable" : "normal", onClick: claimable ? () => void this.claim([series.id]) : undefined });
    if (!claimable && !complete) reward.setAlpha(0.55);
    holder.add(reward);
    // 한 번에 여러 단계가 열려 있으면 액자의 깎인 왼쪽 위 모서리에 몇 단계인지 붙인다 — 누르면 그만큼 함께 받는다.
    if (series.claimableTiers > 1) {
      const badge = this.scene.add.text(-rewardSize / 2 + 16, -rewardSize / 2 + 14, `×${series.claimableTiers}`, textStyle({ role: "display", size: 24, color: "#ffcf7a" })).setOrigin(0.5).setStroke("#05070a", 6);
      holder.add(badge);
    }
    if (claimable && motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
      this.scene.tweens.add({ targets: holder, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  /** 하단 줄 — 갈래 탭 다섯과 모두 받기. 다른 갈래에 받을 것이 남아 있으면 그 라벨에 호박빛 점이 선다. */
  private renderFooter(): void {
    if (!this.body || !this.data) return;
    this.footer?.destroy();
    const footer = this.scene.add.container(0, 0); this.footer = footer; this.body.add(footer);
    const { footer: layout } = ACHIEVEMENTS_POPUP_LAYOUT;
    const series = this.data.series;
    TABS.forEach((tab, index) => {
      const pending = series.filter((entry) => (tab === "all" || entry.category === tab) && entry.claimableTiers > 0).length;
      const label = t(tab === "all" ? "achievement.tab.all" : `achievement.category.${tab}` as TextKey);
      const node = addCategoryTab(this.scene, footer, { x: achievementsTabX(index), y: layout.tabY, width: layout.tab.width, height: layout.tab.height, label, selected: tab === this.tab, onSelect: () => this.select(tab) });
      if (pending > 0 && tab !== this.tab) {
        const dot = this.scene.add.graphics({ x: layout.tab.width / 2 - 16, y: -layout.tab.height / 2 + 8 });
        dot.fillStyle(0x05070a, 0.9).fillPoints(diamond(11), true);
        dot.fillStyle(COLOR.missionClaim, 1).fillPoints(diamond(8), true);
        node.add(dot);
      }
    });
    const claim = new Button(this.scene, layout.claim.x, layout.claim.y, { width: layout.claim.width, height: layout.claim.height, label: t("achievement.claimAll"), variant: "primary", onClick: () => void this.claim(this.claimableIdsInTab()) });
    if (this.claimableIdsInTab().length === 0) claim.setEnabled(false);
    footer.add(claim);
  }

  private claimableIdsInTab(): string[] {
    return (this.data?.series ?? []).filter((series) => (this.tab === "all" || series.category === this.tab) && series.claimableTiers > 0).map(({ id }) => id);
  }

  private async claim(ids: string[]): Promise<void> {
    if (this.claiming || ids.length === 0) return;
    this.claiming = true;
    let result: ClaimAchievementRewardsResponse;
    try { result = await withBusy(this.scene, this.api.claimAchievementRewards(ids)); } catch { this.claiming = false; await this.refresh(); return; }
    session.wallet = { ...result.wallet }; this.onWalletChanged?.();
    this.data = await this.api.getAchievements();
    this.claiming = false;
    this.render();
    await notificationManager.refresh();
    const items = result.granted.filter(({ amount }) => amount > 0).map(({ currency, amount }) => ({ icon: CURRENCY_ICON_BY_WALLET[currency], amount }));
    const names = result.newModifierIds.map((id) => PROFILE_MODIFIERS.find((modifier) => modifier.id === id)?.displayName).filter((name): name is string => Boolean(name));
    // 열린 수식어는 판 밖 아래 한 줄로 알린다 — 재화가 아니라 이름이라 액자로 세우지 않는다.
    const footnote = names.length > 0 ? names.map((name) => t("achievement.modifierEarned", { name })).join("\n") : undefined;
    if (items.length) openRewardPopup(this.scene, this.popups, { title: t("achievement.rewardTitle"), items, footnote });
  }
}
