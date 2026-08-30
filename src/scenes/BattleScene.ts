import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { FEROCITY_RULES } from "../core/ferocity";
import {
  aliveFighters,
  battleContributionSnapshot,
  canFireUltimate,
  createSkirmish,
  fireUltimate,
  isFighterAlive,
  renderPose,
  stepSkirmish,
  teamHp,
  type Arena,
  type Fighter,
  type SkirmishEvent,
  type SkirmishState,
  skirmishRelicResults,
} from "../core/skirmish";
import { getRelic } from "../data/relics";
import { getStage, getStageEnemies } from "../data/stages";
import { getExpeditionNodeEnemies } from "../data/expeditionEnemies";
import type { PuppetCreature, PuppetAsset } from "../puppets/assets";
import { battleAssetFor, cancelMotion, flashHit, placePuppet, playMotion, spawnPuppet, tintPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { drawGlassFade, drawHairline, HOLO, HoloBar } from "../ui/holo";
import { PortraitCard } from "../ui/PortraitCard";
import { UnitHealthBar } from "../ui/UnitHealthBar";
import { skillArtTint } from "../ui/skillArt";
import { COLOR, textStyle } from "../ui/theme";
import { setDebugBattle, setDebugScene } from "../debug";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { UltimateCutIn } from "../ui/UltimateCutIn";
import {
  nextBattleSpeed, scaleUltimateDuration, shouldWaitForUltimatePresentation, ultimatePresentationTiming, ULTIMATE_RECOVERY_RATIO,
  type BattleSpeed,
} from "../core/battleControls";
import { ControlChip } from "../ui/ControlChip";
import {
  beginNextUltimate, cancelUltimateSequence, createUltimateSequenceState, enqueueUltimate, releaseUltimate,
  type UltimateSequenceState,
} from "../core/ultimateSequence";
import type { MotionPlayback } from "../puppets/assets";
import { ultimatePresentationFor } from "../data/ultimatePresentations";
import { relicProgression } from "../managers/RelicProgressionManager";
import { PopupLayer } from "../ui/PopupLayer";
import { ExpeditionRankingPopup } from "../ui/ExpeditionRankingPopup";
import { createExpeditionBossSkirmishConfig, createExpeditionSkirmishConfig, expeditionBattleResults, type BattleSceneInputDto, type ExpeditionBattleInputDto, type ExpeditionBossBattleInputDto } from "../core/expeditionBattle";
import type { ExpeditionBossAction } from "../core/expeditionBoss";
import { expeditionManager } from "../managers/ExpeditionManager";
import { settingsManager } from "../managers/SettingsManager";
import type { SettleExpeditionRunResponse, SubmitExpeditionBossScoreResponse } from "../api/contracts";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { BATTLE_STATUS_LAYOUT, statusBadgeOffsets } from "../ui/battleStatusLayout";
import { BattleProfile } from "../ui/BattleProfile";
import { BattleContributionPanel } from "../ui/BattleContributionPanel";
import { createBattleContributionResult, withConfirmedAttackTotal, type BattleContributionResult, type ContributionCategory } from "../core/battleContribution";
import { BattleContributionPopup } from "../ui/BattleContributionPopup";

/**
 * 여섯이 돌아다닐 수 있는 범위.
 *
 * 아군은 아래쪽 끝에서 출발해 위쪽 적진까지 달려 올라간다. 아래 프로필 판과 위 정보 글자를
 * 침범하지 않는 선에서 최대한 넓게 잡아 난전이 한 자리에 뭉치지 않게 한다.
 */
const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };
/** SD 한 명의 화면 높이. 여섯이 겹치지 않도록 기존 300에서 0.7배로 줄였다. */
const UNIT_HEIGHT = 210;
const PROFILE_TOP = 1430;
/** 조작 칩은 프로필 줄 바로 위 우하단에 모인다. 전장을 가리지 않고 엄지가 닿는 자리다. */
// 전장 아래쪽에 서므로 SD·체력 바보다 앞에 둔다. 컷인(900)보다는 뒤라 연출을 가리지 않는다.
const BATTLE_CONTROLS = { rowY: 1360, rightX: BASE_WIDTH - 130, speedX: BASE_WIDTH - 335, stackGap: 92, depth: 320 } as const;

/**
 * 카드를 덮는 궁극기 가림막.
 *
 * 반지름은 300 카드의 모서리까지 덮을 만큼이고, 진하기는 **비쳐 보일 만큼**만이다. 새까맣게
 * 덮으면 누가 서 있는지조차 읽히지 않아 "아직 못 쓴다"가 아니라 "빈 칸"으로 보인다.
 */
const CHARGE_VEIL_RADIUS = 240;
const CHARGE_VEIL_ALPHA = 0.58;
/** 아직 다 차지 않은 카드의 불투명도. 다 차면 1이 되어 그림이 온전히 선다. */
const CHARGE_CARD_ALPHA = 0.62;

/** 야성 수치의 글자색. 게이지의 붉은 계열과 같아 어느 수인지 색으로 먼저 읽힌다. */
const FEROCITY_TEXT = COLOR.ferocityText;

/** 게이지와 수치가 실제 값을 따라잡는 빠르기(초당 비율). */
const METER_EASE = 6;

/**
 * 폭주 연출.
 *
 * SD가 한 뼘 커지고 몸 안팎이 같은 색으로 물든다. 발광은 도형이 아니라 **가장자리가 흐린
 * 한 장**이다(`FEVER_GLOW_TEXTURE`) — 타원을 겹쳐 쌓으면 테두리가 비눗방울처럼 남는다.
 */
const FEVER = { scale: 1.1, outer: 2, core: 1.05, outerAlpha: 0.7, coreAlpha: 0.36, bodyMix: 0.32 } as const;

/** 폭주 발광 한 장. 가운데가 진하고 가장자리로 갈수록 사라지는 흰 원이라 tint로 색만 갈아 쓴다. */
const FEVER_GLOW_TEXTURE = "fever-glow";

function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FEVER_GLOW_TEXTURE)) return;
  const size = 256;
  const canvas = scene.textures.createCanvas(FEVER_GLOW_TEXTURE, size, size);
  const context = canvas?.context;
  if (!canvas || !context) return;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  canvas.refresh();
}

/** 두 색을 비율대로 섞는다. 폭주 중 몸에 제 색을 옅게 얹을 때 쓴다. */
function mixTint(base: number, other: number, amount: number): number {
  const blend = (shift: number): number => Math.round(
    (((base >> shift) & 0xff) * (1 - amount)) + (((other >> shift) & 0xff) * amount),
  );
  return (blend(16) << 16) | (blend(8) << 8) | blend(0);
}

/** 색을 어둡게 눌러 "밝게 번지는" 대신 "짙게 감도는" 발광으로 만든다. */
function darken(color: number, amount: number): number {
  const keep = 1 - amount;
  return (Math.round(((color >> 16) & 0xff) * keep) << 16)
    | (Math.round(((color >> 8) & 0xff) * keep) << 8)
    | Math.round((color & 0xff) * keep);
}

/**
 * 전장 안에서의 앞뒤 순서.
 *
 * SD는 발 높이에 따라 0~90 사이를 오간다. 체력 바와 피해 숫자는 그보다 확실히 위에 둬야
 * 아래쪽에 선 캐릭터에 가려지지 않는다 — 정확히 이 이유로 피해량이 보이지 않았다.
 */
const DEPTH = { unitBase: -60, hpBar: 200, damage: 300, burst: 320 } as const;

interface FighterView {
  creature: PuppetCreature;
  asset: PuppetAsset;
  fighter: Fighter;
  /** 움직이는 Puppet의 메시 입력 경계 대신 몸통을 따라가는 안정적인 전투 클릭 영역이다. */
  infoHit?: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
  /** 머리 위 체력 바. 깎일 때 스르륵 따라오는 것은 프리팹이 맡는다. */
  hpBar: UnitHealthBar;
  /** 걸린 상태이상을 알리는 작은 뱃지. 체력 바 옆에 붙는다. */
  bleedBadge: Phaser.GameObjects.Container;
  /** 상태 소유자인 src/core/skirmish.ts의 기절 결과를 체력 바 옆에 그리는 각진 번개 표식이다. */
  stunBadge: Phaser.GameObjects.Container;
  /** 코어 상태 전환 때만 Puppet 모션을 바꾸기 위한 마지막 기절 표시값이다. */
  stunShown: boolean;
  /** 폭주 중에만 켜지는 발광. 몸 뒤에 넓게 번지는 겹과 몸 위에 얹히는 좁은 겹 둘이다. */
  feverGlow: Phaser.GameObjects.Image;
  feverCore: Phaser.GameObjects.Image;
  /** 그 개체의 속성·직군을 섞은 색. 발광과 폭주 중 몸 색이 여기서 나온다. */
  feverTint: number;
  /** 피격 섬광이 끝난 뒤 되돌릴 원래 색. */
  tint: number;
  /** 지금 몸이 폭주 색으로 물들어 있는지. 상태가 바뀔 때만 다시 칠한다. */
  feverTinted: boolean;
  dead: boolean;
}

