import { BASE_WIDTH } from "../config/gameConfig";
import Phaser from "phaser";
import type { Stats } from "../core/types";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { settingsManager } from "../managers/SettingsManager";
import { playMotion, type PuppetCreature } from "../puppets/assets";
import { t } from "../i18n";
import { burstDiamond } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { FEED_LEVEL_UP, type FeedHopSpec, type StatGain, feedBannerLetterDelay, feedLevelUpStatGains, feedSpiralPoint } from "./feedLevelUpStyle";
import { toPoints } from "./holo";
import { HOLO_SHIMMER, holoGlowColor } from "./holoShimmer";
import { statToneHex } from "./statTones";
import { textStyle } from "./theme";

/** 연출이 붙는 몸의 자리 — 발밑·키·층. */
export interface FeedLevelUpSpot { readonly x: number; readonly groundY: number; readonly height: number; readonly depth: number }

/**
 * 어느 몫을 터뜨리나. `full`은 전부, `early`는 서버 응답 전 **예상으로 레벨이 넘어간 순간**의 몫
 * (오른 능력치는 아직 모르므로 빼고), `stats`는 확정된 뒤 오른 능력치만이다.
 */
export type FeedLevelUpPart = "full" | "early" | "stats";

/** 레벨업 연출이 붙는 자리들. 정보창이 갖고 있는 것을 빌려 쓴다. */
export interface FeedLevelUpTargets {
  /** 지금 서 있는 SD. 아직 오지 않았거나 숨어 있으면 SD 쪽 연출은 건너뛴다. */
  readonly figure: () => PuppetCreature | undefined;
  /** SD가 서는 자리(발밑)와 키, 그리고 그 층. */
  readonly figureSpot: FeedLevelUpSpot;
  /** 크게 서 있는 전신 원화. 주면 SD와 같은 결(감아 오르는 마름모·통 튀기·빛)이 원화에도 붙는다. */
  readonly portrait?: () => PuppetCreature | undefined;
  /** 원화의 발밑 기준 자리와 키, 그리고 그 층. */
  readonly portraitSpot?: FeedLevelUpSpot;
  /** 크게 서 있는 레벨 숫자. 한 번 부풀었다 돌아온다. */
  readonly levelText: Phaser.GameObjects.Text;
  /** 경험치 줄을 번쩍이게 한다(줄은 정보창의 게이지가 그린다). */
  readonly flashBar: (reduceFlashes: boolean) => void;
  /** 능력치 팝업이 떠오르기 시작하는 자리와 그 층. */
  readonly statSpot: { readonly x: number; readonly y: number; readonly depth: number };
  /**
   * 그 능력치의 수치가 서 있는 자리(월드 좌표). 주면 오른 몫이 가운데 목록이 아니라 **제 수치 옆에서**
   * `+N`으로 튀어 오른다 — 가운데 쌓으면 오각형 안의 전투력을 덮는다.
   */
  readonly statAnchor?: (key: StatGain["key"]) => { x: number; y: number } | undefined;
}

/**
 * 급여로 레벨이 오른 순간의 여섯 겹 연출(`FEED_LEVEL_UP` 참고).
 *
 * 움직임 줄이기를 켜면 빛기둥·나선·점프는 서지 않고 **줄 번쩍임·능력치·LEVEL UP! 글자**만 남는다 —
 * 무엇이 올랐는지는 여전히 말해야 하기 때문이다. 번쩍임 줄이기는 섬광의 세기만 낮춘다.
 */
