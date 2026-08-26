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

  constructor() {
    super("expedition");
  }

  create(): void {
    setDebugScene("expedition");
    this.selected = [];
    this.cards.clear();
    this.popups = new PopupLayer(this);

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
      onSelect: (node) => {
        // 교전 노드는 전용 필드로, 비전투 노드는 현재 선택 안내로 연결한다.
        if (["normal", "elite", "horde", "boss"].includes(node.type)) this.openBattleField(node);
        else {
          this.children.getByName("expedition-node-hint")?.destroy();
          this.add.text(BASE_WIDTH / 2, 1210, `${node.floor}층 · ${this.nodeLabel(node.type)}`, textStyle({ role: "emphasis", size: 22, color: COLOR.sortieText })).setName("expedition-node-hint").setOrigin(0.5);
        }
      },
    });
  }

  /** 지도에서 고른 교전의 전용 전투 필드를 열어 배경과 전투 HUD의 시각 경계를 먼저 세운다. */
  private openBattleField(node: ExpeditionMapNode): void {
    const layer = this.add.container(0, 0).setDepth(3000);
    const field = this.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, BACKGROUND.expeditionField);
    field.setScale(Math.max(BASE_WIDTH / field.width, BASE_HEIGHT / field.height));
    layer.add(field);
    // 전투 유닛이 설 중앙은 밝게 남기고 상하 정보대만 공용 유리 토큰으로 눌러 가독성을 확보한다.
    layer.add(drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.7 }));
    layer.add(drawGlassFade(this, BASE_WIDTH / 2, 130, BASE_WIDTH, 260, { topAlpha: HOLO.glass, bottomAlpha: 0 }));
    layer.add(drawGlassFade(this, BASE_WIDTH / 2, BASE_HEIGHT - 220, BASE_WIDTH, 440, { topAlpha: 0, bottomAlpha: HOLO.glass }));
    layer.add(this.add.text(54, 44, `${node.floor}층 · ${this.nodeLabel(node.type)}`, textStyle({ role: "display", size: 42, color: COLOR.sortieText })).setOrigin(0, 0));
    layer.add(this.add.text(54, 104, "교전 준비", textStyle({ role: "emphasis", size: 24, color: COLOR.ink })).setOrigin(0, 0));
    // 전투 규칙 연결 전에도 사용자가 지도 선택을 취소할 수 있는 실제 입력 경계를 제공한다.
    const back = new Button(this, BASE_WIDTH / 2, BASE_HEIGHT - 130, { width: 420, height: 92, label: "지도로 돌아가기", fontSize: 28, accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => layer.destroy(true) });
    layer.add(back);
  }

  /** 노드 종류와 공용 글리프 이름의 대응은 씬의 위치 계산과 분리한다. */
  private nodeLabel(type: ExpeditionMapNode["type"]): string { return ({ normal: "일반 전투", elite: "정예 전투", horde: "군집 전투", rest: "휴식", treasure: "보물", boss: "최종 보스" } as const)[type]; }

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
