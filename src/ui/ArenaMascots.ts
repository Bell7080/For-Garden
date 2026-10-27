import Phaser from 'phaser';
import { spawnPuppet, sdAssetFor } from '../puppets/assets';
import { session } from '../state/session';
import { textStyle } from './theme';
import { ARENA_TONE } from './arenaTheme';

/** 한 번 맞부딪히는 박자(ms). 물러섰다가 → 달려들고 → 부딪혀 멈췄다가 → 제자리로. */
const CLASH_PERIOD = 1700;
const WIND_END = 0.5;
const HIT_AT = 0.62;
const HOLD_END = 0.78;

export interface ArenaClashOptions {
  /** 그림 전체를 가두는 마스크(로비 입구 칩). 없으면 화면에 그대로 선다. */
  mask?: Phaser.Display.Masks.GeometryMask;
  /** 두 몸 사이 거리 배율(1 = 키의 절반씩). */
  spread?: number;
  /** 가운데 VS 문장을 세우는가. */
  vs?: boolean;
}

/** 한 박자 안에서 각 몸이 가운데로 나아간 몫(-: 물러섬, +: 달려듦)과 부딪힘 세기(0~1). */
export function arenaClashPose(phase: number): { push: number; impact: number; lean: number } {
  if (phase < WIND_END) {
    const k = Math.sin((phase / WIND_END) * Math.PI / 2);
    return { push: -0.14 * k, impact: 0, lean: -4 * k };
  }
  if (phase < HIT_AT) {
    const k = (phase - WIND_END) / (HIT_AT - WIND_END);
    return { push: -0.14 + 0.28 * k * k, impact: 0, lean: -4 + 14 * k };
  }
  if (phase < HOLD_END) {
    const k = (phase - HIT_AT) / (HOLD_END - HIT_AT);
    // 부딪힌 순간 살짝 튕겨 나온다.
    return { push: 0.14 - 0.04 * Math.sin(k * Math.PI), impact: 1 - k, lean: 10 - 4 * k };
  }
  const k = (phase - HOLD_END) / (1 - HOLD_END);
  return { push: 0.1 * (1 - k), impact: 0, lean: 6 * (1 - k) };
}

/**
 * 렉시아 VS 스피나 — 아레나의 얼굴.
 *
 * 두 SD가 마주 보고 물러섰다가 가운데로 달려들어 부딪히고, 그 자리에서 분홍·보라 섬광과 VS가 터진다.
 * 그림은 담는 판(`owner`)이 소유한다 — 판이 닫히면 늦게 도착한 SD도 남지 않는다.
 * 움직임 줄이기에서는 맞댄 자세로 멈춘 채 선다.
 */
