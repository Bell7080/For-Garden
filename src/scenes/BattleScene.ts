import Phaser from "phaser";
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
  type Team,
} from "../core/battle";
import { getRelic } from "../data/relics";
import { getStage } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { InfoManager, addHelpBadge } from "../ui/info";
import { Revolver } from "../ui/Revolver";
import { UnitPanel } from "../ui/UnitPanel";
import { COLOR, textStyle } from "../ui/theme";

/** 적이 생각하는 척하는 시간. 행동이 한꺼번에 처리되어 보이지 않게 한다. */
const ENEMY_DELAY_MS = 700;

/**
 * 전장은 비스듬한 좌우 대치다. 적은 우상단, 아군은 좌하단에 각각 삼각형으로 서고
 * 전방에 선 쪽이 상대를 향해 튀어나온 꼭짓점이 된다.
 *
 * 배열은 진형 순서(0=전방)와 같다.
 */
const ENEMY_SPOTS: [number, number, number, number][] = [
  [600, 620, 310, 150], // 전방 — 아군 쪽으로 내려온 꼭짓점
  [810, 395, 280, 140],
  [905, 600, 280, 140],
];
const PLAYER_SPOTS: [number, number, number, number][] = [
  [450, 790, 310, 150], // 전방 — 적 쪽으로 올라간 꼭짓점
  [205, 950, 270, 140],
  [495, 1005, 270, 140],
];

/** 조작부. 좌측은 교대 리볼버, 우측은 적 정보 · 궁극기 · 기본 공격. */
const CONTROL_TOP = 1200;

/**
 * 전투 화면. 규칙 판단은 전부 `core/battle`이 하고, 여기서는 그리기와 입력만 맡는다.
 */
export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private playerPanels: UnitPanel[] = [];
  private enemyPanels: UnitPanel[] = [];
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
    this.playerPanels = [];
    this.enemyPanels = [];

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.state = createBattle(session.party.map(getRelic), stage.enemies.map(getRelic));

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    this.add
      .text(40, 60, `${stage.id}  ${stage.name}`, textStyle({ size: 34, color: COLOR.inkDim }))
      .setOrigin(0, 0);

    this.turnText = this.add
      .text(BASE_WIDTH - 40, 60, "", textStyle({ size: 34, color: COLOR.accentText }))
      .setOrigin(1, 0);

    this.buildBattlefield();
    this.buildControls();

    this.info = new InfoManager(this);
    this.refresh();
  }

  private buildBattlefield(): void {
    // 좌하단 ↔ 우상단을 잇는 대치선. 전장이 비스듬하다는 걸 눈으로 알려준다.
    this.add.line(0, 0, 300, 1010, 830, 480, COLOR.panelEdge).setOrigin(0).setLineWidth(2).setAlpha(0.5);

    this.add
      .text(BASE_WIDTH - 40, 150, "적 침식체", textStyle({ size: 30, color: COLOR.dangerText }))
      .setOrigin(1, 0);
    this.enemyPanels = ENEMY_SPOTS.map(
      ([x, y, w, h], slot) =>
        new UnitPanel(this, x, y, w, h, true, () => this.showUnitInfo(this.state.enemy, slot)),
    );

    this.add
      .text(40, 700, "편성 렐릭", textStyle({ size: 30 }))
      .setOrigin(0, 0);
    this.playerPanels = PLAYER_SPOTS.map(
      ([x, y, w, h], slot) =>
        new UnitPanel(this, x, y, w, h, false, () => this.showUnitInfo(this.state.player, slot)),
    );

    this.logText = this.add
      .text(
        BASE_WIDTH / 2,
        CONTROL_TOP - 100,
        "",
        textStyle({ size: 26, color: COLOR.inkDim, align: "center", wrap: BASE_WIDTH - 120 }),
      )
      .setOrigin(0.5, 0);
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
      1540,
      190,
      this.state.player,
      (memberIndex) => this.doPlayerAction({ kind: "swap", memberIndex }),
      (memberIndex) => {
        const team = this.state.player;
        this.info.showUnit(team.units[memberIndex], team.order[0] === memberIndex);
      },
    );

    // 우측 — 위에서부터 적 정보 · 궁극기 · 기본 공격.
    const rightX = 780;
    new Button(this, rightX, 1300, {
      width: 440,
      height: 96,
      label: "적 정보",
      fontSize: 30,
      onClick: () => this.showEnemyTeamInfo(),
    });

    this.ultButton = new Button(this, rightX, 1470, {
      width: 440,
      height: 150,
      label: "궁극기",
      sub: "",
      fontSize: 38,
      onClick: () => this.doPlayerAction({ kind: "ultimate" }),
    });
    addHelpBadge(this, rightX + 200, 1470 - 88, () => {
      const def = frontUnit(this.state.player).def;
      this.info.showSkill(
        "궁극기",
        def.ultimate.name,
        def.ultimate.desc,
        `필요 게이지 ${def.ultimate.cost}\n행동할 때마다 게이지가 찬다.`,
      );
    });

    this.basicButton = new Button(this, rightX, 1690, {
      width: 440,
      height: 150,
      label: "기본 공격",
      sub: "",
      fontSize: 38,
      onClick: () => this.doPlayerAction({ kind: "basic" }),
    });
    addHelpBadge(this, rightX + 200, 1690 - 88, () => {
      const def = frontUnit(this.state.player).def;
      this.info.showSkill("기본 공격", def.basic.name, def.basic.desc);
    });

    this.add
      .text(300, 1790, "아래 렐릭을 눌러 교대", textStyle({ size: 26, color: COLOR.inkDim }))
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

  private doPlayerAction(action: BattleAction): void {
    if (this.busy || this.info.isOpen || this.phase() !== "player") return;
    if (!playerAct(this.state, action)) return;

    this.refresh();
    if (this.phase() !== "enemy") {
      this.finishIfOver();
      return;
    }

    // 적 차례는 잠깐 뜸을 들였다가 진행한다.
    this.busy = true;
    this.time.delayedCall(ENEMY_DELAY_MS, () => {
      enemyTurn(this.state);
      this.busy = false;
      this.refresh();
      this.finishIfOver();
    });
  }

  private refresh(): void {
    for (const team of [
      { panels: this.playerPanels, data: this.state.player },
      { panels: this.enemyPanels, data: this.state.enemy },
    ]) {
      team.data.order.forEach((unitIndex, slot) => {
        team.panels[slot].update(team.data.units[unitIndex], slot === 0);
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
