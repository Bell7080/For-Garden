/**
 * Phaser는 캔버스 안에 직접 그리기 때문에 DOM에서 현재 상태를 확인할 수 없다.
 * E2E(Playwright) 테스트가 씬 전환·로딩 완료를 검증할 수 있도록 window에 최소한의 상태만 노출한다.
 */
export interface DebugState {
  ready: boolean;
  scene: string;
}

declare global {
  interface Window {
    __PF_DEBUG?: DebugState;
  }
}

export function setDebugScene(scene: string): void {
  if (!window.__PF_DEBUG) {
    window.__PF_DEBUG = { ready: false, scene };
    return;
  }
  window.__PF_DEBUG.scene = scene;
}

export function setDebugReady(ready: boolean): void {
  if (!window.__PF_DEBUG) {
    window.__PF_DEBUG = { ready, scene: "boot" };
    return;
  }
  window.__PF_DEBUG.ready = ready;
}
