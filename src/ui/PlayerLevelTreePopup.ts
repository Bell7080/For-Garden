import Phaser from "phaser";
import { t } from "../i18n";
import { PLAYER_LEVEL_UP_REWARD } from "../core/playerLevel";
import { findItem } from "../data/items";
import { profileFrameOrDefault } from "../data/profileFrames";
import type { PortraitAssetId } from "../core/types";
import { BASE_WIDTH } from "../config/gameConfig";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { expeditionRewardTrackFillY, expeditionRewardTrackHeight, expeditionRewardTrackNodes, REWARD_TRACK } from "./expeditionRewardTrack";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { playerLevelMilestones, type PlayerLevelMilestone } from "./playerLevelTreeModel";
import { contentNameKey } from "./PlayerProfilePopup";
import { ProfileAvatar } from "./ProfileAvatar";
import { COLOR, textStyle } from "./theme";
import { LEVEL_TREE_CURSOR, LEVEL_TREE_LEAF, LEVEL_TREE_VIEW } from "./playerExpLayout";


export interface PlayerLevelTreeOptions {
  level: number;
  /** 잎의 테두리 미리보기가 씌울 얼굴 — 카드의 얼굴과 같은 값이다. */
  portraitAssetId?: PortraitAssetId;
  fallback: string;
}

/**
 * 연구원 레벨이 여는 것들 — **아래에서 위로 뻗는 가지나무**.
 *
 * 기록 보상 길과 같은 문법이다(`expeditionRewardTrack` — 줄기는 얇은 실선, 지나온 구간만 흰 선,
 * 마디는 작은 마름모, 가지는 우·좌를 번갈아 뻗는다). 게이지나 표로 두면 "지금 어디쯤이고 다음에
 * 무엇이 오나"가 한눈에 읽히지 않는다. 잎에는 그 레벨에 열리는 테두리(지금 얼굴에 씌운 모습)와
 * 콘텐츠, 그 레벨의 스테미나 상한이 선다. 고를 것이 없는 읽기 판이라 바깥을 눌러도 닫힌다.
 */
