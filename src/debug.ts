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
  /** 시각 회귀가 0%·중간·100% 프레임을 고를 수 있는 편성 순서별 충전 비율이다. */
  chargeRatios?: number[];
  /** 편별 남은 체력 합계. 실시간 난전에는 선봉 개념이 없다. */
  enemyHp: number;
  playerHp: number;
  /** E2E가 전투 조작 칩의 실제 적용 상태를 확인하는 현재 배속이다. */
  speed: number;
  /** 준비된 궁극기를 씬이 자동 발동하는지 여부다. */
  autoUltimate: boolean;
  /** 저장 경계를 거친 궁극기 전신 컷인·확대 스킵 상태다. */
  skipUltimatePresentation?: boolean;
  /** E2E가 궁극기 연출이 겹치지 않고 직렬 실행되는지 관찰하는 읽기 전용 잠금 상태다. */
  ultimateSequenceActive?: boolean;
  /** 활성 연출 뒤에 기다리는 전투원 id. 게임 규칙 입력에는 사용하지 않는다. */
  ultimateQueue?: string[];
  /** 실제 이동 중인 적 클릭 영역 중심. E2E가 고정 좌표 대신 렌더 입력 계약을 누르는 데만 쓴다. */
  enemyTargets?: Array<{ x: number; y: number }>;
  /** 코어의 stunnedFor가 양수여서 씬이 실제 기절 뱃지를 보이는 전투원 이름이다. */
  stunned?: string[];
  /** 현재 떠 있는 회복 숫자 수다. 코어 사건을 다시 계산하지 않고 표시 수명만 관찰한다. */
  healPopups?: number;
  /** Canvas 기여도 판의 현재 표시·입력 상태만 노출하며 누적 전투값은 내보내지 않는다. */
  contributionPanel?: { expanded: boolean; category: "attack" | "defense" | "healing"; locked: boolean };
}

