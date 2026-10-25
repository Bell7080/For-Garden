import Phaser from "phaser";
import { SCORE_RANK_ME_ID, scoreRankingView, type ScoreRankPeer, type ScoreRankRow } from "../core/scoreRanking";
import { t } from "../i18n";
import { SCORE_RANKING_HUD as L, scoreRankingRowTop } from "./battleStatusLayout";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

interface RowView { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; rank: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; score: Phaser.GameObjects.Text; slot: number; shownRank: number; shownScore: number }

/**
 * 보스전 좌상단의 **점수 랭킹 띠** — 내 위로 둘·나·아래로 하나.
 *
 * 줄은 순위가 아니라 **사람(ID)을 따라간다.** 점수가 이웃을 넘으면 내 줄이 한 칸 위 자리로 슉 올라가고
 * 밀린 이웃은 내려선다 — 값만 갈아 끼우면 방금 읽던 줄이 다른 사람의 것이 된다(기여도 판과 같은 이유).
 * 순위·창은 `scoreRankingView`가 정하고 여기서는 그리기만 한다. 움직임 줄이기에서는 곧바로 자리에 선다.
 */
export class ScoreRankingHud {
  private readonly rows = new Map<string, RowView>();
  private peers: readonly ScoreRankPeer[] = [];
  private lastScore = Number.NaN;
  private lastRank = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly animate: boolean) {}

  /** 상대 점수(나 제외)를 받는다. 비어 있으면 띠를 세우지 않는다. */
  setPeers(peers: readonly ScoreRankPeer[]): void {
    this.peers = peers;
    this.lastScore = Number.NaN;
  }

  get ready(): boolean { return this.peers.length > 0; }

  /** 내 지금 점수. 바뀐 프레임에만 다시 그린다. */
  update(myScore: number): void {
    if (!this.ready) return;
    const score = Math.round(myScore);
    if (score === this.lastScore) return;
    this.lastScore = score;
    const view = scoreRankingView(this.peers, t("battle.rank.me"), score);
    const climbed = this.lastRank > 0 && view.myRank < this.lastRank;
    this.lastRank = view.myRank;
    const keep = new Set(view.rows.map((row) => row.id));
    for (const [id, row] of this.rows) if (!keep.has(id)) this.remove(id, row);
    view.rows.forEach((row, slot) => this.place(row, slot, climbed && row.isMe));
  }

  destroy(): void {
    for (const row of this.rows.values()) { this.scene.tweens.killTweensOf(row.container); row.container.destroy(); }
    this.rows.clear();
  }

  private place(data: ScoreRankRow, slot: number, pop: boolean): void {
    let row = this.rows.get(data.id);
    const y = scoreRankingRowTop(slot);
    if (!row) {
      row = this.build(data, slot);
      this.rows.set(data.id, row);
      row.container.setY(y);
      if (this.animate) { row.container.setAlpha(0); this.scene.tweens.add({ targets: row.container, alpha: 1, duration: 200 }); }
    } else if (row.slot !== slot) {
      row.slot = slot;
      this.scene.tweens.killTweensOf(row.container);
      if (this.animate) {
        // 올라가는 내 줄은 되튀며 앞서고(Back), 밀려나는 이웃은 조용히 내려선다.
        this.scene.tweens.add({ targets: row.container, y, alpha: 1, duration: L.moveMs, ease: data.isMe ? "Back.easeOut" : "Cubic.easeOut" });
      } else row.container.setY(y).setAlpha(1);
    }
    row.container.setDepth(L.depth + (data.isMe ? 1 : 0));
    if (row.shownRank !== data.rank) { row.shownRank = data.rank; row.rank.setText(`${data.rank}`); }
    if (row.shownScore !== data.score) { row.shownScore = data.score; row.score.setText(data.score.toLocaleString()); }
    if (pop && this.animate) {
      this.scene.tweens.add({ targets: row.bg, alpha: { from: 1, to: 0.62 }, duration: 420 });
      this.scene.tweens.add({ targets: row.rank, scale: { from: 1.5, to: 1 }, duration: 320, ease: "Back.easeOut" });
    }
  }

  private remove(id: string, row: RowView): void {
    this.rows.delete(id);
    this.scene.tweens.killTweensOf(row.container);
    if (!this.animate) { row.container.destroy(); return; }
    this.scene.tweens.add({ targets: row.container, alpha: 0, duration: 160, onComplete: () => row.container.destroy() });
  }

  private build(data: ScoreRankRow, slot: number): RowView {
    const me = data.id === SCORE_RANK_ME_ID;
    const h = L.rowHeight;
    const bg = this.scene.add.rectangle(0, 0, L.width, h, me ? COLOR.accent : 0x000000, me ? 0.62 : 0.42).setOrigin(0, 0);
    const stroke = (text: Phaser.GameObjects.Text): Phaser.GameObjects.Text => text.setStroke("#000000", 4).setShadow(0, 2, "#000000", 3, false, true);
    const color = me ? COLOR.ink : COLOR.inkDim;
    const rank = stroke(this.scene.add.text(26, h / 2, `${data.rank}`, textStyle({ role: "display", size: 20, color: me ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    const name = stroke(this.scene.add.text(52, h / 2, data.name, textStyle({ role: "emphasis", size: 20, color })).setOrigin(0, 0.5));
    shrinkTextToWidth(name, 138);
    const score = stroke(this.scene.add.text(L.width - 10, h / 2, data.score.toLocaleString(), textStyle({ role: "display", size: 20, color })).setOrigin(1, 0.5));
    const container = this.scene.add.container(L.left, scoreRankingRowTop(slot), [bg, rank, name, score]).setDepth(L.depth);
    return { container, bg, rank, name, score, slot, shownRank: data.rank, shownScore: data.score };
  }
}
