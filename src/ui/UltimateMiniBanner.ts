import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { ULTIMATE_MINI_BANNER_TIMING } from "../core/battleControls";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { withPuppetTexture, type PuppetAsset } from "../puppets/assets";
import { ULTIMATE_MINI_BANNER as L } from "./battleStatusLayout";
import { chipPoints, drawLayer } from "./holo";
import { ELEMENT_TINT } from "./skillArt";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 한 번 구운 전신 — 같은 개체가 다시 쓰면 기다리지 않고 그 자리에서 선다. */
const BAKED_ART = new Map<string, string>();

const CENTER_X = L.right - L.width / 2;
const CENTER_Y = L.top + L.height / 2;

/**
 * **단축 궁극기 연출** — 전신 컷인 대신 화면 위쪽 빈 띠(`ULTIMATE_MINI_BANNER`)에 스치는 일러스트 한 장.
 *
 * 일러스트는 보고 싶지만 화면을 덮거나 전투가 멈추는 것은 싫은 사람의 몫이다. 그래서 그 개체의 전신을
 * **자르지 않고** 원화의 그림 상자(`content`) 그대로 한 장 구워, 판 오른쪽에 발을 딛고 머리는 판 위로 솟게
 * 세운다. 오른쪽 벽에서 **슈루룩** 밀어 넣고, 머문 뒤 살짝 움츠렸다 **퓽** 하고 오른쪽으로 빠져나간다.
 * 손은 받지 않고 전투는 아래에서 계속 흐른다.
 *
 * 움직임은 위치·가로 배율·투명도뿐이다 — 판을 다시 그리지 않으므로 난전 중에도 가볍다.
 * 시간은 배속을 받지 않는다(`ULTIMATE_MINI_BANNER_TIMING`) — 3배속에서도 그림과 이름이 읽혀야 한다.
 */
class UltimateMiniBanner extends Phaser.GameObjects.Container {
  private gone = false;

  constructor(scene: Phaser.Scene, relic: RelicDef) {
    super(scene, CENTER_X, CENTER_Y);
    scene.add.existing(this);
    this.setDepth(L.depth);
    const bevel = L.height * L.bevel;
    const shape = chipPoints(L.width, L.height, { bevel: { topLeft: bevel, bottomRight: bevel } });
    this.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.88, edge: ELEMENT_TINT[relic.element] }));
    const left = -L.width / 2 + L.textLeft;
    const name = scene.add.text(left, L.nameY, relic.name, textStyle({ role: "emphasis", size: L.nameSize, color: COLOR.ink }))
      .setOrigin(0, 0.5).setStroke("#000000", 5);
    const skill = scene.add.text(left, L.skillY, relic.ultimate.name, textStyle({ role: "display", size: L.skillSize, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setStroke("#000000", 6);
    shrinkTextToWidth(name, L.textWidth);
    shrinkTextToWidth(skill, L.textWidth);
    this.add([name, skill]);
    void this.loadArt(relic);
    // 슈루룩 — 오른쪽 밖에서 가로로 조금 늘어난 채 미끄러져 들어와 제자리에서 살짝 넘쳤다 선다.
    this.x = CENTER_X + L.width * 0.9;
    this.setAlpha(0).setScale(1.1, 1);
    const { enterMs, holdMs } = ULTIMATE_MINI_BANNER_TIMING;
    scene.tweens.add({ targets: this, x: CENTER_X, alpha: 1, scaleX: 1, duration: enterMs, ease: "Back.Out", easeParams: [1.15] });
    scene.time.delayedCall(enterMs + holdMs, () => this.zipOut());
  }

  /** 전신을 구워 판 오른쪽(글 위)에 세운다. 이미 구웠으면 기다리지 않는다. */
  private async loadArt(relic: RelicDef): Promise<void> {
    const asset = relicAppearanceManager.portraitAssetFor(relic.id);
    const size = figureSize(asset);
    const cacheKey = `${asset.url}:${size.width}x${size.height}`;
    const cached = BAKED_ART.get(cacheKey);
    if (cached && this.scene.textures.exists(cached)) {
      this.addFigure(cached, size, false);
      return;
    }
    const key = await withPuppetTexture(this.scene, asset, ({ key: source }) => {
      if (!this.active) return undefined;
      return bakeFigure(this.scene, source, asset, size);
    }).catch(() => undefined);
    if (!key) return;
    BAKED_ART.set(cacheKey, key);
    if (!this.active) return;
    this.addFigure(key, size, true);
  }

  /** 발은 판 밑동 바로 위, 몸은 판 오른쪽 — 검은 복제 한 겹이 밝은 전장에서 실루엣을 떼어 놓는다. */
  private addFigure(key: string, size: { width: number; height: number }, fadeIn: boolean): void {
    const { figure } = L;
    const x = L.width / 2 - figure.right - size.width / 2;
    const y = L.height / 2 - figure.footInset;
    const shadow = this.scene.add.image(x + 6, y + 6, key).setOrigin(0.5, 1).setTintFill(0x000000).setAlpha(0.45);
    const image = this.scene.add.image(x, y, key).setOrigin(0.5, 1);
    this.add([shadow, image]);
    if (!fadeIn) return;
    for (const part of [shadow, image]) {
      const to = part.alpha;
      part.setAlpha(0);
      this.scene.tweens.add({ targets: part, alpha: to, duration: 140 });
    }
  }

  /** 퓽 — 살짝 왼쪽으로 움츠렸다가 가로로 늘어나며 오른쪽 벽 밖으로 튕겨 나간다. */
  zipOut(): void {
    if (!this.claim()) return;
    const { windupMs, exitMs } = ULTIMATE_MINI_BANNER_TIMING;
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { x: CENTER_X - 22, scaleX: 0.95, duration: windupMs, ease: "Quad.Out" },
        { x: CENTER_X + L.width * 1.15, scaleX: 1.22, alpha: 0, duration: exitMs, ease: "Expo.In" },
      ],
      onComplete: () => this.destroy(),
    });
  }

  /** 다른 렐릭에게 자리를 내준다 — 한 겹 뒤로 내려가 왼쪽으로 비켜 녹는다. 새 판은 그 위로 미끄러져 든다. */
  yieldTo(): void {
    if (!this.claim()) return;
    this.setDepth(L.depth - 1);
    this.scene.tweens.add({
      targets: this, x: this.x - 70, scale: 0.9, alpha: 0,
      duration: ULTIMATE_MINI_BANNER_TIMING.swapMs, ease: "Cubic.Out",
      onComplete: () => this.destroy(),
    });
  }

  get leaving(): boolean {
    return this.gone;
  }

  private claim(): boolean {
    if (this.gone || !this.active) return false;
    this.gone = true;
    this.scene.tweens.killTweensOf(this);
    return true;
  }
}

