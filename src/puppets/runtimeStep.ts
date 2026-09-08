import type { Puppet } from "puppetforge";

/**
 * Secondary motion is a spring simulation, so one large frame is not equivalent to several editor frames.
 * Keep its integration interval close to PuppetForge's 60 fps preview while retaining ordinary slow-frame time.
 */
export const PUPPET_STEP_SECONDS = 1 / 60;
export const PUPPET_MAX_CATCH_UP_SECONDS = 0.1;
// A multi-second return from a background tab is suspended wall time, not useful animation or stable spring time.
export const PUPPET_BACKGROUND_GAP_SECONDS = 1;

/**
 * PuppetForge v0.41.0 exposes only `Puppet.update(dt)`, which advances the real animation timeline and its
 * secondary spring together. Keep sub-background real time per instance until bounded physics-sized updates
 * can consume it; a WeakMap lets discarded Puppet instances release this scheduling state with the instance.
 */
const puppetRemainders = new WeakMap<Puppet, number>();

/**
 * Phaser가 UPDATE listener를 유지하는 동안 Puppet 계산이 실제로 필요한지를 순수하게 판정한다.
 * `visible=false`는 렌더만 막고 Scene UPDATE 구독은 해제하지 않으므로, 호출부가 모든 상태를
 * 명시적으로 전달해야 숨은 정보창의 CPU 애니메이션도 멈춘다.
 */
export function shouldAdvancePuppet(state: {
  active: boolean;
  visible: boolean;
  sceneActive: boolean;
  motionPaused: boolean;
}): boolean {
  return state.active && state.visible && state.sceneActive && !state.motionPaused;
}

/** Advance one Puppet through stable, editor-sized steps and return the last calculated vertex buffer. */
export function advancePuppet(puppet: Puppet, elapsedSeconds: number): Float32Array | null {
  // Negative/non-finite deltas are not real elapsed time, so they must neither rewind nor poison the remainder.
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;

  if (elapsedSeconds >= PUPPET_BACKGROUND_GAP_SECONDS) {
    // Background-return wall time is intentionally discarded instead of feeding seconds into an unstable spring.
    puppetRemainders.delete(puppet);
    return null;
  }

  // Real foreground time is retained, while only this frame's physics work is capped for frame-time stability.
  const available = (puppetRemainders.get(puppet) ?? 0) + elapsedSeconds;
  const elapsed = Math.min(available, PUPPET_MAX_CATCH_UP_SECONDS);
  const remainder = available - elapsed;
  if (remainder > Number.EPSILON) puppetRemainders.set(puppet, remainder);
  else puppetRemainders.delete(puppet);

  let vertices: Float32Array | null = null;
  const stepCount = Math.ceil(elapsed / PUPPET_STEP_SECONDS);
  const step = stepCount > 0 ? elapsed / stepCount : 0;

  // Small calls protect secondary integration; the retained sum keeps the coupled animation timeline truthful.
  for (let index = 0; index < stepCount; index += 1) {
    vertices = puppet.update(step) ?? vertices;
  }
  return vertices;
}
