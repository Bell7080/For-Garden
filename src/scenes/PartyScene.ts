import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { PLAYABLE_RELICS, getRelic } from "../data/relics";
import { getStage } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { InfoManager, ROLE_LABEL, addHelpBadge } from "../ui/info";
import { COLOR, textStyle } from "../ui/theme";

/** 이만큼 누르고 있으면 정보창이 열린다. 짧게 누르면 편성 토글이다. */
const LONG_PRESS_MS = 420;

/** 미리보기 전장. 전투 화면과 같은 배치(적 우상단 · 아군 좌하단)를 축소해 보여준다. */
const ENEMY_PREVIEW: [number, number, number, number][] = [
  [620, 560, 300, 130], // 전방 — 선봉
  [850, 380, 270, 110],
  [925, 560, 270, 110],
];
const ALLY_PREVIEW: [number, number][] = [
  [440, 680], // 전방 — 선봉
  [230, 780],
  [340, 880],
];

interface RosterCard {
  box: Phaser.GameObjects.Rectangle;
  order: Phaser.GameObjects.Text;
}

interface AllySlot {
  platform: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  role: Phaser.GameObjects.Text;
}

/**
 * 편성 화면.
 *
 * 위쪽에 이번 전투의 전장을 그대로 축소해 둔다. 적 진형에서 누가 선봉인지, 내가 고른 렐릭이
 * 어느 자리에 서는지를 들어가기 전에 볼 수 있게 하려는 것이다. 고른 순서가 곧 진형이라
 * 첫 번째로 고른 렐릭이 선봉 자리에 올라간다.
 */
export class PartyScene extends Phaser.Scene {
  private picked: string[] = [];
  private cards = new Map<string, RosterCard>();
  private allySlots: AllySlot[] = [];
  private startButton!: Button;
  private hint!: Phaser.GameObjects.Text;
  private info!: InfoManager;
  private pressTimer?: Phaser.Time.TimerEvent;
  private pressStartedAt = 0;
  private longPressFired = false;

  constructor() {
    super("party");
  }

