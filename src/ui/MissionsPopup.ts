import { setDebugMissionsPeriod } from "../debug";
import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, MissionDto, ClaimMissionRewardsResponse, MissionListResponse, ResearchRewardStageDto } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { MissionPeriod } from "../core/missions";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { motionPolicy } from "../core/settings";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer, drawShapeEdge, HoloBar, HOLO, slantedRect, toPoints } from "./holo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { openRewardPopup } from "./RewardPopup";
import { COLOR, textStyle } from "./theme";
import { MissionClaimController, missionDisplayModel, orderMissions, missionResetRemainingMs, formatResetRemaining } from "./missionsPopupModel";
import { MISSIONS_POPUP_LAYOUT, missionListContentHeight, missionRowY, missionsTabX, researchTrackLayout } from "./missionsPopupLayout";
import { shapeClipMask } from "./popupArt";

const PERIODS: readonly MissionPeriod[] = ["daily", "weekly"];

/** 게이지 마디와 알림 점이 함께 쓰는 마름모. 동그라미를 쓰지 않는다(화면 전체의 규칙). */
function diamond(size: number): Phaser.Geom.Point[] {
  return toPoints([0, -size, size, 0, 0, size, -size, 0]);
}

/**
 * 일일·주간 임무판.
 *
 * **이 화면의 첫 줄은 연구도다.** 임무 하나하나는 작은 보상이고, 한 기간에 무엇을 향해 가는지는
 * 게이지 위 마디의 액자들이 말한다 — 그래서 게이지를 크게 세우고 액자를 마디마다 올린다. 받을 수
 * 있는 액자는 호박빛으로 숨 쉬고, 받은 액자는 눌려 가라앉는다.
 *
 * 기간은 목록 아래의 전환 라벨(`addCategoryTab`)로 고른다 — 가방·상점과 같은 손짓이다.
 */
