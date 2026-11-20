import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { ULTIMATE_MINI_BANNER_TIMING } from "../core/battleControls";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { withPuppetTexture, type PuppetAsset } from "../puppets/assets";
import { ULTIMATE_MINI_BANNER as L } from "./battleStatusLayout";
import { ELEMENT_TINT } from "./skillArt";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 한 번 구운 전신 — 같은 개체가 다시 쓰면 기다리지 않고 그 자리에서 선다. */
const BAKED_ART = new Map<string, string>();
/** 원화 뒤의 띠. 흑백으로 한 번 굽고 속성색은 tint로 입힌다 — 검은 어둠은 검게, 흰 도트만 속성색이 된다. */
const BACKDROP_KEY = "fx-ult-mini-backdrop";

const BAND_X = L.right - L.backdrop.width / 2;
const FIGURE_X = L.right - L.figure.maxWidth / 2;

/**
 * **단축 궁극기 연출** — 전신 컷인 대신 화면 오른쪽 위 빈 띠(`ULTIMATE_MINI_BANNER`)를 스치는 일러스트 한 장.
 *
 * 일러스트는 보고 싶지만 화면을 덮거나 전투가 멈추는 것은 싫은 사람의 몫이다. 판때기를 깔지 않고 컷인과
 * 같은 결 — 비스듬한 어두운 띠, 마름모 도트, 샤라라락 따라붙는 속도선 — 을 원화 뒤에 깔며, 전신은 **크게**
 * 머리부터 허벅지께까지 세우고 아래는 어둠으로 녹인다. 오른쪽 벽에서 **스르륵** 미끄러져 나오고(전신은 한
 * 뼘 늦게 뒤따른다), 머문 뒤 같은 벽으로 스르륵 들어간다. 손은 받지 않고 전투는 아래에서 계속 흐른다.
 *
 * 움직임은 위치·투명도뿐이다 — 아무것도 다시 그리지 않으므로 난전 중에도 가볍다.
 * 시간은 배속을 받지 않는다(`ULTIMATE_MINI_BANNER_TIMING`) — 3배속에서도 그림과 이름이 읽혀야 한다.
 */
