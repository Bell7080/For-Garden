import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { getRelic } from "../data/relics";
import { relicCollection } from "../managers/RelicCollectionManager";
import { CharacterInfoManager, ROLE_LABEL, addHelpBadge } from "../managers/CharacterInfoManager";
import type { PuppetCreature } from "../puppets/assets";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { getStage } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard, relicCardTint, starsForRarity } from "../ui/PortraitCard";
import { relicProgression } from "../managers/RelicProgressionManager";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";

/** 이만큼 누르고 있으면 정보창이 열린다. 짧게 누르면 편성 토글이다. */
const LONG_PRESS_MS = 420;

/**
 * 미리보기 전장.
 *
 * 실시간 난전에는 전방·후방이 없다. 전투가 시작될 때와 똑같이 적 셋이 위에, 아군 셋이 아래에
 * 나란히 서고, 고른 순서가 왼쪽부터의 자리를 정한다.
 */
const PREVIEW_COLUMNS = [270, 540, 810];
const ENEMY_ROW = 430;
const ALLY_ROW = 830;
/** 두 줄을 가르는 대치선. 적 이름표 아래, 아군 머리 위에 놓는다. */
const FRONT_LINE = 556;
const PREVIEW_HEIGHT = 210;

interface RosterCard {
  card: PortraitCard;
  role: string;
}

interface AllySlot {
  platform: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  slotLabel: Phaser.GameObjects.Text;
  /** 이 자리에 서 있는 SD. 편성이 바뀔 때마다 갈아 세운다. */
  creature?: PuppetCreature;
  /** 지금 이 자리가 보여 주고 있는 렐릭. 같은 렐릭이면 다시 세우지 않는다. */
  currentId?: string;
  /** 늦게 도착한 로딩이 최신 편성을 덮지 않게 하는 요청 번호. */
  request: number;
}

/**
 * 편성 화면.
 *
 * 위쪽에 이번 전투의 시작 배치를 그대로 축소해 둔다. 어떤 적이 나오는지, 내가 고른 렐릭이
 * 어느 자리에 서는지를 들어가기 전에 SD 그대로 볼 수 있게 하려는 것이다.
 */
export class PartyScene extends Phaser.Scene {
  private picked: string[] = [];
  private cards = new Map<string, RosterCard>();
  private allySlots: AllySlot[] = [];
  private startButton!: Button;
  private hint!: Phaser.GameObjects.Text;
  private info!: CharacterInfoManager;
  private pressTimer?: Phaser.Time.TimerEvent;
  private pressStartedAt = 0;
  private longPressFired = false;

  constructor() {
    super("party");
  }

