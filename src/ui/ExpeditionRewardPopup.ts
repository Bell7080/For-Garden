import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type ExpeditionRewardStageDto, type GameApi } from "../api/contracts";
import { BASE_WIDTH } from "../config/gameConfig";
import { session } from "../state/session";
import { Button } from "./Button";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { expeditionRewardTrackFillY, expeditionRewardTrackHeight, expeditionRewardTrackNodes, REWARD_TRACK } from "./expeditionRewardTrack";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 판 안에서 길이 보이는 창의 규격이다. 길이 더 길면 이 창 안에서만 위아래로 흐른다. */
const VIEW = { width: 900, maxHeight: 1160, chromeTop: 168, chromeBottom: 64 } as const;
/** 손가락이 이만큼 움직이면 수령이 아니라 스크롤로 판정한다. */
const DRAG_SLOP = 12;

/**
 * 누적 점수로 여는 기록 보상.
 *
 * 게이지 한 줄 대신 **아래에서 위로 뻗는 길**이다. 마디마다 임계값이 서고 보상은 우·좌를
 * 번갈아 가지처럼 내민다 — 지금 어디까지 왔고 다음 마디에 무엇이 걸려 있는지가 한눈에 읽힌다.
 * 순위표는 화면(기록)이 소유하므로 여기서는 보상만 본다.
 */