export function addArenaMascots(scene: Phaser.Scene, owner: Phaser.GameObjects.Container, x: number, y: number, height: number, clash = true, depth = 2100, options: ArenaClashOptions = {}): void {
  let alive = true;
  const reduce = session.settings.accessibility.reduceMotion;
  const bodies: Awaited<ReturnType<typeof spawnPuppet>>[] = [];
  const gap = height * 0.5 * (options.spread ?? 1);
  const back = scene.add.graphics();
  const burst = scene.add.graphics();
  const vs = options.vs === false ? undefined : scene.add.text(x, y - height * 0.5, 'VS', textStyle({ role: "display", size: Math.round(height * 0.32), color: '#ffffff' }))
    .setOrigin(0.5).setStroke('#2a0f4d', Math.round(height * 0.05)).setShadow(0, 6, '#000000', 0, true, true);
  owner.add([back, burst, ...(vs ? [vs] : [])]);
  if (options.mask) { back.setMask(options.mask); burst.setMask(options.mask); vs?.setMask(options.mask); }
  let elapsed = 0;
  const draw = (pose: ReturnType<typeof arenaClashPose>): void => {
    back.clear();
    // 각자의 등 뒤로 흐르는 속도선. 달려드는 동안 길어진다.
    const run = Math.max(0, pose.push + 0.14) / 0.28;
    [-1, 1].forEach((sideSign) => {
      const color = sideSign < 0 ? ARENA_TONE.glow : ARENA_TONE.spark;
      for (let i = 0; i < 4; i += 1) {
        const ly = y - height * (0.2 + i * 0.16);
        const start = x + sideSign * (gap - height * pose.push + height * 0.18);
        const length = height * (0.25 + 0.35 * run) * (1 - i * 0.12);
        back.fillStyle(color, 0.18 + 0.32 * run);
        back.fillPoints([
          new Phaser.Geom.Point(start, ly - 4), new Phaser.Geom.Point(start + sideSign * length, ly - 1),
          new Phaser.Geom.Point(start + sideSign * length, ly + 1), new Phaser.Geom.Point(start, ly + 4),
        ], true);
      }
    });
    burst.clear();
    const k = reduce ? 0.55 : pose.impact;
    if (k <= 0) return;
    const cy = y - height * 0.45;
    const radius = height * (0.3 + 0.35 * (1 - k));
    // 납작한 마름모 가시 여덟 — 동그라미를 쓰지 않는다.
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const long = i % 2 === 0 ? radius : radius * 0.62;
      const tipX = x + Math.cos(angle) * long, tipY = cy + Math.sin(angle) * long * 0.8;
      const side = angle + Math.PI / 2, w = height * 0.045;
      burst.fillStyle(i % 2 === 0 ? ARENA_TONE.spark : ARENA_TONE.accent, 0.85 * k);
      burst.fillPoints([
        new Phaser.Geom.Point(x + Math.cos(side) * w, cy + Math.sin(side) * w),
        new Phaser.Geom.Point(tipX, tipY),
        new Phaser.Geom.Point(x - Math.cos(side) * w, cy - Math.sin(side) * w),
      ], true);
    }
    const core = height * 0.12 * (0.6 + 0.4 * k);
    burst.fillStyle(0xffffff, 0.9 * k);
    burst.fillPoints([
      new Phaser.Geom.Point(x, cy - core), new Phaser.Geom.Point(x + core * 0.7, cy),
      new Phaser.Geom.Point(x, cy + core), new Phaser.Geom.Point(x - core * 0.7, cy),
    ], true);
  };
  const sync = (_time: number, delta: number): void => {
    if (!alive || !owner.active) return;
    elapsed += delta;
    const pose = clash && !reduce ? arenaClashPose((elapsed % CLASH_PERIOD) / CLASH_PERIOD) : { push: 0.06, impact: 0, lean: 6 };
    const matrix = owner.getWorldTransformMatrix();
    bodies.forEach((body, i) => {
      if (!body) return;
      const sign = i === 0 ? -1 : 1;
      const hop = reduce ? 0 : Math.max(0, Math.sin(elapsed / 210 + i * 1.3)) * height * 0.03 * (1 - pose.impact);
      const p = matrix.transformPoint(x + sign * (gap - height * pose.push), y - hop);
      body.setPosition(p.x, p.y);
      body.setAngle(-sign * pose.lean);
    });
    if (vs) vs.setScale(1 + 0.25 * pose.impact).setAngle(-6 + 6 * pose.impact);
    draw(pose);
  };
  const cleanup = (): void => {
    if (!alive) return;
    alive = false;
    scene.events.off('update', sync);
    scene.events.off('shutdown', cleanup);
    bodies.forEach((p) => p?.destroy());
  };
  owner.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);
  scene.events.on('update', sync);
  ['rex', 'spino'].forEach((id, i) => void spawnPuppet(scene, sdAssetFor(id), { x: 0, groundY: 0, height, depth, flipX: i === 1, startPaused: true }).then((body) => {
    if (!alive || !owner.active) { body.destroy(); return; }
    bodies[i] = body;
    body.setName(`arena-mascot-${id}`);
    if (options.mask) body.setMask(options.mask);
    body.setAnimationFrozen(false).setVisible(true);
    body.disableInteractive();
    sync(0, 0);
  }).catch(() => undefined));
}
