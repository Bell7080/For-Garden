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
  /**
   * 머리 위 상태 칩 줄의 실제 자리와 걸린 수.
   *
   * Canvas 안에서는 칩이 어디에 떴는지 DOM으로 알 방법이 없어, E2E가 좌표를 눈대중으로
   * 계산하면 상태가 하나 늘어날 때마다 어긋난다. 그려진 그대로만 노출한다.
   */
  statusChips?: Array<{ fighterId: string; x: number; y: number; count: number }>;
  /** 코어의 stunnedFor가 양수여서 씬이 실제 기절 뱃지를 보이는 전투원 이름이다. */
  stunned?: string[];
  /** 현재 떠 있는 회복 숫자 수다. 코어 사건을 다시 계산하지 않고 표시 수명만 관찰한다. */
  healPopups?: number;
  /** 막을 두른 전투원과 그 잔량(최대 체력 대비). */
  shields?: { name: string; ratio: number }[];
  /** EffectManager가 실제로 만든 수치 Text 풀 크기다. 표시 설정의 객체 생성 차단만 검증한다. */
  allocatedNumberCount?: number;
  /** Canvas 기여도 판의 현재 표시·입력 상태만 노출하며 누적 전투값은 내보내지 않는다. */
  contributionPanel?: { expanded: boolean; category: "attack" | "defense" | "healing"; locked: boolean };
}

