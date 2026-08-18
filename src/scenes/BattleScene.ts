import Phaser from "phaser";
import type { PuppetCreature } from "puppetforge/phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugBattle, setDebugScene } from "../debug";
import {
  canUseUltimate,
  createBattle,
  enemyTurn,
  frontUnit,
  playerAct,
  type BattleAction,
  type BattlePhase,
  type BattleState,
  type BattleUnit,
  type Team,
} from "../core/battle";
import { getRelic } from "../data/relics";
import { getStage } from "../data/stages";
import { ENTITY_ASSET, placePuppet, playMotion, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { InfoManager, addHelpBadge } from "../ui/info";
import { Revolver } from "../ui/Revolver";
import { UnitTag } from "../ui/UnitTag";
import { COLOR, textStyle } from "../ui/theme";

/** 적이 생각하는 척하는 시간. 행동이 한꺼번에 처리되어 보이지 않게 한다. */
const ENEMY_DELAY_MS = 700;

/** 진형 한 자리. 캐릭터는 발끝이 `groundY`에 닿게 서고, 이름표는 그 바로 아래에 붙는다. */
interface Spot {
  x: number;
  groundY: number;
  /** 그림의 화면상 높이. 앞에 선 쪽을 조금 크게 둔다. */
  height: number;
}

/**
 * 전장은 비스듬한 좌우 대치다. 적은 우상단, 아군은 좌하단에 각각 삼각형으로 서고
 * 전방에 선 쪽이 상대를 향해 튀어나온 꼭짓점이 된다.
 *
 * 배열은 진형 순서(0=전방)와 같다.
 */
const ENEMY_SPOTS: Spot[] = [
  { x: 560, groundY: 620, height: 230 }, // 전방 — 아군 쪽으로 내려온 꼭짓점
  { x: 845, groundY: 370, height: 190 },
  { x: 960, groundY: 690, height: 190 },
];
const PLAYER_SPOTS: Spot[] = [
  { x: 470, groundY: 990, height: 230 }, // 전방 — 적 쪽으로 올라간 꼭짓점
  { x: 185, groundY: 1120, height: 190 },
  { x: 720, groundY: 1160, height: 190 },
];

/** 조작부. 좌측은 교대 리볼버, 우측은 적 정보 · 궁극기 · 기본 공격. */
const CONTROL_TOP = 1260;

/** 캐릭터가 UI를 가리지 않도록 전장 그림은 전부 0보다 아래에 둔다. */
const DEPTH = { background: -20, shadow: -12, rear: -10, front: -8, portrait: 1001 } as const;

/**
 * 전투 화면. 규칙 판단은 전부 `core/battle`이 하고, 여기서는 그리기와 입력만 맡는다.
 */
export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private playerTags: UnitTag[] = [];
  private enemyTags: UnitTag[] = [];
  /** 유닛 하나당 한 마리. 진형이 바뀌면 자리만 옮긴다. */
  private creatures = new Map<BattleUnit, PuppetCreature>();
  private shadows = new Map<BattleUnit, Phaser.GameObjects.Ellipse>();
  private revolver!: Revolver;
  private info!: InfoManager;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private ultButton!: Button;
  private basicButton!: Button;
  private busy = false;

  constructor() {
    super("battle");
  }

  create(): void {
    setDebugScene("battle");
    this.busy = false;
    this.playerTags = [];
    this.enemyTags = [];
    this.creatures = new Map();
    this.shadows = new Map();

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.state = createBattle(session.party.map(getRelic), stage.enemies.map(getRelic));

    const cx = BASE_WIDTH / 2;
    this.add
      .rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void)
      .setDepth(DEPTH.background);

    this.add
      .text(40, 56, `${stage.id}  ${stage.name}`, textStyle({ size: 32, color: COLOR.inkDim }))
      .setOrigin(0, 0);
    this.turnText = this.add
      .text(BASE_WIDTH - 40, 56, "", textStyle({ size: 32, color: COLOR.accentText }))
      .setOrigin(1, 0);
    // 전장 위쪽 왼편. 적 진형이 오른쪽에 서므로 글이 캐릭터와 겹치지 않는 자리다.
    this.logText = this.add
      .text(40, 104, "", textStyle({ size: 22, color: COLOR.inkDim, wrap: 600 }))
      .setOrigin(0, 0);

    this.buildBattlefield();
    this.buildControls();

    this.info = new InfoManager(this, DEPTH.portrait);
    this.refresh();
    void this.spawnCreatures();
  }

  private buildBattlefield(): void {
    // 좌하단 ↔ 우상단을 잇는 대치선. 전장이 비스듬하다는 걸 눈으로 알려준다.
    this.add
      .line(0, 0, 300, 1020, 800, 520, COLOR.panelEdge)
      .setOrigin(0)
      .setLineWidth(2)
      .setAlpha(0.4)
      .setDepth(DEPTH.background + 1);

    this.add
      .text(BASE_WIDTH - 40, 104, "적 침식체", textStyle({ size: 28, color: COLOR.dangerText }))
      .setOrigin(1, 0);

    this.enemyTags = ENEMY_SPOTS.map((spot, slot) => {
      this.addHeadBadge(spot, () => this.showUnitInfo(this.state.enemy, slot));
      return new UnitTag(this, spot.x, spot.groundY + 34, true);
    });
    this.playerTags = PLAYER_SPOTS.map((spot, slot) => {
      this.addHeadBadge(spot, () => this.showUnitInfo(this.state.player, slot));
      return new UnitTag(this, spot.x, spot.groundY + 34, false);
    });
  }

  /** 머리 위 `?`. 캐릭터 그림이 아직 안 떴어도 자리는 정해져 있으므로 미리 놓는다. */
  private addHeadBadge(spot: Spot, onClick: () => void): void {
    addHelpBadge(this, spot.x, spot.groundY - spot.height - 34, onClick, 24);
  }

  /** 그림을 불러와 진형 자리에 세운다. 파일을 읽는 동안에도 전투는 조작할 수 있다. */
  private async spawnCreatures(): Promise<void> {
    const all: { team: Team; spots: Spot[]; enemy: boolean }[] = [
      { team: this.state.player, spots: PLAYER_SPOTS, enemy: false },
      { team: this.state.enemy, spots: ENEMY_SPOTS, enemy: true },
    ];

    for (const { team, spots, enemy } of all) {
      for (const [slot, unitIndex] of team.order.entries()) {
        const unit = team.units[unitIndex];
        const spot = spots[slot];

        const shadow = this.add
          .ellipse(spot.x, spot.groundY, spot.height * 0.62, 20, 0x000000, 0.45)
          .setDepth(DEPTH.shadow);
        this.shadows.set(unit, shadow);

        const creature = await spawnPuppet(this, ENTITY_ASSET, {
          x: spot.x,
          groundY: spot.groundY,
          height: spot.height,
          tint: tintFor(unit.def.id),
          depth: slot === 0 ? DEPTH.front : DEPTH.rear,
          // 서로 마주 보게 한다. 적은 좌하단의 아군을 내려다보는 쪽이다.
          flipX: enemy,
        });
        this.creatures.set(unit, creature);

        // 씬을 떠날 때 캔버스에 남지 않도록 함께 정리한다.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => creature.destroy());
      }
    }
    this.refresh();
  }

  private buildControls(): void {
    this.add
      .rectangle(
        BASE_WIDTH / 2,
        (CONTROL_TOP + BASE_HEIGHT) / 2,
        BASE_WIDTH,
        BASE_HEIGHT - CONTROL_TOP,
        COLOR.panel,
      )
      .setStrokeStyle(2, COLOR.panelEdge);

    // 좌측 — 교대 리볼버. 맨 위가 출전 중인 렐릭이다.
    this.revolver = new Revolver(
      this,
      300,
      1600,
      185,
      this.state.player,
      (memberIndex) => this.doPlayerAction({ kind: "swap", memberIndex }),
      (memberIndex) => {
        const team = this.state.player;
        this.info.showUnit(team.units[memberIndex], team.order[0] === memberIndex);
      },
    );

    // 우측 — 위에서부터 적 정보 · 궁극기 · 기본 공격.
    const rightX = 780;
    new Button(this, rightX, 1350, {
      width: 440,
      height: 96,
      label: "적 정보",
      fontSize: 30,
      onClick: () => this.showEnemyTeamInfo(),
    });

    this.ultButton = new Button(this, rightX, 1510, {
      width: 440,
      height: 150,
      label: "궁극기",
      sub: "",
      fontSize: 38,
      onClick: () => this.doPlayerAction({ kind: "ultimate" }),
    });
    addHelpBadge(this, rightX + 200, 1425, () => {
      const def = frontUnit(this.state.player).def;
      this.info.showSkill(
        "궁극기",
        def.ultimate.name,
        def.ultimate.desc,
        `필요 게이지 ${def.ultimate.cost}\n행동할 때마다 게이지가 찬다.`,
      );
    });

    this.basicButton = new Button(this, rightX, 1730, {
      width: 440,
      height: 150,
      label: "기본 공격",
      sub: "",
      fontSize: 38,
      onClick: () => this.doPlayerAction({ kind: "basic" }),
    });
    addHelpBadge(this, rightX + 200, 1630, () => {
      const def = frontUnit(this.state.player).def;
      this.info.showSkill("기본 공격", def.basic.name, def.basic.desc);
    });

    this.add
      .text(300, 1840, "아래 렐릭을 눌러 교대", textStyle({ size: 24, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  private showUnitInfo(team: Team, slot: number): void {
    this.info.showUnit(team.units[team.order[slot]], slot === 0);
  }

  private showEnemyTeamInfo(): void {
    this.info.showEnemyTeam(this.state.enemy.units, this.state.enemy.order);
  }

  /** 지금 phase를 읽는다. 함수를 거치므로 앞선 검사로 타입이 좁혀지지 않는다. */
  private phase(): BattlePhase {
    return this.state.phase;
  }

  private allUnits(): BattleUnit[] {
    return [...this.state.player.units, ...this.state.enemy.units];
  }

  /**
   * 행동 전후의 HP를 견줘 맞은 쪽에 피격 동작을 준다.
   * 엔진은 누가 맞았는지 따로 알려주지 않지만, HP가 줄었다면 맞은 것이다.
   */
  private reactToDamage(before: number[]): void {
    this.allUnits().forEach((unit, i) => {
      if (unit.hp >= before[i]) return;
      const creature = this.creatures.get(unit);
      if (creature) playMotion(this, creature, "hit");
    });
  }

  private doPlayerAction(action: BattleAction): void {
    if (this.busy || this.info.isOpen || this.phase() !== "player") return;

    const before = this.allUnits().map((u) => u.hp);
    const attacker = frontUnit(this.state.player);
    if (!playerAct(this.state, action)) return;

    if (action.kind !== "swap") this.strike(attacker);
    this.reactToDamage(before);
    this.refresh();

    if (this.phase() !== "enemy") {
      this.finishIfOver();
      return;
    }

    // 적 차례는 잠깐 뜸을 들였다가 진행한다.
    this.busy = true;
    this.time.delayedCall(ENEMY_DELAY_MS, () => {
      const enemyBefore = this.allUnits().map((u) => u.hp);
      const enemyAttacker = frontUnit(this.state.enemy);
      enemyTurn(this.state);

      this.strike(enemyAttacker);
      this.reactToDamage(enemyBefore);
      this.busy = false;
      this.refresh();
      this.finishIfOver();
    });
  }

  private strike(unit: BattleUnit): void {
    const creature = this.creatures.get(unit);
    if (creature && unit.hp > 0) playMotion(this, creature, "attack");
  }

  private refresh(): void {
    for (const { tags, team, spots } of [
      { tags: this.playerTags, team: this.state.player, spots: PLAYER_SPOTS },
      { tags: this.enemyTags, team: this.state.enemy, spots: ENEMY_SPOTS },
    ]) {
      team.order.forEach((unitIndex, slot) => {
        const unit = team.units[unitIndex];
        tags[slot].update(unit, slot === 0);
        this.moveToSpot(unit, spots[slot], slot === 0);
      });
    }

    const actable = this.phase() === "player" && !this.busy;
    this.revolver.update(this.state.player, actable);

    const front = frontUnit(this.state.player);
    this.ultButton.setSub(front.def.ultimate.name).setEnabled(actable && canUseUltimate(front));
    this.basicButton.setSub(front.def.basic.name).setEnabled(actable);

    const cooling = this.state.player.swapCooldown > 0;
    this.turnText.setText(
      `${this.state.turn}턴 · ${this.phase() === "player" ? "내 차례" : "적 차례"}` +
        (cooling ? "  (교대 재정비)" : ""),
    );
    this.logText.setText(this.state.log.slice(-2).join("\n"));

    setDebugBattle({
      turn: this.state.turn,
      phase: this.state.phase,
      playerOrder: this.state.player.order.map((i) => this.state.player.units[i].def.name),
      enemyFrontHp: frontUnit(this.state.enemy).hp,
      playerFrontHp: front.hp,
    });
  }

  /** 교대로 자리가 바뀌면 그림을 새 자리로 옮긴다. */
  private moveToSpot(unit: BattleUnit, spot: Spot, isFront: boolean): void {
    const creature = this.creatures.get(unit);
    const shadow = this.shadows.get(unit);
    if (!creature) return;

    placePuppet(creature, ENTITY_ASSET, {
      x: spot.x,
      groundY: spot.groundY,
      height: spot.height,
    });
    creature.setDepth(isFront ? DEPTH.front : DEPTH.rear);
    creature.setAlpha(unit.hp > 0 ? 1 : 0.25);

    if (shadow) {
      shadow.setPosition(spot.x, spot.groundY);
      shadow.setSize(spot.height * 0.62, 20);
      shadow.setAlpha(unit.hp > 0 ? 0.45 : 0.15);
    }
  }

  private finishIfOver(): void {
    if (this.phase() !== "victory" && this.phase() !== "defeat") return;

    const won = this.phase() === "victory";
    if (won && session.selectedStageId) session.cleared.add(session.selectedStageId);

    const cx = BASE_WIDTH / 2;
    const overlay = this.add.container(0, 0).setDepth(900);
    overlay.add(this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.86));
    overlay.add(
      this.add
        .text(
          cx,
          BASE_HEIGHT / 2 - 80,
          won ? "작전 성공" : "작전 실패",
          textStyle({ size: 76, color: won ? COLOR.accentText : COLOR.dangerText }),
        )
        .setOrigin(0.5),
    );
    overlay.add(
      new Button(this, cx, BASE_HEIGHT / 2 + 80, {
        width: 400,
        height: 120,
        label: "지도로",
        fontSize: 36,
        onClick: () => this.scene.start("stageMap"),
      }),
    );
  }
}
