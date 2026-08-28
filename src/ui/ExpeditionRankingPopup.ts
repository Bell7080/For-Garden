import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type ExpeditionLeaderboardEntry, type ExpeditionRewardStageDto, type GameApi } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { session } from "../state/session";
import { Button } from "./Button";
import { addPopupBackButton } from "./IconButton";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addExpeditionRewardStage } from "./expeditionRewardStage";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 서버 주차 스냅샷만 사용해 준비와 결과 화면이 공유하는 원정 기록판을 그린다. */
export class ExpeditionRankingPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private busyStageId?: string;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi, private readonly onWalletChanged?: () => void) {}

  open(): void {
    if (this.body) return;
    const width = BASE_WIDTH - 100; const height = BASE_HEIGHT - 180;
    this.popups.open({ width, height, title: "원정 주간 기록", titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.content?.destroy(); this.content = undefined; this.body = undefined; } }, (body, close) => {
      this.body = body;
      addPopupBackButton(this.scene, body, width, height, close);
      void this.refresh();
    });
  }

  /** 최고 기록과 순위는 동시에 조회하되 주차가 어긋나면 오래된 순위표를 표시하지 않는다. */
  private async refresh(message = ""): Promise<void> {
    if (!this.body) return;
    this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    this.content.add(this.scene.add.text(0, -700, "기록 동기화 중", textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    try {
      const [best, leaderboard] = await Promise.all([this.api.getExpeditionWeeklyBest(), this.api.getExpeditionLeaderboard(10)]);
      if (best.weekKey !== leaderboard.weekKey) throw new GameApiError("INVALID_STATE", "주차가 변경되어 기록을 다시 불러옵니다.");
      this.render(best.bestScore, best.cumulativeScore, best.rewardStages, leaderboard.entries, message);
    } catch (error) {
      this.renderError(this.errorMessage(error));
    }
  }

  private render(bestScore: number, cumulativeScore: number, stages: ExpeditionRewardStageDto[], entries: ExpeditionLeaderboardEntry[], message: string): void {
    if (!this.body) return;
    this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    this.content.add(this.scene.add.text(-410, -700, `최고 ${bestScore.toLocaleString()}  ·  누적 ${cumulativeScore.toLocaleString()}`, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0, 0.5));
    if (message) this.content.add(this.scene.add.text(410, -700, message, textStyle({ role: "emphasis", size: 21, color: COLOR.sortieText })).setOrigin(1, 0.5));
    this.content.add(this.scene.add.text(-410, -630, "누적 보상", textStyle({ role: "emphasis", size: 28 })).setOrigin(0, 0.5));
    stages.forEach((stage, index) => this.content && addExpeditionRewardStage(this.scene, this.content, stage, cumulativeScore, -500 + index * 170, (id) => void this.claim(id)));
    this.content.add(this.scene.add.text(-410, 80, "주간 순위", textStyle({ role: "emphasis", size: 28 })).setOrigin(0, 0.5));
    this.content.add(this.scene.add.text(410, 80, "동점: 최고점 최초 달성 순", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(1, 0.5));
    if (!entries.length) this.content.add(this.scene.add.text(0, 190, "아직 등록된 기록이 없습니다", textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
    entries.slice(0, 6).forEach((entry, index) => this.renderRank(entry, 160 + index * 95));
  }

  /** 내 행은 기존 강조색과 1.06배 확대만 사용하며 별도 외곽선을 추가하지 않는다. */
  private renderRank(entry: ExpeditionLeaderboardEntry, y: number): void {
    if (!this.content) return;
    const row = this.scene.add.container(0, y).setScale(entry.isMe ? 1.06 : 1);
    const panel = drawLayer(this.scene, 0, 0, chipPoints(780, 72), { fill: entry.isMe ? 0x263844 : 0x171d25, alpha: HOLO.glass, edge: entry.isMe ? COLOR.accent : COLOR.panelEdge, edgeAlpha: entry.isMe ? 0.65 : 0.22 });
    row.add([panel, this.scene.add.text(-350, 0, `${entry.rank}위`, textStyle({ role: "emphasis", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5), this.scene.add.text(-210, 0, entry.displayName, textStyle({ role: "body", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5), this.scene.add.text(350, 0, entry.score.toLocaleString(), textStyle({ role: "emphasis", size: 23 })).setOrigin(1, 0.5)]);
    this.content.add(row);
  }

  private async claim(stageId: string): Promise<void> {
    if (this.busyStageId) return; this.busyStageId = stageId;
    try {
      const result = await this.api.claimExpeditionReward({ requestId: `expedition-reward:${resultWeekKey()}:${stageId}:${Date.now()}`, stageId });
      session.wallet = { ...result.wallet }; this.onWalletChanged?.();
      await this.refresh(result.alreadyClaimed ? "이미 수령한 보상" : `${result.reward.amount.toLocaleString()} 수령 완료`);
    } catch (error) { this.renderError(this.errorMessage(error), true); }
    finally { this.busyStageId = undefined; }
  }

  private renderError(message: string, retry = false): void {
    if (!this.body) return; this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    this.content.add(this.scene.add.text(0, -50, message, textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
    if (retry) this.content.add(new Button(this.scene, 0, 90, { width: 280, height: 76, label: "새로고침", onClick: () => void this.refresh() }));
  }

  /** 서버 오류 코드를 사용자가 다음 행동을 결정할 수 있는 짧은 상태로 바꾼다. */
  private errorMessage(error: unknown): string {
    if (!(error instanceof GameApiError)) return "원정 기록을 불러오지 못했습니다.";
    const labels: Record<string, string> = { EXPEDITION_REWARD_NOT_EARNED: "점수가 부족합니다. 최신 진행량을 확인해 주세요.", EXPEDITION_REWARD_NOT_FOUND: "주차가 변경되었거나 보상 단계가 종료되었습니다.", INVALID_STATE: "주차가 변경되었습니다. 기록을 다시 확인해 주세요." };
    return labels[error.code] ?? error.message;
  }
}

/** 요청 ID의 주차 부분은 충돌 방지용 힌트이며 실제 판정은 서버 시각이 소유한다. */
function resultWeekKey(): string { return new Date().toISOString().slice(0, 10); }