export interface DebugState {
  /** 현재 실행 중인 번들을 만든 Git 커밋. E2E가 오래된 preview 접속을 거부하는 데 쓴다. */
  build: { commit: string };
  ready: boolean;
  scene: string;
  /** 캔버스 DOM에서 읽을 수 없는 현재 화면 제목을 E2E가 사용자 관점으로 확인할 때 쓴다. */
  screenTitle?: string;
  /** Canvas 안 현재 대사의 ID와 원문이며, E2E가 최초 Puppet 로딩 중 커서 보존만 관찰한다. */
  dialogue?: { nodeId: string; body: string };
  /**
   * 지금 화면에 **서 있는** 공용 대사 띠(`DialogueBubble`)의 이름과 본문.
   *
   * 띠는 잠깐 떠올랐다 스스로 사라지므로 캡처 사이로 빠져나가기 쉽다 — 실제로 상점 첫 마디가
   * 화면 조립 중에 떴다가 지는 것을 캡처만으로는 잡지 못했다. 사라지면 비워 둔다.
   */
  bubble?: { name: string; body: string };
  /** 지금 열려 있는 팝업 제목을 아래(가장 먼저 연 것)부터 순서대로 쌓아 둔다. E2E가 팝업이 실제로 열렸는지 확인한다. */
  popupTitles?: string[];
  /** PuppetForge 조립이 끝나 실제 컨테이너가 살아 있는 수다. E2E 관찰 전용이며 편성 규칙에는 입력되지 않는다. */
  puppetContainers?: Record<string, number>;
  /**
   * 목록 격자(도감·편성 보유 목록)에 선 카드의 **스크롤 전 자리**와 지금 스크롤 몫. 화면 좌표는
   * `y + offsetY`다. 스펙이 카드 자리를 손으로 적으면 보유 목록이나 격자 칸 수가 바뀔 때마다
   * 엉뚱한 카드를 눌러 조용히 어긋난다(도감의 메테 자리가 그랬다).
   */
  gridCards?: Partial<Record<"relics" | "party", { offsetY: number; cards: Record<string, { x: number; y: number }> }>>;
  /** 정보창의 원화와 비교 SD가 각각 실제 컨테이너로 교체됐는지 나타내는 읽기 전용 표시 상태다. */
  infoAssetReady?: { portrait: boolean; sd: boolean };
  /** WebGL 복구 사건과 그 뒤 실제 post-render 수를 기록하는 수명 주기 관찰값이다. */
  webglRestore?: { restoredEvents: number; renderedFramesAfterRestore: number; renderingResumed: boolean };
  /** 임무판이 API 응답을 받아 현재 그린 탭이다. 게임 규칙에는 사용하지 않는다. */
  missionsPeriod?: "daily" | "weekly";
  /**
   * **칸에 맞추다가 하한에 걸린 글자.**
   *
   * 낱말 길이는 언어가 정하고 칸 폭은 화면이 정한다. 넘치는 글은 `src/ui/textFit.ts`가 눌러
   * 넣지만, **하한까지 눌러도 들지 않으면** 거기서 멈추고 넘친 채로 남는다 — 그때는 글자가
   * 아니라 칸을 손봐야 한다는 신호다. Canvas 안에서는 그 사실을 DOM으로 알 수 없으므로
   * 여기에만 쌓아 두고 E2E가 언어를 바꿔 가며 확인한다. 눌러서 들어간 글자는 남기지 않는다.
   */
  clampedText?: Array<{ text: string; width: number; room: number }>;
  /**
   * 칸에 맞추는 규칙을 **몇 번 지났는가**.
   *
   * 넘친 글자만 세면 아무것도 넘치지 않는 날과 **규칙이 통째로 빠진 날**이 똑같이 빈 목록으로
   * 보인다. 지난 횟수를 함께 남겨 두면 검사가 양쪽으로 무너지는 것을 잡는다.
   */
  fittedText?: number;
  /** 세공 화면의 연필 입력면 중심. 이름 글자 폭에 따라 자리가 달라지므로 화면이 직접 알린다. */
  runeForgeRename?: DebugPoint;
  /** 룬 쪽지의 "세공" 버튼 중심. 줄 구성(장착·해제·판매)에 따라 자리가 달라진다. */
  runeNoteCraft?: DebugPoint;
  /** 정보창 급여 버튼의 중심. 레벨 칸의 줄 구성에 따라 자리가 달라진다. */
  feedButton?: DebugPoint;
  /** 정보창이 지금 그린 룬 조각 셋. 조각을 누르기 전에 실제로 칠해졌는지 확인하는 용도다. */
  infoGemSlots?: (string | null)[];
  battle?: DebugBattle;
  /** 폰토스 최종판의 표시 여부와 주 행동 중심만 노출해 Canvas E2E가 결과 흐름을 따라간다. */
  bossResult?: { visible: boolean; lobby: DebugPoint };
  /** 정보창이 떠 있는지. `?`와 꾹 누르기를 확인하는 데 쓴다. */
  infoOpen?: boolean;
  /** 로비 공개 프로필 정보창의 열림 상태이며 계정 내용 자체는 E2E에 복제하지 않는다. */
  playerProfileOpen?: boolean;
  /** 로비 위 발굴 쪽지의 상태. 씬 전환 없이 열리고 입력을 막는 계약을 E2E가 확인한다. */
  idleExcavationPopup?: "loading" | "ready" | "error" | "editing" | "saving" | "save-error";
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
  party?: { autoButton: { x: number; y: number }; visibleAffinityDirections: number; selectedCount?: number; slots?: Array<{ x: number; y: number }>; selectedSlot?: number };
  /** 레이드가 시즌 판인지 편성 단계인지. 두 걸음이 같은 씬 이름을 쓰므로 E2E는 이 값으로 가른다. */
  raidStage?: "list" | "season" | "summon" | "summonReveal";
  /** 원정 준비 슬롯의 실제 입력 중심과 현재 선택 수만 노출하는 모바일 입력 계약이다. */
  /**
   * `selectedSlot`은 지금 고른 칸이다. 칸은 한 번 누르면 **고르고**, 고른 칸을 한 번 더 누르면 **뺀다**
   * (`tapFormationSlot`) — E2E가 두 걸음을 각각 확인하려면 고른 칸이 보여야 한다.
   */
  expeditionFormation?: { selectedCount: number; slots: Array<{ x: number; y: number }>; selectedSlot?: number };
  /** 공용 드래그 표현의 사용자 가시 상태이며 렐릭 ID나 확정 배열은 포함하지 않는다. */
  formationDragVisual?: { owner: "party" | "expedition" | "excavation"; hovered?: number; replacementVisible: boolean };
  /** 설정 왕복 E2E가 프리미엄 화면의 표시 섹션까지 복원됐는지 확인하는 최소 상태다. */
  premiumSection?: "premium";
  /** 가방 탭 면 입력 뒤 실제로 다시 그려진 카테고리를 Canvas E2E가 확인한다. */
  inventoryCategory?: "rune" | "currency" | "consumable" | "material";
  /** 가방 카드가 실제 선택한 이미지 texture key다. WebGL 캔버스 안의 선택을 E2E가 검증한다. */
  inventoryTextureKeys?: string[];
  /** 도감 스크롤의 표시 범위와 현재 제한값. Canvas E2E가 경계·입력 분리를 검증하는 용도다. */
  relicScroll?: { y: number; minY: number; maxY: number; enabled: boolean; viewportTop: number; viewportBottom: number };
  /** 교류 카드가 실제로 그린 정체성·잠금·화면 bounds와 목록 스크롤 경계다. */
  interactionLayers?: {
    cards: Array<{ id: string; locked: boolean; bounds: { left: number; top: number; right: number; bottom: number }; textureKey: string }>;
    scrollY: number; minScrollY: number; maxScrollY: number; viewport: { top: number; bottom: number };
  };
  /** 노드 편성판의 안전 영역·꼬리 방향·적 입력 중심만 노출하는 모바일 시각 회귀 계약이다. */
  enemyPreview?: { top: number; bottom: number; panelTop: number; panelBottom: number; above: boolean; enemyTargets: Array<{ x: number; y: number }> };
  /** 상점군 E2E가 Canvas 구현을 복제하지 않고 실제 입력면만 누르는 최소 좌표 계약이다. */
  storefrontControls?: {
    lobby?: { mission: DebugPoint; missionBack: DebugPoint; shop: DebugPoint; trade: DebugPoint; interaction: DebugPoint };
    /** 무역 팝업. 실패 상태에서는 상품 대신 재시도 입력이 생기고 공용 뒤로가기는 계속 남는다. */
    trade?: { products: DebugPoint[]; retry?: DebugPoint; back: DebugPoint };
    /** 고고학 화면에서 상점으로 넘어가는 유일한 고정 입력 중심이다. */
    archaeology?: { shop: DebugPoint };
    /** 레이드 화면의 판 밖 상점 입구. 출격판의 것과 같은 자리를 쓴다. */
    raid?: { shop: DebugPoint };
    shop?: { back: DebugPoint; tabs: Record<"general" | "enhancement" | "rune", DebugPoint>; cards: DebugPoint[]; drag: { from: DebugPoint; to: DebugPoint } };
    /** 수량 작업판은 ±와 확정을, 패키지 확인판은 확정만 공개한다(고를 것이 수량이 아니다). */
    purchase?: { minus?: DebugPoint; plus?: DebugPoint; confirm: DebugPoint };
  };
  /** 상품명·재화 대신 현재 렌더 탭과 스크롤 위치만 관찰하는 표시 계약이다. */
  /** 탭 갈래는 자리마다 다르다(일반·강화·룬 / 토벌·인양). E2E가 문자열로 대조한다. */
  shopView?: { category: string; scrollY: number; minScrollY: number };
  /** 연구 결과판에 깔린 칸 수와 그중 열린 칸 수. 결과 내용은 공개하지 않는다. */
  researchBoard?: { slots: number; opened: number };
  /** 지층 판이 실제 게시한 입력점과 요청/타격/공개 순서를 관찰하는 E2E 전용 표시 계약이다. */
  archaeologyDig?: { requests: number; active: boolean; impactIndex?: number; revealedIndices: number[]; tiles: Array<DebugPoint & { index: number }> };
  /**
   * 유적 지도의 노드가 실제로 선 화면 좌표와 그 상태다.
   *
   * 열세 자리가 얽힌 그물망에서 테스트가 좌표를 손으로 적으면, 자리를 한 번 옮기는 것만으로
   * 여러 편이 동시에 죽는다. 누를 곳은 화면이 알려 준다.
   */
  archaeologyMap?: { nodes: Array<DebugPoint & { siteId: string; state: string }> };
}

