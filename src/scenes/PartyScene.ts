import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugParty, setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { getRelic } from "../data/relics";
import { relicCollection } from "../managers/RelicCollectionManager";
import { CharacterInfoManager, ELEMENT_LABEL, ROLE_LABEL, addHelpBadge } from "../managers/CharacterInfoManager";
import type { PuppetCreature } from "../puppets/assets";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { relicProgression } from "../managers/RelicProgressionManager";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { autoPickParty, elementDistribution, relicAffinityDirection } from "../core/partyAffinity";
import type { SetPartyFailureReason } from "../managers/RelicCollectionManager";
import { AffinityDirection } from "../ui/AffinityDirection";
import { removeFormationSlot } from "../core/formationSelection";
import { moveFormationSlot } from "../core/formation";
import { bindFormationDrag } from "../ui/formationDrag";

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

/** 보유 렐릭 그리드의 배치표. 자동 배치 버튼 자리도 이 값을 그대로 읽어 그리드와 어긋나지 않는다. */
const ROSTER_GRID = { cols: 5, cardW: 186, cardH: 226, gapX: 26, gapY: 52, startY: 1080 } as const;

/** 그리드 카드 하나의 중심 x좌표. 열 번호(0부터)를 받는다. */
function rosterColumnX(col: number): number {
  const gridW = ROSTER_GRID.cols * ROSTER_GRID.cardW + (ROSTER_GRID.cols - 1) * ROSTER_GRID.gapX;
  const startX = (BASE_WIDTH - gridW) / 2 + ROSTER_GRID.cardW / 2;
  return startX + col * (ROSTER_GRID.cardW + ROSTER_GRID.gapX);
}

/** 그리드 오른쪽 바깥 경계. 자동 배치 버튼을 그리드 위 우측에 맞추는 데 쓴다. */
function rosterRightEdge(): number {
  return rosterColumnX(ROSTER_GRID.cols - 1) + ROSTER_GRID.cardW / 2;
}

interface RosterCard {
  card: PortraitCard;
  role: string;
}

interface AllySlot {
  platform: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  slotLabel: Phaser.GameObjects.Text;
  /** SD/받침의 왼쪽 아래에 고정되는 상성 방향 표식. 빈 자리와 중립에서는 숨긴다. */
  affinityDirection: AffinityDirection;
  /** 이 자리에 서 있는 SD. 편성이 바뀔 때마다 갈아 세운다. */
  creature?: PuppetCreature;
  /** 지금 이 자리가 보여 주고 있는 렐릭. 같은 렐릭이면 다시 세우지 않는다. */
  currentId?: string;
  /** 늦게 도착한 로딩이 최신 편성을 덮지 않게 하는 요청 번호. */
  request: number;
  /** 비동기 SD 대신 항상 슬롯 크기를 유지하며 짧은 탭 계약을 소유하는 투명 입력면이다. */
  hit: Phaser.GameObjects.Rectangle;
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
  /** 자동 배치와 자리별 방향 표식이 함께 참조하는 이번 스테이지의 적 정의다. */
  private enemies: RelicDef[] = [];
  /** 자동 배치 버튼의 실제 중심. `create`에서 한 번 계산해 `refresh`가 그대로 다시 쓴다. */
  private autoButtonPosition = { x: 0, y: 0 };
  private info!: CharacterInfoManager;
  /** 같은 정보창을 적 문맥으로 하나 더 둔다. 아군 창과 문맥이 섞이지 않게 창을 나눈다. */
  private enemyInfo!: CharacterInfoManager;
  private pressTimer?: Phaser.Time.TimerEvent;
  private pressStartedAt = 0;
  private longPressFired = false;
  /** 저장을 포함한 전투 진입 처리 중에는 연속 탭이 같은 처리를 다시 시작하지 못하게 한다. */
  private isEnteringBattle = false;

  constructor() {
    super("party");
  }

