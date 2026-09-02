import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type ExpeditionLeaderboardEntry, type GameApi } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { PREVIEW_FRIENDS } from "../data/friends";
import { Button } from "./Button";
import { addPopupBackButton } from "./IconButton";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 아직 실제 이용자 풀이 없는 단일 계정 서버라, 친구 목록의 임시 인물을 빌려 순위표가 늘 여럿
 * 있는 것처럼 채운다. 실제 서버가 다수 이용자 기록을 반환하면 이 보정은 지운다.
 */
function placeholderEntries(bestScore: number): ExpeditionLeaderboardEntry[] {
  const baseline = bestScore > 0 ? bestScore : 1_400;
  const multipliers = [1.42, 0.86, 0.51];
  return PREVIEW_FRIENDS.map((friend, index) => ({
    // 순위 미리보기 역시 소셜 공개 헤더의 표시 이름만 사용하고 내부 계정 키는 노출하지 않는다.
    rank: 0, playerId: friend.id, displayName: friend.displayName,
    score: Math.max(1, Math.round(baseline * multipliers[index % multipliers.length])),
    achievedAt: "", isMe: false,
  }));
}

/** 서버 주차 스냅샷만 사용해 준비와 결과 화면이 공유하는 원정 기록판을 그린다. */
export class ExpeditionRankingPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi) {}

  open(): void {
    if (this.body) return;
    const width = BASE_WIDTH - 100; const height = BASE_HEIGHT - 180;
    this.popups.open({ width, height, title: "원정 주간 기록", titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.content?.destroy(); this.content = undefined; this.body = undefined; } }, (body, close) => {
      this.body = body;
      // 침수 도시 원경이 팝업의 장소를 정하고, 전투 필드는 낮은 alpha의 질감층으로만 합성한다.
      addPopupBackgroundImage(this.scene, body, BACKGROUND.expeditionRanking, { x: 0, y: 0, width, height, overlayStrength: 0.72 });
      // 필드의 넓은 빈 노면은 순위 행 뒤를 복잡하게 만들지 않도록 12%만 남기고 페이드는 중복하지 않는다.
      addPopupBackgroundImage(this.scene, body, BACKGROUND.expeditionField, { x: 0, y: 0, width, height, imageAlpha: 0.12, overlayStrength: 0 });
      addPopupBackButton(this.scene, body, width, height, close);
      void this.refresh();
    });
  }

  /** 최고 기록과 순위는 동시에 조회하되 주차가 어긋나면 오래된 순위표를 표시하지 않는다. */
  private async refresh(): Promise<void> {
    if (!this.body) return;
    this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    this.content.add(this.scene.add.text(0, -700, "기록 동기화 중", textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    try {
      const [best, leaderboard] = await Promise.all([this.api.getExpeditionWeeklyBest(), this.api.getExpeditionLeaderboard(10)]);
      if (best.weekKey !== leaderboard.weekKey) throw new GameApiError("INVALID_STATE", "주차가 변경되어 기록을 다시 불러옵니다.");
      this.render(best.bestScore, leaderboard.entries);
    } catch (error) {
      this.renderError(this.errorMessage(error));
    }
  }

  /** 보상 목록은 "주간 보상" 팝업(ExpeditionRewardPopup)의 몫이라 여기서는 순위만 크게 보여준다. */
  private render(bestScore: number, entries: ExpeditionLeaderboardEntry[]): void {
    if (!this.body) return;
    this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    const merged = [...entries, ...placeholderEntries(bestScore)]
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    this.content.add(this.scene.add.text(-410, -700, "주간 순위", textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0, 0.5));
    this.content.add(this.scene.add.text(410, -700, "동점: 최고점 최초 달성 순", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(1, 0.5));
    merged.slice(0, 8).forEach((entry, index) => this.renderRank(entry, -560 + index * 95));
  }

  /** 내 행은 기존 강조색과 1.06배 확대만 사용하며 별도 외곽선을 추가하지 않는다. */
  private renderRank(entry: ExpeditionLeaderboardEntry, y: number): void {
    if (!this.content) return;
    const row = this.scene.add.container(0, y).setScale(entry.isMe ? 1.06 : 1);
    const panel = drawLayer(this.scene, 0, 0, chipPoints(780, 72), { fill: entry.isMe ? 0x263844 : 0x171d25, alpha: HOLO.glass, edge: entry.isMe ? COLOR.accent : COLOR.panelEdge, edgeAlpha: entry.isMe ? 0.65 : 0.22 });
    row.add([panel, this.scene.add.text(-350, 0, `${entry.rank}위`, textStyle({ role: "emphasis", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5), this.scene.add.text(-210, 0, entry.displayName, textStyle({ role: "body", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5), this.scene.add.text(350, 0, entry.score.toLocaleString(), textStyle({ role: "emphasis", size: 23 })).setOrigin(1, 0.5)]);
    this.content.add(row);
  }

  private renderError(message: string): void {
    if (!this.body) return; this.content?.destroy(); this.content = this.scene.add.container(0, 0); this.body.add(this.content);
    this.content.add(this.scene.add.text(0, -50, message, textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
    this.content.add(new Button(this.scene, 0, 90, { width: 280, height: 76, label: "새로고침", onClick: () => void this.refresh() }));
  }

  /** 서버 오류 코드를 사용자가 다음 행동을 결정할 수 있는 짧은 상태로 바꾼다. */
  private errorMessage(error: unknown): string {
    if (!(error instanceof GameApiError)) return "원정 기록을 불러오지 못했습니다.";
    const labels: Record<string, string> = { INVALID_STATE: "주차가 변경되었습니다. 기록을 다시 확인해 주세요." };
    return labels[error.code] ?? error.message;
  }
}
