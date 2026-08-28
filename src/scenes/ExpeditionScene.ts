import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type AdSlotOperationsDto, type ExpeditionLeaderboardEntry } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { ExpeditionMapNode } from "../core/expeditionMap";
import { getRelic } from "../data/relics";
import { getExpeditionAugment } from "../data/expeditionAugments";
import { setDebugScene } from "../debug";
import { expeditionManager, type StartExpeditionFailure } from "../managers/ExpeditionManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { PopupLayer } from "../ui/PopupLayer";
import { COLOR, textStyle } from "../ui/theme";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { EXPEDITION_LAYOUT } from "../ui/expeditionLayout";
import { ExpeditionMapView } from "../ui/ExpeditionMapView";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";
import type { ExpeditionBattleInputDto, ExpeditionBossBattleInputDto } from "../core/expeditionBattle";
import { ExpeditionAugmentPopup, expeditionAugmentEffectLabel, expeditionAugmentMetaLabel, type AugmentTargetPicker } from "../ui/ExpeditionAugmentPopup";
import { EXPEDITION_NODE_REWARD_BALANCE } from "../data/expedition";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd } from "../platform/rewardedAds";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { ExpeditionRewardPopup } from "../ui/ExpeditionRewardPopup";
import { portraitAssetFor, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { loadOwnedPuppet } from "../ui/statusPuppetLoad";
import { expeditionEnemyLevel, getExpeditionEncounterEnemies } from "../data/expeditionEnemies";
import { formatCurrency } from "../core/formatCurrency";
import { drawInnerVignette, drawShapeOutline } from "../ui/holo";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { NodeEnemyPreview } from "../ui/NodeEnemyPreview";
import { BattleProfile } from "../ui/BattleProfile";
import { BATTLE_PROFILE_LAYOUT } from "../ui/battleStatusLayout";

/** 원정 준비 카드의 고정 그리드 규격이다. 다른 편성과 달리 세 칸씩 읽게 한다. */
const ROSTER = { columns: 3, width: 250, height: 310, gapX: 56, gapY: 50, top: 940 } as const;
/** 발굴 편성처럼 화면 상단에서 순서를 먼저 읽는 1/2/3 슬롯 규격이다. */
const FORMATION = { y: 540, firstX: 230, stepX: 310, width: 250, height: 290 } as const;
/**
 * 원정 첫 화면(주간 기록)의 자리표.
 *
 * 보스가 위에 서고 순위판이 그 **허리 아래를 덮으며** 내려온다. 판을 더 올리면 얼굴이 가려지고
 * 더 내리면 보스가 공중에 뜬 것처럼 보인다.
 */
const RANKING = {
  // 원화를 크게 세우고 얼굴이 제목 줄 아래에서 시작하도록 위로 올린다. 발끝은 판 뒤에 숨는다.
  boss: { groundY: 1400, height: 1150 },
  board: { y: 1120, width: 1000, height: 880 },
  side: { x: 250 },
  rows: { x: 730, width: 580, gap: 86, firstY: 766, max: 8 },
  sortie: { y: 1700 },
} as const;

/** 증강 팝업의 암전(4000) 바로 위. 고르는 동안만 생존 HUD가 이 층으로 올라온다. */
const AUGMENT_PICKER_DEPTH = 4001;

/**
 * 주간 원정 준비/이어하기 화면.
 *
 * 이 씬은 카드 선택과 문구만 소유한다. 진행 상태 검증과 Session 저장은 ExpeditionManager가 맡는다.
 */
export class ExpeditionScene extends Phaser.Scene {
  private selected: string[] = [];
  private cards = new Map<string, PortraitCard>();
  private hint!: Phaser.GameObjects.Text;
  private startButton?: Button;
  /** 확인 팝업은 씬의 다른 입력 위에 한 장만 쌓이도록 공용 레이어가 소유한다. */
  private popups!: PopupLayer;
  /** 지도 입력부터 저장/씬 전환 완료까지의 단일 잠금은 이 씬이 소유한다. */
  private nodeTransitionPending = false;
  /** 광고 표시부터 서버 확정까지 연타를 막는 빠른 원정 전용 잠금이다. */
  private quickClaimPending = false;
  private quickButton?: Button;
  /** 선택 미리보기와 비동기 SD는 매 선택마다 함께 폐기해 이전 편성이 겹치지 않게 한다. */
  private formationPreview?: Phaser.GameObjects.Container;
  private formationPuppets = new Set<PuppetCreature>();
  private formationGeneration = 0;
  /** 지도에서 마지막으로 확인한 전투 노드다. 하단 출격 버튼은 이 선택만 소비한다. */
  private selectedNode?: ExpeditionMapNode;
  /** 적 상세는 실제 전투와 같은 공용 읽기 전용 상태창을 사용한다. */
  private enemyInfo?: CharacterInfoManager;
  /** 전투 노드 선택은 모달 대신 지도에 붙는 공용 SD 편성판 하나만 갱신한다. */
  private enemyPreview?: NodeEnemyPreview;
  /** 선택 해제와 스크롤 추적을 같은 지도 인스턴스에 전달한다. */
  private mapView?: ExpeditionMapView;
  /** 기록 화면의 판 위 내용. 서버 응답이 오면 이 층만 통째로 갈아 끼운다. */
  private rankingRows?: Phaser.GameObjects.Container;
  /** 첫 화면은 주간 기록이고 출격 버튼을 눌러야 편성으로 넘어간다. */
  private stage: "ranking" | "preparation" = "ranking";
  /** 기록 화면의 보스 전신. 씬을 다시 만들 때 GPU 자원을 반드시 함께 버린다. */
  private bossPortrait?: PuppetCreature;
  /** 증강 팝업이 아군 그리드를 다시 그리지 않고 이 생존 HUD를 그대로 빌려 쓴다. */
  private relicProfiles = new Map<string, BattleProfile>();

  constructor() {
    super("expedition");
  }

  /** 로비에서 새로 들어오면 늘 기록 화면부터다. 편성은 출격 버튼이 여는 다음 단계다. */
  init(data?: { stage?: "ranking" | "preparation" }): void {
    this.stage = data?.stage ?? "ranking";
  }

  create(): void {
    setDebugScene("expedition");
    this.selected = [];
    this.cards.clear();
    this.popups = new PopupLayer(this);
    this.nodeTransitionPending = false;
    this.selectedNode = undefined;
    this.enemyPreview?.destroy(); this.enemyPreview = undefined;
    this.mapView = undefined;
    this.relicProfiles.clear();
    this.bossPortrait?.destroy(); this.bossPortrait = undefined;
    this.clearFormationPreview();

    const status = expeditionManager.status();
    // 활성 런은 전용 지도, 편성 단계는 요청된 Content2 전투 필드 원화로 흐름을 잇는다.
    addSceneBackground(this, status.active ? BACKGROUND.expeditionMap : BACKGROUND.expeditionField);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -26, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.42).setDepth(-25);
    if (status.active) {
      // 가장자리 HUD 뒤만 유리 페이드로 눌러 지도 지형과 중앙 경로는 그대로 보존한다.
      drawGlassFade(this, BASE_WIDTH / 2, 110, BASE_WIDTH, 220, { topAlpha: HOLO.glass, bottomAlpha: 0 }).setDepth(-24);
      drawGlassFade(this, BASE_WIDTH / 2, BASE_HEIGHT - 180, BASE_WIDTH, 360, { topAlpha: 0, bottomAlpha: HOLO.glass }).setDepth(-24);
    }

    this.add.text(54, 34, "주간 원정", textStyle({ role: "display", size: 48 })).setOrigin(0, 0);
    this.add.text(54, 94, `이번 주 ${status.playsThisWeek}회  ·  최고 ${status.bestScore.toLocaleString()}`, textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(0, 0);
    drawHairline(this, BASE_WIDTH / 2, 224, BASE_WIDTH - 108, { color: COLOR.accent, alpha: 0.34 });

    if (status.active) this.buildActive(status.active.score, status.run?.selectedAugments ?? []);
    else if (this.stage === "ranking") this.buildRanking(status);
    else this.buildPreparation();

    // 화면을 벗어나는 조작은 공용 우하단 슬롯만 사용한다. 편성에서는 한 단계 앞인 기록으로 돌아간다.
    addBackButton(this, () => {
      if (!status.active && this.stage === "preparation") this.scene.restart({ stage: "ranking" });
      else this.scene.start("lobby");
    });
  }

  /** 진행 중 원정은 보상·상승 지도·증강·생존 HUD를 서로 겹치지 않는 안전 구역에 배치한다. */
  private buildActive(score: number, augments: readonly ExpeditionAugmentSelection[]): void {
    const run = expeditionManager.status().run;
    if (!run) return;
    // 현재 점수는 주간 최고와 같은 상태 줄에 짧게 붙여 지도 공간을 침범하지 않는다.
    this.add.text(BASE_WIDTH - 54, 94, `런 ${score.toLocaleString()}`, textStyle({ role: "emphasis", size: 25, color: COLOR.sortieText })).setOrigin(1, 0);
    this.buildRewardBar(run.pendingRewards, run.lastNodeRewards);
    this.buildMap(run.nodes, run.currentNodeId, run.visitedNodeIds);
    this.buildAugmentChips(augments);
    this.buildRelicHud(run.relics);
    // 원화는 정보창의 판·스킬 아이콘 아래(1001)에 선다. 더 높이면 스테이지와 달리 원화가
    // 스킬 층 앞으로 튀어나와 아이콘을 가린다.
    this.enemyInfo = new CharacterInfoManager(this, 1001, "enemy");
    this.enemyPreview = new NodeEnemyPreview(this, { title: "", level: 1, enemies: [], top: EXPEDITION_LAYOUT.map.top, bottom: EXPEDITION_LAYOUT.map.bottom, depth: 20, onEnemyClick: () => undefined });
    // 지도 영역 밖 입력은 편성판 내부가 아닌 경우 현재 노드 선택만 닫는다.
    const dismissOutsideMap = (pointer: Phaser.Input.Pointer): void => {
      const outsideMap = pointer.worldY < EXPEDITION_LAYOUT.map.top || pointer.worldY > EXPEDITION_LAYOUT.map.bottom;
      const outsideActions = pointer.worldY < EXPEDITION_LAYOUT.actions.top;
      // 출격·뒤로가기 행동선은 현재 선택을 소비하므로 빈 배경 취소 대상에서 제외한다.
      if (outsideMap && outsideActions && !this.enemyPreview?.containsScreenPoint(pointer.worldX, pointer.worldY)) this.mapView?.clearSelection();
    };
    this.input.on("pointerdown", dismissOutsideMap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off("pointerdown", dismissOutsideMap));
    // 스토리 지도처럼 출격은 팝업 안이 아니라 화면 하단의 고정 행동선에 한 번만 둔다.
    this.startButton = new Button(this, BASE_WIDTH / 2, 1810, { width: 340, height: 108, label: "출  격", variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.selectedNode && this.confirmNodeSortie(this.selectedNode) });
    this.startButton.setEnabled(false);
    if (run.pendingAugmentReward) this.openAugmentReward();
    // 포기는 전리품 판의 우상단 정보 흐름 바로 아래에 붙이고, 작고 붉은 파괴 조작으로 분리한다.
    new Button(this, BASE_WIDTH - 155, 286, { width: 190, height: 56, label: "포기하기", fontSize: 20, fill: 0x431d20, accentColor: COLOR.danger, accentTextColor: COLOR.dangerText, onClick: () => this.confirmAbandon() });
  }

  /** 런에서만 누적되는 네 재화를 보상 팝업과 같은 액자·우하단 수량 문법으로 묶는다. */
  private buildRewardBar(rewards: Readonly<Record<string, number>>, last: { rewards: Record<string, number>; cappedCurrencies: string[] } | null): void {
    const items = [
      ["currency-cheesecake", "cheesecake"], ["currency-gold", "gold"],
      ["currency-fossil", "fossil"], ["currency-gems", "gems"],
    ] as const;
    // 지도 위에 떠 있는 하나의 전리품 레이어로 읽히도록 제목과 얇은 상단선을 먼저 놓는다.
    drawLayer(this, BASE_WIDTH / 2, 194, chipPoints(972, 142, { bevel: { topLeft: 30, bottomRight: 22 } }), { fill: 0x0d131b, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.55 });
    this.add.text(86, 137, "획득 전리품", textStyle({ role: "display", size: 25, color: COLOR.accentText })).setOrigin(0, 0.5);
    items.forEach(([icon, key], index) => {
      const x = 180 + index * 225; const y = 207; const size = 96;
      const frame = chipPoints(size, size, { bevel: { topLeft: 20, bottomRight: 18 } });
      drawLayer(this, x, y, frame, { fill: 0x101722, alpha: 0.98 });
      this.add.image(x, y, icon).setDisplaySize(72, 72);
      drawInnerVignette(this, x, y, frame, { strength: 0.58 });
      drawShapeOutline(this, x, y, frame, { color: COLOR.accent, alpha: 0.74, width: 2 });
      const total = Math.floor(rewards[key] ?? 0);
      const capped = last?.cappedCurrencies.includes(key) ?? total >= EXPEDITION_NODE_REWARD_BALANCE[key].runCap;
      // 수량은 보상 팝업처럼 액자 우하단에 겹치고 검은 스트로크로 아이콘에서 떼어 낸다.
      this.add.text(x + 42, y + 40, `${formatCurrency(total)}${capped ? " MAX" : ""}`, textStyle({ role: "display", size: 20, color: capped ? "#ffd27a" : "#ffffff" })).setOrigin(1, 1).setStroke("#000000", 5);
      const gained = Math.floor(last?.rewards[key] ?? 0);
      if (gained > 0) this.add.text(x, 263, `+ ${formatCurrency(gained)}`, textStyle({ role: "emphasis", size: 16, color: COLOR.accentText })).setOrigin(0.5);
    });
  }

  /** 전용 프리팹에 지도 월드와 입력 수명을 넘기고 씬은 선택 결과만 연결한다. */
  private buildMap(nodes: readonly ExpeditionMapNode[], currentNodeId: string | null, visitedIds: readonly string[]): void {
    this.mapView = new ExpeditionMapView(this, {
      top: EXPEDITION_LAYOUT.map.top,
      bottom: EXPEDITION_LAYOUT.map.bottom,
      nodes,
      currentNodeId,
      visitedIds,
      onSelect: (node, point) => this.handleNodeSelection(node, point.y),
      onSelectedMove: (_node, point, visible) => this.enemyPreview?.trackNode(point.y, visible),
      onDismiss: () => this.dismissNodeSelection(),
      shouldDismissAt: (point) => !this.enemyPreview?.containsScreenPoint(point.x, point.y),
    });
  }

  /** 지도 선택 취소는 미리보기와 출격 대상/버튼을 함께 초기화한다. */
  private dismissNodeSelection(): void {
    this.enemyPreview?.dismiss(); this.selectedNode = undefined; this.startButton?.setEnabled(false);
  }

  /** 노드 종류별 전이를 한 진입점에서 직렬화하며 저장 성공 전에는 다른 노드를 받지 않는다. */
  private handleNodeSelection(node: ExpeditionMapNode, nodeY: number): void {
    if (this.nodeTransitionPending) return;
    const run = expeditionManager.status().run;
    if (!run || run.relics.every(({ alive }) => !alive) || run.pendingAugmentReward) return;
    // 전투 노드는 스토리 지도처럼 적 정보를 먼저 열며, 팝업의 출전 버튼 전에는 상태를 바꾸지 않는다.
    if (["normal", "elite", "horde", "boss"].includes(node.type)) {
      const names: Record<string, string> = { normal: "일반 조우", elite: "정예 조우", horde: "군집 조우", boss: "원정 보스" };
      const level = expeditionEnemyLevel(node.type, node.floor);
      const enemies = getExpeditionEncounterEnemies(node.type, node.floor);
      this.selectedNode = node; this.startButton?.setEnabled(true);
      // 선택 세대가 바뀌면 프리팹이 기존 SD와 늦게 끝난 로드 요청을 함께 폐기한다.
      this.enemyPreview?.showAt(nodeY, { title: `${node.floor}층 · ${names[node.type]}`, level, enemies, onEnemyClick: (enemy) => this.enemyInfo?.showEnemy(enemy, { level }) });
      return;
    }
    this.nodeTransitionPending = true;
    if (node.type === "rest") {
      this.popups.confirm({ title: "휴식", message: "원정대를 회복하고 이 휴식 지점을 완료합니다.", confirmLabel: "휴식하기" }, () => {
        this.nodeTransitionPending = true;
        // 매니저의 단일 저장이 실패하면 잠금을 풀 뿐, 부분 회복 상태는 존재하지 않는다.
        if (expeditionManager.completeRestNode(node.id)) this.scene.restart();
        else this.nodeTransitionPending = false;
      });
      this.nodeTransitionPending = false;
      return;
    }
    void this.completeTreasureNode(node);
  }

  /** 정보 확인 뒤 출전을 누른 경우에만 증강 선택 또는 실제 전장으로 전이한다. */
  private confirmNodeSortie(node: ExpeditionMapNode): void {
    if (this.nodeTransitionPending) return;
    this.nodeTransitionPending = true;
    if (node.type === "boss") { this.enterBossBattle(node); return; }
    const pending = expeditionManager.beginAugmentReward(node.id, node.type);
    if (pending) this.scene.restart(); else this.enterBattle(node);
  }

  /** 선택이 모두 저장된 바로 그 노드로 진입해, 후보 확정 뒤 다른 지도 노드를 누를 틈을 만들지 않는다. */
  private enterBattle(node: ExpeditionMapNode): void {
    const run = expeditionManager.status().run;
    if (!run) { this.nodeTransitionPending = false; return; }
    const input: ExpeditionBattleInputDto = { mode: "expedition", runId: run.runId, nodeId: node.id, nodeType: node.type as ExpeditionBattleInputDto["nodeType"], floor: node.floor, relics: run.relics.map(({ relicId, currentHp, alive }) => ({ relicId, currentHp, alive })), augments: run.selectedAugments };
    this.scene.start("battle", input);
  }

  /** 서버 제출과 완료 정산의 멱등 키를 먼저 런에 고정한 뒤 불사 보스 전장으로 이동한다. */
  private enterBossBattle(node: ExpeditionMapNode): void {
    const run = expeditionManager.status().run;
    const ids = expeditionManager.prepareBossRequests(node.id);
    if (!run || !ids || node.floor !== 20) { this.nodeTransitionPending = false; return; }
    const input: ExpeditionBossBattleInputDto = { mode: "expeditionBoss", runId: run.runId, nodeId: node.id, floor: 20, relics: run.relics.map(({ relicId, currentHp, alive }) => ({ relicId, currentHp, alive })), augments: run.selectedAugments, ...ids };
    this.scene.start("battle", input);
  }

  /** Fake 서버가 정한 보상 DTO를 받은 뒤에만 보물 노드를 완료하며 증강 경로는 열지 않는다. */
  private async completeTreasureNode(node: ExpeditionMapNode): Promise<void> {
    const run = expeditionManager.status().run;
    if (!run) { this.nodeTransitionPending = false; return; }
    try {
      // 보상 필드가 없는 완료 계약이므로 재화 종류나 수량을 위조할 수 없다.
      await gameApi.completeExpeditionNode({ requestId: `${run.runId}:${node.id}`, runId: run.runId, nodeId: node.id, relicHp: run.relics.map(({ currentHp }) => currentHp) });
      this.scene.restart();
    } catch { this.nodeTransitionPending = false; }
  }

  /** 저장된 제안만 표시하며 선택 성공 뒤 재시작해서 다음 라운드 또는 지도를 활성화한다. */
  private openAugmentReward(): void {
    const run = expeditionManager.status().run;
    const pending = run?.pendingAugmentReward;
    if (!run || !pending) return;
    // 저장된 nodeId가 전투 후보와 함께 복원되므로 앱 재시작 뒤에도 재추첨이나 지도 우회가 없다.
    const node = run.nodes.find(({ id }) => id === pending.nodeId);
    if (!node) return;
    new ExpeditionAugmentPopup(this, { round: pending.round, totalRounds: pending.totalRounds, offers: pending.offers, targets: this.augmentTargetPicker(), onChoose: (selection) => {
      if (this.nodeTransitionPending) return;
      this.nodeTransitionPending = true;
      // 확정은 UI가 Session을 쓰지 않고 매니저의 후보·대상·중첩 검증을 반드시 통과한다.
      if (!expeditionManager.chooseAugment(selection)) { this.nodeTransitionPending = false; return; }
      const next = expeditionManager.status().run?.pendingAugmentReward;
      if (next) this.scene.restart();
      else this.enterBattle(node);
    } }).open();
  }

  /** 하단 요약을 누르면 축약되지 않은 전체 증강과 개인 대상을 공용 상세 쪽지에서 확인한다. */
  private buildAugmentChips(augments: readonly ExpeditionAugmentSelection[]): void {
    if (augments.length === 0) return;
    // 요약 줄은 배치표의 제 구역 가운데에 선다. 아래 생존 HUD가 전투와 같은 크기로 커졌다.
    const CHIP_Y = (EXPEDITION_LAYOUT.augments.top + EXPEDITION_LAYOUT.augments.bottom) / 2;
    const visible = augments.slice(0, 4);
    const labels = visible.map(({ augmentId, targetRelicId }) => {
      const name = getExpeditionAugment(augmentId)?.name ?? augmentId;
      return targetRelicId ? `${name} · ${getRelic(targetRelicId).name}` : name;
    });
    if (augments.length > visible.length) labels.push(`+${augments.length - visible.length}`);
    const width = 190;
    const gap = 16;
    const total = labels.length * width + (labels.length - 1) * gap;
    labels.forEach((label, index) => {
      const x = (BASE_WIDTH - total) / 2 + width / 2 + index * (width + gap);
      const targeted = visible[index]?.targetRelicId !== undefined;
      drawLayer(this, x, CHIP_Y, chipPoints(width, 62, { bevel: { topLeft: 18, bottomRight: 14 } }), { fill: targeted ? 0x302238 : COLOR.panel, alpha: HOLO.glass, edge: targeted ? COLOR.sortie : COLOR.accent, edgeAlpha: 0.66 });
      this.add.text(x, CHIP_Y, `${targeted ? "개인" : "전체"} · ${label}`, textStyle({ role: "emphasis", size: 18, color: targeted ? COLOR.sortieText : COLOR.accentText })).setOrigin(0.5);
    });
    // +N뿐 아니라 보이는 칩을 눌러도 같은 전체 목록이 열려 발견 가능성을 높인다.
    const hit = this.add.rectangle(BASE_WIDTH / 2, CHIP_Y, Math.min(BASE_WIDTH - 100, total), 76, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.openAugmentDetails(augments));
  }

  /** 선택 순서대로 이름·등급·범위·수치와 개인 대상을 모두 펼쳐 보여 준다. */
  private openAugmentDetails(augments: readonly ExpeditionAugmentSelection[]): void {
    // 한 장에 열 개씩 넘겨 작은 화면에서도 모든 항목과 닫기 조작이 판 안에 머물게 한다.
    const pageSize = 10;
    const pageCount = Math.ceil(augments.length / pageSize);
    const height = Math.min(1120, 250 + Math.min(pageSize, augments.length) * 82);
    this.popups.open({ width: 850, height, title: `확정 증강 ${augments.length}`, dim: true }, (body) => {
      const list = this.add.container(0, 0); body.add(list);
      const pageLabel = this.add.text(0, height / 2 - 58, "", textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5); body.add(pageLabel);
      let page = 0;
      const render = (): void => {
        list.removeAll(true);
        augments.slice(page * pageSize, (page + 1) * pageSize).forEach(({ augmentId, targetRelicId }, index) => {
          const def = getExpeditionAugment(augmentId);
          if (!def) return;
          const target = targetRelicId ? ` · ${getRelic(targetRelicId).name}` : "";
          list.add(this.add.text(-355, -height / 2 + 105 + index * 82, `${def.name}  ${expeditionAugmentMetaLabel(def)}${target}\n${expeditionAugmentEffectLabel(def)}`, textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
        });
        pageLabel.setText(`${page + 1} / ${pageCount}`);
      };
      if (pageCount > 1) {
        // 페이지 이동은 목록을 닫지 않아 4개 이후의 개인 대상도 연속해서 대조할 수 있다.
        body.add(new Button(this, -170, height / 2 - 58, { width: 180, height: 58, label: "이전", fontSize: 20, onClick: () => { page = (page - 1 + pageCount) % pageCount; render(); } }));
        body.add(new Button(this, 170, height / 2 - 58, { width: 180, height: 58, label: "다음", fontSize: 20, onClick: () => { page = (page + 1) % pageCount; render(); } }));
      }
      render();
    });
  }

  /** 실제 전투 프로필처럼 초상 아래에 현재 체력과 0부터 시작할 야성 게이지를 함께 표시한다. */
  private buildRelicHud(relics: readonly { relicId: string; currentHp: number; alive: boolean }[]): void {
    relics.forEach((state, index) => {
      const def = getRelic(state.relicId); const x = BATTLE_PROFILE_LAYOUT.expedition.centersX[index];
      const hpRatio = Math.max(0, Math.min(100, state.currentHp)) / 100;
      const maxHp = Math.round(relicProgression.getFinalStats(def.id).hp);
      const currentHp = state.alive ? Math.round(maxHp * hpRatio) : 0;
      // 지도는 카드·게이지·글자를 개별 축소하지 않고 전투와 같은 한 칸을 그대로 세운다.
      // 생존은 노란 발광으로 알리지 않는다 — 그 발광은 전투에서 "궁극기가 찼다"는 뜻이다.
      const profile = new BattleProfile(this, x, BATTLE_PROFILE_LAYOUT.expedition.centerY, {
        relic: def, level: relicProgression.getProgress(def.id).level, stars: relicProgression.getStars(def.id),
        currentHp, maxHp, ferocity: 0, active: false, readOnly: true, dead: !state.alive,
      }).setScale(BATTLE_PROFILE_LAYOUT.expedition.scale);
      this.relicProfiles.set(state.relicId, profile);
    });
  }

  /**
   * 증강 팝업에 아군 선택을 빌려주는 경계다.
   *
   * 팝업은 화면을 덮는 암전을 깔므로, 고르는 동안만 HUD를 그 암전 위로 올리고 입력을 연다.
   * 확정되면 깊이·명도·입력을 모두 되돌려 지도 화면은 원래의 읽기 전용 HUD로 남는다.
   */
  private augmentTargetPicker(): AugmentTargetPicker {
    const profiles = this.relicProfiles;
    return {
      attach: (onPick) => {
        profiles.forEach((profile, relicId) => {
          profile.setDepth(AUGMENT_PICKER_DEPTH);
          profile.card.hit.setInteractive({ useHandCursor: true });
          profile.card.hit.on("pointerup", () => onPick(relicId));
        });
      },
      setEligible: (relicIds) => {
        profiles.forEach((profile, relicId) => {
          profile.setAlpha(relicIds === null || relicIds.includes(relicId) ? 1 : 0.3);
          profile.card.setSelected(false, COLOR.sortie);
        });
      },
      setChosen: (chosenId) => {
        profiles.forEach((profile, relicId) => {
          profile.setAlpha(relicId === chosenId ? 1 : 0.42);
          // 고른 대상만 호박빛으로 남는다. 확정 버튼과 같은 색이라 다음 조작이 이어진다.
          profile.card.setSelected(relicId === chosenId, COLOR.missionClaim);
        });
      },
      detach: () => {
        profiles.forEach((profile) => {
          profile.setDepth(0).setAlpha(1);
          profile.card.hit.removeAllListeners("pointerup");
          profile.card.hit.disableInteractive();
          profile.card.setSelected(false);
          profile.syncMask();
        });
      },
    };
  }

  /** 임시 보상과 포기 결과를 먼저 보여 준 뒤 서버 원자 정산만 호출한다. */
  private confirmAbandon(): void {
    const run = expeditionManager.status().run; if (!run) return;
    const reward = Object.values(run.pendingRewards).reduce((sum, amount) => sum + Math.floor(amount), 0);
    this.popups.confirm({ title: "원정 포기", message: `임시 보상 ${reward.toLocaleString()}개가 지갑으로 이전됩니다.\n이번 런의 최고 점수는 주간 기록에 반영되지 않습니다.`, confirmLabel: "포기 확정", destructive: true }, async () => {
      const settlement = await gameApi.settleExpeditionRun({ runId: run.runId, settlementId: `${run.runId}:abandon`, outcome: "abandoned" });
      // 지갑 상한 적용 뒤 실제 들어온 양만 영수증에 표시하고 확인 후 로비로 돌아간다.
      openRewardPopup(this, this.popups, { title: "포기 전리품 정산", items: currencyRecordToRewardItems(settlement.granted), onConfirm: () => this.scene.start("lobby") });
    });
  }

  /**
   * 원정의 첫 화면. 순위와 기록 보상을 먼저 보여 주고 출격 버튼으로 편성을 연다.
   *
   * 들어오자마자 편성판이 뜨면 "이번 주에 내가 어디쯤인가"를 볼 자리가 없다. 보스가 위에 서고
   * 순위판이 그 허리 아래를 덮으며 내려와 한 장의 기록 화면으로 읽힌다.
   */
  private buildRanking(status = expeditionManager.status()): void {
    void this.loadBossPortrait();
    // 순위는 훑어 읽는 표라 판을 불투명하게 둔다. 반투명하면 뒤의 보스 옷자락과 글자가 섞인다.
    const board = drawLayer(this, BASE_WIDTH / 2, RANKING.board.y, chipPoints(RANKING.board.width, RANKING.board.height, { bevel: { topLeft: 74, bottomRight: 74 } }), { fill: 0x0b0f15, alpha: 0.98, edge: COLOR.accent, edgeAlpha: 0.6 });
    board.setDepth(10);
    const header = this.add.container(0, 0).setDepth(11);
    // 제목은 순위 목록 쪽에만 둔다. 왼쪽 기둥의 첫 줄이 이미 "내 최고 순위"라 두 제목이 겹친다.
    header.add(this.add.text(RANKING.rows.x, RANKING.board.y - RANKING.board.height / 2 + 46, "주간 순위", textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5));
    header.add(this.add.text(RANKING.rows.x, RANKING.board.y + RANKING.board.height / 2 - 36, "동점은 최고점을 먼저 찍은 쪽이 앞선다", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5));
    this.renderRankingBoard("기록 동기화 중");
    void this.refreshRanking();

    // 출격은 화면 하단의 고정 행동선 하나뿐이다. 편성은 그다음 단계로 열린다.
    new Button(this, BASE_WIDTH / 2, RANKING.sortie.y, {
      width: 560, height: 132, label: "출  격", sub: `이번 주 ${status.playsThisWeek}회`, fontSize: 42,
      variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText,
      onClick: () => this.scene.restart({ stage: "preparation" }),
    });
  }

  /** 보스 전신은 판보다 뒤에 서서 허리 아래를 순위판이 덮게 한다. */
  private async loadBossPortrait(): Promise<void> {
    const asset = portraitAssetFor("pontus");
    const puppet = await spawnPuppet(this, asset, { x: BASE_WIDTH / 2, groundY: RANKING.boss.groundY, height: RANKING.boss.height, depth: 5 });
    if (!this.scene.isActive() || this.stage !== "ranking" || expeditionManager.status().active) { puppet.destroy(); return; }
    puppet.disableInteractive();
    this.bossPortrait?.destroy();
    this.bossPortrait = puppet;
  }

  /** 서버 스냅샷이 오기 전에도 자리를 잡아 두어 판이 비어 보이지 않게 한다. */
  private renderRankingBoard(message: string, best?: { rank?: number; bestScore: number; cumulativeScore: number }, entries: readonly ExpeditionLeaderboardEntry[] = []): void {
    this.rankingRows?.destroy();
    const rows = this.add.container(0, 0).setDepth(12);
    this.rankingRows = rows;
    const { side, rows: list, board } = RANKING;
    // 판 윗변에서 잰 자리만 쓴다. 판 높이가 바뀌어도 기둥과 목록이 같이 따라온다.
    const top = board.y - board.height / 2;
    // 왼쪽 기둥: 내 최고 순위와 점수, 그 아래 기록 보상 입구.
    rows.add(this.add.text(side.x, top + 100, "내 최고 순위", textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5));
    rows.add(this.add.text(side.x, top + 174, best?.rank ? `${best.rank}위` : "—", textStyle({ role: "display", size: 66, color: COLOR.accentText })).setOrigin(0.5));
    rows.add(this.add.text(side.x, top + 262, "최고 점수", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5));
    rows.add(this.add.text(side.x, top + 304, (best?.bestScore ?? 0).toLocaleString(), textStyle({ role: "display", size: 34 })).setOrigin(0.5));
    rows.add(this.add.text(side.x, top + 372, "누적 점수", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5));
    rows.add(this.add.text(side.x, top + 412, (best?.cumulativeScore ?? 0).toLocaleString(), textStyle({ role: "emphasis", size: 27, color: COLOR.ink })).setOrigin(0.5));
    rows.add(new Button(this, side.x, top + 520, { width: 300, height: 92, label: "기록 보상", fontSize: 27, onClick: () => void new ExpeditionRewardPopup(this, this.popups).open() }));

    if (message) {
      rows.add(this.add.text(list.x, top + 300, message, textStyle({ role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: list.width - 60 })).setOrigin(0.5));
      return;
    }
    entries.slice(0, list.max).forEach((entry, index) => {
      const y = list.firstY + index * list.gap;
      const row = this.add.container(list.x, y).setScale(entry.isMe ? 1.05 : 1);
      row.add(drawLayer(this, 0, 0, chipPoints(list.width, 70, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: entry.isMe ? 0x263844 : 0x171d25, alpha: HOLO.glass, edge: entry.isMe ? COLOR.accent : COLOR.panelEdge, edgeAlpha: entry.isMe ? 0.7 : 0.24 }));
      row.add(this.add.text(-list.width / 2 + 28, 0, `${entry.rank}위`, textStyle({ role: "emphasis", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5));
      row.add(this.add.text(-list.width / 2 + 120, 0, entry.displayName, textStyle({ role: "body", size: 23, color: entry.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5));
      row.add(this.add.text(list.width / 2 - 28, 0, entry.score.toLocaleString(), textStyle({ role: "emphasis", size: 23 })).setOrigin(1, 0.5));
      rows.add(row);
    });
  }

  /** 최고 기록과 순위표는 같은 주차일 때만 함께 보여 준다. */
  private async refreshRanking(): Promise<void> {
    try {
      const [best, leaderboard] = await Promise.all([gameApi.getExpeditionWeeklyBest(), gameApi.getExpeditionLeaderboard(10)]);
      if (!this.scene.isActive() || this.stage !== "ranking") return;
      if (best.weekKey !== leaderboard.weekKey) { this.renderRankingBoard("주차가 바뀌었습니다. 다시 들어와 주세요."); return; }
      const mine = leaderboard.entries.find((entry) => entry.isMe);
      this.renderRankingBoard(leaderboard.entries.length ? "" : "아직 등록된 기록이 없습니다", { rank: mine?.rank, bestScore: best.bestScore, cumulativeScore: best.cumulativeScore }, leaderboard.entries);
    } catch {
      if (!this.scene.isActive() || this.stage !== "ranking") return;
      this.renderRankingBoard("기록을 불러오지 못했습니다");
    }
  }

  /** 보유 렐릭에서 정확히 세 기를 고르는 신규 원정 준비 화면을 만든다. */
  private buildPreparation(): void {
    this.add.text(BASE_WIDTH / 2, 292, "원정대 3기 선택", textStyle({ role: "emphasis", size: 32 })).setOrigin(0.5);
    if (import.meta.env.DEV) {
      // 임시 개발 도구: Session을 건드리지 않고 매니저가 만든 실제 20층 노드를 열어 미리보기와 출격 흐름을 그대로 검수한다.
      new Button(this, 170, 292, { width: 230, height: 68, label: "DEV · 20층", fontSize: 21, fill: 0x3b2330, accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.openDevelopmentBossShortcut() });
    }
    // 서버가 빠른 원정을 열어 두었을 때만 버튼이 생긴다. 조회 중이라거나 열리지 않았다는 말은
    // 플레이어의 선택을 바꾸지 않으므로 화면에 남기지 않는다.
    void this.loadQuickExpeditionOffer();
    this.renderFormationPreview();

    const owned = [...session.owned].map(getRelic);
    const gridWidth = ROSTER.columns * ROSTER.width + (ROSTER.columns - 1) * ROSTER.gapX;
    const startX = (BASE_WIDTH - gridWidth) / 2 + ROSTER.width / 2;
    owned.forEach((relic, index) => {
      const card = new PortraitCard(this, startX + (index % ROSTER.columns) * (ROSTER.width + ROSTER.gapX), ROSTER.top + Math.floor(index / ROSTER.columns) * (ROSTER.height + ROSTER.gapY), {
        width: ROSTER.width,
        height: ROSTER.height,
        portraitAssetId: relic.portraitAssetId,
        tint: relicCardTint(relic),
        label: relic.name,
        level: relicProgression.getProgress(relic.id).level,
        rarity: relic.rarity,
        stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
        // 상단 편성 슬롯과 구분되도록 선택 카드는 발광뿐 아니라 눌린 듯한 검정 면도 함께 쓴다.
        selectedOverlayAlpha: 0.28,
      });
      // 카드는 선택만 바꾸며 Session을 쓰지 않는다. 시작 버튼에서 매니저가 최종 소유 검증을 반복한다.
      card.hit.on("pointerup", () => this.toggle(relic.id));
      this.cards.set(relic.id, card);
    });

    this.hint = this.add.text(BASE_WIDTH / 2, 1550, "3기를 선택하세요", textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0.5);
    this.startButton = new Button(this, BASE_WIDTH / 2, 1680, {
      width: 560,
      height: 132,
      label: "원정 시작",
      sub: "0 / 3",
      fontSize: 42,
      variant: "primary",
      accentColor: COLOR.sortie,
      accentTextColor: COLOR.sortieText,
      onClick: () => this.startExpedition(),
    });
    this.startButton.setEnabled(false);
  }

  /** 개발 빌드의 임시 버튼은 현재 편성을 우선 보존하고, 비어 있으면 보유 목록의 첫 세 기만 편성 후보로 넘긴다. */
  private openDevelopmentBossShortcut(): void {
    const relicIds = this.selected.length === 3 ? [...this.selected] : [...session.owned].slice(0, 3);
    const result = expeditionManager.prepareDevelopmentBossShortcut(relicIds);
    if (result.ok) {
      // 재시작 뒤 실제 보스 노드를 눌러 적 미리보기를 확인하고, 기존 enterBossBattle 출격 DTO로 진입한다.
      this.scene.restart();
      return;
    }
    this.hint?.setText(result.reason === "developmentOnly" ? "개발 빌드에서만 사용할 수 있습니다" : this.failureMessage(result.reason));
  }

  /** 서버가 활성화한 슬롯의 문구·비율·일일/주간 한도만 준비 화면에 결합한다. */
  private async loadQuickExpeditionOffer(): Promise<void> {
    try {
      const config = await gameApi.getAdOperationsConfig();
      if (!this.scene.isActive()) return;
      const slot = config.slots.find((candidate): candidate is AdSlotOperationsDto & { reward: { readonly kind: "quick_expedition"; readonly scoreRatio: number } } => candidate.slotId === "quick-expedition" && candidate.enabled && candidate.reward.kind === "quick_expedition");
      if (!slot) return;
      const sameDay = session.dailyAdRewards.date === config.serverTime.slice(0, 10);
      const dailyUsed = sameDay ? session.dailyAdRewards.claimsBySlot[slot.slotId] ?? 0 : 0;
      const dailyRemaining = Math.max(0, slot.dailyLimitUtc - dailyUsed);
      const weeklyRemaining = Math.max(0, (slot.weeklyLimitUtc ?? 0) - (slot.weeklyClaims ?? 0));
      const reference = Math.max(0, Math.floor(slot.referenceScore ?? 0));
      const expected = Math.floor(reference * slot.reward.scoreRatio);
      if (reference <= 0 || expected <= 0 || dailyRemaining <= 0 || weeklyRemaining <= 0) return;
      // 주 행동과 떨어진 낮고 작은 중립 버튼으로 위계를 명확히 나눈다. 버튼이 보상과 남은
      // 횟수를 직접 말하므로 별도 상태 문구를 두지 않는다.
      this.quickButton?.destroy();
      this.quickButton = new Button(this, 230, 1800, { width: 340, height: 84, label: slot.displayText, sub: `골드 ${expected.toLocaleString()} · 오늘 ${dailyRemaining}회`, fontSize: 25, subFontSize: 18, onClick: () => void this.claimQuickExpedition(slot) });
    } catch { /* 조회 실패는 그 자리를 비운다. 실패했다는 말은 플레이어가 할 일을 바꾸지 않는다. */ }
  }

  /** 기존 발굴 광고와 같은 토큰 추출·연타 잠금·고유 요청 ID 흐름으로 서버 지급을 요청한다. */
  private async claimQuickExpedition(slot: AdSlotOperationsDto): Promise<void> {
    if (this.quickClaimPending) return;
    this.quickClaimPending = true; this.quickButton?.setEnabled(false);
    try {
      const token = completedAdToken(await presentRewardedAd(slot.slotId));
      if (!token) { this.hint?.setText("광고가 취소되었습니다"); this.quickButton?.setEnabled(true); return; }
      const requestId = globalThis.crypto?.randomUUID?.() ?? `quick-expedition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await gameApi.claimAdReward({ slotId: "quick-expedition", verificationToken: token, requestId });
      const gained = Math.max(0, result.granted.gold ?? 0);
      // 응답 스냅샷으로 로컬 준비 화면과 상단 지갑의 다음 방문 상태를 함께 갱신한다.
      session.wallet = { ...result.wallet };
      session.dailyAdRewards = { date: result.dailyAdRewards.date, claimsBySlot: { ...result.dailyAdRewards.claimsBySlot }, requestIds: session.dailyAdRewards.requestIds };
      await this.loadQuickExpeditionOffer();
      if (gained === 0) this.hint?.setText("골드 지갑이 가득 찼습니다");
      else openRewardPopup(this, this.popups, { title: "빠른 원정 완료", items: [{ icon: "currency-gold", amount: gained, label: "실제 지갑 증가" }] });
    } catch (error) {
      const code = error instanceof GameApiError ? error.code : undefined;
      const message: Partial<Record<string, string>> = {
        AD_TOKEN_INVALID: "광고 검증에 실패했습니다 · 다시 시도하세요",
        AD_DAILY_LIMIT: "오늘 횟수를 모두 사용했습니다 · 내일 다시 오세요",
        AD_WEEKLY_LIMIT: "이번 주 횟수를 모두 사용했습니다 · 다음 주에 다시 오세요",
        EXPEDITION_SCORE_REQUIRED: "기준 점수가 없습니다 · 원정 최고점을 먼저 기록하세요",
      };
      this.hint?.setText(message[code ?? ""] ?? "잠시 후 다시 시도해 주세요");
      this.quickButton?.setEnabled(!["AD_DAILY_LIMIT", "AD_WEEKLY_LIMIT", "EXPEDITION_SCORE_REQUIRED"].includes(code ?? ""));
    } finally {
      this.quickClaimPending = false;
    }
  }

  /** 1/2/3 슬롯과 선택 렐릭 SD를 한 번에 다시 그리며 로딩 실패 시에는 초상 카드를 유지한다. */
  private renderFormationPreview(): void {
    this.clearFormationPreview();
    const generation = ++this.formationGeneration;
    const layer = this.add.container(0, 0).setName("expedition-formation-preview");
    this.formationPreview = layer;
    for (let index = 0; index < 3; index += 1) {
      const x = FORMATION.firstX + index * FORMATION.stepX;
      // 번호는 카드 위 독립 표식으로 두어 SD가 나타나도 편성 순서를 잃지 않는다.
      layer.add(this.add.text(x, FORMATION.y - 172, `${index + 1}`, textStyle({ role: "display", size: 30, color: COLOR.sortieText })).setOrigin(0.5));
      const relicId = this.selected[index];
      if (!relicId) {
        layer.add(drawLayer(this, x, FORMATION.y, chipPoints(FORMATION.width, FORMATION.height, { bevel: { topLeft: 24, bottomRight: 18 } }), { fill: COLOR.panel, alpha: HOLO.glassLight, edge: COLOR.inkDimHex, edgeAlpha: 0.42 }));
        layer.add(this.add.text(x, FORMATION.y, "선택 대기", textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
        continue;
      }
      const relic = getRelic(relicId);
      const fallback = new PortraitCard(this, x, FORMATION.y, { width: FORMATION.width, height: FORMATION.height, portraitAssetId: relic.portraitAssetId, tint: relicCardTint(relic), label: relic.name, level: relicProgression.getProgress(relic.id).level, rarity: relic.rarity, stars: relicProgression.getStars(relic.id) });
      fallback.hit.disableInteractive(); layer.add(fallback);
      layer.add(this.add.ellipse(x, FORMATION.y + 120, 190, 28, COLOR.sortie, 0.18));
      void loadOwnedPuppet({
        spawn: () => spawnPuppet(this, sdAssetFor(relicId), { x, groundY: FORMATION.y + 120, height: 250, depth: 2 }),
        isCurrent: () => generation === this.formationGeneration && layer === this.formationPreview,
        isDisplayable: (puppet) => Boolean(puppet.active && puppet.texture?.key && this.textures.exists(puppet.texture.key)),
        adopt: (puppet) => { puppet.disableInteractive(); layer.add(puppet); this.formationPuppets.add(puppet); fallback.setVisible(false); },
      });
    }
  }

  /** 컨테이너 밖 GPU 자원을 포함한 이전 SD 미리보기를 선택 변경 전에 명시적으로 정리한다. */
  private clearFormationPreview(): void {
    this.formationGeneration += 1;
    for (const puppet of this.formationPuppets) { this.formationPreview?.remove(puppet, false); puppet.destroy(); }
    this.formationPuppets.clear();
    this.formationPreview?.destroy(true);
    this.formationPreview = undefined;
  }

  /** 네 번째 선택은 받지 않고 카드 발광과 선택 수만 동기화한다. */
  private toggle(relicId: string): void {
    const index = this.selected.indexOf(relicId);
    if (index >= 0) this.selected.splice(index, 1);
    else if (this.selected.length < 3) this.selected.push(relicId);
    // 상단 슬롯은 배열 순서를 그대로 사용해 전방부터 1/2/3번 편성을 즉시 확인시킨다.
    this.renderFormationPreview();
    this.cards.forEach((card, id) => card.setSelected(this.selected.includes(id), COLOR.sortie));
    this.startButton?.setSub(`${this.selected.length} / 3`).setEnabled(this.selected.length === 3);
    this.hint.setText(this.selected.length === 3 ? "출발 준비 완료" : "3기를 선택하세요");
  }

  /** 선택 배열을 직접 저장하지 않고 매니저의 검증 완료 상태 전이만 요청한다. */
  private startExpedition(): void {
    const result = expeditionManager.start([...this.selected]);
    if (result.ok) {
      // 성공 결과는 이미 저장까지 완료되었으므로 같은 씬을 다시 그려 이어하기 상태로 전환한다.
      this.scene.restart();
      return;
    }
    this.hint.setText(this.failureMessage(result.reason));
  }

  /** 공개 실패 코드를 화면에 필요한 짧은 행동 문구로만 바꾼다. */
  private failureMessage(reason: StartExpeditionFailure): string {
    if (reason === "alreadyActive") return "진행 중인 원정이 있습니다";
    if (reason === "notOwned") return "보유 렐릭만 선택할 수 있습니다";
    return "서로 다른 렐릭 3기를 선택하세요";
  }
}
