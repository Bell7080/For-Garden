import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { MissionDto } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawLayer, HoloBar, HOLO } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";

/** 일일·주간 임무 확인과 일괄 수령만 담당하는 독립 상세 화면이다. */
export class MissionsScene extends Phaser.Scene {
  private period: "daily" | "weekly" = "daily";
  private missions: MissionDto[] = [];
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  /** HoloBar는 컨테이너가 아니므로 탭 교체 때 별도로 수명을 정리한다. */
  private bars: HoloBar[] = [];

  constructor() { super("missions"); }

  create(): void {
    setDebugScene("missions");
    addSceneBackground(this, BACKGROUND.lobby);
    // 밝은 광장 위에서 목록이 읽히도록 기존 유리 바탕색만 얇게 덮는다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.68).setDepth(-29);
    this.add.text(54, 76, "임무 기록", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    this.status = this.add.text(BASE_WIDTH - 54, 96, "동기화 중", textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(1, 0);
    new Button(this, 290, 220, { width: 430, height: 92, label: "일일", onClick: () => this.selectPeriod("daily") });
    new Button(this, 790, 220, { width: 430, height: 92, label: "주간", onClick: () => this.selectPeriod("weekly") });
    new Button(this, BASE_WIDTH / 2, 1610, { width: 680, height: 120, label: "완료 보상 일괄 수령", variant: "primary", onClick: () => void this.claimAll() });
    addBackButton(this, () => this.scene.start("lobby"));
    void this.refresh();
  }

  /** 탭은 서버를 다시 부르지 않고 같은 최신 목록의 표시 범위만 바꾼다. */
  private selectPeriod(period: "daily" | "weekly"): void { this.period = period; this.renderList(); }

  /** 서버 정규화가 끝난 목록만 화면 모델로 사용한다. */
  private async refresh(): Promise<void> {
    const response = await gameApi.getMissions();
    this.missions = response.missions;
    this.status?.setText(`미수령 ${response.claimableCount}`);
    this.renderList();
  }

  /** 홀로그램 칩과 공용 게이지로 현재 탭의 임무 행을 다시 그린다. */
  private renderList(): void {
    this.content?.destroy();
    this.bars.forEach((bar) => bar.destroy());
    this.bars = [];
    this.content = this.add.container(0, 0);
    this.missions.filter((mission) => mission.period === this.period).forEach((mission, index) => {
      const y = 390 + index * 210;
      const panel = drawLayer(this, BASE_WIDTH / 2, y, chipPoints(920, 160, { bevel: { topLeft: 30, topRight: 0, bottomRight: 30, bottomLeft: 0 } }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.4 });
      const title = this.add.text(110, y - 54, mission.title, textStyle({ role: "emphasis", size: 31, color: mission.claimed ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0);
      const reward = this.add.text(970, y - 50, mission.claimed ? "수령 완료" : `잡초 +${mission.rewardWeeds}`, textStyle({ role: "body", size: 25, color: mission.claimed ? COLOR.inkDim : COLOR.accentText })).setOrigin(1, 0);
      const bar = new HoloBar(this, 360, y + 38, 500, 18, { color: COLOR.accent });
      bar.setValue(mission.progress / mission.target);
      this.bars.push(bar);
      const progress = this.add.text(900, y + 24, `${mission.progress} / ${mission.target}`, textStyle({ role: "emphasis", size: 25 })).setOrigin(1, 0);
      this.content?.add([panel, title, reward, progress]);
    });
  }

  /** 완료된 미수령 항목을 서버의 단일 수령 처리에 맡긴 뒤 최신 목록을 다시 받는다. */
  private async claimAll(): Promise<void> {
    const result = await gameApi.claimMissionRewards();
    this.status?.setText(result.claimedIds.length ? `잡초 +${result.weedsEarned}` : "수령할 보상 없음");
    await this.refresh();
  }
}
