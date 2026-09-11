import Phaser from "phaser";
import type { ResearchSlotView } from "../core/researchPresentation";
import { getRelic } from "../data/relics";
import { mixWhite } from "../puppets/tints";
import { relicProgression } from "../managers/RelicProgressionManager";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawInnerVignette, drawShapeOutline, HOLO, toPoints } from "./holo";
import { addFramedIcon, ITEM_FRAME } from "./itemFrame";
import { PortraitCard } from "./PortraitCard";
import { RARITY_TONE } from "./rarityMark";
import { COLOR } from "./theme";
import { formatCurrency } from "../core/formatCurrency";

/** 뒤집힌 칸에 쓰는 화석 조각 그림. 아직 깨지 않은 표본이라 결과 대신 이 실루엣만 선다. */
const FACE_DOWN_ICON = "currency-fossil";

/** 뒤집힌 칸의 생김새. 등급색은 열었을 때 카드 바탕이 될 그 색이라 미리 보여도 갈리지 않는다. */
const FACE_DOWN = {
  /**
   * 등급색을 눌러 두는 몫.
   *
   * 너무 옅으면 회색·하늘빛·보라·호박이 검은 판 위에서 모두 같은 잿빛 칸으로 보여, 뒤집힌
   * 칸이 아무것도 말하지 않는다. 그렇다고 원색으로 채우면 열기도 전에 판이 알록달록해진다.
   */
  fill: 0.5,
  /** 화석 실루엣이 칸 폭에서 차지하는 비율. */
  icon: 0.52,
  iconAlpha: 0.55,
  outlineAlpha: 0.95,
  outlineWidth: 3,
} as const;

/** 칸 모서리를 깎는 길이(칸의 짧은 변 대비). 카드 칩과 같은 결로 어긋나게 깎는다. */
const TILE_BEVEL = { topLeft: 0.16, topRight: 0.06, bottomRight: 0.12, bottomLeft: 0.05 } as const;

export interface ResearchSlotTileOptions {
  view: ResearchSlotView;
  width: number;
  height: number;
  /** 중복 파편·재화가 쓰는 정사각 액자 한 변. */
  frameSize: number;
}

/**
 * 연구 결과판의 칸 한 장.
 *
 * 처음에는 **뒤집혀** 있고 등급색만 말한다. 누르면 섬광과 함께 그 칸의 결과가 들어온다 —
 * 새로 만난 렐릭만 카드로 서고, 중복 파편과 재화는 같은 액자 한 장으로 선다. 그래서 열고 나면
 * 액자들 사이에서 새 렐릭만 세로로 크게 서 있다.
 *
 * 열림 연출을 **칸 크기나 배율로 하지 않는다.** 카드 안의 기하 마스크는 컨테이너 배율을
 * 물려받지 않아, 여는 동안 카드를 키우면 원화만 제자리에 남는다. 뒤집힌 면이 가로로 접혀
 * 사라지고 결과는 그 자리에서 밝아진다.
 */
