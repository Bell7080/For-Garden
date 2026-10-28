import { KeywordManager } from "../managers/KeywordManager";
import { getExpeditionAugment } from "../data/expeditionAugments";
import { expeditionAugmentKeywords } from "./expeditionAugmentKeywords";
import Phaser from "phaser";
import { t } from "../i18n";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { getRelic } from "../data/relics";
import { ExpeditionAugmentChip } from "./ExpeditionAugmentChip";
import { FaceFrame } from "./FaceFrame";
import { addBannerArrow, drawBannerPages } from "./LabBannerTitle";
import { PopupLayer } from "./PopupLayer";
import { RARITY_TONE } from "./rarityMark";
import { slideTabPage } from "./screenTransition";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { addClippedHit } from "./clippedHit";
import { EXPEDITION_AUGMENT_STATUS } from "./expeditionLayout";
import { expeditionAugmentPages, type AugmentBadgeView, type AugmentStatusPage } from "./expeditionAugmentBadges";
import { addScrollHint } from "./ScrollHint";

/** 손을 이만큼 옆으로 밀면 쪽을 넘긴다. 세로로 더 움직였으면 목록을 흘리는 손이다. */
const SWIPE_DISTANCE = 90;

/**
 * 지금 무엇이 누구에게 붙어 있는지 보는 현황판 — 옆으로 넘기는 쪽 묶음이다.
 *
 * 1쪽은 전체 적용, 2쪽부터 편성 1·2·3번 렐릭의 개인 증강이다(`expeditionAugmentPages`).
 * 증강 하나가 안쪽 판 한 장이고, 판 높이는 효과 글을 잰 뒤 정한다. 넘김은 아래의 꺾쇠·점과
 * 목록을 옆으로 미는 손 모두가 같은 일을 한다.
 */
export class ExpeditionAugmentStatusPopup {
  private body?: Phaser.GameObjects.Container;
  private pages: AugmentStatusPage[] = [];
  private index = 0;
  private page?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private dots?: Phaser.GameObjects.Graphics;
  private mask?: Phaser.Display.Masks.GeometryMask;
  private maskShape?: Phaser.GameObjects.Rectangle;
  private scroll = 0;
  private minScroll = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  /** `startRelicId`를 주면 그 렐릭의 쪽부터 연다(프로필의 칩·카드를 눌렀을 때). */
  open(augments: readonly ExpeditionAugmentSelection[], relicOrder: readonly string[], startRelicId?: string): void {
    const L = EXPEDITION_AUGMENT_STATUS;
    this.pages = expeditionAugmentPages(augments, relicOrder);
    const start = startRelicId ? this.pages.findIndex((page) => page.kind === "relic" && page.relicId === startRelicId) : 0;
    this.index = Math.max(0, start);
    this.popups.open({ width: L.width, height: L.height, y: L.centerY, title: t("expedition.augment.confirmed", { count: augments.length }), dim: true, backButton: true }, (body) => {
      this.body = body;
      body.once(Phaser.GameObjects.Events.DESTROY, () => { this.mask?.destroy(); this.mask = undefined; this.maskShape?.destroy(); this.maskShape = undefined; });
      // 판은 닫히기 전까지 같은 자리에 서므로 마스크는 판의 **최종** 자리로 한 번만 세운다 — 열리는
      // 연출 중의 배율로 재면 연출이 끝난 뒤 목록 위아래가 잘려 남는다.
      const viewHeight = L.viewport.bottom - L.viewport.top;
      this.maskShape = this.scene.add.rectangle(body.x, body.y + (L.viewport.top + L.viewport.bottom) / 2, L.viewport.width, viewHeight, 0xffffff).setVisible(false);
      this.mask = this.maskShape.createGeometryMask();
      body.add(drawHairline(this.scene, 0, L.divider, L.row.width, { color: COLOR.accent, alpha: 0.35 }));
      this.bindGestures(body);
      if (this.pages.length > 1) {
        body.add(addBannerArrow(this.scene, -L.pager.arrowX, L.pager.y, -1, () => this.go(this.index - 1)));
        body.add(addBannerArrow(this.scene, L.pager.arrowX, L.pager.y, 1, () => this.go(this.index + 1)));
        this.dots = this.scene.add.graphics({ x: 0, y: L.pager.y });
        body.add(this.dots);
      }
      this.render();
    });
  }

