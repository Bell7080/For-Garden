import Phaser from "phaser";
import { t } from "../i18n";
import { PLAYABLE_RELICS } from "../data/relics";
import type { RelicDef } from "../core/types";
import { BREAKTHROUGH_CAP } from "../core/relicProgression";
import { relicFragmentRoom } from "../core/relicResonance";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { settingsManager } from "../managers/SettingsManager";
import { battleAssetFor, headCardFrame, loadPortraitTexture, portraitAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { portraitCardZoom } from "./portraitPlacement";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { Button } from "./Button";
import { FaceFrame } from "./FaceFrame";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeOutline, slantedRect } from "./holo";
import { sceneInfoManager } from "./info";
import { bindLongPress } from "./longPressInfo";
import { addClippedHit, clipHit, containerClip } from "./clippedHit";
import type { PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import {
  RELIC_SELECT, relicSelectCardX, relicSelectContains, relicSelectMinOffset, relicSelectOffsetFor,
  relicSelectStageRect, relicSelectStep, relicSelectStripViewport, relicSelectSwipeDelta,
  relicSelectArrowX, relicSelectFrames, type RelicSelectRect,
} from "./relicSelectLayout";

/** SR 선택권의 결 — 7일 가이드 마디와 가방의 선택권이 같은 보랏빛을 쓴다. */
export const SR_SELECT_TONE = 0xc89cff;

function hex(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }

/** 정보창은 고르기 창(팝업 2000대) 위에 선다 — 발굴 배치의 꾹 누름과 같은 층이다. */
const INFO_DEPTH = 2600;

interface Choice {
  readonly def: RelicDef;
  readonly owned: boolean;
  /** 돌파·공명에 쓸 파편을 다 갖췄다 — 서버(`assertRelicSelectable`)가 같은 값으로 거절한다. */
  readonly maxed: boolean;
}

function readChoices(ids: readonly string[]): Choice[] {
  return ids.flatMap((relicId) => {
    const def = PLAYABLE_RELICS.find((relic) => relic.id === relicId);
    if (!def) return [];
    const owned = session.owned.has(relicId);
    const maxed = owned && relicFragmentRoom(def.rarity, session.relicProgress[relicId], session.relicFragments[relicId] ?? 0, BREAKTHROUGH_CAP) <= 0;
    return [{ def, owned, maxed }];
  });
}

/**
 * 렐릭 선택권의 고르기 창 — 7일 성장 가이드의 SR 마디와 가방의 SR 렐릭 선택권이 같은 한 장을 연다.
 *
 * **외형 전시관과 같은 문법이다**(`AppearanceStrip`). 위 무대에 고른 렐릭이 전신으로 서고, 아래 얼굴 띠를
 * 옆으로 넘기며 고른다 — 무대를 밀거나 양옆 꺾쇠를 눌러도 넘어간다. 무대나 얼굴을 **꾹 누르면 정보창**이
 * 열려 스킬까지 읽고 고를 수 있다(도감과 같은 `InfoManager.showRelic`, 미보유는 실루엣 미리보기).
 * 이미 함께하는 렐릭은 파편 한 장이고 돌파를 끝낸 렐릭은 고를 수 없다.
 */
export function openRelicSelectPicker(scene: Phaser.Scene, popups: PopupLayer, ids: readonly string[], onPick: (relicId: string) => void): void {
  const choices = readChoices(ids);
  if (choices.length === 0) return;
  const { width, height } = RELIC_SELECT;
  popups.open({ width, height, title: t("newbieGrowth.sr.title"), dim: true, dimAlpha: 0.78, closeOnBackdrop: true, backButton: true }, (body, close) => {
    new RelicSelectView(scene, popups, body, choices, (relicId) => { close(); onPick(relicId); });
  });
}

class RelicSelectView {
  private focused: number;
  private offset = 0;
  private token = 0;
  private hero?: PuppetCreature;
  private heroLayer!: Phaser.GameObjects.Container;
  private faceLayer!: Phaser.GameObjects.Container;
  private sdLayer!: Phaser.GameObjects.Container;
  private sd?: PuppetCreature;
  private face?: Phaser.GameObjects.Image;
  private readonly badges: Phaser.GameObjects.Container;
  private readonly name: Phaser.GameObjects.Text;
  private readonly state: Phaser.GameObjects.Text;
  private readonly rail: Phaser.GameObjects.Container;
  private readonly cards: Phaser.GameObjects.Container[] = [];
  private readonly action: Button;
  private dragging?: { x: number; startX: number; moved: number; area: "stage" | "strip" };
  private draggedDistance = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly popups: PopupLayer,
    private readonly body: Phaser.GameObjects.Container,
    private readonly choices: readonly Choice[],
    private readonly pick: (relicId: string) => void,
  ) {
    // 처음에는 아직 없는 렐릭을 먼저 — 선택권이 가장 값지게 쓰이는 자리다.
    const firstNew = choices.findIndex((choice) => !choice.owned);
    const firstOpen = choices.findIndex((choice) => !choice.maxed);
    this.focused = Math.max(0, firstNew >= 0 ? firstNew : firstOpen);

    body.add(scene.add.text(0, RELIC_SELECT.hint.y, t("newbieGrowth.sr.hint"), textStyle({ role: "body", size: RELIC_SELECT.hint.size, color: COLOR.inkDim, align: "center", wrap: RELIC_SELECT.width - 120 })).setOrigin(0.5));

    this.addStage();
    this.badges = scene.add.container(0, 0);
    body.add(this.badges);
    this.addStageChrome();

    this.name = scene.add.text(0, RELIC_SELECT.name.y, "", textStyle({ role: "display", size: RELIC_SELECT.name.size }))
      .setOrigin(0.5).setStroke("#05070a", 8).setShadow(0, 5, "#05070a", 8, true, true);
    this.state = scene.add.text(0, RELIC_SELECT.state.y, "", textStyle({ role: "emphasis", size: RELIC_SELECT.state.size }))
      .setOrigin(0.5).setStroke("#05070a", 5);
    body.add([this.name, this.state]);

    this.rail = scene.add.container(0, RELIC_SELECT.strip.y);
    body.add(this.rail);
    const view = relicSelectStripViewport();
    const viewShape = [view.left, view.top, view.right, view.top, view.right, view.bottom, view.left, view.bottom];
    this.rail.setMask(shapeClipMask(scene, body, viewShape));
    choices.forEach((choice, index) => this.addCard(choice, index));

    body.add(scene.add.text(0, RELIC_SELECT.holdHint.y, t("newbieGrowth.sr.holdInfo"), textStyle({ role: "body", size: RELIC_SELECT.holdHint.size, color: COLOR.inkDim })).setOrigin(0.5).setAlpha(0.8));

    this.action = new Button(scene, 0, RELIC_SELECT.action.y, {
      width: RELIC_SELECT.action.width, height: RELIC_SELECT.action.height, label: t("newbieGrowth.sr.confirmLabel"),
      variant: "primary", decorDots: true, accentColor: SR_SELECT_TONE, onClick: () => this.confirm(),
    });
    body.add(this.action);

    this.installSwipe();
    this.offset = relicSelectOffsetFor(this.focused, choices.length, 0);
    this.rail.setX(this.offset);
    body.once(Phaser.GameObjects.Events.DESTROY, () => { this.token += 1; this.hero?.destroy(); this.hero = undefined; this.sd?.destroy(); this.sd = undefined; });
    this.paint();
  }

  /** 팝업 몸판 전체 — 무대·꺾쇠는 창 밖으로 나가지 않지만 입력면은 같은 규칙(창 안에서만)을 지난다. */
  private popupClip(): () => import("./clipRect").ClipRect {
    const { width, height } = RELIC_SELECT;
    return containerClip(this.body, -width / 2, -height / 2, width / 2, height / 2);
  }

  /**
   * 무대 — 외형 전시관과 같은 **웹툰 칸 셋**. 큰 칸에 전신, 오른쪽 위에 얼굴, 오른쪽 아래에 SD가 서서
   * 한 렐릭을 세 각도에서 한 번에 보여 준다. 칸은 정보창 배경 원화 위의 유리면이고 둘레는 선택권의 보랏빛이다.
   */
  private addStage(): void {
    const frames = relicSelectFrames();
    this.heroLayer = this.addFrame(frames.hero, true);
    this.faceLayer = this.addFrame(frames.face, false);
    this.sdLayer = this.addFrame(frames.sd, false);
    // 무대 전체가 꾹 누름을 받는다 — 세 칸 어디를 꾹 눌러도 그 렐릭의 정보창이 열린다.
    const stage = relicSelectStageRect();
    const hit = addClippedHit(this.scene, this.body, (stage.left + stage.right) / 2, (stage.top + stage.bottom) / 2, stage.right - stage.left, stage.bottom - stage.top, this.popupClip(), { useHandCursor: false });
    bindLongPress(this.scene, hit, { onLongPress: () => this.openInfo(this.focused), depth: INFO_DEPTH - 200, allowTap: () => false });
  }

  private addFrame(rect: RelicSelectRect, floorGlow: boolean): Phaser.GameObjects.Container {
    const spot = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2, width: rect.right - rect.left, height: rect.bottom - rect.top };
    const unit = Math.min(spot.width, spot.height);
    const shape = chipPoints(spot.width, spot.height, { bevel: { topLeft: unit * 0.16, topRight: 0, bottomRight: unit * 0.16, bottomLeft: 0 } });
    addPopupBackgroundImage(this.scene, this.body, BACKGROUND.info, { x: spot.x, y: spot.y, width: spot.width, height: spot.height, maskShape: shape, overlayStrength: 0.3 });
    const clip = shapeClipMask(this.scene, this.body, shape, spot);
    if (floorGlow) {
      // 바닥에서 피어오르는 선택권의 보랏빛 — 그 렐릭이 「선택지」 위에 서 있다는 것을 색이 말한다.
      const floor = this.scene.add.graphics().setMask(clip);
      for (let band = 0; band < 10; band += 1) {
        const ratio = band / 10;
        floor.fillStyle(SR_SELECT_TONE, 0.05 * (1 - ratio));
        floor.fillEllipse(spot.x, rect.bottom - 40, spot.width * (1.2 - ratio * 0.8), 260 * (1 - ratio * 0.6));
      }
      floor.setBlendMode(Phaser.BlendModes.ADD);
      this.body.add(floor);
    }
    const content = this.scene.add.container(spot.x, spot.y);
    content.setMask(clip);
    this.body.add(content);
    this.body.add(drawFrameVignette(this.scene, spot.x, spot.y, spot.width, spot.height, { strength: 0.5, spread: 0.18 }).setMask(clip));
    this.body.add(drawShapeOutline(this.scene, spot.x, spot.y, shape, { color: SR_SELECT_TONE, alpha: 0.62, width: 3 }));
    return content;
  }

  /** 띠 양옆의 넘김 꺾쇠(`<` `>`)와 큰 칸 오른쪽 위의 정보 칩. */
  private addStageChrome(): void {
    const { arrow } = RELIC_SELECT;
    const addArrow = (side: -1 | 1): void => {
      const holder = this.scene.add.container(relicSelectArrowX(side), RELIC_SELECT.strip.y);
      holder.add(drawLayer(this.scene, 0, 0, slantedRect(arrow.width, arrow.height, 8), { fill: 0x1a1226, alpha: 0.9, shadow: false }));
      holder.add(drawShapeOutline(this.scene, 0, 0, slantedRect(arrow.width, arrow.height, 8), { color: SR_SELECT_TONE, alpha: 0.6, width: 2 }));
      holder.add(drawGlyph(this.scene, side < 0 ? "page-prev" : "page-next", 0, 0, arrow.width * 0.72, SR_SELECT_TONE));
      const hit = this.scene.add.rectangle(0, 0, arrow.width + 28, arrow.height + 16, 0xffffff, 0);
      clipHit(hit, this.popupClip());
      hit.on("pointerdown", () => pressIn(holder));
      hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(holder); this.focus(relicSelectStep(this.focused, side, this.choices.length)); });
      holder.add(hit);
      this.body.add(holder);
      if (this.choices.length <= 1) holder.setAlpha(0.35);
    };
    addArrow(-1); addArrow(1);

    const { info } = RELIC_SELECT;
    const hero = relicSelectFrames().hero;
    const chip = this.scene.add.container(hero.right - RELIC_SELECT.badge.inset + 6, hero.top + RELIC_SELECT.badge.top);
    const chipShape = chipPoints(info.size, info.size, { bevel: { topLeft: info.size * 0.24, topRight: 0, bottomRight: info.size * 0.24, bottomLeft: 0 } });
    chip.add(drawLayer(this.scene, 0, 0, chipShape, { fill: 0x0c1219, alpha: 0.86 }));
    chip.add(drawShapeOutline(this.scene, 0, 0, chipShape, { color: SR_SELECT_TONE, alpha: 0.7, width: 3 }));
    chip.add(drawGlyph(this.scene, "magnifier", 0, 0, info.size * 0.56, SR_SELECT_TONE));
    const hit = this.scene.add.rectangle(0, 0, info.size + 16, info.size + 16, 0xffffff, 0);
    clipHit(hit, this.popupClip());
    hit.on("pointerdown", () => pressIn(chip));
    hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(chip); this.openInfo(this.focused); });
    chip.add(hit);
    this.body.add(chip);
  }

  /** 띠의 얼굴 칸 한 장 — 누르면 고르고, 꾹 누르면 정보창이 열린다. */
  private addCard(choice: Choice, index: number): void {
    const size = RELIC_SELECT.strip.card;
    const card = this.scene.add.container(relicSelectCardX(index, this.choices.length), 0);
    const glowShape = chipPoints(size + 20, size + 20, { bevel: { topLeft: (size + 20) * 0.22, topRight: 0, bottomRight: (size + 20) * 0.22, bottomLeft: 0 } });
    const glow = drawLayer(this.scene, 0, 0, glowShape, { fill: SR_SELECT_TONE, alpha: 0.32, shadow: false }).setBlendMode(Phaser.BlendModes.ADD);
    card.add(glow);
    const frame = new FaceFrame(this.scene, 0, 0, { portraitAssetId: choice.def.portraitAssetId, size, color: choice.maxed ? 0x68717d : SR_SELECT_TONE });
    if (choice.maxed) frame.setAlpha(0.42);
    card.add(frame);
    if (choice.owned) {
      // 이미 함께하는 렐릭은 오른쪽 위에 작은 체크 — 무대의 상태 줄이 무엇이 되는지(파편)를 말한다.
      const mark = this.scene.add.container(size / 2 - 18, -size / 2 + 18);
      mark.add(drawLayer(this.scene, 0, 0, chipPoints(34, 34, { bevel: { topLeft: 8, topRight: 0, bottomRight: 8, bottomLeft: 0 } }), { fill: choice.maxed ? 0x3a414b : 0x2a1f40, alpha: 0.95, shadow: false }));
      mark.add(drawGlyph(this.scene, "check", 0, 0, 22, choice.maxed ? 0x9aa3ad : SR_SELECT_TONE));
      card.add(mark);
    }
    const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0);
    const view = relicSelectStripViewport();
    clipHit(hit, containerClip(this.body, view.left, view.top, view.right, view.bottom));
    card.add(hit);
    bindLongPress(this.scene, hit, {
      onTap: () => this.focus(index),
      onLongPress: () => { this.focus(index); this.openInfo(index); },
      allowTap: () => this.draggedDistance <= RELIC_SELECT.strip.dragSlop,
      depth: INFO_DEPTH - 200,
    });
    card.setData("glow", glow);
    this.rail.add(card);
    this.cards.push(card);
  }

  /**
   * 띠를 손으로 밀고, 무대를 밀어 넘긴다.
   *
   * 칸·무대 위에 드래그 면을 따로 깔면 꾹 누름 면이 손을 먼저 받으므로 **씬 전체 포인터**로 받는다
   * (외형 전시관과 같은 방법). 손이 어디서 시작했는지는 몸판 역변환으로 국소 좌표를 구해 가른다.
   */
  private installSwipe(): void {
    const local = (pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 => this.body.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
    const scale = (): number => this.body.getWorldTransformMatrix().scaleX || 1;
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      const point = local(pointer);
      const area = relicSelectContains(relicSelectStripViewport(), point.x, point.y) ? "strip" : relicSelectContains(relicSelectStageRect(), point.x, point.y) ? "stage" : undefined;
      if (!area) return;
      this.dragging = { x: pointer.x, startX: pointer.x, moved: 0, area };
      this.draggedDistance = 0;
    };
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      const drag = this.dragging;
      if (!drag || !pointer.isDown) return;
      const delta = (pointer.x - drag.x) / scale();
      drag.x = pointer.x;
      drag.moved += Math.abs(delta);
      this.draggedDistance = drag.moved;
      if (drag.area === "strip") {
        this.offset = Phaser.Math.Clamp(this.offset + delta, relicSelectMinOffset(this.choices.length), 0);
        this.rail.setX(this.offset);
      }
    };
    const onUp = (pointer: Phaser.Input.Pointer): void => {
      const drag = this.dragging;
      this.dragging = undefined;
      if (!drag || drag.area !== "stage") return;
      const step = relicSelectSwipeDelta((pointer.x - drag.startX) / scale());
      if (step !== 0) this.focus(relicSelectStep(this.focused, step, this.choices.length), step);
    };
    const onWheel = (pointer: Phaser.Input.Pointer, _objects: unknown, dx: number, dy: number): void => {
      const point = local(pointer);
      if (!relicSelectContains(relicSelectStripViewport(), point.x, point.y)) return;
      this.offset = Phaser.Math.Clamp(this.offset - (dx || dy) * 0.6, relicSelectMinOffset(this.choices.length), 0);
      this.rail.setX(this.offset);
    };
    const input = this.scene.input;
    input.on("pointerdown", onDown);
    input.on("pointermove", onMove);
    input.on("pointerup", onUp);
    input.on("pointerupoutside", onUp);
    input.on("wheel", onWheel);
    this.body.once(Phaser.GameObjects.Events.DESTROY, () => {
      input.off("pointerdown", onDown);
      input.off("pointermove", onMove);
      input.off("pointerup", onUp);
      input.off("pointerupoutside", onUp);
      input.off("wheel", onWheel);
    });
  }

  private focus(index: number, direction?: number): void {
    if (index === this.focused) return;
    const from = this.focused;
    this.focused = index;
    this.offset = relicSelectOffsetFor(index, this.choices.length, this.offset);
    this.scene.tweens.add({ targets: this.rail, x: this.offset, duration: 180, ease: "Sine.easeOut" });
    this.paint(direction ?? (index > from ? 1 : -1));
  }

  /** 정보창 — 도감과 같은 창이다. 미보유 렐릭은 실루엣 미리보기로 열린다. */
  private openInfo(index: number): void {
    const choice = this.choices[index];
    if (!choice) return;
    sceneInfoManager(this.scene, { key: "relic-select", portraitDepth: INFO_DEPTH + 1, baseDepth: INFO_DEPTH }).showRelic(choice.def, choice.owned);
  }

  private confirm(): void {
    const choice = this.choices[this.focused];
    if (!choice || choice.maxed) return;
    this.popups.confirm({
      title: t("newbieGrowth.sr.title"),
      message: t(choice.owned ? "newbieGrowth.sr.confirmOwned" : "newbieGrowth.sr.confirm", { name: choice.def.name }),
      confirmLabel: t("newbieGrowth.sr.confirmLabel"),
    }, () => this.pick(choice.def.id));
  }

  /** 무대·띠·버튼을 지금 고른 렐릭으로 다시 그린다. */
  private paint(direction = 0): void {
    const choice = this.choices[this.focused];
    this.cards.forEach((card, index) => {
      const chosen = index === this.focused;
      card.setScale(chosen ? 1.06 : 1);
      (card.getData("glow") as Phaser.GameObjects.Graphics).setVisible(chosen);
    });
    this.name.setText(choice.def.name).setColor(choice.maxed ? COLOR.inkDim : COLOR.ink);
    squeezeTextToWidth(this.name, RELIC_SELECT.width - 140);
    this.state.setText(t(choice.maxed ? "newbieGrowth.sr.maxed" : choice.owned ? "newbieGrowth.sr.owned" : "newbieGrowth.sr.new"))
      .setColor(choice.maxed ? COLOR.inkDim : hex(SR_SELECT_TONE));
    this.action.setEnabled(!choice.maxed);
    this.paintBadges(choice);
    this.loadHero(choice, direction);
  }

  /** 무대 왼쪽 위 — 등급 글자와 속성·직군. 정보창 머리의 순서를 그대로 줄인 것이다. */
  private paintBadges(choice: Choice): void {
    this.badges.removeAll(true);
    const rect = relicSelectFrames().hero;
    const { badge } = RELIC_SELECT;
    const x = rect.left + badge.inset;
    const y = rect.top + badge.top;
    const rarity = this.scene.add.text(x - 20, y, choice.def.rarity, textStyle({ role: "display", size: 44, color: hex(SR_SELECT_TONE) }))
      .setOrigin(0, 0.5).setStroke("#05070a", 7).setShadow(0, 4, "#05070a", 6, true, true);
    this.badges.add(rarity);
    const after = x - 20 + rarity.width + 22;
    this.badges.add(new AffinityBadge(this.scene, after + badge.element / 2, y, ELEMENT_ICON[choice.def.element], badge.element, 0.62));
    this.badges.add(new AffinityBadge(this.scene, after + badge.element + 12 + badge.role / 2, y, ROLE_ICON[choice.def.role], badge.role, 0.62));
  }

  /**
   * 세 칸을 그 렐릭으로 채운다 — 큰 칸 전신, 작은 칸 SD, 중간 칸 얼굴. 셋이 한 세대(`token`)를 나눠 가져
   * 읽는 사이에 다른 렐릭을 골랐으면 늦게 온 것은 모두 버린다.
   */
  private loadHero(choice: Choice, direction: number): void {
    const token = ++this.token;
    const frames = relicSelectFrames();
    const heroSpot = { width: frames.hero.right - frames.hero.left, height: frames.hero.bottom - frames.hero.top };
    const sdSpot = { width: frames.sd.right - frames.sd.left, height: frames.sd.bottom - frames.sd.top };
    const faceSpot = { width: frames.face.right - frames.face.left, height: frames.face.bottom - frames.face.top };
    const alpha = choice.maxed ? 0.5 : 1;
    const asset = portraitAssetFor(choice.def.portraitAssetId);
    const content = { width: asset.content.right - asset.content.left, height: asset.content.bottom - asset.content.top };
    const inset = 16;
    const heroHeight = Math.min(heroSpot.height - inset * 2, ((heroSpot.width - inset * 2) * content.height) / content.width);
    const slideIn = (target: Phaser.GameObjects.Components.Alpha & { x: number }): void => {
      if (direction === 0 || settingsManager.get().accessibility.reduceMotion) return;
      // 넘긴 쪽에서 한 뼘 밀려 들어온다 — 「옆으로 넘겼다」가 움직임으로 읽힌다.
      target.x = direction * 70;
      target.setAlpha(0);
      this.scene.tweens.add({ targets: target, x: 0, alpha, duration: 220, ease: "Cubic.easeOut" });
    };
    void spawnPuppet(this.scene, asset, { x: 0, groundY: heroSpot.height / 2 - inset, height: heroHeight, depth: 0 }).then((puppet) => {
      if (token !== this.token || !this.heroLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(alpha);
      const old = this.hero;
      this.hero = puppet;
      this.heroLayer.add(puppet);
      old?.destroy();
      slideIn(puppet);
    }).catch(() => undefined);

    void spawnPuppet(this.scene, battleAssetFor(choice.def.id), { x: 0, groundY: sdSpot.height / 2 - 12, height: sdSpot.height * 0.9, depth: 0 }).then((puppet) => {
      if (token !== this.token || !this.sdLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(alpha);
      const old = this.sd;
      this.sd = puppet;
      this.sdLayer.add(puppet);
      old?.destroy();
    }).catch(() => undefined);

    // 중간 칸 — 얼굴. 외형 전시관과 같은 잘라내기(카드 함수)로 얼굴 하나가 칸을 채운다.
    void loadPortraitTexture(this.scene, asset, this.faceLayer).then(({ key, anchors }) => {
      if (token !== this.token || !this.faceLayer.active) return;
      const frame = headCardFrame(asset, anchors, { width: faceSpot.width, height: faceSpot.height, fillRatio: 0.32 / portraitCardZoom(asset), headroom: 0, cardTop: asset.cardTop });
      const image = this.scene.add.image(-faceSpot.width / 2 - frame.cropX * frame.scale, -faceSpot.height / 2 - frame.cropY * frame.scale, key)
        .setOrigin(0, 0).setScale(frame.scale).setAlpha(alpha);
      image.setCrop(frame.cropX, frame.cropY, frame.cropWidth, frame.cropHeight);
      const old = this.face;
      this.face = image;
      this.faceLayer.add(image);
      old?.destroy();
    }).catch(() => undefined);
  }
}