/** 전신이 설 크기 — 높이에 맞추되 폭이 넘치는 원화는 폭에 맞춘다. 비율은 원화의 그림 상자 그대로다. */
function figureSize(asset: PuppetAsset): { width: number; height: number } {
  const { figure } = L;
  const contentWidth = Math.max(1, asset.content.right - asset.content.left);
  const contentHeight = Math.max(1, asset.content.bottom - asset.content.top);
  const scale = Math.min(figure.height / contentHeight, figure.maxWidth / contentWidth);
  return { width: Math.round(contentWidth * scale), height: Math.round(contentHeight * scale) };
}

/** 원화의 그림 상자를 통째로 작은 캔버스에 굽는다 — 원본은 굽는 동안만 붙잡는다. */
function bakeFigure(scene: Phaser.Scene, sourceKey: string, asset: PuppetAsset, size: { width: number; height: number }): string {
  const key = `ult-figure:${sourceKey}:${size.width}x${size.height}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = scene.textures.createCanvas(key, size.width, size.height);
  if (!canvas) return sourceKey;
  // 텍스처가 원화와 다른 해상도로 올라왔어도 그림 상자는 같은 비율로 짚는다.
  const sx = source.width / Math.max(1, asset.imageWidth);
  const sy = source.height / Math.max(1, asset.imageHeight);
  const { content } = asset;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    content.left * sx, content.top * sy, (content.right - content.left) * sx, (content.bottom - content.top) * sy,
    0, 0, size.width, size.height,
  );
  canvas.refresh();
  return key;
}

/**
 * 단축 연출의 일러스트 판 한 칸. 판은 언제나 하나뿐이고, 다른 렐릭이 궁극기를 쓰면 지금 판이 비켜 녹으며
 * 새 판이 같은 자리로 들어와 자연스럽게 갈마든다.
 */
export class UltimateMiniBannerStack {
  private current?: UltimateMiniBanner;

  constructor(private readonly scene: Phaser.Scene) {}

  show(relic: RelicDef): void {
    if (this.current?.active && !this.current.leaving) this.current.yieldTo();
    this.current = new UltimateMiniBanner(this.scene, relic);
  }

  /** 디버그·검수용 — 지금 화면에 선 판 수(0 또는 1). */
  get count(): number {
    return this.current?.active && !this.current.leaving ? 1 : 0;
  }
}