  /** 끝에서 넘기면 반대쪽 끝으로 돈다 — 네 쪽뿐이라 되감는 손이 더 번거롭다. */
  private go(next: number): void {
    const count = this.pages.length;
    if (count < 2) return;
    const target = (next + count) % count;
    if (target === this.index) return;
    const from = this.index;
    this.index = target;
    this.scroll = 0;
    this.render();
    // 새 쪽은 누른 쪽에서 밀려 들어온다 — 끝에서 처음으로 돌 때도 손이 민 방향을 따른다.
    const direction = next > from ? 1 : -1;
    if (this.page) slideTabPage(this.scene, [this.page], 0, direction);
  }

  /**
   * 목록을 위아래로 흘리고, 옆으로 크게 밀면 쪽을 넘긴다.
   *
   * 입력면은 `addClippedHit`로 판 안에서만 받는다 — 판이 닫히는 연출 중에도 화면 밖 손을 삼키지 않는다.
   * 끄는 동안의 움직임은 입력면을 벗어나도 따라가야 하므로 씬 입력에서 읽고, 판이 죽을 때 함께 푼다.
   */
  private bindGestures(body: Phaser.GameObjects.Container): void {
    const L = EXPEDITION_AUGMENT_STATUS;
    const height = L.viewport.bottom - L.header.y + 60;
    const centerY = (L.header.y - 60 + L.viewport.bottom) / 2;
    const clip = () => {
      const { tx, ty } = body.getWorldTransformMatrix();
      return { left: tx - L.width / 2, right: tx + L.width / 2, top: ty + centerY - height / 2, bottom: ty + centerY + height / 2 };
    };
    // 판의 입력막(`bodyHit`)보다 위, 넘김 꺾쇠보다 아래에 선다 — 맨 뒤로 보내면 판의 막이 손을 먼저 삼킨다.
    const pad = addClippedHit(this.scene, body, 0, centerY, L.width, height, clip, { useHandCursor: false });
    let dragging = false;
    let start = { x: 0, y: 0 };
    let lastY = 0;
    let horizontal = false;
    const down = (pointer: Phaser.Input.Pointer) => {
      const bounds = clip();
      if (pointer.x < bounds.left || pointer.x > bounds.right || pointer.y < bounds.top || pointer.y > bounds.bottom) return;
      dragging = true; start = { x: pointer.x, y: pointer.y }; lastY = pointer.y; horizontal = false;
    };
    this.scene.input.on("pointerdown", down);
    const move = (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) return;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      if (!horizontal && Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.4) horizontal = true;
      if (!horizontal) this.moveScroll(pointer.y - lastY);
      lastY = pointer.y;
    };
    const up = (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      dragging = false;
      const dx = pointer.x - start.x;
      if (horizontal && Math.abs(dx) >= SWIPE_DISTANCE) this.go(this.index + (dx < 0 ? 1 : -1));
    };
    this.scene.input.on("pointermove", move);
    this.scene.input.on("pointerup", up);
    body.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.scene.input.off("pointerdown", down);
      this.scene.input.off("pointermove", move);
      this.scene.input.off("pointerup", up);
    });
    pad.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.moveScroll(-dy * 0.65));
  }

  private moveScroll(delta: number): void {
    if (!this.list) return;
    this.scroll = Phaser.Math.Clamp(this.scroll + delta, this.minScroll, 0);
    this.list.y = EXPEDITION_AUGMENT_STATUS.viewport.top + this.scroll;
  }

  /** 쪽 하나를 새로 세우고 옛 쪽을 걷는다 — 새 것을 먼저 세워야 얼굴 원화가 한 프레임 비지 않는다. */
  private render(): void {
    const body = this.body;
    const page = this.pages[this.index];
    if (!body || !page) return;
    const L = EXPEDITION_AUGMENT_STATUS;
    const previous = this.page;
    const container = this.scene.add.container(0, 0);
    body.add(container);
    this.paintHeader(container, page);
    const list = this.scene.add.container(0, L.viewport.top);
    container.add(list);
    let y = 0;
    for (const badge of page.badges) y += this.addRow(list, badge, y) + L.row.gap;
    if (page.badges.length === 0) {
      list.add(this.scene.add.text(0, (L.viewport.bottom - L.viewport.top) / 2, t("expedition.augment.empty"), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    }
    const contentHeight = Math.max(0, y - L.row.gap);
    this.minScroll = Math.min(0, L.viewport.bottom - L.viewport.top - contentHeight);
    this.scroll = Phaser.Math.Clamp(this.scroll, this.minScroll, 0);
    list.y = L.viewport.top + this.scroll;
    if (this.mask) list.setMask(this.mask);
    addScrollHint(this.scene, container, {
      x: 0, y: (L.viewport.top + L.viewport.bottom) / 2, width: L.viewport.width, height: L.viewport.bottom - L.viewport.top,
      owner: list, read: () => ({ offset: this.scroll, min: this.minScroll }),
    });
    previous?.destroy();
    this.page = container;
    this.list = list;
    if (this.dots) drawBannerPages(this.dots, this.pages.length, this.index, COLOR.accent);
    this.popups.raiseChrome(body);
  }

  /** 누구의 몫인가 — 전체는 글자, 렐릭은 기여도 판과 같은 얼굴 액자와 이름. */
  private paintHeader(container: Phaser.GameObjects.Container, page: AugmentStatusPage): void {
    const L = EXPEDITION_AUGMENT_STATUS;
    const left = -L.row.width / 2;
    const count = this.scene.add.text(L.row.width / 2, L.header.y, t("expedition.augment.count", { count: page.badges.length }), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(1, 0.5);
    container.add(count);
    if (page.kind === "party") {
      container.add(this.scene.add.text(left, L.header.y, t("expedition.augment.applyAll"), textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(0, 0.5));
      return;
    }
    const relic = getRelic(page.relicId);
    container.add(new FaceFrame(this.scene, left + L.header.face / 2, L.header.y, { portraitAssetId: relic.portraitAssetId, size: L.header.face }));
    const slot = this.pages.indexOf(page);
    const textX = left + L.header.face + 22;
    container.add(this.scene.add.text(textX, L.header.y - 20, t("expedition.augment.slot", { slot }), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const name = this.scene.add.text(textX, L.header.y + 18, relic.name, textStyle({ role: "display", size: 36, color: COLOR.sortieText })).setOrigin(0, 0.5);
    container.add(shrinkTextToWidth(name, count.x - count.width - textX - 24));
  }

  /**
   * 증강 한 장 — 안쪽 판에 문양 액자, 이름과 등급·범위, 그 아래 효과.
   *
   * 판 높이는 효과 글을 잰 뒤 정하므로 몇 줄이든 판 안에 든다. 효과는 흐리지 않은 본문 밝기다 —
   * 이 판을 여는 이유가 그 수치를 읽는 것이다.
   */
  private addRow(list: Phaser.GameObjects.Container, badge: AugmentBadgeView, top: number): number {
    const R = EXPEDITION_AUGMENT_STATUS.row;
    const tone = RARITY_TONE[badge.rarity === "ssr" ? "SSR" : "SR"];
    const row = this.scene.add.container(0, 0);
    const meta = this.scene.add.text(R.metaRight, 0, badge.meta, textStyle({ role: "emphasis", size: 23, color: tone.ink })).setOrigin(1, 0.5);
    const name = this.scene.add.text(R.textX, 0, badge.name, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5);
    shrinkTextToWidth(name, R.metaRight - meta.width - 20 - R.textX);
    const def = getExpeditionAugment(badge.augmentId);
    const effect = new KeywordManager(this.scene, new PopupLayer(this.scene, 6000)).layout(badge.effect, {
      width: R.effectWrap, size: 27, lineSpacing: 6, contextualKeywords: def ? expeditionAugmentKeywords(def) : [],
      inputClip: () => {
        const L = EXPEDITION_AUGMENT_STATUS;
        const { tx, ty } = this.body!.getWorldTransformMatrix();
        return { left: tx - L.viewport.width / 2, right: tx + L.viewport.width / 2, top: ty + L.viewport.top, bottom: ty + L.viewport.bottom };
      },
    }).setX(R.textX);
    const nameHeight = 36;
    const height = Math.max(R.minHeight, R.padY * 2 + nameHeight + 8 + effect.height);
    const cy = top + height / 2;
    const shape = chipPoints(R.width, height, { bevel: { topLeft: 20, bottomRight: 20 } });
    row.add(drawLayer(this.scene, 0, cy, shape, { fill: 0x161c26, alpha: 0.92, edge: tone.chip, edgeAlpha: 0.75, glow: { color: tone.chip, strength: 0.18, height: 0.5 }, shadow: { x: 0, y: 6 } }));
    row.add(new ExpeditionAugmentChip(this.scene, -R.width / 2 + 24 + R.chip / 2, cy, badge, R.chip));
    const nameY = top + R.padY + nameHeight / 2;
    name.setY(nameY); meta.setY(nameY); effect.setY(nameY + nameHeight / 2 + 8);
    row.add([name, meta, effect]);
    list.add(row);
    return height;
  }
}
