import Phaser from "phaser";
import { t } from "../i18n";
import type { RelicDef } from "../core/types";
import { relicSkinManager } from "../managers/RelicSkinManager";
import { battleAssetFor, headCardFrame, loadPortraitTexture, portraitAssetForSkin, sdAssetForSkin, spawnPuppet, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeInnerGlow, drawShapeOutline, slantedRect } from "./holo";
import { addPriceBar } from "./priceTag";
import { COLOR, textStyle } from "./theme";
import {
  APPEARANCE_PANEL, appearanceFrames, appearanceFrameSpot, appearancePageRect, appearanceStripCardX,
  appearanceStripMinX, appearanceStripOffsetFor, appearanceStripViewport, type AppearanceRect,
} from "./appearancePanelLayout";
import {
  canEquipAppearance, isAppearanceDimmed, type AppearanceEntry, type AppearanceState,
} from "./appearanceModel";

/** 상태마다 한 낱말. 화면이 상태별로 문장을 새로 짓지 않는다. */
const STATE_TEXT: Record<AppearanceState, "info.skin.equipped" | "info.skin.owned" | "info.skin.purchasable" | "info.skin.locked" | "info.skin.comingSoon"> = {
  equipped: "info.skin.equipped",
  owned: "info.skin.owned",
  purchasable: "info.skin.purchasable",
  locked: "info.skin.locked",
  comingSoon: "info.skin.comingSoon",
};

/**
 * 상태 색.
 *
 * **지금 입고 있는 것만 강조색**이다 — 넷이 저마다 다른 색으로 서면 어느 것이 지금 그 개체의
 * 모습인지 색으로 읽히지 않는다. 아직 내 것이 아닌 둘은 같은 회색으로 물러난다.
 */
const STATE_COLOR: Record<AppearanceState, string> = {
  equipped: COLOR.accentText,
  owned: COLOR.ink,
  purchasable: COLOR.inkDim,
  locked: COLOR.inkDim,
  comingSoon: COLOR.inkDim,
};

export interface AppearanceStripHooks {
  /** 장착이 확정된 뒤 정보창의 두 Puppet을 같은 결과로 갈아 끼우게 알린다. */
  onEquipped: () => void;
}

/**
 * 외형 전시관의 본문.
 *
 * 무대 하나와 띠 하나를 함께 소유한다 — 고른 칸이 바뀌면 무대의 전신·이름·상태·값·조작이
 * 한꺼번에 그 칸을 따라간다. 자리는 전부 `appearancePanelLayout.ts`가 갖고 상태 판정은
 * `appearanceModel.ts`가 갖는다.
 */
