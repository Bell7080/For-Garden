import Phaser from "phaser";
import { SCORE_RANK_ME_ID, scoreRankingView, type ScoreRankPeer, type ScoreRankRow } from "../core/scoreRanking";
import { t } from "../i18n";
import { SCORE_RANKING_HUD as L, scoreRankingRowTop } from "./battleStatusLayout";
import { rankingMedal } from "./expeditionRankingLayout";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addRankingFace } from "./rankingFace";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

interface RowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  rank: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
  slot: number;
  pinned: boolean;
  shownRank: number;
  shownScore: number;
}

/** 내 줄에 서는 얼굴과 이름 — 순위표에서 다른 사람이 나를 보는 것과 같은 얼굴이다. */
export interface ScoreRankSelf { name: string; favoriteRelicId?: string }

/**
 * 보스전 좌상단의 **점수 랭킹 띠** — 내 위로 둘·나·아래로 하나, 1위는 늘 맨 위에 선다.
 *
 * 줄은 순위가 아니라 **사람(ID)을 따라간다.** 점수가 이웃을 넘으면 내 줄이 한 칸 위 자리로 슉 올라가고
 * 밀린 이웃은 내려선다 — 값만 갈아 끼우면 방금 읽던 줄이 다른 사람의 것이 된다(기여도 판과 같은 이유).
 * 줄 하나는 순위표 화면의 줄을 줄여 놓은 것이다 — 금·은·동 판, 애착 렐릭 얼굴(`addRankingFace`), 이름, 점수.
 * 순위·창은 `scoreRankingView`가 정하고 여기서는 그리기만 한다. 움직임 줄이기에서는 곧바로 자리에 선다.
 */
