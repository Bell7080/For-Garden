/**
 * Phaser는 캔버스 안에 직접 그리기 때문에 DOM에서 현재 상태를 확인할 수 없다.
 * E2E(Playwright) 테스트가 씬 전환과 전투 진행을 검증할 수 있도록 최소한의 상태만 window에 노출한다.
 */
export interface DebugBattle {
  phase: string;
  /** 전투가 시작된 뒤 흐른 시간(초). 실시간 전투라 턴 번호가 없다. */
  elapsed: number;
  /** 아직 살아 있는 아군 이름. 편성 순서를 유지한다. */
  playerOrder: string[];
  /** 지금 궁극기를 누를 수 있는 아군 이름. */
  ultimateReady: string[];
  /** 편별 남은 체력 합계. 실시간 난전에는 선봉 개념이 없다. */
  enemyHp: number;
  playerHp: number;
  /** E2E가 전투 조작 칩의 실제 적용 상태를 확인하는 현재 배속이다. */
  speed: number;
  /** 준비된 궁극기를 씬이 자동 발동하는지 여부다. */
  autoUltimate: boolean;
  /** E2E가 컷인 중첩 없이 직렬 실행되는지 관찰하는 읽기 전용 잠금 상태다. */
  ultimateSequenceActive?: boolean;
  /** 활성 연출 뒤에 기다리는 전투원 id. 게임 규칙 입력에는 사용하지 않는다. */
  ultimateQueue?: string[];
}

export interface DebugState {
  ready: boolean;
  scene: string;
  battle?: DebugBattle;
  /** 정보창이 떠 있는지. `?`와 꾹 누르기를 확인하는 데 쓴다. */
  infoOpen?: boolean;
  /** 재화와 보유 렐릭. 뽑기가 실제로 반영됐는지 확인하는 데 쓴다. */
  wallet?: { fossil: number; amber: number };
  owned?: string[];
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

export function setDebugProgress(wallet: { fossil: number; amber: number }, owned: Set<string>): void {
  const state = ensure();
  state.wallet = { ...wallet };
  state.owned = [...owned];
}
