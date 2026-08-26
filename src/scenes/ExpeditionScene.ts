import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
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
import { addCurrencyChip } from "../ui/CurrencyChip";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { PopupLayer } from "../ui/PopupLayer";
import { COLOR, textStyle } from "../ui/theme";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawVignette, HoloBar, HOLO } from "../ui/holo";
import { EXPEDITION_LAYOUT } from "../ui/expeditionLayout";
import { ExpeditionMapView } from "../ui/ExpeditionMapView";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";
import type { ExpeditionBattleInputDto } from "../core/expeditionBattle";

/** 원정 준비 카드의 고정 그리드 규격이다. 다른 편성과 달리 세 칸씩 읽게 한다. */
const ROSTER = { columns: 3, width: 250, height: 310, gapX: 56, gapY: 50, top: 470 } as const;

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

  constructor() {
    super("expedition");
  }

  create(): void {
    setDebugScene("expedition");
    this.selected = [];
    this.cards.clear();
    this.popups = new PopupLayer(this);
    this.nodeTransitionPending = false;

    const status = expeditionManager.status();
    // 활성 런은 전용 지도 원화를 쓰고, 편성 단계만 기존 야외 조사 배경을 유지한다.
    addSceneBackground(this, status.active ? BACKGROUND.expeditionMap : BACKGROUND.archaeology);
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
    else this.buildPreparation(status.quickAvailable);

    // 화면을 벗어나는 조작은 공용 우하단 슬롯만 사용한다.
    addBackButton(this, () => this.scene.start("lobby"));
  }

  /** 진행 중 원정은 보상·상승 지도·증강·생존 HUD를 서로 겹치지 않는 안전 구역에 배치한다. */
  private buildActive(score: number, augments: readonly ExpeditionAugmentSelection[]): void {
    const run = expeditionManager.status().run;
    if (!run) return;
    // 현재 점수는 주간 최고와 같은 상태 줄에 짧게 붙여 지도 공간을 침범하지 않는다.
    this.add.text(BASE_WIDTH - 54, 94, `런 ${score.toLocaleString()}`, textStyle({ role: "emphasis", size: 25, color: COLOR.sortieText })).setOrigin(1, 0);
    this.buildRewardBar(run.pendingRewards);
    this.buildMap(run.nodes, run.currentNodeId, run.visitedNodeIds);
    this.buildAugmentChips(augments);
    this.buildRelicHud(run.relics);
    if (run.pendingAugmentReward) this.openAugmentReward();
    // 포기는 돌아가기보다 작게 두어 파괴 조작의 위계를 낮추고, 공용 팝업에서 결과를 재확인한다.
    new Button(this, BASE_WIDTH - 170, 1750, { width: 230, height: 72, label: "포기하기", fontSize: 24, onClick: () => this.confirmAbandon() });
  }

  /** 런에서만 누적되는 네 재화를 CurrencyChip 한 줄로 고정한다. */
  private buildRewardBar(rewards: Readonly<Record<string, number>>): void {
    const items = [
      ["currency-cheesecake", "cheesecake"], ["currency-gold", "gold"],
      ["currency-fossil", "fossil"], ["currency-gems", "gems"],
    ] as const;
    items.forEach(([icon, key], index) => {
      const value = addCurrencyChip(this, 178 + index * 242, 170, icon, { width: 220, height: 70 });
      value.setText(Math.floor(rewards[key] ?? 0).toLocaleString());
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
    this.nodeTransitionPending = true;
    if (["normal", "elite", "horde", "boss"].includes(node.type)) {
      const input: ExpeditionBattleInputDto = { mode: "expedition", runId: run.runId, nodeId: node.id, nodeType: node.type as ExpeditionBattleInputDto["nodeType"], floor: node.floor, relics: run.relics.map(({ relicId, currentHp, alive }) => ({ relicId, currentHp, alive })), augments: run.selectedAugments };
      this.scene.start("battle", input);
      return;
    }
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

  /** Fake 서버가 정한 보상 DTO를 받은 뒤에만 보물 노드를 완료하며 증강 경로는 열지 않는다. */
  private async completeTreasureNode(node: ExpeditionMapNode): Promise<void> {
    const run = expeditionManager.status().run;
    if (!run) { this.nodeTransitionPending = false; return; }
    try {
      const reward = await gameApi.getExpeditionTreasureReward({ runId: run.runId, nodeId: node.id });
      if (expeditionManager.completeNode(node.id, { relicHp: run.relics.map(({ currentHp }) => currentHp), rewards: reward.rewards })) this.scene.restart();
      else this.nodeTransitionPending = false;
    } catch { this.nodeTransitionPending = false; }
  }

  /** 저장된 제안만 표시하며 선택 성공 뒤 재시작해서 다음 라운드 또는 지도를 활성화한다. */
  private openAugmentReward(): void {
    const pending = expeditionManager.status().run?.pendingAugmentReward;
    if (!pending) return;
    const layer = this.add.container(0, 0).setDepth(4000);
    layer.add(this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.9));
    layer.add(this.add.text(BASE_WIDTH / 2, 620, `증강 선택 ${pending.round} / ${pending.totalRounds}`, textStyle({ role: "display", size: 46, color: COLOR.sortieText })).setOrigin(0.5));
    pending.offers.forEach((offer, index) => {
      const def = getExpeditionAugment(offer.augmentId);
      layer.add(new Button(this, BASE_WIDTH / 2, 790 + index * 150, { width: 700, height: 112, label: def?.name ?? offer.augmentId, onClick: () => {
        if (this.nodeTransitionPending) return;
        this.nodeTransitionPending = true;
        const targetRelicId = offer.eligibleTargetRelicIds[0];
        if (expeditionManager.chooseAugment({ augmentId: offer.augmentId, ...(targetRelicId ? { targetRelicId } : {}) })) this.scene.restart();
        else this.nodeTransitionPending = false;
      } }));
    });
  }

  /** 하단 증강은 공용 비대칭 chipPoints로 표시하고, 다섯 개부터 +N으로 줄여 화면 폭을 지킨다. */
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
      await gameApi.settleExpeditionRun({ runId: run.runId, settlementId: `${run.runId}:abandon`, outcome: "abandoned" });
      this.scene.start("lobby");
    });
  }

  /** 보유 렐릭에서 정확히 세 기를 고르는 신규 원정 준비 화면을 만든다. */
  private buildPreparation(quickAvailable: boolean): void {
    this.add.text(BASE_WIDTH / 2, 292, "원정대 3기 선택", textStyle({ role: "emphasis", size: 32 })).setOrigin(0.5);
    this.add.text(BASE_WIDTH / 2, 348, quickAvailable ? "빠른 원정 가능" : "0 / 3", textStyle({ role: "body", size: 26, color: quickAvailable ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5);

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

  /** 네 번째 선택은 받지 않고 카드 발광과 선택 수만 동기화한다. */
  private toggle(relicId: string): void {
    const index = this.selected.indexOf(relicId);
    if (index >= 0) this.selected.splice(index, 1);
    else if (this.selected.length < 3) this.selected.push(relicId);
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