/** 하단 프로필 한 칸. 궁극기가 차면 카드 자체가 발동 버튼이 된다. */
interface ProfileView {
  fighter: Fighter;
  /** 카드·게이지·기준선을 함께 소유하는 공용 전투 프로필이다. */
  prefab: BattleProfile;
  card: PortraitCard;
  glow: Phaser.GameObjects.Rectangle;
  /**
   * 전투 중에는 **체력과 폭주** 둘만 세운다.
   *
   * 궁극기 충전은 바가 아니라 카드 그림 자체가 말한다(`charge`) — 바가 셋이면 어느 것이
   * 지금 급한 값인지 읽히지 않고, 정작 글자는 작아진다. 남긴 둘은 대신 굵고 크게 적는다.
   */
  hpBar: HoloBar;
  hpLabel: Phaser.GameObjects.Text;
  ferocityBar: HoloBar;
  ferocityLabel: Phaser.GameObjects.Text;
  /** 카드를 덮는 어둠. 궁극기가 찰수록 시계 방향으로 걷혀 그림이 밝아진다. */
  charge: Phaser.GameObjects.Graphics;
  /** 화면에 지금 적힌 값. 실제 값으로 스르륵 따라가며 숫자가 굴러간다. */
  hpShown: number;
  ferocityShown: number;
  ready: boolean;
  pulse?: Phaser.Tweens.Tween;
  /** 입력 가능한 카드 위만 주기적으로 지나는 얇은 황동 사선이다. */
  sweep: Phaser.GameObjects.Rectangle;
  sweepTween?: Phaser.Tweens.Tween;
}

/** SD 여섯이 실시간으로 뒤엉켜 싸우는 자동 전투 화면이다. */
export class BattleScene extends Phaser.Scene {
  /** init 입력은 씬 한 생명주기 동안 고정되며 원정 진행 상태는 매니저만 저장한다. */
  private battleInput: BattleSceneInputDto = { mode: "stage" };
  private state!: SkirmishState;
  private views = new Map<string, FighterView>();
  private profiles: ProfileView[] = [];
  private finished = false;
  /** 보스 제출에는 코어가 실제로 낸 공격 종류와 시각만 기록하며 피해 숫자는 넣지 않는다. */
  private bossActions: ExpeditionBossAction[] = [];
  private bossScoreLabel?: Phaser.GameObjects.Text;
  private bossPhaseLabel?: Phaser.GameObjects.Text;
  private bossBestLabel?: Phaser.GameObjects.Text;
  /** 코어가 계산한 리미트 경고선만 그리며 범위나 시간을 씬에서 재계산하지 않는다. */
  private bossWarningLine?: Phaser.GameObjects.Graphics;
  private spawned = false;
  /** 마지막으로 시뮬레이션을 굴린 실제 시각(ms). */
  private lastStepAt = 0;
  /** 시뮬레이션 시간에만 곱하는 현재 전투 배속이다. */
  private battleSpeed: BattleSpeed = 1;
  /** E2E가 Canvas의 짧은 회복 표시 수명을 관찰하기 위한 개수이며 게임 상태에는 관여하지 않는다. */
  private healPopups = 0;
  /** 켜져 있으면 게이지가 찬 아군 궁극기를 다음 프레임에 자동 발동한다. */
  private autoUltimate = false;
  /** 공개적으로 읽기 쉬운 입력 잠금. 토큰 큐와 항상 함께 갱신한다. */
  private ultimateSequenceActive = false;
  /** 자동 동시 준비를 직렬화하고 오래된 async 완료를 구분하는 순수 상태다. */
  private ultimateSequence: UltimateSequenceState = createUltimateSequenceState();
  /** 현재 컷인. 전투·씬 종료 정리에서 즉시 거두기 위한 참조다. */
  private activeCutIn?: UltimateCutIn;
  /** 잠금 중에도 연출 주인공 카드만 밝게 남기기 위한 현재 전투원 id다. */
  private currentUltimateFighterId: string | null = null;
  private speedChip!: ControlChip;
  private autoChip!: ControlChip;
  private presentationChip!: ControlChip;
  /** 적 상세는 플레이어 성장 입력을 만들지 않는 전투 읽기 전용 창이다. */
  private info!: CharacterInfoManager;
  /** 한 판 안에서만 열림·카테고리를 기억하며 영구 설정에는 쓰지 않는 기여도 프리팹이다. */
  private contributionPanel?: BattleContributionPanel;
  private contributionCategory: ContributionCategory = "attack";
  /** 빠른 타격마다 순위가 흔들리지 않도록 표시 스냅샷은 350ms 간격으로만 교체한다. */
  private contributionRefreshAt = 0;
  /** finishBattle 첫 진입에서만 만든 JSON 스냅샷으로 정산 재시도와 연출 완료가 개별 값을 바꾸지 못한다. */
  private contributionResult?: BattleContributionResult;

  constructor() {
    super("battle");
  }