export class MissionsPopup {
  private period: MissionPeriod = "daily";
  private missions: MissionDto[] = [];
  private research?: MissionListResponse["research"];
  /** 수령 직전의 연구도. 다음 한 번의 렌더만 이 값에서 굴려 올린다. */
  private rollFrom?: number;
  private body?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private footer?: Phaser.GameObjects.Container;
  private resetText?: Phaser.GameObjects.Text;
  private resetTimer?: Phaser.Time.TimerEvent;
  private bars: HoloBar[] = [];
  /** 흐르는 목록과 그 줄들. 줄 하나가 컨테이너 하나라 창 밖으로 나간 줄을 통째로 감춘다. */
  private scrollContent?: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  private scroll = 0;
  private minScroll = 0;
  private scrollPeriod?: MissionPeriod;
  /** 줄마다 지금 서 있는 자리(임무 ID → y). 다시 그릴 때 줄이 여기서 새 자리로 옮겨 간다. */
  private rowPositions = new Map<string, number>();
  private readonly claims: MissionClaimController;
  private readonly api: GameApi;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, api: GameApi = gameApi, private readonly onWalletChanged?: () => void, private readonly onClose?: () => void) {
    this.api = api; this.claims = new MissionClaimController(api);
  }

  open(): void {
    if (this.body) return;
    const { popup } = MISSIONS_POPUP_LAYOUT;
    const width = BASE_WIDTH - popup.widthInset;
    const height = BASE_HEIGHT - popup.heightInset;
    this.popups.open({ width, height, title: t("missions.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: false, backButton: true, onClose: () => { this.destroyContent(); this.footer?.destroy(); this.footer = undefined; this.resetTimer?.remove(); this.resetTimer = undefined; this.body = undefined; this.onClose?.(); } }, (body) => {
      this.body = body;
      // 초기화 시각은 1초마다 글자만 갈아 끼운다 — 판을 다시 세우면 화면이 깜빡인다.
      this.resetTimer = this.scene.time.addEvent({ delay: 1000, loop: true, callback: () => this.paintReset() });
      void this.refresh();
    });
  }

  private select(period: MissionPeriod): void {
    if (period === this.period) return;
    this.period = period; this.render(); setDebugMissionsPeriod(this.period);
  }

  private async refresh(): Promise<void> {
    const result = await this.api.getMissions();
    this.missions = result.missions; this.research = result.research;
    this.render(); setDebugMissionsPeriod(this.period);
  }

  private destroyContent(): void { this.bars.forEach((bar) => bar.destroy()); this.bars = []; this.list?.destroy(); this.list = undefined; this.scrollContent = undefined; this.rows = []; this.resetText = undefined; }

  private render(): void {
    // 같은 기간을 다시 그릴 때(수령 직후)는 보던 자리를 지킨다 — 받기 한 번에 목록이 맨 위로 튀지 않게.
    const keepScroll = this.scrollPeriod === this.period ? this.scroll : 0;
    this.destroyContent(); if (!this.body) return;
    this.list = this.scene.add.container(0, 0); this.body.add(this.list);
    this.renderResearch();
    const inData = this.missions.filter((mission) => mission.period === this.period);
    const missions = orderMissions(inData);
    this.rows = [];
    const content = this.buildScrollList(missions.length);
    missions.forEach((raw, index) => this.renderMission(content, raw, index));
    // **줄이 제자리를 찾아 스르륵 옮겨 간다.** 처음 열 때는 데이터 순서의 자리에서, 받은 뒤에는
    // 방금 서 있던 자리에서 출발한다 — 순서가 뚝 바뀌면 방금 받은 임무가 어디로 갔는지 놓친다.
    const from = this.scrollPeriod === this.period ? this.rowPositions : new Map(inData.map((mission, index) => [mission.id, missionRowY(index)]));
    this.rowPositions = new Map(missions.map((mission, index) => [mission.id, missionRowY(index)]));
    this.scrollPeriod = this.period;
    this.applyScroll(keepScroll);
    this.animateRows(missions.map(({ id }) => id), from);
    this.renderFooter();
  }

  /** 옮겨 가는 동안에는 모든 줄을 보이고, 다 옮긴 뒤 창 밖 줄을 다시 감춘다. */
  private animateRows(ids: readonly string[], from: ReadonlyMap<string, number>): void {
    const factor = motionPolicy(session.settings).nonEssentialDistanceFactor;
    const moving = this.rows.map((row, index) => ({ row, start: from.get(ids[index]) ?? row.y })).filter(({ row, start }) => Math.abs(start - row.y) > 1);
    if (moving.length === 0 || factor === 0) return;
    for (const { row, start } of moving) {
      const target = row.y;
      row.setY(start).setVisible(true);
      this.scene.tweens.add({ targets: row, y: target, duration: 420, delay: 80, ease: "Cubic.InOut", onComplete: () => this.applyScroll(this.scroll) });
    }
    for (const row of this.rows) row.setVisible(true);
  }

  /**
   * 임무 목록 창 — 연구도 무대 아래에서 기간 라벨 한 뼘 위까지만 보이고 그 안에서 흐른다.
   *
   * 마스크는 흐르지 않는 틀(`frame`)을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다. 창 밖으로
   * 완전히 나간 줄은 감춘다 — 마스크는 그림만 자르고 입력은 막지 않아, 감추지 않으면 위의 연구도
   * 무대를 누른 손이 그 뒤에 숨은 받기를 누른다.
   */
  private buildScrollList(count: number): Phaser.GameObjects.Container {
    const { list } = MISSIONS_POPUP_LAYOUT;
    const frame = this.scene.add.container(0, list.top);
    this.list!.add(frame);
    const viewHeight = list.bottom - list.top;
    const half = list.cardWidth / 2 + 20;
    const drag = this.scene.add.rectangle(0, viewHeight / 2, half * 2, viewHeight, 0xffffff, 0).setInteractive({ draggable: true });
    frame.add(drag);
    const content = this.scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(this.scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    this.scrollContent = content;
    this.minScroll = Math.min(0, viewHeight - missionListContentHeight(count));
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
    const { list } = MISSIONS_POPUP_LAYOUT;
    this.scroll = Phaser.Math.Clamp(value, this.minScroll, 0);
    content.y = this.scroll;
    const viewHeight = list.bottom - list.top;
    for (const row of this.rows) {
      const top = row.y + this.scroll - list.cardHeight / 2;
      row.setVisible(top + list.cardHeight > 0 && top < viewHeight);
    }
  }

  /** 임무 한 줄 — 왼쪽에 이름과 달성 게이지, 오른쪽에 보상 액자와 수령 버튼. */
  private renderMission(content: Phaser.GameObjects.Container, raw: MissionDto, index: number): void {
    const { list: layout } = MISSIONS_POPUP_LAYOUT;
    const mission = missionDisplayModel(raw);
    // 줄 하나가 제 컨테이너를 갖는다 — 안쪽 좌표는 줄 가운데가 0이다.
    const list = this.scene.add.container(0, missionRowY(index));
    content.add(list); this.rows.push(list);
    const y = 0;
    const halfW = layout.cardWidth / 2;
    const shape = chipPoints(layout.cardWidth, layout.cardHeight, { bevel: { topLeft: 28, topRight: 0, bottomRight: 28, bottomLeft: 0 } });
    const tone = mission.claimable ? COLOR.missionClaim : mission.claimed ? 0x68717d : COLOR.accent;
    const panel = drawLayer(this.scene, 0, y, shape, { fill: mission.claimed ? 0x12161b : mission.claimable ? 0x2e2412 : 0x18202a, alpha: mission.claimed ? 0.6 : HOLO.glass });
    list.add(panel);
    if (!mission.claimed) list.add(drawShapeEdge(this.scene, 0, y, shape, "top", { color: tone, alpha: mission.claimable ? 0.95 : 0.5, width: mission.claimable ? 3 : 2 }));
    // 왼쪽 끝의 세로 빗금 한 줄이 상태를 색으로 먼저 말한다 — 글자를 읽기 전에 어느 줄이 받을 것인지 보인다.
    const stripe = this.scene.add.graphics({ x: -halfW + 30, y });
    stripe.fillStyle(tone, mission.claimed ? 0.35 : 0.95);
    stripe.fillPoints(toPoints(slantedRect(10, layout.cardHeight - 52, 8)), true);
    list.add(stripe);

    const left = -halfW + 58;
    const title = this.scene.add.text(left, y - 30, mission.title, textStyle({ role: "emphasis", size: 30, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0.5);
    const points = this.scene.add.text(left + title.width + 18, y - 30, t("missions.researchPoints", { points: mission.researchPoints }), textStyle({ role: "emphasis", size: 21, color: mission.claimed ? COLOR.inkDim : COLOR.accentText })).setOrigin(0, 0.5);
    list.add([title, points]);
    const barWidth = 440;
    // 달성도는 카드 면 위에서도 또렷해야 한다. 빈 자리는 짙은 검정으로 눌러 두고 최대치는
    // 흰 선으로 둘러, 채움이 옅어도 "어디까지가 이 게이지인가"가 먼저 읽힌다.
    const bar = new HoloBar(this.scene, left + barWidth / 2, y + 30, barWidth, 20, { color: mission.claimable || mission.claimed ? COLOR.missionClaim : COLOR.accent, trackAlpha: 0.86, outline: true }).addTo(list);
    bar.setValue(mission.ratio); this.bars.push(bar);
    const progress = this.scene.add.text(left + barWidth + 20, y + 30, mission.progressLabel, textStyle({ role: "emphasis", size: 24, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0.5);
    list.add(progress);

    const reward = new RewardFrame(this.scene, 222, y, { icon: CURRENCY_ICON_BY_WALLET[mission.reward.currency], amount: mission.reward.amount, size: 104, state: mission.state, onClick: mission.claimable ? () => void this.claimOne(mission.id) : undefined });
    // **아직 못 받는 보상은 반투명하다.** 받을 수 있는 것과 같은 진하기로 서 있으면 "지금
    // 누를 수 있는가"를 액자가 아니라 글자로 세어야 한다.
    if (!mission.claimable && !mission.claimed) reward.setAlpha(0.55);
    list.add(reward);

    // 수령 칸 — 받을 수 있으면 누르는 판, 아니면 상태 한 마디만 흐리게 선다.
    const actionX = halfW - 92;
    if (mission.claimable) {
      const claim = new Button(this.scene, actionX, y, { width: 136, height: 74, label: t("missions.claim"), variant: "primary", fontSize: 26, onClick: () => void this.claimOne(mission.id) });
      list.add(claim);
      this.scene.tweens.add({ targets: claim, scale: { from: 1, to: 1.06 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    } else {
      const state = this.scene.add.text(actionX, y, mission.claimed ? t("missions.state.claimed") : t("missions.state.inProgress"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5);
      list.add(state);
    }
  }

  /**
   * 연구도 무대 — 머리 줄의 수치와 초기화 시각, 마디마다 선 단계 보상, 그리고 큰 게이지.
   * 마지막 마디의 액자는 그 기간의 목표라 한 뼘 크게 세운다.
   */
  private renderResearch(): void {
    const research = this.research?.[this.period]; const list = this.list; if (!research || !list) return;
    const { research: layout, popup } = MISSIONS_POPUP_LAYOUT;
    const popupWidth = BASE_WIDTH - popup.widthInset;
    const panelWidth = popupWidth - 60;
    const panelShape = chipPoints(panelWidth, layout.panelHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    list.add(drawLayer(this.scene, 0, layout.panelY, panelShape, { fill: 0x0b1118, alpha: 0.86 }));
    list.add(drawShapeEdge(this.scene, 0, layout.panelY, panelShape, "top", { color: COLOR.missionClaim, alpha: 0.8, width: 3 }));

    const headerLeft = -panelWidth / 2 + 40;
    const caption = this.scene.add.text(headerLeft, layout.headerY, t("missions.researchCaption"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const value = this.scene.add.text(headerLeft + caption.width + 16, layout.headerY, "", textStyle({ role: "display", size: 40, color: "#ffcf7a" })).setOrigin(0, 0.5);
    value.setShadow(0, 3, "#000000", 4, false, true);
    const maxLabel = this.scene.add.text(0, layout.headerY + 4, `/ ${research.maxPoints}`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    this.resetText = this.scene.add.text(panelWidth / 2 - 40, layout.headerY, "", textStyle({ role: "emphasis", size: 23, color: COLOR.inkDim })).setOrigin(1, 0.5);
    list.add([caption, value, maxLabel, this.resetText]);
    this.paintReset();

    const track = researchTrackLayout(popupWidth, research.stages.map((stage) => stage.threshold));
    const bar = new HoloBar(this.scene, track.barX, layout.barY, track.barWidth, layout.barHeight, { color: COLOR.missionClaim, trackAlpha: 0.88, outline: true, shadow: { offsetX: 3, offsetY: 6, alpha: 0.6 }, glow: { spread: 8, alpha: 0.22 } }).addTo(list);
    this.bars.push(bar);
    // **연구도는 수령하는 손을 따라 스르륵 오른다.** 값이 순간이동하면 무엇 때문에 올랐는지
    // 보이지 않는다. 수령 직전 값을 기억해 두었다가 거기서부터 굴린다(`rollFrom`).
    const to = research.points;
    const from = Math.min(this.rollFrom ?? to, to);
    this.rollFrom = undefined;
    const paint = (points: number): void => {
      bar.setValue(points / Math.max(1, research.maxPoints));
      value.setText(`${Math.round(points)}`);
      maxLabel.setX(value.x + value.width + 10);
    };
    paint(from);
    if (from < to) {
      const roll = { value: from };
      this.scene.tweens.add({ targets: roll, value: to, duration: 620, ease: "Cubic.Out", onUpdate: () => paint(roll.value), onComplete: () => paint(to) });
    }
    research.stages.forEach((stage, index) => this.renderStage(stage, track.stageXs[index], index === research.stages.length - 1));
  }

  /** 마디 하나 — 게이지 위의 마름모 눈금, 그 아래 임계값, 그 위 보상 액자. */
  private renderStage(stage: ResearchRewardStageDto, x: number, last: boolean): void {
    const list = this.list; if (!list) return;
    const { research: layout } = MISSIONS_POPUP_LAYOUT;
    const claimable = stage.achieved && !stage.claimed;
    const node = this.scene.add.graphics({ x, y: layout.barY });
    const size = 17;
    node.fillStyle(0x05070a, 0.9).fillPoints(diamond(size + 3), true);
    node.fillStyle(stage.achieved ? COLOR.missionClaim : 0x3a4250, 1).fillPoints(diamond(size), true);
    list.add(node);
    const threshold = this.scene.add.text(x, layout.thresholdY, `${stage.threshold}`, textStyle({ role: "emphasis", size: 21, color: stage.achieved ? "#ffcf7a" : COLOR.inkDim })).setOrigin(0.5, 0);
    list.add(threshold);

    // 한 칸에는 보상 하나만 둔다(`RESEARCH_REWARD_STAGES`) — 두 번째를 구석에 작게 붙이면 무엇인지 읽히지 않는다.
    const [primary] = stage.rewards;
    if (!primary) return;
    const frameSize = last ? layout.frameSize + 12 : layout.frameSize;
    const state = stage.claimed ? "claimed" : claimable ? "claimable" : "normal";
    const onClick = claimable ? () => void this.claimStage(stage.id) : undefined;
    if (claimable) {
      // 받을 수 있는 마디는 액자 뒤에서 호박빛이 숨 쉰다 — 게이지를 채운 끝에 무엇을 누를지가 한눈에 읽힌다.
      const halo = this.scene.add.graphics({ x, y: layout.frameY }).setBlendMode(Phaser.BlendModes.ADD);
      halo.fillStyle(COLOR.missionClaim, 0.4).fillPoints(toPoints(chipPoints(frameSize + 26, frameSize + 26, { bevel: { topLeft: frameSize * 0.28, topRight: 0, bottomRight: frameSize * 0.28, bottomLeft: 0 } })), true);
      list.add(halo);
      this.scene.tweens.add({ targets: halo, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    const frame = new RewardFrame(this.scene, x, layout.frameY, { icon: CURRENCY_ICON_BY_WALLET[primary.currency], amount: primary.amount, size: frameSize, state, onClick });
    if (!stage.achieved) frame.setAlpha(0.72);
    list.add(frame);
  }

  /** 하단 줄 — 기간 전환 라벨 둘과 일괄 수령. 기간을 바꿔도 같은 자리를 지킨다. */
  private renderFooter(): void {
    if (!this.body) return;
    this.footer?.destroy();
    const footer = this.scene.add.container(0, 0); this.footer = footer; this.body.add(footer);
    const { footer: layout } = MISSIONS_POPUP_LAYOUT;
    PERIODS.forEach((period, index) => {
      const pending = this.claimableCount(period);
      const tab = addCategoryTab(this.scene, footer, { x: missionsTabX(index), y: layout.tabY, width: layout.tab.width, height: layout.tab.height, label: t(period === "daily" ? "missions.tab.daily" : "missions.tab.weekly"), selected: period === this.period, onSelect: () => this.select(period) });
      // 다른 기간에 받을 것이 남아 있으면 라벨 오른쪽 위에 호박빛 점이 선다.
      if (pending > 0) {
        const dot = this.scene.add.graphics({ x: layout.tab.width / 2 - 16, y: -layout.tab.height / 2 + 8 });
        dot.fillStyle(0x05070a, 0.9).fillPoints(diamond(11), true);
        dot.fillStyle(COLOR.missionClaim, 1).fillPoints(diamond(8), true);
        tab.add(dot);
      }
    });
    const claimable = this.claimableCount(this.period);
    const claim = new Button(this.scene, layout.claim.x, layout.claim.y, { width: layout.claim.width, height: layout.claim.height, label: t("missions.claimAll"), variant: "primary", onClick: () => void this.claimAll() });
    if (claimable === 0) claim.setEnabled(false);
    footer.add(claim);
  }

  /** 그 기간에 지금 받을 수 있는 것 — 임무와 연구도 마디를 함께 센다. */
  private claimableCount(period: MissionPeriod): number {
    const missions = this.missions.filter((mission) => mission.period === period).map(missionDisplayModel).filter((mission) => mission.claimable).length;
    const stages = this.research?.[period]?.stages.filter((stage) => stage.achieved && !stage.claimed).length ?? 0;
    return missions + stages;
  }

  private paintReset(): void {
    if (!this.resetText?.active) return;
    this.resetText.setText(t("missions.resetIn", { time: formatResetRemaining(missionResetRemainingMs(this.period, new Date())) }));
  }

  private async claimOne(id: string): Promise<void> { const result = await this.claims.claim([id]); if (result) await this.applyClaim(result); }
  private async claimAll(): Promise<void> {
    const ids = this.missions.filter((mission) => mission.period === this.period).map(missionDisplayModel).filter((mission) => mission.claimable).map((mission) => mission.id);
    const result = await this.claims.claim(ids, this.period); if (result) await this.applyClaim(result);
  }
  private async claimStage(id: string): Promise<void> { const result = await this.claims.claim([], this.period, [id]); if (result) await this.applyClaim(result); }

  /** 응답 스냅샷으로 목록·알림·지갑을 함께 갱신한 뒤 서버가 확정한 지급분만 영수증에 싣는다. */
  private async applyClaim(result: ClaimMissionRewardsResponse): Promise<void> {
    // 굴릴 시작점은 **수령 직전**의 값이다. 응답을 반영한 뒤에 읽으면 이미 오른 값이라 굴러갈 거리가 없다.
    this.rollFrom = this.research?.[this.period]?.points;
    session.wallet = { ...result.wallet }; this.onWalletChanged?.();
    // 서버 응답의 단계 상태까지 다시 조회해 그래프와 알림 점이 같은 틱에 갱신되게 한다.
    const latest = await this.api.getMissions(); this.missions = latest.missions; this.research = latest.research;
    this.render();
    await notificationManager.refresh();
    const items = result.granted.filter(({ amount }) => amount > 0).map(({ currency, amount }) => ({ icon: CURRENCY_ICON_BY_WALLET[currency], amount }));
    if (items.length) openRewardPopup(this.scene, this.popups, { title: t("missions.rewardTitle"), items });
  }
}
