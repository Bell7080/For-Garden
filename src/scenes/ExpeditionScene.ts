import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { expeditionManager, type StartExpeditionFailure } from "../managers/ExpeditionManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { COLOR, textStyle } from "../ui/theme";
import { drawHairline, drawVignette } from "../ui/holo";

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

  constructor() {
    super("expedition");
  }

  create(): void {
    setDebugScene("expedition");
    this.selected = [];
    this.cards.clear();

    // 장기 고고학과 다른 콘텐츠지만 야외 조사 분위기를 잇기 위해 기존 탐사 원화만 재사용한다.
    addSceneBackground(this, BACKGROUND.archaeology);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -26, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.42).setDepth(-25);

    const status = expeditionManager.status();
    this.add.text(54, 70, "주간 원정", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    this.add.text(54, 144, `이번 주 ${status.playsThisWeek}회  ·  최고 ${status.bestScore.toLocaleString()}`, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0);
    drawHairline(this, BASE_WIDTH / 2, 210, BASE_WIDTH - 108, { color: COLOR.accent, alpha: 0.34 });

    if (status.active) this.buildActive(status.active.relicIds, status.active.score);
    else this.buildPreparation(status.quickAvailable);

    // 화면을 벗어나는 조작은 공용 우하단 슬롯만 사용한다.
    addBackButton(this, () => this.scene.start("lobby"));
  }

  /** 진행 중 원정은 새 편성으로 덮지 않고 저장된 세 렐릭과 현재 점수만 보여 준다. */
  private buildActive(relicIds: readonly string[], score: number): void {
    this.add.text(BASE_WIDTH / 2, 330, "원정 진행 중", textStyle({ role: "display", size: 44, color: COLOR.sortieText })).setOrigin(0.5);
    this.add.text(BASE_WIDTH / 2, 400, relicIds.map((id) => getRelic(id).name).join("  ·  "), textStyle({ role: "emphasis", size: 30 })).setOrigin(0.5);
    this.add.text(BASE_WIDTH / 2, 470, `현재 점수 ${score.toLocaleString()}`, textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5);
    // 전투/보상 API가 연결되기 전에는 임의 완료나 지급 버튼을 만들지 않아 진행 소유권을 보존한다.
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