class UltimateMiniBanner extends Phaser.GameObjects.Container {
  private gone = false;
  private readonly figureLayer: Phaser.GameObjects.Container;
  private readonly textLayer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, relic: RelicDef) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(L.depth);
    const tint = ELEMENT_TINT[relic.element];
    const { enterMs, holdMs } = ULTIMATE_MINI_BANNER_TIMING;

    ensureBackdropTexture(scene);
    const band = scene.add.image(BAND_X, L.backdrop.centerY, BACKDROP_KEY).setRotation(L.backdrop.rotation).setTint(tint);
    this.add(band);
    // 도트가 들어오는 쪽(왼쪽)으로 천천히 흘러 띠가 멈춰 선 판때기로 읽히지 않는다.
    scene.tweens.add({ targets: band, x: BAND_X - 36, duration: enterMs + holdMs, ease: "Linear" });
    this.addStreaks(tint);

    this.figureLayer = scene.add.container(0, 0);
    this.add(this.figureLayer);
    this.textLayer = scene.add.container(0, 0);
    this.add(this.textLayer);
    this.addTitle(relic);
    void this.loadArt(relic);

    // 스르륵 — 띠는 벽 밖에서 미끄러져 들고, 전신은 한 뼘 더 먼 곳에서 뒤따르며, 글은 조금 늦게 닦이듯 선다.
    this.setX(L.slide).setAlpha(0);
    scene.tweens.add({ targets: this, x: 0, alpha: 1, duration: enterMs, ease: "Cubic.Out" });
    this.figureLayer.setX(L.figureLag);
    scene.tweens.chain({
      targets: this.figureLayer,
      tweens: [
        { x: 0, duration: enterMs * 1.2, ease: "Expo.Out" },
        // 머무는 동안에도 아주 조금 더 밀려 정지 화면으로 굳지 않는다.
        { x: -18, duration: Math.max(1, holdMs - enterMs * 0.2), ease: "Linear" },
      ],
    });
    this.textLayer.setX(60).setAlpha(0);
    scene.tweens.add({ targets: this.textLayer, x: 0, alpha: 1, duration: enterMs, delay: enterMs * 0.35, ease: "Cubic.Out" });
    scene.time.delayedCall(enterMs + holdMs, () => this.slideOut());
  }

  /** 들어오는 방향(오른쪽 → 왼쪽)으로 늘어나며 지나가는 속도선 — 줄마다 늦게 떠나 샤라라락. */
  private addStreaks(tint: number): void {
    const scene = this.scene;
    const length = 420;
    const dir = { x: -Math.cos(L.backdrop.rotation), y: -Math.sin(L.backdrop.rotation) };
    const normal = { x: -dir.y, y: dir.x };
    L.streaks.forEach((line, index) => {
      const streak = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setRotation(L.backdrop.rotation);
      // 머리는 왼쪽(나아가는 쪽), 꼬리는 오른쪽으로 길게.
      streak.fillStyle(tint, 1).fillPoints([
        new Phaser.Geom.Point(length, 0), new Phaser.Geom.Point(0, -line.width / 2),
        new Phaser.Geom.Point(-length * 0.08, 0), new Phaser.Geom.Point(0, line.width / 2),
      ], true);
      const startX = L.right + 40 + normal.x * line.offset;
      const startY = L.backdrop.centerY + normal.y * line.offset;
      streak.setPosition(startX, startY).setAlpha(0).setScale(0.15, 1);
      this.add(streak);
      scene.tweens.add({
        targets: streak, x: startX + dir.x * 640, y: startY + dir.y * 640, scaleX: 1,
        duration: 440, delay: 60 + index * 42, ease: "Cubic.Out",
        onStart: () => streak.setAlpha(line.alpha),
        onUpdate: (tween) => streak.setAlpha(line.alpha * (1 - tween.progress * tween.progress)),
      });
    });
  }

  /** 개체 이름(작게) 위, 궁극기 이름(크게) 아래 — 왼쪽 빗금과 밑줄이 컷인과 같은 문법으로 둘을 묶는다. */
  private addTitle(relic: RelicDef): void {
    const scene = this.scene;
    const { text } = L;
    const top = text.nameY - 22;
    const bottom = text.skillY + 30;
    const slashX = text.left - 30;
    const slash = scene.add.graphics();
    slash.fillStyle(0x000000, 0.55).fillPoints([
      new Phaser.Geom.Point(slashX + 18 + 4, top + 4), new Phaser.Geom.Point(slashX + 28 + 4, top + 4),
      new Phaser.Geom.Point(slashX + 10 + 4, bottom + 4), new Phaser.Geom.Point(slashX + 4, bottom + 4),
    ], true);
    slash.fillStyle(COLOR.accent, 1).fillPoints([
      new Phaser.Geom.Point(slashX + 18, top), new Phaser.Geom.Point(slashX + 28, top),
      new Phaser.Geom.Point(slashX + 10, bottom), new Phaser.Geom.Point(slashX, bottom),
    ], true);
    slash.fillStyle(COLOR.accent, 0.85).fillRect(slashX + 12, bottom - 3, L.right - slashX, 3);
    const name = scene.add.text(text.left, text.nameY, relic.name, textStyle({ role: "emphasis", size: text.nameSize, color: COLOR.ink }))
      .setOrigin(0, 0.5).setStroke("#000000", 6).setShadow(0, 3, "#000000", 4, false, true);
    const skill = scene.add.text(text.left, text.skillY, relic.ultimate.name, textStyle({ role: "display", size: text.skillSize, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setStroke("#000000", 8).setShadow(0, 4, "#000000", 6, false, true);
    shrinkTextToWidth(name, text.width);
    shrinkTextToWidth(skill, text.width);
    this.textLayer.add([slash, name, skill]);
  }

  /** 전신을 구워 띠 위에 세운다. 이미 구웠으면 기다리지 않는다. */
  private async loadArt(relic: RelicDef): Promise<void> {
    const asset = relicAppearanceManager.portraitAssetFor(relic.id);
    const frame = figureFrame(asset);
    const cacheKey = `${asset.url}:${frame.width}x${frame.height}`;
    const cached = BAKED_ART.get(cacheKey);
    if (cached && this.scene.textures.exists(cached)) {
      this.addFigure(cached, false);
      return;
    }
    const key = await withPuppetTexture(this.scene, asset, ({ key: source }) => {
      if (!this.active) return undefined;
      return bakeFigure(this.scene, source, asset, frame);
    }).catch(() => undefined);
    if (!key) return;
    BAKED_ART.set(cacheKey, key);
    if (!this.active) return;
    this.addFigure(key, true);
  }

  /** 아래는 녹아 있고 몸은 벽 쪽에 선다 — 검은 복제 한 겹이 밝은 전장에서 실루엣을 떼어 놓는다. */
  private addFigure(key: string, fadeIn: boolean): void {
    const shadow = this.scene.add.image(FIGURE_X + 8, L.bottom + 8, key).setOrigin(0.5, 1).setTintFill(0x000000).setAlpha(0.42);
    const image = this.scene.add.image(FIGURE_X, L.bottom, key).setOrigin(0.5, 1);
    this.figureLayer.add([shadow, image]);
    if (!fadeIn) return;
    for (const part of [shadow, image]) {
      const to = part.alpha;
      part.setAlpha(0);
      this.scene.tweens.add({ targets: part, alpha: to, duration: 160 });
    }
  }

  /** 스르륵 — 들어온 벽으로 미끄러져 들어간다. 전신이 조금 먼저, 조금 더 멀리 빠진다. */
  slideOut(): void {
    if (!this.claim()) return;
    const { exitMs } = ULTIMATE_MINI_BANNER_TIMING;
    this.scene.tweens.add({ targets: this.figureLayer, x: this.figureLayer.x + L.figureLag, duration: exitMs, ease: "Cubic.In" });
    this.scene.tweens.add({ targets: this, x: L.slide, alpha: 0, duration: exitMs, ease: "Cubic.In", onComplete: () => this.destroy() });
  }

  /** 다른 렐릭에게 자리를 내준다 — 한 겹 뒤로 내려가 왼쪽으로 비켜 녹는다. 새 판은 그 위로 미끄러져 든다. */
  yieldTo(): void {
    if (!this.claim()) return;
    this.setDepth(L.depth - 1);
    this.scene.tweens.add({
      targets: this, x: this.x - 60, alpha: 0,
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
    this.scene.tweens.killTweensOf([this, this.figureLayer, this.textLayer]);
    return true;
  }
}

interface FigureFrame { left: number; top: number; srcWidth: number; srcHeight: number; width: number; height: number }

/**
 * 전신에서 잘라 낼 자리 — 그림 상자 위에서부터 `crop`만큼(머리~허벅지)을 높이 `figure.height`로 세우고,
 * 가로는 머리 관절을 가운데로 `maxWidth`까지만 담는다. 넓은 원화가 그림 전체를 작게 만들지 않는다.
 */
function figureFrame(asset: PuppetAsset): FigureFrame {
  const { figure } = L;
  const { content } = asset;
  const contentWidth = Math.max(1, content.right - content.left);
  const srcHeight = Math.max(1, (content.bottom - content.top) * figure.crop);
  const scale = figure.height / srcHeight;
  const srcWidth = Math.min(contentWidth, figure.maxWidth / scale);
  const centerX = asset.joints?.head[0] ?? (content.left + content.right) / 2;
  const left = Math.min(Math.max(centerX - srcWidth / 2, content.left), content.right - srcWidth);
  return { left, top: content.top, srcWidth, srcHeight, width: Math.max(1, Math.round(srcWidth * scale)), height: figure.height };
}

/** 잘라 낸 자리를 작은 캔버스에 굽고 아랫단을 투명하게 녹인다 — 원본은 굽는 동안만 붙잡는다. */
function bakeFigure(scene: Phaser.Scene, sourceKey: string, asset: PuppetAsset, frame: FigureFrame): string {
  const key = `ult-figure:${sourceKey}:${frame.width}x${frame.height}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = scene.textures.createCanvas(key, frame.width, frame.height);
  if (!canvas) return sourceKey;
  // 텍스처가 원화와 다른 해상도로 올라왔어도 같은 비율로 짚는다.
  const sx = source.width / Math.max(1, asset.imageWidth);
  const sy = source.height / Math.max(1, asset.imageHeight);
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, frame.width, frame.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, frame.left * sx, frame.top * sy, frame.srcWidth * sx, frame.srcHeight * sy, 0, 0, frame.width, frame.height);
  // 잘린 단면이 보이지 않게 아랫단을 녹인다 — 채우는 색은 불투명이고 알파만 그라데이션이다.
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, 0, 0, frame.height);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1 - L.figure.fade, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, frame.width, frame.height);
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}

/**
 * 원화 뒤의 띠를 한 번 굽는다 — 검은 어둠은 오른쪽(벽)에서 짙고 왼쪽으로 옅어지며, 그 위에 마름모 도트가
 * 왼쪽으로 갈수록 작아진다(하프톤). 위아래 끝은 녹아 판의 모서리가 서지 않는다. 동그라미를 쓰지 않는다.
 */
function ensureBackdropTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BACKDROP_KEY)) return;
  const { width, height, cell, dot } = L.backdrop;
  const canvas = scene.textures.createCanvas(BACKDROP_KEY, width, height);
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, width, height);
  const dark = ctx.createLinearGradient(0, 0, width, 0);
  dark.addColorStop(0, "rgba(0,0,0,0)");
  dark.addColorStop(0.3, "rgba(0,0,0,0.62)");
  dark.addColorStop(1, "rgba(0,0,0,0.84)");
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  for (let row = 0; row * cell < height + cell; row += 1) {
    for (let col = 0; col * cell < width + cell; col += 1) {
      const cx = col * cell + (row % 2 ? cell / 2 : 0);
      const cy = row * cell;
      const size = dot * Math.max(0, Math.min(1, cx / width) * 1.2 - 0.15);
      if (size < 0.6) continue;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size * 0.8, cy);
      ctx.lineTo(cx, cy + size);
      ctx.lineTo(cx - size * 0.8, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
  // 위·아래 가장자리를 따라 흐르는 가는 빛줄 — 띠가 어디까지인지 한 줄로만 말한다.
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(width * 0.18, height * 0.16, width, 2);
  ctx.fillRect(width * 0.3, height * 0.84, width, 2);
  ctx.globalCompositeOperation = "destination-in";
  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, "rgba(0,0,0,0)");
  vertical.addColorStop(0.14, "rgba(0,0,0,1)");
  vertical.addColorStop(0.86, "rgba(0,0,0,1)");
  vertical.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
}

/**
 * 단축 연출의 일러스트 한 칸. 언제나 하나뿐이고, 다른 렐릭이 궁극기를 쓰면 지금 것이 비켜 녹으며
 * 새 것이 같은 자리로 들어와 자연스럽게 갈마든다.
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