  create(): void {
    setDebugScene("party");
    // 직전 스토리 편성만 복원한다. 원정·발굴은 각 콘텐츠가 소유한 별도 저장 필드를 유지한다.
    this.picked = relicCollection.validParty;
    this.cards.clear();
    this.allySlots = [];
    this.pressTimer = undefined;
    this.pressStartedAt = 0;
    this.isEnteringBattle = false;

    const cx = BASE_WIDTH / 2;
    // 편성 미리보기와 실제 전투가 같은 6번 전장 원화를 공유해 출전 흐름을 시각적으로 잇는다.
    addSceneBackground(this, BACKGROUND.combat);
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.42).setDepth(-29);

    const stage = getBattleStage(session.selectedStageId ?? "1-1");
    // 전투와 같은 함수로 적을 만든다. 여기서만 기본 수치를 읽으면 미리보기의 체력이 실제
    // 전투보다 낮게 보인다 — 스테이지 레벨 보정은 `getStageEnemies` 한 곳에만 있다.
    this.enemies = getStageEnemies(stage);
    // 손상된 런타임 파티만 보유 목록 기반 자동 편성으로 안전하게 대체한다.
    if (this.picked.length !== 3) this.picked = autoPickParty(relicCollection.owned, this.enemies);
    this.add.text(cx, 70, `${stage.id}  ${stage.name}`, textStyle({ role: "display", size: 46 })).setOrigin(0.5, 0);
    this.add
      .text(cx, 132, "렐릭 3명 편성 — 고른 순서대로 왼쪽부터 선다", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.buildPreview(this.enemies, stage.enemyLevel);
    this.buildRoster();

    // 그리드 위 우측 — 고르는 손이 그리드에 머무는 동안 곧바로 닿는 자리다. 그리드 오른쪽
    // 경계에 버튼 오른쪽을 맞추고, 셋째 아군 자리 이름표(2번 자리 문구)와 겹치지 않도록 좁혀
    // 그 오른쪽 빈 자리에만 놓는다.
    const autoButtonWidth = 200;
    const autoButtonHeight = 56;
    this.autoButtonPosition = {
      x: rosterRightEdge() - autoButtonWidth / 2,
      y: ROSTER_GRID.startY - ROSTER_GRID.cardH / 2 - 20 - autoButtonHeight / 2,
    };
    new Button(this, this.autoButtonPosition.x, this.autoButtonPosition.y, {
      width: autoButtonWidth,
      height: autoButtonHeight,
      label: "자동 배치",
      fontSize: 26,
      onClick: () => {
        this.picked = autoPickParty(relicCollection.owned, this.enemies);
        this.refresh();
      },
    });

    this.hint = this.add
      .text(cx, 1560, "", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.startButton = new Button(this, cx, 1700, {
      width: 560,
      height: 150,
      label: "전투 시작",
      fontSize: 44,
      onClick: () => {
        // 첫 유효 클릭에서 즉시 잠가 같은 프레임의 빠른 연속 입력도 한 번만 처리한다.
        if (this.isEnteringBattle || this.picked.length !== 3) return;
        this.isEnteringBattle = true;
        this.startButton.setEnabled(false);

        try {
          // 화면에 그린 뒤 보유 상태가 바뀔 수 있으므로 전환 직전에 매니저에서 다시 검증한다.
          const result = relicCollection.setParty([...this.picked]);
          if (!result.ok) {
            this.isEnteringBattle = false;
            this.hint.setText(this.partyFailureMessage(result.reason, result.relicId));
            this.refreshButtonState();
            return;
          }
          // 호출자도 스토리 전투임을 명시해 Phaser의 직전 원정 data 재사용 여지를 없앤다.
          this.scene.start("battle", { mode: "stage" });
        } catch {
          // 저장소 용량/보안 오류의 세부 정보 대신 사용자가 재시도할 수 있는 문구를 보여 준다.
          this.isEnteringBattle = false;
          this.hint.setText("파티 저장에 실패했다. 저장 공간을 확인한 뒤 다시 시도해 주세요.");
          this.refreshButtonState();
        }
      },
    });

    addBackButton(this, () => this.scene.start("stageMap"));

    this.info = new CharacterInfoManager(this);
    this.enemyInfo = new CharacterInfoManager(this, 1001, "enemy");
    this.refresh();
  }

  /** 위쪽 시작 배치 미리보기. 적은 위에, 아군은 아래에 나란히 선다. */
  private buildPreview(enemies: readonly RelicDef[], stageLevel: number): void {
    this.add
      .text(BASE_WIDTH - 40, 210, "적", textStyle({ role: "emphasis", size: 30, color: COLOR.dangerText }))
      .setOrigin(1, 0);
    const distribution = elementDistribution(enemies)
      .map(({ element, count }) => `${ELEMENT_LABEL[element]} ${count}`)
      .join("  ·  ");
    this.add
      .text(BASE_WIDTH / 2, 178, `적 속성  ${distribution}`, textStyle({ role: "emphasis", size: 24, color: COLOR.dangerText }))
      .setOrigin(0.5, 0);
    // 두 줄 사이의 대치선.
    this.add
      .line(0, 0, 120, FRONT_LINE, BASE_WIDTH - 120, FRONT_LINE, COLOR.panelEdge)
      .setOrigin(0)
      .setLineWidth(2)
      .setAlpha(0.45);

    enemies.forEach((def, slot) => {
      const x = PREVIEW_COLUMNS[slot];
      // 받침은 SD(-10)보다 뒤에 둬야 발을 덮지 않는다.
      this.add.ellipse(x, ENEMY_ROW + 4, 190, 34, COLOR.void, 0.45).setDepth(-12);
      void this.standSD(def.id, x, ENEMY_ROW, true);

      this.add.text(x, ENEMY_ROW + 26, def.name, textStyle({ role: "display", size: 28 })).setOrigin(0.5, 0);
      this.add
        .text(x, ENEMY_ROW + 62, `${ELEMENT_LABEL[def.element]} · ${ROLE_LABEL[def.role]}  HP ${def.stats.hp}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
        .setOrigin(0.5, 0);
      // SD 자체는 그림이라 입력을 받지 않는다. 상세는 옆의 ?로 연다.
      addHelpBadge(this, x + 96, ENEMY_ROW - PREVIEW_HEIGHT + 10, () => this.enemyInfo.showEnemy(def, { level: stageLevel }), 24);
    });

    this.add.text(40, FRONT_LINE + 28, "아군", textStyle({ role: "emphasis", size: 30 })).setOrigin(0, 0);

    PREVIEW_COLUMNS.forEach((x, slot) => {
      const platform = this.add.ellipse(x, ALLY_ROW, 210, 46, COLOR.panel, 0.85).setStrokeStyle(3, COLOR.ally).setDepth(-12);
      const name = this.add.text(x, ALLY_ROW + 26, "―", textStyle({ role: "display", size: 28, color: COLOR.inkDim })).setOrigin(0.5, 0);
      const slotLabel = this.add
        .text(x, ALLY_ROW + 62, `${slot + 1}번 자리`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
        .setOrigin(0.5, 0);
      // 플랫폼의 좌측 하단에 붙여 SD가 비동기로 도착해도 표식 위치가 흔들리지 않게 한다.
      const affinityDirection = new AffinityDirection(this, x - 82, ALLY_ROW - 20).setDepth(2);
      // SD와 같은 높이의 투명 슬롯 면이 입력을 소유해 Puppet 로딩 성공 여부가 조작을 바꾸지 않는다.
      const hit = this.add.rectangle(x, ALLY_ROW - PREVIEW_HEIGHT / 2, 210, PREVIEW_HEIGHT, 0xffffff, 0)
        .setName(`party-ally-slot-${slot + 1}`).setDepth(3).setInteractive({ useHandCursor: true });
      this.allySlots.push({ platform, name, slotLabel, affinityDirection, request: 0, hit });
    });
    // 보유 카드의 상세 정보 장기 누름과 겹치지 않도록 드래그 시작점은 이 상단 SD 입력면뿐이다.
    bindFormationDrag(this, this.allySlots.map((slot, index) => ({ hit: slot.hit, x: PREVIEW_COLUMNS[index], y: ALLY_ROW - PREVIEW_HEIGHT / 2, width: 210, height: PREVIEW_HEIGHT })), {
      onTap: (slot) => {
        // 짧은 탭은 화면에 보이는 자리 번호 그대로 해제한다.
        if (this.picked[slot] !== undefined && removeFormationSlot(this.picked, slot)) this.refresh();
      },
      onDrop: (from, to) => {
        this.picked = moveFormationSlot(this.picked, from, to);
        // Puppet 원본을 옮기지 않고 확정 뒤 기존 비동기 재배치 경로로 화면을 다시 만든다.
        this.refresh();
      },
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
    const { cols, cardW, cardH, gapY, startY } = ROSTER_GRID;

    // 보유한 렐릭만 편성할 수 있다.
    const roster = relicCollection.owned;
    roster.forEach((relic, i) => {
      const x = rosterColumnX(i % cols);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);
      const role = ROLE_LABEL[relic.role];
      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        portraitAssetId: relic.portraitAssetId,
        tint: relicCardTint(relic),
        label: relic.name,
        level: relicProgression.getProgress(relic.id).level,
        rarity: relic.rarity,
        stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
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
    } else {
      // 자동 배치 등으로 이미 3명이 찬 상태에서 새 카드를 누르면, 아무 반응도 없는 것처럼
      // 보이지 않도록 마지막 자리를 바로 바꾼다.
      this.picked[this.picked.length - 1] = relicId;
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
      // 빈 슬롯 및 전체 관계가 상쇄된 중립은 텍스트 대신 표식 자체를 완전히 숨긴다.
      slot.affinityDirection.setDirection(id ? relicAffinityDirection(getRelic(id), this.enemies) : "neutral");
      // 이미 그 렐릭이 서 있으면 다시 세우지 않는다.
      if (!id || !standing || slot.currentId !== id) void this.fillAllySlot(slot, i, id);
      slot.currentId = id;
    });

    this.refreshButtonState();
    // 자동 배치 직후 방향 표식이 실제로 나타났는지 캔버스 밖 E2E가 판별하는 읽기 전용 수치다.
    setDebugParty({
      autoButton: this.autoButtonPosition,
      visibleAffinityDirections: this.allySlots.filter((slot) => slot.affinityDirection.visible).length,
      selectedCount: this.picked.length,
      // 입력면 중심을 공개해 E2E가 SD 로딩이나 하드코딩 좌표에 의존하지 않게 한다.
      slots: PREVIEW_COLUMNS.map((x) => ({ x, y: ALLY_ROW - PREVIEW_HEIGHT / 2 })),
    });
    this.hint.setText(
      this.picked.length === 3 ? "편성 완료" : `${3 - this.picked.length}명 더 골라야 한다`,
    );
  }

  /** 선택 수와 전투 진입 잠금을 함께 반영해 버튼 활성 상태를 한곳에서 계산한다. */
  private refreshButtonState(): void {
    this.startButton.setEnabled(this.picked.length === 3 && !this.isEnteringBattle);
  }

  /** 매니저의 안정적인 실패 코드를 편성 화면에서 바로 이해할 수 있는 안내로 바꾼다. */
  private partyFailureMessage(reason: SetPartyFailureReason, relicId?: string): string {
    if (reason === "wrong-size") return "정확히 3명을 골라야 전투를 시작할 수 있다.";
    if (reason === "duplicate") return "같은 렐릭을 두 자리 이상 편성할 수 없다.";
    const relicName = relicId ? getRelic(relicId).name : "선택한 렐릭";
    return `${relicName}은(는) 현재 보유하고 있지 않아 편성할 수 없다.`;
  }
}
