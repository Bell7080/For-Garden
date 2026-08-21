import Phaser from "phaser";
import type { PortraitAssetId, RelicDef, RelicRarity } from "../core/types";
import { headCardFrame, loadPortraitTexture, portraitAssetFor, portraitUsesRelicTint } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { chipPoints, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 카드 한 장의 조립 옵션. 크기와 라벨만 주면 나머지 연출은 프리팹이 맞춘다. */
export interface PortraitCardOptions {
  width: number;
  height: number;
  portraitAssetId: PortraitAssetId;
  /** 임시 공유 원화를 캐릭터별로 구분하는 색. 전용 원화면 넘기지 않는다. */
  tint?: number;
  /** 하단 레이어의 이름. 비우면 하단 레이어를 만들지 않는다. */
  label?: string;
  /** 이름 아래 한 줄. 역할·등급처럼 짧은 문구를 넣는다. */
  sub?: string;
  /** 이름 앞에 붙는 레벨. 없으면 이름만 보인다. */
  level?: number;
  /** 칩과 하단 레이어의 경계에 찍는 성급. */
  stars?: { filled: number; total: number };
  /** 미발굴 카드. 원화를 실루엣으로 덮고 이름을 감춘다. */
  locked?: boolean;
  /** 칩 왼쪽 위의 작은 표식(개체번호·등급). */
  badge?: string;
}

/** 칩 본체와 하단 레이어의 바탕. 검은 유리에 가깝게 두고 원화가 빛을 담당한다. */
const CHIP_FILL = 0x161a20;
const FOOTER_FILL = 0x0e1116;
const SILHOUETTE = 0x0b0d10;
/** 빈 별의 선 색. 글자용 문자열 색과 달리 도형은 숫자 색이 필요하다. */
const STAR_EMPTY = 0x6f7681;

/** 하단 레이어가 칩 밖으로 삐져나오는 폭. 두 레이어가 나뉘어 보이게 한다. */
const FOOTER_BLEED = 8;

/** 등급이 곧 성급이다. 카드마다 다른 기준을 쓰지 않는다. */
export function starsForRarity(rarity: RelicRarity): { filled: number; total: number } {
  const filled = rarity === "SSR" ? 3 : rarity === "SR" ? 2 : 1;
  return { filled, total: 3 };
}

/**
 * 캐릭터 카드.
 *
 * 위쪽 모서리를 잘라낸 칩 한 장에 원화를 머리 관절 기준으로 크게 채우고, 머리는 칩 위로
 * 빠져나오게 둔다. 아래에는 살짝 넓은 레이어를 겹쳐 레벨과 이름을 얹고, 두 레이어의 경계에
 * 성급을 찍는다. 도감·편성·전투 프로필·발굴 결과가 모두 이 한 장을 공유한다.
 */
export class PortraitCard extends Phaser.GameObjects.Container {
  /** 씬이 pointerdown·pointerup을 붙이는 카드 전체 입력 영역이다. */
  readonly hit: Phaser.GameObjects.Rectangle;
  private readonly chip: Phaser.GameObjects.Graphics;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly portraits: Phaser.GameObjects.Image[] = [];
  private readonly nameText?: Phaser.GameObjects.Text;
  private readonly subText?: Phaser.GameObjects.Text;
  private readonly options: PortraitCardOptions;
  private readonly bodyHeight: number;
  private readonly footerHeight: number;
  private readonly overhang: number;
  private readonly chipShape: number[];
  private readonly portraitMask: Phaser.GameObjects.Graphics;
  private readonly maskOffsetY: number;
  private selected = false;
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PortraitCardOptions) {
    super(scene, x, y);
    this.options = options;
    const { width, height } = options;

    this.footerHeight = options.label ? Math.min(options.sub ? 84 : 58, height * 0.34) : 0;
    this.bodyHeight = height - this.footerHeight;
    // 머리가 칩 위로 빠져나올 여유. 카드가 납작할수록 조금만 내민다.
    this.overhang = Math.round(Math.min(this.bodyHeight * 0.22, 54));
    const bevel = Math.min(HOLO.bevel, this.bodyHeight * 0.28);
    const bodyCenter = -this.footerHeight / 2;
    this.chipShape = chipPoints(width, this.bodyHeight, { bevel });

    // 칩 본체. 테두리 대신 그림자로 떠 보이게 한다.
    this.chip = scene.add.graphics({ x: 0, y: bodyCenter });
    this.paintChip(CHIP_FILL);
    this.add(this.chip);

    // 원화는 칩 안에 갇히되 윗변 가운데만 열어 머리가 빠져나오게 한다.
    //
    // 마스크 도형은 컨테이너 밖(화면 좌표)에 둔다. Phaser의 기하 마스크는 부모 컨테이너의
    // 이동을 물려받지 않아, 카드 안에 넣으면 마스크만 화면 원점 근처에 남아 그림이 통째로
    // 사라진다. 그래서 카드가 자리를 잡은 뒤 월드 좌표로 옮겨 준다.
    this.maskOffsetY = bodyCenter;
    this.portraitMask = scene.make.graphics({});
    this.portraitMask.fillStyle(0xffffff, 1);
    this.portraitMask.fillPoints(
      toGeomPoints(chipPoints(width, this.bodyHeight, { bevel, openWidth: width * 0.56, openHeight: this.overhang })),
      true,
    );

    if (options.label) {
      const footerTop = height / 2 - this.footerHeight;
      const footer = scene.add.graphics({ x: 0, y: 0 });
      footer.fillStyle(0x000000, 0.5);
      footer.fillRect(-width / 2 - FOOTER_BLEED + 6, footerTop + 8, width + FOOTER_BLEED * 2, this.footerHeight);
      footer.fillStyle(FOOTER_FILL, 0.94);
      footer.fillRect(-width / 2 - FOOTER_BLEED, footerTop, width + FOOTER_BLEED * 2, this.footerHeight);
      this.add(footer);

      const name = options.locked ? "???" : options.label;
      this.nameText = scene.add
        .text(0, footerTop + (options.sub ? 12 : this.footerHeight / 2 - 17), options.level !== undefined && !options.locked ? `LV.${options.level}  |  ${name}` : name,
          textStyle({ role: "display", size: Math.min(30, width / 9) }))
        .setOrigin(0.5, 0);
      this.add(this.nameText);
      if (options.sub) {
        this.subText = scene.add
          .text(0, footerTop + 50, options.sub, textStyle({ role: "emphasis", size: Math.min(22, width / 12), color: COLOR.accentText }))
          .setOrigin(0.5, 0);
        this.add(this.subText);
      }
      if (options.stars) this.addStars(footerTop);
    }

    if (options.badge) {
      const badgeY = -height / 2 + 26;
      this.add(
        scene.add
          .text(-width / 2 + 20, badgeY, options.badge, textStyle({ role: "emphasis", size: Math.min(20, width / 14), color: COLOR.accentText }))
          .setOrigin(0, 0.5),
      );
    }

    // 고른 카드에만 켜지는 얇은 선. 평소에는 아무 테두리도 두르지 않는다.
    this.outline = scene.add.graphics({ x: 0, y: bodyCenter });
    this.add(this.outline);

    this.hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(this.hit);

    this.setSize(width, height);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.disposed = true;
      this.portraitMask.destroy();
    });
    void this.loadPortrait().catch(() => {
      if (this.disposed) return;
      // Puppet 텍스처 실패가 전체 결과 그리드를 깨지 않도록 카드 안에 읽을 수 있는 폴백을 둔다.
      const fallback = textStyle({ role: "display", size: Math.min(34, width / 8), color: COLOR.inkDim, align: "center", wrap: width - 32 });
      this.addAt(scene.add.text(0, bodyCenter, options.locked ? "?" : (options.label ?? "RELIC"), fallback).setOrigin(0.5), 2);
    });
  }

  /** 칩 바탕과 그림자를 다시 칠한다. 상태색이 바뀔 때도 같은 모양을 쓴다. */
  private paintChip(fill: number): void {
    const points = toGeomPoints(this.chipShape);
    this.chip.clear();
    this.chip.fillStyle(0x000000, HOLO.shadow.alpha);
    this.chip.translateCanvas(HOLO.shadow.x, HOLO.shadow.y);
    this.chip.fillPoints(points, true);
    this.chip.translateCanvas(-HOLO.shadow.x, -HOLO.shadow.y);
    this.chip.fillStyle(fill, 0.92);
    this.chip.fillPoints(points, true);
  }

  /** 칩과 하단 레이어의 경계에 성급을 찍는다. 찬 별은 강조색, 빈 별은 선만 남긴다. */
  private addStars(footerTop: number): void {
    const stars = this.options.stars!;
    const size = Math.min(13, this.options.width / 20);
    const gap = size * 2.6;
    const left = -((stars.total - 1) * gap) / 2;
    for (let i = 0; i < stars.total; i++) {
      const filled = i < stars.filled && !this.options.locked;
      const star = this.scene.add.star(left + i * gap, footerTop, 4, size * 0.42, size, filled ? COLOR.accent : 0x000000, filled ? 1 : 0.35);
      if (!filled) star.setStrokeStyle(2, STAR_EMPTY, 0.9);
      this.add(star);
    }
  }

  /**
   * 원화를 칩 안에 채운다.
   *
   * 머리 관절을 기준으로 크게 확대해 뒷배경이 거의 남지 않게 하고, 칩 위쪽으로 머리가 나갈
   * 만큼만 그림 영역을 더 잡는다. 그림자는 같은 잘라내기를 쓰는 복제본을 검게 칠한 것이라
   * 캐릭터가 늘어도 추가 아트가 필요 없다.
   */
  private async loadPortrait(): Promise<void> {
    const asset = portraitAssetFor(this.options.portraitAssetId);
    const { key, anchors } = await loadPortraitTexture(this.scene, asset);
    if (this.disposed) return;

    const { width, height } = this.options;
    const frameHeight = this.bodyHeight + this.overhang;
    // fillRatio가 작을수록 캐릭터가 카드를 꽉 채운다. 뒷배경이 거의 보이지 않는 값이다.
    const card = headCardFrame(asset, anchors, { width, height: frameHeight, fillRatio: 0.56, headroom: 0.04 });
    const originX = -width / 2 - card.cropX * card.scale;
    const originY = -height / 2 - this.overhang - card.cropY * card.scale;

    this.syncMask();
    const shadow = this.scene.add
      .image(originX + 12, originY + 14, key)
      .setOrigin(0, 0)
      .setScale(card.scale)
      .setTint(SILHOUETTE)
      .setAlpha(0.35);
    const portrait = this.scene.add.image(originX, originY, key).setOrigin(0, 0).setScale(card.scale);
    for (const image of [shadow, portrait]) {
      image.setCrop(card.cropX, card.cropY, card.cropWidth, card.cropHeight);
      image.setMask(this.portraitMask.createGeometryMask());
    }
    if (this.options.tint) portrait.setTint(this.options.tint);
    if (this.options.locked) {
      // 미발굴은 칩 위의 검은 실루엣으로 남긴다. 누구인지는 감추되 자리는 또렷하게 둔다.
      portrait.setTint(SILHOUETTE);
      shadow.setVisible(false);
    }

    this.portraits.push(shadow, portrait);
    // 칩 바탕 위·하단 레이어 아래에 끼워 넣어야 이름과 성급이 그림에 가리지 않는다.
    this.addAt(shadow, 1);
    this.addAt(portrait, 2);
  }

  /** 마스크를 카드의 현재 화면 위치·배율에 맞춘다. 카드를 옮기거나 키운 뒤에 부른다. */
  private syncMask(): void {
    const matrix = this.getWorldTransformMatrix();
    const decomposed = matrix.decomposeMatrix() as { translateX: number; translateY: number; scaleX: number; scaleY: number };
    this.portraitMask
      .setPosition(decomposed.translateX, decomposed.translateY + this.maskOffsetY * decomposed.scaleY)
      .setScale(decomposed.scaleX, decomposed.scaleY);
  }

  /** 고른 카드는 얇은 강조선을 켜고 살짝 커진다. 발굴만 등급 보조색을 넘긴다. */
  setSelected(selected: boolean, accent: number = COLOR.accent): this {
    if (this.selected === selected && !selected) return this;
    this.selected = selected;
    this.outline.clear();
    if (selected) {
      this.outline.lineStyle(HOLO.lineWidth + 1, accent, 0.95);
      this.outline.strokePoints(toGeomPoints(this.chipShape), true);
    }
    this.setScale(selected ? 1.05 : 1);
    this.syncMask();
    return this;
  }

  setSub(text: string): this {
    this.subText?.setText(text);
    return this;
  }

  /** 전투 통제 불능처럼 카드 전체에 즉시 알아볼 상태색이 필요할 때 원화와 칩을 함께 물들인다. */
  setDanger(danger: boolean): this {
    for (const portrait of this.portraits) {
      if (danger) portrait.setTint(COLOR.danger);
      else if (this.options.tint) portrait.setTint(this.options.tint);
      else portrait.clearTint();
    }
    this.paintChip(danger ? 0x2a1416 : CHIP_FILL);
    return this;
  }
}

/** 평평한 좌표 배열을 Phaser가 받는 점 목록으로 바꾼다. */
function toGeomPoints(flat: number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
  return points;
}

/**
 * 임시 공유 원화를 쓰는 렐릭만 구분 색을 돌려준다.
 * 전용 원화가 붙은 캐릭터는 카드에서도 원본 색을 그대로 보여 준다.
 */
export function relicCardTint(def: RelicDef): number | undefined {
  return portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined;
}
