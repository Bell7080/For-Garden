/**
 * Phaser는 캔버스 안에 직접 그리기 때문에 DOM에서 현재 상태를 확인할 수 없다.
 * E2E(Playwright) 테스트가 씬 전환과 전투 진행을 검증할 수 있도록 최소한의 상태만 window에 노출한다.
 */
export interface DebugBattle {
  turn: number;
  phase: string;
  /** 진형 순서대로의 이름. 스왑이 됐는지 여기서 확인한다. */
  playerOrder: string[];
  enemyFrontHp: number;
  playerFrontHp: number;
}

export interface DebugState {
  ready: boolean;
  scene: string;
  battle?: DebugBattle;
  /** 정보창이 떠 있는지. `?`와 꾹 누르기를 확인하는 데 쓴다. */
  infoOpen?: boolean;
}

declare global {
  interface Window {
    __PF_DEBUG?: DebugState;
  }
}

function ensure(): DebugState {
  window.__PF_DEBUG ??= { ready: false, scene: "boot" };
  return window.__PF_DEBUG;
}

export function setDebugScene(scene: string): void {
  ensure().scene = scene;
}

export function setDebugReady(ready: boolean): void {
  ensure().ready = ready;
}

export function setDebugBattle(battle: DebugBattle | undefined): void {
  ensure().battle = battle;
}

export function setDebugInfoOpen(open: boolean): void {
  ensure().infoOpen = open;
}
