import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, MissionDto, ClaimMissionRewardsResponse, MissionListResponse } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawLayer, HoloBar, HOLO } from "./holo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { openRewardPopup } from "./RewardPopup";
import { COLOR, textStyle } from "./theme";
import { MissionClaimController, missionDisplayModel } from "./missionsPopupModel";
import { MISSIONS_POPUP_LAYOUT, researchTrackLayout } from "./missionsPopupLayout";

/** 로비 씬을 유지한 채 일일·주간 임무와 실제 확정 보상을 표시하는 공용 작업판이다. */
export class MissionsPopup {
  private period: "daily" | "weekly" = "daily";
  private missions: MissionDto[] = [];
  private research?: MissionListResponse["research"];
  /** 수령 직전의 연구도. 다음 한 번의 렌더만 이 값에서 굴려 올린다. */
  private rollFrom?: number;
  private body?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private bars: HoloBar[] = [];
  private readonly claims: MissionClaimController;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, api: GameApi = gameApi, private readonly onWalletChanged?: () => void, private readonly onClose?: () => void) {
    this.api = api; this.claims = new MissionClaimController(api);
  }
  private readonly api: GameApi;

  open(): void {
    if (this.body) return;
    const { popup, header, tabs, footer } = MISSIONS_POPUP_LAYOUT;
    const width = BASE_WIDTH - popup.widthInset;
    const height = BASE_HEIGHT - popup.heightInset;
    this.popups.open({ width, height, title: t("missions.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: false, backButton: true, onClose: () => { this.destroyContent(); this.body = undefined; this.onClose?.(); } }, (body) => {
      this.body = body;
      // 커진 작업판 제목 아래에 상태 줄을 충분히 내려 두어 머리글과 본문이 한 덩어리로 겹치지 않게 한다.
      this.status = this.scene.add.text(header.statusX, header.statusY, t("missions.syncing"), textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(1, 0); body.add(this.status);
      body.add(new Button(this.scene, -tabs.centerX, tabs.centerY, { width: tabs.width, height: tabs.height, label: t("missions.tab.daily"), onClick: () => this.select("daily") }));
      body.add(new Button(this.scene, tabs.centerX, tabs.centerY, { width: tabs.width, height: tabs.height, label: t("missions.tab.weekly"), onClick: () => this.select("weekly") }));
      body.add(new Button(this.scene, 0, footer.buttonY, { width: footer.buttonWidth, height: footer.buttonHeight, label: t("missions.claimAll"), variant: "primary", onClick: () => void this.claimAll() }));
      void this.refresh();
    });
  }

  private select(period: "daily" | "weekly"): void { this.period = period; this.render(); }
  private async refresh(): Promise<void> { const result = await this.api.getMissions(); this.missions = result.missions; this.research = result.research; this.status?.setText(t("missions.unclaimed", { count: result.claimableCount })); this.render(); }
  private destroyContent(): void { this.bars.forEach((bar) => bar.destroy()); this.bars = []; this.list?.destroy(); this.list = undefined; }

  /** 카드와 보상 액자 모두 같은 콜백을 받으며 수령 완료 행은 명확히 흐리게 남긴다. */
  private render(): void {
    this.destroyContent(); if (!this.body) return;
    this.list = this.scene.add.container(0, 0); this.body.add(this.list);
    this.renderResearch();
    this.missions.filter((mission) => mission.period === this.period).forEach((raw, index) => {
      const { list } = MISSIONS_POPUP_LAYOUT;
      // 첫 카드는 연구도 라벨 아래 고정 여백을 두고 시작하며 이후 카드는 같은 간격으로 흐른다.
      const mission = missionDisplayModel(raw); const y = list.firstCardY + index * list.cardGap;
      const panel = drawLayer(this.scene, 0, y, chipPoints(list.cardWidth, list.cardHeight, { bevel: { topLeft: 28, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: mission.claimed ? 0x171b20 : mission.claimable ? 0x3b2b13 : 0x1a1f27, alpha: mission.claimed ? 0.52 : HOLO.glass, edge: mission.claimable ? COLOR.missionClaim : COLOR.accent, edgeAlpha: mission.claimed ? 0.16 : 0.55 });
      const title = this.scene.add.text(-400, y - 52, mission.title, textStyle({ role: "emphasis", size: 28, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0);
      // 카드 면을 먼저 컨테이너에 넣어 이후 생성하는 게이지가 임무 레이어 뒤로 숨지 않게 한다.
      this.list?.add([panel, title]);
      // HoloBar의 x는 왼쪽 끝이 아니라 중심이다. 카드 안쪽 -390에서 시작해 우측 정보 앞에서 끝낸다.
      const barWidth = 520;
      const barLeft = -390;
      // 달성도는 카드 면 위에서도 또렷해야 한다. 빈 자리는 짙은 검정으로 눌러 두고 최대치는
      // 흰 선으로 둘러, 채움이 옅어도 "어디까지가 이 게이지인가"가 먼저 읽힌다.
      const bar = new HoloBar(this.scene, barLeft + barWidth / 2, y + 35, barWidth, 18, { color: mission.claimable ? COLOR.missionClaim : COLOR.accent, trackAlpha: 0.86, outline: true }).addTo(this.list!); bar.setValue(mission.ratio); this.bars.push(bar);
      // 진행 수는 게이지 끝에 바로 붙여 시선이 카드 반대편까지 왕복하지 않게 한다.
      const progress = this.scene.add.text(150, y + 18, mission.progressLabel, textStyle({ role: "emphasis", size: 24, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0);
      // 기존 미수령 숫자 자리에는 이 임무가 완료 순간 확정하는 연구도를 직접 보여 준다.
      const research = this.scene.add.text(150, y - 50, t("missions.researchPoints", { points: mission.researchPoints }), textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0, 0);
      const reward = new RewardFrame(this.scene, 365, y, { icon: "currency-cheesecake", amount: mission.rewardCheesecake, size: 116, state: mission.state, onClick: mission.claimable ? () => void this.claimOne(mission.id) : undefined });
      // **아직 못 받는 보상은 반투명하다.** 받을 수 있는 것과 같은 진하기로 서 있으면 "지금
      // 누를 수 있는가"를 액자가 아니라 글자로 세어야 한다. 수령한 뒤의 눌린 어둠은
      // `RewardFrame`의 `claimed` 상태가 이미 맡는다.
      if (!mission.claimable && !mission.claimed) reward.setAlpha(0.45);
      // 달성한 순간 한 번 반짝인다 — 목록을 보고 있는 사이에 열린 것을 눈이 놓치지 않게 한다.
      if (mission.claimable) this.scene.tweens.add({ targets: reward, alpha: { from: 0.55, to: 1 }, duration: 260, ease: "Cubic.Out" });
      // 상태 글자는 액자와 **같은 줄**에 선다. 액자 밑변보다 아래에 두면 카드 바닥에 붙어
      // 어느 액자의 이야기인지 흐려진다.
      const state = this.scene.add.text(258, y, mission.claimed ? t("missions.state.claimed") : mission.claimable ? t("missions.state.claimable") : t("missions.state.inProgress"), textStyle({ role: "emphasis", size: 23, color: mission.claimable ? "#ffbf66" : COLOR.inkDim })).setOrigin(1, 0.5);
      this.list?.add([progress, research, reward, state]);
      if (mission.claimable) { const hit = this.scene.add.rectangle(0, y, list.cardWidth, list.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerup", () => void this.claimOne(mission.id)); this.list?.add(hit); this.list?.bringToTop(reward); }
    });
  }

  /** 탭 아래 안전 여백부터 HoloBar와 여섯 개 액자를 겹쳐 임계값을 실제 마디로 읽히게 한다. */
  private renderResearch(): void {
    const research = this.research?.[this.period]; if (!research || !this.list) return;
    const { research: layout } = MISSIONS_POPUP_LAYOUT;
    const popupWidth = BASE_WIDTH - MISSIONS_POPUP_LAYOUT.popup.widthInset;
    // 팝업 안전 너비를 먼저 정해 게이지·양끝 액자·라벨이 모두 같은 왼쪽 기준선을 공유하게 한다.
    const track = researchTrackLayout(popupWidth, research.stages.map((stage) => stage.threshold));
    // 미달성 홈은 검정을 더 진하게 하고, 달성/미달성 전체 외곽은 흰 선으로 같은 최대 범위를 보여 준다.
    const bar = new HoloBar(this.scene, track.barX, layout.barY, track.barWidth, layout.barHeight, { color: COLOR.missionClaim, trackAlpha: 0.82, outline: true }).addTo(this.list); this.bars.push(bar);
    const label = this.scene.add.text(track.labelX, layout.barY + layout.labelOffsetY, "", textStyle({ role: "emphasis", size: 23, color: COLOR.ink })).setOrigin(0, 0.5);
    this.list.add(label);
    // **연구도는 수령하는 손을 따라 스르륵 오른다.** 값이 순간이동하면 무엇 때문에 올랐는지
    // 보이지 않는다. 수령 직전 값을 기억해 두었다가 거기서부터 굴린다(`rollFrom`).
    const to = research.points;
    const from = Math.min(this.rollFrom ?? to, to);
    this.rollFrom = undefined;
    const paint = (value: number): void => {
      bar.setValue(value / Math.max(1, research.maxPoints));
      label.setText(t("missions.researchGauge", { value: Math.round(value), max: research.maxPoints }));
    };
    paint(from);
    if (from < to) {
      const roll = { value: from };
      this.scene.tweens.add({ targets: roll, value: to, duration: 620, ease: "Cubic.Out", onUpdate: () => paint(roll.value), onComplete: () => paint(to) });
    }
    research.stages.forEach((stage, index) => {
      const stageX = track.stageXs[index];
      // 게이지 자체의 기울기와 같은 / 눈금을 써 임계값이 수직 구분선이 아니라 그래프 마디로 읽힌다.
      const tick = this.scene.add.graphics({ x: stageX, y: layout.barY });
      tick.lineStyle(3, 0xffffff, 0.86).lineBetween(-7, 18, 7, -18);
      this.list?.add(tick);
      const state = stage.claimed ? "claimed" : stage.achieved ? "claimable" : "normal";
      const frame = new RewardFrame(this.scene, stageX, layout.barY + layout.frameOffsetY, { icon: "currency-cheesecake", amount: stage.rewardCheesecake, size: layout.frameSize, state, onClick: stage.achieved && !stage.claimed ? () => void this.claimStage(stage.id) : undefined });
      this.list?.add(frame);
    });
  }

  private async claimOne(id: string): Promise<void> { const result = await this.claims.claim([id]); if (result) await this.applyClaim(result); }
  private async claimAll(): Promise<void> { const ids = this.missions.map(missionDisplayModel).filter((mission) => mission.claimable).map((mission) => mission.id); const result = await this.claims.claim(ids, this.period); if (result) await this.applyClaim(result); }
  private async claimStage(id: string): Promise<void> { const result = await this.claims.claim([], this.period, [id]); if (result) await this.applyClaim(result); }

  /** 응답 스냅샷으로 목록·알림·지갑을 함께 갱신한 뒤 서버가 확정한 지급분만 영수증에 싣는다. */
  private async applyClaim(result: ClaimMissionRewardsResponse): Promise<void> {
    // 굴릴 시작점은 **수령 직전**의 값이다. 응답을 반영한 뒤에 읽으면 이미 오른 값이라 굴러갈
    // 거리가 없다.
    this.rollFrom = this.research?.[this.period]?.points;
    this.missions = result.missions; session.wallet = { ...result.wallet }; this.onWalletChanged?.();
    // 서버 응답의 단계 상태까지 다시 조회해 그래프와 알림 점이 같은 틱에 갱신되게 한다.
    const latest = await this.api.getMissions(); this.missions = latest.missions; this.research = latest.research;
    const count = result.claimedIds.length + result.claimedResearchStageIds.length;
    this.status?.setText(count ? t("missions.claimedCount", { count }) : t("missions.nothingToClaim")); this.render();
    await notificationManager.refresh();
    openRewardPopup(this.scene, this.popups, { title: t("missions.rewardTitle"), items: [
      { icon: "currency-cheesecake", amount: result.rewards.missionCheesecake, label: t("missions.entry") },
      { icon: "currency-cheesecake", amount: result.rewards.researchCheesecake, label: t("missions.researchStage") },
    ] });
  }
}
