import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { FEROCITY_RULES } from "../core/ferocity";
import {
  aliveFighters,
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
} from "../core/skirmish";
import { getRelic } from "../data/relics";
import { getStage, getStageEnemies } from "../data/stages";
import type { PuppetCreature, PuppetAsset } from "../puppets/assets";
import { battleAssetFor, flashHit, placePuppet, playMotion, spawnPuppet, tintPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { drawGlassFade, drawHairline, HoloBar } from "../ui/holo";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { UnitHealthBar } from "../ui/UnitHealthBar";
import { skillArtTint } from "../ui/skillArt";
import { COLOR, textStyle } from "../ui/theme";
import { setDebugBattle, setDebugScene } from "../debug";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { UltimateCutIn } from "../ui/UltimateCutIn";
import { nextBattleSpeed, type BattleSpeed } from "../core/battleControls";
import { ControlChip } from "../ui/ControlChip";
import {
  beginNextUltimate, cancelUltimateSequence, createUltimateSequenceState, enqueueUltimate, releaseUltimate,
  type UltimateSequenceState,
} from "../core/ultimateSequence";
import type { MotionPlayback } from "../puppets/assets";
import { ultimatePresentationFor } from "../data/ultimatePresentations";
import { relicProgression } from "../managers/RelicProgressionManager";
import { relicStars } from "../core/relicProgression";

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
/** 프로필 게이지 둘의 공통 폭. 카드 폭과 같아야 한 칸으로 읽힌다. */
const BAR_WIDTH = 300;

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
  private state!: SkirmishState;
  private views = new Map<string, FighterView>();
  private profiles: ProfileView[] = [];
  private finished = false;
  private spawned = false;
  /** 마지막으로 시뮬레이션을 굴린 실제 시각(ms). */
  private lastStepAt = 0;
  /** 시뮬레이션 시간에만 곱하는 현재 전투 배속이다. */
  private battleSpeed: BattleSpeed = 1;
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
  /** 적 상세는 플레이어 성장 입력을 만들지 않는 전투 읽기 전용 창이다. */
  private info!: CharacterInfoManager;

  constructor() {
    super("battle");
  }

  create(): void {
    setDebugScene("battle");
    const stage = getStage(session.selectedStageId ?? "1-1");
    // 적은 스테이지별 임시 레벨 성장치를 적용한 복사본으로 전투에 투입한다.
    // 유대는 정적 RelicDef가 아니라 현재 플레이어의 저장 진행에서 전투 스냅샷으로 넘긴다.
    const bonds = Object.fromEntries(session.party.map((id) => [id, session.relicProgress[id]?.bondLevel ?? 0]));
    // 각성 단계도 같은 방식으로 스냅샷을 넘긴다. 전투 코어는 저장 상태를 직접 읽지 않는다.
    const breakthroughs = Object.fromEntries(session.party.map((id) => [id, session.relicProgress[id]?.breakthrough ?? 0]));
    // UI와 같은 성장 계산기의 스냅샷을 복사해 전투가 룬 수치를 다시 계산하지 않게 한다.
    const players = session.party.map((id) => ({ ...getRelic(id), stats: relicProgression.getFinalStats(id) }));
    this.state = createSkirmish(players, getStageEnemies(stage), ARENA, bonds, breakthroughs);
    this.views.clear();
    this.profiles = [];
    this.finished = false;
    this.spawned = false;
    this.battleSpeed = 1;
    this.autoUltimate = false;
    this.ultimateSequenceActive = false;
    this.ultimateSequence = createUltimateSequenceState();
    this.currentUltimateFighterId = null;
    // 적도 같은 정보창을 쓴다. 문맥만 "enemy"라 급여·돌파·유대·룬이 빠지고 현재 전투 줄이 붙는다.
    this.info = new CharacterInfoManager(this, 1001, "enemy");

    // 편성 화면에서 본 6번 전장을 그대로 이어 실제 전투의 공간으로 사용한다.
    addSceneBackground(this, BACKGROUND.combat, -30);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.28).setDepth(-29);
    this.add.text(42, 48, `${stage.id} · ${stage.name} · 적 LV.${stage.enemyLevel}`, textStyle({ role: "body", size: 30, color: COLOR.inkDim }));
    this.add.text(BASE_WIDTH / 2, 160, "AUTO BATTLE", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);

    this.buildBattleControls();

    this.buildProfiles();
    void this.spawnFighters();
    this.refreshDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelUltimatePresentation();
      this.views.forEach((view) => view.creature.destroy());
      this.views.clear();
    });
  }

  /** 전장 위쪽 가장자리에 배속과 자동 궁극기 토글을 같은 홀로그램 칩으로 나란히 둔다. */
  private buildBattleControls(): void {
    this.speedChip = new ControlChip(this, BASE_WIDTH - 335, 150, {
      icon: "speed",
      label: "1배속",
      onClick: () => {
        this.battleSpeed = nextBattleSpeed(this.battleSpeed);
        this.speedChip.setLabel(`${this.battleSpeed}배속`).setActive(this.battleSpeed > 1);
        this.refreshDebug();
      },
    });
    this.autoChip = new ControlChip(this, BASE_WIDTH - 130, 150, {
      icon: "auto",
      label: "궁극 OFF",
      width: 170,
      onClick: () => {
        this.autoUltimate = !this.autoUltimate;
        this.autoChip.setLabel(this.autoUltimate ? "궁극 ON" : "궁극 OFF").setActive(this.autoUltimate);
        this.refreshDebug();
      },
    });
  }

  /** 여섯을 각자의 시작 자리에 세운다. 전부 준비된 뒤에야 시간이 흐르기 시작한다. */
  private async spawnFighters(): Promise<void> {
    ensureGlowTexture(this);
    for (const fighter of this.state.fighters) {
      const asset = battleAssetFor(fighter.def.id);
      // 번호별 전용 적 SD도 원화 색을 보존하므로 더 이상 임시 허스크 tint를 입히지 않는다.
      const tint = 0xffffff;
      const creature = await spawnPuppet(this, asset, {
        x: fighter.x,
        groundY: fighter.y,
        height: UNIT_HEIGHT,
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
        ? this.add.rectangle(fighter.x, fighter.y - UNIT_HEIGHT / 2, 190, UNIT_HEIGHT + 70, 0xffffff, 0)
          .setInteractive({ useHandCursor: true })
          .on("pointerup", () => this.info.showEnemy(fighter.def, { live: fighter }))
        : undefined;
      // 폭주 발광. 스킬 아이콘과 같은 속성·직군 색을 어둡게 눌러 쓴다. 한두 겹으로는 테두리가
      // 또렷한 비눗방울처럼 보이므로, 크기를 줄여 가며 여러 겹을 포개 가장자리를 흐린다.
      const feverTint = skillArtTint(fighter.def.element, fighter.def.role);
      const glowImage = (scale: number, alpha: number): Phaser.GameObjects.Image => this.add
        .image(fighter.x, fighter.y, FEVER_GLOW_TEXTURE)
        .setDisplaySize(UNIT_HEIGHT * scale, UNIT_HEIGHT * scale * 0.92)
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
      this.views.set(fighter.id, { creature, asset, fighter, infoHit, shadow, hpBar, bleedBadge, feverGlow, feverCore, feverTint, feverTinted: false, tint, dead: false });
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
      // 카드가 불투명해서 뒤에 깐 빛은 테두리처럼만 보인다. 그만큼 넉넉히 키워 둔다.
      const glow = this.add.rectangle(x, 1620, 378, 378, COLOR.accent, 0);
      // 카드 마스크 안쪽을 가로지르는 광선. 준비되지 않았거나 잠겼을 때는 숨긴다.
      const sweep = this.add.rectangle(x - 125, 1620, 34, 320, COLOR.accent, 0).setAngle(18).setDepth(2);
      // 도감·편성과 같은 카드 규격을 써서 전투 중에도 같은 얼굴 프레임으로 알아보게 한다.
      const card = new PortraitCard(this, x, 1620, {
        width: 300,
        height: 300,
        portraitAssetId: fighter.def.portraitAssetId,
        tint: relicCardTint(fighter.def),
        label: fighter.def.name,
        sub: fighter.def.ultimate.name,
        rarity: fighter.def.rarity,
        stars: relicStars(fighter.breakthrough),
      });
      // 궁극기 게이지는 카드 위에 덮인 어둠이다. 시계 방향으로 걷히다가 다 차면 사라져
      // 그림이 온전히 밝아진다 — 준비됐는지를 바가 아니라 얼굴이 말한다.
      //
      // 가림막은 카드의 **그려진 픽셀**에만 얹는다(BitmapMask). 실루엣 도형으로 자르면 칩
      // 위로 머리가 빠져나오는 윗부분처럼 그림이 없는 투명한 자리까지 검게 칠해져, 카드
      // 밖에 검은 부채꼴이 떠 있는 것처럼 보인다.
      const charge = this.add.graphics({ x, y: 1620 }).setDepth(1);
      charge.setMask(new Phaser.Display.Masks.BitmapMask(this, card));
      card.hit.on("pointerdown", () => {
        // 기존 입력 규칙대로 누른 순간만 추가 확대하고, 잠금 카드는 반응하지 않는다.
        if (!this.ultimateSequenceActive && canFireUltimate(this.state, fighter)) card.setScale(1.14);
      });
      card.hit.on("pointerout", () => card.setScale(profileScale(canFireUltimate(this.state, fighter))));
      card.hit.on("pointerup", () => this.useUltimate(fighter));
      // 두 게이지는 굵기만 다르고 모양이 같다. 위가 체력, 아래가 폭주다.
      // 수치는 제 게이지와 같은 색으로, 굵게, 아래로 한 겹 복제한 그림자를 달고 선다.
      // 밝은 배경 원화 위에서 흐린 회색 글자는 게이지 옆에 있어도 읽히지 않는다.
      const label = (y: number, color: string) =>
        this.add.text(x - BAR_WIDTH / 2, y, "", textStyle({ role: "display", size: 26, color }))
          .setOrigin(0, 1)
          .setShadow(3, 4, "#05070a", 0, true, true);
      const hpLabel = label(1800, COLOR.hpText);
      // 하단 게이지도 머리 위 바와 같은 결이다 — 흰 테두리로 최대치를 두르고 빗금으로 칸을 나눈다.
      const hpBar = new HoloBar(this, x, 1814, BAR_WIDTH, 20, { color: COLOR.hpFill, outline: true, ticks: 3 });
      const ferocityLabel = label(1872, FEROCITY_TEXT);
      const ferocityBar = new HoloBar(this, x, 1886, BAR_WIDTH, 16, { color: COLOR.ferocityLow, outline: true, ticks: 3 });
      this.profiles.push({ fighter, card, glow, sweep, charge, hpBar, hpLabel, ferocityBar, ferocityLabel, hpShown: fighter.hp, ferocityShown: fighter.ferocity, ready: false });
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
      this.activeCutIn = await UltimateCutIn.create(this, fighter.def, presentation);
      if (!this.sequenceValid(next.token, fighter)) return;
      await this.activeCutIn.play();
      this.activeCutIn.destroy();
      this.activeCutIn = undefined;
      if (!this.sequenceValid(next.token, fighter)) return;
      const base = view.creature.scaleX;
      await this.tween({ targets: view.creature, scale: base * presentation.zoomScale, duration: presentation.zoomMs, ease: "Back.Out" });
      if (!this.sequenceValid(next.token, fighter)) return;
      this.cameras.main.shake(180, presentation.cameraShakeIntensity);

      // 입력 순간이 아니라 발돋움이 끝난 바로 이 시점의 생존/게이지/전투 결과를 코어에 재검증한다.
      if (!this.sequenceValid(next.token, fighter) || !canFireUltimate(this.state, fighter)) return;
      const events = fireUltimate(this.state, fighter.id, () => Math.random());
      // 첫 공격 동작만 기다리되 나머지 사건(사망·종료)도 전부 연출로 옮긴다. `??=`의 오른쪽을
      // 조건부로 두면 첫 동작 이후의 사망 사건이 통째로 버려져 쓰러진 적이 계속 서 있었다.
      let attackMotion: MotionPlayback | undefined;
      events.forEach((event) => {
        const playback = this.playEvent(event);
        attackMotion ??= playback;
      });
      await attackMotion?.completed;
      // 커진 몸은 제자리로 돌려놓고 바로 전투를 잇는다.
      await this.tween({ targets: view.creature, scale: base, duration: presentation.zoomMs, ease: "Quad.Out" });
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
    // 코어 시간과 전투 배속을 궁극기 연출과 분리한다. 연출 Puppet/tween은 씬의 정상 시계로 돈다.
    if (this.ultimateSequenceActive) return;
    // 실제 프레임 간격에 선택 배율을 곱해 이동·공격 간격·게이지가 모두 같은 시간축을 쓴다.
    const events = stepSkirmish(this.state, dt * this.battleSpeed, () => Math.random());
    events.forEach((event) => this.playEvent(event));
    if (this.autoUltimate && !this.finished) this.fireReadyUltimates();
    this.syncViews();
    this.refreshProfiles();
    this.refreshDebug();
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

  /** 공격·사망·종료를 각각의 연출로 옮긴다. */
  private playEvent(event: SkirmishEvent): MotionPlayback | undefined {
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

    const attacker = this.views.get(event.attackerId);
    const target = this.views.get(event.targetId);
    const playback = attacker ? playMotion(this, attacker.creature, "attack") : undefined;
    if (target) {
      // 붉은 섬광이 피격을 알리고, 동작은 공격을 끊지 않는 선에서 얕게만 얹힌다.
      flashHit(this, target.creature, this.bodyTint(target));
      playMotion(this, target.creature, "hit");
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
  private popDamage(fighter: Fighter, amount: number, ultimate: boolean, critical: boolean): void {
    const color = ultimate ? COLOR.accentText : fighter.side === "player" ? COLOR.dangerText : COLOR.ink;
    const big = critical || ultimate;
    const label = this.add
      .text(fighter.x + Phaser.Math.Between(-26, 26), fighter.y - UNIT_HEIGHT * 0.72, `${amount}`, textStyle({ role: "display", size: big ? 40 : 30, color }))
      .setOrigin(0.5)
      .setDepth(DEPTH.damage)
      .setStroke("#14171a", 7)
      .setScale(0.6);
    this.tweens.add({ targets: label, scale: 1, duration: 130, ease: "Back.Out" });
    this.tweens.add({
      targets: label,
      y: label.y - 86,
      alpha: 0,
      delay: 130,
      duration: 620,
      ease: "Quad.Out",
      onComplete: () => label.destroy(),
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
    // 쓰러진 적의 빈자리가 계속 정보창을 열지 않도록 입력도 함께 닫는다.
    view.infoHit?.disableInteractive().setVisible(false);
    const burst = this.add.star(view.creature.x, view.creature.y, 10, 24, 66, COLOR.accent, 0.9).setDepth(DEPTH.burst);
    this.tweens.add({ targets: burst, scale: 1.8, alpha: 0, angle: 90, duration: 360, onComplete: () => burst.destroy() });
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
    badge.add(this.add.circle(0, 0, 13, COLOR.void, 0.7));
    badge.add(mark);
    return badge;
  }

  /** 좌표·방향·체력 바·앞뒤 순서를 시뮬레이션 상태에 맞춘다. */
  private syncViews(): void {
    this.views.forEach((view) => {
      if (view.dead) return;
      const { fighter } = view;
      // 돌진·피격으로 밀린 거리와 뛰어오른 높이까지 코어가 계산해 둔 값을 그대로 쓴다.
      const pose = renderPose(fighter);
      placePuppet(view.creature, view.asset, {
        x: pose.x,
        groundY: pose.y,
        height: UNIT_HEIGHT,
        flipX: fighter.facing < 0,
      });
      // 폭주 중에는 한 뼘 커진다. 자리를 다시 잡은 뒤에 곱해야 매 프레임 배율이 되돌아가지 않는다.
      if (fighter.ferocityFever) view.creature.setScale(view.creature.scaleX * FEVER.scale, view.creature.scaleY * FEVER.scale);
      // 아래에 선 캐릭터가 앞에 오도록 발 높이로 앞뒤를 정한다.
      view.creature.setDepth(Math.round(fighter.y / 10) + DEPTH.unitBase);
      // 넓은 겹은 몸 뒤에, 좁은 겹은 몸 위에 얹혀 안팎이 함께 물든다. 숨 쉬듯 진하기가 오간다.
      const fever = fighter.ferocityFever;
      const depth = Math.round(fighter.y / 10) + DEPTH.unitBase;
      const breath = 0.82 + Math.sin(this.time.now / 220) * 0.18;
      view.feverGlow.setVisible(fever).setPosition(pose.x, pose.y - UNIT_HEIGHT * 0.42).setDepth(depth - 1);
      view.feverCore.setVisible(fever).setPosition(pose.x, pose.y - UNIT_HEIGHT * 0.46).setDepth(depth + 1);
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
        ?.setPosition(pose.x, pose.y - UNIT_HEIGHT / 2)
        .setDepth(Math.round(fighter.y / 10) + DEPTH.unitBase + 1);
      // 떠 있는 동안 그림자는 땅에 남되 작고 옅어진다.
      const lift = 1 - Math.min(pose.hop / 60, 0.45);
      view.shadow.setPosition(pose.shadowX, pose.shadowY + 4).setDisplaySize(132 * lift, 24 * lift).setAlpha(0.38 * lift);
      const barY = pose.y - UNIT_HEIGHT - 26;
      view.hpBar.setPosition(pose.x, barY).setDepth(DEPTH.hpBar).setValue(fighter.hp / fighter.maxHp);
      // 출혈 중인 동안만 체력 바 왼쪽에 붉은 물방울이 붙는다.
      view.bleedBadge.setPosition(pose.x - 62, barY).setDepth(DEPTH.hpBar + 2).setVisible(fighter.bleed !== null);
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
      profile.hpBar.setValue(profile.hpShown / fighter.maxHp);
      profile.hpLabel.setText(alive ? `HP ${Math.round(profile.hpShown)} / ${fighter.maxHp}` : "전투 불능");
      profile.hpLabel.setColor(alive ? COLOR.hpText : COLOR.dangerText);
      const fever = fighter.ferocityFever;
      const ferocityColor = fever ? COLOR.ferocityFever : fighter.ferocity >= 80 ? COLOR.ferocityWarning : COLOR.ferocityLow;
      profile.ferocityBar.setValue(profile.ferocityShown / FEROCITY_RULES.max, ferocityColor);
      // 피버 중에는 보상 상태와 자동 감소를 함께 알려 별도 진압 입력을 찾지 않게 한다.
      // 최대치를 함께 적는다. 야성은 100에 닿는 순간 폭주로 바뀌므로 남은 거리가 곧 예고다.
      profile.ferocityLabel.setText(`${fever ? "폭주" : "야성"} ${Math.round(profile.ferocityShown)} / ${FEROCITY_RULES.max}`);
      profile.ferocityLabel.setColor(fever || fighter.ferocity >= 80 ? COLOR.ferocityHotText : FEROCITY_TEXT);
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
      profile.glow.setAlpha(0);
      return;
    }
    profile.card.setScale(1.08);
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
      ultimateSequenceActive: this.ultimateSequenceActive,
      ultimateQueue: [...this.ultimateSequence.queue],
      // E2E도 사용자가 보는 이동 중 클릭 영역의 중심을 그대로 눌러 입력 회귀를 확인한다.
      enemyTargets: [...this.views.values()]
        .filter((view) => view.fighter.side === "enemy" && !view.dead)
        .map((view) => ({ x: view.infoHit?.x ?? view.fighter.x, y: view.infoHit?.y ?? view.fighter.y })),
    });
  }

  /** 시간을 멈추고 결과 버튼만 남긴다. */
  private finishBattle(phase: "victory" | "defeat"): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelUltimatePresentation();
    // 전투가 끝나면 궁극기 버튼도 함께 꺼진다.
    this.profiles.forEach((profile) => this.setUltimateReady(profile, false));
    this.syncViews();
    this.refreshDebug();
    const won = phase === "victory";
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
  }

  /** 종료 경로마다 큐·트윈·입력 잠금을 같은 방식으로 정리한다. */
  private cancelUltimatePresentation(): void {
    cancelUltimateSequence(this.ultimateSequence);
    this.ultimateSequenceActive = false;
    this.currentUltimateFighterId = null;
    this.activeCutIn?.destroy();
    this.activeCutIn = undefined;
    // 발돋움 도중 전투가 끝나면 커진 채로 굳는다. 다음 syncViews가 제 크기로 되돌리도록
    // 남은 트윈만 걷어 낸다.
    this.views.forEach((view) => this.tweens.killTweensOf(view.creature));
    this.profiles.forEach((profile) => {
      profile.pulse?.remove();
      profile.sweepTween?.remove();
      profile.sweep.setAlpha(0);
    });
  }
}

/** 눌림 해제 때 준비 카드의 기본 확대를 일관되게 복구한다. */
function profileScale(ready: boolean): number { return ready ? 1.08 : 1; }
