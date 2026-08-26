import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type AdSlotOperationsDto } from "../api/contracts";
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
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawVignette, HoloBar, HOLO } from "../ui/holo";
import { EXPEDITION_LAYOUT } from "../ui/expeditionLayout";
import { ExpeditionMapView } from "../ui/ExpeditionMapView";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";
import type { ExpeditionBattleInputDto, ExpeditionBossBattleInputDto } from "../core/expeditionBattle";
import { ExpeditionAugmentPopup, expeditionAugmentEffectLabel, expeditionAugmentMetaLabel } from "../ui/ExpeditionAugmentPopup";
import { EXPEDITION_NODE_REWARD_BALANCE } from "../data/expedition";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd } from "../platform/rewardedAds";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { ExpeditionRankingPopup } from "../ui/ExpeditionRankingPopup";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { loadOwnedPuppet } from "../ui/statusPuppetLoad";
import { expeditionEnemyLevel, getExpeditionNodeEnemies } from "../data/expeditionEnemies";
import { formatCurrency } from "../core/formatCurrency";
import { drawInnerVignette, drawShapeOutline } from "../ui/holo";

/** 원정 준비 카드의 고정 그리드 규격이다. 다른 편성과 달리 세 칸씩 읽게 한다. */
const ROSTER = { columns: 3, width: 250, height: 310, gapX: 56, gapY: 50, top: 940 } as const;
/** 발굴 편성처럼 화면 상단에서 순서를 먼저 읽는 1/2/3 슬롯 규격이다. */
const FORMATION = { y: 540, firstX: 230, stepX: 310, width: 250, height: 290 } as const;

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
  private quickStatus?: Phaser.GameObjects.Text;
  /** 선택 미리보기와 비동기 SD는 매 선택마다 함께 폐기해 이전 편성이 겹치지 않게 한다. */
  private formationPreview?: Phaser.GameObjects.Container;
  private formationPuppets = new Set<PuppetCreature>();
  private formationGeneration = 0;

  constructor() {
    super("expedition");
  }

  create(): void {
    setDebugScene("expedition");
    this.selected = [];
    this.cards.clear();
    this.popups = new PopupLayer(this);
    this.nodeTransitionPending = false;
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
    else this.buildPreparation();

    // 화면을 벗어나는 조작은 공용 우하단 슬롯만 사용한다.
    addBackButton(this, () => this.scene.start("lobby"));
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
    new ExpeditionMapView(this, {
      top: EXPEDITION_LAYOUT.map.top,
      bottom: EXPEDITION_LAYOUT.map.bottom,
      nodes,
      currentNodeId,
      visitedIds,
      onSelect: (node) => this.handleNodeSelection(node),
    });
  }

  /** 노드 종류별 전이를 한 진입점에서 직렬화하며 저장 성공 전에는 다른 노드를 받지 않는다. */
  private handleNodeSelection(node: ExpeditionMapNode): void {
    if (this.nodeTransitionPending) return;
    const run = expeditionManager.status().run;
    if (!run || run.relics.every(({ alive }) => !alive) || run.pendingAugmentReward) return;
    // 전투 노드는 스토리 지도처럼 적 정보를 먼저 열며, 팝업의 출전 버튼 전에는 상태를 바꾸지 않는다.
    if (["normal", "elite", "horde", "boss"].includes(node.type)) { this.openNodeIntel(node); return; }
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

  /** 적 세 기와 층 정보를 먼저 제시하고 명시적인 출전 입력에서만 기존 진입 흐름을 이어 간다. */
  private openNodeIntel(node: ExpeditionMapNode): void {
    const names: Record<string, string> = { normal: "일반 조우", elite: "정예 조우", horde: "군집 조우", boss: "원정 보스" };
    this.popups.open({ width: 900, height: 780, title: `${node.floor}층 · ${names[node.type] ?? "조우"}`, dim: true }, (body, close) => {
      body.add(this.add.text(0, -282, "적 캐릭터 정보", textStyle({ role: "emphasis", size: 24, color: COLOR.dangerText })).setOrigin(0.5));
      const enemyLevel = expeditionEnemyLevel(node.type, node.floor);
      getExpeditionNodeEnemies(node.type, node.floor).forEach((enemy, index) => {
        const x = -270 + index * 270;
        const card = new PortraitCard(this, x, -80, { width: 210, height: 250, portraitAssetId: enemy.portraitAssetId, tint: relicCardTint(enemy), label: enemy.name, sub: `LV.${enemyLevel}`, rarity: enemy.rarity, affinity: { element: enemy.element, role: enemy.role } });
        card.hit.disableInteractive(); body.add(card); card.syncMask();
      });
      // 스토리 출전 버튼의 주황색·큰 사선 판을 따라 세 캐릭터 그리드 바로 아래에 둔다.
      body.add(new Button(this, 0, 292, { width: 560, height: 112, label: "출격하기", icon: "sortie", variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, decorDots: true, onClick: () => { close(); this.confirmNodeSortie(node); } }));
    });
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
    new ExpeditionAugmentPopup(this, { round: pending.round, totalRounds: pending.totalRounds, offers: pending.offers, relics: run.relics, onChoose: (selection) => {
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
      drawLayer(this, x, 1260, chipPoints(width, 62, { bevel: { topLeft: 18, bottomRight: 14 } }), { fill: targeted ? 0x302238 : COLOR.panel, alpha: HOLO.glass, edge: targeted ? COLOR.sortie : COLOR.accent, edgeAlpha: 0.66 });
      this.add.text(x, 1260, `${targeted ? "개인" : "전체"} · ${label}`, textStyle({ role: "emphasis", size: 18, color: targeted ? COLOR.sortieText : COLOR.accentText })).setOrigin(0.5);
    });
    // +N뿐 아니라 보이는 칩을 눌러도 같은 전체 목록이 열려 발견 가능성을 높인다.
    const hit = this.add.rectangle(BASE_WIDTH / 2, 1260, Math.min(BASE_WIDTH - 100, total), 76, 0xffffff, 0).setInteractive({ useHandCursor: true });
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

  /** 세 렐릭의 초상, 사망 문구, 현재 HP를 공용 HoloBar와 함께 표시한다. */
  private buildRelicHud(relics: readonly { relicId: string; currentHp: number; alive: boolean }[]): void {
    relics.forEach((state, index) => {
      const def = getRelic(state.relicId); const x = 220 + index * 320;
      new PortraitCard(this, x, 1455, { width: 190, height: 190, portraitAssetId: def.portraitAssetId, tint: relicCardTint(def), label: def.name, rarity: def.rarity });
      const hp = Math.max(0, Math.min(100, state.currentHp));
      this.add.text(x, 1600, state.alive ? `HP ${Math.ceil(hp)} / 100` : "사망", textStyle({ role: "emphasis", size: 22, color: state.alive ? COLOR.ink : "#ff8c88" })).setOrigin(0.5);
      const bar = new HoloBar(this, x, 1640, 238, 18, { color: state.alive ? COLOR.hpFill : 0x6c7078, outline: true });
      bar.setValue(hp / 100);
    });
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

  /** 보유 렐릭에서 정확히 세 기를 고르는 신규 원정 준비 화면을 만든다. */
  private buildPreparation(): void {
    this.add.text(BASE_WIDTH / 2, 292, "원정대 3기 선택", textStyle({ role: "emphasis", size: 32 })).setOrigin(0.5);
    // 준비 중에도 결과 화면과 같은 서버 기록판을 열어 보상 목표와 동점 순서를 미리 확인한다.
    new Button(this, BASE_WIDTH - 190, 292, { width: 260, height: 68, label: "주간 기록", fontSize: 22, onClick: () => new ExpeditionRankingPopup(this, this.popups).open() });
    // 로컬 quickAvailable은 표시·지급 권한으로 쓰지 않고 서버 운영 설정을 기다리는 자리만 만든다.
    this.quickStatus = this.add.text(BASE_WIDTH / 2, 348, "빠른 원정 확인 중…", textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5);
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

  /** 서버가 활성화한 슬롯의 문구·비율·일일/주간 한도만 준비 화면에 결합한다. */
  private async loadQuickExpeditionOffer(): Promise<void> {
    try {
      const config = await gameApi.getAdOperationsConfig();
      if (!this.scene.isActive()) return;
      const slot = config.slots.find((candidate): candidate is AdSlotOperationsDto & { reward: { readonly kind: "quick_expedition"; readonly scoreRatio: number } } => candidate.slotId === "quick-expedition" && candidate.enabled && candidate.reward.kind === "quick_expedition");
      if (!slot) { this.quickStatus?.setText("기준 점수를 먼저 기록하세요"); return; }
      const sameDay = session.dailyAdRewards.date === config.serverTime.slice(0, 10);
      const dailyUsed = sameDay ? session.dailyAdRewards.claimsBySlot[slot.slotId] ?? 0 : 0;
      const dailyRemaining = Math.max(0, slot.dailyLimitUtc - dailyUsed);
      const weeklyRemaining = Math.max(0, (slot.weeklyLimitUtc ?? 0) - (slot.weeklyClaims ?? 0));
      const reference = Math.max(0, Math.floor(slot.referenceScore ?? 0));
      const expected = Math.floor(reference * slot.reward.scoreRatio);
      this.quickStatus?.setText(`기준 최고 ${reference.toLocaleString()} · 예상 골드 ${expected.toLocaleString()} · 오늘 ${dailyRemaining}회 / 이번 주 ${weeklyRemaining}회`);
      // 주 행동과 떨어진 낮고 작은 중립 버튼으로 위계를 명확히 나눈다.
      this.quickButton?.destroy();
      this.quickButton = new Button(this, 230, 1800, { width: 300, height: 72, label: slot.displayText, fontSize: 25, onClick: () => void this.claimQuickExpedition(slot) });
      this.quickButton.setEnabled(reference > 0 && expected > 0 && dailyRemaining > 0 && weeklyRemaining > 0);
    } catch { this.quickStatus?.setText("빠른 원정을 불러오지 못했습니다"); }
  }

  /** 기존 발굴 광고와 같은 토큰 추출·연타 잠금·고유 요청 ID 흐름으로 서버 지급을 요청한다. */
  private async claimQuickExpedition(slot: AdSlotOperationsDto): Promise<void> {
    if (this.quickClaimPending) return;
    this.quickClaimPending = true; this.quickButton?.setEnabled(false);
    try {
      const token = completedAdToken(await presentRewardedAd(slot.slotId));
      if (!token) { this.quickStatus?.setText("광고가 취소되었습니다 · 다시 눌러 시도하세요"); this.quickButton?.setEnabled(true); return; }
      const requestId = globalThis.crypto?.randomUUID?.() ?? `quick-expedition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await gameApi.claimAdReward({ slotId: "quick-expedition", verificationToken: token, requestId });
      const gained = Math.max(0, result.granted.gold ?? 0);
      // 응답 스냅샷으로 로컬 준비 화면과 상단 지갑의 다음 방문 상태를 함께 갱신한다.
      session.wallet = { ...result.wallet };
      session.dailyAdRewards = { date: result.dailyAdRewards.date, claimsBySlot: { ...result.dailyAdRewards.claimsBySlot }, requestIds: session.dailyAdRewards.requestIds };
      await this.loadQuickExpeditionOffer();
      if (gained === 0) this.quickStatus?.setText("골드 지갑이 가득 찼습니다 · 먼저 골드를 사용하세요");
      else openRewardPopup(this, this.popups, { title: "빠른 원정 완료", items: [{ icon: "currency-gold", amount: gained, label: "실제 지갑 증가" }] });
    } catch (error) {
      const code = error instanceof GameApiError ? error.code : undefined;
      const message: Partial<Record<string, string>> = {
        AD_TOKEN_INVALID: "광고 검증에 실패했습니다 · 다시 시도하세요",
        AD_DAILY_LIMIT: "오늘 횟수를 모두 사용했습니다 · 내일 다시 오세요",
        AD_WEEKLY_LIMIT: "이번 주 횟수를 모두 사용했습니다 · 다음 주에 다시 오세요",
        EXPEDITION_SCORE_REQUIRED: "기준 점수가 없습니다 · 원정 최고점을 먼저 기록하세요",
      };
      this.quickStatus?.setText(message[code ?? ""] ?? "지급에 실패했습니다 · 잠시 후 다시 시도하세요");
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
