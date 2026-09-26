import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { motionPolicy } from "../core/settings";
import { t } from "../i18n";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { battleAssetFor, playMotion, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { chipPoints, drawFrameVignette, drawLayer } from "./holo";
import { addSdFootShadow } from "./SdFootShadow";
import { addSectionTitle } from "./SectionTitle";
import { loadOwnedPuppet } from "./statusPuppetLoad";
import { COLOR, textStyle } from "./theme";
import { SWEEP_SKIRMISH, sweepBandSlab, sweepSkirmishBeats, sweepSkirmishDurationMs, type SweepSkirmishAttacker } from "./sweepSkirmishLayout";

export interface SweepSkirmishOptions {
  /** 싸우는 애착 렐릭. */
  heroId: string;
  /** 그 단계의 대표 적. */
  enemyId: string;
  /** 배율(×N) — 띠 오른쪽 위에 선다. */
  count: number;
  depth: number;
}

export interface SweepSkirmishHandle {
  /** 연출이 끝나(또는 눌러 건너뛰어) 띠가 다 걷힌 순간. */
  done: Promise<void>;
  /** 서버가 거절했을 때처럼 곧바로 걷어 낸다. */
  close(): void;
}

/**
 * **소탕 연출** — 영수증 앞에 지층 띠 한 장이 스윽 올라와, 애착 렐릭이 그 단계의 적과 투다다닥
 * 주고받은 뒤 마지막 한 방에 적이 쓰러지고 띠가 걷힌다. 자리와 박자는 `SWEEP_SKIRMISH` 한 표가 갖는다.
 *
 * 연출은 결과를 정하지 않는다 — 소탕은 이미 서버가 확정하며 그 응답과 **나란히** 돈다. 화면을 누르면
 * 곧바로 걷히고, SD가 늦으면 기다리지 않고 불꽃만으로 박자를 친다. 움직임 줄이기에서는 내딛지 않는다.
 */
export function playSweepSkirmish(scene: Phaser.Scene, options: SweepSkirmishOptions): SweepSkirmishHandle {
  const L = SWEEP_SKIRMISH;
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;
  const cx = BASE_WIDTH / 2;
  const cy = BASE_HEIGHT / 2;
  const root = scene.add.container(cx, cy).setDepth(options.depth);
  // SD는 화면 좌표로 세운다 — 띠가 움직이는 동안에도 발밑이 어긋나지 않게 띠가 선 뒤에 들어온다.
  const puppetLayer = scene.add.container(0, 0).setDepth(options.depth + 1);
  let resolve!: () => void;
  const done = new Promise<void>((settle) => { resolve = settle; });
  let finished = false;

  // 뒤를 누르고 손을 받는다 — 누르면 건너뛴다.
  const dim = scene.add.rectangle(0, 0, BASE_WIDTH + 400, BASE_HEIGHT + 400, COLOR.void, 0.7).setInteractive();
  root.add(dim);

  const band = scene.add.container(0, still ? 0 : 70).setAlpha(0);
  root.add(band);
  const { width, height, bevel } = L.band;
  const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  band.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d1118, alpha: 0.96 }));
  // 지층 — 위는 어두운 하늘, 아래로 흙빛 층이 겹친다. 층마다 띠의 빗변을 따라 자른다.
  let top = -height / 2;
  for (const layer of L.strata) {
    const bottom = top + height * layer.ratio;
    band.add(drawLayer(scene, 0, 0, sweepBandSlab(top, bottom), { fill: layer.color, alpha: layer.alpha }));
    top = bottom;
  }
  // 땅 선 — 발이 서는 자리를 한 줄로 알린다.
  band.add(scene.add.rectangle(0, L.groundY, width - bevel * 2, 3, COLOR.accent, 0.35));
  band.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.55 }));
  band.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: 0, edge: COLOR.accent, edgeAlpha: 0.9, edgeWidth: 4 }));
  addSectionTitle(scene, -width / 2 + 24, -height / 2 - 4, t("dungeon.sweep"), { parent: band });
  band.add(scene.add.text(L.count.x, L.count.y, t("dungeon.sweep.count", { count: options.count }), textStyle({ role: "display", size: L.count.size, color: COLOR.accentText }))
    .setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true));

  const groundY = cy + L.groundY;
  const spots: Record<SweepSkirmishAttacker, number> = { hero: cx + L.hero.x, enemy: cx + L.enemy.x };
  const puppets: Partial<Record<SweepSkirmishAttacker, PuppetCreature>> = {};
  const shadows = [addSdFootShadow(scene, spots.hero, groundY + 6, 170, puppetLayer), addSdFootShadow(scene, spots.enemy, groundY + 6, 170, puppetLayer)];
  shadows.forEach((shadow) => shadow.setAlpha(0));
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

  const spark = (x: number, y: number, color: number, big: boolean): void => {
    const size = L.spark.size * (big ? 1.7 : 1);
    const diamond = scene.add.graphics({ x, y });
    // 동그라미가 아니라 좌우 높이를 어긋나게 깎은 납작한 마름모다.
    diamond.fillStyle(color, 0.85).fillPoints([
      new Phaser.Geom.Point(0, -size * 0.34), new Phaser.Geom.Point(size * 0.5, -size * 0.04),
      new Phaser.Geom.Point(0, size * 0.3), new Phaser.Geom.Point(-size * 0.5, size * 0.06),
    ], true);
    diamond.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4);
    puppetLayer.add(diamond);
    scene.tweens.add({ targets: diamond, scale: big ? 1.5 : 1.1, alpha: 0, duration: L.spark.ms, ease: "Cubic.Out", onComplete: () => diamond.destroy() });
  };

  const strike = (attacker: SweepSkirmishAttacker, finisher: boolean): void => {
    if (finished) return;
    const target: SweepSkirmishAttacker = attacker === "hero" ? "enemy" : "hero";
    const hitter = puppets[attacker];
    const struck = puppets[target];
    const direction = attacker === "hero" ? 1 : -1;
    if (hitter?.active) {
      playMotion(scene, hitter, "attack", 1.6);
      if (!still) scene.tweens.add({ targets: hitter, x: spots[attacker] + direction * L.lunge.distance, duration: L.lunge.ms, yoyo: true, ease: "Quad.Out" });
    }
    const hitX = spots[target] - direction * 30;
    scene.time.delayedCall(still ? 0 : L.lunge.ms * 0.8, () => {
      if (finished) return;
      spark(hitX, groundY - L.sdHeight * 0.45, attacker === "hero" ? COLOR.accent : COLOR.danger, finisher);
      if (!struck?.active) return;
      if (finisher) {
        playMotion(scene, struck, "down");
        if (!still) scene.tweens.add({ targets: struck, x: spots[target] + direction * 60, alpha: 0.35, duration: 320, ease: "Cubic.Out" });
        if (!still) scene.cameras.main.shake(140, 0.004);
      } else {
        playMotion(scene, struck, "hit");
        if (!still) scene.tweens.add({ targets: struck, x: spots[target] + direction * 16, duration: 60, yoyo: true });
      }
    });
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
    resolve();
  };
  const finish = (): void => {
    if (finished) return;
    finished = true;
    scene.tweens.add({ targets: [root, puppetLayer], alpha: 0, duration: still ? 0 : L.exitMs, onComplete: teardown });
    later((still ? 0 : L.exitMs) + 120, teardown);
  };
  later(sweepSkirmishDurationMs() + L.spawnWaitMs, finish);
  dim.on(Phaser.Input.Events.POINTER_UP, finish);

  // 띠가 올라온다 → (SD가 서거나 기다림이 다하면) 박자를 친다 → 쓰러지고 잠시 뒤 걷힌다.
  scene.tweens.add({ targets: band, y: 0, alpha: 1, duration: still ? 0 : L.enterMs, ease: "Cubic.Out" });
  const wait = new Promise<void>((settle) => later(L.spawnWaitMs, settle));
  void Promise.race([arrived.then(() => undefined), wait]).then(() => {
    if (finished) return;
    shadows.forEach((shadow) => scene.tweens.add({ targets: shadow, alpha: 1, duration: 160 }));
    const beats = sweepSkirmishBeats();
    beats.forEach((beat) => scene.time.delayedCall(L.settleMs + beat.atMs, () => strike(beat.attacker, beat.finisher)));
    const last = beats[beats.length - 1]?.atMs ?? 0;
    scene.time.delayedCall(L.settleMs + last + L.afterMs, finish);
  });

  return { done, close: () => { finished = true; teardown(); } };
}
