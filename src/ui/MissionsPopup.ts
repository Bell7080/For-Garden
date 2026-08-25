import Phaser from "phaser";
import type { GameApi, MissionDto, ClaimMissionRewardsResponse } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawLayer, HoloBar, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { openRewardPopup } from "./RewardPopup";
import { COLOR, textStyle } from "./theme";
import { MissionClaimController, missionDisplayModel } from "./missionsPopupModel";

/** 로비 씬을 유지한 채 일일·주간 임무와 실제 확정 보상을 표시하는 공용 작업판이다. */
export class MissionsPopup {
  private period: "daily" | "weekly" = "daily";
  private missions: MissionDto[] = [];
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
    this.popups.open({ width: BASE_WIDTH - 70, height: BASE_HEIGHT - 210, title: "임무 기록", dim: true, dimAlpha: 0.72, onClose: () => { this.destroyContent(); this.body = undefined; this.onClose?.(); } }, (body) => {
      this.body = body;
      this.status = this.scene.add.text(450, -770, "동기화 중", textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(1, 0); body.add(this.status);
      body.add(new Button(this.scene, -245, -665, { width: 420, height: 82, label: "일일", onClick: () => this.select("daily") }));
      body.add(new Button(this.scene, 245, -665, { width: 420, height: 82, label: "주간", onClick: () => this.select("weekly") }));
      body.add(new Button(this.scene, 0, 720, { width: 650, height: 105, label: "완료 보상 일괄 수령", variant: "primary", onClick: () => void this.claimAll() }));
      void this.refresh();
    });
  }

  private select(period: "daily" | "weekly"): void { this.period = period; this.render(); }
  private async refresh(): Promise<void> { const result = await this.api.getMissions(); this.missions = result.missions; this.status?.setText(`미수령 ${result.claimableCount}`); this.render(); }
  private destroyContent(): void { this.list?.destroy(); this.list = undefined; this.bars.forEach((bar) => bar.destroy()); this.bars = []; }

  /** 카드와 보상 액자 모두 같은 콜백을 받으며 수령 완료 행은 명확히 흐리게 남긴다. */
  private render(): void {
    this.destroyContent(); if (!this.body) return;
    this.list = this.scene.add.container(0, 0); this.body.add(this.list);
    this.missions.filter((mission) => mission.period === this.period).forEach((raw, index) => {
      const mission = missionDisplayModel(raw); const y = -520 + index * 190;
      const panel = drawLayer(this.scene, 0, y, chipPoints(900, 150, { bevel: { topLeft: 28, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: mission.claimed ? 0x171b20 : mission.claimable ? 0x3b2b13 : 0x1a1f27, alpha: mission.claimed ? 0.52 : HOLO.glass, edge: mission.claimable ? COLOR.missionClaim : COLOR.accent, edgeAlpha: mission.claimed ? 0.16 : 0.55 });
      const title = this.scene.add.text(-400, y - 52, mission.title, textStyle({ role: "emphasis", size: 28, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0);
      const bar = new HoloBar(this.scene, -390, y + 35, 520, 18, { color: mission.claimable ? COLOR.missionClaim : COLOR.accent }); bar.setValue(mission.ratio); this.bars.push(bar);
      // 진행 수는 게이지 끝에 바로 붙여 시선이 카드 반대편까지 왕복하지 않게 한다.
      const progress = this.scene.add.text(150, y + 18, mission.progressLabel, textStyle({ role: "emphasis", size: 24, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0);
      const reward = new RewardFrame(this.scene, 365, y, { icon: "currency-cheesecake", amount: mission.rewardCheesecake, size: 116, state: mission.state, onClick: mission.claimable ? () => void this.claimOne(mission.id) : undefined });
      const state = this.scene.add.text(275, y + 60, mission.claimed ? "수령 완료" : mission.claimable ? "수령 가능" : "진행 중", textStyle({ role: "body", size: 19, color: mission.claimable ? "#ffbf66" : COLOR.inkDim })).setOrigin(0.5, 0);
      this.list?.add([panel, title, progress, reward, state]);
      if (mission.claimable) { const hit = this.scene.add.rectangle(0, y, 900, 150, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerup", () => void this.claimOne(mission.id)); this.list?.add(hit); this.list?.bringToTop(reward); }
    });
  }

  private async claimOne(id: string): Promise<void> { const result = await this.claims.claim([id]); if (result) await this.applyClaim(result); }
  private async claimAll(): Promise<void> { const ids = this.missions.map(missionDisplayModel).filter((mission) => mission.claimable).map((mission) => mission.id); const result = await this.claims.claim(ids); if (result) await this.applyClaim(result); }

  /** 응답 스냅샷으로 목록·알림·지갑을 함께 갱신한 뒤 서버가 확정한 지급분만 영수증에 싣는다. */
  private async applyClaim(result: ClaimMissionRewardsResponse): Promise<void> {
    this.missions = result.missions; session.wallet = { ...result.wallet }; this.onWalletChanged?.();
    this.status?.setText(result.claimedIds.length ? `수령 ${result.claimedIds.length}건` : "수령할 보상 없음"); this.render();
    await notificationManager.refresh();
    openRewardPopup(this.scene, this.popups, { title: "임무 보상", items: result.cheesecakeEarned > 0 ? [{ icon: "currency-cheesecake", amount: result.cheesecakeEarned }] : [] });
  }
}
