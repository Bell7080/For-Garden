/**
 * 새로 만난 렐릭의 소개 장면.
 *
 * 뽑기에서 **처음 만난 개체**의 카드가 뒤집히기 직전에 한 번 돈다 — 카드를 보기 전에 "새로 온
 * 누군가다"가 먼저 읽히게 하려는 것이다. 자리와 박자는 `newRelicShowcaseLayout.ts`가 갖고,
 * 여기서는 그 표대로 세우고 움직이기만 한다.
 *
 * - **전조**(SSR만): 화면이 샤락 닫히며 어두워지고 가운데에 황금 줄이 핑, 핑핑핑 그어진 뒤 화석처럼
 *   쩍 갈라지며 목소리 막이 열린다. 새로 만난 개체가 아니어도 SSR이면 매번 돈다.
 * - **목소리**: 빈 화면(어둠·점 무늬·비네트) 위에 그 개체의 한마디가 왼쪽부터 스르륵 번진다.
 *   저절로 다음 막으로 넘어가고, 누르면 곧바로 넘어간다.
 * - **등장**: 섬광과 함께 전신·SD·등급·이름·속성·직군·오각형이 서고, 소속 스쿼드는 엠블럼과
 *   이름이 뒷배경 왼쪽 위에 크게·반투명하게 깔린다. 고를 것이 없는
 *   장면이라 확인 버튼을 두지 않고 화면 아무 곳이나 누르면 닫힌다(`RewardPopup`과 같은 말).
 *
 * 원화는 목소리가 흐르는 동안 뒤에서 읽는다. 늦으면 등장 뒤에 도착하는 대로 떠오르고, 못 읽으면
 * 그 자리만 비운 채 나머지 정보는 그대로 선다 — 그림 하나가 장면을 멈추지 않는다.
 */

import Phaser from "phaser";
import { setDebugRelicShowcase } from "../debug";
import { getRelic } from "../data/relics";
import { firstMeetingLine } from "../data/relicFirstMeetings";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { t } from "../i18n";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { squadEmblemKey, SQUADS } from "../data/factions";
import { CRACK_BRANCHES, crackBranchPoints, fossilShards, shardPoints } from "./fossilCrack";
import { squeezeTextToWidth } from "./textFit";
import { openSsrOmen, type SsrOmenHandle } from "./SsrOmenCinematic";
import { audioManager } from "../managers/AudioManager";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawVignette, HOLO, toPoints } from "./holo";
import { addInfoFigureStand, paintRarityGem } from "./info";
import { infoPortraitPlacement } from "./portraitPlacement";
import { RARITY_TONE } from "./rarityMark";
import { flashPolicy } from "./signatureEffects";
import { StatRadar } from "./StatRadar";
import { STAT_TONE } from "./statTones";
import { COLOR, textStyle } from "./theme";
import {
  SHOWCASE_COMPOSITION,
  SHOWCASE_INFO,
  SHOWCASE_OMEN,
  SHOWCASE_OVERSCAN,
  SHOWCASE_SQUAD,
  SHOWCASE_SIZE,
  SHOWCASE_TAP_LOCK_MS,
  SHOWCASE_VOICE,
  showcaseDots,
  omenStrikes,
  showcaseSparkles,
  type ShowcaseComposition,
} from "./newRelicShowcaseLayout";

export interface NewRelicShowcaseOptions {
  /** 이 장면이 서는 깊이. 원화와 정보는 그 위로 한 칸씩 쌓인다. */
  depth: number;
  reduceMotion: boolean;
  reduceFlashes: boolean;
}

const W = SHOWCASE_SIZE.width;
const H = SHOWCASE_SIZE.height;
/** 화면을 덮는 층의 크기 — 흔들려도 가장자리가 드러나지 않게 화면 밖으로 더 뻗는다. */
const OW = W + SHOWCASE_OVERSCAN * 2;
const OH = H + SHOWCASE_OVERSCAN * 2;

/** 화면 밖까지 뻗는 비네트. 흔들릴 때 가장자리의 어둠이 끊겨 보이지 않게 한다. */
function overscanVignette(scene: Phaser.Scene, strength: number): Phaser.GameObjects.Graphics {
  return drawVignette(scene, OW, OH, { strength, depth: 0 }).setPosition(-SHOWCASE_OVERSCAN, -SHOWCASE_OVERSCAN);
}

/** 등급색 한 벌. 큰 면은 칩 색, 글자 발광은 halo를 쓴다. */
function toneOf(rarity: keyof typeof RARITY_TONE): { chip: number; halo: number } {
  const tone = RARITY_TONE[rarity];
  return { chip: tone.chip, halo: Number.parseInt(tone.halo.slice(1), 16) };
}

/**
 * 장면 하나를 연다. 닫힐 때까지 기다린다.
 *
 * 씬이 도중에 내려가면 그 자리에서 끝난다 — 기다리던 쪽이 영영 멈추지 않게 한다.
 */
