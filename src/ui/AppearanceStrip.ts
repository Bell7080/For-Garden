import Phaser from "phaser";
import { t } from "../i18n";
import type { RelicDef } from "../core/types";
import { relicSkinManager } from "../managers/RelicSkinManager";
import { portraitAssetForSkin, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawFrameVignette, drawHairline, drawLayer, drawShapeInnerGlow, slantedRect } from "./holo";
import { addPriceBar } from "./priceTag";
import { COLOR, textStyle } from "./theme";
import {
  APPEARANCE_PANEL, appearanceStripCardX, appearanceStripMinX, appearanceStripOffsetFor, appearanceStripViewport,
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
  private heroToken = 0;
  private readonly heroLayer: Phaser.GameObjects.Container;
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

    // 무대 바닥의 투영 받침. 전신이 공중에 뜨지 않게 하고 그 아래 글줄과 가른다.
    body.add(this.scene.add.ellipse(0, layout.stand.y + 8, layout.stand.width, layout.stand.height, COLOR.void, 0.5));
    body.add(this.scene.add.ellipse(0, layout.stand.y, layout.stand.width - 24, layout.stand.height - 16, 0x121a24, 0.9));
    body.add(drawHairline(this.scene, 0, layout.stand.y - layout.stand.height / 2 + 8, layout.stand.width - 80, { color: COLOR.accent, alpha: 0.45 }));
    this.heroLayer = this.scene.add.container(0, 0);
    body.add(this.heroLayer);

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

    void spawnPuppet(this.scene, portraitAssetForSkin(this.def.portraitAssetId, entry.skinId ?? null), {
      x: 0, groundY: strip.cardHeight / 2 - 44, height: strip.cardHeight - 74, depth: 0,
    }).then((puppet) => {
      if (!card.active) { puppet.destroy(); return; }
      // 띠의 Puppet은 정보 전달을 바꾸지 않는 장식이므로 공용 유휴 갱신 예산을 적용한다.
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(isAppearanceDimmed(entry) ? 0.34 : 1);
      figure.add(puppet);
    });
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

  /** 무대의 전신. 고른 칸이 바뀌면 이전 것을 버리고 그 외형으로 다시 세운다. */
  private loadHero(entry: AppearanceEntry): void {
    const token = ++this.heroToken;
    const { hero } = APPEARANCE_PANEL;
    void spawnPuppet(this.scene, portraitAssetForSkin(this.def.portraitAssetId, entry.skinId ?? null), {
      x: 0, groundY: hero.groundY, height: hero.height, depth: 0,
    }).then((puppet) => {
      // 읽는 사이에 다른 칸을 골랐거나 판이 닫혔으면 새 Mesh를 남기지 않는다.
      if (token !== this.heroToken || !this.heroLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(isAppearanceDimmed(entry) ? 0.5 : 1);
      this.hero?.destroy();
      this.hero = puppet;
      this.heroLayer.add(puppet);
    });
  }

  /** 기하 마스크와 원본 도형은 컨테이너 자식이 아니므로 소유자가 직접 파괴한다. */
  destroy(): void {
    this.heroToken += 1;
    this.rail.clearMask(true);
    this.geometryMask?.destroy(); this.geometryMask = undefined;
    this.maskShape?.destroy(); this.maskShape = undefined;
    this.hero?.destroy(); this.hero = undefined;
  }
}
