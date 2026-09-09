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
 * Puppet에 넘길 **실제로 흐른 시간**(ms)을 고른다.
 *
 * Phaser가 Scene UPDATE에 주는 delta는 `fps.smoothStep`이 평탄화한 값이고, `TimeStep.smoothDelta`는
 * `fps.min`보다 느린 프레임의 delta를 **통째로 버린 뒤 1000/min으로 잘라** 돌려준다. 우리 설정은
 * `min: 30`이라 33.33ms를 넘는 프레임은 전부 33.33ms로 보고된다 — 6fps(166ms)로 도는 저사양
 * 화면에서는 1초가 0.2초로 전달되어 idle이 정확히 5배 느린 슬로모션이 된다. 창을 다시 잡은 직후
 * 120프레임 동안은 16.67ms로 더 세게 잘린다(`panicMax` 쿨다운).
 *
 * 그래서 애니메이션 시간만은 평탄화 이전의 `TimeStep.rawDelta`를 읽는다. 트윈과 게임 로직은
 * 기존 delta를 그대로 써서 "몰아서 실행되는 버벅임을 완화한다"는 설정 의도를 유지한다.
 * 백그라운드 복귀처럼 비정상적으로 큰 rawDelta는 `advancePuppet`이 이미 버린다.
 */
export function puppetElapsedMs(rawDeltaMs: number, smoothedDeltaMs: number): number {
  // rawDelta를 못 읽는 실행 환경(테스트 더블 등)에서는 기존 delta로 조용히 되돌아간다.
  if (!Number.isFinite(rawDeltaMs) || rawDeltaMs <= 0) return smoothedDeltaMs;
  return rawDeltaMs;
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
