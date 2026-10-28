import { openCompetitiveRewards } from "./CompetitiveRewardPopup";
import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { DuelRankingEntryDto, GameApi } from "../api/contracts";
import type { DuelTierId } from "../core/duelArena";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { Button } from "./Button";
import { addClippedHit } from "./clippedHit";
import { addRankRewardChip, RANKING_POPUP_REWARD_CHIP, type RankRewardPeriod } from "./RankingChips";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_PODIUM, DUEL_RANKING_TIER_BUTTON, DUEL_RANKING_VIEW, DUEL_TIER_COLOR } from "./duelLayout";
import { openDuelTierGuide } from "./DuelGuidePopups";
import { squeezeTextToWidth } from "./textFit";
import { RANKING_LIST, rankingMedal, rankingRowY, rankingScrollMetrics } from "./expeditionRankingLayout";
import { profileAvatarSizeFor } from "./profileFrameGeometry";
import { addRankingFace } from "./rankingFace";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";

/**
 * 결투장 순위 — 원정 순위표와 **같은 줄 규격**(`RANKING_LIST`)·같은 금은동을 쓴다. 다른 것은 점수 옆에
 * 작은 티어 표식이 선다는 것뿐이다. 순위표 **아래에** 내 줄이 붙박여 한 번 더 서서, 목록을 어디까지 내려도,
 * 100등 밖이어도 내 자리가 보인다(`DUEL_RANKING_VIEW`).
 */
export type RankingRowEntry = Pick<DuelRankingEntryDto, "rank" | "displayName" | "score" | "isMe" | "avatarRelicId" | "frameId"> & {
  favoriteRelicId?: string;
  /** 티어가 없는 순위(고대 지층)는 비운다 — 줄에 티어 표식이 서지 않는다. */
  tierId?: DuelTierId;
};

/**
 * 순위표가 읽는 곳 — 결투장과 아레나가 같은 창을 쓰고 이것만 갈아 끼운다(제목·목록·두 버튼이 여는 표).
 * 점수 단위도 여기서 정한다(결투장 점 · 아레나 RP).
 */
export interface RankingSource {
  title: string;
  load(): Promise<{ entries: readonly RankingRowEntry[]; me: RankingRowEntry | null }>;
  /** 보상 표·티어 안내가 없는 순위(고대 지층)는 비워 두면 그 버튼이 서지 않는다. */
  openRewards?(me: RankingRowEntry | null): void;
  /** 보상 칩의 기간 — 비우면 주간이다(고대 지층은 월간). */
  rewardPeriod?: RankRewardPeriod;
  openTiers?(): void;
  /** 점수 칸의 글. 비우면 천 단위 쉼표를 찍은 수다(고대 지층은 `B87`). */
  formatScore?(score: number): string;
}

