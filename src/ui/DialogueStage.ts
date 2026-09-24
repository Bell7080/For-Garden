import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  resolveDialogueCast,
  type DialogueAct,
  type DialogueBackdrop,
  type DialogueCastMember,
  type DialogueCue,
  type DialogueNode,
  type DialogueStandingAsset,
} from "../core/dialogue";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import {
  DODI_ASSET,
  EXPLORER_ASSET,
  LEXIA_ASSET,
  PARUA_ASSET,
  RIPA_ASSET,
  SEIRA_ASSET,
  AMO_ASSET,
  TOBY_ASSET,
  TORIKA_ASSET,
  preloadPuppetAssets,
  spawnPuppet,
  type PuppetAsset,
  type PuppetCreature,
} from "../puppets/assets";
import { addSceneBackground, ensureBackgroundTexture } from "./backgrounds";
import {
  DIALOGUE_ACTS,
  DIALOGUE_ALARM,
  DIALOGUE_BACKDROP,
  DIALOGUE_CUES,
  DIALOGUE_ENTRANCE,
  DIALOGUE_EXPLOSION,
  DIALOGUE_FOCUS,
  DIALOGUE_STAGE_CUT,
  DIALOGUE_STANDING_FRAME,
  DIALOGUE_STANDING_ZOOM,
  dialogueStageSpot,
  explosionShards,
} from "./dialogueStageLayout";
import { drawVignette } from "./holo";

/** 대사 데이터의 스탠딩 키 → 전신 원화. 데이터에 런타임 객체를 넣지 않으므로 여기서 잇는다. */
const STANDING_ASSETS: Readonly<Record<DialogueStandingAsset, PuppetAsset>> = {
  torika: TORIKA_ASSET,
  lexia: LEXIA_ASSET,
  seira: SEIRA_ASSET,
  dodi: DODI_ASSET,
  parua: PARUA_ASSET,
  koma: EXPLORER_ASSET,
  toby: TOBY_ASSET,
  amo: AMO_ASSET,
  ripa: RIPA_ASSET,
};

/**
 * 무대에 선 한 명. `baseX`·`baseY`는 연출이 끝나면 돌아올 제자리다.
 *
 * `headOffset`은 머리 관절이 개체 원점에서 떨어진 거리를 **배율 1 기준**으로 적은 값이다 —
 * 함께 선 사람 수가 바뀌어 크기가 달라져도 머리가 같은 줄에 남도록 새 자리를 거꾸로 구한다.
 */
interface StageMember {
  id: DialogueStandingAsset;
  creature: PuppetCreature;
  slot: DialogueCastMember["slot"];
  veiled: boolean;
  baseX: number;
  baseY: number;
  /** 무대 크기 배율(`zoom`)이 1일 때의 개체 배율. */
  unitScale: number;
  headOffset: { x: number; y: number };
  /** 지금 도는 연출. 다음 연출이 오면 끊고 제자리에서 다시 시작한다. */
  act?: Phaser.Tweens.TweenChain;
}

/** 무대 층. 배경 < 스탠딩 < 화면 연출 < 대사판(600) 순서다. */
const DEPTH = { backdrop: -30, vignette: -29, alarm: 560, flash: 580 } as const;

/**
 * 이야기 무대 — 배경과 그 위에 선 스탠딩, 그리고 장면 전체에 일어나는 연출을 맡는다.
 *
 * **스탠딩은 늘 idle로 서 있다.** 표정을 갈아 끼우지 않고, 기분은 몸 전체를 옮겨서 말한다
 * (`DIALOGUE_ACTS`의 통통·부들부들·끄덕). 말하는 사람은 밝게 한 층 앞으로 서고 나머지는
 * 한 톤 가라앉는다.
 *
 * **몸은 대사판 윗선에서 잘린다.** 상점이 점원을 세우는 것과 같은 문법이라, 머리 관절을
 * 무대에 고정해 상반신만 남기고 대사판이 반투명이어도 그 아래로 다리가 비치지 않게 한다.
 * Puppet은 컨테이너 변환을 물려받지 않으므로 화면 좌표의 기하 마스크 한 장을 모두가 함께 쓴다.
 */
export class DialogueStage {
  private readonly members = new Map<DialogueStandingAsset, StageMember>();
  private cast: readonly DialogueCastMember[] = [];
  private backdropKey?: DialogueBackdrop;
  private backdrop?: Phaser.GameObjects.Image;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private alarm?: { band: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween };
  private terminated = false;