export class FeedLevelUpEffect {
  private lastBigAt = -Infinity;
  private statLayer?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly targets: FeedLevelUpTargets) {}

  /** 레벨이 올랐다. `before`·`after`는 오르기 전과 뒤의 최종 능력치다. */
  play(before: Stats, after: Stats, part: FeedLevelUpPart = "full"): void {
    if (!this.scene.sys.isActive()) return;
    ensureEffectTextures(this.scene);
    const settings = settingsManager.get();
    const calm = motionPolicy(settings).nonEssentialRepeatFactor === 0;
    const reduceFlashes = settings.accessibility.reduceFlashes;
    if (part !== "early") this.popStats(feedLevelUpStatGains(before, after), calm);
    if (part === "stats") return;
    const now = this.scene.time.now;
    const big = now - this.lastBigAt >= FEED_LEVEL_UP.cooldownMs;

    this.targets.flashBar(reduceFlashes);
    this.popLevel(calm);
    if (!big) return;
    this.lastBigAt = now;
    audioManager?.playUi("ui.levelup");
    settingsManager.haptic("uiTap");

    const figure = this.targets.figure();
    const standing = figure?.active === true && figure.visible;
    if (standing) this.banner(calm);
    if (calm) return;
    if (standing) {
      const spot = this.targets.figureSpot;
      this.pillar(reduceFlashes);
      this.spiral(spot, FEED_LEVEL_UP.spiral.size);
      this.hop(figure, spot, FEED_LEVEL_UP.hop);
    }
    const portrait = this.targets.portrait?.();
    const portraitSpot = this.targets.portraitSpot;
    if (portraitSpot && portrait?.active === true && portrait.visible && portrait.alpha > 0.3) {
      const spec = FEED_LEVEL_UP.portrait;
      this.spiral(portraitSpot, spec.sparkSize);
      this.hop(portrait, portraitSpot, spec.hop);
    }
  }

  /** 레벨 숫자가 한 번 부풀었다 제자리로. 세로로 늘인 숫자라 제 배율을 기억해 돌아간다. */
  private popLevel(calm: boolean): void {
    const text = this.targets.levelText;
    if (!text.active) return;
    // 처음 부풀기 전의 배율·색을 기억한다. 연달아 오르면 부푼 채로 다시 잡히지 않게 한다.
    const home = (text.getData("levelUpHome") as { x: number; y: number; color: string } | undefined)
      ?? { x: text.scaleX, y: text.scaleY, color: String(text.style.color) };
    text.setData("levelUpHome", home);
    this.scene.tweens.killTweensOf(text);
    text.setScale(home.x, home.y).setColor(FEED_LEVEL_UP.banner.color);
    const restore = (): void => { if (text.active) text.setScale(home.x, home.y).setColor(home.color); };
    if (calm) { this.scene.time.delayedCall(FEED_LEVEL_UP.levelPop.ms, restore); return; }
    const { scale, ms } = FEED_LEVEL_UP.levelPop;
    this.scene.tweens.add({ targets: text, scaleX: home.x * scale, scaleY: home.y * scale, duration: ms * 0.4, ease: "Back.Out", yoyo: true, hold: 60, onComplete: restore });
  }

  /** 오른 몫이 제 수치 바로 위에서 `+N`으로 튀어 올라 떠오르며 사라진다(능력치 색). */
  private popStatsAtAxes(layer: Phaser.GameObjects.Container, gains: readonly StatGain[], calm: boolean): void {
    const spec = FEED_LEVEL_UP.stat;
    layer.setPosition(0, 0);
    gains.forEach(({ key, gain }, index) => {
      const anchor = this.targets.statAnchor!(key)!;
      const restY = anchor.y - spec.axisLift;
      const line = this.scene.add
        .text(anchor.x, restY + (calm ? 0 : 14), t("info.levelUp.statPlus", { value: gain.toLocaleString() }), textStyle({ role: "display", size: spec.axisSize, color: statToneHex(key) }))
        .setOrigin(0.5, 1)
        .setStroke("#05070a", 7)
        .setPadding(HOLO_SHIMMER.textGlow.padding)
        .setShadow(0, 0, holoGlowColor(statToneHex(key), 0.7), HOLO_SHIMMER.textGlow.blur, true, false)
        .setAlpha(0)
        .setScale(calm ? 1 : 0.6);
      layer.add(line);
      const delay = index * spec.stagger;
      this.scene.tweens.add({ targets: line, alpha: 1, y: restY, scale: 1, duration: 220, delay, ease: "Back.Out" });
      this.scene.tweens.add({ targets: line, alpha: 0, y: restY - (calm ? 0 : spec.axisRise), duration: spec.fadeMs, delay: delay + 220 + spec.holdMs, ease: "Quad.In" });
    });
    this.scene.time.delayedCall(gains.length * spec.stagger + 220 + spec.holdMs + spec.fadeMs + 40, () => { if (this.statLayer === layer) this.statLayer = undefined; layer.destroy(); });
  }

  /** 오른 능력치가 한 줄씩 차례로 떠오른다. 새로 오르면 지난 줄은 걷고 새로 세운다. */
  private popStats(gains: readonly StatGain[], calm: boolean): void {
    this.statLayer?.destroy();
    if (gains.length === 0) return;
    const { x, y, depth } = this.targets.statSpot;
    const spec = FEED_LEVEL_UP.stat;
    const layer = this.scene.add.container(x, y).setDepth(depth);
    this.statLayer = layer;
    if (this.targets.statAnchor && gains.every(({ key }) => this.targets.statAnchor!(key))) {
      this.popStatsAtAxes(layer, gains, calm);
      return;
    }
    const top = -((gains.length - 1) * spec.lineGap) / 2;
    gains.forEach(({ key, gain }, index) => {
      const line = this.scene.add
        .text(0, top + index * spec.lineGap + (calm ? 0 : 18), t("info.levelUp.statGain", { stat: t(`stat.${key}`), value: gain }), textStyle({ role: "display", size: spec.size, color: statToneHex(key) }))
        .setOrigin(0.5)
        .setStroke("#05070a", 7)
        .setAlpha(0);
      layer.add(line);
      const delay = index * spec.stagger;
      this.scene.tweens.add({ targets: line, alpha: 1, y: top + index * spec.lineGap, duration: 200, delay, ease: "Back.Out" });
      this.scene.tweens.add({
        targets: line, alpha: 0, y: line.y - (calm ? 0 : spec.rise), duration: spec.fadeMs, delay: delay + 200 + spec.holdMs, ease: "Quad.In",
      });
    });
    this.scene.time.delayedCall(gains.length * spec.stagger + 200 + spec.holdMs + spec.fadeMs + 40, () => { if (this.statLayer === layer) this.statLayer = undefined; layer.destroy(); });
  }

  /** `LEVEL UP!` — 글자 하나씩 넘쳐 서고, 다 서면 함께 떠오르며 사라진다. */
  private banner(calm: boolean): void {
    const { x, groundY, height, depth } = this.targets.figureSpot;
    const spec = FEED_LEVEL_UP.banner;
    const word = t("info.levelUp.banner");
    const layer = this.scene.add.container(x, groundY - height - spec.aboveHead).setDepth(depth + 2);
    const letters = [...word].map(char => this.scene.add
      .text(0, 0, char, textStyle({ role: "display", size: spec.size, color: spec.color }))
      .setOrigin(0.5, 1)
      .setStroke(spec.stroke, 9)
      .setShadow(0, 6, "#05070a", 0, false, true));
    const widths = letters.map(letter => letter.width);
    const total = widths.reduce((sum, width) => sum + width, 0) + spec.gap * Math.max(0, letters.length - 1);
    // 화면 오른쪽 끝을 넘지 않게 띠 전체를 안쪽으로 당긴다.
    layer.x = Math.min(x, BASE_WIDTH - total / 2 - 28);
    let cursor = -total / 2;
    let last = 0;
    letters.forEach((letter, index) => {
      letter.setX(cursor + widths[index] / 2);
      cursor += widths[index] + spec.gap;
      layer.add(letter);
      const delay = feedBannerLetterDelay(word, index);
      last = Math.max(last, delay);
      if (calm) return;
      letter.setScale(0.2).setAlpha(0).setY(18);
      this.scene.tweens.add({ targets: letter, alpha: 1, y: 0, duration: spec.popMs * 0.5, delay, ease: "Quad.Out" });
      this.scene.tweens.add({ targets: letter, scale: spec.overshoot, duration: spec.popMs * 0.5, delay, ease: "Quad.Out", yoyo: true, onComplete: () => letter.setScale(1) });
    });
    const settle = last + spec.popMs + spec.holdMs;
    if (calm) layer.setAlpha(0);
    this.scene.tweens.add({ targets: layer, alpha: 1, duration: calm ? 160 : 0 });
    this.scene.tweens.add({ targets: layer, alpha: 0, y: layer.y - (calm ? 0 : spec.rise), duration: spec.fadeMs, delay: settle, ease: "Quad.In", onComplete: () => layer.destroy() });
  }

  /** SD 위로 빛이 내리꽂혀 번쩍인 뒤 가늘어지며 사라진다. SD 뒤에 선다. */
  private pillar(reduceFlashes: boolean): void {
    const { x, groundY, height, depth } = this.targets.figureSpot;
    const spec = FEED_LEVEL_UP.pillar;
    const width = height * spec.widthRatio;
    const top = Math.max(spec.topY, groundY - height * spec.heightRatio);
    const length = groundY - top;
    const beam = this.scene.add.graphics({ x, y: groundY }).setDepth(depth - 1).setBlendMode(Phaser.BlendModes.ADD);
    // 가운데가 짙고 가장자리로 옅어지는 세 겹. 원이 아니라 곧은 띠라 빛기둥으로 읽힌다.
    // 윗부분은 가로 띠로 잘게 나눠 위로 갈수록 투명해진다 — 끝이 칼같이 잘리면 위 판 위에서 선이 끊겨 보인다.
    const layers: [number, number][] = [[1, 0.22], [0.62, 0.42], [0.26, 0.9]];
    const solid = length * (1 - spec.fadeRatio);
    const bands = spec.fadeBands;
    for (const [ratio, alpha] of layers) {
      const w = width * ratio;
      beam.fillStyle(spec.color, alpha);
      beam.fillRect(-w / 2, -solid, w, solid);
      const fadeLength = length - solid;
      for (let i = 0; i < bands; i += 1) {
        const fade = 1 - (i + 0.5) / bands;
        beam.fillStyle(spec.color, alpha * fade * fade);
        beam.fillRect(-w / 2, -solid - (fadeLength * (i + 1)) / bands, w, fadeLength / bands + 0.5);
      }
    }
    // 발밑에 고이는 납작한 빛.
    beam.fillStyle(spec.color, 0.5);
    beam.fillPoints(toPoints(burstDiamond(width * 0.9, 0.22)), true);
    beam.setScale(1, 0).setAlpha(spec.alpha);
    const flashAlpha = reduceFlashes ? spec.flashAlpha * 0.4 : spec.flashAlpha;
    this.scene.tweens.add({ targets: beam, scaleY: 1, duration: spec.dropMs, ease: "Cubic.In" });
    this.scene.tweens.add({ targets: beam, alpha: flashAlpha, duration: spec.dropMs, ease: "Sine.Out", yoyo: true, hold: 30 });
    this.scene.tweens.add({
      targets: beam, scaleX: 0.04, alpha: 0, duration: spec.narrowMs, delay: spec.dropMs + spec.holdMs, ease: "Cubic.In", onComplete: () => beam.destroy(),
    });
  }

  /** 마름모 두 줄기가 SD를 감고 오른다. 뒤를 돌 때는 SD 뒤 층, 앞을 지날 때는 앞 층에 선다. */
  private spiral(at: FeedLevelUpSpot, size: number): void {
    const { x, groundY, height, depth } = at;
    const spec = FEED_LEVEL_UP.spiral;
    const back = this.scene.add.container(x, groundY).setDepth(depth - 1);
    const front = this.scene.add.container(x, groundY).setDepth(depth + 1);
    for (let strand = 0; strand < spec.strands; strand += 1) {
      for (let index = 0; index < spec.perStrand; index += 1) {
        const spark = this.scene.add
          .image(0, 0, EFFECT_TEXTURE.shard)
          .setTint(spec.colors[strand % spec.colors.length])
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0);
        const base = size / spark.width;
        back.add(spark);
        let inFront = false;
        const flight = { t: 0 };
        this.scene.tweens.add({
          targets: flight, t: 1, duration: spec.ms, delay: index * spec.stagger + strand * 20, ease: "Sine.InOut",
          onUpdate: () => {
            const point = feedSpiralPoint(strand, index, flight.t, height);
            const wantFront = point.depth > 0;
            if (wantFront !== inFront && spark.active) {
              (inFront ? front : back).remove(spark);
              (wantFront ? front : back).add(spark);
              inFront = wantFront;
            }
            spark.setPosition(point.x, point.y).setAlpha(point.alpha).setScale(base * point.scale).setRotation(point.depth * 0.5);
          },
          onComplete: () => spark.destroy(),
        });
      }
    }
    const total = spec.ms + spec.perStrand * spec.stagger + 80;
    this.scene.time.delayedCall(total, () => { back.destroy(); front.destroy(); });
  }

  /** SD가 통 튀어 오르고 금빛이 번지며, 발밑에서 납작한 마름모 파문이 퍼진다. */
  private hop(figure: PuppetCreature, at: FeedLevelUpSpot, spec: FeedHopSpec): void {
    const { x, groundY, height, depth } = at;
    const home = (figure.getData("levelUpHomeY") as number | undefined) ?? figure.y;
    figure.setData("levelUpHomeY", home);
    if (spec.motion) playMotion(this.scene, figure, "roar");
    this.scene.tweens.add({
      targets: figure, y: home - spec.height, duration: spec.upMs, ease: "Quad.Out",
      onComplete: () => this.scene.tweens.add({ targets: figure, y: home, duration: spec.downMs, ease: "Bounce.Out", onComplete: () => { if (figure.active) figure.setY(home); } }),
    });

    const glow = this.scene.add
      .image(x, groundY - height * 0.5, EFFECT_TEXTURE.glow)
      .setTint(spec.glow.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 1)
      .setDisplaySize(height * 1.5, height * 1.6)
      .setAlpha(0);
    this.scene.tweens.add({ targets: glow, alpha: spec.glow.alpha, duration: spec.glow.ms * 0.3, yoyo: true, hold: spec.glow.ms * 0.2, ease: "Sine.Out", onComplete: () => glow.destroy() });

    // 파문은 착지하는 순간 퍼진다 — 점프의 무게가 거기서 바닥에 닿는다.
    const ring = this.scene.add.graphics({ x, y: groundY }).setDepth(depth - 1);
    const spread = { radius: spec.ring.from };
    this.scene.tweens.add({
      targets: spread, radius: spec.ring.to, duration: spec.ring.ms, delay: spec.upMs, ease: "Cubic.Out",
      onUpdate: () => {
        const life = (spread.radius - spec.ring.from) / (spec.ring.to - spec.ring.from);
        ring.clear();
        ring.lineStyle(spec.ring.thickness * (1 - life * 0.5), spec.ring.color, spec.ring.alpha * (1 - life));
        ring.strokePoints(toPoints(burstDiamond(spread.radius, spec.ring.squash)), true);
        ring.lineStyle(2, 0xffffff, 0.7 * (1 - life));
        ring.strokePoints(toPoints(burstDiamond(spread.radius * 0.72, spec.ring.squash)), true);
      },
      onComplete: () => ring.destroy(),
    });
  }
}
