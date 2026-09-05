import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { FEROCITY_RULES } from "../core/ferocity";
import {
  aliveFighters,
  activeCombatBuffs,
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
  type ActiveCombatBuff,
  type SkirmishEvent,
  type SkirmishState,
  skirmishRelicResults,
} from "../core/skirmish";
import { getRelic } from "../data/relics";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { getExpeditionNodeEnemies } from "../data/expeditionEnemies";
import type { PuppetCreature, PuppetAsset } from "../puppets/assets";
import { battleAssetFor, cancelMotion, flashHit, isHitFlashing, placePuppet, playMotion, spawnPuppet, tintPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { drawGlassFade, drawHairline, HoloBar } from "../ui/holo";
import { PortraitCard } from "../ui/PortraitCard";
import { UnitHealthBar } from "../ui/UnitHealthBar";
import { skillArtTint } from "../ui/skillArt";
import { COLOR, textStyle } from "../ui/theme";
import { setDebugBattle, setDebugScene } from "../debug";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { bindLongPress } from "../ui/longPressInfo";
import { type InfoManager, sceneInfoManager } from "../ui/info";
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
import { anyPopupOpen, PopupLayer } from "../ui/PopupLayer";
import { ExpeditionRankingPopup } from "../ui/ExpeditionRankingPopup";
import { battleHeaderText, createExpeditionBossSkirmishConfig, createExpeditionSkirmishConfig, expeditionBattleResults, normalizeBattleSceneInput, type BattleSceneInputDto, type ExpeditionBattleInputDto, type ExpeditionBossBattleInputDto } from "../core/expeditionBattle";
import type { ExpeditionBossAction } from "../core/expeditionBoss";
import { expeditionManager } from "../managers/ExpeditionManager";
import { settingsManager } from "../managers/SettingsManager";
import { battleUiMotionFactor } from "../core/settings";
import type { SettleExpeditionRunResponse, SubmitExpeditionBossScoreResponse } from "../api/contracts";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { BATTLE_STATUS_LAYOUT } from "../ui/battleStatusLayout";
import { UnitStatusChips } from "../ui/UnitStatusChips";
import { openUnitStatusPopup } from "../ui/UnitStatusPopup";
import { unitStatusViews } from "../ui/unitStatusModel";
import { BattleProfile } from "../ui/BattleProfile";
import { BattleContributionPanel } from "../ui/BattleContributionPanel";
import { battleContributionMvp, createBattleContributionResult, withConfirmedAttackTotal, type BattleContributionResult, type ContributionCategory } from "../core/battleContribution";
import { BattleContributionPopup } from "../ui/BattleContributionPopup";
import { StageCompletePopup, type StageCompleteFighter } from "../ui/StageCompletePopup";
import { EffectManager } from "../managers/EffectManager";
import { CombatEffectPresenter, type CombatEffectTarget } from "../managers/CombatEffectPresenter";
import { knockbackFlightPath } from "../ui/knockbackFlight";
import { ensureEffectTextures } from "../ui/effectTextures";
import { attackDamagePopupRequest, type DamageFlavor, type DebuffId } from "../ui/damageNumbers";
import { openBattleBuffListPopup, openBattleBuffPopup, type BattleBuffListItem, type BattleBuffPopupController } from "../ui/BattleBuffPopup";
import type { ActiveCombatDisplayEffect } from "../core/combatEffects";

/**
 * 여섯이 돌아다닐 수 있는 범위.
 *
 * 아군은 아래쪽 끝에서 출발해 위쪽 적진까지 달려 올라간다. 아래 프로필 판과 위 정보 글자를
 * 침범하지 않는 선에서 최대한 넓게 잡아 난전이 한 자리에 뭉치지 않게 한다.
 */
const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 쓰러진 SD가 튕겨 다니는 값.
 *
 * **곡선을 그리며 굴러가지 않는다.** 맞은 방향 그대로 따악 하고 튀어 나가 전장 벽을
 * 탱탱볼처럼 파바박 튕기다 번쩍 사라진다 — 끝을 시간이 아니라 **부딪히는 횟수**로 정하는
 * 이유는 전장 크기와 속도가 달라져도 같은 무게로 읽히게 하기 위해서다.
 */
const DEATH_FLIGHT = {
  /** 처음 튀어 나가는 속도(px/s). 곡선으로 흐르지 않을 만큼 세다. */
  speed: 2600,
  /** 벽에 부딪히는 횟수. 날려버림(3)보다 오래 튕기다 사라진다. */
  bounces: 6,
  /** 맞은 방향을 알 수 없을 때(지속 피해 등) 쓰는 기울기. 완전한 수평은 재미가 없다. */
  fallbackRise: 0.35,
  spinPerLeg: 320,
  vanishMs: 160,
  /** 살아 있는 SD보다 앞에 띄워 다른 캐릭터 뒤로 숨지 않게 한다. */
  depth: 60,
} as const;

/**
 * 맞는 순간의 눌림.
 *
 * 세게 맞은 그림은 날아가는 속도가 아니라 **맞는 한 프레임**이 만든다 — 가로로 길고 세로로
 * 꾹 눌렸다가 제 모양으로 돌아오며 튀어 나간다. 매 프레임 `placePuppet`이 배율을 다시 잡으므로
 * tween이 아니라 이 값과 시작 시각으로 계산해 그 위에 곱한다.
 */
const SQUASH = { stretch: 0.55, ms: 150 } as const;

/** 날아가는 동안 도는 빠르기(도/초). 튕길 때마다 방향이 바뀌지 않고 한쪽으로 계속 돈다. */
const KNOCKBACK_SPIN = 1_080;

/** SD 한 명의 화면 높이. 여섯이 겹치지 않도록 기존 300에서 0.7배로 줄였다. */
const UNIT_HEIGHT = 210;
const PROFILE_TOP = 1430;
/**
 * 조작 칩은 프로필 줄 바로 위 우하단에 모인다. 전장을 가리지 않고 엄지가 닿는 자리다.
 *
 * 줄 높이는 프로필의 **버프 액자 줄**이 정한다 — 세 번째 카드의 버프 칩이 1363까지 올라오므로
 * 1360에 두면 그 위에 겹쳤다. 액자 한 칸(56)만큼 더 띄운다.
 */
// 전장 아래쪽에 서므로 SD·체력 바보다 앞에 둔다. 컷인(900)보다는 뒤라 연출을 가리지 않는다.
export const BATTLE_CONTROLS = { rowY: 1288, rightX: BASE_WIDTH - 130, speedX: BASE_WIDTH - 335, stackGap: 92, depth: 320 } as const;

/** 아직 다 차지 않은 카드의 불투명도. 다 차면 1이 되어 그림이 온전히 선다. */
const CHARGE_CARD_ALPHA = 0.62;

/** 야성 수치의 글자색. 게이지의 붉은 계열과 같아 어느 수인지 색으로 먼저 읽힌다. */
const FEROCITY_TEXT = COLOR.ferocityText;

/** 게이지와 수치가 실제 값을 따라잡는 빠르기(초당 비율). */
const METER_EASE = 6;

/**
 * 폭주 연출.
 *
 * **주위에 빛을 두르지 않는다.** 발광을 겹쳐 두면 밝은 배경 원화 위에서 하얗게 떠 정작 봐야 할
 * 캐릭터가 그 속에 묻힌다. 대신 SD가 한 뼘 커지고 **일러스트 자체에 그 개체의 스킬 아이콘 색을
 * 필터처럼 입힌다.** 색은 제자리에 머물지 않고 옅은 쪽과 짙은 쪽을 오가며 울그락불그락 끓는다.
 */
const FEVER = {
  scale: 1.1,
  /** 필터가 가장 옅을 때와 짙을 때의 섞는 비율. 낮으면 원화의 색이, 높으면 폭주색이 이긴다. */
  mixLow: 0.28,
  mixHigh: 0.62,
  /** 색이 한 번 오가는 데 걸리는 시간(ms). 숨보다 조금 빠르게 끓는다. */
  pulseMs: 620,
  /**
   * 색 단계 수.
   *
   * 매 프레임 새 색을 칠하면 Puppet의 모든 조각에 tint를 다시 먹여야 해 그만큼이 그대로 프레임
   * 비용이 된다. 단계로 끊으면 한 주기에 이만큼만 칠하고도 눈에는 이어져 보인다.
   */
  pulseSteps: 10,
} as const;

/** 지금 폭주 필터가 어느 단계인지. 0이 가장 옅고 마지막이 가장 짙다. */
function feverPulseStep(now: number): number {
  const wave = 0.5 - Math.cos((now / FEVER.pulseMs) * Math.PI * 2) / 2;
  return Math.min(FEVER.pulseSteps - 1, Math.floor(wave * FEVER.pulseSteps));
}

/** 두 색을 비율대로 섞는다. 폭주 중 몸에 제 색을 옅게 얹을 때 쓴다. */
function mixTint(base: number, other: number, amount: number): number {
  const blend = (shift: number): number => Math.round(
    (((base >> shift) & 0xff) * (1 - amount)) + (((other >> shift) & 0xff) * amount),
  );
  return (blend(16) << 16) | (blend(8) << 8) | blend(0);
}

/**
 * 전장 안에서의 앞뒤 순서.
 *
 * SD는 발 높이에 따라 0~90 사이를 오간다. 체력 바와 피해 숫자는 그보다 확실히 위에 둬야
 * 아래쪽에 선 캐릭터에 가려지지 않는다 — 정확히 이 이유로 피해량이 보이지 않았다.
 */
/** 광역 범위는 배경 원화 위, SD 아래에 깔린다. 앞에 두면 범위가 캐릭터를 덮는다. */
const DEPTH = { unitBase: -60, hpBar: 200, damage: 300, burst: 320, ground: -28 } as const;

interface FighterView {
  creature: PuppetCreature;
  asset: PuppetAsset;
  fighter: Fighter;
  /** 움직이는 Puppet의 메시 입력 경계 대신 몸통을 따라가는 안정적인 전투 클릭 영역이다. */
  infoHit?: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
  /** 머리 위 체력 바. 깎일 때 스르륵 따라오는 것은 프리팹이 맡는다. */
  hpBar: UnitHealthBar;
  /** 걸린 상태를 알리는 칩 한 줄. 체력 바 **위**에 서고, 누르면 쪽지가 열린다. */
  statusChips: UnitStatusChips;
  /** 체력 바와 칩 줄을 함께 받는 입력면. 둘 중 어디를 눌러도 같은 쪽지가 열린다. */
  statusHit: Phaser.GameObjects.Rectangle;
  /** 코어 상태 전환 때만 Puppet 모션을 바꾸기 위한 마지막 기절 표시값이다. */
  stunShown: boolean;
  /** 그 개체의 속성·직군을 섞은 색. 폭주 필터와 이펙트 색이 여기서 나온다. */
  feverTint: number;
  /** 마지막으로 칠한 폭주 필터 단계. 같은 단계면 다시 칠하지 않는다. */
  feverStep: number;
  /** 피격 섬광이 끝난 뒤 되돌릴 원래 색. */
  tint: number;
  /** 지금 몸이 폭주 색으로 물들어 있는지. 상태가 바뀔 때만 다시 칠한다. */
  feverTinted: boolean;
  /** 맞는 순간의 눌림이 시작된 시각(ms). `placePuppet`이 매 프레임 배율을 다시 잡으므로 tween이 아니라 값으로 둔다. */
  squashAt: number;
  /** 눌림을 가로로 늘일 방향(때린 쪽에서 맞은 쪽). 세로로 날아가도 몸은 가로로 눌린다. */
  squashDir: number;
  /** 튕겨 날아가는 동안 도는 방향. 코어의 `knockback`이 남아 있는 동안만 돈다. */
  spinDir: number;
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
  /** 꾹 눌러 처음 열 때만 만들어지는 아군 창. 만들기 전에는 멈춤 판단에서도 없는 셈이다. */
  private allyInfoRef?: InfoManager;
  /** 버프 상세도 전투 씬의 한 PopupLayer에 쌓아 입력·닫기 순서를 통일한다. */
  private buffPopups!: PopupLayer;
  /** 전투는 팝업 중에도 계속되며, 선택 ID로 최신 버프를 찾아 시간 갱신/종료 닫기를 수행한다. */
  private openBuff?: { key: string; controller: BattleBuffPopupController };
  /**
   * 화면에 터지는 모든 것의 단일 소유자.
   *
   * 폭주·패시브·일반 공격·궁극기와 회복·보호막·사망·수치 글자가 전부 이 경계를 지난다.
   * 씬은 "무슨 일이 일어났는지"만 넘기고 파편 수·색·크기를 직접 고르지 않는다.
   */
  private effects!: EffectManager;
  /** 태그→EffectManager 변환과 유지형 은신 생명주기를 씬 조건문 밖에서 소유한다. */
  private combatEffects!: CombatEffectPresenter;
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
    // 정규화는 Phaser 비의존 코어가 맡아 생략·빈 객체도 매번 새로운 스토리 DTO로 교체한다.
    this.battleInput = normalizeBattleSceneInput(input);
  }

  create(): void {
    setDebugScene("battle");
    const stage = getBattleStage(session.selectedStageId ?? "1-1");
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
    this.allyInfoRef = undefined;
    this.finished = false;
    this.spawned = false;
    // 이전 씬의 tween 종료보다 재진입이 빠르더라도 표시 관찰값은 새 전투에서 0부터 시작한다.
    this.healPopups = 0;
    this.bossActions = [];
    // 이전 전투/환경설정에서 저장한 조작 상태를 새 판의 시작값으로 그대로 복원한다.
    const currentSettings = settingsManager.get();
    const battleSettings = currentSettings.game;
    // 전투 시작 시 하나의 설정 스냅샷을 모든 HUD와 카메라 연출에 동일하게 전달한다.
    const battleUiMotion = currentSettings.presentation.battleUiMotion;
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
    this.buffPopups = new PopupLayer(this, 2200);
    this.openBuff = undefined;
    // 파편·파문은 SD보다 앞이되 궁극기 컷인(900)보다는 뒤라 연출을 가리지 않는다.
    // 광역 범위만 배경 원화 위·SD 아래에 깔려 누가 어디 섰는지 가리지 않는다.
    this.effects = new EffectManager(this, { depth: DEPTH.burst, groundDepth: DEPTH.ground, shake: currentSettings.presentation.screenShake, battleUiMotion });
    this.combatEffects = new CombatEffectPresenter(this.effects);

    // 편성 화면에서 본 6번 전장을 그대로 이어 실제 전투의 공간으로 사용한다.
    addSceneBackground(this, this.battleInput.mode === "expedition" || this.battleInput.mode === "expeditionBoss" ? BACKGROUND.expeditionField : BACKGROUND.combat, -30);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.28).setDepth(-29);
    // 원정 헤더는 스토리 선택 상태를 전혀 읽지 않아 잘못된 모드 진입을 화면에서도 드러낸다.
    this.add.text(42, 48, battleHeaderText(this.battleInput, stage), textStyle({ role: "body", size: 30, color: COLOR.inkDim }));
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
      // 전투가 끝나면 디버그 스냅샷도 함께 비운다. 남겨 두면 씬이 바뀐 뒤에도 마지막 값이
      // 그대로 읽혀, 이미 지도로 나온 화면을 두고 "전투 중"이라고 답한다 — E2E가 그 굳은
      // 값을 몇 초씩 기다리다 엉뚱한 줄에서 실패했다.
      setDebugBattle(undefined);
      this.contributionPanel?.destroy();
      this.contributionPanel = undefined;
      this.buffPopups.closeAll();
      this.openBuff = undefined;
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
  private openContributionPopup(popups = new PopupLayer(this, 2200), onClosed?: () => void): void {
    if (this.contributionResult) new BattleContributionPopup(this, popups).open(this.contributionResult, onClosed);
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
    ensureEffectTextures(this);
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
          .on("pointerup", () => {
            // 불사 폰토스는 런타임 Fighter가 아니라 지도와 같은 유한 표시 스냅샷을 상세창에 넘긴다.
            const displayDef = this.battleInput.mode === "expeditionBoss" ? getExpeditionNodeEnemies("boss", 20)[0] : fighter.def;
            this.info.showEnemy(displayDef, { live: fighter, ...(this.battleInput.mode === "expeditionBoss" ? { level: 20 } : {}) });
          })
        : undefined;
      // 폭주 필터. 스킬 아이콘과 같은 속성·직군 색을 그대로 쓰며, 발광이 아니라 몸에 입힌다.
      const feverTint = skillArtTint(fighter.def.element, fighter.def.role);
      const shadow = this.add.ellipse(fighter.x, fighter.y + 4, 132, 24, 0x000000, 0.38);
      const barColor = fighter.side === "player" ? COLOR.hpFill : COLOR.hpEnemy;
      const hpBar = new UnitHealthBar(this, barColor, settingsManager.get().presentation.battleUiMotion).snap(1);
      const statusChips = new UnitStatusChips(this);
      // 체력 바와 칩 줄을 함께 덮는 입력면. 둘 중 어디를 눌러도 지금 걸린 상태를 펼친다 —
      // 칩은 작아 "무엇이 걸렸나"까지만 말하고, 몇 겹이 얼마나 남았는지는 눌러서 읽는다.
      const statusHit = this.add.rectangle(fighter.x, fighter.y, 120, 64, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.openStatusList(fighter.id);
        });
      this.views.set(fighter.id, { creature, asset, fighter, infoHit, shadow, hpBar, statusChips, statusHit, stunShown: false, feverTint, feverStep: -1, feverTinted: false, tint, squashAt: -Infinity, squashDir: 1, spinDir: 1, dead: false });
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
        battleUiMotion: settingsManager.get().presentation.battleUiMotion,
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
      // 짧은 탭은 궁극기, 꾹 누름은 상세다. 다른 그리드와 같은 조작이라 화면마다 다르게 익히지 않는다.
      bindLongPress(this, card.hit, {
        onTap: () => this.useUltimate(fighter),
        onLongPress: () => {
          card.setScale(profileScale(canFireUltimate(this.state, fighter)));
          this.allyInfo().showRelic(fighter.def);
        },
        depth: 1500,
      });
      // 두 게이지는 굵기만 다르고 모양이 같다. 위가 체력, 아래가 폭주다.
      // 수치는 제 게이지와 같은 색으로, 굵게, 아래로 한 겹 복제한 그림자를 달고 선다.
      // 밝은 배경 원화 위에서 흐린 회색 글자는 게이지 옆에 있어도 읽히지 않는다.
      this.profiles.push({ fighter, prefab, card, glow, sweep, charge, hpBar, hpLabel, ferocityBar, ferocityLabel, hpShown: fighter.hp, ferocityShown: fighter.ferocity, ready: false });
    });
  }

  /**
   * 아군 상세 창. `this.info`는 적 문맥이라 같은 창을 쓸 수 없다 — 유대·급여·룬이 빠진
   * 읽기 전용 창에 아군을 세우면 정보창이 좋아질 때 전투만 옛 모습으로 남는다.
   */
  private allyInfo(): InfoManager {
    this.allyInfoRef = sceneInfoManager(this, { key: "battle-ally" });
    return this.allyInfoRef;
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
        try {
          // create 자체도 Puppet 로딩을 await하므로 생성 실패와 Scene 종료까지 같은 정리 경계로 감싼다.
          this.activeCutIn = await UltimateCutIn.create(this, fighter.def, presentation);
          if (!this.sequenceValid(next.token, fighter)) return;
          await this.activeCutIn.play(timing);
        } finally {
          // destroy가 진행 중 play Promise를 먼저 풀기 때문에 어느 단계에서 실패해도 영구 대기하지 않는다.
          this.activeCutIn?.destroy();
          this.activeCutIn = undefined;
          this.contributionPanel?.setInputLocked(false);
        }
        if (!this.sequenceValid(next.token, fighter)) return;
        const presentationSettings = settingsManager.get().presentation;
        const shakeFactor = presentationSettings.screenShake ? battleUiMotionFactor(presentationSettings.battleUiMotion) : 0;
        // 끔에서는 카메라만 멈추고 뒤이어 재생되는 피해 숫자·색상·잔상 사건은 건드리지 않는다.
        if (shakeFactor > 0) this.cameras.main.shake(180, presentation.cameraShakeIntensity * shakeFactor);
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
    this.syncCombatEffects();
    // 판이 떠 있는 동안에는 코어 시간만 멈춘다. 화면 tween과 게이지 추격은 그대로 돌아
    // 판을 닫는 순간 값이 점프하지 않는다. lastStepAt은 위에서 이미 지금으로 밀어 두었으므로
    // 다시 흐를 때 멈춰 있던 만큼이 한꺼번에 들어가지 않는다.
    if (this.simulationPaused()) {
      // 멈춘 동안에도 화면과 관찰값은 지금 상태를 말해야 한다. 여기서 그냥 돌아가면 프로필과
      // `__PF_DEBUG.battle`이 **판이 열리기 직전 값으로 얼어붙어**, 판이 눈앞에 펼쳐져 있는데도
      // 밖에서는 접혀 있다고 읽힌다.
      this.refreshProfiles();
      this.refreshDebug();
      return;
    }
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

  /**
   * 팝업이나 정보창이 떠 있으면 전투 진행을 멈춘다.
   *
   * 멈추는 것은 코어 시간뿐이다 — 컷인·파티클 같은 씬 tween까지 함께 세우면 판을 여는 순간
   * 화면이 통째로 얼어 버린 것처럼 보인다.
   */
  private simulationPaused(): boolean {
    // 펼친 기여도 판도 화면을 덮고 읽는 판이라 같이 멈춘다. 읽는 동안 뒤에서 전투가 끝나 버리면
    // 판을 접었을 때 돌아갈 전장이 없다.
    return anyPopupOpen() || this.info.isOpen || (this.allyInfoRef?.isOpen ?? false)
      || (this.contributionPanel?.state.expanded ?? false);
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
      // 프로필은 화면에 남으므로 머리 위 바와 달리 즉시 0으로 닫아 사라진 잔상을 기다리지 않는다.
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(0, this.views.get(event.fighterId)?.fighter.maxHp ?? 1, "damage", Number.MAX_SAFE_INTEGER);
      this.playDeath(event.fighterId, event.sourceId);
      return undefined;
    }
    const effectTarget = "fighterId" in event ? this.combatEffectTarget(event.fighterId) : undefined;
    // 태그의 Phaser 번역은 전용 매퍼가 맡고, 순수 표시 사건은 여기서 완전히 소비한다.
    this.combatEffects.play(event, effectTarget);
    if (event.kind === "combatEffect") return undefined;
    if (event.kind === "bleed") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      if (event.started) {
        // 상처가 열리는 순간에만 한 번 붉게 번쩍인다. 이후 초당 피해는 숫자로만 뜬다.
        flashHit(this, view.creature, this.bodyTint(view));
        return undefined;
      }
      // 지속 피해도 코어 사건이다. 매 프레임 HP 차이로 추측하지 않고 실제 양과 최대 체력을 넘긴다.
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "damage", event.amount);
      // 출혈은 지속 상태가 깎는 피해라 그 상태의 색(다크체리)으로 뜬다.
      this.popNumber(view.fighter, event.amount, "debuff", { debuff: "bleed" });
      return undefined;
    }
    if (event.kind === "poison") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      // 독이 발리는 순간만 한 번 번쩍이고, 이후 매초 피해는 숫자로만 뜬다. 출혈과 같은 결이다.
      if (event.started) {
        flashHit(this, view.creature, this.bodyTint(view));
        return undefined;
      }
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "damage", event.amount);
      this.popNumber(view.fighter, event.amount, "debuff", { debuff: "poison" });
      return undefined;
    }
    if (event.kind === "poisonLiquidated") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "damage", event.amount);
      // 남은 몫을 한꺼번에 받은 한 방이라 매초 틱과 달리 피격 섬광을 함께 준다 — 같은 색
      // 숫자만 크게 뜨면 잔타가 우연히 커진 것처럼 읽힌다.
      flashHit(this, view.creature, this.bodyTint(view));
      this.popNumber(view.fighter, event.amount, "debuff", { debuff: "poison" });
      return undefined;
    }
    if (event.kind === "heal") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      // 회복 사건은 붉은 잔상을 새 체력에 정리하는 명시적 원인으로 전달한다.
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "heal");
      // 회복은 HP와 같은 연두색 및 + 접두어로 피해 숫자와 즉시 구분한다.
      this.popNumber(view.fighter, event.amount, "heal");
      // 스스로 도는 패시브 회복은 파문 없이 위로 떠오르는 몇 조각뿐이고, 궁극기 회복만
      // 제 이펙트를 갖는다 — 둘이 같은 무게로 터지면 어느 것이 큰 기술인지 읽히지 않는다.
      return undefined;
    }
    if (event.kind === "status") {
      // 시작 사건은 향후 전용 연출의 훅으로만 소비한다. 활성/종료 표시는 매 프레임 Fighter의
      // stunnedFor를 읽어 동기화하므로, 종료 사건이 누락되어 UI가 남는 구조를 만들지 않는다.
      return undefined;
    }
    if (event.kind === "shieldGranted" || event.kind === "shieldAbsorbed" || event.kind === "shieldDepleted") {
      // 잔량 자체는 HUD가 Fighter.shield를 읽어 갱신한다. 여기서는 순간의 사건만 알린다.
      const view = this.views.get(event.fighterId);
      if (!view || view.dead) return undefined;
      if (event.kind === "shieldGranted") {
        // 새로 덮인 막은 얻은 양을 에너지와 같은 푸른빛으로 알린다.
        this.popNumber(view.fighter, event.amount, "shield");
        return undefined;
      }
      // 흡수는 숫자를 띄우지 않는다 — 같은 타격의 피해 숫자와 겹쳐 두 번 읽히기 때문이다.
      // 막이 몸을 감싸듯 한 겹 파문만 지나가고, 깨지는 순간만 위험색으로 갈린다.
      return undefined;
    }
    if (event.kind === "areaImpact") {
      // 범위는 시전자의 색으로 바닥에 깔린다. 숫자가 여럿 떠도 어디까지 맞았는지 한 번에 읽힌다.
      const caster = this.views.get(event.attackerId);
      this.effects.groundArea(event.x, event.y, event.radius, { color: this.effectColor(caster), ultimate: event.ultimate });
      return undefined;
    }
    if (event.kind === "teamBuff") {
      // 순풍은 피해 사건이 아니다 — 받은 쪽에 강화 효과만 한 번 터뜨린다.
      const view = this.views.get(event.fighterId);
      if (view && !view.dead) {
        const height = UNIT_HEIGHT * view.fighter.bodyScale;
        this.effects.burst("passive", view.fighter.x, view.fighter.y - height * 0.5, { color: COLOR.accent });
      }
      return undefined;
    }
    if (event.kind === "damageIgnored") {
      // 무효 공격은 0 숫자와 피격 모션을 반복하지 않고, 흐린 표식 하나로 "안 통했다"만 알린다.
      const view = this.views.get(event.targetId);
      if (view && !view.dead) this.popNumber(view.fighter, 0, "blocked");
      return undefined;
    }

    if (event.kind === "concussion") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "damage", event.amount);
      // 헬멧이 울리는 소리라 방어를 지나친 고정 피해다 — 출혈처럼 상태의 색으로 뜬다.
      this.popNumber(view.fighter, event.amount, "debuff", { debuff: "concussion" });
      flashHit(this, view.creature, this.bodyTint(view));
      return undefined;
    }
    if (event.kind === "knockback") {
      this.playKnockback(event.fighterId);
      return undefined;
    }
    if (event.kind === "butcherBurst") {
      const view = this.views.get(event.fighterId);
      if (!view) return undefined;
      this.profiles.find((profile) => profile.fighter.id === event.fighterId)?.prefab.setHealthTarget(view.fighter.hp, view.fighter.maxHp, "damage", event.amount);
      // 세 번째 칼질이 터진 자리라 평타와 다른 무게로 읽혀야 한다 — 상태의 색을 쓴다.
      this.popNumber(view.fighter, event.amount, "debuff", { debuff: "butcher" });
      flashHit(this, view.creature, this.bodyTint(view));
      return undefined;
    }
    if (event.kind === "charge") {
      // 지나간 길에 바닥 자국을 남긴다. 광역과 같은 규칙(눌린 마름모)이라 SD보다 뒤에 깔린다.
      this.effects.groundArea((event.from.x + event.to.x) / 2, (event.from.y + event.to.y) / 2,
        Math.hypot(event.to.x - event.from.x, event.to.y - event.from.y) / 2, { ultimate: true });
      return undefined;
    }

    // 앞에 선 개체가 대신 받은 몫은 때린 사람이 없다 — 공격 사건이 아니라 **옮겨진 피해**라
    // 파편도 모션도 없고, 대신 받은 쪽에만 붉은 수치와 피격 섬광이 뜬다.
    if (event.kind === "damageShared") {
      const guardian = this.views.get(event.fighterId);
      if (guardian && event.amount > 0) {
        guardian.hpBar.setValue({ currentHp: guardian.fighter.hp, maxHp: guardian.fighter.maxHp, damage: event.amount, cause: "damage" });
        this.profiles.find((profile) => profile.fighter.id === guardian.fighter.id)
          ?.prefab.setHealthTarget(guardian.fighter.hp, guardian.fighter.maxHp, "damage", event.amount);
        flashHit(this, guardian.creature, this.bodyTint(guardian));
        this.effects.damage(
          guardian.fighter.x,
          guardian.fighter.y - UNIT_HEIGHT * guardian.fighter.bodyScale * BATTLE_STATUS_LAYOUT.popupBodyOffsetRatio,
          attackDamagePopupRequest({ amount: event.amount, damageType: "physical", skill: "basic", critical: false }, guardian.fighter),
        );
      }
      return undefined;
    }

    const attacker = this.views.get(event.attackerId);
    const target = this.views.get(event.targetId);
    if (this.state.boss && attacker?.fighter.side === "player" && target?.fighter.side === "enemy" && event.animate !== false) {
      // 서버가 성장 스냅샷으로 재현할 수 있도록 ID·종류·코어 시각만 남기고 event.amount는 버린다.
      // 추가 사건은 원본 행동에 접는다. transfer는 animate=false라 정상적으로 별도 기록되지 않지만 타입 경계도 명시한다.
      const replayKind = event.skill === "staccato" || event.skill === "shimmer" ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
      this.bossActions.push({ elapsedMs: Math.round(this.state.elapsed * 1_000), actorId: attacker.fighter.def.id, kind: replayKind });
    }
    // 한 광역 기술의 후속 피해 사건은 피격 표현만 만들고 시전자 모션은 첫 사건에서 한 번만 튼다.
    const playback = attacker && event.animate !== false ? playMotion(this, attacker.creature, "attack", motionSpeedMultiplier) : undefined;
    if (target && event.amount > 0) {
      // 코어가 HP를 반영한 뒤 도착한 사건이므로 실제 피해량을 함께 넘겨 잔상 강도를 계산한다.
      target.hpBar.setValue({
        currentHp: target.fighter.hp,
        maxHp: target.fighter.maxHp,
        damage: event.amount,
        cause: "damage",
      });
      // 아군 고정 HUD도 같은 피해 사건과 최대 체력을 받아 머리 위 바와 동일한 단계/시간을 쓴다.
      this.profiles.find((profile) => profile.fighter.id === target.fighter.id)?.prefab.setHealthTarget(target.fighter.hp, target.fighter.maxHp, "damage", event.amount);
      // 붉은 섬광이 피격을 알리고, 동작은 공격을 끊지 않는 선에서 얕게만 얹힌다.
      flashHit(this, target.creature, this.bodyTint(target));
      // 기절 유지 자세는 일반 피격보다 우선한다. 섬광과 피해 숫자는 그대로 보여 타격감은 보존한다.
      if (target.fighter.stunnedFor <= 0) playMotion(this, target.creature, "hit");
      // 물리·마법은 색을 가르지 않는다. 갈리는 것은 고정 피해뿐이고, 나머지 구분(치명타·궁극기·
      // 경감·아군 피격)은 순수 변환 경계가 사건의 성격만 보고 정한다. 기여도와 보스 점수가
      // 실수로 화면 숫자에 섞이지 않도록 공격 사건은 완성된 요청 모델로 바로 전달한다.
      const popupRequest = attackDamagePopupRequest(event, target.fighter);
      this.effects.damage(
        target.fighter.x,
        target.fighter.y - UNIT_HEIGHT * target.fighter.bodyScale * BATTLE_STATUS_LAYOUT.popupBodyOffsetRatio,
        popupRequest,
      );
      // 파편은 때린 쪽에서 맞은 쪽을 향해 부채꼴로 튄다. 사방으로 고르게 뿌리면 누가 때렸는지
      // 방향이 사라져 여섯이 뒤엉킨 난전에서 타격이 제자리에 선 폭죽처럼 보인다.
      const height = UNIT_HEIGHT * target.fighter.bodyScale;
      const direction = attacker
        ? Phaser.Math.RadToDeg(Math.atan2(target.fighter.y - attacker.fighter.y, target.fighter.x - attacker.fighter.x))
        : undefined;
      this.effects.burst(event.skill === "ultimate" ? "ultimate" : "basic", target.fighter.x, target.fighter.y - height * 0.5, {
        color: this.effectColor(attacker),
        direction,
        scale: target.fighter.bodyScale,
      });
      // 떨어져서 때리는 개체는 사이를 잇는 것이 없으면 맞은 자리에 숫자만 뜬다. 근거리는 몸이
      // 붙어 있어 파편 하나로 누가 쳤는지 읽히지만, 중·원거리는 그 길이 보여야 공격이 된다.
      // 전이처럼 실제로 휘두르지 않은 타격(`animate: false`)에는 그리지 않는다.
      const reachTier = attacker?.fighter.def.reachTier;
      if (attacker && event.animate !== false && (reachTier === "mid" || reachTier === "ranged")) {
        const attackerHeight = UNIT_HEIGHT * attacker.fighter.bodyScale;
        this.effects.reachStrike(
          { x: attacker.fighter.x, y: attacker.fighter.y - attackerHeight * 0.5 },
          { x: target.fighter.x, y: target.fighter.y - height * 0.5 },
          reachTier,
          this.effectColor(attacker),
        );
      }
    }
    return playback;
  }

  /**
   * 맞은 자리에서 수치가 떠올랐다 사라진다.
   *
   * **씬은 사건의 성격만 넘긴다.** 색·크기·머무는 시간·화면 흔들림은 전부 순수 규칙
   * (`src/ui/damageNumbers.ts`)이 정한다 — 화면에서 눈대중으로 고르면 같은 세기의 타격이
   * 화면마다 다른 무게로 읽힌다. 세기는 **대상 최대 체력 대비 비율**로 등급이 매겨지므로,
   * 성장해서 숫자가 커져도 "한 방에 얼마나 깎였나"가 그대로 글자 크기에 남는다.
   */
  private popNumber(
    fighter: Fighter,
    amount: number,
    flavor: DamageFlavor,
    extra: { critical?: boolean; ultimate?: boolean; mitigated?: boolean; debuff?: DebuffId } = {},
  ): void {
    const healing = flavor === "heal";
    // 상태의 실제 소유자는 src/core/skirmish.ts다. 이 개수는 표시 중인 회복 숫자만 센다.
    if (healing) this.healPopups += 1;
    const height = UNIT_HEIGHT * fighter.bodyScale;
    this.effects.damage(
      fighter.x,
      fighter.y - height * BATTLE_STATUS_LAYOUT.popupBodyOffsetRatio,
      // 소수 HP가 생겨도 전투 숫자는 정수로 표시하되 사건 자체의 실제 값은 코어에 그대로 남는다.
      { amount, flavor, incoming: fighter.side === "player", maxHp: fighter.maxHp, ...extra },
      { onDone: healing ? () => { this.healPopups = Math.max(0, this.healPopups - 1); } : undefined },
    );
  }

  /** 그 개체의 속성·직군을 섞은 색. 스킬 아이콘·폭주 발광과 같은 색을 이펙트도 그대로 쓴다. */
  private effectColor(view: FighterView | undefined): number {
    return view ? view.feverTint : COLOR.accent;
  }

  /**
   * 폭주한 파치에게 맞은 적이 전장을 튕겨 다닌다.
   *
   * 좌표는 코어가 소유하므로(`Fighter.knockback`) 여기서는 **그림만** 따라간다 — 씬이 좌표를
   * 직접 옮기면 리플레이와 화면이 갈린다. 그림자와 체력 바는 평소처럼 SD를 따라오므로 손대지
   * 않고, 튕기는 순간마다 조각 몇 개와 회전만 얹는다.
   */
  private playKnockback(fighterId: string): void {
    const view = this.views.get(fighterId);
    if (!view || view.dead) return;
    const flight = view.fighter.knockback;
    // 날아가는 방향이 곧 맞은 방향이다. 코어가 시전자 → 피격자로 이미 정해 두었다.
    const dir = flight && flight.vx !== 0 ? Math.sign(flight.vx) : view.fighter.facing >= 0 ? 1 : -1;
    this.startSquash(view, dir);
    view.spinDir = dir;
    const height = UNIT_HEIGHT * view.fighter.bodyScale;
    this.effects.burst("fever", view.creature.x, view.fighter.y - height * 0.5, { color: view.feverTint, scale: view.fighter.bodyScale });
  }

  /**
   * 맞는 순간 몸이 가로로 길고 세로로 꾹 눌린다.
   *
   * 세게 맞은 그림은 날아가는 속도가 아니라 이 한 프레임이 만든다. 눌림은 tween이 아니라
   * 시작 시각으로 두는데, `placePuppet`이 매 프레임 배율을 다시 잡아 tween이 곧바로 덮이기
   * 때문이다 — `syncViews`가 그 위에 곱한다.
   */
  private startSquash(view: FighterView, dir: number): void {
    view.squashAt = this.time.now;
    view.squashDir = dir === 0 ? 1 : dir;
  }

  /** 눌림이 지금 얼마나 남았는지. 1이 가장 눌린 순간이고 0이면 제 모양이다. */
  private squashRatio(view: FighterView): number {
    const elapsed = this.time.now - view.squashAt;
    if (elapsed < 0 || elapsed >= SQUASH.ms) return 0;
    // 맞는 순간이 가장 세고 곧바로 풀린다 — 천천히 풀면 눌린 채 날아가는 것처럼 보인다.
    return 1 - elapsed / SQUASH.ms;
  }

  /** 쓰러진 SD는 맞은 방향으로 따악 튀어 나가 전장을 파바박 튕기다 번쩍 사라진다. */
  private playDeath(fighterId: string, sourceId?: string): void {
    const view = this.views.get(fighterId);
    if (!view || view.dead) return;
    view.dead = true;
    this.combatEffects.remove(fighterId);
    view.shadow.setVisible(false);
    view.hpBar.setVisible(false);
    // 사망 뒤에는 코어가 상태를 비우므로 표시 객체도 컨테이너와 자식까지 즉시 폐기한다.
    view.statusChips.destroy(true);
    view.statusHit.disableInteractive().setVisible(false);
    // 쓰러진 적의 빈자리가 계속 정보창을 열지 않도록 입력도 함께 닫는다.
    view.infoHit?.disableInteractive().setVisible(false);
    // 별 하나가 커지던 자리에 같은 마름모 파편이 터진다. 화면의 다른 타격과 결이 같아야
    // "쓰러졌다"가 별도의 연출이 아니라 마지막 한 방으로 읽힌다.
    const height = UNIT_HEIGHT * view.fighter.bodyScale;
    this.effects.burst("death", view.creature.x, view.fighter.y - height * 0.5, { color: view.feverTint, scale: view.fighter.bodyScale });
    // 사망은 판정이나 결과 정산이 아닌 시각 효과다. finishBattle은 이 완료를 기다리지 않는다.
    //
    // **때린 쪽에서 맞은 쪽으로** 곧게 튀어 나간다 — 방향을 임의로 고르면 때린 쪽으로 되날아
    // 가는 그림이 나온다. 서서 치는 보통의 상황이면 좌우로 날아가 벽을 탱탱볼처럼 튕긴다.
    const launch = this.deathLaunch(view, sourceId);
    const legs = knockbackFlightPath({
      x: view.creature.x,
      y: view.creature.y,
      vx: launch.x * DEATH_FLIGHT.speed,
      vy: launch.y * DEATH_FLIGHT.speed,
      bounces: DEATH_FLIGHT.bounces,
      arena: this.state.arena,
    });
    view.creature.setDepth(DEATH_FLIGHT.depth);
    // 날아가기 전에 한 번 꾹 눌린다. 이 한 프레임이 "따악 맞았다"를 만든다.
    this.startSquash(view, launch.x >= 0 ? 1 : -1);
    const spin = launch.x >= 0 ? 1 : -1;
    this.tweens.chain({
      targets: view.creature,
      tweens: legs.map((leg) => ({
        x: leg.x,
        y: leg.y,
        angle: `+=${DEATH_FLIGHT.spinPerLeg * spin}`,
        duration: Math.max(1, leg.durationMs / this.battleSpeed),
        // 튕겨 나간 몸은 가속하지 않는다. 곡선으로 흐르면 "굴렀다"로 보인다.
        ease: "Linear",
        onComplete: () => {
          // 벽에 닿는 순간에만 조각이 튄다. 구간마다 터뜨리면 날아가는 내내 잔상이 남는다.
          if (leg.bounced) this.effects.burst("death", leg.x, leg.y, { color: view.feverTint, scale: view.fighter.bodyScale * 0.6 });
        },
      })),
      onComplete: () => {
        // 마지막은 번쩍이다. 조용히 오므라들면 여섯이 함께 쓰러질 때 언제 사라졌는지 모른다.
        this.effects.burst("death", view.creature.x, view.creature.y, { color: view.feverTint, scale: view.fighter.bodyScale * 1.4 });
        this.tweens.add({
          targets: view.creature,
          scale: 0,
          alpha: 0,
          duration: DEATH_FLIGHT.vanishMs,
          ease: "Back.In",
          onComplete: () => view.creature.setVisible(false),
        });
      },
    });
  }

  /**
   * 쓰러진 몸이 튀어 나가는 방향(단위 벡터).
   *
   * 마지막 일격을 넣은 쪽에서 맞은 쪽으로 향한다. 지속 피해처럼 가한 쪽이 없으면 바라보던
   * 반대쪽으로 살짝 위를 향해 날린다 — 완전한 수평은 벽 하나만 오가서 심심하다.
   */
  private deathLaunch(view: FighterView, sourceId?: string): { x: number; y: number } {
    const source = sourceId ? this.views.get(sourceId) : undefined;
    if (source && source !== view) {
      const dx = view.fighter.x - source.fighter.x;
      const dy = view.fighter.y - source.fighter.y;
      const gap = Math.hypot(dx, dy);
      if (gap > 1) return { x: dx / gap, y: dy / gap };
    }
    const away = view.fighter.facing >= 0 ? -1 : 1;
    const rise = -DEATH_FLIGHT.fallbackRise;
    const gap = Math.hypot(away, rise);
    return { x: away / gap, y: rise / gap };
  }

  /** 매퍼가 필요로 하는 좌표와 코어가 판정한 활성 유지 효과만 노출한다. */
  private combatEffectTarget(id: string): CombatEffectTarget | undefined {
    const view = this.views.get(id);
    if (!view) return undefined;
    const activeEffects: ActiveCombatDisplayEffect[] = [];
    // 은신 시간과 폭주/동일 표적 조건의 소유자는 모두 skirmish다. 씬은 표시 목록으로 투영만 한다.
    if (view.fighter.stealthFor > 0) activeEffects.push({ id: "stealth", tag: "stealthActive" });
    for (const buff of activeCombatBuffs(this.state, id)) {
      if (buff.skillId === "crescendoStaccato") activeEffects.push({ id: buff.id, tag: "metteStaccatoActive" });
      if (buff.skillId === "luka-passive") activeEffects.push({ id: buff.id, tag: "lukaSharedTargetHasteActive", aimTargetId: view.fighter.targetId ?? undefined });
    }
    return { id, x: view.fighter.x, y: view.fighter.y, height: UNIT_HEIGHT * view.fighter.bodyScale,
      activeEffects, effectTint: skillArtTint(view.fighter.def.element, view.fighter.def.role), alive: !view.dead && isFighterAlive(view.fighter) };
  }

  /** 유지형 효과는 모든 Fighter의 현재 상태를 매 프레임 다시 읽어 동기화한다. */
  private syncCombatEffects(): void {
    this.combatEffects.sync([...this.views.keys()].map((id) => this.combatEffectTarget(id)).filter((target): target is CombatEffectTarget => Boolean(target)));
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
      // 맞은 순간의 눌림도 같은 이유로 여기서 곱한다 — 가로로 길고 세로로 꾹 눌렸다 돌아온다.
      const squash = this.squashRatio(view);
      if (squash > 0) {
        view.creature.setScale(
          view.creature.scaleX * (1 + SQUASH.stretch * squash),
          view.creature.scaleY * (1 - SQUASH.stretch * squash),
        );
      }
      // 튕겨 날아가는 동안에는 계속 돈다. 좌표는 코어가 옮기고 회전만 화면이 얹는다.
      if (fighter.knockback) {
        view.creature.setAngle(view.creature.angle + KNOCKBACK_SPIN * view.spinDir * this.game.loop.delta / 1_000);
      } else if (view.creature.angle !== 0) {
        view.creature.setAngle(0);
      }
      // 아래에 선 캐릭터가 앞에 오도록 발 높이로 앞뒤를 정한다.
      view.creature.setDepth(Math.round(fighter.y / 10) + DEPTH.unitBase);
      // 폭주는 빛이 아니라 **필터**다. 일러스트에 그 개체의 스킬 아이콘 색을 입히고, 섞는
      // 비율이 옅은 쪽과 짙은 쪽을 오가며 울그락불그락 끓는다.
      const fever = fighter.ferocityFever;
      if (fever !== view.feverTinted) {
        view.feverTinted = fever;
        view.feverStep = -1;
        // 폭주가 풀리는 순간에만 원래 색으로 한 번 되돌린다.
        if (!fever) tintPuppet(view.creature, view.tint);
        // 폭주에 **드는 순간**만 한 겹 밀려난다. 유지되는 동안은 필터가 맡는다.
        else this.effects.burst("fever", pose.x, pose.y - unitHeight * 0.5, { color: view.feverTint, scale: fighter.bodyScale });
      }
      // 피격 섬광이 도는 동안에는 칠하지 않는다 — 덮어쓰면 맞은 티가 그 프레임에 사라진다.
      if (fever && !isHitFlashing(view.creature)) {
        // 단계가 바뀐 프레임에만 다시 칠한다. 매 프레임 칠하면 Puppet 조각 전부에 tint를
        // 다시 먹여야 해 그만큼이 그대로 프레임 비용이 된다.
        const step = feverPulseStep(this.time.now);
        if (step !== view.feverStep) {
          view.feverStep = step;
          tintPuppet(view.creature, this.bodyTint(view));
        }
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
      // 상태 칩은 체력 바 **위**에 한 줄로 선다. 옆에 늘어놓으면 상태가 둘만 걸려도 바가 밀려
      // 어디까지가 체력인지 흐려진다. 순서와 색·겹·남은 시간은 순수 모델 하나가 정한다.
      const statuses = unitStatusViews(fighter);
      view.statusChips.setPosition(pose.x, barY - BATTLE_STATUS_LAYOUT.chipRowLift)
        .setDepth(DEPTH.hpBar + 2)
        .setVisible(statuses.length > 0);
      view.statusChips.update(statuses);
      // 입력면은 바와 칩 줄을 함께 덮되, 걸린 것이 없으면 받지 않는다.
      const rowWidth = Math.max(120, statuses.length * (BATTLE_STATUS_LAYOUT.chipSize + BATTLE_STATUS_LAYOUT.chipGap));
      view.statusHit.setPosition(pose.x, barY - BATTLE_STATUS_LAYOUT.chipRowLift / 2)
        .setSize(rowWidth, BATTLE_STATUS_LAYOUT.chipRowLift + BATTLE_STATUS_LAYOUT.chipSize)
        .setDepth(DEPTH.hpBar + 3);
      if (statuses.length > 0) view.statusHit.setInteractive({ useHandCursor: true });
      else view.statusHit.disableInteractive();
    });
  }

  private refreshProfiles(): void {
    for (const profile of this.profiles) {
      const { fighter } = profile;
      const alive = isFighterAlive(fighter);
      // 궁극기는 숫자가 아니라 그림이 말한다. 쓸 수 있게 되기까지의 몫만큼 어둠이 걷힌다.
      const ready = canFireUltimate(this.state, fighter);
      const charge = alive ? Math.min(1, fighter.energy / fighter.def.ultimate.cost) : 0;
      profile.prefab.setChargeRatio(charge);
      // 아직이면 카드째 반투명하다. 뒤가 비쳐야 "잠깐 꺼 둔 칸"으로 읽히고, 다 차면 또렷해진다.
      profile.card.setAlpha(alive ? (charge >= 1 ? 1 : CHARGE_CARD_ALPHA) : 0.45);
      // 연출 중에는 사용자 외 모든 카드가 잠겼다는 것을 명도로 즉시 알린다.
      if (this.ultimateSequenceActive && this.currentUltimateFighterId !== fighter.id) profile.card.setAlpha(alive ? 0.32 : 0.2);
      if (ready !== profile.ready) this.setUltimateReady(profile, ready);
      // 준비 상태가 유지된 채 다른 궁극기가 시작되어도 잠긴 카드의 반복 광선은 즉시 감춘다.
      if (this.ultimateSequenceActive) profile.sweep.setAlpha(0);
      // 시간과 적용 조건은 코어 셀렉터가 이미 확정한다. 씬은 액자 색에 필요한 제공자 정의만 붙인다.
      const models = activeCombatBuffs(this.state, fighter.id).flatMap((buff) => {
        const source = this.state.fighters.find((candidate) => candidate.id === buff.sourceFighterId);
        return source ? [{ buff, sourceRelic: source.def, onPress: () => this.openBuffDetails(buff) }] : [];
      });
      // 집계 칩은 이 전투원의 최신 전체 목록을 씬의 기존 PopupLayer에 연다.
      profile.prefab.setBuffs(models, () => this.openBuffList(fighter.id));
    }
    this.refreshOpenBuff();
  }

  /** 누른 순간의 객체를 보관하지 않고 안정적인 런타임 ID만 선택해 다음 프레임부터 다시 조회한다. */
  private openBuffDetails(buff: ActiveCombatBuff): void {
    this.openBuff?.controller.close();
    const source = this.state.fighters.find((fighter) => fighter.id === buff.sourceFighterId);
    if (!source) return;
    const key = `${buff.id}:${buff.sourceFighterId}`;
    const controller = openBattleBuffPopup(this, this.buffPopups, buff, source.def, () => {
      if (this.openBuff?.controller === controller) this.openBuff = undefined;
    });
    this.openBuff = { key, controller };
  }

  /**
   * 머리 위 칩이나 체력 바를 누른 순간의 상태 목록을 연다.
   *
   * 누른 시점에 코어를 다시 읽는다 — 칩을 그릴 때 만든 목록을 들고 있으면 손이 닿는 사이에
   * 풀린 상태가 쪽지에 남는다.
   */
  private openStatusList(fighterId: string): void {
    const view = this.views.get(fighterId);
    if (!view || view.dead) return;
    openUnitStatusPopup(this, this.buffPopups, view.fighter.def.name, unitStatusViews(view.fighter), { x: view.statusHit.x, y: view.statusHit.y });
  }

  /** 목록을 누른 시점에 코어를 다시 조회해 이미 종료된 버프가 팝업에 남지 않게 한다. */
  private openBuffList(targetFighterId: string): void {
    const items: BattleBuffListItem[] = activeCombatBuffs(this.state, targetFighterId).flatMap((buff) => {
      const source = this.state.fighters.find((fighter) => fighter.id === buff.sourceFighterId);
      return source ? [{ buff, provider: source.def }] : [];
    });
    if (items.length > 0) openBattleBuffListPopup(this, this.buffPopups, items, (buff) => this.openBuffDetails(buff));
  }

  /** 열린 동안 전투가 계속되는 정책: 최신 남은 시간을 반영하고 효과가 끝나면 즉시 상세를 닫는다. */
  private refreshOpenBuff(): void {
    if (!this.openBuff) return;
    const latest = this.state.fighters.flatMap((fighter) => activeCombatBuffs(this.state, fighter.id))
      .find((buff) => `${buff.id}:${buff.sourceFighterId}` === this.openBuff?.key);
    if (latest) this.openBuff.controller.update(latest);
    else this.openBuff.controller.close();
  }

  /**
   * 지금 몸에 입혀야 할 색.
   *
   * 폭주 중에는 원래 색에 그 개체의 폭주색을 섞되, 섞는 비율이 현재 맥동 단계를 따라 오간다.
   */
  private bodyTint(view: FighterView): number {
    if (!view.feverTinted) return view.tint;
    const step = view.feverStep < 0 ? feverPulseStep(this.time.now) : view.feverStep;
    const wave = step / (FEVER.pulseSteps - 1);
    return mixTint(view.tint, view.feverTint, FEVER.mixLow + (FEVER.mixHigh - FEVER.mixLow) * wave);
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
    const motionFactor = battleUiMotionFactor(settingsManager.get().presentation.battleUiMotion);
    const k = motionFactor === 0 ? 1 : Math.min(1, (deltaMs / 1000) * METER_EASE * motionFactor);
    for (const profile of this.profiles) {
      const { fighter } = profile;
      profile.prefab.stepHealth(deltaMs);
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
      // 피버는 플레이어가 끄고 켜는 것이 아니라 스스로 가라앉으므로, 보상 상태와 남은 양만 알린다.
      profile.ferocityLabel.setText(`${fever ? "폭주" : "야성"} ${Math.round(profile.ferocityShown)} / ${FEROCITY_RULES.max}`)
        .setColor(fever || fighter.ferocity >= 80 ? COLOR.ferocityHotText : FEROCITY_TEXT);
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
      // 렉시아의 치우친 얼굴과 스피나의 큰 돌출 머리를 같은 프레임에서 고정할 수 있게 읽기만 노출한다.
      chargeRatios: this.playerFighters().map((fighter) => Math.min(1, fighter.energy / fighter.def.ultimate.cost)),
      playerHp: teamHp(this.state, "player"),
      enemyHp: teamHp(this.state, "enemy"),
      speed: this.battleSpeed,
      autoUltimate: this.autoUltimate,
      skipUltimatePresentation: settingsManager.get().game.skipUltimatePresentation,
      ultimateSequenceActive: this.ultimateSequenceActive,
      ultimateQueue: [...this.ultimateSequence.queue],
      // 머리 위 칩은 Canvas 안에만 있어 DOM으로 자리를 알 수 없다. 그린 그대로만 노출한다.
      statusChips: [...this.views.values()]
        .filter((view) => !view.dead)
        .map((view) => ({ fighterId: view.fighter.id, x: view.statusHit.x, y: view.statusHit.y, count: unitStatusViews(view.fighter).length }))
        .filter(({ count }) => count > 0),
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
    const stage = getBattleStage(session.selectedStageId ?? "1-1");
    if (!won) {
      this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
      this.add.text(BASE_WIDTH / 2, 840, "작전 실패", textStyle({ role: "display", size: 68, color: COLOR.dangerText })).setOrigin(0.5).setDepth(101);
      this.add.text(BASE_WIDTH / 2, 930, "획득 보상 없음", textStyle({ role: "body", size: 28, color: COLOR.ink, align: "center", lineSpacing: 8 })).setOrigin(0.5).setDepth(101);
      new Button(this, BASE_WIDTH / 2, 1050, { width: 400, height: 110, label: "지도로", fontSize: 34, onClick: () => {
        void gameApi.completeStage(stage.id, false).finally(() => this.scene.start("stageMap"));
      } }).setDepth(101);
      new Button(this, BASE_WIDTH / 2, 1175, { width: 300, height: 76, label: "기여도", fontSize: 27, onClick: () => this.openContributionPopup() }).setDepth(101);
      return;
    }
    void this.finishStageVictory(stage);
  }

  /**
   * 승리 확정과 결과 화면.
   *
   * 확인 버튼을 눌러야 저장되던 이전 계약을 버리고, 승리 즉시 서버에 확정한 뒤 이미 지급이 끝난
   * 결과만 `StageCompletePopup`(보상 팝업의 연장선)으로 보여준다 — 그래서 그 팝업은 화면 아무
   * 곳이나 눌러도 닫힌다.
   */
  private async finishStageVictory(stage: ReturnType<typeof getBattleStage>): Promise<void> {
    try {
      const result = await gameApi.completeStage(stage.id);
      if (!this.scene.isActive()) return;
      const popups = new PopupLayer(this, 2200);
      const mvpFighterId = this.contributionResult ? battleContributionMvp(this.contributionResult) : undefined;
      const fighters: StageCompleteFighter[] = this.state.fighters
        .filter(({ side }) => side === "player")
        .map((fighter) => ({ relicId: fighter.def.id, isMvp: fighter.id === mvpFighterId }));
      new StageCompletePopup(this, popups).open({
        cheesecakeEarned: result.cheesecakeEarned,
        firstClear: result.firstClear,
        fighters,
        onOpenContribution: (onClosed) => this.openContributionPopup(popups, onClosed),
        onConfirm: () => this.scene.start("stageMap"),
      });
    } catch {
      // 승리는 이미 확정됐으므로 전장으로 되돌리지 않고, 같은 저장 요청만 다시 시도하게 한다.
      this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
      this.add.text(BASE_WIDTH / 2, 900, "결과를 저장하지 못했습니다", textStyle({ role: "body", size: 30, color: COLOR.ink })).setOrigin(0.5).setDepth(101);
      new Button(this, BASE_WIDTH / 2, 1010, { width: 400, height: 100, label: "다시 시도", onClick: () => void this.finishStageVictory(stage) }).setDepth(101);
    }
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
