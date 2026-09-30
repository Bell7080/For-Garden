import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { motionPolicy } from "../core/settings";
import { t } from "../i18n";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { battleAssetFor, playMotion, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { addPopupBackgroundImage } from "./backgrounds";
import { EFFECT_TEXTURE, ensureEffectTextures } from "./effectTextures";
import { chipPoints, drawFrameVignette, drawLayer } from "./holo";
import type { RewardPopupItem } from "./rewardPopupModel";
import { addSdFootShadow } from "./SdFootShadow";
import { addSectionTitle } from "./SectionTitle";
import { loadOwnedPuppet } from "./statusPuppetLoad";
import { COLOR, textStyle } from "./theme";
import {
  SWEEP_SKIRMISH, sweepBandSlab, sweepLootArc, sweepLootPoint, sweepSkirmishDurationMs, sweepSkirmishTimeline,
  type SweepSkirmishAttacker,
} from "./sweepSkirmishLayout";

export interface SweepSkirmishOptions {
  /** 싸우는 애착 렐릭. */
  heroId: string;
  /** 그 단계의 대표 적. */
  enemyId: string;
  /** 배율(×N) — 띠 오른쪽 위에 선다. */
  count: number;
  /** 그 콘텐츠가 싸우는 전장 원화(`battleFieldBackground`). 띠 안에 깔린다. */
  fieldKey: string;
  depth: number;
}

export interface SweepSkirmishHandle {
  /** 연출이 끝나(또는 눌러 건너뛰어) 띠가 다 걷힌 순간. */
  done: Promise<void>;
  /**
   * 서버가 확정한 보상. 받은 뒤의 타격부터 그 아이콘이 곡사로 튀어나온다 — 연출은 결과를 정하지
   * 않고, 이미 확정된 것을 **줍는 모습**으로만 보여 준다.
   */
  setRewards(items: readonly RewardPopupItem[]): void;
  /** 서버가 거절했을 때처럼 곧바로 걷어 낸다. */
  close(): void;
}

/**
 * **소탕 연출** — 영수증 앞에 그 콘텐츠의 전장을 깐 띠 한 장이 스윽 올라와, 애착 렐릭이 대표 적과
 * 주고받다가 먼지구름 속에서 투닥투닥 엉기고, 마지막 한 방에 적이 날아가 별이 된 뒤 뿅뿅 뛰고,
 * 맞을 때마다 튀어나온 보상이 스르륵 모이며 띠가 걷힌다. 자리와 박자는 `SWEEP_SKIRMISH` 한 표가 갖는다.
 *
 * 연출은 결과를 정하지 않는다 — 소탕은 이미 서버가 확정하며 그 응답과 **나란히** 돈다. 화면을 누르면
 * 곧바로 걷히고, SD가 늦으면 기다리지 않고 불꽃만으로 박자를 친다. 움직임 줄이기에서는 내딛지도,
 * 날아가지도, 뛰지도 않고 보상도 떨어질 자리에 곧바로 선다.
 */
export function playSweepSkirmish(scene: Phaser.Scene, options: SweepSkirmishOptions): SweepSkirmishHandle {
  const L = SWEEP_SKIRMISH;
  const timeline = sweepSkirmishTimeline();
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;
  ensureEffectTextures(scene);
  const cx = BASE_WIDTH / 2;
  const cy = BASE_HEIGHT / 2;
  const root = scene.add.container(cx, cy).setDepth(options.depth);
  // SD는 화면 좌표로 세운다 — 띠가 움직이는 동안에도 발밑이 어긋나지 않게 띠가 선 뒤에 들어온다.
  const puppetLayer = scene.add.container(0, 0).setDepth(options.depth + 1);
  // 먼지·불꽃·전리품은 SD 위에 선다. 구름이 두 몸을 덮어야 「엉겨 있다」가 읽힌다.
  const fxLayer = scene.add.container(0, 0).setDepth(options.depth + 2);
  let resolve!: () => void;
  const done = new Promise<void>((settle) => { resolve = settle; });
  let finished = false;

  // 뒤를 누르고 손을 받는다 — 누르면 건너뛴다.
  const dim = scene.add.rectangle(0, 0, BASE_WIDTH + 400, BASE_HEIGHT + 400, COLOR.void, L.dimAlpha).setInteractive();
  root.add(dim);

  const band = scene.add.container(0, still ? 0 : 70).setAlpha(0);
  root.add(band);
  const { width, height, bevel } = L.band;
  const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  band.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d1118, alpha: 0.96 }));
  // 그 콘텐츠의 전장 — 원화는 도착하는 대로 그려지고, 띠의 실루엣대로 잘린다. 마스크는 띠와 같은 목숨이다.
  const field = addPopupBackgroundImage(scene, band, options.fieldKey, { x: 0, y: 0, width, height, maskShape: shape, overlayStrength: L.fieldOverlay });
  band.once(Phaser.GameObjects.Events.DESTROY, () => field.destroy());
  // 지층 — 원화가 비치도록 옅게, 발밑만 조금 짙게. 층마다 띠의 빗변을 따라 자른다.
  let top = -height / 2;
  for (const layer of L.strata) {
    const bottom = top + height * layer.ratio;
    // 층마다 그림자를 끈다 — `drawLayer`의 기본 그림자가 원화 **위에** 한 겹씩 더 깔려 전장이 탁해졌다.
    band.add(drawLayer(scene, 0, 0, sweepBandSlab(top, bottom), { fill: layer.color, alpha: layer.alpha, shadow: false }));
    top = bottom;
  }
  // 땅 선 — 발이 서는 자리를 한 줄로 알린다.
  band.add(scene.add.rectangle(0, L.groundY, width - bevel * 2, 3, COLOR.accent, 0.35));
  band.add(drawFrameVignette(scene, 0, 0, width, height, { strength: L.vignette }));
  // 윗변 선만 긋는 층이다. 그림자는 맨 아래 판이 이미 원화 **뒤에** 깔고 있으므로 여기서는 끈다.
  band.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: 0, edge: COLOR.accent, edgeAlpha: 0.9, edgeWidth: 4, shadow: false }));
  addSectionTitle(scene, -width / 2 + 24, -height / 2 - 4, t("dungeon.sweep"), { parent: band });
  band.add(scene.add.text(L.count.x, L.count.y, t("dungeon.sweep.count", { count: options.count }), textStyle({ role: "display", size: L.count.size, color: COLOR.accentText }))
    .setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true));

  const groundY = cy + L.groundY;
  const spots: Record<SweepSkirmishAttacker, number> = { hero: cx + L.hero.x, enemy: cx + L.enemy.x };
  const puppets: Partial<Record<SweepSkirmishAttacker, PuppetCreature>> = {};
  const shadows: Record<SweepSkirmishAttacker, Phaser.GameObjects.Container> = {
    hero: addSdFootShadow(scene, spots.hero, groundY + 6, 170, puppetLayer),
    enemy: addSdFootShadow(scene, spots.enemy, groundY + 6, 170, puppetLayer),
  };
  Object.values(shadows).forEach((shadow) => shadow.setAlpha(0));
  const spawn = (side: SweepSkirmishAttacker, relicId: string): Promise<unknown> => loadOwnedPuppet({
    spawn: () => spawnPuppet(scene, side === "hero" ? relicAppearanceManager.sdAssetFor(relicId) : battleAssetFor(relicId), {
      x: spots[side], groundY, height: L.sdHeight, flipX: side === "enemy",
    }),
    isCurrent: () => !finished && puppetLayer.active,
    isDisplayable: (puppet) => Boolean(puppet.active),
    adopt: (puppet) => {
      puppet.disableInteractive();
      puppet.setAlpha(0);
      puppetLayer.add(puppet);
      puppets[side] = puppet;
      scene.tweens.add({ targets: puppet, alpha: 1, duration: 200 });
    },
  });
  const arrived = Promise.all([spawn("hero", options.heroId), spawn("enemy", options.enemyId)]);

  /** 좌우 높이를 어긋나게 깎은 납작한 마름모 — 동그라미를 쓰지 않는다. */
  const diamondPoints = (size: number): Phaser.Geom.Point[] => [
    new Phaser.Geom.Point(0, -size * 0.34), new Phaser.Geom.Point(size * 0.5, -size * 0.04),
    new Phaser.Geom.Point(0, size * 0.3), new Phaser.Geom.Point(-size * 0.5, size * 0.06),
  ];

  const spark = (x: number, y: number, color: number, scale: number): void => {
    if (!fxLayer.active) return;
    const diamond = scene.add.graphics({ x, y });
    diamond.fillStyle(color, 0.85).fillPoints(diamondPoints(L.spark.size * scale), true);
    diamond.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4);
    fxLayer.add(diamond);
    scene.tweens.add({ targets: diamond, scale: 1.2, alpha: 0, duration: L.spark.ms, ease: "Cubic.Out", onComplete: () => diamond.destroy() });
  };

  /** 흙먼지 한 뭉치 — 옆으로 눌린 부드러운 덩어리가 부풀며 떠올라 사라진다. */
  const dust = (x: number, y: number, scale: number, drift = 0): void => {
    if (!fxLayer.active) return;
    const puff = scene.add.image(x, y, EFFECT_TEXTURE.glow).setTint(L.dust.color).setAlpha(L.dust.alpha);
    const base = (L.dust.size * scale) / 256;
    puff.setScale(base * 0.5, base * 0.32);
    fxLayer.add(puff);
    scene.tweens.add({
      targets: puff, scaleX: base * 1.3, scaleY: base * 0.8, x: x + drift, y: y - L.dust.rise * scale, alpha: 0,
      duration: L.dust.ms, ease: "Quad.Out", onComplete: () => puff.destroy(),
    });
  };

  // ── 전리품: 맞을 때마다 곡사로 튀어나와 바닥에 떨어진다. 떨어진 것은 정산 때 한가운데로 모인다.
  let rewardKeys: string[] = [];
  let lootIndex = 0;
  const landed: Phaser.GameObjects.Image[] = [];
  const lootFrom = (fromX: number, fromY: number, pieces: number): void => {
    if (!rewardKeys.length || !fxLayer.active) return;
    for (let piece = 0; piece < pieces && lootIndex < L.loot.maxPieces; piece += 1) {
      const index = lootIndex++;
      const key = rewardKeys[index % rewardKeys.length]!;
      const arc = sweepLootArc(index, fromX - cx);
      const size = arc.big ? L.loot.big : L.loot.small;
      const icon = scene.add.image(fromX, fromY, key);
      icon.setScale(size / Math.max(icon.width, icon.height, 1)).setAlpha(0);
      const scale = icon.scaleX;
      fxLayer.add(icon);
      landed.push(icon);
      const landX = cx + arc.landX;
      const landY = cy + arc.landY;
      if (still) { icon.setPosition(landX, landY).setAlpha(1); continue; }
      const from = { x: fromX - cx, y: fromY - cy };
      const flight = { t: 0 };
      scene.tweens.add({
        targets: flight, t: 1, duration: L.loot.flightMs, delay: arc.delayMs, ease: "Linear",
        onStart: () => icon.setAlpha(1).setScale(scale * 0.6),
        onUpdate: () => {
          if (!icon.active) return;
          const point = sweepLootPoint(from.x, from.y, arc, flight.t);
          icon.setPosition(cx + point.x, cy + point.y).setRotation(arc.spin * flight.t).setScale(scale * (0.6 + 0.4 * flight.t));
        },
        onComplete: () => {
          if (!icon.active) return;
          icon.setRotation(0);
          // 톡 — 한 번 튀고 선다.
          scene.tweens.add({ targets: icon, y: landY - L.loot.bounce, duration: 110, yoyo: true, ease: "Quad.Out" });
          dust(landX, landY + 10, 0.35);
        },
      });
    }
  };

  const hopTo = (puppet: PuppetCreature, x: number, ms: number, hop: number): void => {
    // 내딛는 발걸음은 가로로 가고, 몸은 폴짝 떴다가 내려앉는다 — 두 트윈을 따로 건다.
    scene.tweens.add({ targets: puppet, x, duration: ms, ease: "Quad.Out" });
    if (hop > 0) scene.tweens.add({ targets: puppet, y: groundY - hop, duration: ms / 2, yoyo: true, ease: "Quad.Out" });
  };

  const strike = (attacker: SweepSkirmishAttacker, finisher: boolean): void => {
    if (finished) return;
    const target: SweepSkirmishAttacker = attacker === "hero" ? "enemy" : "hero";
    const hitter = puppets[attacker];
    const struck = puppets[target];
    const direction = attacker === "hero" ? 1 : -1;
    if (hitter?.active) {
      playMotion(scene, hitter, "attack", 1.6);
      if (!still) {
        scene.tweens.add({ targets: hitter, x: spots[attacker] + direction * L.lunge.distance, duration: L.lunge.ms, yoyo: true, ease: "Quad.Out" });
        scene.tweens.add({ targets: hitter, y: groundY - L.lunge.hop, duration: L.lunge.ms / 2, yoyo: true, ease: "Quad.Out" });
        dust(spots[attacker], groundY, 0.5, -direction * 30);
      }
    }
    const hitX = spots[target] - direction * 30;
    const hitY = groundY - L.sdHeight * 0.45;
    scene.time.delayedCall(still ? 0 : L.lunge.ms * 0.8, () => {
      if (finished) return;
      spark(hitX, hitY, attacker === "hero" ? COLOR.accent : COLOR.danger, finisher ? 1.8 : 1);
      dust(spots[target], groundY, finisher ? 1 : 0.6, direction * 40);
      if (attacker === "hero") lootFrom(hitX, hitY, finisher ? L.loot.finisher : L.loot.perHit);
      if (finisher) { blastOff(); return; }
      if (!struck?.active) return;
      playMotion(scene, struck, "hit");
      if (!still) scene.tweens.add({ targets: struck, x: spots[target] + direction * 18, duration: 60, yoyo: true });
    });
  };

  /** 먼지구름 속 투닥투닥 — 두 몸이 가운데로 모여 부들부들 엉기고, 구름 둘레로 불꽃이 톡톡 튄다. */
  const scuffle = (): void => {
    if (finished) return;
    const centerX = cx;
    const cloudY = groundY - L.sdHeight * 0.4;
    const { ms, gap, puffs, cloudWidth, cloudHeight, jitter } = L.scuffle;
    for (const side of ["hero", "enemy"] as const) {
      const puppet = puppets[side];
      const toX = centerX + (side === "hero" ? -gap : gap);
      if (puppet?.active && !still) {
        hopTo(puppet, toX, 180, L.lunge.hop);
        // 엉겨 있는 동안 부들부들 — 제자리 둘레로 잘게 흔들린다.
        scene.tweens.add({ targets: puppet, x: toX + (side === "hero" ? jitter : -jitter), duration: 70, yoyo: true, repeat: Math.floor((ms - 260) / 140), delay: 190 });
        scene.time.delayedCall(ms - 40, () => { if (puppet.active && !finished) hopTo(puppet, spots[side], 200, L.lunge.hop * 1.4); });
      }
      // 그림자는 몸을 따라 가운데로 갔다가 튕겨 나올 때 함께 돌아온다.
      if (!still) scene.tweens.add({ targets: shadows[side], x: toX, duration: 180, yoyo: true, hold: ms - 400 });
    }
    // 구름: 옆으로 눌린 뭉치 여럿이 가운데를 둘러 부풀었다 줄었다 한다.
    const cloud = scene.add.container(centerX, cloudY).setAlpha(0);
    fxLayer.add(cloud);
    for (let index = 0; index < puffs; index += 1) {
      const angle = (index / puffs) * Math.PI * 2;
      const puff = scene.add.image(Math.cos(angle) * cloudWidth * 0.32, Math.sin(angle) * cloudHeight * 0.3, EFFECT_TEXTURE.glow)
        .setTint(L.dust.color).setAlpha(0.8);
      const base = (cloudWidth * 0.55) / 256;
      puff.setScale(base, base * 0.62);
      cloud.add(puff);
      scene.tweens.add({ targets: puff, scaleX: base * 1.18, scaleY: base * 0.74, duration: 150 + (index % 3) * 40, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    scene.tweens.add({ targets: cloud, alpha: 0.92, duration: 160 });
    scene.time.delayedCall(ms - 120, () => {
      if (!cloud.active) return;
      scene.tweens.add({ targets: cloud, alpha: 0, scale: 1.3, duration: 220, onComplete: () => cloud.destroy() });
      dust(centerX - 60, groundY, 0.9, -60);
      dust(centerX + 60, groundY, 0.9, 60);
    });
    // 속에서 누가 누구를 치는지는 안 보인다 — 번갈아 튀는 불꽃과 흔들림이 「투닥투닥」을 말한다.
    timeline.scuffle.pops.forEach((at, index) => {
      scene.time.delayedCall(at - timeline.scuffle.startMs, () => {
        if (finished) return;
        const side = index % 2 === 0 ? 1 : -1;
        const x = centerX + side * (cloudWidth * 0.28 + (index % 3) * 14);
        const y = cloudY - cloudHeight * 0.3 + (index % 4) * 26;
        spark(x, y, index % 2 === 0 ? COLOR.accent : 0xfff4d6, 0.7);
        const hitter = puppets[index % 2 === 0 ? "hero" : "enemy"];
        if (hitter?.active) playMotion(scene, hitter, "attack", 2);
        if (index % 2 === 0) lootFrom(x, y, L.loot.perPop);
      });
    });
  };

  /** 마지막 한 방 — 적이 빙글빙글 날아가 띠 위 하늘에서 별이 된다. */
  const blastOff = (): void => {
    const enemy = puppets.enemy;
    const toX = cx + L.blastOff.toX;
    const toY = cy + L.blastOff.toY;
    scene.tweens.add({ targets: shadows.enemy, alpha: 0, duration: 200 });
    if (!still) scene.cameras.main.shake(160, 0.005);
    if (enemy?.active) {
      playMotion(scene, enemy, "hit");
      if (still) scene.tweens.add({ targets: enemy, alpha: 0, duration: 260 });
      else {
        enemy.setAnimationFrozen(true);
        scene.tweens.add({
          targets: enemy, x: toX, y: toY, rotation: Math.PI * 2 * L.blastOff.spins, scale: enemy.scaleX * L.blastOff.endScale,
          duration: L.blastOff.flyMs, ease: "Cubic.Out",
        });
      }
    }
    scene.time.delayedCall(still ? 0 : L.blastOff.flyMs, () => {
      if (finished) return;
      if (enemy?.active) enemy.setVisible(false);
      twinkle(still ? spots.enemy : toX, still ? groundY - L.sdHeight * 0.6 : toY);
    });
  };

  const twinkle = (x: number, y: number): void => {
    if (!fxLayer.active) return;
    const size = L.blastOff.twinkleSize;
    const star = scene.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD);
    star.fillStyle(0xfff4d6, 1).fillPoints([
      new Phaser.Geom.Point(0, -size), new Phaser.Geom.Point(size * 0.34, -size * 0.06),
      new Phaser.Geom.Point(0, size * 0.9), new Phaser.Geom.Point(-size * 0.3, size * 0.04),
    ], true);
    star.setScale(0.2);
    fxLayer.add(star);
    scene.tweens.chain({
      targets: star,
      tweens: [
        { scale: 1, rotation: 0.4, duration: L.blastOff.twinkleMs * 0.4, ease: "Back.Out" },
        { scale: 0.1, alpha: 0, duration: L.blastOff.twinkleMs * 0.6, ease: "Quad.In" },
      ],
      onComplete: () => star.destroy(),
    });
  };

  /** 이기고 뿅뿅 — 제자리에서 세 번 뛰고, 내려앉을 때마다 먼지가 톡. */
  const victory = (): void => {
    const hero = puppets.hero;
    if (!hero?.active || still || finished) return;
    const { hops, hopMs, height: hopHeight } = L.victory;
    for (let hop = 0; hop < hops; hop += 1) {
      scene.time.delayedCall(hop * hopMs, () => {
        if (finished || !hero.active) return;
        playMotion(scene, hero, "attack", 2);
        scene.tweens.add({ targets: hero, y: groundY - hopHeight, duration: hopMs / 2, yoyo: true, ease: "Quad.Out" });
        // 뜬 만큼 발밑 그림자가 작아진다 — 몸이 정말 떠올랐다는 것을 바닥이 말한다.
        scene.tweens.add({ targets: shadows.hero, scale: 0.7, duration: hopMs / 2, yoyo: true, ease: "Quad.Out" });
        scene.time.delayedCall(hopMs, () => { if (!finished) dust(spots.hero, groundY, 0.45); });
      });
    }
  };

  /** 정산 — 바닥의 보상이 한 조각씩 어긋나 띠 가운데 위로 스르륵 모여 사라진다. */
  const settle = (): void => {
    const toX = cx;
    const toY = cy + L.settle.toY;
    landed.forEach((icon, index) => {
      if (!icon.active) return;
      scene.tweens.add({
        targets: icon, x: toX, y: toY, scale: icon.scaleX * 0.3, alpha: 0,
        duration: still ? 0 : L.settle.ms, delay: still ? 0 : index * L.settle.staggerMs, ease: "Cubic.In",
      });
    });
    if (landed.length && !still) scene.time.delayedCall(L.settle.ms, () => spark(toX, toY, COLOR.accent, 1.4));
  };

  // 수명은 씬 시계가 아니라 실제 시간이 지킨다 — 씬 타이머·트윈은 프레임이 돌아야 깨어나므로, 바쁜
  // 기기에서 박자가 밀려도 영수증이 연출에 붙잡히지 않는다(연출 자체는 씬 시계로 돈다).
  const timers: number[] = [];
  const later = (ms: number, run: () => void): void => { timers.push(window.setTimeout(run, ms)); };
  const teardown = (): void => {
    timers.forEach((id) => window.clearTimeout(id));
    if (!root.active) return;
    root.destroy();
    puppetLayer.destroy();
    fxLayer.destroy();
    resolve();
  };
  const finish = (): void => {
    if (finished) return;
    finished = true;
    scene.tweens.add({ targets: [root, puppetLayer, fxLayer], alpha: 0, duration: still ? 0 : L.exitMs, onComplete: teardown });
    later((still ? 0 : L.exitMs) + 120, teardown);
  };
  later(sweepSkirmishDurationMs() + L.spawnWaitMs, finish);
  dim.on(Phaser.Input.Events.POINTER_UP, finish);

  // 띠가 올라온다 → (SD가 서거나 기다림이 다하면) 시간표대로 돈다 → 정산이 끝나면 걷힌다.
  scene.tweens.add({ targets: band, y: 0, alpha: 1, duration: still ? 0 : L.enterMs, ease: "Cubic.Out" });
  const wait = new Promise<void>((settle) => later(L.spawnWaitMs, settle));
  void Promise.race([arrived.then(() => undefined), wait]).then(() => {
    if (finished) return;
    Object.values(shadows).forEach((shadow) => scene.tweens.add({ targets: shadow, alpha: 1, duration: 160 }));
    const at = (ms: number, run: () => void): void => { scene.time.delayedCall(L.settleMs + ms, run); };
    timeline.beats.forEach((beat) => at(beat.atMs, () => strike(beat.attacker, beat.finisher)));
    at(timeline.scuffle.startMs, scuffle);
    at(timeline.victory.startMs, victory);
    at(timeline.settle.startMs, settle);
    at(timeline.endMs, finish);
  });

  return {
    done,
    setRewards: (items) => {
      rewardKeys = items.flatMap((item) => typeof item.icon === "string" && scene.textures.exists(item.icon) ? [item.icon] : []);
    },
    close: () => { finished = true; teardown(); },
  };
}