/** 자동화에 공개하는 좌표는 누를 중심점 두 숫자만 가진다. */
export interface DebugPoint { x: number; y: number }

declare global {
  interface Window {
    __PF_DEBUG?: DebugState;
  }
}

function ensure(): DebugState {
  window.__PF_DEBUG ??= { build: { commit: __PF_BUILD_COMMIT__ }, ready: false, scene: "boot" };
  return window.__PF_DEBUG;
}

export function setDebugScene(scene: string, screenTitle?: string): void {
  const state = ensure();
  state.scene = scene;
  // 이전 씬의 제목이 남아 거짓 양성이 되지 않도록 씬 전환마다 함께 초기화한다.
  state.screenTitle = screenTitle;
  // 이전 씬의 대사 원문이 새 화면의 최초 표시처럼 보이지 않도록 씬 경계에서 함께 비운다.
  state.dialogue = undefined;
  // 새 씬이 자기 입력면을 게시하기 전에는 과거 상점 좌표를 남기지 않는다.
  state.storefrontControls = undefined; state.shopView = undefined;
  // 다른 씬에서 직전 교류 카드가 아직 보이는 것처럼 읽히지 않게 씬 경계에서 비운다.
  state.interactionLayers = undefined;
}

/** 현재 화면이 실제로 만든 상점 입력 중심만 병합하며 상품/지갑 데이터는 받지 않는다. */
export function setDebugStorefrontControls(controls: Partial<NonNullable<DebugState["storefrontControls"]>> | undefined): void {
  const state = ensure(); state.storefrontControls = controls ? { ...state.storefrontControls, ...controls } : undefined;
}

