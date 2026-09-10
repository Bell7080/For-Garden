import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugParty, setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { getRelic } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { relicCollection } from "../managers/RelicCollectionManager";
import { CharacterInfoManager, ROLE_LABEL } from "../managers/CharacterInfoManager";
import { bindLongPress } from "../ui/longPressInfo";
import type { PuppetCreature } from "../puppets/assets";
import { placePuppet, spawnPuppet } from "../puppets/assets";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { session } from "../state/session";
import { gameApi } from "../api/FakeServer";
import { GameApiError } from "../api/contracts";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { PortraitCard } from "../ui/PortraitCard";
import { formationRosterColumnX, formationRosterGrid, PORTRAIT_GRID_MASK_GAP, portraitGridContentHeight, portraitGridFirstRowY, portraitGridHeadroom } from "../ui/portraitGrid";
import { relicProgression } from "../managers/RelicProgressionManager";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { autoPickParty, relicAffinityDirection } from "../core/partyAffinity";
import type { SetPartyFailureReason } from "../managers/RelicCollectionManager";
import { AffinityDirection } from "../ui/AffinityDirection";
import { AffinityBadge } from "../ui/AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "../ui/affinityIcons";
import { addStarMark } from "../ui/rarityMark";
import { addUnitNameplate } from "../ui/unitNameplate";
import { combatPower } from "../core/combatPower";
import { formationMembers, tapFormationSlot, tapRosterRelic, toFormationSlots } from "../core/formationSlots";
import { moveFormationSlot } from "../core/formation";
import { addFormationRemoveChip, addFormationSlotSelection } from "../ui/formationSlotChrome";
import { bindFormationDrag } from "../ui/formationDrag";
import { FORMATION_DRAG_VISUAL } from "../ui/formationDragVisual";
import { createFormationDragVisualController, type FormationDragVisualController } from "../ui/formationDragVisualController";
import { PopupLayer } from "../ui/PopupLayer";
import { StaminaPopup } from "../ui/StaminaPopup";
import { partyEntryErrorView } from "./partyEntryError";

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
/** 두 편의 총 전투력이 마주 보는 줄. 대치선보다 아래, 두 줄의 가운데에 가깝게 둔다. */
const POWER_ROW = 640;

/**
 * 보유 렐릭 그리드의 배치표.
 *
 * 칸 수와 카드 크기는 화면이 정하지 않는다 — 편성 목록은 어디서나 네 칸이 한 줄이고, 폭만
 * 주면 공용 규칙이 카드 크기와 줄 간격을 구한다. 자동 배치 버튼 자리도 이 값을 그대로 읽어
 * 그리드와 어긋나지 않는다.
 */
const ROSTER_GRID = formationRosterGrid(BASE_WIDTH - 96);

/**
 * 그리드가 보이는 창.
 *
 * **보유 렐릭이 늘면 줄이 늘어난다** — 마스크 없이 쌓으면 아래 줄이 안내 문구와 전투 시작
 * 버튼 위로 그대로 자란다(실제로 그랬다). 원정 편성·도감과 같은 방식으로 이 창 안에서만
 * 흐르게 하고, 첫 줄은 머리가 잘리지 않는 공용 안전 영역만큼 내려 세운다.
 */
const ROSTER_VIEWPORT = { top: 962, bottom: 1500 } as const;
/** 손가락이 이 거리 이상 움직이면 편성이 아니라 스크롤로 본다. */
const ROSTER_DRAG_SLOP = 12;

/** 그리드 카드 하나의 중심 x좌표. 열 번호(0부터)를 받는다. */
function rosterColumnX(col: number): number {
  return BASE_WIDTH / 2 + formationRosterColumnX(ROSTER_GRID, col);
}

/** 그리드 오른쪽 바깥 경계. 자동 배치 버튼을 그리드 위 우측에 맞추는 데 쓴다. */
function rosterRightEdge(): number {
  return rosterColumnX(ROSTER_GRID.columns - 1) + ROSTER_GRID.cardWidth / 2;
}

interface RosterCard {
  card: PortraitCard;
  role: string;
}