export interface DebugState {
  ready: boolean;
  scene: string;
  /** 캔버스 DOM에서 읽을 수 없는 현재 화면 제목을 E2E가 사용자 관점으로 확인할 때 쓴다. */
  screenTitle?: string;
  battle?: DebugBattle;
  /** 정보창이 떠 있는지. `?`와 꾹 누르기를 확인하는 데 쓴다. */
  infoOpen?: boolean;
  /** 로비 공개 프로필 정보창의 열림 상태이며 계정 내용 자체는 E2E에 복제하지 않는다. */
  playerProfileOpen?: boolean;
  /** 로비 위 발굴 쪽지의 상태. 씬 전환 없이 열리고 입력을 막는 계약을 E2E가 확인한다. */
  idleExcavationPopup?: "loading" | "ready" | "error" | "editing" | "saving" | "save-error";
  /** 로비 무역 팝업의 표시 단계와 카드 입력 계약만 E2E에 공개한다. */
  tradePopup?: { state: "loading" | "ready" | "error" | "purchasing"; productCount: number; remaining?: Record<string, number>; productButtons?: Array<{ id: string; x: number; y: number }> };
  /** 슬롯별 공용 입력면의 중심과 크기. 좁은 화면의 입력 겹침만 검사하며 편성 데이터는 담지 않는다. */
  idleExcavationSlots?: Array<{ index: number; x: number; y: number; width: number; height: number }>;
  /** 편집 진입 시 선택된 슬롯 번호. Canvas 입력 회귀 검증용이며 렐릭 ID는 노출하지 않는다. */
  idleExcavationSelectedSlot?: number;
  /** 실제 표시 검증을 통과한 SD 슬롯 번호만 기록해 비동기 완료 뒤 입력 E2E를 시작한다. */
  idleExcavationSdReady?: number[];
  /** Canvas 안 광고 버튼의 실제 라벨·사용량·활성 상태만 E2E가 읽는 표시 계약이다. */
  excavationAdOffers?: Array<{ slotId: string; label: string; usage: string; enabled: boolean }>;
  /** 발굴 팝업의 실제 입력 중심만 노출한다. 재화·편성 내용 없이 레이아웃 변경을 E2E가 따라간다. */
  idleExcavationControls?: {
    close: { x: number; y: number };
    harvest: { x: number; y: number };
    cancelEdit: { x: number; y: number };
    ads: Array<{ slotId: string; x: number; y: number }>;
  };
  /** 지급 확정 뒤 공용 획득 팝업이 입력을 기다리는지 E2E가 확인하는 사용자 가시 상태다. */
  rewardPopup?: boolean;
  /** 0 지급분이 빠진 뒤 실제 한 줄에 그려진 보상 칸 수만 노출한다. */
  rewardPopupItemCount?: number;
  /** 보상 팝업의 넓은 확인 입력면 중심으로, 지급 내용은 포함하지 않는다. */
  rewardPopupConfirm?: { x: number; y: number };
  /** 재화와 보유 렐릭. 뽑기가 실제로 반영됐는지 확인하는 데 쓴다. */
  wallet?: { fossil: number; amber: number; gold?: number };
  /** 우편 점과 작업판 상태를 Canvas 밖에서 중복 계산하지 않고 확인하는 E2E 표시 계약이다. */
  mailPopup?: { open: boolean; unreadCount: number; claimableCount: number };
  owned?: string[];
  /** 캔버스 내부 편성 UI의 위치/표시 상태를 모바일 E2E가 읽는 최소 정보다. */
  party?: { autoButton: { x: number; y: number }; visibleAffinityDirections: number; selectedCount?: number; slots?: Array<{ x: number; y: number }> };
  /** 원정 준비 슬롯의 실제 입력 중심과 현재 선택 수만 노출하는 모바일 입력 계약이다. */
  expeditionFormation?: { selectedCount: number; slots: Array<{ x: number; y: number }> };
  /** 설정 왕복 E2E가 상점의 사용자 표시 섹션까지 복원됐는지 확인하는 최소 상태다. */
  shopSection?: "premium";
  /** 가방 탭 면 입력 뒤 실제로 다시 그려진 카테고리를 Canvas E2E가 확인한다. */
  inventoryCategory?: "rune" | "currency" | "consumable" | "material";
  /** 가방 카드가 실제 선택한 이미지 texture key다. WebGL 캔버스 안의 선택을 E2E가 검증한다. */
  inventoryTextureKeys?: string[];
  /** 도감 스크롤의 표시 범위와 현재 제한값. Canvas E2E가 경계·입력 분리를 검증하는 용도다. */
  relicScroll?: { y: number; minY: number; maxY: number; enabled: boolean; viewportTop: number; viewportBottom: number };
  /** 노드 편성판의 안전 영역·꼬리 방향·적 입력 중심만 노출하는 모바일 시각 회귀 계약이다. */
  enemyPreview?: { top: number; bottom: number; panelTop: number; panelBottom: number; above: boolean; enemyTargets: Array<{ x: number; y: number }> };
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

/** 비동기 가방 조회와 탭 재구성이 끝난 시점의 사용자 표시 상태만 공개한다. */
export function setDebugInventoryCategory(category: DebugState["inventoryCategory"]): void {
  ensure().inventoryCategory = category;
}

/** 실제 우편 응답 집계만 노출해 E2E가 점 해제와 수령 가능 수 변화를 확인한다. */
export function setDebugMailPopup(state: DebugState["mailPopup"]): void { ensure().mailPopup = state; }

/** 현재 탭을 다시 그릴 때 실제 이미지로 사용한 키만 복사해 이전 렌더의 잔여값을 막는다. */
export function setDebugInventoryTextureKeys(keys: readonly string[] | undefined): void {
  ensure().inventoryTextureKeys = keys ? [...keys] : undefined;
}

export function setDebugBattle(battle: DebugBattle | undefined): void {
  ensure().battle = battle;
}

/** 편성 UI의 실제 렌더 상태만 복사해 노출하고 게임 규칙 입력에는 사용하지 않는다. */
export function setDebugParty(party: DebugState["party"]): void {
  ensure().party = party;
}

/** 원정 렐릭 ID 대신 슬롯 좌표와 표시 인원수만 E2E에 전달한다. */
export function setDebugExpeditionFormation(formation: DebugState["expeditionFormation"]): void {
  ensure().expeditionFormation = formation;
}

/** 상점의 현재 표시 섹션만 공개하며 상품이나 결제 상태는 포함하지 않는다. */
export function setDebugShopSection(section: DebugState["shopSection"]): void {
  ensure().shopSection = section;
}

/** 게임 상태가 아닌 도감 스크롤의 현재 렌더 지오메트리만 E2E에 공개한다. */
export function setDebugRelicScroll(scroll: DebugState["relicScroll"]): void {
  ensure().relicScroll = scroll;
}

export function setDebugInfoOpen(open: boolean): void {
  ensure().infoOpen = open;
}

/** Canvas 프로필 칩의 열기·닫기 흐름만 자동화가 관찰하게 한다. */
export function setDebugPlayerProfileOpen(open: boolean): void {
  ensure().playerProfileOpen = open || undefined;
}

/** Canvas 밖 E2E가 공용 노드 편성판의 실제 렌더 지오메트리만 읽게 한다. */
export function setDebugEnemyPreview(preview: DebugState["enemyPreview"]): void {
  ensure().enemyPreview = preview;
}

/** Canvas 내부 팝업의 사용자 가시 상태만 노출하며 게임 진행값에는 사용하지 않는다. */
export function setDebugIdleExcavationPopup(state: DebugState["idleExcavationPopup"]): void {
  ensure().idleExcavationPopup = state;
}

/** 구매 내용 대신 사용자에게 보이는 팝업 단계와 남은 횟수만 복사한다. */
export function setDebugTradePopup(state: DebugState["tradePopup"]): void {
  ensure().tradePopup = state;
}

/** Canvas 슬롯의 사용자 입력 계약만 E2E에 복사한다. */
export function setDebugIdleExcavationSlots(slots: DebugState["idleExcavationSlots"], selectedSlot?: number): void {
  const state = ensure(); state.idleExcavationSlots = slots; state.idleExcavationSelectedSlot = selectedSlot;
  // 새 현황 렌더는 SD 완료 목록도 새로 시작해 이전 세대가 E2E 성공으로 오인되지 않게 한다.
  if (!slots || selectedSlot === undefined) state.idleExcavationSdReady = undefined;
}

/** SD의 렌더 가능 검증을 통과한 슬롯만 누적한다. */
export function setDebugIdleExcavationSdReady(index: number): void {
  const state = ensure(); state.idleExcavationSdReady = [...new Set([...(state.idleExcavationSdReady ?? []), index])];
}

/** 광고 토큰이나 서버 원문 없이 사용자가 보는 발굴 버튼 상태만 복사한다. */
export function setDebugExcavationAdOffers(offers: DebugState["excavationAdOffers"]): void {
  ensure().excavationAdOffers = offers;
}

/** 발굴 UI의 렌더 좌표만 복사하며 실제 지갑이나 편성은 의도적으로 받지 않는다. */
export function setDebugIdleExcavationControls(controls: DebugState["idleExcavationControls"]): void {
  ensure().idleExcavationControls = controls;
}

/** 보상 내용은 숨기고 팝업 열림·표시 칸 수·확인 입력점만 Canvas E2E에 전달한다. */
export function setDebugRewardPopup(open: boolean, itemCount?: number, confirm?: { x: number; y: number }): void {
  const state = ensure();
  state.rewardPopup = open || undefined;
  state.rewardPopupItemCount = open ? itemCount : undefined;
  state.rewardPopupConfirm = open ? confirm : undefined;
}

export function setDebugProgress(wallet: { fossil: number; amber: number; gold?: number }, owned: Set<string>): void {
  const state = ensure();
  state.wallet = { ...wallet };
  state.owned = [...owned];
}