export class PlayerLevelTreePopup {
  private mask?: Phaser.GameObjects.Graphics;
  private ticker?: Phaser.Time.TimerEvent;
  private listeners: Array<() => void> = [];
  private scrollY = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly options: PlayerLevelTreeOptions) {}

  open(): void {
    const milestones = playerLevelMilestones();
    const view = Math.min(LEVEL_TREE_VIEW.maxHeight, expeditionRewardTrackHeight(milestones.length));
    const height = LEVEL_TREE_VIEW.chromeTop + view + LEVEL_TREE_VIEW.chromeBottom;
    this.popups.open({
      width: BASE_WIDTH - 140, height, title: t("profile.levelTree.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, dimAlpha: 0.72, closeOnBackdrop: true,
    }, (body) => {
      // 마스크와 씬 입력은 판이 **실제로 사라질 때** 푼다 — 닫는 연출 동안에도 판은 그려진다.
      body.once(Phaser.GameObjects.Events.DESTROY, () => this.release());
      const top = -height / 2;
      this.buildHeader(body, top);
      const viewTop = top + LEVEL_TREE_VIEW.chromeTop;
      const track = this.scene.add.container(0, 0);
      body.add(track);
      this.buildTrack(track, milestones, viewTop, view);
      this.attachScroll(body, track, viewTop, view, expeditionRewardTrackHeight(milestones.length));
    });
  }

  /** 머리 — 레벨이 오를 때마다 받는 병. 스테미나를 채우는 대신 주는 것이라 나무 맨 위에 늘 선다. */
  private buildHeader(body: Phaser.GameObjects.Container, top: number): void {
    const { itemId, quantity } = PLAYER_LEVEL_UP_REWARD;
    const item = findItem(itemId);
    const y = top + 118;
    const label = this.scene.add.text(0, y, t("profile.levelTree.perLevel", { item: item?.name ?? "", count: quantity }), textStyle({ role: "emphasis", size: 26, color: COLOR.ink }))
      .setOrigin(0, 0.5);
    const icon = 72;
    const gap = 18;
    const startX = -(icon + gap + label.width) / 2;
    if (item?.icon.kind === "asset") addFramedIcon(this.scene, body, startX + icon / 2, y, icon, item.icon.key);
    label.setX(startX + icon + gap);
    body.add(label);
  }

  /** 줄기·마디·가지·잎을 한 번에 세운다. 좌표는 기록 보상 길의 순수 규칙을 뒤집어 쓴다. */
  private buildTrack(track: Phaser.GameObjects.Container, milestones: readonly PlayerLevelMilestone[], viewTop: number, view: number): void {
    const levels = milestones.map(({ level }) => level);
    const nodes = expeditionRewardTrackNodes(milestones.length);
    const height = expeditionRewardTrackHeight(milestones.length);
    const fill = expeditionRewardTrackFillY(this.options.level, levels);
    const at = (y: number): number => viewTop + view - y;

    const rail = this.scene.add.graphics();
    rail.lineStyle(3, 0xffffff, 0.22);
    rail.lineBetween(0, at(0), 0, at(height));
    if (fill > 0) { rail.lineStyle(5, 0xffffff, 0.95); rail.lineBetween(0, at(0), 0, at(fill)); }
    track.add(rail);

    // 지금 레벨에 가장 가까운 마디 — 칩은 그 마디의 잎과 **반대쪽**에 서야 잎을 덮지 않는다.
    const nearest = nodes.reduce<(typeof nodes)[number] | undefined>((best, node) => !best || Math.abs(node.y - fill) < Math.abs(best.y - fill) ? node : best, undefined);
    const onNode = nearest !== undefined && Math.abs(nearest.y - fill) < LEVEL_TREE_CURSOR.snap;
    nodes.forEach((node) => {
      const milestone = milestones[node.index];
      const reached = this.options.level >= milestone.level;
      const y = at(node.y);
      const dir = node.side === "right" ? 1 : -1;
      const branch = this.scene.add.graphics();
      branch.lineStyle(reached ? 4 : 3, 0xffffff, reached ? 0.9 : 0.22);
      branch.lineBetween(0, y, dir * (REWARD_TRACK.branch + LEVEL_TREE_LEAF.offset - LEVEL_TREE_LEAF.width / 2), y);
      track.add(branch);
      const marker = this.scene.add.graphics();
      const size = 13;
      const diamond = [new Phaser.Geom.Point(0, y - size), new Phaser.Geom.Point(size, y), new Phaser.Geom.Point(0, y + size), new Phaser.Geom.Point(-size, y)];
      if (reached) { marker.fillStyle(0xffffff, 0.95); marker.fillPoints(diamond, true); }
      marker.lineStyle(3, 0xffffff, reached ? 0.95 : 0.4);
      marker.strokePoints(diamond, true);
      track.add(marker);
      // 지금 레벨이 곧 이 마디면 칩을 따로 세우지 않고 마디 이름이 강조색으로 그 몫을 한다.
      const current = onNode && node === nearest;
      track.add(this.scene.add.text(-dir * 34, y, `LV.${milestone.level}`, textStyle({ role: "display", size: 27, color: current ? COLOR.accentText : reached ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(dir > 0 ? 1 : 0, 0.5).setShadow(3, 4, "#04060a", 0, true, true));
      track.add(this.buildLeaf(dir * (REWARD_TRACK.branch + LEVEL_TREE_LEAF.offset), y, milestone, reached));
    });

    // 지금 레벨은 흰 선이 끝나는 자리에 붙는 칩 하나가 말한다. 가까운 마디의 잎 반대편에 선다.
    if (!onNode) {
      const side = nearest?.side === "left" ? 1 : -1;
      const cursorY = at(Math.max(fill, 40));
      const chipX = side * LEVEL_TREE_CURSOR.x;
      const cursor = this.scene.add.container(0, cursorY);
      cursor.add(drawLayer(this.scene, chipX, 0, chipPoints(LEVEL_TREE_CURSOR.width, 56, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: 0x0b0f15, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.9 }));
      cursor.add(this.scene.add.text(chipX, 0, `LV.${this.options.level}`, textStyle({ role: "display", size: 27, color: COLOR.accentText })).setOrigin(0.5));
      const tail = this.scene.add.graphics();
      tail.lineStyle(3, 0xffffff, 0.9);
      tail.lineBetween(side * (LEVEL_TREE_CURSOR.x - LEVEL_TREE_CURSOR.width / 2), cursorY, 0, cursorY);
      track.add(tail);
      track.add(cursor);
    }

    this.scrollY = Phaser.Math.Clamp(fill - view / 2, 0, Math.max(0, height - view));
    track.setY(this.scrollY);
  }

  /**
   * 잎 한 장 — 그 레벨에 열리는 것들과 스테미나 상한.
   *
   * 테두리는 이름만 적지 않고 **지금 얼굴에 그 테두리를 씌운 모습**을 세운다(선택창과 같은 규칙) —
   * 테두리는 색이 아니라 모양이라 이름만으로는 무엇을 얻는지 읽히지 않는다. 아직 닿지 않은 잎은
   * 판과 글자만 가라앉히고 그림은 그대로 둔다(무엇이 열리는지는 보여야 목표가 된다).
   */
  private buildLeaf(x: number, y: number, milestone: PlayerLevelMilestone, reached: boolean): Phaser.GameObjects.Container {
    const L = LEVEL_TREE_LEAF;
    const leaf = this.scene.add.container(x, y);
    const frameUnlock = milestone.unlocks.find((unlock) => unlock.kind === "frame");
    const lines: Array<{ text: string; color: string }> = milestone.unlocks.map((unlock) => unlock.kind === "frame"
      ? { text: t("profile.levelTree.frame", { name: profileFrameOrDefault(unlock.frameId).displayName }), color: reached ? COLOR.accentText : COLOR.ink }
      : { text: t("profile.levelTree.content", { content: t(contentNameKey(unlock.contentId)) }), color: reached ? COLOR.sortieText : COLOR.ink });
    lines.push({ text: t("profile.levelTree.stamina", { max: milestone.staminaMax }), color: COLOR.inkDim });
    const avatarSpace = frameUnlock ? L.avatar + L.avatarGap : 0;
    const height = Math.max(L.avatar + L.padY * 2, lines.length * L.lineHeight + L.padY * 2);
    leaf.add(drawLayer(this.scene, 0, 0, chipPoints(L.width, height, { bevel: { topLeft: 18, bottomRight: 18 } }), {
      fill: 0x0b0f15, alpha: reached ? 0.94 : 0.78, edge: reached ? COLOR.accent : 0xffffff, edgeAlpha: reached ? 0.8 : 0.2,
    }));
    const left = -L.width / 2 + 24;
    if (frameUnlock) {
      leaf.add(new ProfileAvatar(this.scene, left + L.avatar / 2, 0, {
        size: L.avatar, frameId: frameUnlock.frameId, portraitAssetId: this.options.portraitAssetId, fallback: this.options.fallback,
      }));
    }
    const textLeft = left + avatarSpace;
    const textWidth = L.width / 2 - 20 - textLeft;
    lines.forEach((line, index) => {
      const lineY = (index - (lines.length - 1) / 2) * L.lineHeight;
      // 마지막 줄(스테미나 상한)만 곁들이는 수라 본문 굵기다.
      const style = index === lines.length - 1 ? textStyle({ role: "body", size: 23, color: line.color }) : textStyle({ role: "emphasis", size: 23, color: line.color });
      const text = this.scene.add.text(textLeft, lineY, line.text, style).setOrigin(0, 0.5);
      if (text.width > textWidth) text.setScale(textWidth / text.width, 1);
      leaf.add(text);
    });
    if (!reached) leaf.setAlpha(0.72);
    return leaf;
  }

  /** 나무가 창보다 길 때만 드래그와 휠이 같은 값을 움직인다. */
  private attachScroll(parent: Phaser.GameObjects.Container, track: Phaser.GameObjects.Container, viewTop: number, view: number, height: number): void {
    const width = LEVEL_TREE_VIEW.width;
    this.mask = this.scene.make.graphics({});
    track.setMask(this.mask.createGeometryMask());
    const sync = (): void => {
      if (!this.mask || !parent.active) return;
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(-width / 2, viewTop);
      this.mask.clear().fillStyle(0xffffff, 1).fillRect(topLeft.x, topLeft.y, width * matrix.scaleX, view * matrix.scaleY);
    };
    this.ticker = this.scene.time.addEvent({ delay: 16, loop: true, callback: sync });
    sync();
    const maxScroll = Math.max(0, height - view);
    if (maxScroll <= 0) return;
    const scrollTo = (value: number): void => { this.scrollY = Phaser.Math.Clamp(value, 0, maxScroll); track.setY(this.scrollY); };
    const inside = (pointer: Phaser.Input.Pointer): boolean => {
      const matrix = parent.getWorldTransformMatrix();
      const topLeft = matrix.transformPoint(-width / 2, viewTop);
      const bottomRight = matrix.transformPoint(width / 2, viewTop + view);
      return pointer.x >= topLeft.x && pointer.x <= bottomRight.x && pointer.y >= topLeft.y && pointer.y <= bottomRight.y;
    };
    let dragging = false;
    let origin = 0;
    const down = (pointer: Phaser.Input.Pointer): void => { if (!inside(pointer)) return; dragging = true; origin = this.scrollY - pointer.y; };
    const move = (pointer: Phaser.Input.Pointer): void => { if (dragging && pointer.isDown) scrollTo(origin + pointer.y); };
    const up = (): void => { dragging = false; };
    const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void => { if (inside(pointer)) scrollTo(this.scrollY + dy); };
    const input = this.scene.input;
    input.on("pointerdown", down); input.on("pointermove", move); input.on("pointerup", up); input.on("wheel", wheel);
    this.listeners.push(() => { input.off("pointerdown", down); input.off("pointermove", move); input.off("pointerup", up); input.off("wheel", wheel); });
  }

  private release(): void {
    this.ticker?.remove(false); this.ticker = undefined;
    this.mask?.destroy(); this.mask = undefined;
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
