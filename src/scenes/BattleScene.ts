import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { ULTIMATE_ENERGY_MAX } from "../core/battle";
import {
  aliveFighters,
  createSkirmish,
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
import { getStage } from "../data/stages";
import type { PuppetCreature, PuppetAsset } from "../puppets/assets";
import { battleAssetFor, placePuppet, playMotion, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { COLOR, textStyle } from "../ui/theme";
import { setDebugBattle, setDebugScene } from "../debug";

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

interface FighterView {
  creature: PuppetCreature;
  asset: PuppetAsset;
  fighter: Fighter;
  shadow: Phaser.GameObjects.Ellipse;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  dead: boolean;
}

/** SD 여섯이 실시간으로 뒤엉켜 싸우는 자동 전투 화면이다. */
export class BattleScene extends Phaser.Scene {
  private state!: SkirmishState;
  private views = new Map<string, FighterView>();
  private profileGauges: Phaser.GameObjects.Text[] = [];
  private profileCards: PortraitCard[] = [];
  private finished = false;
  private spawned = false;
  /** 마지막으로 시뮬레이션을 굴린 실제 시각(ms). */
  private lastStepAt = 0;

  constructor() {
    super("battle");
  }

  create(): void {
    setDebugScene("battle");
    const stage = getStage(session.selectedStageId ?? "1-1");
    this.state = createSkirmish(session.party.map(getRelic), stage.enemies.map(getRelic), ARENA);
    this.views.clear();
    this.profileGauges = [];
    this.profileCards = [];
    this.finished = false;
    this.spawned = false;

    addSceneBackground(this, BACKGROUND.battleArea, -30);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.28).setDepth(-29);
    this.add.text(42, 48, `${stage.id} · ${stage.name}`, textStyle({ size: 30, color: COLOR.inkDim }));
    this.add.text(BASE_WIDTH / 2, 160, "AUTO BATTLE", textStyle({ size: 28, color: COLOR.accentText })).setOrigin(0.5);

    this.buildProfiles();
    void this.spawnFighters();
    this.refreshDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.views.forEach((view) => view.creature.destroy());
      this.views.clear();
    });
  }

  /** 여섯을 각자의 시작 자리에 세운다. 전부 준비된 뒤에야 시간이 흐르기 시작한다. */
  private async spawnFighters(): Promise<void> {
    for (const fighter of this.state.fighters) {
      const asset = battleAssetFor(fighter.def.id);
      const creature = await spawnPuppet(this, asset, {
        x: fighter.x,
        groundY: fighter.y,
        height: UNIT_HEIGHT,
        flipX: fighter.facing < 0,
        // 임시 공용 적만 색으로 구분하고 완성된 1·2번 SD는 원색을 보존한다.
        tint: fighter.def.id.startsWith("husk-") ? tintFor(fighter.def.id) : undefined,
      });
      if (!this.scene.isActive()) {
        creature.destroy();
        return;
      }
      const shadow = this.add.ellipse(fighter.x, fighter.y + 4, 132, 24, 0x000000, 0.38);
      const barColor = fighter.side === "player" ? COLOR.hpFill : COLOR.hpEnemy;
      const hpBack = this.add.rectangle(fighter.x, 0, 96, 10, COLOR.void, 0.75);
      const hpFill = this.add.rectangle(fighter.x, 0, 96, 10, barColor).setOrigin(0, 0.5);
      this.views.set(fighter.id, { creature, asset, fighter, shadow, hpBack, hpFill, dead: false });
    }
    this.syncViews();
    // 마지막 한 명까지 서고 나서 시간을 흘려야 먼저 뜬 캐릭터만 앞서 달려가지 않는다.
    this.lastStepAt = performance.now();
    this.spawned = true;
  }

  /** 하단 프로필은 편성 순서의 원화를 매치하고 각성 스킬과 게이지를 함께 보여 준다. */
  private buildProfiles(): void {
    this.add.rectangle(BASE_WIDTH / 2, (PROFILE_TOP + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - PROFILE_TOP, COLOR.panel, 0.96)
      .setStrokeStyle(2, COLOR.panelEdge);
    this.playerFighters().forEach((fighter, index) => {
      const x = 190 + index * 350;
      // 도감·편성과 같은 카드 규격을 써서 전투 중에도 같은 얼굴 프레임으로 알아보게 한다.
      const card = new PortraitCard(this, x, 1620, {
        width: 300,
        height: 300,
        portraitAssetId: fighter.def.portraitAssetId,
        tint: relicCardTint(fighter.def),
        label: fighter.def.name,
        sub: `각성 · ${fighter.def.ultimate.name}`,
      });
      card.hit.disableInteractive();
      this.profileCards.push(card);
      this.profileGauges.push(this.add.text(x, 1800, "", textStyle({ size: 22, color: COLOR.inkDim })).setOrigin(0.5, 0));
    });
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
    const dt = (now - this.lastStepAt) / 1000;
    this.lastStepAt = now;
    const events = stepSkirmish(this.state, dt, () => Math.random());
    events.forEach((event) => this.playEvent(event));
    this.syncViews();
    this.refreshProfiles();
    this.refreshDebug();
  }

  /** 공격·사망·종료를 각각의 연출로 옮긴다. */
  private playEvent(event: SkirmishEvent): void {
    if (event.kind === "finish") {
      this.finishBattle(event.phase);
      return;
    }
    if (event.kind === "death") {
      this.playDeath(event.fighterId);
      return;
    }

    const attacker = this.views.get(event.attackerId);
    const target = this.views.get(event.targetId);
    if (attacker) playMotion(this, attacker.creature, "attack");
    if (target) {
      playMotion(this, target.creature, "hit");
      this.popDamage(target.fighter, event.amount, event.skill === "ultimate", event.critical);
    }
  }

  /** 맞은 자리에서 피해량이 떠오른다. 실시간으로 몇 대를 주고받는지 눈으로 세게 한다. */
  private popDamage(fighter: Fighter, amount: number, ultimate: boolean, critical: boolean): void {
    const color = ultimate ? COLOR.accentText : fighter.side === "player" ? COLOR.dangerText : COLOR.ink;
    const label = this.add
      .text(fighter.x + Phaser.Math.Between(-26, 26), fighter.y - UNIT_HEIGHT * 0.7, `${amount}`, textStyle({ size: critical || ultimate ? 38 : 28, color }))
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: label, y: label.y - 70, alpha: 0, duration: 620, ease: "Quad.Out", onComplete: () => label.destroy() });
  }

  /** 쓰러진 SD는 별이 되어 화면 위로 날아가고 자리와 체력 바를 지운다. */
  private playDeath(fighterId: string): void {
    const view = this.views.get(fighterId);
    if (!view || view.dead) return;
    view.dead = true;
    view.shadow.setVisible(false);
    view.hpBack.setVisible(false);
    view.hpFill.setVisible(false);
    const burst = this.add.star(view.creature.x, view.creature.y, 10, 24, 66, COLOR.accent, 0.9).setDepth(30);
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
      // 아래에 선 캐릭터가 앞에 오도록 발 높이로 앞뒤를 정한다.
      view.creature.setDepth(Math.round(fighter.y / 10) - 60);
      // 떠 있는 동안 그림자는 땅에 남되 작고 옅어진다.
      const lift = 1 - Math.min(pose.hop / 60, 0.45);
      view.shadow.setPosition(pose.shadowX, pose.shadowY + 4).setDisplaySize(132 * lift, 24 * lift).setAlpha(0.38 * lift);
      const barY = pose.y - UNIT_HEIGHT - 26;
      view.hpBack.setPosition(pose.x, barY).setDepth(45);
      view.hpFill
        .setPosition(pose.x - 48, barY)
        .setDepth(46)
        .setDisplaySize(96 * Math.max(0, fighter.hp / fighter.maxHp), 10);
    });
  }

  private refreshProfiles(): void {
    this.playerFighters()
      .forEach((fighter, index) => {
        const gauge = this.profileGauges[index];
        if (!gauge) return;
        // 분자는 저장량, 분모는 코어가 정한 공용 저장 상한이며 괄호로 스킬별 소비 비용을 구분한다.
        gauge.setText(
          isFighterAlive(fighter)
            ? `HP ${fighter.hp} · ${fighter.energy} / ${ULTIMATE_ENERGY_MAX} (비용 ${fighter.def.ultimate.cost})`
            : "전투 불능",
        );
        gauge.setColor(isFighterAlive(fighter) ? COLOR.inkDim : COLOR.dangerText);
        this.profileCards[index]?.setAlpha(isFighterAlive(fighter) ? 1 : 0.45);
      });
  }

  private refreshDebug(): void {
    setDebugBattle({
      phase: this.state.phase,
      elapsed: Math.round(this.state.elapsed * 10) / 10,
      playerOrder: aliveFighters(this.state, "player").map((fighter) => fighter.def.name),
      playerHp: teamHp(this.state, "player"),
      enemyHp: teamHp(this.state, "enemy"),
    });
  }

  /** 시간을 멈추고 결과 버튼만 남긴다. */
  private finishBattle(phase: "victory" | "defeat"): void {
    if (this.finished) return;
    this.finished = true;
    this.syncViews();
    this.refreshDebug();
    const won = phase === "victory";
    if (won && session.selectedStageId) session.cleared.add(session.selectedStageId);
    this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
    this.add.text(BASE_WIDTH / 2, 840, won ? "작전 성공" : "작전 실패", textStyle({ size: 68, color: won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5).setDepth(101);
    new Button(this, BASE_WIDTH / 2, 1010, { width: 400, height: 110, label: "지도로", fontSize: 34, onClick: () => this.scene.start("stageMap") }).setDepth(101);
  }
}
