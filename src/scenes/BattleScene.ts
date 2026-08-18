import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugBattle, setDebugScene } from "../debug";
import {
  canSwap,
  canUseSupport,
  canUseUltimate,
  createBattle,
  enemyTurn,
  frontUnit,
  playerAct,
  type BattlePhase,
  type BattleState,
} from "../core/battle";
import { getRelic } from "../data/relics";
import { getStage } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { UnitPanel } from "../ui/UnitPanel";
import { COLOR, FONT } from "../ui/theme";

/** 적이 생각하는 척하는 시간. 행동이 한꺼번에 처리되어 보이지 않게 한다. */
const ENEMY_DELAY_MS = 700;

/**
 * 전투 화면. 아군은 좌하단, 적은 우상단에 놓고 3명을 태그로 스왑하며 싸운다.
 * 규칙 판단은 전부 `core/battle`이 하고, 여기서는 그리기와 입력만 맡는다.
 */
export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private playerPanels: UnitPanel[] = [];
  private enemyPanels: UnitPanel[] = [];
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private actionButtons: { button: Button; enabled: () => boolean; sub: () => string }[] = [];
  private busy = false;

  constructor() {
    super("battle");
  }

  create(): void {
    setDebugScene("battle");
    this.busy = false;
    this.playerPanels = [];
    this.enemyPanels = [];
    this.actionButtons = [];

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.state = createBattle(
      session.party.map(getRelic),
      stage.enemies.map(getRelic),
    );

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    this.add
      .text(40, 60, `${stage.id}  ${stage.name}`, {
        fontFamily: FONT,
        fontSize: "34px",
        color: COLOR.inkDim,
      })
      .setOrigin(0, 0);

    this.turnText = this.add
      .text(BASE_WIDTH - 40, 60, "", {
        fontFamily: FONT,
        fontSize: "34px",
        color: COLOR.accentText,
      })
      .setOrigin(1, 0);

    // 적 — 우상단. 전방이 크고 앞에 나와 있다.
    this.add
      .text(BASE_WIDTH - 40, 140, "적 침식체", {
        fontFamily: FONT,
        fontSize: "28px",
        color: COLOR.dangerText,
      })
      .setOrigin(1, 0);
    this.enemyPanels = [
      new UnitPanel(this, 700, 350, 420, 200, true),
      new UnitPanel(this, 890, 560, 340, 160, true),
      new UnitPanel(this, 890, 740, 340, 160, true),
    ];

    // 아군 — 좌하단.
    this.add
      .text(40, 900, "편성 렐릭", { fontFamily: FONT, fontSize: "28px", color: COLOR.ink })
      .setOrigin(0, 0);
    this.playerPanels = [
      new UnitPanel(this, 280, 1230, 440, 220, false),
      new UnitPanel(this, 730, 1050, 340, 160, false),
      new UnitPanel(this, 730, 1230, 340, 160, false),
    ];

    this.logText = this.add
      .text(cx, 1400, "", {
        fontFamily: FONT,
        fontSize: "26px",
        color: COLOR.inkDim,
        align: "center",
        wordWrap: { width: BASE_WIDTH - 120 },
      })
      .setOrigin(0.5, 0);

    this.buildActionBar();
    this.refresh();
  }

  /** 하단 조작 바. 공격 · 궁극기 · 서포트 · 스왑을 모두 여기서 고른다. */
  private buildActionBar(): void {
    const barTop = 1520;
    this.add
      .rectangle(BASE_WIDTH / 2, (barTop + BASE_HEIGHT) / 2, BASE_WIDTH, BASE_HEIGHT - barTop, COLOR.panel)
      .setStrokeStyle(2, COLOR.panelEdge);

    const left = BASE_WIDTH / 2 - 250;
    const right = BASE_WIDTH / 2 + 250;

    const front = () => frontUnit(this.state.player);

    this.addAction(left, 1600, 460, "기본 공격", () => front().def.basic.name, () => true, {
      kind: "basic",
    });
    this.addAction(
      right,
      1600,
      460,
      "궁극기",
      () => front().def.ultimate.name,
      () => canUseUltimate(front()),
      { kind: "ultimate" },
    );

    // 후방 두 명의 서포트와 스왑. 진형이 바뀌어도 같은 자리에서 조작한다.
    const rearSlots = [1, 2];
    rearSlots.forEach((slot, i) => {
      const x = i === 0 ? left : right;
      const memberIndex = () => this.state.player.order[slot];
      this.addAction(
        x,
        1725,
        460,
        "서포트",
        () => this.state.player.units[memberIndex()].def.support.name,
        () => canUseSupport(this.state.player, memberIndex()),
        () => ({ kind: "support", memberIndex: memberIndex() }),
      );
      this.addAction(
        x,
        1850,
        460,
        "스왑",
        () => `${this.state.player.units[memberIndex()].def.name} 교대`,
        () => canSwap(this.state.player, memberIndex()),
        () => ({ kind: "swap", memberIndex: memberIndex() }),
      );
    });
  }

  private addAction(
    x: number,
    y: number,
    width: number,
    label: string,
    sub: () => string,
    enabled: () => boolean,
    action: Parameters<typeof playerAct>[1] | (() => Parameters<typeof playerAct>[1]),
  ): void {
    const button = new Button(this, x, y, {
      width,
      height: 110,
      label,
      sub: sub(),
      fontSize: 32,
      onClick: () => this.doPlayerAction(typeof action === "function" ? action() : action),
    });
    this.actionButtons.push({ button, enabled, sub });
  }

  /** 지금 phase를 읽는다. 함수를 거치므로 앞선 검사로 타입이 좁혀지지 않는다. */
  private phase(): BattlePhase {
    return this.state.phase;
  }

  private doPlayerAction(action: Parameters<typeof playerAct>[1]): void {
    if (this.busy || this.phase() !== "player") return;
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

    const cooling = this.state.player.swapCooldown > 0;
    this.turnText.setText(
      `${this.state.turn}턴 · ${this.state.phase === "player" ? "내 차례" : "적 차례"}` +
        (cooling ? "  (스왑 재정비)" : ""),
    );

    this.logText.setText(this.state.log.slice(-3).join("\n"));

    // 진형이 바뀌면 버튼이 가리키는 대상도 바뀌므로 문구까지 다시 맞춘다.
    const actable = this.state.phase === "player" && !this.busy;
    for (const { button, enabled, sub } of this.actionButtons) {
      button.setSub(sub()).setEnabled(actable && enabled());
    }

    setDebugBattle({
      turn: this.state.turn,
      phase: this.state.phase,
      playerOrder: this.state.player.order.map((i) => this.state.player.units[i].def.name),
      enemyFrontHp: frontUnit(this.state.enemy).hp,
      playerFrontHp: frontUnit(this.state.player).hp,
    });
  }

  private finishIfOver(): void {
    if (this.state.phase !== "victory" && this.state.phase !== "defeat") return;

    const won = this.state.phase === "victory";
    if (won && session.selectedStageId) session.cleared.add(session.selectedStageId);

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.86);
    this.add
      .text(cx, BASE_HEIGHT / 2 - 80, won ? "작전 성공" : "작전 실패", {
        fontFamily: FONT,
        fontSize: "72px",
        color: won ? COLOR.accentText : COLOR.dangerText,
      })
      .setOrigin(0.5);

    new Button(this, cx, BASE_HEIGHT / 2 + 80, {
      width: 400,
      height: 120,
      label: "지도로",
      fontSize: 36,
      onClick: () => this.scene.start("stageMap"),
    });
  }
}
