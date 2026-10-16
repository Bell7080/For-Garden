import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { getStage } from "../data/stages";
import { recollectionEcho, recollectionEntriesOf, RECOLLECTION_GROUPS, type RecollectionEntry, type RecollectionGroup } from "../data/recollectionCatalog";
import { getRecollectionStory } from "../data/dialogues/recollections";
import { storyManager } from "../managers/StoryManager";
import { session } from "../state/session";
import { addCategoryTab } from "./CategoryTab";
import { useBackgroundTexture } from "./backgrounds";
import { DIALOGUE_BACKDROP } from "./dialogueStageLayout";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { pressIn, pressOut } from "./pressFeedback";
import { recollectionArtCrop, recollectionArtFocus, recollectionListHeight, recollectionRowAt, recollectionRowY, recollectionViewportHeight, RECOLLECTION_LAYOUT } from "./recollectionLayout";
import { COLOR, textStyle } from "./theme";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";

/** 손가락이 이만큼 움직이면 누름이 아니라 끌기다 — 목록을 흘리다 뗀 손이 이야기를 열지 않게 한다. */
const TAP_SLOP = 14;

/** 줄의 눈썹 줄 — 관문과 묶인 이야기는 `1-5 · 출격 전`, 관문이 없는 이야기는 비운다. */
export function recollectionRowEyebrow(entry: RecollectionEntry): string {
  if (!entry.stageId) return "";
  const phase = entry.phase ? t(entry.phase === "pre" ? "recollection.phase.pre" : "recollection.phase.post") : "";
  return phase ? `${entry.stageId} · ${phase}` : entry.stageId;
}

/** 줄의 제목. 관문 대사는 관문 이름, 그 밖의 이야기는 제 제목 키다. */
export function recollectionRowLabel(entry: RecollectionEntry): string {
  if (entry.titleKey) return t(entry.titleKey);
  return getStage(entry.stageId ?? "").name;
}

/** 한 줄 줄거리. 이야기마다 `recollection.summary.<이야기 ID>` 한 키가 갖는다. */
export function recollectionSummaryKey(entry: RecollectionEntry): TextKey {
  return `recollection.summary.${entry.storyId}` as TextKey;
}

/**
 * 회고 — 본 이야기를 모아 다시 읽는 곳.
 *
 * 본편의 전·후 대사, 오프닝, 곁 이야기가 한 목록에 모인다. 아직 보지 않은 이야기는 이름을 가리고
 * (`???`) 누를 수 없다. 다시 보기를 관문 쪽에 두지 않으므로 이야기를 다시 읽는 길은 여기뿐이다.
 *
 * **줄 하나는 교류 층과 같은 한 장이다.** 그 이야기의 무대 원화가 판을 채우고 판 실루엣대로 잘리며,
 * 오른쪽에 그 이야기의 대사 한 줄이 은은하게 깔린다. 굵은 제목과 한 줄 줄거리는 왼쪽 어둠 위에 선다.
 * 목록은 창 안에서 흐른다 — 판 위에 그대로 쌓던 때는 1장의 아래쪽 줄이 판 밖으로 삐져나갔다.
 */
