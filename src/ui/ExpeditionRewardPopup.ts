import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type GameApi } from "../api/contracts";
import { BASE_WIDTH } from "../config/gameConfig";
import { session } from "../state/session";
import { Button } from "./Button";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addExpeditionRewardStage } from "./expeditionRewardStage";
import { COLOR, textStyle } from "./theme";

/** 판 안에서 단계 줄이 차지하는 세로 규격이다. 판 높이도 이 값으로 계산한다. */
const ROW = { first: 190, gap: 170, tail: 60 } as const;

/**
 * 누적 점수로 여는 기록 보상만 담은 팝업.
 *
 * 순위표는 화면(랭킹)이 소유하고, 여기서는 "얼마를 더 쌓으면 무엇을 받는가"만 본다. 둘을 한
 * 장에 겹치면 순위와 보상이 서로의 자리를 다투고, 수령 뒤 목록이 통째로 다시 그려진다.
 */
export class ExpeditionRewardPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private claiming = false;
  private snapshot?: Awaited<ReturnType<GameApi["getExpeditionWeeklyBest"]>>;
  private message = "";
  private error?: string;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly api: GameApi = gameApi,
    private readonly onClaimed?: () => void,
  ) {}

  /**
   * 단계 수를 먼저 알아낸 뒤 그만큼만 판을 연다.
   *
   * 판을 크게 열고 남는 자리를 비워 두면 뒤 화면만 더 가린다. 서버 표의 단계가 늘거나 줄어도
   * 판 높이가 따라오도록 조회를 먼저 하고, 실패하면 짧은 알림 판만 연다.
   */
  async open(): Promise<void> {
    if (this.body) return;
    try {
      this.snapshot = await this.api.getExpeditionWeeklyBest();
    } catch (error) {
      this.snapshot = undefined;
      this.error = this.errorMessage(error);
    }
    const rows = this.snapshot?.rewardStages.length ?? 0;
    const height = rows > 0 ? ROW.first + rows * ROW.gap + ROW.tail : 420;
    this.popups.open({ width: BASE_WIDTH - 140, height, title: "기록 보상", titleSize: POPUP_TITLE_SIZE.workboard, // 고를 것이 없는 읽기 판이라 바깥을 눌러도 닫힌다.
      dim: true, dimAlpha: 0.72, closeOnBackdrop: true, onClose: () => { this.content?.destroy(); this.content = undefined; this.body = undefined; } }, (body) => {
      this.body = body;
      this.render();
    });
  }

  /** 수령 뒤에도 서버가 다시 준 단계 상태만 그린다. 화면이 로컬로 수령 여부를 기억하지 않는다. */
  private async refresh(message = ""): Promise<void> {
    if (!this.body) return;
    this.message = message;
    try {
      this.snapshot = await this.api.getExpeditionWeeklyBest();
      this.error = undefined;
    } catch (error) {
      this.error = this.errorMessage(error);
    }
    this.render();
  }

  /** 조회 결과 한 벌만 그린다. 판 크기는 열 때 이미 단계 수에 맞춰져 있다. */
  private render(): void {
    const content = this.reset();
    if (!content) return;
    const snapshot = this.snapshot;
    if (!snapshot) {
      content.add(this.scene.add.text(0, -40, this.error ?? "기록 보상을 불러오지 못했습니다.", textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
      content.add(new Button(this.scene, 0, 90, { width: 280, height: 76, label: "새로고침", onClick: () => void this.refresh() }));
      return;
    }
    const top = -(ROW.first + snapshot.rewardStages.length * ROW.gap + ROW.tail) / 2;
    content.add(this.scene.add.text(0, top + 96, `누적 ${snapshot.cumulativeScore.toLocaleString()}  ·  최고 ${snapshot.bestScore.toLocaleString()}`, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0.5));
    if (this.message) content.add(this.scene.add.text(0, top + 142, this.message, textStyle({ role: "emphasis", size: 22, color: COLOR.sortieText })).setOrigin(0.5));
    snapshot.rewardStages.forEach((stage, index) => addExpeditionRewardStage(this.scene, content, stage, snapshot.cumulativeScore, top + ROW.first + index * ROW.gap, (id) => void this.claim(id)));
  }

  private reset(): Phaser.GameObjects.Container | undefined {
    this.content?.destroy();
    if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0);
    this.body.add(this.content);
    return this.content;
  }

  /** 지급은 서버가 한 처리 단위로 확정하고 화면은 새 스냅샷만 다시 그린다. */
  private async claim(stageId: string): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      const result = await this.api.claimExpeditionReward({ requestId: `expedition-reward:${new Date().toISOString().slice(0, 10)}:${stageId}:${Date.now()}`, stageId });
      session.wallet = { ...result.wallet };
      this.onClaimed?.();
      await this.refresh(result.alreadyClaimed ? "이미 수령한 보상" : `${result.reward.amount.toLocaleString()} 수령 완료`);
    } catch (error) {
      this.error = this.errorMessage(error);
      this.render();
    } finally {
      this.claiming = false;
    }
  }

  /** 서버 오류 코드를 다음 행동을 고를 수 있는 짧은 상태로 바꾼다. */
  private errorMessage(error: unknown): string {
    if (!(error instanceof GameApiError)) return "기록 보상을 불러오지 못했습니다.";
    const labels: Record<string, string> = {
      EXPEDITION_REWARD_NOT_EARNED: "점수가 부족합니다. 최신 진행량을 확인해 주세요.",
      EXPEDITION_REWARD_NOT_FOUND: "주차가 변경되었거나 보상 단계가 종료되었습니다.",
      INVALID_STATE: "주차가 변경되었습니다. 기록을 다시 확인해 주세요.",
    };
    return labels[error.code] ?? error.message;
  }
}
