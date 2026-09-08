import type { Puppet } from "puppetforge";

/**
 * Secondary motion is a spring simulation, so one large frame is not equivalent to several editor frames.
 * Keep its integration interval close to PuppetForge's 60 fps preview and discard long background-tab gaps.
 */
export const PUPPET_STEP_SECONDS = 1 / 60;
export const PUPPET_MAX_CATCH_UP_SECONDS = 0.1;

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