export class ExpeditionRewardPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  /** 길 전체를 담아 위아래로 옮기는 층이다. 창 밖은 마스크가 자른다. */
  private track?: Phaser.GameObjects.Container;
  private mask?: Phaser.GameObjects.Graphics;
  private ticker?: Phaser.Time.TimerEvent;
  private scrollY = 0;
  private dragging = false;
  private dragOrigin = 0;
  private dragMoved = 0;
  private pointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private pointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUp?: () => void;
  private wheel?: (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => void;
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
   * 판을 크게 열고 남는 자리를 비워 두면 뒤 화면만 더 가린다. 길이 창보다 길면 판은 창 높이에서
   * 멈추고 안에서 흐른다.
   */
  async open(): Promise<void> {
    if (this.body) return;
    try {
      this.snapshot = await this.api.getExpeditionWeeklyBest();
      this.error = undefined;
    } catch (error) {
      this.snapshot = undefined;
      this.error = this.errorMessage(error);
    }
    const height = VIEW.chromeTop + this.viewHeight() + VIEW.chromeBottom;
    this.popups.open({
      width: BASE_WIDTH - 140, height, title: "기록 보상", titleSize: POPUP_TITLE_SIZE.workboard,
      // 고를 것이 없는 읽기 판이라 바깥을 눌러도 닫힌다.
      dim: true, dimAlpha: 0.72, closeOnBackdrop: true,
      onClose: () => this.dispose(),
    }, (body) => {
      this.body = body;
      this.render();
    });
  }

  /** 길이 짧으면 그만큼만, 길면 창 높이에서 멈춘다. */
  private viewHeight(): number {
    const stages = this.snapshot?.rewardStages.length ?? 0;
    if (stages === 0) return 300;
    return Math.min(VIEW.maxHeight, expeditionRewardTrackHeight(stages));
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
    const view = this.viewHeight();
    const top = -(VIEW.chromeTop + view + VIEW.chromeBottom) / 2;
    if (!snapshot || snapshot.rewardStages.length === 0) {
      content.add(this.scene.add.text(0, 0, this.error ?? "아직 열린 보상 단계가 없습니다", textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
      if (this.error) content.add(new Button(this.scene, 0, 96, { width: 280, height: 76, label: "새로고침", onClick: () => void this.refresh() }));
      return;
    }
    content.add(this.scene.add.text(0, top + 96, `누적 ${snapshot.cumulativeScore.toLocaleString()}  ·  최고 ${snapshot.bestScore.toLocaleString()}`, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0.5));
    if (this.message) content.add(this.scene.add.text(0, top + 140, this.message, textStyle({ role: "emphasis", size: 22, color: COLOR.sortieText })).setOrigin(0.5));

    // 창은 판 안의 고정된 사각이고, 길만 그 안에서 흐른다.
    const viewTop = top + VIEW.chromeTop;
    const track = this.scene.add.container(0, 0);
    this.track = track;
    content.add(track);
    this.buildTrack(track, snapshot.rewardStages, snapshot.cumulativeScore, viewTop, view);
    this.attachScroll(content, viewTop, view);
  }

  /** 길·마디·가지·보상 액자를 한 번에 세운다. 좌표는 순수 규칙이 준 높이를 뒤집어 쓴다. */
  private buildTrack(track: Phaser.GameObjects.Container, stages: readonly ExpeditionRewardStageDto[], cumulative: number, viewTop: number, view: number): void {
    const thresholds = stages.map(({ threshold }) => threshold);
    const nodes = expeditionRewardTrackNodes(stages.length);
    const height = expeditionRewardTrackHeight(stages.length);
    const fill = expeditionRewardTrackFillY(cumulative, thresholds);
    // 길 바닥을 창 아래에 맞춘다. 위로 자라므로 화면 y는 부호를 뒤집는다.
    const base = viewTop + view;
    const at = (y: number): number => base - y;

    // 길은 얇은 실선 한 줄이다. 굵은 판을 세우면 보상 액자와 무게가 같아져 어느 쪽이 길인지
    // 흐려진다. 지나온 구간만 흰 선분 한 겹으로 덧그어 "여기까지 왔다"를 선 하나로 말한다.
    const rail = this.scene.add.graphics();
    rail.lineStyle(3, 0xffffff, 0.22);
    rail.lineBetween(0, at(0), 0, at(height));
    if (fill > 0) {
      rail.lineStyle(5, 0xffffff, 0.95);
      rail.lineBetween(0, at(0), 0, at(fill));
    }
    track.add(rail);

    nodes.forEach((node) => {
      const stage = stages[node.index];
      const reached = cumulative >= stage.threshold;
      const claimable = reached && !stage.claimed;
      const y = at(node.y);
      const branchX = node.side === "right" ? REWARD_TRACK.branch : -REWARD_TRACK.branch;
      // 가지도 같은 굵기의 실선이다. 지나온 마디만 흰 선으로 이어지고 남은 마디는 옅게 남는다.
      const branch = this.scene.add.graphics();
      branch.lineStyle(reached ? 4 : 3, 0xffffff, reached ? 0.9 : 0.22);
      branch.lineBetween(0, y, branchX, y);
      track.add(branch);
      // 마디는 선 위에 찍히는 작은 표식이다. 지나온 마디만 속을 채운다.
      const marker = this.scene.add.graphics();
      const size = 13;
      const diamond = [new Phaser.Geom.Point(0, y - size), new Phaser.Geom.Point(size, y), new Phaser.Geom.Point(0, y + size), new Phaser.Geom.Point(-size, y)];
      if (reached) { marker.fillStyle(0xffffff, 0.95); marker.fillPoints(diamond, true); }
      marker.lineStyle(3, 0xffffff, reached ? 0.95 : 0.4);
      marker.strokePoints(diamond, true);
      track.add(marker);
      track.add(this.scene.add.text(node.side === "right" ? -34 : 34, y, stage.threshold.toLocaleString(), textStyle({ role: "display", size: 27, color: reached ? COLOR.ink : COLOR.inkDim })).setOrigin(node.side === "right" ? 1 : 0, 0.5).setShadow(3, 4, "#04060a", 0, true, true));
      const icon = `currency-${stage.reward.currency}` as "currency-gold" | "currency-fossil" | "currency-gems";
      const frame = new RewardFrame(this.scene, branchX, y, { icon, amount: stage.reward.amount, size: 132, state: stage.claimed ? "claimed" : claimable ? "claimable" : "normal", onClick: claimable ? () => { if (this.dragMoved <= DRAG_SLOP) void this.claim(stage.id); } : undefined });
      track.add(frame);
    });

    // 지금 어디까지 왔는지는 흰 선이 끝나는 자리에 붙는 짧은 칩 하나가 말한다.
    const cursorY = at(Math.max(fill, 40));
    const cursor = this.scene.add.container(0, cursorY);
    cursor.add(drawLayer(this.scene, -128, 0, chipPoints(196, 56, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: 0x0b0f15, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.9 }));
    cursor.add(this.scene.add.text(-128, 0, cumulative.toLocaleString(), textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0.5));
    const tail = this.scene.add.graphics();
    tail.lineStyle(3, 0xffffff, 0.9);
    tail.lineBetween(-30, cursorY, 0, cursorY);
    track.add(tail);
    track.add(cursor);

    // 처음 열 때는 지금 자리가 창 가운데 오도록 맞춘다. 위아래로 남은 길은 손으로 흐른다.
    this.scrollY = Phaser.Math.Clamp(fill - view / 2, 0, Math.max(0, height - view));
    track.setY(this.scrollY);
  }

  /** 길이 창보다 길 때만 드래그와 휠이 같은 값을 움직인다. */
  private attachScroll(parent: Phaser.GameObjects.Container, viewTop: number, view: number): void {
    const stages = this.snapshot?.rewardStages.length ?? 0;
    const height = expeditionRewardTrackHeight(stages);
    const maxScroll = Math.max(0, height - view);
    const track = this.track;
    if (!track) return;

    // 마스크는 부모 컨테이너의 등장 배율을 물려받지 않으므로 매 프레임 월드 좌표에 동기화한다.
    this.mask = this.scene.make.graphics({});
    track.setMask(this.mask.createGeometryMask());
    const sync = (): void => {
      if (!this.mask || !parent.active) return;
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(-VIEW.width / 2, viewTop);
      this.mask.clear().fillStyle(0xffffff, 1).fillRect(topLeft.x, topLeft.y, VIEW.width * matrix.scaleX, view * matrix.scaleY);
    };
    this.ticker?.remove(false);
    this.ticker = this.scene.time.addEvent({ delay: 16, loop: true, callback: sync });
    sync();
    if (maxScroll <= 0) return;

    const scrollTo = (value: number): void => {
      this.scrollY = Phaser.Math.Clamp(value, 0, maxScroll);
      track.setY(this.scrollY);
    };
    const inside = (pointer: Phaser.Input.Pointer): boolean => {
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(-VIEW.width / 2, viewTop);
      const bottomRight = matrix.transformPoint(VIEW.width / 2, viewTop + view);
      return pointer.x >= topLeft.x && pointer.x <= bottomRight.x && pointer.y >= topLeft.y && pointer.y <= bottomRight.y;
    };
    this.pointerDown = (pointer) => { if (!inside(pointer)) return; this.dragging = true; this.dragMoved = 0; this.dragOrigin = this.scrollY - pointer.y; };
    this.pointerMove = (pointer) => { if (!this.dragging || !pointer.isDown) return; this.dragMoved += Math.abs(pointer.velocity.y); scrollTo(this.dragOrigin + pointer.y); };
    this.pointerUp = () => { this.dragging = false; this.scene.time.delayedCall(0, () => { this.dragMoved = 0; }); };
    this.wheel = (pointer, _objects, _deltaX, deltaY) => { if (inside(pointer)) scrollTo(this.scrollY + deltaY); };
    this.scene.input.on("pointerdown", this.pointerDown);
    this.scene.input.on("pointermove", this.pointerMove);
    this.scene.input.on("pointerup", this.pointerUp);
    this.scene.input.on("wheel", this.wheel);
  }

  private reset(): Phaser.GameObjects.Container | undefined {
    this.releaseScroll();
    this.content?.destroy();
    if (!this.body) return undefined;
    this.content = this.scene.add.container(0, 0);
    this.body.add(this.content);
    return this.content;
  }

  /** 마스크와 씬 입력 리스너는 본문 자식이 아니므로 화면을 갈아 끼울 때 직접 뗀다. */
  private releaseScroll(): void {
    this.ticker?.remove(false); this.ticker = undefined;
    this.mask?.destroy(); this.mask = undefined;
    if (this.pointerDown) this.scene.input.off("pointerdown", this.pointerDown);
    if (this.pointerMove) this.scene.input.off("pointermove", this.pointerMove);
    if (this.pointerUp) this.scene.input.off("pointerup", this.pointerUp);
    if (this.wheel) this.scene.input.off("wheel", this.wheel);
    this.pointerDown = undefined; this.pointerMove = undefined; this.pointerUp = undefined; this.wheel = undefined;
    this.track = undefined;
  }

  private dispose(): void {
    this.releaseScroll();
    this.content?.destroy();
    this.content = undefined;
    this.body = undefined;
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
