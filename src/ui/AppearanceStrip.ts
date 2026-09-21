import Phaser from "phaser";
import { t } from "../i18n";
import type { RelicDef, RelicSkinId } from "../core/types";
import { relicSkinManager } from "../managers/RelicSkinManager";
import { gameApi } from "../api/FakeServer";
import { battleAssetFor, headCardFrame, loadPortraitTexture, portraitAssetForSkin, sdAssetForSkin, spawnPuppet, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeInnerGlow, drawShapeOutline, slantedRect } from "./holo";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { popupArtShape, shapeClipMask } from "./popupArt";
import { addPriceBar } from "./priceTag";
import { COLOR, textStyle } from "./theme";
import {
  APPEARANCE_PANEL, appearanceFrames, appearanceFrameSpot, appearancePageRect, appearanceStripCardX,
  appearanceStripMinX, appearanceStripOffsetFor, appearanceStripViewport, type AppearanceRect,
} from "./appearancePanelLayout";
import {
  canEquipAppearance, isAppearanceDimmed, isAppearanceUnrevealed, type AppearanceEntry, type AppearanceState,
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

/**
 * 스테인드글라스 한 벌의 색.
 *
 * 값은 배경 원화에서 실측해 골랐다 — 납선의 금색 평균이 `#c6aa89`라 화면의 강조색과 같은
 * 계열이고, 유리면은 그 그림 위에서 캐릭터가 읽힐 만큼만 눌러 둔 짙은 청회색이다. 더 옅게
 * 두면 노란 옷을 입은 개체가 창의 밝은 면에 그대로 묻힌다.
 */
const PANE = { glass: 0x101826, glassAlpha: 0.66, page: 0x0b111b, leading: 6, silhouette: 0x1b2434 } as const;

export interface AppearanceStripHooks {
  /** 장착이 확정된 뒤 정보창의 두 Puppet을 같은 결과로 갈아 끼우게 알린다. */
  onEquipped: () => void;
  /** 값을 치른 뒤 상단 재화 줄이 같은 지갑을 다시 읽게 알린다. */
  onWalletChange?: () => void;
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
  /** 서버가 답하는 동안 잠근다 — 응답이 늦을 때 한 번 더 눌리면 같은 값을 두 번 낸다. */
  private busy = false;
  private hero?: PuppetCreature;
  private sd?: PuppetCreature;
  private face?: Phaser.GameObjects.Image;
  private heroToken = 0;
  private readonly heroLayer: Phaser.GameObjects.Container;
  private readonly faceLayer: Phaser.GameObjects.Container;
  private readonly sdLayer: Phaser.GameObjects.Container;
  private readonly frames: ReturnType<typeof appearanceFrames>;
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

    /*
     * **전용 뒷배경은 스테인드글라스 창의 홀이다.**
     *
     * 금색 납선이 창을 크고 작은 유리면으로 가르는 그림이라, 무대의 웹툰 칸 셋을 **그 창살과
     * 같은 문법**으로 세운다 — 칸 사이의 홈통에는 금색 납선이 지나가고 칸 자체는 반투명한
     * 유리면이다. 판 위에 도형을 덧그리는 대신 그림의 규칙을 이어받았으므로 배경과 칸이 한
     * 장으로 읽힌다.
     *
     * 가장자리는 `drawFrameVignette`으로 **은은하게만** 누른다 — 진하게 두면 창의 위아래가
     * 잘려 보여 홀의 높이가 사라진다.
     */
    const artShape = popupArtShape(layout.width, layout.height);
    addPopupBackgroundImage(this.scene, body, BACKGROUND.appearance, {
      x: 0, y: 0, width: layout.width, height: layout.height, maskShape: artShape, overlayStrength: 0.22,
    });
    // 몸판과 같은 실루엣의 마스크 한 장을 **판 위에 까는 것들이 함께 쓴다** — 가장자리 누르기도
    // 밑동 판도 네모라, 그대로 두면 깎아 낸 왼쪽 위·오른쪽 아래 모서리에서 다시 삐져나온다.
    const bodyClip = shapeClipMask(this.scene, body, artShape);
    body.add(drawFrameVignette(this.scene, 0, 0, layout.width, layout.height, { strength: 0.42, spread: 0.2 }).setMask(bodyClip));

    /*
     * **밑동 판은 띠 칸의 허리에서 시작한다.**
     *
     * 무대 바로 밑에서 시작해 이름·보유 여부까지 다 품던 때는 창의 아래 절반이 통째로 어두운
     * 판이 되어, 글줄이 배경 원화가 아니라 그 판 위에 적힌 목록처럼 읽혔다. 절반쯤으로 줄여
     * 칸의 허리를 지나가게 하면 아이콘 줄은 반쯤 판 위에 올라선 것으로 보이고, 그 위의 글줄은
     * 창 자체 위에 선다. 판의 오른쪽 아래는 몸판의 빗변을 그대로 따르므로(같은 마스크) 창
     * 밖으로 뿔이 남지 않는다.
     */
    const page = appearancePageRect();
    body.add(drawLayer(this.scene, (page.left + page.right) / 2, (page.top + page.bottom) / 2,
      slantedRect(page.right - page.left, page.bottom - page.top, 0), { fill: PANE.page, alpha: 0.62, shadow: false })
      .setMask(bodyClip));

    const frames = appearanceFrames();
    this.heroLayer = this.addFrame(body, frames.hero);
    this.faceLayer = this.addFrame(body, frames.face);
    this.sdLayer = this.addFrame(body, frames.sd);
    // 납선은 칸을 다 세운 뒤에 긋는다 — 칸보다 먼저 그으면 유리면이 그 위를 덮어 사라진다.
    this.addLeading(body, frames);
    this.frames = frames;

    /*
     * **글줄은 판이 아니라 제 그림자로 배경에서 떨어져 나온다.**
     *
     * 밑동 판이 띠의 허리까지만 올라오므로 이름과 보유 여부는 배경 원화 위에 바로 선다 —
     * 창의 밝은 유리면 위에서는 흰 글자가 그대로 묻히므로, 획 둘레에 검은 띠를 두르고 아래로
     * 그림자를 한 겹 떨군다(전투 이름줄과 같은 방법이라 대비가 배경 원화와 무관해진다).
     * 보유 여부는 이름보다 작고 옅으므로 띠도 그만큼 얇다.
     */
    this.name = this.scene.add.text(0, layout.name.y, "", textStyle({ role: "display", size: layout.name.size, align: "center", wrap: layout.width - 140 }))
      .setOrigin(0.5).setStroke("#05070a", 8).setShadow(0, 5, "#05070a", 8, true, true);
    this.state = this.scene.add.text(0, layout.state.y, "", textStyle({ role: "emphasis", size: layout.state.size }))
      .setOrigin(0.5).setStroke("#05070a", 5).setShadow(0, 3, "#05070a", 5, true, true);
    this.priceRow = this.scene.add.container(0, layout.price.y);
    body.add([this.name, this.state, this.priceRow]);

    this.action = new Button(this.scene, 0, layout.action.y, {
      width: layout.action.width, height: layout.action.height, label: t("info.skin.equip"), variant: "primary",
      onClick: () => this.pressAction(),
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
   * 칸과 칸 사이를 지나는 **금색 납선**.
   *
   * 홈통을 빈자리로 두면 세 칸이 따로 뜬 판 셋으로 보인다. 창살이 지나가야 한 장의 창을
   * 갈라 놓은 것으로 읽히므로, 홈통 폭 안쪽에 금색 띠를 긋고 그 아래로 어두운 획을 한 겹
   * 깔아 납선이 유리면보다 앞에 있는 것처럼 보이게 한다.
   */
  private addLeading(body: Phaser.GameObjects.Container, frames: ReturnType<typeof appearanceFrames>): void {
    const bar = (x: number, y: number, width: number, height: number): void => {
      const shape = slantedRect(width, height, 0);
      body.add(drawLayer(this.scene, x + 2, y + 2, shape, { fill: 0x1a1206, alpha: 0.55, shadow: false }));
      body.add(drawLayer(this.scene, x, y, shape, { fill: COLOR.accent, alpha: 0.72, shadow: false }));
    };
    // 큰 칸과 오른쪽 기둥을 가르는 세로 납선.
    bar((frames.hero.right + frames.face.left) / 2, (frames.hero.top + frames.hero.bottom) / 2,
      PANE.leading, frames.hero.bottom - frames.hero.top);
    // 오른쪽 기둥의 두 칸을 가르는 가로 납선.
    bar((frames.face.left + frames.face.right) / 2, (frames.face.bottom + frames.sd.top) / 2,
      frames.face.right - frames.face.left, PANE.leading);
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
    // **불투명한 판이 아니라 유리면이다.** 배경 원화가 비쳐야 창을 갈라 놓은 것으로 읽힌다.
    body.add(drawLayer(this.scene, spot.x, spot.y, shape, { fill: PANE.glass, alpha: PANE.glassAlpha, shadow: false }));
    const content = this.scene.add.container(spot.x, spot.y);
    body.add(content);
    /*
     * **칸을 채우는 것도, 칸을 누르는 것도 같은 실루엣으로 잘린다.**
     *
     * 예전에는 원화만 **네모** 마스크로 잘랐고 가장자리 누르기는 아무것도 씌우지 않았다 —
     * 깎아 낸 왼쪽 위·오른쪽 아래에서 원화와 검은 그라데이션이 함께 삐져나와, 납선 밖에
     * 네모난 뿔이 남았다. 칸 도형 그대로 자르는 마스크 한 장을 둘이 나눠 쓴다.
     */
    const clip = shapeClipMask(this.scene, body, shape, spot);
    content.setMask(clip);
    body.add(drawFrameVignette(this.scene, spot.x, spot.y, spot.width, spot.height, { strength: 0.52 }).setMask(clip));
    // 칸 둘레의 납선. 홈통의 띠와 같은 금색이라 창살 한 벌로 이어진다.
    body.add(drawShapeOutline(this.scene, spot.x, spot.y, shape, { color: COLOR.accent, alpha: 0.72, width: 4 }));
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
    // 칸을 채운 얼굴과 그 위의 가장자리 누르기가 **같은 액자 실루엣으로** 잘린다 — 그러지
    // 않으면 깎아 낸 두 모서리에서 그림과 검은 그라데이션이 액자 밖으로 삐져나온다. 띠는
    // 손으로 밀리고 고른 칸은 커지므로, 마스크는 카드의 지금 월드 행렬을 매 프레임 따라간다.
    const clip = shapeClipMask(this.scene, card, shape);
    figure.setMask(clip);
    card.add(drawFrameVignette(this.scene, 0, 0, strip.cardWidth, strip.cardHeight, { strength: 0.5 }).setMask(clip));
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
      strip.cardWidth, strip.cardHeight - 46, -22, this.artTone(entry), () => card.active);
  }

  /** 고른 칸을 바꾼다. 띠 밖의 칸을 고르면 그 칸이 창 안으로 따라 들어온다. */
  private focus(index: number): void {
    if (index === this.focused) return;
    this.focused = index;
    this.offset = appearanceStripOffsetFor(index, this.entries.length, this.offset);
    this.scene.tweens.add({ targets: this.rail, x: this.offset, duration: 180, ease: "Sine.easeOut" });
    this.paint();
  }

  /**
   * 버튼 하나가 맡는 두 조작 — 사거나, 입거나.
   *
   * 어느 쪽인지는 지금 상태가 정한다. 사는 쪽은 서버가 답할 때까지 버튼을 잠가 두 번 치르지
   * 않게 하고(응답이 늦는 동안 한 번 더 눌리면 같은 값을 두 번 낸다), 지급이 확정된 뒤에야
   * manager를 통해 세션에 반영한다.
   */
  private pressAction(): void {
    const entry = this.entries[this.focused];
    if (entry.skinId && entry.price && !relicSkinManager.owns(entry.skinId)) { void this.purchaseFocused(entry.skinId); return; }
    this.equipFocused();
  }

  /** 값 조회·차감·지급을 한 처리로 맡기고, 화면은 확정된 결과만 다시 그린다. */
  private async purchaseFocused(skinId: RelicSkinId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.paint();
    try {
      const result = await gameApi.purchaseRelicSkin({ relicId: this.def.id, skinId, requestId: `skin:${this.def.id}:${skinId}` });
      relicSkinManager.markPurchased(this.def.id, result.skinId);
      this.hooks.onWalletChange?.();
    } catch {
      // 실패는 값 줄이 이미 말한다(모자란 수가 붉다). 상태 문구로 같은 말을 되풀이하지 않는다.
    } finally {
      this.busy = false;
      this.paint();
    }
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
    // 산 뒤에는 그 칸이 `purchasable`에서 내려와야 한다 — 정적 계약이 아니라 **지금 소유**를
    // 다시 물어야 방금 치른 값이 화면에 반영된다.
    const stateOf = (entry: AppearanceEntry): AppearanceState => {
      if (entry.state === "comingSoon") return "comingSoon";
      const owned = entry.skinId === undefined || relicSkinManager.owns(entry.skinId);
      if (!owned) return entry.price ? "purchasable" : "locked";
      return entry.skinId === equippedId ? "equipped" : "owned";
    };
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

    // **버튼 하나가 상태를 따라간다** — 가진 것은 입고, 살 수 있는 것은 산다. 사는 길은
    // 화면이 아니라 서버 경계(`GameApi.purchaseRelicSkin`)를 지나므로 값과 차감을 여기서
    // 계산하지 않는다. 이미 입고 있거나 아직 열리지 않은 외형만 누를 것이 없다.
    this.action.setLabel(state === "equipped" ? t("info.skin.equipped") : state === "purchasable" ? t("info.skin.buy") : t("info.skin.equip"));
    const affordable = state !== "purchasable" || !entry.price || session.wallet[entry.price.currency] >= entry.price.amount;
    this.action.setEnabled(!this.busy && (state === "owned" || (state === "purchasable" && affordable)));
    this.loadHero(entry);
  }

  /**
   * 그 칸의 원화를 어떤 결로 세우나.
   *
   * 가진 것은 그대로, 아직 내 것이 아닌 것은 눌러 두고, **아직 열리지 않은 것은 실루엣**이다 —
   * 원화가 없어 기본 외형으로 되돌아가므로, 흐리게만 두면 같은 그림이 목록에 여러 번 선
   * 것처럼 보인다.
   */
  private artTone(entry: AppearanceEntry): { alpha: number; tint?: number } {
    if (isAppearanceUnrevealed(entry)) return { alpha: 1, tint: PANE.silhouette };
    return { alpha: isAppearanceDimmed(entry) ? 0.5 : 1 };
  }

  /**
   * 무대 세 칸. 고른 칸이 바뀌면 셋을 함께 그 외형으로 갈아 끼운다.
   *
   * 큰 칸은 **전신**, 중간 칸은 **얼굴**, 작은 칸은 **SD**다. 셋이 한 세대(`heroToken`)를
   * 공유하므로, 읽는 사이에 다른 칸을 골랐으면 늦게 온 셋이 모두 버려진다.
   */
  private loadHero(entry: AppearanceEntry): void {
    const token = ++this.heroToken;
    const asset = portraitAssetForSkin(this.def.portraitAssetId, entry.skinId ?? null);
    const tone = this.artTone(entry);
    const heroSpot = appearanceFrameSpot(this.frames.hero);
    const sdSpot = appearanceFrameSpot(this.frames.sd);
    const faceSpot = appearanceFrameSpot(this.frames.face);

    /*
     * 큰 칸 — **전신을 발끝까지 온전히** 담는다.
     *
     * 코어 관절을 잡고 칸보다 크게(1.24배) 세우던 때는 종아리 아래가 칸 밑변에서 잘려, 옷과
     * 신발이 바뀌는 외형인데 정작 그 부분을 볼 수 없었다. 지금은 발끝을 칸 밑변 조금 위에
     * 세우고 **가로도 함께 재어** 배율을 고른다 — 세로만 맞추면 원화가 옆으로 넘쳐 팔과 꼬리가
     * 납선에서 잘린다.
     */
    const inset = 16;
    const content = { width: asset.content.right - asset.content.left, height: asset.content.bottom - asset.content.top };
    const heroHeight = Math.min(heroSpot.height - inset * 2, ((heroSpot.width - inset * 2) * content.height) / content.width);
    void spawnPuppet(this.scene, asset, {
      x: 0, groundY: heroSpot.height / 2 - inset, height: heroHeight, depth: 0,
      ...(tone.tint === undefined ? {} : { tint: tone.tint }),
    }).then((puppet) => {
      if (token !== this.heroToken || !this.heroLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(tone.alpha);
      this.hero?.destroy();
      this.hero = puppet;
      this.heroLayer.add(puppet);
    });

    // 작은 칸 — SD. 발끝을 칸 밑변 조금 위에 세우고 칸을 거의 채운다(작은 칸이라 더 줄이면
    // 무슨 동작을 하는지 읽히지 않는다).
    void spawnPuppet(this.scene, sdAssetForSkin(this.def.id, entry.skinId ?? null) ?? battleAssetFor(this.def.id), {
      x: 0, groundY: sdSpot.height / 2 - 12, height: sdSpot.height * 0.92, depth: 0,
      ...(tone.tint === undefined ? {} : { tint: tone.tint }),
    }).then((puppet) => {
      if (token !== this.heroToken || !this.sdLayer.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      puppet.setAlpha(tone.alpha);
      this.sd?.destroy();
      this.sd = puppet;
      this.sdLayer.add(puppet);
    });

    // 중간 칸 — 얼굴. 띠의 칸과 **같은 잘라내기**를 쓰고 크기만 다르다.
    this.face?.destroy(); this.face = undefined;
    this.faceLayer.removeAll(true);
    void this.addFaceImage(this.faceLayer, asset, faceSpot.width, faceSpot.height, 0, tone, () => token === this.heroToken && this.faceLayer.active);
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
    tone: { alpha: number; tint?: number },
    isCurrent: () => boolean,
  ): Promise<void> {
    const { key, anchors } = await loadPortraitTexture(this.scene, asset, parent);
    if (!isCurrent()) return;
    const frame = headCardFrame(asset, anchors, {
      width, height,
      // 카드보다 훨씬 더 당겨 **얼굴 하나가 칸을 채운다** — 여기서 보려는 것은 등신이 아니라
      // 머리다. 0.42로 두었을 때는 어깨와 가슴까지 함께 들어와, 정작 달라지는 머리 장식이
      // 칸의 위쪽 절반으로 밀렸다.
      fillRatio: 0.32 / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      headroom: 0,
      cardTop: asset.cardTop,
    });
    const image = this.scene.add
      .image(-width / 2 - frame.cropX * frame.scale, -height / 2 + offsetY - frame.cropY * frame.scale, key)
      .setOrigin(0, 0)
      .setScale(frame.scale)
      .setAlpha(tone.alpha);
    // **덮어 칠하지 않고 곱한다.** 채우기(`setTintFill`)는 알파만 남기고 색을 통째로 갈아
    // 끼우는데, 얼굴 칸은 그림이 칸을 꽉 채워 불투명하므로 그 자리가 통째로 색면이 된다 —
    // 실루엣이 아니라 빈 판으로 읽힌다. 곱하기는 어두워질 뿐 결이 남고, Puppet의 색 필터와도
    // 같은 방식이라 세 칸이 한 결로 어두워진다.
    if (tone.tint !== undefined) image.setTint(tone.tint);
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
    this.hero?.destroy(); this.hero = undefined;
    this.sd?.destroy(); this.sd = undefined;
    this.face?.destroy(); this.face = undefined;
  }
}
