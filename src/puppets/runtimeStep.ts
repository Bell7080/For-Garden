import type { Puppet } from "puppetforge";

/**
 * Secondary motion is a spring simulation, so one large frame is not equivalent to several editor frames.
 * Keep its integration interval close to PuppetForge's 60 fps preview and discard long background-tab gaps.
 */
export const PUPPET_STEP_SECONDS = 1 / 60;
export const PUPPET_MAX_CATCH_UP_SECONDS = 0.1;

/** Advance one Puppet through stable, editor-sized steps and return the last calculated vertex buffer. */
export function advancePuppet(puppet: Puppet, elapsedSeconds: number): Float32Array | null {
  const elapsed = Math.min(Math.max(elapsedSeconds, 0), PUPPET_MAX_CATCH_UP_SECONDS);
  let vertices: Float32Array | null = null;
  const stepCount = Math.ceil(elapsed / PUPPET_STEP_SECONDS);
  const step = stepCount > 0 ? elapsed / stepCount : 0;

  // Splitting only changes numerical integration stability; exported speed, strength, and secondary stay intact.
  for (let index = 0; index < stepCount; index += 1) {
    vertices = puppet.update(step) ?? vertices;
  }
  return vertices;
}