/** 탭 재렌더와 스크롤 clamp 결과를 그대로 게시한다. */
export function setDebugShopView(view: DebugState["shopView"]): void { ensure().shopView = view; }

/** Canvas 밖에서 목록 구현을 복제하지 않도록 교류 씬이 계산한 표시 계약을 그대로 게시한다. */
export function setDebugInteractionLayers(layers: DebugState["interactionLayers"]): void { ensure().interactionLayers = layers; }

export function setDebugReady(ready: boolean): void {
  ensure().ready = ready;
}

/** 화면이 실제 표시를 시작한 대사만 복사해 E2E가 UI 구현을 재계산하지 않게 한다. */
export function setDebugDialogue(node: { id: string; body: string } | undefined): void {
  ensure().dialogue = node ? { nodeId: node.id, body: node.body } : undefined;
}

/** 공용 대사 띠가 서고 지는 것을 그대로 옮긴다. 띠 자신만 부르므로 화면마다 갈리지 않는다. */
export function setDebugBubble(line: { name: string; body: string } | undefined): void {
  ensure().bubble = line;
}

/**
 * ready를 소유하는 씬의 시작/종료 경계를 한 규칙으로 묶는다.
 *
 * Phaser 타입을 디버그 계약에 끌어들이지 않고 필요한 `once` 모양만 받는다. 씬이 새로 만들어진
 * 순간과 SHUTDOWN 순간 모두 false로 돌려, 다음 씬이 준비 완료를 선언하기 전 이전 true가 남지 않는다.
 */
export function bindDebugReadyLifecycle(events: { once(event: string, listener: () => void): unknown }): void {
  setDebugReady(false);
  events.once("shutdown", () => setDebugReady(false));
}

/** 비동기 가방 조회와 탭 재구성이 끝난 시점의 사용자 표시 상태만 공개한다. */
export function setDebugInventoryCategory(category: DebugState["inventoryCategory"]): void {
  ensure().inventoryCategory = category;
}

/** 실제 우편 응답 집계만 노출해 E2E가 점 해제와 수령 가능 수 변화를 확인한다. */
export function setDebugMailPopup(state: DebugState["mailPopup"]): void { ensure().mailPopup = state; }

/** 뒤집힌 칸이 몇 장 남았는지만 알린다. 어느 칸에 무엇이 들었는지는 열기 전까지 공개하지 않는다. */
export function setDebugResearchBoard(board: DebugState["researchBoard"]): void { ensure().researchBoard = board; }