  create(): void {
    setDebugScene("party");
    this.picked = [];
    this.cards.clear();
    this.allySlots = [];
    this.pressTimer = undefined;
    this.pressStartedAt = 0;

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.add.text(cx, 70, `${stage.id}  ${stage.name}`, textStyle({ size: 46 })).setOrigin(0.5, 0);
    this.add
      .text(cx, 132, "렐릭 3명 편성 — 먼저 고른 순서가 진형이다", textStyle({ size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.buildPreview(stage.enemies);
    this.buildRoster();

    this.hint = this.add
      .text(cx, 1560, "", textStyle({ size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);

    this.startButton = new Button(this, cx, 1700, {
      width: 560,
      height: 150,
      label: "전투 시작",
      fontSize: 44,
      onClick: () => {
        if (this.picked.length !== 3) return;
        session.party = [...this.picked];
        this.scene.start("battle");
      },
    });

    new Button(this, 160, 1830, {
      width: 260,
      height: 96,
      label: "돌아가기",
      fontSize: 30,
      onClick: () => this.scene.start("stageMap"),
    });

    this.info = new InfoManager(this);
    this.refresh();
  }

  /** 위쪽 전장 미리보기. 적은 실제 진형대로, 아군은 고른 순서대로 자리에 올라간다. */
  private buildPreview(enemyIds: readonly string[]): void {
    this.add
      .text(BASE_WIDTH - 40, 210, "적 진형", textStyle({ size: 30, color: COLOR.dangerText }))
      .setOrigin(1, 0);

    // 좌하단 ↔ 우상단 대치선.
    this.add.line(0, 0, 300, 900, 830, 470, COLOR.panelEdge).setOrigin(0).setLineWidth(2).setAlpha(0.5);

    enemyIds.forEach((id, slot) => {
      const def = getRelic(id);
      const [x, y, w, h] = ENEMY_PREVIEW[slot];
      const box = this.add
        .rectangle(x, y, w, h, COLOR.panel)
        .setStrokeStyle(slot === 0 ? 6 : 3, COLOR.danger)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.info.showRelic(def));

      this.add.text(x - w / 2 + 16, y - h / 2 + 14, def.name, textStyle({ size: 30 })).setOrigin(0, 0);
      this.add
        .text(
          x + w / 2 - 16,
          y - h / 2 + 20,
          slot === 0 ? "선봉" : "후방",
          textStyle({ size: 22, color: slot === 0 ? COLOR.accentText : COLOR.inkDim }),
        )
        .setOrigin(1, 0);
      this.add
        .text(
          x - w / 2 + 16,
          y + h / 2 - 16,
          `${ROLE_LABEL[def.role]}  HP ${def.stats.hp}`,
          textStyle({ size: 22, color: COLOR.inkDim }),
        )
        .setOrigin(0, 1);

      addHelpBadge(this, x + w / 2 - 12, y - h / 2 - 12, () => this.info.showRelic(def), 24);
    });

    this.add.text(40, 640, "아군 진형", textStyle({ size: 30 })).setOrigin(0, 0);

    ALLY_PREVIEW.forEach(([x, y], slot) => {
      const platform = this.add
        .ellipse(x, y, 250, 70, COLOR.panel)
        .setStrokeStyle(slot === 0 ? 5 : 3, slot === 0 ? COLOR.accent : COLOR.ally);
      const name = this.add.text(x, y - 8, "", textStyle({ size: 28 })).setOrigin(0.5);
      const role = this.add
        .text(x, y + 40, slot === 0 ? "선봉" : `후방 ${slot}`, textStyle({ size: 22, color: COLOR.inkDim }))
        .setOrigin(0.5, 0);
      this.allySlots.push({ platform, name, role });
    });
  }

  /** 아래쪽 보유 렐릭 그리드. 짧게 누르면 편성, 꾹 누르면 정보창이다. */
  private buildRoster(): void {
    const cols = 4;
    const cardW = 240;
    const cardH = 220;
    const gapX = 16;
    const gapY = 20;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (BASE_WIDTH - gridW) / 2 + cardW / 2;
    const startY = 1100;

    // 보유한 렐릭만 편성할 수 있다.
    const roster = PLAYABLE_RELICS.filter((relic) => session.owned.has(relic.id));
    roster.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);

      const box = this.add
        .rectangle(x, y, cardW, cardH, COLOR.panel)
        .setStrokeStyle(3, COLOR.panelEdge)
        .setInteractive({ useHandCursor: true });

      this.add.text(x, y - cardH / 2 + 18, relic.name, textStyle({ size: 32 })).setOrigin(0.5, 0);
      this.add
        .text(x, y - cardH / 2 + 62, ROLE_LABEL[relic.role], textStyle({ size: 24, color: COLOR.accentText }))
        .setOrigin(0.5, 0);
      this.add
        .text(
          x,
          y - cardH / 2 + 104,
          `HP ${relic.stats.hp}\n공 ${relic.stats.atk}  방 ${relic.stats.def}`,
          textStyle({ size: 22, color: COLOR.inkDim, align: "center", lineSpacing: 6 }),
        )
        .setOrigin(0.5, 0);

      const order = this.add
        .text(x, y + cardH / 2 - 16, "", textStyle({ size: 24, color: COLOR.accentText }))
        .setOrigin(0.5, 1);

      this.bindCardInput(box, relic);
      this.cards.set(relic.id, { box, order });
    });

    this.add
      .text(BASE_WIDTH / 2, 1520, "꾹 누르면 상세 정보", textStyle({ size: 24, color: COLOR.inkDim }))
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
    }
    this.refresh();
  }

  private refresh(): void {
    for (const [id, card] of this.cards) {
      const at = this.picked.indexOf(id);
      const chosen = at >= 0;
      card.box.setStrokeStyle(chosen ? 5 : 3, chosen ? COLOR.accent : COLOR.panelEdge);
      card.box.setFillStyle(chosen ? COLOR.panelEdge : COLOR.panel);
      card.order.setText(chosen ? (at === 0 ? "선봉" : `후방 ${at}`) : "");
    }

    // 고른 순서 그대로 아군 진형 자리에 올린다.
    this.allySlots.forEach((slot, i) => {
      const id = this.picked[i];
      slot.name.setText(id ? getRelic(id).name : "―");
      slot.name.setColor(id ? COLOR.ink : COLOR.inkDim);
      slot.platform.setAlpha(id ? 1 : 0.4);
      slot.role.setAlpha(id ? 1 : 0.5);
    });

    this.startButton.setEnabled(this.picked.length === 3);
    this.hint.setText(
      this.picked.length === 3 ? "편성 완료" : `${3 - this.picked.length}명 더 골라야 한다`,
    );
  }
}
