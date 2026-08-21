import Phaser from "phaser";
import type { PortraitAssetId, RelicDef } from "../core/types";
import { headCardFrame, loadPortraitTexture, portraitAssetFor, portraitUsesRelicTint } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { COLOR, textStyle } from "./theme";

/** 카드 한 장의 조립 옵션. 크기와 라벨만 주면 나머지 연출은 프리팹이 맞춘다. */
export interface PortraitCardOptions {
  width: number;
  height: number;
  portraitAssetId: PortraitAssetId;
  /** 임시 공유 원화를 캐릭터별로 구분하는 색. 전용 원화면 넘기지 않는다. */
  tint?: number;
  /** 카드 아래 이름 띠. 비우면 띠를 만들지 않는다. */
  label?: string;
  /** 이름 아래 한 줄. 역할·등급처럼 짧은 문구를 넣는다. */
  sub?: string;
  /** 미발굴 카드. 원화를 실루엣으로 덮고 이름을 감춘다. */
  locked?: boolean;
  /** 카드 좌상단의 작은 배지(등급·순서). */
  badge?: string;
}

/** 카드 바탕과 복제 그림자 색. 어두운 화면 안에서 카드만 종이처럼 밝게 남긴다. */
const CARD_WHITE = 0xf5f4f1;
const CARD_SHADOW = 0x1a1d21;

/**
 * 캐릭터 카드.
 *
 * 전신 원화를 카드 비율로 잘라 머리가 상단에 오게 채우고, 뒤에는 같은 그림을 어둡게 복제한
 * 그림자를 깔아 흰 배경에서 인물이 떠 보이게 한다. 도감·편성·전투 프로필이 같은 규격을
 * 공유하도록 배치와 색은 전부 여기에서만 정한다.
 */