export class ScoreRankingHud {
  private readonly rows = new Map<string, RowView>();
  private peers: readonly ScoreRankPeer[] = [];
  private self: ScoreRankSelf = { name: "" };
  private loaded = false;
  private lastScore = Number.NaN;
  private lastRank = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly animate: boolean) {}

  /**
   * 상대 점수(나 제외)와 내 얼굴·이름을 받는다. 상대가 없어도 띠는 선다 — 혼자 친 판이면 내가 1위다.
   */
  setPeers(peers: readonly ScoreRankPeer[], self: ScoreRankSelf = { name: "" }): void {
    this.peers = peers;
    this.self = self;
    this.loaded = true;
    this.lastScore = Number.NaN;
  }

  get ready(): boolean { return this.loaded; }

  /** 내 지금 점수. 바뀐 프레임에만 다시 그린다. */
  update(myScore: number): void {
    if (!this.ready) return;
    const score = Math.round(myScore);
    if (score === this.lastScore) return;
    this.lastScore = score;
    const view = scoreRankingView(this.peers, this.self.name || t("battle.rank.me"), score);
    const climbed = this.lastRank > 0 && view.myRank < this.lastRank;
    this.lastRank = view.myRank;
    const keep = new Set(view.rows.map((row) => row.id));
    for (const [id, row] of this.rows) if (!keep.has(id)) this.remove(id, row);
    const pinned = view.rows[0]?.pinned === true;
    view.rows.forEach((row, slot) => this.place(row, slot, pinned, climbed && row.isMe));
  }

  destroy(): void {
    for (const row of this.rows.values()) { this.scene.tweens.killTweensOf(row.container); row.container.destroy(); }
    this.rows.clear();
  }

  private place(data: ScoreRankRow, slot: number, pinned: boolean, pop: boolean): void {
    let row = this.rows.get(data.id);
    const y = scoreRankingRowTop(slot, pinned) + L.rowHeight / 2;
    if (!row) {
      row = this.build(data, slot, pinned);
      this.rows.set(data.id, row);
      row.container.setY(y);
      if (this.animate) { row.container.setAlpha(0); this.scene.tweens.add({ targets: row.container, alpha: 1, duration: 200 }); }
    } else if (row.slot !== slot || row.pinned !== pinned) {
      row.slot = slot;
      row.pinned = pinned;
      this.scene.tweens.killTweensOf(row.container);
      if (this.animate) {
        // 올라가는 내 줄은 되튀며 앞서고(Back), 밀려나는 이웃은 조용히 내려선다.
        this.scene.tweens.add({ targets: row.container, y, alpha: 1, duration: L.moveMs, ease: data.isMe ? "Back.easeOut" : "Cubic.easeOut" });
      } else row.container.setY(y).setAlpha(1);
    }
    row.container.setDepth(L.depth + (data.isMe ? 1 : 0));
    if (row.shownRank !== data.rank) {
      // 금·은·동이 바뀌는 순간 판과 글자 색도 함께 바뀐다 — 1위로 올라서면 그 줄이 금빛이 된다.
      const medalChanged = rankingMedal(row.shownRank) !== rankingMedal(data.rank);
      row.shownRank = data.rank;
      row.rank.setText(`${data.rank}`);
      if (medalChanged) this.paint(row, data);
    }
    if (row.shownScore !== data.score) {
      row.shownScore = data.score;
      row.score.setText(data.score.toLocaleString());
      shrinkTextToWidth(row.score, L.scoreRight - L.nameX - L.nameWidth - 12);
    }
    if (pop && this.animate) {
      this.scene.tweens.add({ targets: row.bg, alpha: { from: 0.35, to: 1 }, duration: 420 });
      this.scene.tweens.add({ targets: row.rank, scale: { from: 1.5, to: 1 }, duration: 320, ease: "Back.easeOut" });
    }
  }

  private remove(id: string, row: RowView): void {
    this.rows.delete(id);
    this.scene.tweens.killTweensOf(row.container);
    if (!this.animate) { row.container.destroy(); return; }
    this.scene.tweens.add({ targets: row.container, alpha: 0, duration: 160, onComplete: () => row.container.destroy() });
  }

  /** 줄의 판·글자 색. 메달(1·2·3위)이 먼저이고, 그 밖에서는 내 줄만 강조색이다. */
  private paint(row: RowView, data: ScoreRankRow): void {
    const medal = rankingMedal(data.rank);
    const me = data.id === SCORE_RANK_ME_ID;
    const bg = drawLayer(this.scene, L.width / 2, 0, chipPoints(L.width, L.rowHeight, { bevel: { topLeft: 8, bottomRight: 8 } }), {
      fill: medal?.fill ?? (me ? 0x263844 : 0x0b1016),
      alpha: me || medal ? 0.86 : HOLO.glass,
      edge: medal?.edge ?? (me ? COLOR.accent : COLOR.panelEdge),
      edgeAlpha: medal ? 0.95 : me ? 0.8 : 0.3,
      shadow: { x: 0, y: 3 },
      glow: medal || me ? { color: medal?.edge ?? COLOR.accent, strength: me ? 0.32 : 0.22, height: 0.7 } : undefined,
    });
    // 내 줄은 금·은·동 판에 올라서도 내 줄로 읽혀야 한다 — 왼쪽 끝에 강조색 띠 하나를 세운다.
    if (me) bg.fillStyle(COLOR.accent, 1).fillRect(-L.width / 2 + 1, -L.rowHeight / 2 + 9, 5, L.rowHeight - 9);
    row.bg.destroy();
    row.bg = bg;
    row.container.addAt(bg, 0);
    const ink = medal?.text ?? (me ? COLOR.accentText : COLOR.ink);
    row.rank.setColor(ink).setFontSize(medal ? 26 : 22);
    row.name.setColor(me ? COLOR.accentText : medal?.text ?? COLOR.ink);
    row.score.setColor(ink);
  }

  private build(data: ScoreRankRow, slot: number, pinned: boolean): RowView {
    const me = data.id === SCORE_RANK_ME_ID;
    const stroke = (text: Phaser.GameObjects.Text): Phaser.GameObjects.Text => text.setStroke("#000000", 4).setShadow(0, 2, "#000000", 3, false, true);
    const rank = stroke(this.scene.add.text(L.rankX, 0, `${data.rank}`, textStyle({ role: "display", size: 22, color: COLOR.ink })).setOrigin(0.5));
    const name = stroke(this.scene.add.text(L.nameX, 0, data.name, textStyle({ role: "emphasis", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
    shrinkTextToWidth(name, L.nameWidth);
    const score = stroke(this.scene.add.text(L.scoreRight, 0, data.score.toLocaleString(), textStyle({ role: "display", size: 22, color: COLOR.ink })).setOrigin(1, 0.5));
    shrinkTextToWidth(score, L.scoreRight - L.nameX - L.nameWidth - 12);
    const bg = this.scene.add.graphics();
    const container = this.scene.add.container(L.left, scoreRankingRowTop(slot, pinned) + L.rowHeight / 2, [bg, rank, name, score]).setDepth(L.depth);
    const medal = rankingMedal(data.rank);
    addRankingFace(this.scene, container, data.favoriteRelicId, data.name, medal?.edge ?? (me ? COLOR.accent : COLOR.panelEdge), { x: L.faceX, size: L.faceSize });
    const row: RowView = { container, bg, rank, name, score, slot, pinned, shownRank: data.rank, shownScore: data.score };
    this.paint(row, data);
    return row;
  }
}
