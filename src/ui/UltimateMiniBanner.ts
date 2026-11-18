import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { ULTIMATE_MINI_BANNER_TIMING } from "../core/battleControls";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { computeFaceBandFrame } from "../puppets/anchors";
import { withPuppetTexture } from "../puppets/assets";
import { ULTIMATE_MINI_BANNER as L } from "./battleStatusLayout";
import { bakeBandTexture } from "./faceTexture";
import { chipPoints, drawLayer } from "./holo";
import { portraitCardZoom } from "./portraitPlacement";
import { ELEMENT_TINT } from "./skillArt";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 한 번 구운 일러스트 띠 — 같은 개체가 다시 쓰면 기다리지 않고 그 자리에서 선다. */
const BAKED_ART = new Map<string, string>();

const CENTER_X = L.right - L.width / 2;
const CENTER_Y = L.top + L.height / 2;

/**
 * **단축 궁극기 연출** — 전신 컷인 대신 화면 위쪽 빈 띠(`ULTIMATE_MINI_BANNER`)에 스치는 일러스트 한 장.
 *
 * 일러스트는 보고 싶지만 화면을 덮거나 전투가 멈추는 것은 싫은 사람의 몫이다. 그래서 그 개체의 전신을
 * 얼굴~가슴께로 잘라 판 실루엣대로 구워(레이드 층의 얼굴 띠와 같은 길) 오른쪽 벽에서 **슈루룩** 밀어
 * 넣고, 머문 뒤 살짝 움츠렸다 **퓽** 하고 오른쪽으로 빠져나간다. 손은 받지 않고 전투는 아래에서 계속 흐른다.
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
    void this.loadArt(relic, shape);
    // 슈루룩 — 오른쪽 밖에서 가로로 조금 늘어난 채 미끄러져 들어와 제자리에서 살짝 넘쳤다 선다.
    this.x = CENTER_X + L.width * 0.9;
    this.setAlpha(0).setScale(1.1, 1);
    const { enterMs, holdMs } = ULTIMATE_MINI_BANNER_TIMING;
    scene.tweens.add({ targets: this, x: CENTER_X, alpha: 1, scaleX: 1, duration: enterMs, ease: "Back.Out", easeParams: [1.15] });
    scene.time.delayedCall(enterMs + holdMs, () => this.zipOut());
  }

  /** 일러스트 띠를 구워 판 바로 위(글 아래)에 끼운다. 이미 구웠으면 기다리지 않는다. */
  private async loadArt(relic: RelicDef, shape: readonly number[]): Promise<void> {
    const asset = relicAppearanceManager.portraitAssetFor(relic.id);
    const cacheKey = `${asset.url}:${L.width}x${L.height}`;
    const cached = BAKED_ART.get(cacheKey);
    if (cached && this.scene.textures.exists(cached)) {
      this.addAt(this.scene.add.image(0, 0, cached), 1);
      return;
    }
    const { art } = L;
    const key = await withPuppetTexture(this.scene, asset, ({ key: source, anchors }) => {
      if (!this.active) return undefined;
      const crop = computeFaceBandFrame(asset, anchors.head, {
        width: Math.round(L.width * (1 - art.from)), height: L.height,
        crop: art.crop / portraitCardZoom(asset),
        headX: art.headX, anchorY: art.anchorY,
      });
      return bakeBandTexture(this.scene, source, { width: L.width, height: L.height }, crop, { shape, from: art.from, fade: art.fade });
    }).catch(() => undefined);
    if (!key) return;
    BAKED_ART.set(cacheKey, key);
    if (!this.active) return;
    const image = this.scene.add.image(0, 0, key).setAlpha(0);
    this.addAt(image, 1);
    this.scene.tweens.add({ targets: image, alpha: 1, duration: 140 });
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