  /** 기존 상단 안전 영역에 보스 점수·단계·최고 기록을 고정하고 전장 입력을 가리지 않는다. */
  private buildBossScoreHud(): void {
    this.bossScoreLabel = this.add.text(42, 92, "관측 피해 0", textStyle({ role: "display", size: 38, color: COLOR.sortieText })).setDepth(90);
    this.bossPhaseLabel = this.add.text(42, 140, "관측 · 00:00", textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setDepth(90);
    this.bossBestLabel = this.add.text(42, 180, "주간 최고 0", textStyle({ role: "emphasis", size: 25, color: COLOR.ink })).setDepth(90);
    // 선은 전투 좌표에 놓되 실제 리미트 판정은 전적으로 코어 상태가 소유한다.
    this.bossWarningLine = this.add.graphics().setDepth(35);
    // 최고 기록은 서버 스냅샷만 표시하고 실패하면 0 표기를 유지해 로컬 추정치를 권한으로 쓰지 않는다.
    void gameApi.getExpeditionWeeklyBest().then(({ bestScore }) => this.bossBestLabel?.setText(`주간 최고 ${bestScore.toLocaleString()}`));
  }

  /** Phaser scene data를 명시 DTO로 받아 일반 스테이지와 원정 결과 경계를 분리한다. */
  init(input?: BattleSceneInputDto): void {
    // Phaser가 이전 scene.start data를 재사용할 수 있으므로 매 진입마다 명시적으로 stage 기본값을
    // 새로 넣는다. 원정 뒤 스토리 전투가 남은 원정 DTO로 실행되는 것을 이 경계에서 차단한다.
    this.battleInput = input?.mode === "expedition" || input?.mode === "expeditionBoss" ? input : { mode: "stage" };
  }

  create(): void {
    setDebugScene("battle");
    const stage = getStage(session.selectedStageId ?? "1-1");
    // 적은 스테이지별 임시 레벨 성장치를 적용한 복사본으로 전투에 투입한다.
    // 유대는 정적 RelicDef가 아니라 현재 플레이어의 저장 진행에서 전투 스냅샷으로 넘긴다.
    const partyIds = this.battleInput.mode === "expedition" || this.battleInput.mode === "expeditionBoss" ? this.battleInput.relics.map(({ relicId }) => relicId) : session.party;
    const bonds = Object.fromEntries(partyIds.map((id) => [id, session.relicProgress[id]?.bondLevel ?? 0]));
    // 각성 단계도 같은 방식으로 스냅샷을 넘긴다. 전투 코어는 저장 상태를 직접 읽지 않는다.
    const breakthroughs = Object.fromEntries(partyIds.map((id) => [id, session.relicProgress[id]?.breakthrough ?? 0]));
    // UI와 같은 성장 계산기의 스냅샷을 복사해 전투가 룬 수치를 다시 계산하지 않게 한다.
    const players = partyIds.map((id) => ({ ...getRelic(id), stats: relicProgression.getFinalStats(id) }));
    // 원정은 노드 정보창과 같은 정적 편성/레벨 정의를 읽고, 스토리만 스테이지 적을 읽는다.
    const stageEnemies = this.battleInput.mode === "expedition"
      ? getExpeditionNodeEnemies(this.battleInput.nodeType, this.battleInput.floor)
      : this.battleInput.mode === "expeditionBoss" ? getExpeditionNodeEnemies("boss", 20) : getStageEnemies(stage);
    const expeditionConfig = this.battleInput.mode === "expedition" ? createExpeditionSkirmishConfig(this.battleInput, players, stageEnemies)
      : this.battleInput.mode === "expeditionBoss" ? createExpeditionBossSkirmishConfig(this.battleInput, players, stageEnemies) : null;
    this.state = createSkirmish(expeditionConfig?.playerDefs ?? players, expeditionConfig?.enemyDefs ?? stageEnemies, ARENA, bonds, breakthroughs, expeditionConfig ? {
      // 원정 입력 모델이 HP·증강·크기까지 만들고 씬은 공용 난전을 연결하기만 한다.
      playerInitialStates: expeditionConfig.playerInitialStates,
      augmentEffects: expeditionConfig.augmentEffects,
      enemyBodyScale: expeditionConfig.enemyBodyScale,
      ...(this.battleInput.mode === "expeditionBoss" ? { boss: (expeditionConfig as ReturnType<typeof createExpeditionBossSkirmishConfig>).boss } : {}),
    } : {});
    this.views.clear();
    this.profiles = [];
    this.finished = false;
    this.spawned = false;
    // 이전 씬의 tween 종료보다 재진입이 빠르더라도 표시 관찰값은 새 전투에서 0부터 시작한다.
    this.healPopups = 0;
    this.bossActions = [];
    // 이전 전투/환경설정에서 저장한 조작 상태를 새 판의 시작값으로 그대로 복원한다.
    const battleSettings = settingsManager.get().game;
    this.battleSpeed = battleSettings.battleSpeed;
    this.autoUltimate = battleSettings.autoUltimate;
    this.ultimateSequenceActive = false;
    this.ultimateSequence = createUltimateSequenceState();
    this.currentUltimateFighterId = null;
    this.contributionCategory = "attack";
    this.contributionRefreshAt = 0;
    this.contributionResult = undefined;
    // 적도 같은 정보창을 쓴다. 문맥만 "enemy"라 급여·돌파·유대·룬이 빠지고 현재 전투 줄이 붙는다.
    this.info = new CharacterInfoManager(this, 1001, "enemy");

    // 편성 화면에서 본 6번 전장을 그대로 이어 실제 전투의 공간으로 사용한다.
    addSceneBackground(this, this.battleInput.mode === "expedition" || this.battleInput.mode === "expeditionBoss" ? BACKGROUND.expeditionField : BACKGROUND.combat, -30);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.28).setDepth(-29);
    this.add.text(42, 48, `${stage.id} · ${stage.name} · 적 LV.${stage.enemyLevel}`, textStyle({ role: "body", size: 30, color: COLOR.inkDim }));
    this.add.text(BASE_WIDTH / 2, 160, "AUTO BATTLE", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    if (this.battleInput.mode === "expeditionBoss") this.buildBossScoreHud();

    this.buildBattleControls();

    // 씬은 코어 스냅샷을 넘길 뿐 공격·방어·회복 합산을 복제하지 않는다.
    this.contributionPanel = new BattleContributionPanel(this, (category) => {
      this.contributionCategory = category;
      this.refreshContribution(true);
      this.refreshDebug();
    });
    this.refreshContribution(true);

    this.buildProfiles();
    void this.spawnFighters();
    this.refreshDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelUltimatePresentation();
      this.contributionPanel?.destroy();
      this.contributionPanel = undefined;
      this.views.forEach((view) => view.creature.destroy());
      this.views.clear();
    });
  }

  /** 점수 제출 → 로컬 노드 반영 → completed 정산을 고정 ID로 직렬화한다. */
  private async submitAndSettleBoss(input: ExpeditionBossBattleInputDto, actions: ExpeditionBossAction[]): Promise<void> {
    try {
      const score = await gameApi.submitExpeditionBossScore({ requestId: input.requestId, runId: input.runId, nodeId: input.nodeId, actions });
      // 서버가 확정한 피해만 노드에 반영하며 클라이언트 추정 피해는 상태에 쓰지 않는다.
      const completed = expeditionManager.completeNode(input.nodeId, { relicHp: [0, 0, 0], bossDamage: score.score, score: score.score });
      if (!completed && !expeditionManager.status().run?.visitedNodeIds.includes(input.nodeId)) throw new Error("BOSS_NODE_SAVE_FAILED");
      const settlement = await gameApi.settleExpeditionRun({ runId: input.runId, settlementId: input.settlementId, outcome: "completed" });
      // 보스 완료도 공용 지급 영수증을 먼저 확인한 뒤 점수 결과판으로 이어진다.
      openRewardPopup(this, new PopupLayer(this, 2200), { title: "원정 완료 전리품", items: currencyRecordToRewardItems(settlement.granted), onConfirm: () => this.showBossResult(score, settlement) });
    } catch {
      // 같은 버튼은 저장된 요청 ID로 전체 체인을 재시도하므로 성공한 서버 제출도 중복 누적되지 않는다.
      new Button(this, BASE_WIDTH / 2, 1050, { width: 460, height: 100, label: "정산 다시 시도", onClick: () => void this.submitAndSettleBoss(input, actions) }).setDepth(201);
    }
  }

  /** 서버 기록과 정산 재화를 한 장의 최종 영수증으로 보여 준다. */
  private showBossResult(score: SubmitExpeditionBossScoreResponse, settlement: SettleExpeditionRunResponse): void {
    // 서버 재검증 총점은 머리글에만 더하고 확정 당시의 개별 행동 분배는 다시 시뮬레이션하지 않는다.
    if (this.contributionResult) this.contributionResult = withConfirmedAttackTotal(this.contributionResult, score.score);
    this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH - 90, 850, COLOR.void, 0.94).setDepth(200);
    this.add.text(BASE_WIDTH / 2, 620, "원정 관측 완료", textStyle({ role: "display", size: 60, color: COLOR.accentText })).setOrigin(0.5).setDepth(201);
    const rank = score.rankBefore === null ? `신규 → ${score.rankAfter}위` : `${score.rankBefore}위 → ${score.rankAfter}위`;
    const rewards = Object.entries(settlement.granted).filter(([, amount]) => amount > 0).map(([id, amount]) => `${id} +${amount.toLocaleString()}`).join("  ·  ") || "정산 재화 없음";
    this.add.text(BASE_WIDTH / 2, 875, `이번 점수  ${score.score.toLocaleString()}\n주간 최고  ${score.bestScore.toLocaleString()}  ${score.improved ? "· 최고점 갱신" : "· 기존 기록 유지"}\n누적 점수  ${score.cumulativeScore.toLocaleString()}\n순위  ${rank}\n\n런 정산  ${rewards}`, textStyle({ role: "body", size: 31, color: COLOR.ink, align: "center", lineSpacing: 16 })).setOrigin(0.5).setDepth(201);
    // 제출 직후 서버 순위를 다시 조회하는 공용 기록판으로 새 최고점과 해금 단계를 한 번에 잇는다.
    const popups = new PopupLayer(this, 2200);
    new Button(this, BASE_WIDTH / 2 - 235, 1260, { width: 400, height: 105, label: "주간 기록 확인", onClick: () => new ExpeditionRankingPopup(this, popups).open() }).setDepth(201);
    new Button(this, BASE_WIDTH / 2 + 235, 1260, { width: 400, height: 105, label: "로비로", onClick: () => this.scene.start("lobby") }).setDepth(201);
    // 주요 이동 버튼을 압축하지 않고 둘째 줄의 작은 조회 버튼으로 결과판 위 팝업을 연다.
    new Button(this, BASE_WIDTH / 2, 1395, { width: 310, height: 78, label: "기여도", fontSize: 27, onClick: () => this.openContributionPopup(popups) }).setDepth(201);
  }

  /** 같은 PopupLayer 위에 읽기 전용 판을 쌓아 닫은 뒤 기존 결과 조작이 그대로 남게 한다. */
  private openContributionPopup(popups = new PopupLayer(this, 2200)): void {
    if (this.contributionResult) new BattleContributionPopup(this, popups).open(this.contributionResult);
  }

  /**
   * 세 전투 조작은 전장 위가 아니라 **손이 닿는 우하단**, 프로필 줄 바로 위에 모인다.
   *
   * 배속과 자동 궁극기가 한 줄로 서고, 연출 조작은 자동 궁극기 바로 위에 얹혀 "궁극기와
   * 관련된 조작"이 한 덩어리로 읽힌다.
   */
  private buildBattleControls(): void {
    const width = 170;
    this.speedChip = new ControlChip(this, BATTLE_CONTROLS.speedX, BATTLE_CONTROLS.rowY, {
      icon: "speed",
      label: `${this.battleSpeed}배속`,
      width,
      onClick: () => {
        this.battleSpeed = nextBattleSpeed(this.battleSpeed);
        // 판이 바뀌거나 앱을 다시 열어도 마지막 선택을 유지하도록 공용 저장 경계를 통과한다.
        settingsManager.update({ game: { battleSpeed: this.battleSpeed } });
        this.speedChip.setLabel(`${this.battleSpeed}배속`).setActive(this.battleSpeed > 1);
        this.refreshDebug();
      },
    });
    this.autoChip = new ControlChip(this, BATTLE_CONTROLS.rightX, BATTLE_CONTROLS.rowY, {
      icon: "auto",
      label: this.autoUltimate ? "궁극 ON" : "궁극 OFF",
      width,
      onClick: () => {
        this.autoUltimate = !this.autoUltimate;
        // 자동 궁극기도 배속과 같은 플레이 습관이므로 토글하는 즉시 저장한다.
        settingsManager.update({ game: { autoUltimate: this.autoUltimate } });
        this.autoChip.setLabel(this.autoUltimate ? "궁극 ON" : "궁극 OFF").setActive(this.autoUltimate);
        this.refreshDebug();
      },
    });
    const refreshPresentationChip = (): void => {
      const skipped = settingsManager.get().game.skipUltimatePresentation;
      this.presentationChip.setLabel(skipped ? "연출 스킵" : "연출 ON").setActive(skipped);
    };
    this.presentationChip = new ControlChip(this, BATTLE_CONTROLS.rightX, BATTLE_CONTROLS.rowY - BATTLE_CONTROLS.stackGap, {
      icon: "auto", label: "연출 ON", width,
      onClick: () => {
        // 전투 흐름을 바꾸는 값은 세션을 직접 고치지 않고 공용 manager 경계에서 즉시 영속화한다.
        settingsManager.update({ game: { skipUltimatePresentation: !settingsManager.get().game.skipUltimatePresentation } });
        refreshPresentationChip(); this.refreshDebug();
      },
    });
    // 전장 아래쪽에 서므로 SD·체력 바보다 앞에 둔다.
    for (const chip of [this.speedChip, this.autoChip, this.presentationChip]) chip.setDepth(BATTLE_CONTROLS.depth);
    // 복원된 값도 첫 클릭 전부터 켜짐 색으로 읽히게 한다.
    this.speedChip.setActive(this.battleSpeed > 1);
    this.autoChip.setActive(this.autoUltimate);
    refreshPresentationChip();
  }

  /** 여섯을 각자의 시작 자리에 세운다. 전부 준비된 뒤에야 시간이 흐르기 시작한다. */
  private async spawnFighters(): Promise<void> {
    ensureGlowTexture(this);
    for (const fighter of this.state.fighters) {
      // 표시 배율은 코어 입력에 들어 있으며 씬은 모든 Puppet 부속 표현에 같은 높이만 적용한다.
      const unitHeight = UNIT_HEIGHT * fighter.bodyScale;
      const asset = battleAssetFor(fighter.def.id);
      // 번호별 전용 적 SD도 원화 색을 보존하므로 더 이상 임시 허스크 tint를 입히지 않는다.
      const tint = 0xffffff;
      const creature = await spawnPuppet(this, asset, {
        x: fighter.x,
        groundY: fighter.y,
        height: unitHeight,
        flipX: fighter.facing < 0,
        tint,
      });
      if (!this.scene.isActive()) {
        creature.destroy();
        return;
      }
      // Puppet Mesh의 기본 입력 경계는 비동기 생성 시점의 로컬 크기에 묶여 이동·배율 적용 뒤
      // 실제 SD와 어긋날 수 있다. 투명 몸통 영역을 따로 두고 매 프레임 발 위치를 따라가게 한다.
      const infoHit = fighter.side === "enemy"
        ? this.add.rectangle(fighter.x, fighter.y - unitHeight / 2, 190 * fighter.bodyScale, unitHeight + 70, 0xffffff, 0)
          .setInteractive({ useHandCursor: true })
          .on("pointerup", () => this.info.showEnemy(fighter.def, { live: fighter }))
        : undefined;
      // 폭주 발광. 스킬 아이콘과 같은 속성·직군 색을 어둡게 눌러 쓴다. 한두 겹으로는 테두리가
      // 또렷한 비눗방울처럼 보이므로, 크기를 줄여 가며 여러 겹을 포개 가장자리를 흐린다.
      const feverTint = skillArtTint(fighter.def.element, fighter.def.role);
      const glowImage = (scale: number, alpha: number): Phaser.GameObjects.Image => this.add
        .image(fighter.x, fighter.y, FEVER_GLOW_TEXTURE)
        .setDisplaySize(unitHeight * scale, unitHeight * scale * 0.92)
        .setTint(darken(feverTint, 0.35))
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
      const feverGlow = glowImage(FEVER.outer, FEVER.outerAlpha);
      const feverCore = glowImage(FEVER.core, FEVER.coreAlpha);
      const shadow = this.add.ellipse(fighter.x, fighter.y + 4, 132, 24, 0x000000, 0.38);
      const barColor = fighter.side === "player" ? COLOR.hpFill : COLOR.hpEnemy;
      const hpBar = new UnitHealthBar(this, barColor).snap(1);
      const bleedBadge = this.makeBleedBadge();
      const stunBadge = this.makeStunBadge();
      this.views.set(fighter.id, { creature, asset, fighter, infoHit, shadow, hpBar, bleedBadge, stunBadge, stunShown: false, feverGlow, feverCore, feverTint, feverTinted: false, tint, dead: false });
    }
    this.syncViews();
    // 마지막 한 명까지 서고 나서 시간을 흘려야 먼저 뜬 캐릭터만 앞서 달려가지 않는다.
    this.lastStepAt = performance.now();
    this.spawned = true;
  }

  /**
   * 하단 프로필.
   *
   * 카드가 곧 궁극기 버튼이다. 게이지가 차면 카드가 커지며 뒤에서 빛이 맥동하고, 누르면
   * 그 자리에서 궁극기가 나간다. 게이지가 모자라면 눌러도 아무 일도 일어나지 않는다.
   */
  private buildProfiles(): void {
    // 판때기를 깔지 않는다. 전장이 아래까지 이어져 보이도록 검정으로 빠지는 유리면만 둔다.
    drawGlassFade(this, BASE_WIDTH / 2, (PROFILE_TOP + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - PROFILE_TOP, {
      topAlpha: 0,
      bottomAlpha: 0.9,
    });
    drawHairline(this, BASE_WIDTH / 2, PROFILE_TOP + 20, BASE_WIDTH, { color: COLOR.accent, alpha: 0.2 });
    this.playerFighters().forEach((fighter, index) => {
      const x = 190 + index * 350;
      // 세 화면은 같은 프리팹을 쓰며 전투 씬은 실시간 입력만 연결한다.
      const prefab = new BattleProfile(this, x, 1620, {
        relic: fighter.def, level: relicProgression.getProgress(fighter.def.id).level, stars: fighter.breakthrough + 1,
        currentHp: fighter.hp, maxHp: fighter.maxHp, ferocity: fighter.ferocity,
        active: false, readOnly: false, sub: fighter.def.ultimate.name,
      });
      const { card, glow, sweep, charge, hpLabel, hpBar, ferocityLabel, ferocityBar } = prefab;
      // 궁극기 게이지는 카드 위에 덮인 어둠이다. 시계 방향으로 걷히다가 다 차면 사라져
      // 그림이 온전히 밝아진다 — 준비됐는지를 바가 아니라 얼굴이 말한다.
      //
      // 가림막은 카드의 **그려진 픽셀**에만 얹는다(BitmapMask). 실루엣 도형으로 자르면 칩
      // 위로 머리가 빠져나오는 윗부분처럼 그림이 없는 투명한 자리까지 검게 칠해져, 카드
      // 밖에 검은 부채꼴이 떠 있는 것처럼 보인다.
      card.hit.on("pointerdown", () => {
        // 기존 입력 규칙대로 누른 순간만 추가 확대하고, 잠금 카드는 반응하지 않는다.
        if (!this.ultimateSequenceActive && canFireUltimate(this.state, fighter)) card.setScale(1.14);
      });
      card.hit.on("pointerout", () => card.setScale(profileScale(canFireUltimate(this.state, fighter))));
      card.hit.on("pointerup", () => this.useUltimate(fighter));
      // 두 게이지는 굵기만 다르고 모양이 같다. 위가 체력, 아래가 폭주다.
      // 수치는 제 게이지와 같은 색으로, 굵게, 아래로 한 겹 복제한 그림자를 달고 선다.
      // 밝은 배경 원화 위에서 흐린 회색 글자는 게이지 옆에 있어도 읽히지 않는다.
      this.profiles.push({ fighter, prefab, card, glow, sweep, charge, hpBar, hpLabel, ferocityBar, ferocityLabel, hpShown: fighter.hp, ferocityShown: fighter.ferocity, ready: false });
    });
  }

  /** 카드를 눌렀을 때. 조건이 맞지 않으면 코어가 아무것도 바꾸지 않는다. */
  private useUltimate(fighter: Fighter): void {
    // 수동 입력은 연출 중 큐에 넣지 않는다. 연타가 다음 궁극기로 예약되는 오해를 막는다.
    if (this.finished || !this.spawned || this.ultimateSequenceActive || !canFireUltimate(this.state, fighter)) return;
    if (enqueueUltimate(this.ultimateSequence, fighter.id)) void this.pumpUltimateQueue();
  }

  /**
   * Phaser tween을 await 가능한 한 단계로 바꿔 궁극기 순서를 읽는 차례 그대로 유지한다.
   *
   * 끝났을 때뿐 아니라 **끊겼을 때도** 푼다. 전투 종료·씬 종료가 트윈을 죽이면 완료 콜백이
   * 영영 오지 않는데, 그 자리에서 await가 멈추면 뒤따르는 잠금 해제까지 함께 묶인다.
   */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve(), onStop: () => resolve() });
    });
  }

  /** 입력 잠금부터 정상 복구까지 한 곳에서 소유하는 유일한 궁극기 비동기 시퀀스다. */
  private async pumpUltimateQueue(): Promise<void> {
    const next = beginNextUltimate(this.ultimateSequence);
    if (!next) return;
    this.ultimateSequenceActive = true;
    this.currentUltimateFighterId = next.fighterId;
    this.refreshProfiles();
    this.refreshDebug();
    const fighter = this.state.fighters.find((item) => item.id === next.fighterId);
    try {
      // 연출 동안 코어 시간은 update에서 완전히 멈춘다. 발돋움·공격 Puppet은 씬의 정상 속도다.
      if (!fighter || !this.sequenceValid(next.token, fighter)) return;
      const view = this.views.get(fighter.id);
      if (!view) return;
      // 씬은 ID별 값을 판단하지 않고 정적 프리셋(또는 공용 기본값)만 소비한다.
      const presentation = ultimatePresentationFor(fighter.def.id);
      // 전신 컷인 한 장으로 "누가 무엇을 쓰는가"를 알린다. 다만 포효를 기다리지 않고 컷인이
      // 빠지는 즉시 친다 — 전투 중 여러 번 반복되는 연출이라 길이가 곧 기다림이다.
      const base = view.creature.scaleX;
      const skipPresentation = settingsManager.get().game.skipUltimatePresentation;
      // 컷인·확대·공격·복귀가 이 한 계산값을 공유한다. 전투 배속과 스킵을 단계마다 다시
      // 해석하면 서로 다른 시간축이 생기므로 pump 진입 시 한 번만 고정한다.
      const timing = ultimatePresentationTiming(this.battleSpeed, skipPresentation);
      if (!skipPresentation) {
        // 전투 카드 잠금과 별개로 기여도 판은 컷인이 실제로 덮는 동안에만 입력을 멈춘다.
        this.contributionPanel?.setInputLocked(true);
        this.activeCutIn = await UltimateCutIn.create(this, fighter.def, presentation);
        if (!this.sequenceValid(next.token, fighter)) return;
        await this.activeCutIn.play(timing);
        this.activeCutIn.destroy(); this.activeCutIn = undefined;
        this.contributionPanel?.setInputLocked(false);
        if (!this.sequenceValid(next.token, fighter)) return;
        this.cameras.main.shake(180, presentation.cameraShakeIntensity);
      }

      // 스킵도 입력 순간의 낡은 상태를 믿지 않는다. 컷인 유무와 무관하게 발사 직전 생존·게이지·종료를 재검증한다.
      if (!this.sequenceValid(next.token, fighter) || !canFireUltimate(this.state, fighter)) return;
      // 확대와 공격 모션을 동시에 시작해 확대를 기다리는 별도 턴처럼 보이지 않게 한다.
      // 스킵에서는 0ms 확대조차 만들지 않아 실제 발사만 아래에서 정확히 한 번 수행한다.
      const zoom = skipPresentation
        ? Promise.resolve()
        : this.tween({ targets: view.creature, scale: base * presentation.zoomScale, duration: scaleUltimateDuration(presentation.zoomMs, timing), ease: "Back.Out" });
      const events = fireUltimate(this.state, fighter.id, () => Math.random());
      // 공격 판정(core), 시각적 사망(scene tween), 전투 결과(finish)는 서로 다른 책임이다.
      // 사건 순서는 건드리지 않고, finish가 있는 결정타인지만 종료 대기 정책에 따로 전달한다.
      const hasDeathEvent = events.some((event) => event.kind === "death");
      const hasFinishEvent = events.some((event) => event.kind === "finish");
      const waitForPresentation = shouldWaitForUltimatePresentation(hasDeathEvent, hasFinishEvent);
      // 코어가 바꾼 HP를 즉시 게이지 목표로 전달한다. 연출을 기다리는 동안 stepMeters가
      // 매 프레임 목표를 따라가므로 적 체력이 한 번에 점프하지 않고 실제로 깎여 보인다.
      this.views.forEach((fighterView) => fighterView.hpBar.setValue(fighterView.fighter.hp / fighterView.fighter.maxHp));
      // 스킵에서도 같은 events 배열 전체를 전달한다. 전신 컷인만 빠지고 공격→피해→사망→종료 책임은 playEvent에 남는다.
      // 첫 공격 동작만 기다리되 나머지 사건(사망·종료)도 전부 연출로 옮긴다. `??=`의 오른쪽을
      // 조건부로 두면 첫 동작 이후의 사망 사건이 통째로 버려져 쓰러진 적이 계속 서 있었다.
      let attackMotion: MotionPlayback | undefined;
      events.forEach((event) => {
        // 컷인 뒤의 결정타만 빠르게 재생해 멈춘 전투가 즉시 이어지도록 한다.
        const playback = this.playEvent(event, timing.rate);
        attackMotion ??= playback;
      });
      // 죽음과 finish는 위 순회에서 이미 원래 순서대로 즉시 전달됐다. 결정타의 760ms 사망 트윈은
      // 배경에서 계속 돌되 공격 완료나 SD 확대 복귀가 결과 UI/다음 장면을 붙잡지 않는다.
      if (!waitForPresentation) return;
      await Promise.all([zoom, attackMotion?.completed ?? Promise.resolve()]);
      // 커진 몸은 제자리로 돌려놓고 바로 전투를 잇는다.
      if (!skipPresentation) await this.tween({
        targets: view.creature, scale: base,
        // 복귀는 타격을 설명하지 않으므로 확대보다 짧은 별도 비율로 완료 잠금을 빨리 푼다.
        duration: scaleUltimateDuration(presentation.zoomMs, timing, ULTIMATE_RECOVERY_RATIO), ease: "Quad.Out",
      });
      this.syncViews();
      this.refreshDebug();
    } finally {
      this.activeCutIn?.destroy();
      this.activeCutIn = undefined;
      // 중간에 멈춘 발돋움 트윈은 여기서 끊는다. 남겨 두면 다음 프레임의 배치와 서로 다투다
      // SD가 커진 채로 떨린다. 제 크기 복구는 syncViews가 맡는다.
      const view = this.views.get(next.fighterId);
      if (view) this.tweens.killTweensOf(view.creature);
      // 토큰 일치 때만 정상 속도/입력을 복구해 종료 후의 오래된 Promise가 새 연출을 풀지 못하게 한다.
      if (releaseUltimate(this.ultimateSequence, next.token)) {
        this.ultimateSequenceActive = false;
        // 컷인이 중단된 경로도 기존 펼침 상태를 건드리지 않고 입력만 확실히 복원한다.
        this.contributionPanel?.setInputLocked(false);
        this.currentUltimateFighterId = null;
        this.lastStepAt = performance.now();
        this.refreshProfiles();
        this.refreshDebug();
        if (!this.finished) void this.pumpUltimateQueue();
      }
    }
  }

  private sequenceValid(token: number, fighter: Fighter): boolean {
    return this.scene.isActive() && !this.finished && this.state.phase === "fight"
      && this.ultimateSequence.activeToken === token && isFighterAlive(fighter);
  }

  /** 편성 순서 그대로의 아군 셋. 쓰러진 뒤에도 프로필 자리는 지킨다. */
  private playerFighters(): Fighter[] {
    return this.state.fighters.filter((fighter) => fighter.side === "player");
  }

  /**
   * 매 프레임 시뮬레이션을 굴리고 그 결과만 화면에 옮긴다.
   *
   * 프레임 간격이 아니라 실제 시계로 시간을 흘린다. Phaser가 넘겨주는 delta는 평활화를 거쳐
   * 느린 기기에서 실제보다 짧게 들어오기 때문에, 그대로 쓰면 전투가 기기마다 다른 속도로
   * 흐른다. 갑자기 벌어진 공백은 코어가 상한을 두고 잘라 낸다.
   */
  update(): void {
    if (!this.spawned || this.finished) return;
    const now = performance.now();
    const elapsed = now - this.lastStepAt;
    const dt = elapsed / 1000;
    this.lastStepAt = now;
    // 게이지는 연출 중에도 계속 따라붙는다. 여기서 멈추면 연출이 끝나는 순간 값이 점프한다.
    this.stepMeters(elapsed);
    this.refreshContribution(false, now);
    // 코어 시간과 전투 배속을 궁극기 연출과 분리한다. 연출 Puppet/tween은 씬의 정상 시계로 돈다.
    if (this.ultimateSequenceActive) return;
    // battleSpeed는 코어 시간에 여기서 정확히 한 번만 곱한다. 궁극기 연출 배율은 tween/Puppet에만
    // 쓰고 stepSkirmish에 넣지 않으므로 피해량·공격 주기·게이지 충전이 이중 가속되지 않는다.
    const events = stepSkirmish(this.state, dt * this.battleSpeed, () => Math.random());
    if (this.state.boss) {
      const boss = this.state.boss; const phase = boss.phases[boss.phaseIndex];
      this.bossScoreLabel?.setText(`관측 피해 ${boss.score.toLocaleString()}`);
      this.bossPhaseLabel?.setText(`${phase.label}${boss.tideWarning ? " · 해일 예고" : boss.limitReached ? " · LIMIT" : ""} · ${String(Math.floor(boss.survivedFor / 60)).padStart(2, "0")}:${String(Math.floor(boss.survivedFor) % 60).padStart(2, "0")}`);
      const centerX = (this.state.arena.left + this.state.arena.right) / 2;
      const centerY = (this.state.arena.top + this.state.arena.bottom) / 2;
      this.bossWarningLine?.clear().lineStyle(boss.tideWarning ? 6 : 3, boss.tideWarning ? 0xff8a63 : 0x59d9ff, boss.tideWarning ? 0.9 : 0.42)
        .strokeCircle(centerX, centerY, boss.pressureRadius);
    }
    // 상태 종료와 좌표를 먼저 Puppet에 동기화한 뒤 공격 사건을 재생해야, 기절이 풀린 같은 스텝의
    // 공격 모션을 뒤늦은 idle 전환이 덮어쓰지 않는다.
    this.syncViews();
    events.forEach((event) => this.playEvent(event));
    if (this.autoUltimate && !this.finished) this.fireReadyUltimates();
    this.refreshProfiles();
    this.refreshDebug();
  }

  /** 제한 주기 또는 카테고리 입력 때만 코어의 불변 표시 스냅샷을 프리팹에 전달한다. */
  private refreshContribution(force = false, now = performance.now()): void {
    if (!this.contributionPanel || (!force && now < this.contributionRefreshAt)) return;
    this.contributionRefreshAt = now + 350;
    this.contributionPanel.update({ category: this.contributionCategory, rows: battleContributionSnapshot(this.state, this.contributionCategory) });
  }

  /** 자동 모드에서는 살아 있고 준비된 아군을 편성 순서대로 한 번씩 발동한다. */
  private fireReadyUltimates(): void {
    if (this.ultimateSequenceActive) return;
    for (const fighter of this.playerFighters()) {
      if (!canFireUltimate(this.state, fighter)) continue;
      enqueueUltimate(this.ultimateSequence, fighter.id);
    }
    void this.pumpUltimateQueue();
  }

  /** 공격·회복·사망·종료를 각각 구분되는 연출로 옮긴다. */
  private playEvent(event: SkirmishEvent, motionSpeedMultiplier = 1): MotionPlayback | undefined {
    if (event.kind === "finish") {
      this.finishBattle(event.phase);
      return undefined;
    }
    if (event.kind === "death") {
      this.playDeath(event.fighterId);
      return undefined;
    }
    if (event.kind === "bleed") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      if (event.started) {
        // 상처가 열리는 순간에만 한 번 붉게 번쩍인다. 이후 초당 피해는 숫자로만 뜬다.
        flashHit(this, view.creature, this.bodyTint(view));
        return undefined;
      }
      this.popDamage(view.fighter, event.amount, false, false);
      return undefined;
    }
    if (event.kind === "heal") {
      const view = this.views.get(event.fighterId);
      // 회복은 HP와 같은 연두색 및 + 접두어로 피해 숫자와 즉시 구분한다.
      if (view) this.popDamage(view.fighter, event.amount, false, false, true);
      return undefined;
    }
    if (event.kind === "status") {
      // 시작 사건은 향후 전용 연출의 훅으로만 소비한다. 활성/종료 표시는 매 프레임 Fighter의
      // stunnedFor를 읽어 동기화하므로, 종료 사건이 누락되어 UI가 남는 구조를 만들지 않는다.
      return undefined;
    }
    if (event.kind === "shieldGranted" || event.kind === "shieldAbsorbed" || event.kind === "shieldDepleted") {
      // 보호막 사건은 현재 HUD가 Fighter.shield 잔량을 읽어 갱신하며, 별도 피해 모션을 재생하지 않는다.
      return undefined;
    }
    if (event.kind === "damageIgnored") {
      // 무효 공격은 별도 사건으로 소비해 0 숫자와 피격 모션을 반복하지 않는다. 향후 작은 BLOCK 표식의 훅이다.
      return undefined;
    }

    const attacker = this.views.get(event.attackerId);
    const target = this.views.get(event.targetId);
    if (this.state.boss && attacker?.fighter.side === "player" && target?.fighter.side === "enemy" && event.animate !== false) {
      // 서버가 성장 스냅샷으로 재현할 수 있도록 ID·종류·코어 시각만 남기고 event.amount는 버린다.
      // 추가 사건은 원본 행동에 접는다. transfer는 animate=false라 정상적으로 별도 기록되지 않지만 타입 경계도 명시한다.
      const replayKind = event.skill === "staccato" ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
      this.bossActions.push({ elapsedMs: Math.round(this.state.elapsed * 1_000), actorId: attacker.fighter.def.id, kind: replayKind });
    }
    // 한 광역 기술의 후속 피해 사건은 피격 표현만 만들고 시전자 모션은 첫 사건에서 한 번만 튼다.
    const playback = attacker && event.animate !== false ? playMotion(this, attacker.creature, "attack", motionSpeedMultiplier) : undefined;
    if (target && event.amount > 0) {
      // 붉은 섬광이 피격을 알리고, 동작은 공격을 끊지 않는 선에서 얕게만 얹힌다.
      flashHit(this, target.creature, this.bodyTint(target));
      // 기절 유지 자세는 일반 피격보다 우선한다. 섬광과 피해 숫자는 그대로 보여 타격감은 보존한다.
      if (target.fighter.stunnedFor <= 0) playMotion(this, target.creature, "hit");
      this.popDamage(target.fighter, event.amount, event.skill === "ultimate", event.critical);
    }
    return playback;
  }

  /**
   * 맞은 자리에서 피해량이 떠올랐다 사라진다.
   *
   * 아군이 받은 피해는 붉게, 적에게 준 피해는 흰색, 궁극기는 황동색이다. 배경과 SD 위에서도
   * 읽히도록 어두운 외곽선을 두르고, 뜨는 순간 살짝 커졌다 제 크기로 돌아온다.
   */
  private popDamage(fighter: Fighter, amount: number, ultimate: boolean, critical: boolean, healing = false): void {
    const color = healing ? COLOR.hpText : ultimate ? COLOR.accentText : fighter.side === "player" ? COLOR.dangerText : COLOR.ink;
    const big = critical || ultimate;
    const label = this.add
      // 소수 HP가 생겨도 전투 숫자는 읽기 쉬운 정수로 표시하되 사건 자체의 실제 회복량은 보존한다.
      // 상태의 실제 소유자는 src/core/skirmish.ts다. 씬은 확정된 사건의 수치와 종류만 그린다.
      .text(fighter.x + Phaser.Math.Between(-26, 26), fighter.y - UNIT_HEIGHT * BATTLE_STATUS_LAYOUT.popupBodyOffsetRatio, `${healing ? "+" : ""}${Math.round(amount)}`, textStyle({ role: "display", size: big ? 40 : 30, color }))
      .setOrigin(0.5)
      .setDepth(DEPTH.damage)
      .setStroke("#14171a", 7)
      .setScale(0.6);
    // 상태의 실제 소유자는 src/core/skirmish.ts다. 이 개수는 표시 중인 회복 숫자만 센다.
    if (healing) this.healPopups += 1;
    this.tweens.add({ targets: label, scale: 1, duration: 130, ease: "Back.Out" });
    this.tweens.add({
      targets: label,
      y: label.y - BATTLE_STATUS_LAYOUT.popupRise,
      alpha: 0,
      delay: 130,
      duration: 620,
      ease: "Quad.Out",
      onComplete: () => {
        label.destroy();
        if (healing) this.healPopups = Math.max(0, this.healPopups - 1);
      },
    });
  }

  /** 쓰러진 SD는 별이 되어 화면 위로 날아가고 자리와 체력 바를 지운다. */
  private playDeath(fighterId: string): void {
    const view = this.views.get(fighterId);
    if (!view || view.dead) return;
    view.dead = true;
    view.shadow.setVisible(false);
    view.hpBar.setVisible(false);
    view.bleedBadge.setVisible(false);
    view.stunBadge.setVisible(false);
    // 사망 뒤에는 코어가 상태를 비우므로 표시 객체도 컨테이너와 자식까지 즉시 폐기한다.
    view.bleedBadge.destroy(true);
    view.stunBadge.destroy(true);
    // 쓰러진 적의 빈자리가 계속 정보창을 열지 않도록 입력도 함께 닫는다.
    view.infoHit?.disableInteractive().setVisible(false);
    const burst = this.add.star(view.creature.x, view.creature.y, 10, 24, 66, COLOR.accent, 0.9).setDepth(DEPTH.burst);
    this.tweens.add({ targets: burst, scale: 1.8, alpha: 0, angle: 90, duration: 360, onComplete: () => burst.destroy() });
    // 사망은 판정이나 결과 정산이 아닌 760ms 시각 효과다. finishBattle은 이 완료를 기다리지 않는다.
    this.tweens.add({
      targets: view.creature,
      y: view.creature.y - 320,
      angle: Phaser.Math.Between(-25, 25),
      alpha: 0,
      duration: 760,
      ease: "Back.In",
      onComplete: () => view.creature.setVisible(false),
    });
  }

  /**
   * 출혈 뱃지.
   *
   * 상태이상은 숫자가 아니라 표식으로 알린다 — 전투 중에는 읽을 틈이 없으므로 색과 모양
   * 하나로 "지금 피가 흐르는 중"만 전한다.
   */
  private makeBleedBadge(): Phaser.GameObjects.Container {
    const badge = this.add.container(0, 0).setVisible(false);
    const mark = this.add.graphics();
    mark.fillStyle(0xc2303a, 0.95);
    mark.fillPoints([
      new Phaser.Geom.Point(0, -11),
      new Phaser.Geom.Point(7, 3),
      new Phaser.Geom.Point(0, 10),
      new Phaser.Geom.Point(-7, 3),
    ], true);
    badge.add(this.add.circle(0, 0, BATTLE_STATUS_LAYOUT.badgeRadius, COLOR.void, HOLO.glass));
    badge.add(mark);
    return badge;
  }

  /**
   * 기절 뱃지. 기존 출혈 표식과 같은 26px 무테 원형 바탕을 공유하고, 홀로그램 강조색의 각진
   * 번개 두 조각으로 상태 종류만 구분한다. 전투 HUD에 새 판이나 설명 문구를 늘리지 않는다.
   */
  private makeStunBadge(): Phaser.GameObjects.Container {
    // 상태의 실제 소유자는 src/core/skirmish.ts다. 이 표식은 stunnedFor 결과만 그린다.
    const badge = this.add.container(0, 0).setVisible(false);
    const mark = this.add.graphics();
    mark.fillStyle(COLOR.accent, 0.95);
    mark.fillPoints([
      new Phaser.Geom.Point(-3, -11),
      new Phaser.Geom.Point(7, -11),
      new Phaser.Geom.Point(1, -1),
      new Phaser.Geom.Point(8, -1),
      new Phaser.Geom.Point(-6, 12),
      new Phaser.Geom.Point(-1, 3),
      new Phaser.Geom.Point(-8, 3),
    ], true);
    badge.add(this.add.circle(0, 0, BATTLE_STATUS_LAYOUT.badgeRadius, COLOR.void, HOLO.glass));
    badge.add(mark);
    return badge;
  }

  /** 좌표·방향·체력 바·앞뒤 순서를 시뮬레이션 상태에 맞춘다. */
  private syncViews(): void {
    this.views.forEach((view) => {
      if (view.dead) return;
      const { fighter } = view;
      const unitHeight = UNIT_HEIGHT * fighter.bodyScale;
      // 돌진·피격으로 밀린 거리와 뛰어오른 높이까지 코어가 계산해 둔 값을 그대로 쓴다.
      const pose = renderPose(fighter);
      placePuppet(view.creature, view.asset, {
        x: pose.x,
        groundY: pose.y,
        height: unitHeight,
        flipX: fighter.facing < 0,
      });
      // 은신은 무적 표현이 아니다. SD 본체만 반투명하게 두고 피격 숫자·광역 피해 사건은 그대로 유지한다.
      view.creature.setAlpha(fighter.stealthFor > 0 ? 0.45 : 1);
      // 폭주 중에는 한 뼘 커진다. 자리를 다시 잡은 뒤에 곱해야 매 프레임 배율이 되돌아가지 않는다.
      if (fighter.ferocityFever) view.creature.setScale(view.creature.scaleX * FEVER.scale, view.creature.scaleY * FEVER.scale);
      // 아래에 선 캐릭터가 앞에 오도록 발 높이로 앞뒤를 정한다.
      view.creature.setDepth(Math.round(fighter.y / 10) + DEPTH.unitBase);
      // 넓은 겹은 몸 뒤에, 좁은 겹은 몸 위에 얹혀 안팎이 함께 물든다. 숨 쉬듯 진하기가 오간다.
      const fever = fighter.ferocityFever;
      const depth = Math.round(fighter.y / 10) + DEPTH.unitBase;
      const breath = 0.82 + Math.sin(this.time.now / 220) * 0.18;
      view.feverGlow.setVisible(fever).setPosition(pose.x, pose.y - unitHeight * 0.42).setDepth(depth - 1);
      view.feverCore.setVisible(fever).setPosition(pose.x, pose.y - unitHeight * 0.46).setDepth(depth + 1);
      if (fever) {
        view.feverGlow.setAlpha(FEVER.outerAlpha * breath);
        view.feverCore.setAlpha(FEVER.coreAlpha * breath);
      }
      // 몸도 같은 색으로 옅게 물든다. 발광만 두르면 캐릭터는 그대로인 채 빛만 켜진 것 같다.
      // 상태가 바뀔 때만 칠한다 — 매 프레임 칠하면 피격 섬광이 그 프레임에 지워진다.
      if (fever !== view.feverTinted) {
        view.feverTinted = fever;
        tintPuppet(view.creature, this.bodyTint(view));
      }
      // SD의 발 위치보다 몸통 중앙을 누르는 편이 자연스러우므로 클릭 영역은 반 높이만큼 올린다.
      view.infoHit
        ?.setPosition(pose.x, pose.y - unitHeight / 2)
        .setDepth(Math.round(fighter.y / 10) + DEPTH.unitBase + 1);
      // 떠 있는 동안 그림자는 땅에 남되 작고 옅어진다.
      const lift = 1 - Math.min(pose.hop / 60, 0.45);
      view.shadow.setPosition(pose.shadowX, pose.shadowY + 4).setDisplaySize(132 * lift, 24 * lift).setAlpha(0.38 * lift);
      const barY = pose.y - unitHeight - 26;
      view.hpBar.setPosition(pose.x, barY).setDepth(DEPTH.hpBar).setValue(fighter.hp / fighter.maxHp);
      const stunned = fighter.stunnedFor > 0;
      // 상태의 실제 소유자는 src/core/skirmish.ts이며 Phaser 시계는 표시 여부를 결정하지 않는다.
      // 상태가 바뀐 프레임에만 유지 모션을 전환한다. 매 프레임 play하면 Puppet 재생 시각이 0으로
      // 되감겨 모션이 떨리므로, 종료도 별도 사건이 아니라 Fighter 타이머의 전환으로 감지한다.
      if (stunned !== view.stunShown) {
        view.stunShown = stunned;
        playMotion(this, view.creature, stunned ? "stun" : "idle");
      }
      // 여러 상태는 체력 바 왼쪽에서 안쪽부터 기절, 출혈 순서로 나란히 세워 서로 겹치지 않는다.
      const badgeOffsets = statusBadgeOffsets(stunned);
      view.stunBadge.setPosition(pose.x + badgeOffsets.stunX, barY).setDepth(DEPTH.hpBar + 2).setVisible(stunned);
      view.bleedBadge.setPosition(pose.x + badgeOffsets.bleedX, barY).setDepth(DEPTH.hpBar + 2).setVisible(fighter.bleed !== null);
    });
  }

  private refreshProfiles(): void {
    for (const profile of this.profiles) {
      const { fighter } = profile;
      const alive = isFighterAlive(fighter);
      // 궁극기는 숫자가 아니라 그림이 말한다. 쓸 수 있게 되기까지의 몫만큼 어둠이 걷힌다.
      const ready = canFireUltimate(this.state, fighter);
      const charge = alive ? Math.min(1, fighter.energy / fighter.def.ultimate.cost) : 0;
      this.paintCharge(profile, charge);
      // 아직이면 카드째 반투명하다. 뒤가 비쳐야 "잠깐 꺼 둔 칸"으로 읽히고, 다 차면 또렷해진다.
      profile.card.setAlpha(alive ? (charge >= 1 ? 1 : CHARGE_CARD_ALPHA) : 0.45);
      // 연출 중에는 사용자 외 모든 카드가 잠겼다는 것을 명도로 즉시 알린다.
      if (this.ultimateSequenceActive && this.currentUltimateFighterId !== fighter.id) profile.card.setAlpha(alive ? 0.32 : 0.2);
      if (ready !== profile.ready) this.setUltimateReady(profile, ready);
      // 준비 상태가 유지된 채 다른 궁극기가 시작되어도 잠긴 카드의 반복 광선은 즉시 감춘다.
      if (this.ultimateSequenceActive) profile.sweep.setAlpha(0);
    }
  }

  /** 지금 몸에 입혀야 할 색. 폭주 중에는 원래 색에 그 개체의 폭주색을 옅게 섞는다. */
  private bodyTint(view: FighterView): number {
    return view.feverTinted ? mixTint(view.tint, view.feverTint, FEVER.bodyMix) : view.tint;
  }

  /**
   * 게이지와 수치를 실제 값으로 **스르륵** 따라붙인다.
   *
   * 깎이는 순간이 보이지 않으면 얼마나 아팠는지 알 수 없다. 그래서 바도 숫자도 목표로 곧장
   * 튀지 않고 매 프레임 조금씩 다가가며, 숫자는 그 사이 굴러간다. 궁극기 연출 중에도 돌아야
   * 연출이 끝난 순간 값이 통째로 점프하지 않는다.
   */
  private stepMeters(deltaMs: number): void {
    for (const view of this.views.values()) if (!view.dead) view.hpBar.step(deltaMs);
    const k = Math.min(1, (deltaMs / 1000) * METER_EASE);
    for (const profile of this.profiles) {
      const { fighter } = profile;
      const alive = isFighterAlive(fighter);
      const hp = alive ? fighter.hp : 0;
      profile.hpShown = Math.abs(profile.hpShown - hp) < 0.6 ? hp : profile.hpShown + (hp - profile.hpShown) * k;
      profile.ferocityShown = Math.abs(profile.ferocityShown - fighter.ferocity) < 0.4
        ? fighter.ferocity
        : profile.ferocityShown + (fighter.ferocity - profile.ferocityShown) * k;
      const fever = fighter.ferocityFever;
      const ferocityColor = fever ? COLOR.ferocityFever : fighter.ferocity >= 80 ? COLOR.ferocityWarning : COLOR.ferocityLow;
      // 값과 사망 표현의 최종 소유자는 공용 프리팹이며 폭주 문구만 전투가 덧씌운다.
      profile.prefab.setMeters(profile.hpShown, fighter.maxHp, profile.ferocityShown, !alive);
      profile.ferocityBar.setValue(profile.ferocityShown / FEROCITY_RULES.max, ferocityColor);
      // 피버 중에는 보상 상태와 자동 감소를 함께 알려 별도 진압 입력을 찾지 않게 한다.
      profile.ferocityLabel.setText(`${fever ? "폭주" : "야성"} ${Math.round(profile.ferocityShown)} / ${FEROCITY_RULES.max}`)
        .setColor(fever || fighter.ferocity >= 80 ? COLOR.ferocityHotText : FEROCITY_TEXT);
    }
  }

  /**
   * 카드를 덮은 어둠을 지금 충전량만큼 걷어낸다.
   *
   * 아직 차지 않은 몫을 **시계 방향의 부채꼴**로 남긴다. 12시에서 시작해 시곗바늘을 따라
   * 걷히므로, 얼마나 남았는지가 밝아진 넓이로 읽힌다. 다 차면 아무것도 덮지 않는다.
   */
  private paintCharge(profile: ProfileView, ratio: number): void {
    profile.charge.clear();
    if (ratio >= 1) return;
    profile.charge.fillStyle(0x060a10, CHARGE_VEIL_ALPHA);
    // 0일 때는 부채꼴 대신 원이다. 시작각과 끝각이 같으면 아무것도 그려지지 않는다.
    if (ratio <= 0) profile.charge.fillCircle(0, 0, CHARGE_VEIL_RADIUS);
    else {
      profile.charge.slice(0, 0, CHARGE_VEIL_RADIUS, Phaser.Math.DegToRad(-90 + ratio * 360), Phaser.Math.DegToRad(270), false);
      profile.charge.fillPath();
    }
  }

  /** 준비 상태가 바뀔 때만 연출을 갈아 끼운다. 매 프레임 트윈을 다시 만들지 않는다. */
  private setUltimateReady(profile: ProfileView, ready: boolean): void {
    profile.ready = ready;
    profile.pulse?.remove();
    profile.sweepTween?.remove();
    profile.pulse = undefined;
    profile.sweepTween = undefined;
    profile.sweep.setAlpha(0);
    // 황동 테두리는 카드 프리팹의 선택 상태를 그대로 쓴다.
    profile.card.setSelected(ready);
    if (!ready) {
      profile.card.setScale(1);
      profile.card.syncMask();
      profile.glow.setAlpha(0);
      return;
    }
    profile.card.setScale(1.08);
    profile.card.syncMask();
    profile.pulse = this.tweens.add({
      targets: profile.glow,
      alpha: { from: 0.16, to: 0.52 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
    // 게이지 완료 플래시는 한 번, 사선 스윕은 입력 가능 동안 낮은 빈도로 반복한다.
    this.tweens.add({ targets: profile.charge, alpha: { from: 0.2, to: 1 }, duration: 110, yoyo: true, repeat: 1 });
    profile.sweepTween = this.tweens.add({
      targets: profile.sweep, x: profile.sweep.x + 250, alpha: { from: 0, to: 0.42 },
      duration: 520, hold: 80, repeat: -1, repeatDelay: 900, yoyo: true,
    });
  }

  private refreshDebug(): void {
    setDebugBattle({
      phase: this.state.phase,
      elapsed: Math.round(this.state.elapsed * 10) / 10,
      playerOrder: aliveFighters(this.state, "player").map((fighter) => fighter.def.name),
      ultimateReady: this.playerFighters().filter((fighter) => canFireUltimate(this.state, fighter)).map((fighter) => fighter.def.name),
      playerHp: teamHp(this.state, "player"),
      enemyHp: teamHp(this.state, "enemy"),
      speed: this.battleSpeed,
      autoUltimate: this.autoUltimate,
      skipUltimatePresentation: settingsManager.get().game.skipUltimatePresentation,
      ultimateSequenceActive: this.ultimateSequenceActive,
      ultimateQueue: [...this.ultimateSequence.queue],
      // E2E도 사용자가 보는 이동 중 클릭 영역의 중심을 그대로 눌러 입력 회귀를 확인한다.
      enemyTargets: [...this.views.values()]
        .filter((view) => view.fighter.side === "enemy" && !view.dead)
        .map((view) => ({ x: view.infoHit?.x ?? view.fighter.x, y: view.infoHit?.y ?? view.fighter.y })),
      // 상태의 실제 소유자는 src/core/skirmish.ts다. 디버그 모델도 씬 타이머 없이 같은 값만 읽는다.
      stunned: this.state.fighters.filter((fighter) => fighter.stunnedFor > 0).map((fighter) => fighter.def.name),
      healPopups: this.healPopups,
      contributionPanel: this.contributionPanel?.state,
    });
  }

  /** 시간을 멈추고 결과 버튼만 남긴다. */
  private finishBattle(phase: "victory" | "defeat"): void {
    if (this.finished) return;
    this.finished = true;
    // 비동기 정산보다 먼저 아군 세 분류를 깊은 복사해 이후 state 사망 연출·HP 변경과 분리한다.
    const fighters = this.state.fighters.filter(({ side }) => side === "player").map((fighter, formationOrder) => ({
      id: fighter.id, formationOrder, name: fighter.def.name, portraitId: fighter.def.id,
    }));
    this.contributionResult = createBattleContributionResult(this.state.contributions, fighters, "player");
    // finish 사건만 결과 정산을 소유한다. 사망 사건은 앞서 한 번 재생됐으며 정리 과정에서 재호출하지 않는다.
    this.cancelUltimatePresentation();
    // 전투가 끝나면 궁극기 버튼도 함께 꺼진다.
    this.profiles.forEach((profile) => this.setUltimateReady(profile, false));
    this.syncViews();
    this.refreshDebug();
    const won = phase === "victory";
    if (this.battleInput.mode === "expeditionBoss") { void this.submitAndSettleBoss(this.battleInput, this.bossActions); return; }
    if (this.battleInput.mode === "expedition") { this.finishExpeditionBattle(this.battleInput, won); return; }
    const stage = getStage(session.selectedStageId ?? "1-1");
    // 결과 화면은 정적 스테이지 보상만 미리 읽고, 실제 상태 변경은 확인 버튼의 API 요청에 맡긴다.
    const firstClear = !session.cleared.has(stage.id);
    const cheesecakeEarned = won ? (firstClear ? stage.rewards.firstClearCheesecake : stage.rewards.repeatClearCheesecake) : 0;
    this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
    this.add.text(BASE_WIDTH / 2, 840, won ? "작전 성공" : "작전 실패", textStyle({ role: "display", size: 68, color: won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5).setDepth(101);
    this.add.text(BASE_WIDTH / 2, 930, won ? `획득 치즈케이크  +${cheesecakeEarned}\n${firstClear ? "최초 클리어 보상" : "반복 클리어 보상"}` : "획득 보상 없음", textStyle({ role: "body", size: 28, color: COLOR.ink, align: "center", lineSpacing: 8 })).setOrigin(0.5).setDepth(101);
    let confirming = false;
    new Button(this, BASE_WIDTH / 2, 1050, { width: 400, height: 110, label: won ? "확인 및 저장" : "지도로", fontSize: 34, onClick: () => {
      if (!won) { void gameApi.completeStage(stage.id, false).finally(() => this.scene.start("stageMap")); return; }
      if (confirming) return;
      confirming = true;
      // API 완료 뒤에만 이동하므로 사용자가 지도를 본 시점에는 보상과 최초 클리어가 저장되어 있다.
      void gameApi.completeStage(stage.id).then(() => this.scene.start("stageMap")).catch(() => { confirming = false; });
    } }).setDepth(101);
    // 일반 스테이지도 보스와 같은 공용 종료 팝업을 사용하며 기존 저장 버튼은 그대로 유지한다.
    new Button(this, BASE_WIDTH / 2, 1175, { width: 300, height: 76, label: "기여도", fontSize: 27, onClick: () => this.openContributionPopup() }).setDepth(101);
  }

  /** 결과 확인 탭을 직렬화하고 HP 저장, 증강 또는 정산이 끝난 뒤에만 다음 화면을 연다. */
  private finishExpeditionBattle(input: ExpeditionBattleInputDto, won: boolean): void {
    this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
    this.add.text(BASE_WIDTH / 2, 850, won ? "원정 교전 승리" : "원정대 전멸", textStyle({ role: "display", size: 62, color: won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5).setDepth(101);
    let saving = false;
    new Button(this, BASE_WIDTH / 2, 1030, { width: 440, height: 110, label: won ? "결과 저장" : "종료 정산", onClick: () => {
      if (saving) return;
      saving = true;
      // 시작부터 사망해 불참한 렐릭도 원래 ID·HP·생존 상태로 종료 DTO에 다시 합친다.
      const results = expeditionBattleResults(input, skirmishRelicResults(this.state));
      // 서버에는 HP만 제출하고 재화 필드는 계약에 존재하지 않아 임의 보상 주입을 막는다.
      void gameApi.completeExpeditionNode({ requestId: `${input.runId}:${input.nodeId}`, runId: input.runId, nodeId: input.nodeId, relicHp: results.map(({ currentHp }) => currentHp) }).then((nodeResult) => {
        if (!won) {
          // 전멸은 추가 지도 입력을 거치지 않고 같은 멱등 정산 경계로 끝낸다.
          void gameApi.settleExpeditionRun({ runId: input.runId, settlementId: `${input.runId}:defeat`, outcome: "abandoned" }).then((settlement) => {
            openRewardPopup(this, new PopupLayer(this, 2200), { title: "패배 전리품 정산", items: currencyRecordToRewardItems(settlement.granted), onConfirm: () => this.scene.start("lobby") });
          }).catch(() => { saving = false; });
          return;
        }
        // 승리 노드에서 서버가 새로 만든 전리품만 영수증에 표시하고, 확인 뒤 지도로 돌아간다.
        openRewardPopup(this, new PopupLayer(this, 2200), { title: "교전 획득 전리품", items: currencyRecordToRewardItems(nodeResult.rewards), onConfirm: () => this.scene.start("expedition") });
      }).catch(() => { saving = false; });
    } }).setDepth(101);
    // 일반 원정 결과에서도 정산 전후와 무관하게 finish 시점의 같은 스냅샷을 확인한다.
    new Button(this, BASE_WIDTH / 2, 1160, { width: 300, height: 76, label: "기여도", fontSize: 27, onClick: () => this.openContributionPopup() }).setDepth(101);
  }

  /** 종료 경로마다 큐·트윈·입력 잠금을 같은 방식으로 정리한다. */
  private cancelUltimatePresentation(): void {
    // ID를 잠금 상태보다 먼저 보관해야 아래 정리가 실제 시전자를 찾을 수 있다.
    const attacker = this.currentUltimateFighterId ? this.views.get(this.currentUltimateFighterId) : undefined;
    cancelUltimateSequence(this.ultimateSequence);
    this.ultimateSequenceActive = false;
    this.contributionPanel?.setInputLocked(false);
    this.currentUltimateFighterId = null;
    this.activeCutIn?.destroy();
    this.activeCutIn = undefined;
    // 현재 시전자의 확대와 공격만 정리한다. 모든 creature tween을 지우면 별도 책임인 적의
    // 760ms 사망 비행까지 잘려 버리므로, 사망 사건이나 결과 정산을 여기서 다시 실행하지 않는다.
    if (attacker) {
      this.tweens.killTweensOf(attacker.creature);
      cancelMotion(attacker.creature);
    }
    this.profiles.forEach((profile) => {
      profile.pulse?.remove();
      profile.sweepTween?.remove();
      profile.sweep.setAlpha(0);
    });
  }
}

/** 눌림 해제 때 준비 카드의 기본 확대를 일관되게 복구한다. */
function profileScale(ready: boolean): number { return ready ? 1.08 : 1; }