interface AllySlot {
  platform: Phaser.GameObjects.Ellipse;
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
  /** 빈 자리를 `null`로 남기는 고정 세 자리. 빼도 뒤가 당겨지지 않는다. */
  private picked: (string | null)[] = [null, null, null];
  /**
   * 목록을 눌렀을 때 캐릭터가 설 자리.
   *
   * **아무 칸도 고르지 않은 상태가 있다.** 고른 칸 표시가 화면에 계속 떠 있으면 다 고르고 난
   * 뒤에도 무언가 더 할 일이 남은 것처럼 보인다. 전장 아무 곳이나 누르면 풀린다.
   */
  private selectedSlot: number | undefined;
  private cards = new Map<string, RosterCard>();
  private allySlots: AllySlot[] = [];
  /** 대치선 위에 마주 보는 두 편의 종합 전투력. 편성이 바뀌면 아군 쪽만 다시 적는다. */
  private enemyPowerText?: Phaser.GameObjects.Text;
  private allyPowerText?: Phaser.GameObjects.Text;
  /**
   * 고른 칸 표시와 빼기 표식이 사는 두 층. 편성이 바뀔 때마다 통째로 다시 그린다.
   *
   * 밑판은 SD(-10)보다 **뒤**, 표식은 입력면(3)보다 **앞**이다 — 밑판이 앞에 서면 고른 칸의
   * 캐릭터만 반투명한 판에 덮여 오히려 흐려진다.
   */
  private slotPlate?: Phaser.GameObjects.Container;
  private slotChrome?: Phaser.GameObjects.Container;
  /** 아군 자리의 속성·돌파 표식과 이름줄. 편성이 바뀔 때마다 통째로 다시 그린다. */
  private allyMarks?: Phaser.GameObjects.Container;
  private startButton!: Button;
  private hint!: Phaser.GameObjects.Text;
  /** 자동 배치와 자리별 방향 표식이 함께 참조하는 이번 스테이지의 적 정의다. */
  private enemies: RelicDef[] = [];
  /** 자동 배치 버튼의 실제 중심. `create`에서 한 번 계산해 `refresh`가 그대로 다시 쓴다. */
  private autoButtonPosition = { x: 0, y: 0 };
  private info!: CharacterInfoManager;
  /** 같은 정보창을 적 문맥으로 하나 더 둔다. 아군 창과 문맥이 섞이지 않게 창을 나눈다. */
  private enemyInfo!: CharacterInfoManager;
  /** 저장을 포함한 전투 진입 처리 중에는 연속 탭이 같은 처리를 다시 시작하지 못하게 한다. */
  private isEnteringBattle = false;
  /** 세 화면에서 같은 감광·드롭 칸·미리보기 수명을 사용하는 공용 표현기다. */
  private dragVisual?: FormationDragVisualController;
  /** 그리드를 담아 함께 움직이는 층과 그 창을 오려 내는 마스크다. */
  private rosterContent?: Phaser.GameObjects.Container;
  private rosterMask?: Phaser.GameObjects.Graphics;
  private rosterScrollY = 0;
  private rosterMinScroll = 0;
  private rosterDragging = false;
  private rosterDragOrigin = 0;
  private rosterDraggedDistance = 0;
  private rosterTicker?: Phaser.Time.TimerEvent;

  constructor() {
    super("party");
  }