/** Canvas 바깥 테스트가 판의 구현을 복제하지 않고 지층 입력·공개 경계만 읽게 한다. */
export function setDebugArchaeologyDig(state: DebugState["archaeologyDig"]): void { ensure().archaeologyDig = state; }

/** 지도 노드의 자리와 상태만 알린다. 어느 유적에 무엇이 들었는지는 공개하지 않는다. */
export function setDebugArchaeologyMap(state: DebugState["archaeologyMap"]): void { ensure().archaeologyMap = state; }

/** 현재 탭을 다시 그릴 때 실제 이미지로 사용한 키만 복사해 이전 렌더의 잔여값을 막는다. */
export function setDebugInventoryTextureKeys(keys: readonly string[] | undefined): void {
  ensure().inventoryTextureKeys = keys ? [...keys] : undefined;
}

export function setDebugBattle(battle: DebugBattle | undefined): void {
  ensure().battle = battle;
}

/** 결과 수치 자체는 서버 영수증 테스트가 맡고 E2E에는 표시·입력 계약만 공개한다. */
export function setDebugBossResult(result: DebugState["bossResult"]): void { ensure().bossResult = result; }

/** 편성 UI의 실제 렌더 상태만 복사해 노출하고 게임 규칙 입력에는 사용하지 않는다. */
export function setDebugRaidStage(stage: DebugState["raidStage"]): void { ensure().raidStage = stage; }

export function setDebugParty(party: DebugState["party"]): void {
  ensure().party = party;
}

/** 원정 렐릭 ID 대신 슬롯 좌표와 표시 인원수만 E2E에 전달한다. */
export function setDebugExpeditionFormation(formation: DebugState["expeditionFormation"]): void {
  ensure().expeditionFormation = formation;
}

/** 모바일 E2E가 칸과 교체 고스트가 실제 드래그 동안 함께 뜨는지만 관찰한다. */
export function setDebugFormationDragVisual(visual: DebugState["formationDragVisual"]): void {
  ensure().formationDragVisual = visual;
}

/** 프리미엄 화면의 현재 표시 섹션만 공개하며 상품이나 결제 상태는 포함하지 않는다. */
export function setDebugPremiumSection(section: DebugState["premiumSection"]): void {
  ensure().premiumSection = section;
}

/** 게임 상태가 아닌 도감 스크롤의 현재 렌더 지오메트리만 E2E에 공개한다. */
export function setDebugRelicScroll(scroll: DebugState["relicScroll"]): void {
  ensure().relicScroll = scroll;
}

export function setDebugInfoOpen(open: boolean): void {
  ensure().infoOpen = open;
  if (!open) ensure().infoAssetReady = undefined;
}

/** 격자 카드 자리를 알린다. 스크롤이 바뀌면 `offsetY`만 갈아 끼운다. */
export function setDebugGridCards(scene: "relics" | "party", cards: Record<string, { x: number; y: number }> | undefined, offsetY = 0): void {
  const state = ensure(); const grids = state.gridCards ?? (state.gridCards = {});
  if (!cards) { delete grids[scene]; return; }
  grids[scene] = { offsetY, cards };
}

export function setDebugGridOffset(scene: "relics" | "party", offsetY: number): void {
  const grid = ensure().gridCards?.[scene];
  if (grid) grid.offsetY = offsetY;
}

/**
 * 비동기 Puppet 생성/파괴 결과만 세며 저장이나 편성 상태를 읽거나 바꾸지 않는다.
 *
 * **키는 씬 키(`lobby`·`expedition`)다 — 클래스 이름이 아니다.** 스펙 몇 곳이 `ExpeditionScene`으로
 * 읽어 수가 영원히 0으로 보였고, 기다리던 검사가 시간만 채우고 실패했다.
 */
export function changeDebugPuppetContainers(scene: string, delta: number): void {
  const state = ensure(); const counts = state.puppetContainers ?? (state.puppetContainers = {});
  counts[scene] = Math.max(0, (counts[scene] ?? 0) + delta);
}

/** 정보창이 실제로 채운 두 비동기 에셋의 완료 여부만 병합한다. */
export function setDebugInfoAssetReady(part: Partial<NonNullable<DebugState["infoAssetReady"]>> | undefined): void {
  ensure().infoAssetReady = part ? { portrait: false, sd: false, ...ensure().infoAssetReady, ...part } : undefined;
}