  constructor(private readonly scene: Phaser.Scene, backdrop?: DialogueBackdrop) {
    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.maskGraphics.fillStyle(0xffffff, 1).fillRect(0, 0, BASE_WIDTH, DIALOGUE_STAGE_CUT);
    this.mask = this.maskGraphics.createGeometryMask();
    if (backdrop) this.setBackdrop(backdrop);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.terminate());
  }

  /** 배경 원화가 있는 무대인가. 없으면 그 이야기를 연 씬이 제 판을 깐다. */
  get hasBackdrop(): boolean { return this.backdropKey !== undefined; }

  /**
   * 그 이야기가 쓸 전신을 **처음 서는 순서대로 한 장씩** 읽어 둔다.
   *
   * 제목표가 도는 동안이 통째로 비어 있어, 그 사이에 뒤에 설 사람들까지 읽어 두면 노드가
   * 넘어갈 때 새 인물이 뒤늦게 서는 일이 줄어든다. 한꺼번에 던지지 않는 이유는 첫 스탠딩이
   * 그 줄 뒤에 서지 않게 하기 위해서다. 실패는 조용히 넘어간다 — 쓸 때 제 경로가 다시 읽는다.
   */
  prefetch(order: readonly DialogueStandingAsset[]): void {
    void (async () => {
      for (const id of order) {
        if (this.terminated) return;
        await preloadPuppetAssets([STANDING_ASSETS[id]]).catch(() => undefined);
      }
    })();
  }

  /**
   * 노드 하나의 무대를 세운다. 새로 서는 사람이 모두 도착하면 약속이 풀린다.
   *
   * `isCurrent`는 기다리는 사이 노드가 바뀌거나 씬이 닫혔는지 묻는다 — 늦게 도착한 스탠딩이
   * 이미 지나간 노드의 무대에 붙지 않게 한다.
   */
  async present(node: DialogueNode, isCurrent: () => boolean): Promise<void> {
    if (this.terminated) return;
    // 기다리기 전에는 `isCurrent`를 묻지 않는다 — 씬의 `create` 안에서 부르면 그 씬은 아직
    // 활성으로 표시되기 전이라, 첫 노드의 무대가 통째로 세워지지 않는다.
    if (node.cue === "explosion") {
      await this.explode(node.backdrop);
      if (!isCurrent()) return;
    } else {
      if (node.backdrop) this.setBackdrop(node.backdrop);
      if (node.cue) this.playCue(node.cue);
    }

    const next = resolveDialogueCast(this.cast, node);
    this.cast = next;
    const nextIds = new Set(next.map(({ id }) => id));
    for (const [id, member] of this.members) if (!nextIds.has(id)) this.dismiss(member);

    const arrivals = next.filter(({ id }) => !this.members.has(id));
    for (const entry of next) {
      const member = this.members.get(entry.id);
      if (member) this.rearrange(member, entry, next.length);
    }
    await Promise.all(arrivals.map((entry) => this.summon(entry, next.length, isCurrent)));
    if (!isCurrent()) return;

    this.focus(node.standing);
    if (node.act && node.standing) {
      const speaker = this.members.get(node.standing);
      if (speaker) this.playAct(speaker, node.act);
    }
  }

  /** 한 명을 세운다. 자기 자리 바깥쪽에서 미끄러져 들어온다. */
  private async summon(entry: DialogueCastMember, castSize: number, isCurrent: () => boolean): Promise<void> {
    const asset = STANDING_ASSETS[entry.id];
    const spot = dialogueStageSpot(entry.slot, castSize);
    const zoom = (DIALOGUE_STANDING_ZOOM[entry.id] ?? 1) * spot.zoom;
    let creature: PuppetCreature;
    try {
      creature = await spawnPuppet(this.scene, asset, {
        focus: { anchor: "head", x: spot.x, y: DIALOGUE_STANDING_FRAME.headY },
        height: DIALOGUE_STANDING_FRAME.height * zoom,
        depth: DIALOGUE_FOCUS.listenerDepth,
      });
    } catch (error) {
      // 원화 한 장이 없다고 이야기가 멈추지 않는다. 그 사람만 서지 않고 대사는 이어진다.
      console.error("대사 스탠딩 표시 실패", entry.id, error);
      return;
    }
    // 기다리는 사이 노드가 바뀌었거나 같은 사람이 이미 섰으면 늦게 온 쪽을 버린다.
    if (this.terminated || !isCurrent() || this.members.has(entry.id) || !this.cast.some(({ id }) => id === entry.id)) {
      creature.destroy();
      return;
    }
    const member: StageMember = {
      id: entry.id,
      creature,
      slot: entry.slot,
      veiled: entry.veiled === true,
      baseX: creature.x,
      baseY: creature.y,
      unitScale: creature.scaleX / spot.zoom,
      headOffset: { x: (spot.x - creature.x) / creature.scaleX, y: (DIALOGUE_STANDING_FRAME.headY - creature.y) / creature.scaleX },
    };
    this.members.set(entry.id, member);
    creature.setMask(this.mask);
    if (member.veiled) creature.setTint(DIALOGUE_FOCUS.veilTint);
    const from = entry.slot === "left" ? -1 : entry.slot === "right" ? 1 : 0;
    const slide = DIALOGUE_ENTRANCE.slide * this.distanceFactor();
    creature.setAlpha(0).setX(member.baseX + from * slide).setY(member.baseY + (from === 0 ? slide * 0.4 : 0));
    this.scene.tweens.add({ targets: creature, x: member.baseX, y: member.baseY, alpha: 1, duration: DIALOGUE_ENTRANCE.enterMs, ease: "Cubic.Out" });
  }

  /** 무대를 떠나는 사람. 곧바로 장부에서 빼 다음 노드가 같은 사람을 다시 세울 수 있게 한다. */
  private dismiss(member: StageMember): void {
    this.members.delete(member.id);
    member.act?.stop();
    const { creature } = member;
    if (!this.scene.tweens || !creature.active) { creature.destroy(); return; }
    this.scene.tweens.killTweensOf(creature);
    this.scene.tweens.add({ targets: creature, alpha: 0, duration: DIALOGUE_ENTRANCE.exitMs, onComplete: () => creature.destroy() });
  }

  /** 이미 선 사람의 자리·크기·베일을 다음 노드에 맞춘다. 머리는 늘 같은 줄에 남는다. */
  private rearrange(member: StageMember, entry: DialogueCastMember, castSize: number): void {
    const veiled = entry.veiled === true;
    if (veiled !== member.veiled) {
      member.veiled = veiled;
      member.creature.setTint(veiled ? DIALOGUE_FOCUS.veilTint : DIALOGUE_FOCUS.dimTint);
    }
    const spot = dialogueStageSpot(entry.slot, castSize);
    const scale = member.unitScale * spot.zoom;
    const baseX = spot.x - member.headOffset.x * scale;
    const baseY = DIALOGUE_STANDING_FRAME.headY - member.headOffset.y * scale;
    member.slot = entry.slot;
    if (Math.abs(baseX - member.baseX) < 0.5 && Math.abs(baseY - member.baseY) < 0.5 && Math.abs(scale - member.creature.scaleX) < 1e-4) return;
    member.baseX = baseX;
    member.baseY = baseY;
    member.act?.stop();
    member.act = undefined;
    this.scene.tweens.killTweensOf(member.creature);
    this.scene.tweens.add({
      targets: member.creature,
      x: baseX,
      y: baseY,
      scale,
      alpha: 1,
      duration: DIALOGUE_ENTRANCE.moveMs,
      ease: "Cubic.InOut",
    });
  }

  /** 말하는 사람만 밝게 한 층 앞으로. 화자가 없는 줄(지문·연구원)은 모두 가라앉는다. */
  private focus(speaker?: DialogueStandingAsset): void {
    for (const member of this.members.values()) {
      const speaking = member.id === speaker;
      member.creature.setDepth(speaking ? DIALOGUE_FOCUS.speakerDepth : DIALOGUE_FOCUS.listenerDepth);
      if (member.veiled) continue;
      this.tweenTint(member.creature, speaking ? 0xffffff : DIALOGUE_FOCUS.dimTint);
    }
  }

  /** 색을 한 번에 갈지 않고 짧게 옮긴다. 뚝 바꾸면 화자가 바뀔 때마다 화면이 깜빡인다. */
  private tweenTint(creature: PuppetCreature, to: number): void {
    const from = Phaser.Display.Color.ValueToColor(creature.tintTopLeft);
    const target = Phaser.Display.Color.ValueToColor(to);
    if (from.color === target.color) return;
    const blend = { t: 0 };
    this.scene.tweens.add({
      targets: blend,
      t: 100,
      duration: DIALOGUE_FOCUS.tintMs,
      onUpdate: () => {
        if (!creature.active) return;
        const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, target, 100, blend.t);
        creature.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
      },
    });
  }

  /** 제자리에서 시작해 제자리로 끝나는 몸짓. 앞 몸짓이 남아 있으면 끊고 제자리에서 다시 시작한다. */
  private playAct(member: StageMember, act: DialogueAct): void {
    member.act?.stop();
    const { creature } = member;
    creature.setPosition(member.baseX, member.baseY);
    const factor = this.distanceFactor();
    member.act = this.scene.tweens.chain({
      targets: creature,
      tweens: DIALOGUE_ACTS[act].map((step) => ({
        x: member.baseX + step.dx * factor,
        y: member.baseY + step.dy * factor,
        duration: step.ms,
        ease: step.ease,
      })),
      onComplete: () => { if (creature.active) creature.setPosition(member.baseX, member.baseY); },
    });
  }

  /** 배경을 갈아 끼운다. 새 원화가 도착하면 옛것을 걷는다 — 그 사이에 빈 판이 보이지 않게 한다. */
  private setBackdrop(key: DialogueBackdrop): void {
    if (key === this.backdropKey) return;
    this.backdropKey = key;
    this.stopAlarm();
    const previous = this.backdrop;
    const image = addSceneBackground(this.scene, DIALOGUE_BACKDROP[key], DEPTH.backdrop);
    this.backdrop = image;
    if (!previous) {
      drawVignette(this.scene, BASE_WIDTH, BASE_HEIGHT, { depth: DEPTH.vignette, strength: 0.55 });
      return;
    }
    // 옛 원화는 새 원화가 도착한 뒤에 걷는다. 먼저 걷으면 그 사이에 빈 판이 보인다.
    previous.setDepth(DEPTH.backdrop - 1);
    void ensureBackgroundTexture(this.scene, DIALOGUE_BACKDROP[key]).then(() => {
      if (!this.terminated) this.scene.time.delayedCall(240, () => previous.destroy());
    });
  }

  /** 흔들림·섬광·경보 가운데 폭파를 뺀 것. 폭파는 무대를 갈아 끼우므로 기다려야 한다. */
  private playCue(cue: DialogueCue): void {
    const spec = DIALOGUE_CUES[cue];
    this.shake(spec.shakeMs, spec.shakeIntensity);
    if (spec.flashAlpha > 0) this.flash(spec.flashAlpha, 60, 240);
    if (cue === "alarm") this.startAlarm();
  }

  private shake(duration: number, intensity: number): void {
    const factor = motionPolicy(settingsManager.get()).cameraShakeFactor;
    if (factor > 0) this.scene.cameras.main.shake(duration, intensity * factor);
  }

  /** 옅은 흰 막. 번쩍임 줄이기를 켜면 절반 아래로 누른다. */
  private flash(alpha: number, inMs: number, outMs: number): Phaser.GameObjects.Rectangle {
    const reduce = settingsManager.get().accessibility.reduceFlashes;
    const veil = this.scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0)
      .setDepth(DEPTH.flash);
    const peak = reduce ? Math.min(alpha, 0.45) : alpha;
    this.scene.tweens.chain({
      targets: veil,
      tweens: [
        { fillAlpha: peak, duration: inMs, ease: "Quad.Out" },
        { fillAlpha: 0, duration: outMs, ease: "Quad.In" },
      ],
      onComplete: () => veil.destroy(),
    });
    return veil;
  }

  /**
   * 경보 — 화면 가장자리에서 붉은빛이 맥박친다.
   *
   * 가운데는 비워 둔다. 화면 전체를 붉게 덮으면 인물과 글이 그 속에 묻힌다. 폭파나 배경
   * 전환이 끄기 전까지 몇 마디 내내 이어진다.
   */
  private startAlarm(): void {
    if (this.alarm) return;
    const band = this.scene.add.graphics().setDepth(DEPTH.alarm).setAlpha(0);
    const layers = 8;
    const thickness = DIALOGUE_ALARM.thickness;
    for (let index = 0; index < layers; index += 1) {
      const inset = (thickness / layers) * index;
      band.lineStyle(thickness / layers + 1, DIALOGUE_ALARM.color, (1 - index / layers) * 0.9);
      band.strokeRect(inset, inset, BASE_WIDTH - inset * 2, BASE_HEIGHT - inset * 2);
    }
    const repeat = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor > 0 ? -1 : 0;
    const tween = this.scene.tweens.add({
      targets: band,
      alpha: DIALOGUE_ALARM.peakAlpha,
      duration: DIALOGUE_ALARM.pulseMs,
      yoyo: true,
      repeat,
      ease: "Sine.InOut",
    });
    this.alarm = { band, tween };
  }

  private stopAlarm(): void {
    if (!this.alarm) return;
    const { band, tween } = this.alarm;
    this.alarm = undefined;
    tween.stop();
    band.destroy();
  }

  /**
   * 폭파 — 하얗게 덮고, 그 속에서 무대를 갈아 끼우고, 걷히며 새 무대를 드러낸다.
   *
   * 무대에 선 사람은 흰 막이 다 덮은 뒤에 치운다. 막보다 먼저 치우면 사람이 사라지는 것이
   * 폭파보다 먼저 보인다.
   */
  private async explode(backdrop?: DialogueBackdrop): Promise<void> {
    const spec = DIALOGUE_CUES.explosion;
    this.shake(spec.shakeMs, spec.shakeIntensity);
    this.burstShards();
    const reduce = settingsManager.get().accessibility.reduceFlashes;
    const veil = this.scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, reduce ? 0x2a1712 : 0xffffff, 0)
      .setDepth(DEPTH.flash);
    await this.tweenTo(veil, { fillAlpha: 1 }, DIALOGUE_EXPLOSION.whiteInMs, "Quad.Out");
    if (this.terminated) return;
    this.stopAlarm();
    for (const member of [...this.members.values()]) {
      this.members.delete(member.id);
      member.act?.stop();
      member.creature.destroy();
    }
    this.cast = [];
    if (backdrop) this.setBackdrop(backdrop);
    await this.wait(DIALOGUE_EXPLOSION.holdMs);
    if (this.terminated) return;
    this.scene.tweens.add({
      targets: veil,
      fillAlpha: 0,
      duration: DIALOGUE_EXPLOSION.whiteOutMs,
      ease: "Sine.InOut",
      onComplete: () => veil.destroy(),
    });
  }

  /** 가운데에서 사방으로 튀는 마름모 파편. 흰 막보다 위에 그려 폭파의 첫 순간을 말한다. */
  private burstShards(): void {
    const cx = BASE_WIDTH / 2;
    const cy = 720;
    const distance = DIALOGUE_EXPLOSION.shardDistance * this.distanceFactor();
    for (const { angle, scale } of explosionShards()) {
      const shard = this.scene.add.graphics({ x: cx, y: cy }).setDepth(DEPTH.flash + 1).setBlendMode(Phaser.BlendModes.ADD);
      // 좌우 꼭짓점 높이를 어긋나게 깎은 납작한 마름모. 반듯한 대칭은 보석처럼 보인다.
      shard.fillStyle(0xffe2b8, 0.95);
      shard.fillPoints([
        new Phaser.Math.Vector2(0, -30 * scale),
        new Phaser.Math.Vector2(64 * scale, -4 * scale),
        new Phaser.Math.Vector2(0, 26 * scale),
        new Phaser.Math.Vector2(-58 * scale, 6 * scale),
      ], true);
      const rad = Phaser.Math.DegToRad(angle);
      shard.setRotation(rad);
      this.scene.tweens.add({
        targets: shard,
        x: cx + Math.cos(rad) * distance * (0.6 + scale * 0.4),
        y: cy + Math.sin(rad) * distance * (0.6 + scale * 0.4),
        alpha: 0,
        duration: DIALOGUE_EXPLOSION.shardMs,
        ease: "Cubic.Out",
        onComplete: () => shard.destroy(),
      });
    }
  }

  private distanceFactor(): number {
    return motionPolicy(settingsManager.get()).nonEssentialDistanceFactor;
  }

  private tweenTo(target: object, props: Record<string, number>, duration: number, ease: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.terminated) { resolve(); return; }
      this.scene.tweens.add({ targets: target, ...props, duration, ease, onComplete: () => resolve(), onStop: () => resolve() });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.terminated) { resolve(); return; }
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }

  /** 씬이 닫히면 스탠딩과 마스크를 함께 놓는다. 늦게 도착하는 스탠딩은 위 검사가 버린다. */
  private terminate(): void {
    this.terminated = true;
    this.alarm = undefined;
    for (const member of this.members.values()) member.creature.destroy();
    this.members.clear();
    this.mask.destroy();
    this.maskGraphics.destroy();
  }
}