  create(): void {
    setDebugScene("party");
    // 직전 스토리 편성만 복원한다. 원정·발굴은 각 콘텐츠가 소유한 별도 저장 필드를 유지한다.
    this.picked = toFormationSlots(relicCollection.validParty, 3);
    this.selectedSlot = undefined;
    this.cards.clear();
    this.allySlots = [];
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
    if (formationMembers(this.picked).length !== 3) this.picked = toFormationSlots(autoPickParty(relicCollection.owned, this.enemies), 3);
    this.add.text(cx, 70, `${stage.id}  ${stage.name}`, textStyle({ role: "display", size: 46 })).setOrigin(0.5, 0);
    this.buildPreview(this.enemies, stage.enemies);
    this.buildRoster();

    // 그리드 위 우측 — 고르는 손이 그리드에 머무는 동안 곧바로 닿는 자리다. 그리드 오른쪽
    // 경계에 버튼 오른쪽을 맞추고, 셋째 아군 자리 이름표(2번 자리 문구)와 겹치지 않도록 좁혀
    // 그 오른쪽 빈 자리에만 놓는다.
    const autoButtonWidth = 200;
    const autoButtonHeight = 56;
    // **카드 윗변이 아니라 머리 끝을 기준으로 띄운다.** 카드 몸체만 피하면 칩 밖으로 빠져나온
    // 정수리(도디처럼 머리가 큰 원화)가 버튼과 겹친다 — 그리드의 보이는 윗선은 몸체가 아니라
    // 머리 끝이다.
    const firstRowY = portraitGridFirstRowY(ROSTER_VIEWPORT.top, ROSTER_GRID.cardHeight, PORTRAIT_GRID_MASK_GAP);
    const headTop = firstRowY - ROSTER_GRID.cardHeight / 2 - portraitGridHeadroom(ROSTER_GRID.cardHeight);
    this.autoButtonPosition = {
      x: rosterRightEdge() - autoButtonWidth / 2,
      y: headTop - 18 - autoButtonHeight / 2,
    };
    new Button(this, this.autoButtonPosition.x, this.autoButtonPosition.y, {
      width: autoButtonWidth,
      height: autoButtonHeight,
      label: "자동 배치",
      fontSize: 26,
      onClick: () => {
        this.picked = toFormationSlots(autoPickParty(relicCollection.owned, this.enemies), 3);
        this.selectedSlot = undefined;
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
      onClick: async () => {
        // 첫 유효 클릭에서 즉시 잠가 같은 프레임의 빠른 연속 입력도 한 번만 처리한다.
        if (this.isEnteringBattle || formationMembers(this.picked).length !== 3) return;
        this.isEnteringBattle = true;
        this.startButton.setEnabled(false);

        // 로컬 편성 저장과 서버 입장은 실패 원인과 복구 행동이 다르므로 서로 다른 예외 경계로 둔다.
        try {
          // 화면에 그린 뒤 보유 상태가 바뀔 수 있으므로 전환 직전에 매니저에서 다시 검증한다.
          const result = relicCollection.setParty(formationMembers(this.picked));
          if (!result.ok) {
            this.isEnteringBattle = false;
            this.hint.setText(this.partyFailureMessage(result.reason, result.relicId));
            this.refreshButtonState();
            return;
          }
        } catch {
          // 이 문구는 setParty의 영속 저장 예외에만 사용해 입장 API 오류와 섞이지 않게 한다.
          this.hint.setText("파티 저장에 실패했다. 저장 공간을 확인한 뒤 다시 시도해 주세요.");
          this.restoreEntryControls();
          return;
        }

        try {
          // 서버가 입장 비용을 확정한 뒤에만 전투로 전환해 같은 요청 재시도에서 중복 차감되지 않게 한다.
          const requestId = globalThis.crypto?.randomUUID?.() ?? `stage-entry-${Date.now()}`;
          await gameApi.enterStage({ stageId: session.selectedStageId!, requestId });
          this.scene.start("battle", { mode: "stage" });
        } catch (error) {
          // instanceof 판정이 계약의 런타임 오류 타입을 기준으로 수행됨을 import 수준에서도 명확히 한다.
          const view = partyEntryErrorView(error instanceof GameApiError ? error : undefined);
          this.hint.setText(view.message);
          this.restoreEntryControls();
          if (view.openStaminaPopup) new StaminaPopup(this, new PopupLayer(this, 2200), gameApi).open();
        }
      },
    });

    addBackButton(this, () => this.scene.start("stageMap"));

    this.info = new CharacterInfoManager(this);
    this.enemyInfo = new CharacterInfoManager(this, 1001, "enemy");
    this.bindDeselect();
    this.refresh();
  }

  /**
   * 위쪽 시작 배치 미리보기. 적은 위에, 아군은 아래에 나란히 선다.
   *
   * **적은 노드 미리보기와 같은 양식으로 선다** — 속성·직군은 왼쪽 위 아이콘, 돌파는 오른쪽 위
   * 로마자, 레벨과 이름은 한 줄에 강조색으로. 두 화면이 같은 적을 다른 글로 적으면 같은 값이
   * 어디서는 표식, 어디서는 문장이 된다.
   */
  private buildPreview(enemies: readonly RelicDef[], growth: readonly { level: number; breakthrough: number }[]): void {
    // 두 줄 사이의 대치선.
    this.add
      .line(0, 0, 120, FRONT_LINE, BASE_WIDTH - 120, FRONT_LINE, COLOR.panelEdge)
      .setOrigin(0)
      .setLineWidth(2)
      .setAlpha(0.45);

    enemies.forEach((def, slot) => {
      const snapshot = growth[slot] ?? { level: 1, breakthrough: 0 };
      const x = PREVIEW_COLUMNS[slot];
      // 받침은 SD(-10)보다 뒤에 둬야 발을 덮지 않는다.
      this.add.ellipse(x, ENEMY_ROW + 4, 190, 34, COLOR.void, 0.45).setDepth(-12);
      void this.standSD(def.id, x, ENEMY_ROW, true);

      const badgeTop = ENEMY_ROW - PREVIEW_HEIGHT + 34;
      this.add.existing(new AffinityBadge(this, x - 104, badgeTop, ELEMENT_ICON[def.element], 52, 0.62)).setDepth(3);
      this.add.existing(new AffinityBadge(this, x - 104, badgeTop + 49, ROLE_ICON[def.role], 38, 0.62)).setDepth(3);
      const marks = this.add.container(0, 0).setDepth(3);
      addStarMark(this, marks, x + 104, badgeTop - 4, 42, snapshot.breakthrough + 1);

      // 체력은 적지 않는다 — 붙어 볼지 정하는 데 필요한 것은 개체별 수치가 아니라 아래의
      // 두 총 전투력이다. 이름줄은 노드 미리보기와 같은 프리팹을 쓴다(레벨 강조색·이름 흰색).
      addUnitNameplate(this, undefined, x, ENEMY_ROW + 26, snapshot.level, def.name, 30);
      // **적을 누르면 상세가 열린다.** 옆에 물음표를 하나 더 세우면 SD와 표식 사이에 눌러야 할
      // 것이 둘이 되고, 정작 크게 서 있는 SD는 눌러도 아무 일이 없다.
      this.add.rectangle(x, ENEMY_ROW - PREVIEW_HEIGHT / 2, 210, PREVIEW_HEIGHT + 70, 0xffffff, 0)
        .setDepth(4)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.enemyInfo.showEnemy(def, { level: snapshot.level }));
    });

    // **대치선 위에는 두 편의 무게만 남긴다.** 속성 분포는 이미 각 SD의 아이콘이 말하고, "적"과
    // "아군"이라는 이름표는 위아래 자리가 이미 말한다. 대신 어느 쪽이 센지를 한 줄로 가른다.
    // 대치선보다 조금 아래, 두 줄의 가운데에 가깝게 세운다 — 선 위에 붙이면 적 쪽 이름줄에
    // 얹혀 적의 정보로 읽힌다.
    this.enemyPowerText = this.add
      .text(BASE_WIDTH / 2 - 30, POWER_ROW, "", textStyle({ role: "display", size: 30, color: COLOR.dangerText }))
      .setOrigin(1, 0.5)
      .setShadow(0, 3, "#05070a", 4, false, true);
    this.allyPowerText = this.add
      .text(BASE_WIDTH / 2 + 30, POWER_ROW, "", textStyle({ role: "display", size: 30, color: COLOR.accentText }))
      .setOrigin(0, 0.5)
      .setShadow(0, 3, "#05070a", 4, false, true);
    this.add.text(BASE_WIDTH / 2, POWER_ROW, "VS", textStyle({ role: "display", size: 24, color: COLOR.inkDim })).setOrigin(0.5, 0.5);

    PREVIEW_COLUMNS.forEach((x, slot) => {
      const platform = this.add.ellipse(x, ALLY_ROW, 210, 46, COLOR.panel, 0.85).setStrokeStyle(3, COLOR.ally).setDepth(-12);
      // 플랫폼의 좌측 하단에 붙여 SD가 비동기로 도착해도 표식 위치가 흔들리지 않게 한다.
      const affinityDirection = new AffinityDirection(this, x - 82, ALLY_ROW - 20).setDepth(2);
      // SD와 같은 높이의 투명 슬롯 면이 입력을 소유해 Puppet 로딩 성공 여부가 조작을 바꾸지 않는다.
      const hit = this.add.rectangle(x, ALLY_ROW - PREVIEW_HEIGHT / 2, 210, PREVIEW_HEIGHT, 0xffffff, 0)
        .setName(`party-ally-slot-${slot + 1}`).setDepth(3).setInteractive({ useHandCursor: true });
      this.allySlots.push({ platform, affinityDirection, request: 0, hit });
    });
    // 편성이 바뀔 때마다 통째로 다시 그리므로 슬롯 자체(받침·입력면)와 수명을 나눠 둔다.
    this.slotPlate = this.add.container(0, 0).setDepth(-14);
    this.slotChrome = this.add.container(0, 0).setDepth(5);
    // 아군의 이름줄·속성·돌파 표식은 편성이 바뀔 때마다 통째로 다시 그린다. 적과 같은 어휘를
    // 쓰되 SD보다 앞에 서야 표식이 머리에 가리지 않는다.
    this.allyMarks = this.add.container(0, 0).setDepth(6);
    // 공용 표현기는 화면 좌표 Puppet을 기존 placePuppet 콜백으로 옮겨 컨테이너 변환에 기대지 않는다.
    this.dragVisual = createFormationDragVisualController({
      scene: this, slots: PREVIEW_COLUMNS.map((x) => ({ x, y: ALLY_ROW - PREVIEW_HEIGHT / 2, width: 210, height: PREVIEW_HEIGHT })),
      formation: () => this.picked, color: COLOR.ally, zoneDepth: -11, dimDepth: -13,
      dimBounds: { x: BASE_WIDTH / 2, y: (FRONT_LINE + ALLY_ROW + 120) / 2, width: BASE_WIDTH, height: ALLY_ROW + 120 - FRONT_LINE },
      renderPreview: ({ preview, pointer }) => this.placeDragPreview(preview, pointer.x, pointer.y),
      restore: () => this.restoreDragPuppets(),
    });
    // 보유 카드의 상세 정보 장기 누름과 겹치지 않도록 드래그 시작점은 이 상단 SD 입력면뿐이다.
    bindFormationDrag(this, this.allySlots.map((slot, index) => ({ hit: slot.hit, x: PREVIEW_COLUMNS[index], y: ALLY_ROW - PREVIEW_HEIGHT / 2, width: 210, height: PREVIEW_HEIGHT })), {
      // 배열과 저장은 `drop`에서만 바뀐다. 아래 둘은 화면에만 손대므로 취소해도 편성이 남지 않는다.
      dragStart: (slot, x, y) => this.dragVisual?.beginDrag(slot, x, y),
      dragMove: (slot, x, y) => this.dragVisual?.moveDrag(slot, x, y),
      cancel: () => this.dragVisual?.endDrag(),
      // 짧은 탭은 그 자리를 **고르기만** 한다. 이미 골라 둔 자리를 한 번 더 눌러야 비고, 그때도
      // 뒤 자리는 당겨지지 않는다 — 2번을 비워도 3번은 3번에 그대로 선다.
      tap: (slot) => this.tapSlot(slot),
      // 자리에 세워 둔 SD도 그리드 카드와 같은 손짓으로 상세가 열린다.
      longPress: (slot) => { const id = this.picked[slot]; if (id) this.info.showRelic(getRelic(id)); },
      drop: (from, to) => {
        this.dragVisual?.endDrag();
        this.picked = moveFormationSlot(this.picked, from, to);
        this.selectedSlot = to;
        // 미리보기로 옮겨 둔 SD는 확정 뒤 기존 비동기 재배치 경로가 제자리에 다시 세운다.
        this.refresh();
      },
    });
  }