export class PortraitCard extends Phaser.GameObjects.Container {
  /** 씬이 pointerdown·pointerup을 붙이는 카드 전체 입력 영역이다. */
  readonly hit: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly portraits: Phaser.GameObjects.Image[] = [];
  private readonly nameText?: Phaser.GameObjects.Text;
  private readonly subText?: Phaser.GameObjects.Text;
  private readonly badgeText?: Phaser.GameObjects.Text;
  private readonly options: PortraitCardOptions;
  private selected = false;
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PortraitCardOptions) {
    super(scene, x, y);
    this.options = options;
    const { width, height } = options;
    const left = -width / 2;
    const top = -height / 2;

    // 카드 밖으로 떨어지는 부드러운 밑그림자. 카드가 종이처럼 얹혀 보이게 한다.
    this.add(scene.add.rectangle(6, 10, width, height, CARD_SHADOW, 0.28));
    this.add(scene.add.rectangle(0, 0, width, height, CARD_WHITE));
    // 아래로 갈수록 살짝 어두워지는 바닥면. 흰 카드가 밋밋해 보이지 않게 한다.
    const floor = scene.add.graphics();
    floor.fillGradientStyle(CARD_WHITE, CARD_WHITE, 0xc9c6c0, 0xc9c6c0, 0, 0, 0.9, 0.9);
    floor.fillRect(left, top + height * 0.55, width, height * 0.45);
    this.add(floor);

    if (options.label) {
      const bandHeight = options.sub ? 74 : 52;
      this.add(scene.add.rectangle(0, height / 2 - bandHeight / 2, width, bandHeight, COLOR.void, 0.86));
      this.nameText = scene.add
        .text(0, height / 2 - bandHeight + 10, options.locked ? "???" : options.label, textStyle({ role: "display", size: 28 }))
        .setOrigin(0.5, 0);
      this.add(this.nameText);
      if (options.sub) {
        this.subText = scene.add
          .text(0, height / 2 - bandHeight + 44, options.sub, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText }))
          .setOrigin(0.5, 0);
        this.add(this.subText);
      }
    }

    if (options.badge) {
      this.add(scene.add.rectangle(left + 34, top + 26, 60, 40, COLOR.void, 0.82));
      this.badgeText = scene.add
        .text(left + 34, top + 26, options.badge, textStyle({ role: "emphasis", size: 20, color: COLOR.accentText }))
        .setOrigin(0.5);
      this.add(this.badgeText);
    }

    this.frame = scene.add.rectangle(0, 0, width, height).setStrokeStyle(3, COLOR.panelEdge);
    this.add(this.frame);

    this.hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(this.hit);

    this.setSize(width, height);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.disposed = true;
    });
    void this.loadPortrait().catch(() => {
      if (this.disposed) return;
      // Puppet 텍스처 실패가 전체 결과 그리드를 깨지 않도록 카드 내부에 읽을 수 있는 폴백을 둔다.
      this.addAt(scene.add.text(0, -18, options.locked ? "?" : (options.label ?? "RELIC"), textStyle({ role: "display",
        size: Math.min(34, width / 8), color: COLOR.inkDim, align: "center", wrap: width - 32,
      })).setOrigin(0.5), 3);
    });
  }

  /**
   * 원화를 카드 안에 채운다.
   *
   * 그림자는 같은 잘라내기 상자를 쓰는 복제본을 검게 칠해 살짝 어긋나게 둔 것이다.
   * 별도의 그림자 이미지를 만들지 않으므로 캐릭터가 늘어도 추가 아트가 필요 없다.
   */
  private async loadPortrait(): Promise<void> {
    const asset = portraitAssetFor(this.options.portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(this.scene, asset);
    if (this.disposed) return;

    const { width, height } = this.options;
    // 이름 띠가 덮는 아래쪽까지 그림이 이어지도록 카드 전체를 채운다.
    const card = headCardFrame(asset, anchors, { width, height });
    const originX = -width / 2 - card.cropX * card.scale;
    const originY = -height / 2 - card.cropY * card.scale;

    const shadow = this.scene.add
      .image(originX + 14, originY + 16, key)
      .setOrigin(0, 0)
      .setScale(card.scale)
      .setTint(CARD_SHADOW)
      .setAlpha(0.22);
    const portrait = this.scene.add.image(originX, originY, key).setOrigin(0, 0).setScale(card.scale);
    for (const image of [shadow, portrait]) {
      image.setCrop(card.cropX, card.cropY, card.cropWidth, card.cropHeight);
    }
    if (this.options.tint) portrait.setTint(this.options.tint);
    if (this.options.locked) {
      // 미발굴은 흰 카드 위의 검은 실루엣으로 남긴다. 누구인지는 감추되 자리는 또렷하게 둔다.
      portrait.setTint(CARD_SHADOW);
      shadow.setVisible(false);
    }

    this.portraits.push(shadow, portrait);
    // 흰 배경 위·이름 띠 아래에 끼워 넣어야 이름과 배지가 그림에 가리지 않는다.
    this.addAt(shadow, 3);
    this.addAt(portrait, 4);
  }

  /** 고른 카드는 테두리를 굵은 강조색으로 바꾸고 살짝 띄운다. 발굴만 등급 보조색을 넘긴다. */
  setSelected(selected: boolean, accent: number = COLOR.accent): this {
    if (this.selected === selected && !selected) return this;
    this.selected = selected;
    this.frame.setStrokeStyle(selected ? 6 : 3, selected ? accent : COLOR.panelEdge);
    this.setScale(selected ? 1.04 : 1);
    return this;
  }

  setSub(text: string): this {
    this.subText?.setText(text);
    return this;
  }

  /** 전투 통제 불능처럼 카드 전체에 즉시 알아볼 상태색이 필요할 때 원화와 테두리를 함께 물들인다. */
  setDanger(danger: boolean): this {
    for (const portrait of this.portraits) {
      if (danger) portrait.setTint(COLOR.danger);
      else if (this.options.tint) portrait.setTint(this.options.tint);
      else portrait.clearTint();
    }
    if (danger) this.frame.setStrokeStyle(7, COLOR.danger);
    else this.frame.setStrokeStyle(this.selected ? 6 : 3, this.selected ? COLOR.accent : COLOR.panelEdge);
    return this;
  }

}

/**
 * 임시 공유 원화를 쓰는 렐릭만 구분 색을 돌려준다.
 * 전용 원화가 붙은 캐릭터는 카드에서도 원본 색을 그대로 보여 준다.
 */
export function relicCardTint(def: RelicDef): number | undefined {
  return portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined;
}
