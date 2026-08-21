import Phaser from "phaser";
import type { PortraitAssetId, RelicDef, RelicRarity } from "../core/types";
import { headCardFrame, loadPortraitTexture, portraitAssetFor, portraitUsesRelicTint } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { chipPoints, HOLO, slantedRect } from "./holo";
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

/** 칩 바탕. 검은 유리에 가깝게 두고 원화가 빛을 담당한다. */
const CHIP_FILL = 0x161a20;
const SILHOUETTE = 0x0b0d10;
/** 빈 별의 선 색. 글자용 문자열 색과 달리 도형은 숫자 색이 필요하다. */
const STAR_EMPTY = 0x6f7681;

/** 칩을 카드 좌우 안쪽으로 들여 놓는 폭. 옆 칸과 숨 쉴 틈을 남긴다. */
const CHIP_INSET = 6;

/**
 * 모서리를 깎는 길이.
 *
 * 위쪽 둘은 서로 다르게 깎는다. 같은 길이로 깎으면 반듯한 팔각형이 되어 정면 판때기처럼
 * 보이기 때문이다. 반대로 **아래쪽은 깎지 않는다** — 이름 레이어와 맞닿는 변이라 깎으면
 * 두 조각 사이에 틈이 생겨 카드가 두 장으로 갈라져 보인다. 깎임은 하단 레이어의 바닥이 잇는다.
 */
const CHIP_BEVEL = { topLeft: 0.18, topRight: 0.07, bottomRight: 0.14, bottomLeft: 0.05 };

/** 이름이 얹히는 아래쪽 어둠이 차지하는 높이 비율. */
const SHADE_RATIO = 0.46;

/** 레벨 숫자를 세로로 늘리는 비율. 계기판 숫자처럼 보이게 하는 최소한의 왜곡이다. */
const LEVEL_STRETCH = 1.26;

/**
 * 등급이 곧 성급이다. 카드마다 다른 기준을 쓰지 않는다.
 *
 * 칸은 언제나 다섯이고 등급이 그중 몇 칸을 채우는지만 정한다. 칸 수까지 등급마다 달라지면
 * 두 카드를 나란히 놓았을 때 어느 쪽이 높은지 한눈에 비교되지 않는다.
 */