export class RecollectionPopup {
  private tab: RecollectionGroup = "chapter1";
  private list?: Phaser.GameObjects.Container;
  private tabs?: Phaser.GameObjects.Container;
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  private entries: readonly RecollectionEntry[] = [];
  private scroll = 0;
  private minScroll = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly onPlay: (storyId: string) => void) {}

  open(): void {
    if (this.body) return;
    const { popup } = RECOLLECTION_LAYOUT;
    this.popups.open({ width: popup.width, height: popup.height, title: t("recollection.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: true, backButton: true, onClose: () => { this.body = undefined; this.list = undefined; this.tabs = undefined; this.content = undefined; this.rows = []; } }, (body) => {
      this.body = body;
      this.render();
    });
  }

  private render(): void {
    const body = this.body; if (!body) return;
    const previousList = this.list; const previousTabs = this.tabs;
    this.entries = recollectionEntriesOf(this.tab);
    this.rows = [];
    const list = this.buildList(body);
    this.entries.forEach((entry, index) => this.addRow(entry, index));
    const tabs = this.scene.add.container(0, 0);
    const { tab } = RECOLLECTION_LAYOUT;
    const startX = -((RECOLLECTION_GROUPS.length - 1) * (tab.width + tab.gap)) / 2;
    RECOLLECTION_GROUPS.forEach((group, index) => {
      addCategoryTab(this.scene, tabs, {
        x: startX + index * (tab.width + tab.gap), y: tab.y, width: tab.width, height: tab.height,
        label: t(`recollection.tab.${group}`), selected: group === this.tab,
        onSelect: () => { if (group === this.tab) return; this.tab = group; this.render(); },
      });
    });
    body.add(tabs);
    // 새 것을 먼저 세우고 옛 것을 걷는다 — 원화는 세운 객체가 사는 동안만 붙잡히므로 거꾸로 하면 내려갔다 다시 읽힌다.
    previousList?.destroy(); previousTabs?.destroy();
    this.list = list; this.tabs = tabs;
    this.applyScroll(0);
  }

  /**
   * 흐르는 창. 마스크는 흐르지 않는 틀(`frame`)을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다.
   *
   * **줄마다 입력면을 두지 않는다.** 줄이 창을 거의 채워 줄 위에서 시작한 끌기가 목록을 흘리지 못하므로,
   * 창 전체가 끌기를 받고 손을 떼는 자리가 끌지 않은 누름이면 그 아래 줄을 연다. 창 밖으로 나간 줄은
   * 감춘다 — 마스크는 그림만 자르고 입력을 막지 않는다.
   */
  private buildList(body: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const { viewport, layer } = RECOLLECTION_LAYOUT;
    const frame = this.scene.add.container(0, viewport.top);
    body.add(frame);
    const viewHeight = recollectionViewportHeight();
    const half = layer.width / 2 + 24;
    // 창 전체가 끌기를 받되, 입력면도 창 안에서만 손을 받는다(`addClippedHit` — 판이 떠오르는 동안의 자리도 따라간다).
    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - half * scale, right: matrix.tx + half * scale, top: matrix.ty, bottom: matrix.ty + viewHeight * scale };
    };
    const drag = addClippedHit(this.scene, frame, 0, viewHeight / 2, half * 2, viewHeight, clip, { useHandCursor: false });
    this.scene.input.setDraggable(drag);
    const content = this.scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(this.scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));
    this.content = content;
    this.minScroll = Math.min(0, viewHeight - recollectionListHeight(this.entries.length));
    const localY = (pointer: Phaser.Input.Pointer): number => {
      const matrix = frame.getWorldTransformMatrix();
      return (pointer.worldY - matrix.ty) / (matrix.scaleY || 1) - this.scroll;
    };
    let lastY = 0; let travel = 0; let pressed: Phaser.GameObjects.Container | undefined;
    const release = (pop: boolean): void => { if (pressed) pressOut(pressed, "normal", { pop }); pressed = undefined; };
    drag.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      travel = 0;
      const index = recollectionRowAt(localY(pointer), this.entries.length);
      const entry = index === undefined ? undefined : this.entries[index];
      if (entry && storyManager.isCompleted(entry.storyId)) { pressed = this.rows[index!]; pressIn(pressed); }
    });
    drag.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
    drag.on("drag", (pointer: Phaser.Input.Pointer) => {
      const scale = frame.getWorldTransformMatrix().scaleY || 1;
      travel += Math.abs(pointer.y - lastY);
      if (travel > TAP_SLOP) release(false);
      this.applyScroll(this.scroll + (pointer.y - lastY) / scale); lastY = pointer.y;
    });
    drag.on("pointerout", () => release(false));
    drag.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const wasPressed = pressed !== undefined;
      release(true);
      if (!wasPressed || travel > TAP_SLOP) return;
      const index = recollectionRowAt(localY(pointer), this.entries.length);
      const entry = index === undefined ? undefined : this.entries[index];
      if (entry && storyManager.isCompleted(entry.storyId)) this.onPlay(entry.storyId);
    });
    drag.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.applyScroll(this.scroll - dy * 0.65));
    return frame;
  }

  private applyScroll(value: number): void {
    const content = this.content; if (!content?.active) return;
    const { layer } = RECOLLECTION_LAYOUT;
    this.scroll = Phaser.Math.Clamp(value, this.minScroll, 0);
    content.y = this.scroll;
    const viewHeight = recollectionViewportHeight();
    for (const row of this.rows) {
      const top = row.y + this.scroll - layer.height / 2;
      row.setVisible(top + layer.height > 0 && top < viewHeight);
    }
  }

  /**
   * 이야기 한 장.
   *
   * 원화는 **이미지 자신의 crop**으로 이야기마다 다른 띠를 잘라 내고(`recollectionArtCrop`), 깎인 두 모서리는
   * 판 실루엣 마스크가 지운다 — 마스크는 줄의 지금 월드 행렬을 매 프레임 따라가 흐르는 목록에서도 어긋나지 않는다.
   * 아직 보지 않은 이야기도 무대는 비치되 한 겹 더 눌리고, 이름 자리에 `???`와 자물쇠가 선다.
   */
  private addRow(entry: RecollectionEntry, index: number): void {
    const content = this.content; if (!content) return;
    const { layer } = RECOLLECTION_LAYOUT;
    const done = storyManager.isCompleted(entry.storyId);
    const story = getRecollectionStory(entry.storyId);
    const row = this.scene.add.container(0, recollectionRowY(index));
    content.add(row); this.rows.push(row);
    const { width, height } = layer;
    const shape = chipPoints(width, height, { bevel: { topLeft: layer.bevel, topRight: 0, bottomRight: layer.bevel, bottomLeft: 0 } });
    row.add(drawLayer(this.scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));

    const clip = shapeClipMask(this.scene, row, shape);
    const art = this.scene.add.image(0, 0, "__DEFAULT").setAlpha(0);
    row.add(art);
    const alreadyLoaded = this.scene.textures.exists(DIALOGUE_BACKDROP[story.backdrop ?? "relics"]);
    useBackgroundTexture(this.scene, art, DIALOGUE_BACKDROP[story.backdrop ?? "relics"], (loaded) => {
      const crop = recollectionArtCrop(loaded.width, loaded.height, width, height, recollectionArtFocus(entry.storyId));
      loaded.setScale(crop.scale).setPosition(crop.offsetX, crop.offsetY);
      loaded.setCrop(crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight);
      loaded.setMask(clip);
      const alpha = done ? layer.artAlpha : layer.lockedArtAlpha;
      if (alreadyLoaded || session.settings.accessibility.reduceMotion) loaded.setAlpha(alpha);
      else this.scene.tweens.add({ targets: loaded, alpha, duration: 160 });
    });

    // 대사 한 줄이 판 오른쪽에 은은하게 깔린다 — 같은 무대에서 흐르는 이야기라도 줄마다 목소리가 갈린다.
    if (done) {
      const echoLine = recollectionEcho(story);
      if (echoLine) {
        const echo = this.scene.add.text(width / 2 - layer.echo.right, layer.echo.y, `“${echoLine}”`, textStyle({ role: "body", size: layer.echo.size, color: COLOR.ink }))
          .setOrigin(1, 0.5).setAlpha(layer.echo.alpha).setMask(clip);
        squeezeTextToWidth(echo, layer.echo.maxWidth);
        row.add(echo);
      }
    }

    // 글이 서는 왼쪽만 어둠이 짙고 오른쪽으로 걷힌다 — 판 전체를 누르면 무대가 잿빛이 된다.
    const scrim = this.scene.add.graphics();
    const fadeStart = -width / 2 + width * layer.scrim.fadeFrom;
    scrim.fillStyle(COLOR.void, layer.scrim.alpha).fillRect(-width / 2, -height / 2, fadeStart + width / 2, height);
    scrim.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, layer.scrim.alpha, 0, layer.scrim.alpha, 0);
    scrim.fillRect(fadeStart, -height / 2, width * 0.42, height);
    row.add(scrim.setMask(clip));
    row.add(drawFrameVignette(this.scene, 0, 0, width, height, { strength: 0.3 }).setMask(clip));
    // 원화 한 장을 담는 액자라 사방을 두른다(교류 층과 같은 예외). 본 이야기만 강조색이다.
    row.add(drawShapeOutline(this.scene, 0, 0, shape, { color: done ? COLOR.accent : COLOR.inkDimHex, alpha: done ? 0.7 : 0.32, width: 3 }));

    const left = -width / 2 + layer.textInset;
    const textWidth = width * 0.62;
    const eyebrow = recollectionRowEyebrow(entry);
    if (eyebrow) {
      row.add(this.scene.add.text(left, layer.eyebrowY, eyebrow, textStyle({ role: "emphasis", size: 23, color: done ? COLOR.accentText : COLOR.inkDim }))
        .setOrigin(0, 0.5).setShadow(0, 2, "#05070a", 4, false, true));
    }
    const titleY = eyebrow ? layer.titleY : layer.titleY - 14;
    const title = this.scene.add.text(left, titleY, done ? recollectionRowLabel(entry) : t("recollection.locked"), textStyle({ role: "display", size: 42, color: done ? "#ffffff" : COLOR.inkDim }))
      .setOrigin(0, 0.5).setShadow(0, 3, "#05070a", 6, false, true);
    shrinkTextToWidth(title, textWidth);
    row.add(title);
    if (done) {
      const summary = this.scene.add.text(left, eyebrow ? layer.summaryY : layer.summaryY - 8, t(recollectionSummaryKey(entry)), textStyle({ role: "body", size: 25, color: COLOR.inkDim }))
        .setOrigin(0, 0.5).setAlpha(0.88).setShadow(0, 2, "#05070a", 4, false, true);
      squeezeTextToWidth(summary, width - layer.textInset * 2);
      row.add(summary);
    } else {
      row.add(drawGlyph(this.scene, "lock", width / 2 - 90, 0, 54, COLOR.inkDimHex, 0.8, 4));
    }
  }
}