  /**
   * 자리·카드 **말고 다른 곳**을 누르면 선택이 풀린다.
   *
   * 고른 칸 표시가 계속 떠 있으면 다 고르고 난 뒤에도 무언가 더 할 일이 남은 것처럼 보인다.
   * 입력면(슬롯·카드) 위에서 뗀 손은 그 입력면의 일이므로 건드리지 않는다.
   */
  private bindDeselect(): void {
    const clear = (_pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]): void => {
      // 입력면 위에서 뗀 손은 그 입력면의 일이다. 빈 곳에서 뗀 손만 선택을 푼다.
      if (objects.length > 0 || this.selectedSlot === undefined) return;
      this.selectedSlot = undefined;
      this.refresh();
    };
    this.input.on("pointerup", clear);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off("pointerup", clear));
  }

  /** 자리를 누르면 고르고, 골라 둔 자리를 한 번 더 누르거나 `−`를 누르면 그 자리만 비운다. */
  private tapSlot(slot: number, intent: "select" | "clear" = "select"): void {
    const result = tapFormationSlot(this.picked, slot, this.selectedSlot, intent);
    this.picked = result.formation;
    this.selectedSlot = result.selectedSlot;
    this.refresh();
  }

  /** 공용 컨트롤러가 계산한 슬롯 결과를 기존 화면 좌표 Puppet 배치기로 그린다. */
  private placeDragPreview(preview: import("../ui/formationDragVisual").FormationSlotPreview[], x: number, y: number): void {
    preview.forEach((entry, index) => {
      const creature = this.allySlots[index].creature;
      const relicId = this.picked[index];
      if (!creature || !relicId) return;
      if (entry.lifted) {
        placePuppet(creature, relicAppearanceManager.battleAssetFor(relicId), { x, groundY: y + PREVIEW_HEIGHT / 2, height: PREVIEW_HEIGHT * FORMATION_DRAG_VISUAL.liftScale, flipX: false });
        creature.setDepth(20).setAlpha(FORMATION_DRAG_VISUAL.liftAlpha);
        return;
      }
      const target = preview.findIndex((other) => other.relicId === relicId);
      placePuppet(creature, relicAppearanceManager.battleAssetFor(relicId), { x: PREVIEW_COLUMNS[target < 0 ? index : target], groundY: ALLY_ROW, height: PREVIEW_HEIGHT, flipX: false });
      creature.setDepth(-10).setAlpha(target === index ? 1 : FORMATION_DRAG_VISUAL.previewAlpha);
    });
  }

  /** 취소 시 확정 배열을 건드리지 않고 기존 placePuppet 경로로 전부 원상 복구한다. */
  private restoreDragPuppets(): void {
    this.allySlots.forEach((slot, index) => {
      const relicId = this.picked[index];
      if (!slot.creature || !relicId) return;
      placePuppet(slot.creature, relicAppearanceManager.battleAssetFor(relicId), { x: PREVIEW_COLUMNS[index], groundY: ALLY_ROW, height: PREVIEW_HEIGHT, flipX: false });
      slot.creature.setDepth(-10).setAlpha(1);
    });
  }

  /** 미리보기용 SD 하나를 세운다. 씬을 떠난 뒤 도착한 로딩은 그대로 버린다. */
  private async standSD(relicId: string, x: number, groundY: number, enemy: boolean): Promise<PuppetCreature | undefined> {
    const creature = await spawnPuppet(this, relicAppearanceManager.battleAssetFor(relicId, enemy ? "enemy" : "ally"), {
      x,
      groundY,
      height: PREVIEW_HEIGHT,
      flipX: enemy,
      // 전투 화면과 같은 규칙 — 임시 공용 적만 색으로 구분한다.
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
    const { columns: cols, cardWidth: cardW, cardHeight: cardH, rowStep } = ROSTER_GRID;
    // 첫 줄은 창 윗변에 붙이지 않는다 — 칩 밖으로 빠져나온 정수리가 마스크에 잘린다.
    const startY = portraitGridFirstRowY(ROSTER_VIEWPORT.top, cardH, PORTRAIT_GRID_MASK_GAP);

    const content = this.add.container(0, 0);
    this.rosterContent = content;
    this.rosterMask = this.make.graphics({});
    this.rosterMask.fillStyle(0xffffff, 1).fillRect(0, ROSTER_VIEWPORT.top, BASE_WIDTH, ROSTER_VIEWPORT.bottom - ROSTER_VIEWPORT.top);
    content.setMask(this.rosterMask.createGeometryMask());

    // 보유한 렐릭만 편성할 수 있다.
    const roster = relicCollection.owned;
    roster.forEach((relic, i) => {
      const x = rosterColumnX(i % cols);
      const y = startY + Math.floor(i / cols) * rowStep;
      const role = ROLE_LABEL[relic.role];
      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        relicId: relic.id,
        label: relic.name,
        level: relicProgression.getProgress(relic.id).level,
        rarity: relic.rarity,
        stars: relicProgression.getStars(relic.id),
        affinity: { element: relic.element, role: relic.role },
        // 이미 자리에 나가 있는 카드는 떠오르지 않고 눌려 들어간다 — 발광은 "지금 고를 수 있다"로
        // 읽혀 이미 세운 렐릭과 아직 고를 수 있는 렐릭이 같은 무게가 된다.
        selectedStyle: "pressed",
      });

      this.bindCardInput(card.hit, relic);
      this.cards.set(relic.id, { card, role });
      content.add(card);
    });

    const rows = Math.ceil(roster.length / cols);
    const contentHeight = rows > 0 ? PORTRAIT_GRID_MASK_GAP + portraitGridContentHeight(rows, rowStep, cardH) : 0;
    const viewportHeight = ROSTER_VIEWPORT.bottom - ROSTER_VIEWPORT.top;
    // 도감과 같은 28px 여유를 아래에도 둬 마지막 줄 밑변이 마스크 경계에 겹쳐 깎이지 않게 한다.
    this.rosterMinScroll = Math.min(0, viewportHeight - contentHeight - 28);
    this.scrollRosterTo(0);
    this.bindRosterScroll();

    this.add
      .text(BASE_WIDTH / 2, 1520, "꾹 누르면 상세 정보", textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  /** 창 안에서만 흐르게 하는 휠·드래그 배선. 씬이 내려갈 때 리스너와 마스크를 함께 뗀다. */
  private bindRosterScroll(): void {
    const inViewport = (pointer: Phaser.Input.Pointer): boolean =>
      pointer.worldY >= ROSTER_VIEWPORT.top && pointer.worldY <= ROSTER_VIEWPORT.bottom;
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      if (!inViewport(pointer) || this.rosterMinScroll === 0) return;
      this.rosterDragging = true;
      this.rosterDraggedDistance = 0;
      this.rosterDragOrigin = this.rosterScrollY - pointer.y;
    };
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (!this.rosterDragging || !pointer.isDown) return;
      this.rosterDraggedDistance += Math.abs(pointer.velocity.y);
      this.scrollRosterTo(this.rosterDragOrigin + pointer.y);
    };
    // 끌린 거리는 카드의 짧은 탭 판정이 읽으므로 다음 프레임에 비운다.
    const onUp = (): void => { this.rosterDragging = false; this.time.delayedCall(0, () => { this.rosterDraggedDistance = 0; }); };
    const onWheel = (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
      if (inViewport(pointer)) this.scrollRosterTo(this.rosterScrollY - dy);
    };
    this.input.on("pointerdown", onDown);
    this.input.on("pointermove", onMove);
    this.input.on("pointerup", onUp);
    this.input.on("pointerupoutside", onUp);
    this.input.on("wheel", onWheel);
    // PortraitCard의 기하 마스크는 부모 이동을 물려받지 않으므로 스크롤마다 다시 맞춘다.
    this.rosterTicker = this.time.addEvent({ delay: 16, loop: true, callback: () => this.syncRosterCardMasks() });
    this.syncRosterCardMasks();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", onDown);
      this.input.off("pointermove", onMove);
      this.input.off("pointerup", onUp);
      this.input.off("pointerupoutside", onUp);
      this.input.off("wheel", onWheel);
      this.rosterTicker?.remove(false); this.rosterTicker = undefined;
      this.rosterMask?.destroy(); this.rosterMask = undefined;
    });
  }

  private scrollRosterTo(value: number): void {
    this.rosterScrollY = Phaser.Math.Clamp(value, this.rosterMinScroll, 0);
    this.rosterContent?.setY(this.rosterScrollY);
    this.syncRosterCardMasks();
  }

  private syncRosterCardMasks(): void {
    for (const { card } of this.cards.values()) card.syncMask();
  }

  /**
   * 짧게 누름(편성 토글)과 꾹 누름(정보창)을 가른다.
   *
   * 시간·게이지 연출·취소 규칙은 공용 `bindLongPress` 하나가 갖는다 — 화면마다 타이머를 따로
   * 달면 어디서는 열리고 어디서는 열리지 않는 그리드가 남는다.
   */
  private bindCardInput(box: Phaser.GameObjects.Rectangle, relic: RelicDef): void {
    bindLongPress(this, box, {
      onLongPress: () => this.info.showRelic(relic),
      onTap: () => this.toggle(relic.id),
      // 끌어 내리다 손을 뗀 자리의 카드가 편성되지 않게 한다.
      allowTap: () => this.rosterDraggedDistance <= ROSTER_DRAG_SLOP,
      depth: 900,
    });
  }

  /**
   * 목록의 카드를 누르면 **고른 자리**에 선다.
   *
   * 채우는 순서가 자리를 정하지 않는다. 이미 어느 자리에 선 렐릭을 누르면 옮기지 않고 그 자리를
   * 고른다 — 자세한 계약은 `tapRosterRelic`에 있다.
   */
  private toggle(relicId: string): void {
    const result = tapRosterRelic(this.picked, this.selectedSlot, relicId);
    this.picked = result.formation;
    this.selectedSlot = result.selectedSlot;
    this.refresh();
  }

  private refresh(): void {
    const members = formationMembers(this.picked);
    for (const [id, entry] of this.cards) {
      const at = this.picked.indexOf(id);
      const chosen = at >= 0;
      entry.card.setSelected(chosen);
      entry.card.setSub(chosen ? `${at + 1}번 자리` : entry.role);
    }

    const plate = this.slotPlate;
    const chrome = this.slotChrome;
    const marks = this.allyMarks;
    plate?.removeAll(true);
    chrome?.removeAll(true);
    marks?.removeAll(true);
    this.allySlots.forEach((slot, i) => {
      const id = this.picked[i] ?? undefined;
      const standing = slot.creature !== undefined;
      slot.platform.setAlpha(id ? 1 : 0.55);
      // 빈 슬롯 및 전체 관계가 상쇄된 중립은 텍스트 대신 표식 자체를 완전히 숨긴다.
      slot.affinityDirection.setDirection(id ? relicAffinityDirection(getRelic(id), this.enemies) : "neutral");
      // 이미 그 렐릭이 서 있으면 다시 세우지 않는다.
      if (!id || !standing || slot.currentId !== id) void this.fillAllySlot(slot, i, id);
      slot.currentId = id;

      // **아군도 적과 같은 어휘로 선다** — 속성·직군은 왼쪽 위 아이콘, 돌파는 오른쪽 위 로마자,
      // 레벨과 이름은 한 줄에(레벨 강조색·이름 흰색). "1번 자리" 같은 글자는 두지 않는다:
      // 자리는 왼쪽부터 순서 그대로이고, 그 글자가 정작 이름줄보다 아래에서 자리만 차지했다.
      if (marks && id) {
        const def = getRelic(id);
        const badgeTop = ALLY_ROW - PREVIEW_HEIGHT + 34;
        marks.add(new AffinityBadge(this, PREVIEW_COLUMNS[i] - 104, badgeTop, ELEMENT_ICON[def.element], 52, 0.62));
        marks.add(new AffinityBadge(this, PREVIEW_COLUMNS[i] - 104, badgeTop + 49, ROLE_ICON[def.role], 38, 0.62));
        addStarMark(this, marks, PREVIEW_COLUMNS[i] + 104, badgeTop - 4, 42, relicProgression.getStars(id));
        addUnitNameplate(this, marks, PREVIEW_COLUMNS[i], ALLY_ROW + 26, relicProgression.getProgress(id).level, def.name, 30);
      }

      if (!chrome || !plate) return;
      const box = { x: PREVIEW_COLUMNS[i], y: ALLY_ROW - PREVIEW_HEIGHT / 2, width: 210, height: PREVIEW_HEIGHT };
      if (i === this.selectedSlot) addFormationSlotSelection(this, plate, box, COLOR.ally);
      // 빼는 표식은 **고른 자리에 누군가 서 있을 때만** 선다. 늘 세워 두면 세 자리 위에 붉은
      // 표식이 셋 늘어서 SD보다 먼저 읽힌다.
      if (i === this.selectedSlot && id) addFormationRemoveChip(this, chrome, box, () => this.tapSlot(i, "clear"));
    });

    // 어느 편이 센지는 두 수가 마주 보는 것으로 말한다. 표시·정렬 전용 값이라 전투에는 쓰지 않는다.
    this.enemyPowerText?.setText(`적 ${this.enemies.reduce((sum, def) => sum + combatPower(def.stats), 0).toLocaleString()}`);
    this.allyPowerText?.setText(`${members.reduce((sum, id) => sum + combatPower(relicProgression.getFinalStats(id)), 0).toLocaleString()} 아군`);

    this.refreshButtonState();
    // 자동 배치 직후 방향 표식이 실제로 나타났는지 캔버스 밖 E2E가 판별하는 읽기 전용 수치다.
    setDebugParty({
      autoButton: this.autoButtonPosition,
      visibleAffinityDirections: this.allySlots.filter((slot) => slot.affinityDirection.visible).length,
      selectedCount: members.length,
      // 입력면 중심을 공개해 E2E가 SD 로딩이나 하드코딩 좌표에 의존하지 않게 한다.
      slots: PREVIEW_COLUMNS.map((x) => ({ x, y: ALLY_ROW - PREVIEW_HEIGHT / 2 })),
    });
    this.hint.setText(members.length === 3 ? "편성 완료" : `${3 - members.length}명 더 골라야 한다`);
  }

  /** 선택 수와 전투 진입 잠금을 함께 반영해 버튼 활성 상태를 한곳에서 계산한다. */
  private refreshButtonState(): void {
    this.startButton.setEnabled(formationMembers(this.picked).length === 3 && !this.isEnteringBattle);
  }

  /** 모든 실패 경로가 진입 잠금과 버튼을 함께 복구하도록 한곳에서 처리한다. */
  private restoreEntryControls(): void {
    this.isEnteringBattle = false;
    this.refreshButtonState();
  }

  /** 매니저의 안정적인 실패 코드를 편성 화면에서 바로 이해할 수 있는 안내로 바꾼다. */
  private partyFailureMessage(reason: SetPartyFailureReason, relicId?: string): string {
    if (reason === "wrong-size") return "정확히 3명을 골라야 전투를 시작할 수 있다.";
    if (reason === "duplicate") return "같은 렐릭을 두 자리 이상 편성할 수 없다.";
    const relicName = relicId ? getRelic(relicId).name : "선택한 렐릭";
    return `${relicName}은(는) 현재 보유하고 있지 않아 편성할 수 없다.`;
  }
}