export function starsForRarity(rarity: RelicRarity): { filled: number; total: number } {
  const filled = rarity === "SSR" ? 5 : rarity === "SR" ? 4 : 3;
  return { filled, total: 5 };
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
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly portraits: Phaser.GameObjects.Image[] = [];
  private readonly nameText?: Phaser.GameObjects.Text;
  private readonly subText?: Phaser.GameObjects.Text;
  private readonly options: PortraitCardOptions;
  private readonly bodyHeight: number;
  private readonly overhang: number;
  private readonly chipShape: number[];
  private readonly portraitMask: Phaser.GameObjects.Graphics;
  private readonly maskOffsetY: number;
  private readonly shadeHeight: number;
  private selected = false;
  private disposed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PortraitCardOptions) {
    super(scene, x, y);
    this.options = options;
    const { width, height } = options;

    this.bodyHeight = height;
    // 머리가 칩 위로 빠져나올 여유. 카드가 납작할수록 조금만 내민다.
    this.overhang = Math.round(Math.min(this.bodyHeight * 0.22, 54));
    const chipWidth = width - CHIP_INSET * 2;
    // 깎는 길이는 카드 크기를 따라간다. 작은 카드에서 모서리만 크게 잘려 나가지 않게 한다.
    const unit = Math.min(chipWidth, this.bodyHeight);
    const bevel = {
      topLeft: unit * CHIP_BEVEL.topLeft,
      topRight: unit * CHIP_BEVEL.topRight,
      bottomRight: unit * CHIP_BEVEL.bottomRight,
      bottomLeft: unit * CHIP_BEVEL.bottomLeft,
    };
    const bodyCenter = 0;
    this.chipShape = chipPoints(chipWidth, this.bodyHeight, { bevel });

    // 고르거나 애착으로 세운 카드에만 켜지는 발광. 테두리를 두르는 대신 카드 전체가 은은하게 빛난다.
    this.glow = scene.add.graphics({ x: 0, y: bodyCenter }).setVisible(false);
    this.paintGlow(COLOR.accent);
    this.add(this.glow);

    // 칩 본체. 카드는 이 한 장뿐이라 그림자도 하나만 진다.
    this.chip = scene.add.graphics({ x: 0, y: bodyCenter });
    this.paintChip(CHIP_FILL);
    this.add(this.chip);

    // 원화는 칩 안에 갇히되 윗변 가운데만 열어 머리가 빠져나오게 한다.
    //
    // 마스크 도형은 컨테이너 밖(화면 좌표)에 둔다. Phaser의 기하 마스크는 부모 컨테이너의
    // 이동을 물려받지 않아, 카드 안에 넣으면 마스크만 화면 원점 근처에 남아 그림이 통째로
    // 사라진다. 그래서 카드가 자리를 잡은 뒤 월드 좌표로 옮겨 준다.
    this.maskOffsetY = bodyCenter;
    this.shadeHeight = Math.round(this.bodyHeight * SHADE_RATIO);
    this.portraitMask = scene.make.graphics({});
    this.portraitMask.fillStyle(0xffffff, 1);
    this.portraitMask.fillPoints(
      toGeomPoints(chipPoints(chipWidth, this.bodyHeight, { bevel, openWidth: chipWidth * 0.58, openHeight: this.overhang })),
      true,
    );

    if (options.label) {
      // 이름은 별도의 레이어가 아니라 칩 안쪽 아래에 깔린 어둠 위에 얹힌다. 투명에서 검정으로
      // 빠지는 그라데이션이라 원화가 자연스럽게 어두워지고, 카드는 끝까지 한 장으로 남는다.
      const shade = scene.add.graphics();
      shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.9, 0.9);
      shade.fillRect(-width / 2, height / 2 - this.shadeHeight, width, this.shadeHeight);
      // 칩 밖으로 새어 나가지 않도록 원화와 같은 마스크를 씌운다. 깎인 아래 모서리도 함께 지킨다.
      shade.setMask(this.portraitMask.createGeometryMask());
      this.add(shade);

      const name = options.locked ? "???" : options.label;
      const inset = CHIP_INSET + 14;
      const baseline = height / 2 - (options.sub ? 44 : 20);
      const nameSize = Math.min(40, width / 7);
      const hasLevel = options.level !== undefined && !options.locked;

      // 레벨은 이름과 나란히 서지 않고 왼쪽 사이드에서 훨씬 크게 선다. 세로로 살짝 늘려
      // 계기판 숫자처럼 보이게 하고, 이름과는 색으로만 가른다.
      let nameLeft = -width / 2 + inset;
      if (hasLevel) {
        const levelSize = Math.min(54, width / 5.2);
        const levelText = scene.add
          .text(-width / 2 + inset, baseline + 4, `${options.level}`, textStyle({ role: "display", size: levelSize, color: COLOR.accentText }))
          .setOrigin(0, 1)
          .setScale(1, LEVEL_STRETCH);
        // 숫자가 세로로 늘어난 만큼 태그도 그 위로 밀어야 두 글자가 겹치지 않는다.
        const levelTag = scene.add
          .text(-width / 2 + inset + 2, levelText.y - levelText.displayHeight - 2, "LV", textStyle({ role: "display", size: levelSize * 0.36, color: COLOR.accentText }))
          .setOrigin(0, 1)
          .setAlpha(0.8);
        this.add([levelTag, levelText]);
        nameLeft = -width / 2 + inset + Math.max(levelText.width, levelTag.width) + nameSize * 0.42;
      }

      this.nameText = scene.add
        .text(nameLeft, baseline, name, textStyle({ role: "display", size: nameSize, wrap: width / 2 - inset }))
        .setOrigin(0, 1);
      this.add(this.nameText);

      if (options.sub) {
        this.subText = scene.add
          .text(nameLeft, baseline + 10, options.sub, textStyle({ role: "emphasis", size: Math.min(22, width / 12), color: COLOR.accentText }))
          .setOrigin(0, 0);
        this.add(this.subText);
      }
      if (options.stars) this.addStars(baseline - nameSize * 1.55, width / 2 - inset);
    }

    if (options.badge) {
      // 왼쪽 위는 크게 깎여 나가므로, 표식은 덜 깎인 오른쪽 위에 붙인다.
      this.add(
        scene.add
          .text(width / 2 - CHIP_INSET - 12, -height / 2 + 28, options.badge, textStyle({ role: "emphasis", size: Math.min(20, width / 14), color: COLOR.accentText }))
          .setOrigin(1, 0.5),
      );
    }

    this.hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(this.hit);

    this.setSize(width, height);
    scene.add.existing(this);
    // 원화가 늦게 오거나 실패해도 아래 어둠은 제자리에 있어야 한다.
    this.syncMask();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.disposed = true;
      this.portraitMask.destroy();
    });
    void this.loadPortrait().catch(() => {
      if (this.disposed) return;
      // Puppet 텍스처 실패가 전체 결과 그리드를 깨지 않도록 카드 안에 읽을 수 있는 폴백을 둔다.
      const fallback = textStyle({ role: "display", size: Math.min(34, width / 8), color: COLOR.inkDim, align: "center", wrap: width - 32 });
      this.addAt(scene.add.text(0, bodyCenter, options.locked ? "?" : (options.label ?? "RELIC"), fallback).setOrigin(0.5), this.getIndex(this.chip) + 1);
    });
  }

  /**
   * 발광.
   *
   * 사각 테두리를 두르는 대신 카드 실루엣을 조금씩 키워 겹쳐 칠한다. 원화·이름·성급까지
   * 한 덩어리로 감싸는 빛이라, 고른 카드가 테두리가 아니라 "밝아진 카드"로 읽힌다.
   */
  private paintGlow(color: number): void {
    const points = toGeomPoints(this.chipShape);
    this.glow.clear();
    for (const [scale, alpha] of [[1.16, 0.07], [1.1, 0.1], [1.05, 0.16]] as const) {
      this.glow.fillStyle(color, alpha);
      this.glow.fillPoints(points.map((point) => new Phaser.Geom.Point(point.x * scale, point.y * scale)), true);
    }
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

  /**
   * 이름 바로 위의 성급.
   *
   * 다섯 칸이 원화 위에 바로 얹히면 밝은 옷에 묻히므로, 줄 뒤에 진한 그림자 판을 깔아 한
   * 덩어리로 떼어 낸다. 찬 별은 빛무리를 두른 반짝임, 빈 별은 선만 남긴다.
   */
  private addStars(y: number, right: number): void {
    const stars = this.options.stars!;
    const size = Math.min(13, this.options.width / 22);
    const gap = size * 2.5;
    const left = right - (stars.total - 1) * gap;

    const plate = this.scene.add.graphics({ x: (left + right) / 2, y });
    plate.fillStyle(0x000000, 0.55);
    plate.fillPoints(toGeomPoints(slantedRect((stars.total - 1) * gap + size * 3.6, size * 2.9, size * 1.2)), true);
    this.add(plate);

    for (let i = 0; i < stars.total; i++) {
      const filled = i < stars.filled && !this.options.locked;
      const x = left + i * gap;
      if (filled) {
        // 찬 별은 두 겹이다. 뒤의 옅고 큰 반짝임이 빛무리 노릇을 해서 밝은 옷 위에서도 뜬다.
        this.add(this.scene.add.star(x, y, 4, size * 0.22, size * 2.1, COLOR.accent, 0.22));
        this.add(this.scene.add.star(x, y, 4, size * 0.3, size * 1.25, 0xfff2cf, 0.95));
      }
      const star = this.scene.add.star(x, y, 4, size * 0.34, size, filled ? COLOR.accent : 0x000000, filled ? 1 : 0.35);
      if (!filled) star.setStrokeStyle(2, STAR_EMPTY, 0.85);
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
    // fillRatio가 작을수록 캐릭터가 카드를 꽉 채운다. 뒷배경이 거의 보이지 않는 값이며,
    // 등신이 낮은 원화는 asset.cardZoom으로 되돌려 한 그리드에서 크기가 맞게 한다.
    const card = headCardFrame(asset, anchors, {
      width,
      height: frameHeight,
      fillRatio: 0.56 / (asset.cardZoom ?? 1),
      headroom: 0.04,
    });
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
    // 칩 바로 위, 아래 어둠보다 아래에 끼운다. 자리를 숫자로 박아 두면 발광 같은 레이어가
    // 하나 늘 때마다 그림이 칩 밑으로 숨는다. 칩을 기준으로 찾는다.
    const above = this.getIndex(this.chip) + 1;
    this.addAt(shadow, above);
    this.addAt(portrait, above + 1);
  }

  /** 마스크를 카드의 현재 화면 위치·배율에 맞춘다. 카드를 옮기거나 키운 뒤에 부른다. */
  private syncMask(): void {
    const matrix = this.getWorldTransformMatrix();
    const decomposed = matrix.decomposeMatrix() as { translateX: number; translateY: number; scaleX: number; scaleY: number };
    this.portraitMask
      .setPosition(decomposed.translateX, decomposed.translateY + this.maskOffsetY * decomposed.scaleY)
      .setScale(decomposed.scaleX, decomposed.scaleY);
  }

  /**
   * 고른 카드는 커지고 은은하게 빛난다.
   *
   * 노란 사각 테두리를 두르지 않는다. 테두리는 카드 위에 다른 물체를 하나 더 얹는 것처럼
   * 보이지만, 발광은 카드 전체가 상태를 갖는 것처럼 읽힌다. 발굴만 등급 보조색을 넘긴다.
   */
  setSelected(selected: boolean, accent: number = COLOR.accent): this {
    if (this.selected === selected && !selected) return this;
    this.selected = selected;
    if (selected) this.paintGlow(accent);
    this.glow.setVisible(selected);
    this.setScale(selected ? 1.06 : 1);
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