/** 브라우저 WebGL 사건과 Phaser post-render 관찰값을 그대로 게시한다. */
export function setDebugWebglRestore(state: DebugState["webglRestore"]): void { ensure().webglRestore = state; }

/** 임무 API 응답을 그린 뒤의 선택 탭만 게시한다. */
export function setDebugMissionsPeriod(period: DebugState["missionsPeriod"]): void { ensure().missionsPeriod = period; }

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

/** 팝업이 열리거나 닫힐 때마다 PopupLayer가 부른다. E2E가 실제로 무엇이 열려 있는지 확인한다. */
/**
 * 세공 화면의 이름 고치기(연필) 입력면 중심.
 *
 * 연필은 이름 글자 폭만큼 밀려 서므로 화면 좌표가 이름에 따라 달라진다 — 스펙이 좌표를 적어
 * 두면 이름이 바뀌는 순간 조용히 빗나간다. 보상 팝업의 확인 버튼과 같은 방식으로 자리만 알린다.
 */
export function setDebugRuneForgeRename(point: { x: number; y: number } | undefined): void {
  ensure().runeForgeRename = point;
}

/**
 * 룬 쪽지의 "세공" 버튼 중심.
 *
 * 그 줄은 룬의 상태에 따라 구성이 바뀐다 — 끼워져 있으면 세공·해제 둘, 아니면 세공·장착·판매
 * 셋이고 버튼 폭과 x가 함께 달라진다. 좌표를 스펙에 적어 두면 줄이 바뀌는 순간 **쪽지 바깥을
 * 눌러 그냥 닫아 버리고**, 실패는 "세공 화면이 안 열린다"로만 보인다.
 */
export function setDebugRuneNoteCraft(point: { x: number; y: number } | undefined): void {
  ensure().runeNoteCraft = point;
}

/**
 * 급여 버튼의 중심.
 *
 * 정보창의 레벨 칸은 경험치 줄·상한·성장 표기가 함께 자라 버튼 자리가 그때그때 달라진다.
 * 좌표를 스펙에 적어 두면 칸이 한 줄만 바뀌어도 버튼 위가 아닌 곳을 눌러, 실패는 "성장 팝업이
 * 안 뜬다"로만 보인다 — 실제로는 급여가 아예 일어나지 않은 것이다.
 */
export function setDebugFeedButton(point: { x: number; y: number } | undefined): void {
  ensure().feedButton = point;
}

/**
 * 정보창이 지금 그린 룬 조각 셋.
 *
 * 조각은 정보창이 열린 뒤에 칠해진다. 그 전에 누르면 빈 자리로 판정돼 룬 쪽지 대신 장착
 * 가방이 열리고, 실패는 "세공 화면이 안 열린다"로만 보인다 — 기다리는 시간을 눈대중으로
 * 늘리는 대신 **칠해졌는지 자체를** 알린다.
 */
export function setDebugInfoGemSlots(slots: (string | null)[] | undefined): void {
  ensure().infoGemSlots = slots;
}

export function setDebugPopupTitles(titles: string[]): void {
  ensure().popupTitles = titles.length > 0 ? titles : undefined;
}

/**
 * 칸에 맞추다가 **하한에 걸린** 글자를 기록한다. 들어간 글자는 부르지 않는다.
 *
 * 같은 글이 여러 번 그려질 수 있으므로 문구와 칸 폭이 같은 것은 한 번만 쌓는다 — 목록이
 * 길어지면 E2E 실패 메시지에서 어느 자리가 넘쳤는지 읽히지 않는다.
 */
export function countFittedText(): void {
  const state = ensure();
  state.fittedText = (state.fittedText ?? 0) + 1;
}

export function reportClampedText(text: string, width: number, room: number): void {
  const state = ensure();
  const list = state.clampedText ?? (state.clampedText = []);
  if (list.some((entry) => entry.text === text && entry.room === room)) return;
  list.push({ text, width: Math.round(width), room: Math.round(room) });
}
