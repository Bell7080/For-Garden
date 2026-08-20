import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { enemyTurn, frontUnit, playerAct, createBattle, ULTIMATE_ENERGY_MAX, type BattleState, type BattleUnit } from "../core/battle";
import { getRelic } from "../data/relics";
import { getStage } from "../data/stages";
import { AutoBattleManager } from "../managers/AutoBattleManager";
import type { PuppetCreature, PuppetAsset } from "../puppets/assets";
import { battleAssetFor, playMotion, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
import { COLOR, textStyle } from "../ui/theme";
import { setDebugBattle, setDebugScene } from "../debug";

/** 자동전투 캐릭터가 서는 3인 횡대. 중앙에서 만나 싸우는 구도를 유지한다. */
const PLAYER_SPOTS = [{ x: 190, y: 980 }, { x: 350, y: 1040 }, { x: 510, y: 980 }];
const ENEMY_SPOTS = [{ x: 890, y: 760 }, { x: 730, y: 820 }, { x: 570, y: 760 }];
const UNIT_HEIGHT = 300;
const PROFILE_TOP = 1430;

interface FighterView {
  creature: PuppetCreature;
  asset: PuppetAsset;
  unit: BattleUnit;
  homeX: number;
  homeY: number;
  dead: boolean;
}

/** SD 캐릭터들이 스스로 조우하고 공격하는 간결한 자동 전투 화면이다. */
export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private auto!: AutoBattleManager;
  private views = new Map<BattleUnit, FighterView>();
  private profileLabels: Phaser.GameObjects.Text[] = [];
  private finished = false;

  constructor() {
    super("battle");
  }

  create(): void {
    setDebugScene("battle");
    const stage = getStage(session.selectedStageId ?? "1-1");
    this.state = createBattle(session.party.map(getRelic), stage.enemies.map(getRelic));
    this.views.clear();
    this.profileLabels = [];
    this.finished = false;

    addSceneBackground(this, BACKGROUND.battleArea, -30);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.28).setDepth(-29);
    this.add.text(42, 48, `${stage.id} · ${stage.name}`, textStyle({ size: 30, color: COLOR.inkDim }));
    this.add.text(BASE_WIDTH / 2, 160, "AUTO BATTLE", textStyle({ size: 28, color: COLOR.accentText })).setOrigin(0.5);

    this.buildProfiles();
    void this.spawnTeams();
    this.auto = new AutoBattleManager(this, {
      isFinished: () => this.finished,
      playerAttack: () => this.attack("player"),
      enemyAttack: () => this.attack("enemy"),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.auto.stop();
      this.views.forEach((view) => view.creature.destroy());
    });
  }

  /** 3명 전원이 기본 idle 위에서 서로 다른 위상으로 통통 튀도록 이동 연출을 건다. */
  private async spawnTeams(): Promise<void> {
    const groups = [
      { units: this.state.player.units, spots: PLAYER_SPOTS, enemy: false },
      { units: this.state.enemy.units, spots: ENEMY_SPOTS, enemy: true },
    ];
    for (const group of groups) {
      for (let index = 0; index < group.units.length; index += 1) {
        const unit = group.units[index];
        const spot = group.spots[index];
        const asset = battleAssetFor(unit.def.id);
        this.add.ellipse(spot.x, spot.y + 4, 180, 28, 0x000000, 0.38).setDepth(-12);
        const creature = await spawnPuppet(this, asset, {
          x: spot.x,
          groundY: spot.y,
          height: UNIT_HEIGHT,
          flipX: group.enemy,
          // 임시 공용 적만 색으로 구분하고 완성된 1·2번 SD는 원색을 보존한다.
          tint: unit.def.id.startsWith("husk-") ? tintFor(unit.def.id) : undefined,
          depth: -8 + index,
        });
        this.views.set(unit, { creature, asset, unit, homeX: spot.x, homeY: spot.y, dead: false });
        this.auto.addBounce(creature, index);
      }
    }
    this.refreshDebug();
    this.auto.start();
  }

  /** 하단 프로필은 편성 순서의 원화를 매치하고 각성 스킬과 게이지를 함께 보여 준다. */
  private buildProfiles(): void {
    this.add.rectangle(BASE_WIDTH / 2, (PROFILE_TOP + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - PROFILE_TOP, COLOR.panel, 0.96)
      .setStrokeStyle(2, COLOR.panelEdge);
    this.state.player.units.forEach((unit, index) => {
      const x = 190 + index * 350;
      // 도감·편성과 같은 카드 규격을 써서 전투 중에도 같은 얼굴 프레임으로 알아보게 한다.
      new PortraitCard(this, x, 1620, {
        width: 300,
        height: 300,
        portraitAssetId: unit.def.portraitAssetId,
        tint: relicCardTint(unit.def),
        label: unit.def.name,
        sub: `각성 · ${unit.def.ultimate.name}`,
      }).hit.disableInteractive();
      const gauge = this.add.text(x, 1800, "0 / 100", textStyle({ size: 22, color: COLOR.inkDim })).setOrigin(0.5, 0);
      this.profileLabels.push(gauge);
    });
  }

  /** 현재 선봉이 앞으로 튀어나가 공격하고, 피해 대상은 hit 모션을 우선 재생한다. */
  private attack(side: "player" | "enemy"): void {
    if (this.finished) return;
    const attacker = frontUnit(side === "player" ? this.state.player : this.state.enemy);
    const target = frontUnit(side === "player" ? this.state.enemy : this.state.player);
    const beforeHp = target.hp;
    const acted = side === "player" ? playerAct(this.state, { kind: "basic" }) : (enemyTurn(this.state), true);
    if (!acted) return;

    const attackerView = this.views.get(attacker);
    const targetView = this.views.get(target);
    if (attackerView) {
      playMotion(this, attackerView.creature, "attack");
      this.tweens.add({ targets: attackerView.creature, x: attackerView.creature.x + (side === "player" ? 90 : -90), duration: 150, yoyo: true, ease: "Quad.Out" });
    }
    if (target.hp < beforeHp && targetView) playMotion(this, targetView.creature, "hit");
    this.handleDeaths();
    this.refreshDebug();
    if (this.state.phase === "victory" || this.state.phase === "defeat") this.finishBattle();
  }

  /** 사망한 SD는 팡 하고 커졌다가 별이 되어 위쪽 화면 밖으로 날아간다. */
  private handleDeaths(): void {
    this.views.forEach((view) => {
      if (view.dead || view.unit.hp > 0) return;
      view.dead = true;
      const burst = this.add.star(view.creature.x, view.creature.y, 10, 28, 78, COLOR.accent, 0.9).setDepth(30);
      this.tweens.killTweensOf(view.creature);
      this.tweens.add({ targets: burst, scale: 1.8, alpha: 0, angle: 90, duration: 360, onComplete: () => burst.destroy() });
      this.tweens.add({ targets: view.creature, y: -260, x: view.creature.x + Phaser.Math.Between(-180, 180), angle: Phaser.Math.Between(-25, 25), scaleX: view.creature.scaleX * 0.35, scaleY: view.creature.scaleY * 0.35, alpha: 0, duration: 850, ease: "Back.In", onComplete: () => view.creature.setVisible(false) });
    });
  }

  private refreshDebug(): void {
    // 분자는 저장량, 분모는 코어가 정한 공용 저장 상한이며 괄호로 스킬별 소비 비용을 구분한다.
    this.profileLabels.forEach((label, index) => {
      const unit = this.state.player.units[index];
      label.setText(`${unit.energy} / ${ULTIMATE_ENERGY_MAX} (비용 ${unit.def.ultimate.cost})`);
    });
    setDebugBattle({
      turn: this.state.turn,
      phase: this.state.phase,
      playerOrder: this.state.player.order.map((i) => this.state.player.units[i].def.name),
      enemyFrontHp: frontUnit(this.state.enemy).hp,
      playerFrontHp: frontUnit(this.state.player).hp,
    });
  }

  /** 자동 루프를 닫고 결과 버튼만 남긴다. */
  private finishBattle(): void {
    this.finished = true;
    this.auto.stop();
    const won = this.state.phase === "victory";
    if (won && session.selectedStageId) session.cleared.add(session.selectedStageId);
    this.add.rectangle(BASE_WIDTH / 2, 930, BASE_WIDTH, 420, COLOR.void, 0.84).setDepth(100);
    this.add.text(BASE_WIDTH / 2, 840, won ? "작전 성공" : "작전 실패", textStyle({ size: 68, color: won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5).setDepth(101);
    new Button(this, BASE_WIDTH / 2, 1010, { width: 400, height: 110, label: "지도로", fontSize: 34, onClick: () => this.scene.start("stageMap") }).setDepth(101);
  }
}