export function playNewRelicShowcase(scene: Phaser.Scene, relicId: string, options: NewRelicShowcaseOptions): Promise<void> {
  return new Promise<void>((resolve) => new NewRelicShowcase(scene, relicId, options, resolve));
}

class NewRelicShowcase {
  private readonly root: Phaser.GameObjects.Container;
  private readonly voice: Phaser.GameObjects.Container;
  private readonly stage: Phaser.GameObjects.Container;
  private readonly info: Phaser.GameObjects.Container;
  private readonly composition: ShowcaseComposition;
  private readonly tone: { chip: number; halo: number };
  private readonly puppets: PuppetCreature[] = [];
  private phase: "omen" | "voice" | "stage" | "closed" = "voice";
  /** 이 시각(실제 시간) 전에 들어온 누름은 버린다. 막이 바뀔 때마다 다시 잡는다. */
  private tapLockedUntil = performance.now() + SHOWCASE_TAP_LOCK_MS.voice;
  private voiceTimer?: Phaser.Time.TimerEvent;
  private voiceText?: Phaser.GameObjects.Text;
  private voiceLine?: Phaser.GameObjects.Graphics;
  /** SSR 전조 한 장. 목소리 막이 열리면 걷힌다. */
  private omen?: Phaser.GameObjects.Container;
  private readonly omenTimers: Phaser.Time.TimerEvent[] = [];
  private readonly omenTweens: Phaser.Tweens.Tween[] = [];
  /** 3D 전조(`SsrOmenCinematic`). 세울 수 없으면 Phaser 전조가 대신 돈다. */
  private omen3d?: SsrOmenHandle;
  /** 3D 전조를 기다리는 동안 뒤 화면을 가리는 어둠. */
  private omenCover?: Phaser.GameObjects.Rectangle;
  /** 뒷배경에 깔리는 소속 스쿼드 엠블럼·이름. 무대가 선 뒤 조금 늦게 떠오른다. */
  private squadBackdrop?: Phaser.GameObjects.Container;
  private hint?: Phaser.GameObjects.Text;
  /** 전신. 등장 때 옆에서 밀려 들어오는 것은 이 한 장뿐이다. */
  private portrait?: PuppetCreature;
  /** 등장 때 하나씩 밀려 들어오는 정보 조각. 순서가 곧 들어오는 차례다. */
  private readonly pieces: (Phaser.GameObjects.GameObject & { x: number; setAlpha(value: number): unknown })[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly relicId: string,
    private readonly options: NewRelicShowcaseOptions,
    private readonly resolve: () => void,
  ) {
    const def = getRelic(relicId);
    this.composition = SHOWCASE_COMPOSITION[def.rarity];
    this.tone = toneOf(def.rarity);
    const depth = options.depth;

    this.root = scene.add.container(0, 0).setDepth(depth);
    this.voice = scene.add.container(0, 0);
    this.stage = scene.add.container(0, 0).setAlpha(0);
    this.root.add([this.stage, this.voice]);
    // 정보는 원화보다 위에 서야 하므로 뿌리 밖의 제 층을 쓴다.
    this.info = scene.add.container(0, 0).setDepth(depth + 3).setAlpha(0);

    // 화면 전체가 손을 받는다. 누르는 곳을 따로 세우지 않는다.
    const hit = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001).setDepth(depth + 5).setInteractive();
    hit.on("pointerup", () => this.tap());
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => hit.destroy());

    this.buildVoice(firstMeetingLine(relicId));
    this.buildStage();
    void this.loadFigures();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.close());
    if (this.composition.omen) {
      this.phase = "omen";
      this.tapLockedUntil = performance.now() + SHOWCASE_TAP_LOCK_MS.omen;
      this.voice.setAlpha(0);
      setDebugRelicShowcase({ relicId, phase: "omen" });
      void this.startOmen();
    } else {
      setDebugRelicShowcase({ relicId, phase: "voice" });
      this.startVoice();
    }
  }

  /* ── 전조(SSR) ──────────────────────────────────────────────────────────── */

  /**
   * 전조를 연다. 3D 무대(`SsrOmenCinematic` — 지반이 콰지지직 갈라지다 팡 터진다)가 먼저이고,
   * 세울 수 없으면 Phaser로 그린 전조로 되돌아간다. 무대를 읽는 동안에는 어둠이 뒤 화면을 가린다.
   */
  private async startOmen(): Promise<void> {
    this.omenCover = this.scene.add
      .rectangle(W / 2, H / 2, OW, OH, COLOR.void, 1)
      .setDepth(this.options.depth + 2);
    const handle = await openSsrOmen(this.scene, {
      reducedMotion: this.options.reduceMotion,
      volume: audioManager?.volume("sfx") ?? 0,
      onBurst: () => this.burstToVoice(),
    });
    if (this.phase !== "omen") { handle?.stop(); return; }
    if (handle) {
      this.omen3d = handle;
      // 섬광 알림을 놓쳐도(그래픽 연결이 끊기는 등) 무대가 끝나면 대사 막으로 넘어간다.
      void handle.done.then(() => this.enterVoice());
      return;
    }
    this.omenCover?.destroy();
    this.omenCover = undefined;
    this.playOmen();
  }

  /**
   * 팡 — 3D 전조의 섬광 정점. 대사 막이 곧바로 열리고, 그 위에서 무대가 감속하며 천천히 걷힌다 —
   * 흩어지는 조각이 거의 멈춘 채로 옅어지는 동안 대사가 번져, 두 막이 끊기지 않고 이어진다.
   */
  private burstToVoice(): void {
    if (this.phase !== "omen") return;
    this.omen3d?.stop();
    const flashes = flashPolicy(this.options.reduceFlashes);
    const bright = Phaser.Display.Color.IntegerToColor(this.tone.halo).lighten(35).color;
    const flash = this.scene.add.rectangle(W / 2, H / 2, OW, OH, bright, 1)
      .setDepth(this.options.depth + 6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55 * flashes.alphaRatio);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: this.options.reduceMotion ? 160 : 900, ease: "Sine.easeOut", onComplete: () => flash.destroy() });
    this.enterVoice();
  }

  /**
   * 샤락 — 핑, 핑핑핑 — 쩍.
   *
   * 위아래 검은 막이 가운데로 닫히고, 그 이음매에 황금 줄이 그어진 뒤 몇 줄이 몰아친다. 줄이
   * 모인 자리에서 화석처럼 균열이 번지고 섬광과 함께 조각이 튀면 목소리 막이 열린다. 빛은 전부
   * 겹쳐 밝아지는 합성이라 옅게 깔고, 조각은 동그라미가 아니라 마름모다.
   */
  private playOmen(): void {
    const { scene } = this;
    const O = SHOWCASE_OMEN;
    const motion = !this.options.reduceMotion;
    const flashes = flashPolicy(this.options.reduceFlashes);
    const gold = this.tone.halo;
    const bright = Phaser.Display.Color.IntegerToColor(gold).lighten(35).color;
    const omen = scene.add.container(0, 0).setDepth(this.options.depth + 2);
    this.omen = omen;
    const later = (ms: number, run: () => void) => this.omenTimers.push(scene.time.delayedCall(ms, run));
    const tween = (config: Phaser.Types.Tweens.TweenBuilderConfig) => this.omenTweens.push(scene.tweens.add(config));

    // 샤락 — 두 장의 막이 대사가 설 줄에서 만난다.
    const top = scene.add.rectangle(W / 2, O.y, OW, O.y + SHOWCASE_OVERSCAN, COLOR.void, 1).setOrigin(0.5, 1);
    const bottom = scene.add.rectangle(W / 2, O.y, OW, H - O.y + SHOWCASE_OVERSCAN, COLOR.void, 1).setOrigin(0.5, 0);
    omen.add([top, bottom, overscanVignette(scene, 0.9)]);
    if (motion) {
      top.y = -SHOWCASE_OVERSCAN;
      bottom.y = H + SHOWCASE_OVERSCAN;
      tween({ targets: top, y: O.y, duration: O.curtainMs, ease: "Cubic.easeIn" });
      tween({ targets: bottom, y: O.y, duration: O.curtainMs, ease: "Cubic.easeIn" });
    }

    // 핑, 핑핑핑 — 첫 줄은 이음매를 정확히 가로지르고 나머지는 조금씩 비껴 몰아친다.
    const strikes = motion ? omenStrikes() : omenStrikes(1);
    const lines: Phaser.GameObjects.Container[] = [];
    const strikeStart = motion ? O.curtainMs + O.firstStrikeMs : 0;
    for (const strike of strikes) {
      const line = scene.add.container(W / 2 + strike.dx, O.y + strike.dy).setAngle(strike.angle);
      const length = W * strike.length;
      const glow = scene.add.rectangle(0, 0, length, O.glow, gold, 0.34).setBlendMode(Phaser.BlendModes.ADD);
      const core = scene.add.rectangle(0, 0, length, O.core, bright, 1).setBlendMode(Phaser.BlendModes.ADD);
      line.add([glow, core]);
      omen.add(line);
      lines.push(line);
      if (!motion) continue;
      line.setScale(0, 1).setAlpha(0);
      later(strikeStart + strike.delay, () => {
        line.setAlpha(1);
        tween({ targets: line, scaleX: 1, duration: O.strikeMs, ease: "Expo.easeOut" });
        // 그어진 뒤에는 조금 가라앉아 다음 줄이 더 밝게 읽힌다.
        tween({ targets: line, alpha: 0.55, duration: 300, delay: O.strikeMs });
        scene.cameras.main.shake(O.strikeShake.ms, O.strikeShake.intensity);
      });
    }

    // 쩍 — 줄이 모인 자리에서 화석처럼 갈라진다.
    const lastStrike = strikes[strikes.length - 1];
    const crackAt = motion ? strikeStart + lastStrike.delay + O.strikeMs + O.crackDelayMs : 0;
    const crack = scene.add.graphics({ x: W / 2, y: O.y }).setBlendMode(Phaser.BlendModes.ADD);
    crack.lineStyle(20, gold, 0.28);
    for (const branch of CRACK_BRANCHES) crack.strokePoints(toPoints(crackBranchPoints(branch, O.crackSize)), false);
    crack.lineStyle(6, bright, 1);
    for (const branch of CRACK_BRANCHES) crack.strokePoints(toPoints(crackBranchPoints(branch, O.crackSize)), false);
    omen.add(crack);
    if (!motion) {
      this.omenTimers.push(scene.time.delayedCall(O.reducedHoldMs, () => this.enterVoice()));
      return;
    }
    crack.setAlpha(0).setScale(0.55);
    later(crackAt, () => {
      tween({ targets: crack, alpha: 1, scale: 1, duration: O.crackMs, ease: "Back.easeOut" });
      scene.cameras.main.shake(O.strikeShake.ms * 2, O.strikeShake.intensity * 1.5);
    });

    const burstAt = crackAt + O.crackMs + O.crackHoldMs;
    later(burstAt, () => {
      const flash = scene.add.rectangle(W / 2, H / 2, OW, OH, bright, 1).setBlendMode(Phaser.BlendModes.ADD);
      flash.setAlpha(0.85 * flashes.alphaRatio);
      omen.add(flash);
      tween({ targets: flash, alpha: 0, duration: O.burstMs, ease: "Quad.easeOut" });
      tween({ targets: [crack, ...lines], alpha: 0, duration: O.burstMs * 0.8, ease: "Quad.easeOut" });
      tween({ targets: crack, scale: 1.18, duration: O.burstMs, ease: "Cubic.easeOut" });
      scene.cameras.main.shake(O.burstShake.ms, O.burstShake.intensity);
      for (const shard of fossilShards(O.shards, O.shardSpread, O.shardSize)) {
        const piece = scene.add.graphics({ x: W / 2, y: O.y });
        piece.fillStyle(0x0b0d10, 0.95);
        piece.fillPoints(toPoints(shardPoints(shard.size)), true);
        piece.lineStyle(3, gold, 1);
        piece.strokePoints(toPoints(shardPoints(shard.size)), true);
        omen.add(piece);
        tween({
          targets: piece,
          x: W / 2 + Math.cos(shard.angle) * shard.distance,
          y: O.y + Math.sin(shard.angle) * shard.distance,
          angle: shard.spin,
          alpha: 0,
          duration: O.burstMs + 260,
          ease: "Quad.easeOut",
        });
      }
    });
    later(burstAt + O.burstMs * 0.6, () => this.enterVoice());
  }

  /** 전조를 걷고 목소리 막을 연다. 누르면 전조가 끝나기 전에도 곧바로 온다. */
  private enterVoice(): void {
    if (this.phase !== "omen") return;
    this.phase = "voice";
    this.tapLockedUntil = performance.now() + SHOWCASE_TAP_LOCK_MS.voice;
    setDebugRelicShowcase({ relicId: this.relicId, phase: "voice" });
    this.stopOmen(false);
    this.voice.setAlpha(1);
    this.startVoice();
  }

  /** 전조의 타이머·트윈을 멈추고 판을 걷는다. 닫는 중이 아니면 한 박자 옅어지며 사라진다. */
  private stopOmen(immediate: boolean): void {
    for (const timer of this.omenTimers.splice(0)) timer.remove();
    for (const running of this.omenTweens.splice(0)) running.stop();
    // 누르거나 닫을 때는 곧바로 걷는다. 섬광 뒤의 느린 걷힘은 `burstToVoice`가 이미 시작했다.
    this.omen3d?.stop(true);
    this.omen3d = undefined;
    this.omenCover?.destroy();
    this.omenCover = undefined;
    const omen = this.omen;
    this.omen = undefined;
    if (!omen) return;
    if (immediate || this.options.reduceMotion) { omen.destroy(true); return; }
    this.scene.tweens.add({ targets: omen, alpha: 0, duration: 220, onComplete: () => omen.destroy(true) });
  }

  /* ── 목소리 ─────────────────────────────────────────────────────────────── */

  private buildVoice(line: string): void {
    const { scene, voice } = this;
    voice.add(scene.add.rectangle(W / 2, H / 2, OW, OH, COLOR.void, 1));
    // 빈 화면이라도 판때기가 아니라 공간이다 — 등급색이 가운데에서 옅게 번지고 점 무늬가 흐른다.
    voice.add(this.band(W / 2, SHOWCASE_VOICE.y, W * 1.6, 520, 0, 0.1));
    voice.add(overscanVignette(scene, 0.85));

    const text = scene.add
      .text(W / 2, SHOWCASE_VOICE.y, t("lab.showcase.quote", { line }), textStyle({ role: "emphasis", size: this.composition.voiceSize, align: "center", wrap: SHOWCASE_VOICE.wrap }))
      .setOrigin(0.5);
    text.setShadow(0, 4, `#${this.tone.halo.toString(16).padStart(6, "0")}`, 18, false, true);
    voice.add(text);

    const underline = drawHairline(scene, W / 2, SHOWCASE_VOICE.y + text.height / 2 + SHOWCASE_VOICE.line.gap, SHOWCASE_VOICE.line.width, {
      color: this.tone.halo,
      alpha: 0.8,
    });
    voice.add(underline);
    this.voiceText = text;
    this.voiceLine = underline;
  }

  /** 대사를 번지게 하고, 다 번지면 저절로 등장 막으로 넘긴다. */
  private startVoice(): void {
    const { scene } = this;
    const text = this.voiceText!;
    const underline = this.voiceLine!;
    if (this.options.reduceMotion) {
      this.voiceTimer = scene.time.delayedCall(SHOWCASE_VOICE.holdMs, () => this.enterStage());
      return;
    }
    // **스르륵** — 글자를 잘라 두었다가 왼쪽부터 걷어 낸다. 마스크를 쓰지 않는 이유는 이 층이
    // 움직이지 않는 판이라 자르기만으로 충분하고, 기하 마스크는 닫는 순간 수명을 따로 챙겨야 해서다.
    const width = text.width;
    const reveal = { p: 0 };
    text.setCrop(0, 0, 0, text.height).setAlpha(0.2);
    underline.setScale(0, 1);
    scene.tweens.add({
      targets: reveal,
      p: 1,
      duration: SHOWCASE_VOICE.wipeMs,
      ease: "Sine.easeOut",
      onUpdate: () => {
        text.setCrop(0, 0, width * reveal.p, text.height);
        text.setAlpha(0.2 + 0.8 * reveal.p);
      },
    });
    scene.tweens.add({ targets: text, y: SHOWCASE_VOICE.y - 10, duration: SHOWCASE_VOICE.wipeMs + 400, ease: "Sine.easeOut" });
    scene.tweens.add({ targets: underline, scaleX: 1, duration: SHOWCASE_VOICE.line.ms, delay: SHOWCASE_VOICE.wipeMs * 0.6, ease: "Cubic.easeOut" });
    this.voiceTimer = scene.time.delayedCall(SHOWCASE_VOICE.wipeMs + SHOWCASE_VOICE.holdMs, () => this.enterStage());
  }

  /* ── 등장 ───────────────────────────────────────────────────────────────── */

  private buildStage(): void {
    const { scene, stage, info, composition } = this;
    const def = getRelic(this.relicId);
    const I = SHOWCASE_INFO;

    stage.add(scene.add.rectangle(W / 2, H / 2, OW, OH, COLOR.void, 1));
    // 정보창과 같은 배경 원화를 깔되 등급색으로 물들여 눌러 둔다 — 원화가 인물보다 먼저 읽히면 안 된다.
    const backdrop = addSceneBackground(scene, BACKGROUND.info, 0).setAlpha(0.42);
    // 원화도 화면 밖까지 키운다 — 흔들릴 때 그 너머가 비지 않게.
    backdrop.setScale(backdrop.scaleX * (OH / H), backdrop.scaleY * (OH / H));
    backdrop.setTint(this.tone.chip);
    stage.add(backdrop);
    stage.add(scene.add.rectangle(W / 2, H / 2, OW, OH, COLOR.void, 0.38));
    this.squadBackdrop = this.buildSquadBackdrop(def.squad);
    if (this.squadBackdrop) stage.add(this.squadBackdrop);

    const band = composition.band;
    stage.add(this.band(W / 2, band.y, W * 1.9, band.height, band.angle, band.alpha));
    if (composition.rays > 0) stage.add(this.rays(composition.rays));
    if (composition.watermark) {
      // SSR만 — 프로젝트 이름이 왼쪽 가장자리에 세로로 누워 그 개체의 이름표를 한 번 더 크게 건다.
      const mark = scene.add
        .text(64, H / 2 - 120, def.projectName.toUpperCase(), textStyle({ role: "display", size: 150, color: `#${this.tone.halo.toString(16).padStart(6, "0")}` }))
        .setOrigin(0.5)
        .setAngle(-90)
        .setAlpha(0.1);
      stage.add(mark);
    }
    stage.add(overscanVignette(scene, 0.7));

    // 밑동을 눌러 글이 원화 위에서 읽히게 한다. 판때기가 아니라 어둠이다.
    const fadeHeight = I.fade.bottom - I.fade.top;
    info.add(drawGlassFade(scene, W / 2, I.fade.top + (fadeHeight + SHOWCASE_OVERSCAN) / 2, OW, fadeHeight + SHOWCASE_OVERSCAN, { topAlpha: 0, bottomAlpha: 0.97 }));
    info.add(drawGlassFade(scene, W / 2, 110 - SHOWCASE_OVERSCAN / 2, OW, 220 + SHOWCASE_OVERSCAN, { topAlpha: 0.7, bottomAlpha: 0 }));

    const pieces = this.pieces;
    const code = scene.add
      .text(I.left, I.code.y, `No.${def.specimenNumber}  ·  ${def.projectName}`, textStyle({ role: "emphasis", size: I.code.size, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);
    info.add(code);
    info.add(drawHairline(scene, I.left + 90, I.code.y + 30, 180, { color: this.tone.halo, alpha: 0.7 }));

    const rarityGlow = scene.add.text(I.left, I.rarity.y, "", textStyle({ role: "display", size: I.rarity.size })).setOrigin(0, 0.5).setAlpha(0.45);
    rarityGlow.setBlendMode(Phaser.BlendModes.ADD).setScale(1.06);
    const rarity = scene.add.text(I.left, I.rarity.y, "", textStyle({ role: "display", size: I.rarity.size })).setOrigin(0, 0.5);
    paintRarityGem(rarity, rarityGlow, def.rarity);
    const name = scene.add.text(I.left, I.name.y, def.name, textStyle({ role: "display", size: I.name.size })).setOrigin(0, 0.5);
    name.setShadow(0, 6, "#000000", 14, false, true);
    const origin = scene.add.text(I.left + 4, I.origin.y, def.origin, textStyle({ role: "emphasis", size: I.origin.size, color: COLOR.inkDim })).setOrigin(0, 0.5);
    pieces.push(rarityGlow, rarity, name, origin);

    const element = new AffinityBadge(scene, I.left + I.badges.element / 2, I.badges.y, ELEMENT_ICON[def.element], I.badges.element, 0.7);
    const roleX = I.left + I.badges.element + I.badges.gap + I.badges.role / 2;
    const role = new AffinityBadge(scene, roleX, I.badges.y + 6, ROLE_ICON[def.role], I.badges.role, 0.7);
    pieces.push(element, role);

    // 오각형은 원화 위에 서므로 어두운 유리 한 장을 받친다 — 드레스·무기 같은 밝은 결 위에서
    // 축 이름과 수치가 묻히지 않게 한다. 판은 다른 판과 같은 깎인 칩이고 테두리를 두르지 않는다.
    const plate = drawLayer(scene, I.radar.x, I.radar.y, chipPoints(I.radar.plate.width, I.radar.plate.height, {
      bevel: { topLeft: 34, bottomRight: 34 },
    }), { fill: 0x0b0e13, alpha: Math.max(HOLO.glass, 0.72), edge: this.tone.halo, edgeAlpha: 0.55 });
    pieces.push(plate);
    const radar = new StatRadar(scene, I.radar.x, I.radar.y, I.radar.radius, {
      size: 20,
      colors: Object.fromEntries(Object.entries(STAT_TONE).map(([key, color]) => [key, `#${color.toString(16).padStart(6, "0")}`])),
      values: true,
      power: true,
    });
    radar.draw(relicProgression.getFinalStats(def.id), I.radar.radius);
    pieces.push(radar);

    addInfoFigureStand(scene, info, I.sd.x, I.sd.groundY);
    info.add(pieces);

    this.hint = scene.add
      .text(W / 2, I.hintY, t("reward.tapHint"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5)
      .setAlpha(0);
    this.hint.setShadow(0, 3, "#000000", 4, false, true);
    info.add(this.hint);
  }

  /**
   * 소속 스쿼드 — 뒷배경 왼쪽 위에 크게 깔리는 엠블럼과 그 아래의 이름.
   *
   * 표식이지 주인공이 아니므로 반투명하게 눌러 두고, 복제 그림자도 두르지 않는다(배경이라
   * 번지는 어둠이 오히려 얼룩으로 읽힌다). 엠블럼 그림이 없으면 이름만 선다.
   */
  private buildSquadBackdrop(squadId: keyof typeof SQUADS): Phaser.GameObjects.Container | undefined {
    const { scene } = this;
    const S = SHOWCASE_SQUAD;
    const squad = SQUADS[squadId];
    if (!squad) return undefined;
    const layer = scene.add.container(S.x, S.y);
    const key = squadEmblemKey(squadId);
    if (scene.textures.exists(key)) {
      const source = scene.textures.get(key).getSourceImage() as { width?: number; height?: number };
      const ratio = source.width && source.height ? source.width / source.height : 1;
      const width = ratio >= 1 ? S.size : S.size * ratio;
      const height = ratio >= 1 ? S.size / ratio : S.size;
      layer.add(scene.add.image(0, 0, key).setDisplaySize(width, height).setAlpha(S.alpha));
    }
    const name = scene.add
      .text(0, S.name.y - S.y, squad.name, textStyle({ role: "display", size: S.name.size, color: COLOR.ink }))
      .setOrigin(0.5)
      .setAlpha(S.name.alpha);
    squeezeTextToWidth(name, S.name.room);
    const latin = scene.add
      .text(0, S.latin.y - S.y, squad.latin.toUpperCase(), textStyle({ role: "emphasis", size: S.latin.size, color: `#${this.tone.halo.toString(16).padStart(6, "0")}` }))
      .setOrigin(0.5)
      .setAlpha(S.latin.alpha);
    squeezeTextToWidth(latin, S.name.room);
    layer.add([name, latin]);
    return layer;
  }

  /** 원화 둘을 뒤에서 읽는다. 도착하는 대로 제 층에 선다. */
  private async loadFigures(): Promise<void> {
    const { scene, composition } = this;
    const def = getRelic(this.relicId);
    const portraitAsset = relicAppearanceManager.portraitAssetFor(def.id);
    const sdAsset = relicAppearanceManager.battleAssetFor(def.id);
    const portrait = spawnPuppet(scene, portraitAsset, {
      ...infoPortraitPlacement(portraitAsset, composition.portrait),
      depth: this.options.depth + 1,
    }).catch(() => undefined);
    const figure = spawnPuppet(scene, sdAsset, {
      x: SHOWCASE_INFO.sd.x,
      groundY: SHOWCASE_INFO.sd.groundY,
      height: SHOWCASE_INFO.sd.height,
      depth: this.options.depth + 4,
    }).catch(() => undefined);

    const standing = await portrait;
    if (standing) this.adopt(standing, true);
    const sd = await figure;
    if (sd) this.adopt(sd, false);
  }

  /** 도착한 원화를 받는다. 이미 닫혔으면 곧바로 놓는다. */
  private adopt(creature: PuppetCreature, isPortrait: boolean): void {
    if (this.phase === "closed") { creature.destroy(); return; }
    this.puppets.push(creature);
    if (isPortrait) this.portrait = creature;
    if (this.phase === "omen" || this.phase === "voice") { creature.setVisible(false); return; }
    // 등장이 이미 시작됐다면 늦게 온 그림은 제자리에서 떠오르기만 한다.
    creature.setAlpha(0);
    this.scene.tweens.add({ targets: creature, alpha: 1, duration: 320 });
  }

  private tap(): void {
    if (performance.now() < this.tapLockedUntil) return;
    if (this.phase === "omen") { this.enterVoice(); return; }
    if (this.phase === "voice") { this.enterStage(); return; }
    if (this.phase === "stage") this.close();
  }

  /** 화아악 — 섬광과 함께 무대가 선다. */
  private enterStage(): void {
    if (this.phase !== "voice") return;
    this.phase = "stage";
    this.tapLockedUntil = performance.now() + SHOWCASE_TAP_LOCK_MS.stage;
    setDebugRelicShowcase({ relicId: this.relicId, phase: "stage" });
    this.voiceTimer?.remove();
    const { scene, composition } = this;
    const motion = !this.options.reduceMotion;
    const flashes = flashPolicy(this.options.reduceFlashes);

    // 섬광은 무대 위 한 겹. 등급색이 섞인 흰빛이 화면을 덮었다가 걷힌다.
    const flash = scene.add.rectangle(W / 2, H / 2, OW, OH, 0xffffff, 0.001).setDepth(this.options.depth + 6);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setFillStyle(Phaser.Display.Color.IntegerToColor(this.tone.halo).lighten(40).color, 1);
    flash.setAlpha(0.95 * flashes.alphaRatio);
    const repeat = Math.min(composition.flashes - 1, flashes.maxRepeats);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: motion ? 520 : 200,
      ease: "Quad.easeOut",
      repeat,
      repeatDelay: 60,
      onRepeat: () => flash.setAlpha(0.6 * flashes.alphaRatio),
      onComplete: () => flash.destroy(),
    });
    if (motion && composition.shake) scene.cameras.main.shake(composition.shake.ms, composition.shake.intensity);

    // 목소리를 걷고 무대를 세운다.
    this.voice.setVisible(false);
    this.stage.setAlpha(1);
    this.info.setAlpha(1);

    for (const puppet of this.puppets) {
      puppet.setVisible(true);
      if (!motion) continue;
      if (puppet === this.portrait) {
        const home = { x: puppet.x, y: puppet.y };
        puppet.setPosition(home.x + composition.enterFrom.x, home.y + composition.enterFrom.y).setAlpha(0);
        scene.tweens.add({ targets: puppet, x: home.x, y: home.y, alpha: 1, duration: 620, ease: "Cubic.easeOut" });
      } else {
        puppet.setAlpha(0);
        scene.tweens.add({ targets: puppet, alpha: 1, duration: 360, delay: 380 });
      }
    }

    if (motion) {
      // 띠·빛줄기는 살짝 부풀었다 가라앉아 섬광의 여운을 남긴다.
      this.stage.setScale(1.04).setPosition(-W * 0.02, -H * 0.02);
      scene.tweens.add({ targets: this.stage, scale: 1, x: 0, y: 0, duration: 700, ease: "Cubic.easeOut" });
      // 정보는 왼쪽에서 하나씩 밀려 들어온다.
      this.pieces.forEach((piece, order) => {
        const homeX = piece.x;
        piece.x = homeX - 60;
        piece.setAlpha(0);
        scene.tweens.add({ targets: piece, x: homeX, alpha: 1, duration: 360, delay: 260 + order * SHOWCASE_INFO.staggerMs, ease: "Cubic.easeOut" });
      });
      this.sparkles();
      if (this.squadBackdrop) {
        this.squadBackdrop.setAlpha(0).setScale(1.06);
        scene.tweens.add({ targets: this.squadBackdrop, alpha: 1, scale: 1, duration: SHOWCASE_SQUAD.fadeMs, delay: SHOWCASE_SQUAD.delayMs, ease: "Sine.easeOut" });
      }
    }
    // 닫는 말은 무대가 다 선 뒤에 옅게 떠오른다.
    scene.tweens.add({ targets: this.hint, alpha: 0.62, duration: 300, delay: motion ? 900 : 0 });
  }

  private close(): void {
    if (this.phase === "closed") return;
    this.phase = "closed";
    setDebugRelicShowcase(undefined);
    this.voiceTimer?.remove();
    this.stopOmen(true);
    for (const puppet of this.puppets.splice(0)) puppet.destroy();
    this.info.destroy(true);
    this.root.destroy(true);
    this.resolve();
  }

  /* ── 그림 조각 ──────────────────────────────────────────────────────────── */

  /**
   * 등급색 띠와 그 안의 점 무늬.
   *
   * 판때기가 아니라 빛의 띠다 — 가운데가 가장 밝고 위아래로 갈수록 잦아들며, 가장자리를 따라
   * 점이 흩뿌려진다(출격 버튼의 점 패턴과 같은 문법).
   */
  private band(x: number, y: number, width: number, height: number, angle: number, alpha: number): Phaser.GameObjects.Container {
    const { scene } = this;
    const band = scene.add.container(x, y).setAngle(angle);
    const glow = scene.add.graphics();
    const half = height / 2;
    glow.fillGradientStyle(this.tone.chip, this.tone.chip, this.tone.chip, this.tone.chip, 0, 0, alpha, alpha);
    glow.fillRect(-width / 2, -half, width, half);
    glow.fillGradientStyle(this.tone.chip, this.tone.chip, this.tone.chip, this.tone.chip, alpha, alpha, 0, 0);
    glow.fillRect(-width / 2, 0, width, half);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    band.add(glow);
    const dots = scene.add.graphics();
    for (const dot of showcaseDots(width, height, this.composition.dots.step)) {
      dots.fillStyle(this.tone.halo, this.composition.dots.alpha * dot.alpha);
      dots.fillCircle(dot.x, dot.y, dot.r);
    }
    band.add(dots);
    // 띠의 위아래 가장자리를 가르는 두 줄.
    band.add(drawHairline(scene, 0, -half, width, { color: this.tone.halo, alpha: 0.5 }));
    band.add(drawHairline(scene, 0, half, width, { color: this.tone.halo, alpha: 0.5 }));
    return band;
  }

  /** SSR만 — 오른쪽 위에서 부채꼴로 뻗는 빛줄기. 겹쳐 밝아지는 합성이라 옅게 둔다. */
  private rays(count: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics({ x: W + 60, y: -80 }).setBlendMode(Phaser.BlendModes.ADD);
    const length = H * 1.4;
    for (let index = 0; index < count; index += 1) {
      const angle = Phaser.Math.DegToRad(112 + index * 11);
      const spread = Phaser.Math.DegToRad(2.2 + (index % 2) * 1.4);
      g.fillStyle(this.tone.halo, 0.07 + (index % 2) * 0.04);
      g.fillTriangle(
        0, 0,
        Math.cos(angle - spread) * length, Math.sin(angle - spread) * length,
        Math.cos(angle + spread) * length, Math.sin(angle + spread) * length,
      );
    }
    return g;
  }

  /** 위로 떠오르는 마름모 조각. 동그라미가 아니라 마름모이고 발밑으로 떨어지지 않는다. */
  private sparkles(): void {
    for (const spark of showcaseSparkles(this.composition.sparkles)) {
      const g = this.scene.add.graphics({ x: spark.x, y: spark.y }).setBlendMode(Phaser.BlendModes.ADD);
      const s = spark.size;
      g.fillStyle(this.tone.halo, 0.85);
      g.fillPoints([
        new Phaser.Math.Vector2(0, -s), new Phaser.Math.Vector2(s * 0.55, 0),
        new Phaser.Math.Vector2(0, s * 0.8), new Phaser.Math.Vector2(-s * 0.5, 0),
      ], true);
      g.setAlpha(0);
      this.stage.add(g);
      this.scene.tweens.add({
        targets: g,
        y: spark.y - 260,
        alpha: { from: 0.9, to: 0 },
        duration: 1600,
        delay: 300 + spark.delay,
        ease: "Sine.easeOut",
      });
    }
  }
}