export class DuelRankingPopup {
  private body?: Phaser.GameObjects.Container;
  private me: RankingRowEntry | null = null;
  private readonly source: RankingSource;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, currentTier: DuelTierId, api: GameApi = gameApi, source?: RankingSource) {
    this.source = source ?? {
      title: t("duel.link.ranking"),
      load: () => api.getDuelRanking(),
      openRewards: (me) => openCompetitiveRewards(scene, popups, "duel", me?.rank),
      openTiers: () => openDuelTierGuide(scene, popups, currentTier),
    };
  }

  open(): void {
    if (this.body) return;
    const width = BASE_WIDTH - 100; const height = BASE_HEIGHT - 180;
    this.popups.open({ width, height, title: this.source.title, titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.76, closeOnBackdrop: true, backButton: true, onClose: () => { this.body = undefined; } }, (body) => {
      this.body = body;
      const { openRewards, openTiers } = this.source;
      // 순위 보상은 왼쪽 위의 금빛 칩이다 — 결투장·아레나·고대 지층·원정 순위표가 같은 칩(`addRankRewardChip`)을 같은 자리에 세운다.
      if (openRewards) addRankRewardChip(this.scene, body, -width / 2 + RANKING_POPUP_REWARD_CHIP.left, -height / 2 + RANKING_POPUP_REWARD_CHIP.top, { period: this.source.rewardPeriod ?? "weekly", onClick: () => openRewards(this.me) });
      // 티어 안내는 순위표 안에서 연다 — "몇 등인가" 다음에 읽는 것이 "어느 티어부터 무엇을 받나"다.
      if (openTiers) body.add(new Button(this.scene, width / 2 - DUEL_RANKING_TIER_BUTTON.right, -height / 2 + DUEL_RANKING_TIER_BUTTON.top, {
        width: DUEL_RANKING_TIER_BUTTON.width, height: DUEL_RANKING_TIER_BUTTON.height, label: t("duel.link.tiers"), icon: "arena-tier", fontSize: 26,
        onClick: () => openTiers(),
      }));
      void this.load(body);
    });
  }

  private async load(body: Phaser.GameObjects.Container): Promise<void> {
    const content = this.scene.add.container(0, 0);
    body.add(content);
    try {
      const ranking = await this.source.load();
      if (this.body !== body) return;
      this.me = ranking.me;
      this.render(body, content, ranking.entries, ranking.me);
    } catch {
      if (this.body !== body) return;
      content.add(new Button(this.scene, 0, 0, { width: 280, height: 76, label: t("battle.result.retry"), onClick: () => { content.destroy(true); void this.load(body); } }));
    }
  }

  private render(body: Phaser.GameObjects.Container, content: Phaser.GameObjects.Container, entries: readonly RankingRowEntry[], me: RankingRowEntry | null): void {
    // 내 줄은 목록 아래에 붙박여 선다 — 순위를 매기지 않은 판(아직 한 판도 안 함)이면 「순위 없음」만 선다.
    content.add(this.scene.add.rectangle(0, DUEL_RANKING_VIEW.divider, RANKING_LIST.rowWidth, 2, COLOR.accent, 0.45));
    // 붙박인 내 줄 위에 「내 순위」 이름표 — 목록의 한 줄과 같은 판이라 이것이 없으면 목록이 거기서 끊긴 것처럼 읽힌다.
    content.add(this.scene.add.text(-RANKING_LIST.rowWidth / 2, DUEL_RANKING_VIEW.divider - 22, t("ranking.mine"), textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0, 0.5));
    if (me) this.renderRow(content, me, DUEL_RANKING_VIEW.meY);
    else content.add(this.scene.add.text(0, DUEL_RANKING_VIEW.meY, t("duel.rank.none"), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));

    // 시상대는 목록 머리로 함께 흐른다 — 줄 규격은 원정 순위표와 같게 두고 목록만 그만큼 내려선다.
    const podium = entries.length > 0 ? DUEL_PODIUM.height : 0;
    const base = rankingScrollMetrics(entries.length, DUEL_RANKING_VIEW.viewport);
    const metrics = { ...base, minY: Math.min(0, base.minY - podium) };
    const list = this.scene.add.container(0, metrics.startY);
    const matrix = body.getWorldTransformMatrix();
    const center = matrix.transformPoint(0, metrics.viewportCenterY);
    const right = matrix.transformPoint(RANKING_LIST.rowWidth / 2, metrics.viewportCenterY);
    const bottom = matrix.transformPoint(0, metrics.viewportCenterY + metrics.viewportHeight / 2);
    // GeometryMask는 팝업 컨테이너 변환을 물려받지 않으므로 지금의 월드 좌표·배율로 만든다.
    const maskShape = this.scene.add.rectangle(center.x, center.y,
      Math.hypot(right.x - center.x, right.y - center.y) * 2,
      Math.hypot(bottom.x - center.x, bottom.y - center.y) * 2, 0xffffff).setVisible(false);
    list.setMask(maskShape.createGeometryMask());
    // 마스크는 그것이 자르는 판과 같은 목숨을 산다 — 닫히는 연출 동안에도 판이 그려지므로 판이 죽을 때 함께 푼다.
    body.once(Phaser.GameObjects.Events.DESTROY, () => { list.clearMask(true); maskShape.destroy(); });
    content.add(list);
    if (podium > 0) this.renderPodium(list, entries.slice(0, 3));
    entries.forEach((entry, index) => this.renderRow(list, entry, podium + rankingRowY(index)));

    let offset = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); list.y = metrics.startY + offset; };
    // 끄는 면도 창 안에서만 손을 받는다(`addClippedHit`) — 창 밖으로 남으면 아래의 뒤로가기가 막힌다.
    const clip = { left: maskShape.x - maskShape.width / 2, right: maskShape.x + maskShape.width / 2, top: maskShape.y - maskShape.height / 2, bottom: maskShape.y + maskShape.height / 2 };
    const hit = addClippedHit(this.scene, content, 0, metrics.viewportCenterY, RANKING_LIST.rowWidth, metrics.viewportHeight, () => clip);
    hit.disableInteractive();
    attachDragScroll(this.scene, { owner: hit, root: content, bounds: () => new Phaser.Geom.Rectangle(clip.left, clip.top, clip.right - clip.left, clip.bottom - clip.top), onDelta: move });
    addScrollHint(this.scene, content, { x: 0, y: metrics.viewportCenterY, width: RANKING_LIST.rowWidth, height: metrics.viewportHeight, owner: hit, read: () => ({ offset, min: metrics.minY }) });
  }

  /** 1·2·3등의 단 — 가운데가 1등이고 가장 높다. 단의 색은 순위표 줄의 금·은·동과 같다. */
  private renderPodium(parent: Phaser.GameObjects.Container, top: readonly RankingRowEntry[]): void {
    top.forEach((entry, index) => {
      const spot = DUEL_PODIUM.spots[index];
      const medal = rankingMedal(entry.rank);
      if (!spot || !medal) return;
      const plinthY = DUEL_PODIUM.baseY - spot.plinth / 2;
      parent.add(drawLayer(this.scene, spot.x, plinthY, slantedRect(DUEL_PODIUM.plinthWidth, spot.plinth), {
        fill: medal.fill, alpha: 0.94, edge: medal.edge, edgeAlpha: 0.95, glow: { color: medal.edge, strength: 0.22, height: 0.8 },
      }));
      parent.add(this.scene.add.text(spot.x, plinthY, `${entry.rank}`, textStyle({ role: "display", size: Math.min(56, spot.plinth - 8), color: medal.text })).setOrigin(0.5));
      const faceY = DUEL_PODIUM.baseY - spot.plinth - 44 - spot.face / 2;
      addRankingFace(this.scene, parent, entry, entry.displayName, { x: spot.x, y: faceY, size: profileAvatarSizeFor(spot.face) });
      parent.add(squeezeTextToWidth(this.scene.add.text(spot.x, DUEL_PODIUM.baseY - spot.plinth - 10, entry.displayName, textStyle({ role: "emphasis", size: 24, color: medal.text }))
        .setOrigin(0.5, 1).setStroke("#05070a", 5), DUEL_PODIUM.plinthWidth));
    });
  }

  private renderRow(parent: Phaser.GameObjects.Container, entry: RankingRowEntry, y: number): void {
    const medal = rankingMedal(entry.rank);
    const tone = entry.tierId ? DUEL_TIER_COLOR[entry.tierId] : { text: COLOR.accentText };
    const row = this.scene.add.container(0, y).setScale(entry.isMe ? 1.04 : 1);
    const accent = medal?.edge ?? (entry.isMe ? COLOR.accent : COLOR.panelEdge);
    row.add(drawLayer(this.scene, 0, 0, chipPoints(RANKING_LIST.rowWidth, RANKING_LIST.rowHeight), {
      fill: medal?.fill ?? (entry.isMe ? 0x263844 : 0x171d25), alpha: HOLO.glass, edge: accent,
      edgeAlpha: medal ? 0.95 : entry.isMe ? 0.65 : 0.22,
      glow: medal ? { color: medal.edge, strength: 0.26, height: 0.7 } : undefined,
    }));
    const rankColor = medal?.text ?? (entry.isMe ? COLOR.accentText : COLOR.ink);
    row.add(this.scene.add.text(RANKING_LIST.rankX, 0, `${entry.rank}`, textStyle({ role: "display", size: medal ? 44 : 34, color: rankColor })).setOrigin(0.5));
    addRankingFace(this.scene, row, entry, entry.displayName);
    row.add(this.scene.add.text(RANKING_LIST.nameX, 0, entry.displayName, textStyle({ role: "emphasis", size: 30, color: rankColor })).setOrigin(0, 0.5));
    if (entry.tierId) addDuelTierEmblem(this.scene, row, RANKING_LIST.scoreX - 170, 0, 54, entry.tierId);
    const score = this.source.formatScore ? this.source.formatScore(entry.score) : entry.score.toLocaleString();
    row.add(this.scene.add.text(RANKING_LIST.scoreX, 0, score, textStyle({ role: "display", size: 32, color: tone.text })).setOrigin(1, 0.5));
    parent.add(row);
  }
}