  create(): void {
    setDebugScene("party");
    this.picked = [];
    this.cards.clear();
    this.allySlots = [];
    this.pressTimer = undefined;
    this.pressStartedAt = 0;

    const cx = BASE_WIDTH / 2;
    // 편성 미리보기와 실제 전투가 같은 6번 전장 원화를 공유해 출전 흐름을 시각적으로 잇는다.
    addSceneBackground(this, BACKGROUND.combat);
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.42).setDepth(-29);

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.add.text(cx, 70, `${stage.id}  ${stage.name}`, textStyle({ role: "display", size: 46 })).setOrigin(0.5, 0);
    this.add
      .text(cx, 132, "렐릭 3명 편성 — 고른 순서대로 왼쪽부터 선다", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.buildPreview(stage.enemies);
    this.buildRoster();

    this.hint = this.add
      .text(cx, 1560, "", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.startButton = new Button(this, cx, 1700, {
      width: 560,
      height: 150,
      label: "전투 시작",
      fontSize: 44,
      onClick: () => {
        if (this.picked.length !== 3) return;
        if (!relicCollection.setParty(this.picked)) return;
        this.scene.start("battle");
      },
    });

    addBackButton(this, () => this.scene.start("stageMap"));

    this.info = new CharacterInfoManager(this);
    this.refresh();
  }

  /** 위쪽 시작 배치 미리보기. 적은 위에, 아군은 아래에 나란히 선다. */
  private buildPreview(enemyIds: readonly string[]): void {
    this.add
      .text(BASE_WIDTH - 40, 210, "적", textStyle({ role: "emphasis", size: 30, color: COLOR.dangerText }))
      .setOrigin(1, 0);
    // 두 줄 사이의 대치선.
    this.add
      .line(0, 0, 120, FRONT_LINE, BASE_WIDTH - 120, FRONT_LINE, COLOR.panelEdge)
      .setOrigin(0)
      .setLineWidth(2)
      .setAlpha(0.45);

    enemyIds.forEach((id, slot) => {
      const def = getRelic(id);
      const x = PREVIEW_COLUMNS[slot];
      // 받침은 SD(-10)보다 뒤에 둬야 발을 덮지 않는다.
      this.add.ellipse(x, ENEMY_ROW + 4, 190, 34, COLOR.void, 0.45).setDepth(-12);
      void this.standSD(def.id, x, ENEMY_ROW, true);

      this.add.text(x, ENEMY_ROW + 26, def.name, textStyle({ role: "display", size: 28 })).setOrigin(0.5, 0);
      this.add
        .text(x, ENEMY_ROW + 62, `${ROLE_LABEL[def.role]}  HP ${def.stats.hp}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
        .setOrigin(0.5, 0);
      // SD 자체는 그림이라 입력을 받지 않는다. 상세는 옆의 ?로 연다.
      addHelpBadge(this, x + 96, ENEMY_ROW - PREVIEW_HEIGHT + 10, () => this.info.showRelic(def), 24);
    });

    this.add.text(40, FRONT_LINE + 28, "아군", textStyle({ role: "emphasis", size: 30 })).setOrigin(0, 0);

    PREVIEW_COLUMNS.forEach((x, slot) => {
      const platform = this.add.ellipse(x, ALLY_ROW, 210, 46, COLOR.panel, 0.85).setStrokeStyle(3, COLOR.ally).setDepth(-12);
      const name = this.add.text(x, ALLY_ROW + 26, "―", textStyle({ role: "display", size: 28, color: COLOR.inkDim })).setOrigin(0.5, 0);
      const slotLabel = this.add
        .text(x, ALLY_ROW + 62, `${slot + 1}번 자리`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
        .setOrigin(0.5, 0);
      this.allySlots.push({ platform, name, slotLabel, request: 0 });
    });
  }

  /** 미리보기용 SD 하나를 세운다. 씬을 떠난 뒤 도착한 로딩은 그대로 버린다. */
  private async standSD(relicId: string, x: number, groundY: number, enemy: boolean): Promise<PuppetCreature | undefined> {
    const creature = await spawnPuppet(this, battleAssetFor(relicId), {
      x,
      groundY,
      height: PREVIEW_HEIGHT,
      flipX: enemy,
      // 전투 화면과 같은 규칙 — 임시 공용 적만 색으로 구분한다.
      tint: relicId.startsWith("husk-") ? tintFor(relicId) : undefined,
      depth: -10,
    });
    if (!this.scene.isActive()) {
      creature.destroy();
      return undefined;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => creature.destroy());
    return creature;
  }

  /** 아군 자리의 SD를 지금 편성에 맞춘다. 빈 자리는 받침만 남긴다. */
  private async fillAllySlot(slot: AllySlot, index: number, relicId?: string): Promise<void> {
    const request = ++slot.request;
    slot.creature?.destroy();
    slot.creature = undefined;
    if (!relicId) return;

    const creature = await this.standSD(relicId, PREVIEW_COLUMNS[index], ALLY_ROW, false);
    if (!creature) return;
    // 기다리는 사이 편성이 바뀌었다면 방금 세운 SD는 쓰지 않는다.
    if (request !== slot.request) {
      creature.destroy();
      return;
    }
    slot.creature = creature;
  }

  /**
   * 아래쪽 보유 렐릭 그리드. 짧게 누르면 편성, 꾹 누르면 정보창이다.
   *
   * 카드는 도감과 같은 규격이라 이름·역할만 띠에 남기고 얼굴로 고르게 한다.
   * 고른 카드는 띠 문구가 전장에서 설 자리 번호로 바뀐다.
   */
  private buildRoster(): void {
    const cols = 5;
    const cardW = 186;
    const cardH = 226;
    const gapX = 26;
    const gapY = 52;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (BASE_WIDTH - gridW) / 2 + cardW / 2;
    const startY = 1080;

    // 보유한 렐릭만 편성할 수 있다.
    const roster = relicCollection.owned;
    roster.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);
      const role = ROLE_LABEL[relic.role];
      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        portraitAssetId: relic.portraitAssetId,
        tint: relicCardTint(relic),
        label: relic.name,
        level: relicProgression.getProgress(relic.id).level,
        stars: starsForRarity(relic.rarity),
      });

      this.bindCardInput(card.hit, relic);
      this.cards.set(relic.id, { card, role });
    });

    this.add
      .text(BASE_WIDTH / 2, 1520, "꾹 누르면 상세 정보", textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  /**
   * 짧게 누름(편성 토글)과 꾹 누름(정보창)을 가른다.
   *
   * 누르고 있는 동안 정보창이 뜨는 느낌을 주려고 타이머를 걸지만, 그것만 믿지는 않는다.
   * 화면에 아무 일도 일어나지 않는 동안 브라우저가 렌더 루프를 늦추면 타이머가 제때 오지
   * 않을 수 있어서, 손을 뗄 때 실제로 눌린 시간을 한 번 더 본다.
   */
  private bindCardInput(box: Phaser.GameObjects.Rectangle, relic: RelicDef): void {
    const openInfo = (): void => {
      this.longPressFired = true;
      this.info.showRelic(relic);
    };

    const clearTimer = (): void => {
      this.pressTimer?.remove();
      this.pressTimer = undefined;
    };

    box.on("pointerdown", () => {
      this.longPressFired = false;
      this.pressStartedAt = Date.now();
      this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, openInfo);
    });

    box.on("pointerup", () => {
      clearTimer();
      if (this.pressStartedAt === 0) return; // 카드 밖에서 시작한 입력
      const heldMs = Date.now() - this.pressStartedAt;
      this.pressStartedAt = 0;

      if (this.longPressFired) return; // 누르고 있는 동안 이미 열렸다
      if (heldMs >= LONG_PRESS_MS) openInfo();
      else this.toggle(relic.id);
    });

    box.on("pointerout", () => {
      clearTimer();
      this.pressStartedAt = 0;
    });
  }

  private toggle(relicId: string): void {
    const at = this.picked.indexOf(relicId);
    if (at >= 0) {
      this.picked.splice(at, 1);
    } else if (this.picked.length < 3) {
      this.picked.push(relicId);
    }
    this.refresh();
  }

  private refresh(): void {
    for (const [id, entry] of this.cards) {
      const at = this.picked.indexOf(id);
      const chosen = at >= 0;
      entry.card.setSelected(chosen);
      entry.card.setSub(chosen ? `${at + 1}번 자리` : entry.role);
    }

    // 고른 순서 그대로 왼쪽 자리부터 올린다.
    this.allySlots.forEach((slot, i) => {
      const id = this.picked[i];
      const standing = slot.creature !== undefined;
      slot.name.setText(id ? getRelic(id).name : "―");
      slot.name.setColor(id ? COLOR.ink : COLOR.inkDim);
      slot.platform.setAlpha(id ? 1 : 0.55);
      slot.slotLabel.setAlpha(id ? 1 : 0.75);
      // 이미 그 렐릭이 서 있으면 다시 세우지 않는다.
      if (!id || !standing || slot.currentId !== id) void this.fillAllySlot(slot, i, id);
      slot.currentId = id;
    });

    this.startButton.setEnabled(this.picked.length === 3);
    this.hint.setText(
      this.picked.length === 3 ? "편성 완료" : `${3 - this.picked.length}명 더 골라야 한다`,
    );
  }
}
