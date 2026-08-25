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
  /** E2E가 궁극기 연출이 겹치지 않고 직렬 실행되는지 관찰하는 읽기 전용 잠금 상태다. */
  ultimateSequenceActive?: boolean;
  /** 활성 연출 뒤에 기다리는 전투원 id. 게임 규칙 입력에는 사용하지 않는다. */
  ultimateQueue?: string[];
  /** 실제 이동 중인 적 클릭 영역 중심. E2E가 고정 좌표 대신 렌더 입력 계약을 누르는 데만 쓴다. */
  enemyTargets?: Array<{ x: number; y: number }>;
}

export interface DebugState {
  ready: boolean;
  scene: string;
  /** 캔버스 DOM에서 읽을 수 없는 현재 화면 제목을 E2E가 사용자 관점으로 확인할 때 쓴다. */
  screenTitle?: string;
  battle?: DebugBattle;
  /** 정보창이 떠 있는지. `?`와 꾹 누르기를 확인하는 데 쓴다. */
  infoOpen?: boolean;
  /** 로비 위 발굴 쪽지의 상태. 씬 전환 없이 열리고 입력을 막는 계약을 E2E가 확인한다. */
  idleExcavationPopup?: "loading" | "ready" | "error" | "editing" | "saving" | "save-error";
  /** Canvas 안 광고 버튼의 실제 라벨·사용량·활성 상태만 E2E가 읽는 표시 계약이다. */
  excavationAdOffers?: Array<{ slotId: string; label: string; usage: string; enabled: boolean }>;
  /** 지급 확정 뒤 공용 획득 팝업이 입력을 기다리는지 E2E가 확인하는 사용자 가시 상태다. */
  rewardPopup?: boolean;
  /** 재화와 보유 렐릭. 뽑기가 실제로 반영됐는지 확인하는 데 쓴다. */
  wallet?: { fossil: number; amber: number };
  owned?: string[];
  /** 캔버스 내부 편성 UI의 위치/표시 상태를 모바일 E2E가 읽는 최소 정보다. */
  party?: { autoButton: { x: number; y: number }; visibleAffinityDirections: number };
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

export function setDebugScene(scene: string, screenTitle?: string): void {
  const state = ensure();
  state.scene = scene;
  // 이전 씬의 제목이 남아 거짓 양성이 되지 않도록 씬 전환마다 함께 초기화한다.
  state.screenTitle = screenTitle;
}

export function setDebugReady(ready: boolean): void {
  ensure().ready = ready;
}

export function setDebugBattle(battle: DebugBattle | undefined): void {
  ensure().battle = battle;
}

/** 편성 UI의 실제 렌더 상태만 복사해 노출하고 게임 규칙 입력에는 사용하지 않는다. */
export function setDebugParty(party: DebugState["party"]): void {
  ensure().party = party;
}

export function setDebugInfoOpen(open: boolean): void {
  ensure().infoOpen = open;
}

/** Canvas 내부 팝업의 사용자 가시 상태만 노출하며 게임 진행값에는 사용하지 않는다. */
export function setDebugIdleExcavationPopup(state: DebugState["idleExcavationPopup"]): void {
  ensure().idleExcavationPopup = state;
}

/** 광고 토큰이나 서버 원문 없이 사용자가 보는 발굴 버튼 상태만 복사한다. */
export function setDebugExcavationAdOffers(offers: DebugState["excavationAdOffers"]): void {
  ensure().excavationAdOffers = offers;
}

/** 보상 내용은 노출하지 않고 확인 팝업의 열림 여부만 Canvas E2E에 전달한다. */
export function setDebugRewardPopup(open: boolean): void {
  ensure().rewardPopup = open || undefined;
}

export function setDebugProgress(wallet: { fossil: number; amber: number }, owned: Set<string>): void {
  const state = ensure();
  state.wallet = { ...wallet };
  state.owned = [...owned];
}
