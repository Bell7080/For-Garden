import type { Puppet } from "puppetforge";

/**
 * Secondary motion is a spring simulation, so one large frame is not equivalent to several editor frames.
 * Keep its integration interval close to PuppetForge's 60 fps preview while retaining ordinary slow-frame time.
 */
export const PUPPET_STEP_SECONDS = 1 / 60;
// A multi-second return from a background tab is suspended wall time, not useful animation or stable spring time.
export const PUPPET_BACKGROUND_GAP_SECONDS = 1;

/**
 * PuppetForge v0.41.0 (pinned commit b5af06a) exposes only `Puppet.update(dt)`: its public `Puppet` API has
 * neither `seek`/`setTime` nor separate timeline and secondary-motion advancement. Consequently animation
 * accuracy cannot be capped independently from physics work here. Every foreground delta is consumed in the
 * frame that supplied it; physics protection comes only from splitting that delta into stable-sized updates.
 *
 * Do not reintroduce a per-Puppet remainder: sustained slow frames would make animation permanently trail
 * wall-clock time. If update-count capping becomes necessary, PuppetForge must first expose timeline correction
 * (ideally `advanceTimeline(elapsed)` plus `integrateSecondary(step)`) so only secondary work can be bounded.
 */

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
    return null;
  }

  let vertices: Float32Array | null = null;
  const stepCount = Math.ceil(elapsedSeconds / PUPPET_STEP_SECONDS);
  const step = elapsedSeconds / stepCount;

  // Substep size protects secondary integration; consuming every substep now keeps the coupled timeline truthful.
  for (let index = 0; index < stepCount; index += 1) {
    vertices = puppet.update(step) ?? vertices;
  }
  return vertices;
}
