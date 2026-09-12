import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type ExpeditionLeaderboardEntry, type GameApi } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { getRelic } from "../data/relics";
import { Button } from "./Button";
import { FaceFrame } from "./FaceFrame";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { chipPoints, drawFrameVignette, drawLayer, HOLO } from "./holo";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import {
  RANKING_LIST, RANKING_VISIBLE_RANKS, placeholderRankingEntries, rankedLeaderboard, rankingMedal,
  rankingRowY, rankingScrollMetrics,
} from "./expeditionRankingLayout";
import { COLOR, textStyle } from "./theme";

/** 서버 주차 스냅샷만 사용해 준비와 결과 화면이 공유하는 원정 기록판을 그린다. */
export class ExpeditionRankingPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  /** 목록 마스크는 표시 객체의 자식이 아니므로 이 창이 직접 만들고 직접 지운다. */
  private listMask?: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi) {}

  open(): void {
    if (this.body) return;
    const width = BASE_WIDTH - 100; const height = BASE_HEIGHT - 180;
    this.popups.open({ width, height, title: t("ranking.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: false, backButton: true, onClose: () => { this.destroyListMask(); this.content?.destroy(); this.content = undefined; this.body = undefined; } }, (body) => {
      this.body = body;
      /*
       * **원화는 판과 같은 실루엣으로 잘린다.** 팝업 몸판은 왼쪽 위·오른쪽 아래가 크게 깎여
       * 있는데, 원화를 네모로 깔면 그 두 모서리에서 그림이 삐져나와 판 뒤에 다른 사각형이 한
       * 장 더 있는 것처럼 보인다. 같은 비율(`POPUP_BODY_BEVEL_RATIO`)로 만든 도형을 마스크로
       * 넘겨 판과 한 장으로 읽히게 한다.
       */
      const shape = popupArtShape(width, height);
      addPopupBackgroundImage(this.scene, body, BACKGROUND.expeditionRanking, { x: 0, y: 0, width, height, maskShape: shape, overlayStrength: 0.72 });
      // 필드의 넓은 빈 노면은 순위 행 뒤를 복잡하게 만들지 않도록 12%만 남기고 페이드는 중복하지 않는다.
      addPopupBackgroundImage(this.scene, body, BACKGROUND.expeditionField, { x: 0, y: 0, width, height, maskShape: shape, imageAlpha: 0.12, overlayStrength: 0 });
      // 가장자리를 안쪽으로 살짝 눌러 원화가 판 테두리에서 끊기지 않고 가라앉게 한다. 줄여 가며
      // 두르는 옛 비네트는 가로세로 비율이 다른 판에서 검은 잔상을 남기므로 쓰지 않는다.
      body.add(drawFrameVignette(this.scene, 0, 0, width, height, { strength: 0.5, spread: 0.18 }).setMask(popupBodyShapeMask(this.scene, body, shape)));
      void this.refresh();
    });
  }

  /** 최고 기록과 순위는 동시에 조회하되 주차가 어긋나면 오래된 순위표를 표시하지 않는다. */
  private async refresh(): Promise<void> {
    if (!this.body) return;
    this.resetContent();
    this.content?.add(this.scene.add.text(0, -700, t("ranking.syncing"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    try {
      const [best, leaderboard] = await Promise.all([this.api.getExpeditionWeeklyBest(), this.api.getExpeditionLeaderboard(RANKING_VISIBLE_RANKS)]);
      if (best.weekKey !== leaderboard.weekKey) throw new GameApiError("INVALID_STATE", t("ranking.weekRolledReload"));
      this.render(best.bestScore, leaderboard.entries);
    } catch (error) {
      this.renderError(this.errorMessage(error));
    }
  }

  /** 동적 영역만 갈아 끼운다. 판·제목·원화는 PopupLayer와 open이 끝까지 소유한다. */
  private resetContent(): void {
    this.destroyListMask();
    this.content?.destroy();
    this.content = this.scene.add.container(0, 0);
    this.body?.add(this.content);
  }

  /** 보상 목록은 "주간 보상" 팝업(ExpeditionRewardPopup)의 몫이라 여기서는 순위만 크게 보여준다. */
  private render(bestScore: number, entries: ExpeditionLeaderboardEntry[]): void {
    if (!this.body) return;
    this.resetContent();
    const content = this.content;
    if (!content) return;
    // 실제 이용자 풀이 생기면 표본 보정만 지운다 — 순위·스크롤 규칙은 그대로 남는다.
    const merged = rankedLeaderboard([...entries, ...placeholderRankingEntries(bestScore, RANKING_VISIBLE_RANKS)]);
    // 순위는 누적 보상 점수가 아니라 한 판 최고 점수로 정렬된다는 기준을 제목에서 바로 밝힌다.
    content.add(this.scene.add.text(-410, -720, t("ranking.bestScoreOrder"), textStyle({ role: "display", size: 36, color: COLOR.accentText })).setOrigin(0, 0.5));
    content.add(this.scene.add.text(410, -720, t("ranking.tieBreak"), textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(1, 0.5));

    /*
     * **100등까지 아래로 내려 본다.** 여덟 줄만 세워 두면 내가 몇 등인지, 위가 얼마나 먼지를
     * 알 수 없다. 목록은 제 컨테이너에서 흐르고 창 밖으로 나간 줄은 마스크가 자른다 — 판을
     * 키우지 않고 그 안에서 흐르게 하는 것은 기록 보상 길과 같은 규칙이다.
     */
    const metrics = rankingScrollMetrics(merged.length);
    const list = this.scene.add.container(0, metrics.startY);
    const matrix = this.body.getWorldTransformMatrix();
    const center = matrix.transformPoint(0, metrics.viewportCenterY);
    const right = matrix.transformPoint(RANKING_LIST.rowWidth / 2, metrics.viewportCenterY);
    const bottom = matrix.transformPoint(0, metrics.viewportCenterY + metrics.viewportHeight / 2);
    // GeometryMask는 팝업 컨테이너 변환을 물려받지 않으므로 지금의 월드 좌표·배율로 만든다.
    this.listMask = this.scene.add.rectangle(center.x, center.y,
      Math.hypot(right.x - center.x, right.y - center.y) * 2,
      Math.hypot(bottom.x - center.x, bottom.y - center.y) * 2, 0xffffff).setVisible(false);
    list.setMask(this.listMask.createGeometryMask());
    content.add(list);
    merged.forEach((entry, index) => this.renderRank(list, entry, rankingRowY(index)));

    // 끌기와 휠이 같은 한계를 쓴다. 줄이 적으면 minY가 0이라 아무 일도 일어나지 않는다.
    let offset = 0; let dragY = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); list.y = metrics.startY + offset; };
    const hit = this.scene.add.rectangle(0, metrics.viewportCenterY, RANKING_LIST.rowWidth, metrics.viewportHeight, 0xffffff, 0)
      .setInteractive({ draggable: true, useHandCursor: true });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65));
    content.add(hit);
    content.sendToBack(hit);
  }

  /**
   * 한 줄.
   *
   * **1·2·3등은 금·은·동으로 선다**(`rankingMedal`) — 순위표에서 먼저 읽히는 것이 "누가 위에
   * 있나"라, 그 셋만 색을 가지면 줄을 세지 않고도 단이 보인다. 내 줄은 지금까지처럼 강조색과
   * 1.04배 확대로 알리고 별도 외곽선을 두르지 않는다.
   *
   * 왼쪽에는 그 사람의 **애착 렐릭 얼굴**이 선다. 이름만 늘어선 목록에서는 누가 누구인지
   * 읽히지 않고, 서버가 준 값이 있을 때만 세우므로 화면이 개체를 지어내지 않는다.
   */
  private renderRank(list: Phaser.GameObjects.Container, entry: ExpeditionLeaderboardEntry, y: number): void {
    const medal = rankingMedal(entry.rank);
    const row = this.scene.add.container(0, y).setScale(entry.isMe ? 1.04 : 1);
    const accent = medal?.edge ?? (entry.isMe ? COLOR.accent : COLOR.panelEdge);
    row.add(drawLayer(this.scene, 0, 0, chipPoints(RANKING_LIST.rowWidth, RANKING_LIST.rowHeight), {
      fill: medal?.fill ?? (entry.isMe ? 0x263844 : 0x171d25),
      alpha: HOLO.glass,
      edge: accent,
      edgeAlpha: medal ? 0.95 : entry.isMe ? 0.65 : 0.22,
      glow: medal ? { color: medal.edge, strength: 0.26, height: 0.7 } : undefined,
    }));
    const rankColor = medal?.text ?? (entry.isMe ? COLOR.accentText : COLOR.ink);
    row.add(this.scene.add
      .text(RANKING_LIST.rankX, 0, `${entry.rank}`, textStyle({ role: "display", size: medal ? 44 : 34, color: rankColor }))
      .setOrigin(0.5));
    if (entry.favoriteRelicId) {
      row.add(new FaceFrame(this.scene, RANKING_LIST.faceX, 0, {
        portraitAssetId: getRelic(entry.favoriteRelicId).portraitAssetId,
        size: RANKING_LIST.faceSize,
        color: accent,
      }));
    }
    row.add(this.scene.add
      .text(RANKING_LIST.nameX, 0, entry.displayName, textStyle({ role: "emphasis", size: 30, color: medal?.text ?? (entry.isMe ? COLOR.accentText : COLOR.ink) }))
      .setOrigin(0, 0.5));
    row.add(this.scene.add
      .text(RANKING_LIST.scoreX, 0, entry.score.toLocaleString(), textStyle({ role: "display", size: 32, color: rankColor }))
      .setOrigin(1, 0.5));
    list.add(row);
  }

  private renderError(message: string): void {
    if (!this.body) return;
    this.resetContent();
    this.content?.add(this.scene.add.text(0, -50, message, textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
    this.content?.add(new Button(this.scene, 0, 90, { width: 280, height: 76, label: t("ranking.refresh"), onClick: () => void this.refresh() }));
  }



  /** 마스크는 표시 목록 밖에 있으므로 목록을 갈아 끼울 때 함께 지운다. */
  private destroyListMask(): void {
    this.listMask?.destroy();
    this.listMask = undefined;
  }

  /** 서버 오류 코드를 사용자가 다음 행동을 결정할 수 있는 짧은 상태로 바꾼다. */
  private errorMessage(error: unknown): string {
    if (!(error instanceof GameApiError)) return t("ranking.loadFailed");
    const labels: Record<string, string> = { INVALID_STATE: t("ranking.weekRolled") };
    return labels[error.code] ?? error.message;
  }
}

/** 팝업 몸판과 **같은 실루엣**. 값이 두 곳에 있으면 한쪽만 고쳐 그림이 판 밖으로 나간다. */