export class ResearchSlotTile extends Phaser.GameObjects.Container {
  readonly view: ResearchSlotView;
  /** 씬이 여는 순서를 정할 때 쓰는 열림 여부다. */
  private revealed = false;
  private readonly back: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly tone: number;
  private card?: PortraitCard;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ResearchSlotTileOptions, onOpen: (tile: ResearchSlotTile) => void) {
    super(scene, x, y);
    scene.add.existing(this);
    this.view = options.view;
    this.tone = options.view.grade === "GRAY" ? COLOR.researchGray : RARITY_TONE[options.view.grade].chip;
    // 깎임과 섬광이 칸 크기에서 나오므로 조각을 만들기 전에 먼저 정해 둔다.
    this.setSize(options.width, options.height);

    this.content = scene.add.container(0, 0).setAlpha(0);
    this.add(this.content);
    this.buildContent(scene, options);

    this.back = this.buildBack(scene, options.width, options.height);
    this.add(this.back);

    this.hit = scene.add.rectangle(0, 0, options.width, options.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.hit.on("pointerdown", () => { if (!this.revealed) this.back.setScale(1.08); });
    this.hit.on("pointerout", () => this.back.setScale(1));
    this.hit.on("pointerup", () => {
      this.back.setScale(1);
      if (!this.revealed) onOpen(this);
    });
    this.add(this.hit);
  }

  get opened(): boolean {
    return this.revealed;
  }

  /** 카드 안의 기하 마스크를 현재 화면 자리에 맞춘다. 칸을 옮긴 뒤에 부른다. */
  syncMasks(): void {
    this.card?.syncMask();
  }

  /**
   * 칸을 연다.
   *
   * 이미 열린 칸은 아무 일도 하지 않는다 — 연속 터치로 같은 칸이 두 번 열리며 섬광이 겹치지
   * 않게 한다. 돌려주는 값은 "이번 호출이 실제로 열었는가"다.
   */
  reveal(instant = false): boolean {
    if (this.revealed) return false;
    this.revealed = true;
    this.hit.disableInteractive();

    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.85);
    flash.fillPoints(toPoints(chipPoints(this.width * 1.06, this.height * 1.06, { bevel: this.bevel() })), true);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.add(flash);

    const duration = instant ? 0 : 150;
    // 뒤집힌 면은 가로로 접히며 사라지고, 결과는 같은 자리에서 밝아진다.
    this.scene.tweens.add({ targets: this.back, scaleX: 0, alpha: 0, duration, onComplete: () => this.back.destroy() });
    this.scene.tweens.add({ targets: this.content, alpha: 1, duration: duration * 1.6, delay: duration });
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: instant ? 60 : 300,
      delay: duration,
      onComplete: () => flash.destroy(),
    });
    this.syncMasks();
    return true;
  }

  private bevel(): Record<"topLeft" | "topRight" | "bottomRight" | "bottomLeft", number> {
    const unit = Math.min(this.width, this.height);
    return {
      topLeft: unit * TILE_BEVEL.topLeft,
      topRight: unit * TILE_BEVEL.topRight,
      bottomRight: unit * TILE_BEVEL.bottomRight,
      bottomLeft: unit * TILE_BEVEL.bottomLeft,
    };
  }

  /** 뒤집힌 면. 등급색 한 겹과 화석 실루엣만 있고 결과는 아무것도 말하지 않는다. */
  private buildBack(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
    const back = scene.add.container(0, 0);
    const shape = chipPoints(width, height, { bevel: this.bevel() });
    const points = toPoints(shape);
    const face = scene.add.graphics();
    // 카드와 같은 그림자 하나로 칸이 판에서 떠 보이게 한다.
    face.fillStyle(0x000000, HOLO.shadow.alpha);
    face.translateCanvas(HOLO.shadow.x, HOLO.shadow.y);
    face.fillPoints(points, true);
    face.translateCanvas(-HOLO.shadow.x, -HOLO.shadow.y);
    face.fillStyle(0x05070a, 0.94);
    face.fillPoints(points, true);
    face.fillStyle(this.tone, FACE_DOWN.fill);
    face.fillPoints(points, true);
    back.add(face);

    if (scene.textures.exists(FACE_DOWN_ICON)) {
      const icon = width * FACE_DOWN.icon;
      back.add(scene.add.image(0, 0, FACE_DOWN_ICON)
        .setDisplaySize(icon, icon)
        .setTint(mixWhite(this.tone, 0.45))
        .setAlpha(FACE_DOWN.iconAlpha));
    }
    // 액자와 같은 안쪽 비네트. 단색 면만 두면 칸이 종이처럼 납작해 보인다.
    back.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
    back.add(drawShapeOutline(scene, 0, 0, shape, {
      color: mixWhite(this.tone, 0.3),
      alpha: FACE_DOWN.outlineAlpha,
      width: FACE_DOWN.outlineWidth,
    }));
    return back;
  }

  /** 열었을 때 서는 것. 새로 만난 렐릭만 카드이고 나머지는 전부 같은 액자 한 장이다. */
  private buildContent(scene: Phaser.Scene, options: ResearchSlotTileOptions): void {
    const { view, frameSize } = options;
    if (view.kind === "relic") {
      const def = getRelic(view.relicId);
      const card = new PortraitCard(scene, 0, 0, {
        width: options.width,
        height: options.height,
        relicId: def.id,
        label: def.name,
        rarity: def.rarity,
        stars: relicProgression.getStars(def.id),
        // 결과판은 칸이 맞물려 서므로 머리를 칩 안에 가둔다.
        head: "inside",
      });
      this.card = card;
      this.content.add(card);
      // 새로 만난 렐릭만 발광을 켠다 — 액자들 사이에서 이 한 장이 먼저 읽혀야 한다.
      card.setSelected(true, RARITY_TONE[def.rarity].chip);
      return;
    }
    if (view.kind === "fragment") {
      const def = getRelic(view.relicId);
      // 파편은 그 개체의 얼굴을 꽉 채운 액자다. 재화 액자와 같은 양식이라 판에서 나란히 선다.
      this.content.add(new FaceFrame(scene, 0, 0, {
        portraitAssetId: def.portraitAssetId,
        size: frameSize,
        color: RARITY_TONE[def.rarity].chip,
        amount: formatCurrency(view.amount),
      }));
      return;
    }
    const icon = view.kind === "dna" ? CURRENCY_ICON_BY_WALLET.dnaFragments : CURRENCY_ICON_BY_WALLET[view.currency];
    addFramedIcon(scene, this.content, 0, 0, frameSize, icon, {
      amount: formatCurrency(view.amount),
      color: COLOR.researchGray,
    });
  }
}