export class AppearanceStrip {
  private focused = 0;
  private hero?: PuppetCreature;
  private sd?: PuppetCreature;
  private face?: Phaser.GameObjects.Image;
  private heroToken = 0;
  private readonly heroLayer: Phaser.GameObjects.Container;
  private readonly faceLayer: Phaser.GameObjects.Container;
  private readonly sdLayer: Phaser.GameObjects.Container;
  private readonly frames: ReturnType<typeof appearanceFrames>;
  /** 칸마다 하나씩 — 컨테이너 이동을 물려받지 않으므로 소유자가 직접 거둔다. */
  private readonly frameMasks: Phaser.GameObjects.Graphics[] = [];
  private readonly name: Phaser.GameObjects.Text;
  private readonly state: Phaser.GameObjects.Text;
  private readonly priceRow: Phaser.GameObjects.Container;
  private readonly action: Button;
  private readonly cards: Phaser.GameObjects.Container[] = [];
  private readonly rail: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Rectangle;
  private geometryMask?: Phaser.Display.Masks.GeometryMask;
  private offset = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    body: Phaser.GameObjects.Container,
    private readonly def: RelicDef,
    private readonly entries: readonly AppearanceEntry[],
    private readonly hooks: AppearanceStripHooks,
  ) {
    const layout = APPEARANCE_PANEL;
    this.focused = Math.max(0, entries.findIndex((entry) => entry.state === "equipped"));

    // **무대는 웹툰 칸 셋이다.** 받침 타원을 깔지 않는다 — 화면에서 유일하게 둥근 것이라
    // 홀로그램 결에서 혼자 떠 있었고, 전용 뒷배경이 들어오면 그 자리를 칸이 대신 맡는다.
    // 아래 글줄과 띠도 같은 페이지 위에 앉혀 위아래가 한 장으로 읽히게 한다.
    const page = appearancePageRect();
    body.add(drawLayer(this.scene, (page.left + page.right) / 2, (page.top + page.bottom) / 2,
      slantedRect(page.right - page.left, page.bottom - page.top, 0), { fill: 0x080d13, alpha: 0.5, shadow: false }));
    const frames = appearanceFrames();
    this.heroLayer = this.addFrame(body, frames.hero);
    this.faceLayer = this.addFrame(body, frames.face);
    this.sdLayer = this.addFrame(body, frames.sd);
    this.frames = frames;

    this.name = this.scene.add.text(0, layout.name.y, "", textStyle({ role: "display", size: layout.name.size, align: "center", wrap: layout.width - 140 })).setOrigin(0.5);
    this.state = this.scene.add.text(0, layout.state.y, "", textStyle({ role: "emphasis", size: layout.state.size })).setOrigin(0.5);
    this.priceRow = this.scene.add.container(0, layout.price.y);
    body.add([this.name, this.state, this.priceRow]);

    this.action = new Button(this.scene, 0, layout.action.y, {
      width: layout.action.width, height: layout.action.height, label: t("info.skin.equip"), variant: "primary",
      onClick: () => this.equipFocused(),
    });
    body.add(this.action);

    const view = appearanceStripViewport();
    this.rail = this.scene.add.container(0, layout.strip.y);
    body.add(this.rail);
    this.installMask(body, view);
    entries.forEach((entry, index) => this.addCard(entry, index));
    this.installDrag(body, view);
    this.paint();
  }

  /**
   * 웹툰 칸 한 장.
   *
   * 그림 한 장을 담는 칸이라 **액자 규칙**을 쓴다 — 불투명한 면에 사방 외곽선, 안쪽 비네트다.
   * 돌려주는 컨테이너는 칸 안쪽만 보이도록 잘려 있어, 안에 세운 원화가 칸을 넘쳐도 홈통을
   * 침범하지 않는다(그 넘침이 곧 "칸에 꽉 찬 그림"이다).
   */
  private addFrame(body: Phaser.GameObjects.Container, rect: AppearanceRect): Phaser.GameObjects.Container {
    const spot = appearanceFrameSpot(rect);
    const unit = Math.min(spot.width, spot.height);
    const shape = chipPoints(spot.width, spot.height, {
      bevel: { topLeft: unit * 0.16, topRight: 0, bottomRight: unit * 0.16, bottomLeft: 0 },
    });
    body.add(drawLayer(this.scene, spot.x, spot.y, shape, { fill: 0x0a1017, alpha: 0.98, shadow: false }));
    const content = this.scene.add.container(spot.x, spot.y);
    body.add(content);
    body.add(drawFrameVignette(this.scene, spot.x, spot.y, spot.width, spot.height, { strength: 0.52 }));
    body.add(drawShapeOutline(this.scene, spot.x, spot.y, shape, { color: COLOR.accent, alpha: 0.5, width: 3 }));
    // 마스크는 표시 목록 밖이라 판의 이동·배율을 물려받지 않는다 — 팝업의 지금 월드 행렬로
    // 네 변을 다시 재어 세운다(띠 마스크와 같은 방법).
    const matrix = body.getWorldTransformMatrix();
    const center = matrix.transformPoint(spot.x, spot.y);
    const right = matrix.transformPoint(spot.x + spot.width / 2, spot.y);
    const bottom = matrix.transformPoint(spot.x, spot.y + spot.height / 2);
    const mask = this.scene.make.graphics({});
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(
      center.x - Math.hypot(right.x - center.x, right.y - center.y),
      center.y - Math.hypot(bottom.x - center.x, bottom.y - center.y),
      Math.hypot(right.x - center.x, right.y - center.y) * 2,
      Math.hypot(bottom.x - center.x, bottom.y - center.y) * 2,
    );
    content.setMask(mask.createGeometryMask());
    this.frameMasks.push(mask);
    return content;
  }

  /**
   * 띠만 자르는 기하 마스크.
   *
   * 마스크는 표시 목록 밖에 있어 팝업 컨테이너의 이동·배율을 물려받지 않는다 — 팝업의 지금
   * 월드 행렬로 네 변을 다시 재어 세운다(가방 격자와 같은 방법).
   */
  private installMask(body: Phaser.GameObjects.Container, view: { left: number; right: number; top: number; bottom: number }): void {
    const matrix = body.getWorldTransformMatrix();
    const center = matrix.transformPoint((view.left + view.right) / 2, (view.top + view.bottom) / 2);
    const right = matrix.transformPoint(view.right, (view.top + view.bottom) / 2);
    const bottom = matrix.transformPoint((view.left + view.right) / 2, view.bottom);
    this.maskShape = this.scene.add
      .rectangle(center.x, center.y, Math.hypot(right.x - center.x, right.y - center.y) * 2, Math.hypot(bottom.x - center.x, bottom.y - center.y) * 2, 0xffffff)
      .setVisible(false);
    this.geometryMask = this.maskShape.createGeometryMask();
    this.rail.setMask(this.geometryMask);
  }

  /** 띠를 손으로 밀고, 칸 밖에서 끝난 손은 고르기로 치지 않는다. */
  private installDrag(body: Phaser.GameObjects.Container, view: { left: number; right: number; top: number; bottom: number }): void {
    const hit = this.scene.add
      .rectangle((view.left + view.right) / 2, (view.top + view.bottom) / 2, view.right - view.left, view.bottom - view.top, 0xffffff, 0)
      .setInteractive({ draggable: true });
    let dragX = 0;
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragX = pointer.x; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { this.slide(pointer.x - dragX); dragX = pointer.x; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, dx: number, dy: number) => this.slide(-(dx || dy) * 0.6));
    body.add(hit);
    body.sendToBack(hit);
  }

  /** 띠를 미는 몫. 칸이 창을 못 채우면 움직이지 않는다. */
  private slide(delta: number): void {
    this.offset = Phaser.Math.Clamp(this.offset + delta, appearanceStripMinX(this.entries.length), 0);
    this.rail.setX(this.offset);
  }

  /**
   * 띠의 칸 한 장.
   *
   * 그림 한 장을 담는 칸이라 **액자 규칙**을 쓴다 — 불투명한 면에 사방 외곽선, 안쪽 비네트다.
   * 아직 내 것이 아닌 외형은 원화만 눌러 두고 칸은 그대로 둔다(칸까지 흐리면 무엇이 있는지도
   * 읽히지 않는다).
   */
  private addCard(entry: AppearanceEntry, index: number): void {
    const { strip } = APPEARANCE_PANEL;
    const card = this.scene.add.container(appearanceStripCardX(index, this.entries.length), 0);
    const shape = chipPoints(strip.cardWidth, strip.cardHeight, {
      bevel: { topLeft: 34, topRight: 0, bottomRight: 26, bottomLeft: 0 },
    });
    card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0c1219, alpha: 0.98 }));
    const figure = this.scene.add.container(0, 0);
    card.add(figure);
    card.add(drawFrameVignette(this.scene, 0, 0, strip.cardWidth, strip.cardHeight, { strength: 0.5 }));
    // 고른 칸만 안쪽에서 번지는 강조 빛 한 겹 — 테두리를 두르지 않는다.
    const glow = drawShapeInnerGlow(this.scene, 0, 0, shape, { color: COLOR.accent, strength: 0.55 });
    card.add(glow);
    const label = this.scene.add
      .text(0, strip.cardHeight / 2 - 26, entry.name, textStyle({ role: "emphasis", size: 21, align: "center", wrap: strip.cardWidth - 24 }))
      .setOrigin(0.5, 1);
    card.add(this.scene.add.existing(drawLayer(this.scene, 0, strip.cardHeight / 2 - 30, slantedRect(strip.cardWidth - 16, 54, 10), { fill: 0x05070a, alpha: 0.86, shadow: false })));
    card.add(label);
    const hit = this.scene.add.rectangle(0, 0, strip.cardWidth, strip.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.focus(index));
    card.add(hit);
    card.setData("glow", glow);
    card.setData("label", label);
    this.rail.add(card);
    this.cards.push(card);

    // **칸에는 얼굴이 크게 든다.** 전신을 통째로 줄여 넣으면 이름표 위의 작은 인형이 되어
    // 스킨끼리 무엇이 다른지 알 수 없다 — 바뀌는 것은 대개 머리 장식과 얼굴 주변이라, 카드와
    // 같은 머리 관절 기준 잘라내기로 그 부분만 꽉 채운다. 살아 움직일 필요가 없는 목록이라
    // Mesh가 아니라 정지 그림 한 장이다(칸이 여럿 서므로 draw call도 그만큼 줄어든다).
    void this.addFaceImage(figure, portraitAssetForSkin(this.def.portraitAssetId, entry.skinId ?? null),
      strip.cardWidth, strip.cardHeight - 46, -22, isAppearanceDimmed(entry) ? 0.34 : 1, () => card.active);
  }

  /** 고른 칸을 바꾼다. 띠 밖의 칸을 고르면 그 칸이 창 안으로 따라 들어온다. */
  private focus(index: number): void {
    if (index === this.focused) return;
    this.focused = index;
    this.offset = appearanceStripOffsetFor(index, this.entries.length, this.offset);
    this.scene.tweens.add({ targets: this.rail, x: this.offset, duration: 180, ease: "Sine.easeOut" });
    this.paint();
  }

  /** 지금 고른 외형을 입힌다. 성공 여부는 manager가 정하고 화면은 결과만 다시 그린다. */
  private equipFocused(): void {
    const entry = this.entries[this.focused];
    if (!canEquipAppearance(entry)) return;
    const succeeded = entry.skinId ? relicSkinManager.equip(this.def.id, entry.skinId) : relicSkinManager.unequip(this.def.id);
    if (!succeeded) return;
    this.hooks.onEquipped();
    this.paint();
  }

  /**
   * 무대와 띠를 지금 상태로 다시 그린다.
   *
   * 장착은 **목록 전체의 상태를 바꾸므로**(입고 있던 것이 보유로 내려간다) 한 칸이 아니라 늘
   * 전부를 다시 읽는다.
   */
  private paint(): void {
    const equippedId = relicSkinManager.equippedFor(this.def.id);
    // 장착은 목록 전체의 상태를 바꾼다 — 입고 있던 것이 보유로 내려가므로 한 칸이 아니라
    // 늘 전부를 지금 장착값에 비춰 다시 읽는다. 못 가진 셋은 장착과 무관하다.
    const stateOf = (entry: AppearanceEntry): AppearanceState =>
      entry.state === "comingSoon" || entry.state === "purchasable" || entry.state === "locked"
        ? entry.state
        : entry.skinId === equippedId ? "equipped" : "owned";
    this.cards.forEach((card, index) => {
      const chosen = index === this.focused;
      const state = stateOf(this.entries[index]);
      card.setScale(chosen ? 1.06 : 1);
      (card.getData("glow") as Phaser.GameObjects.Graphics).setVisible(chosen);
      (card.getData("label") as Phaser.GameObjects.Text).setColor(state === "equipped" ? COLOR.accentText : chosen ? COLOR.ink : COLOR.inkDim);
    });

    const entry = this.entries[this.focused];
    const state = stateOf(entry);
    this.name.setText(entry.name);
    this.name.setColor(isAppearanceDimmed(entry) ? COLOR.inkDim : COLOR.ink);
    this.state.setText(t(STATE_TEXT[state]));
    this.state.setColor(STATE_COLOR[state]);

    // 값 줄은 **살 수 있는 외형에만** 선다 — 없는 값을 0으로 적으면 공짜로 읽힌다.
    this.priceRow.removeAll(true);
    if (state === "purchasable" && entry.price) {
      addPriceBar(this.scene, this.priceRow, 0, 0, APPEARANCE_PANEL.price.width, undefined, entry.price.currency, entry.price.amount, {
        height: APPEARANCE_PANEL.price.height,
        short: session.wallet[entry.price.currency] < entry.price.amount,
      });
    }

    // **조작은 장착 하나뿐이다.** 값이 붙은 외형도 아직 사는 경계가 없어, 있는 척하는 버튼
    // 대신 무엇을 하면 되는지만 값 줄이 말하고 버튼은 눌리지 않는다.
    this.action.setLabel(state === "equipped" ? t("info.skin.equipped") : state === "purchasable" ? t("info.skin.buy") : t("info.skin.equip"));
    this.action.setEnabled(state === "owned");
    this.loadHero(entry);
  }

  /**
   * 무대 세 칸. 고른 칸이 바뀌면 셋을 함께 그 외형으로 갈아 끼운다.
   *
   * 큰 칸은 **전신**(코어 관절을 기준으로 세워 발끝은 칸 밖으로 나간다 — "거의 전신"이라
   * 중심이 먼저 보여야 한다), 중간 칸은 **얼굴**, 작은 칸은 **SD**다. 셋이 한 세대(`heroToken`)를
   * 공유하므로, 읽는 사이에 다른 칸을 골랐으면 늦게 온 셋이 모두 버려진다.
   */
  private loadHero(entry: AppearanceEntry): void {
    const token = ++this.heroToken;
    const asset = portraitAssetForSkin(this.def.portraitAssetId, entry.skinId ?? null);
    const alpha = isAppearanceDimmed(entry) ? 0.5 : 1;
    const heroSpot = appearanceFrameSpot(this.frames.hero);
    const sdSpot = appearanceFrameSpot(this.frames.sd);
    const faceSpot = appearanceFrameSpot(this.frames.face);

    // 큰 칸 — 전신. 칸보다 크게 세워 넘치는 만큼은 칸이 잘라 낸다.
    void spawnPuppet(this.scene, asset, {
      focus: { anchor: "core", x: 0, y: heroSpot.height * 0.06 }, height: heroSpot.height * 1.24, depth: 0,
    }).then((puppet) => {
      if (token !== this.heroToken || !this.heroLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(alpha);
      this.hero?.destroy();
      this.hero = puppet;
      this.heroLayer.add(puppet);
    });

    // 작은 칸 — SD. 발끝을 칸 밑변 조금 위에 세운다.
    void spawnPuppet(this.scene, sdAssetForSkin(this.def.id, entry.skinId ?? null) ?? battleAssetFor(this.def.id), {
      x: 0, groundY: sdSpot.height / 2 - 18, height: sdSpot.height * 0.74, depth: 0,
    }).then((puppet) => {
      if (token !== this.heroToken || !this.sdLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(alpha);
      this.sd?.destroy();
      this.sd = puppet;
      this.sdLayer.add(puppet);
    });

    // 중간 칸 — 얼굴. 띠의 칸과 **같은 잘라내기**를 쓰고 크기만 다르다.
    this.face?.destroy(); this.face = undefined;
    this.faceLayer.removeAll(true);
    void this.addFaceImage(this.faceLayer, asset, faceSpot.width, faceSpot.height, 0, alpha, () => token === this.heroToken && this.faceLayer.active);
  }

  /**
   * 머리 관절을 기준으로 얼굴만 크게 잘라 넣은 정지 그림 한 장.
   *
   * 카드(`PortraitCard`)와 **같은 잘라내기 함수**를 쓴다 — 여기서 따로 값을 정하면 같은 원화가
   * 도감 카드와 외형 칸에서 다른 데를 잘라 보인다.
   */
  private async addFaceImage(
    parent: Phaser.GameObjects.Container,
    asset: PuppetAsset,
    width: number,
    height: number,
    offsetY: number,
    alpha: number,
    isCurrent: () => boolean,
  ): Promise<void> {
    const { key, anchors } = await loadPortraitTexture(this.scene, asset);
    if (!isCurrent()) return;
    const frame = headCardFrame(asset, anchors, {
      width, height,
      // 카드보다 더 당겨 얼굴이 칸을 꽉 채우게 한다 — 여기서 보려는 것은 등신이 아니라 머리다.
      fillRatio: 0.42 / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      headroom: 0,
      cardTop: asset.cardTop,
    });
    const image = this.scene.add
      .image(-width / 2 - frame.cropX * frame.scale, -height / 2 + offsetY - frame.cropY * frame.scale, key)
      .setOrigin(0, 0)
      .setScale(frame.scale)
      .setAlpha(alpha);
    image.setCrop(frame.cropX, frame.cropY, frame.cropWidth, frame.cropHeight);
    parent.add(image);
    if (parent === this.faceLayer) this.face = image;
  }

  /** 기하 마스크와 원본 도형은 컨테이너 자식이 아니므로 소유자가 직접 파괴한다. */
  destroy(): void {
    this.heroToken += 1;
    this.rail.clearMask(true);
    this.geometryMask?.destroy(); this.geometryMask = undefined;
    this.maskShape?.destroy(); this.maskShape = undefined;
    for (const mask of this.frameMasks) mask.destroy();
    this.frameMasks.length = 0;
    this.hero?.destroy(); this.hero = undefined;
    this.sd?.destroy(); this.sd = undefined;
    this.face?.destroy(); this.face = undefined;
  }
}
