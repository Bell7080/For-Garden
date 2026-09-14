/** Phaser와 무관하게 정산 요청 잠금과 실패판 한 장의 생명주기를 표현한다. */
export interface BossSettlementFailureState {
  bossSettlementPending: boolean;
  failureVisible: boolean;
  /** 실패할 때마다 증가하지만, 화면에는 항상 최신 세대 한 장만 남는다. */
  failureUiGeneration: number;
}

/** 전투가 끝난 직후에는 요청도 실패판도 없는 상태에서 시작한다. */
export function createBossSettlementFailureState(): BossSettlementFailureState {
  return { bossSettlementPending: false, failureVisible: false, failureUiGeneration: 0 };
}

/** 이미 전송 중이면 중복 탭을 거절하고, 새 시도라면 이전 실패판을 먼저 거둔다. */
export function beginBossSettlementAttempt(state: BossSettlementFailureState): boolean {
  if (state.bossSettlementPending) return false;
  state.bossSettlementPending = true;
  state.failureVisible = false;
  return true;
}

/** 실패한 한 요청을 잠금 해제하고 그 요청에 대응하는 최신 실패판 한 장을 연다. */
export function failBossSettlementAttempt(state: BossSettlementFailureState): void {
  if (!state.bossSettlementPending) return;
  state.bossSettlementPending = false;
  state.failureVisible = true;
  state.failureUiGeneration += 1;
}

/** 성공하면 요청 잠금과 남아 있을 수 있는 실패 상태를 함께 닫는다. */
export function completeBossSettlementAttempt(state: BossSettlementFailureState): void {
  state.bossSettlementPending = false;
  state.failureVisible = false;
}

/**
 * 실패판 이탈은 성공/포기 명령이 아니다. Boot가 서버와 저장을 다시 읽게 할 목적지만 돌려준다.
 */
export function bossSettlementRecoveryRoute(): { scene: "boot"; data: { destination: "lobby" } } {
  return { scene: "boot", data: { destination: "lobby" } };
}
