import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { PLAYABLE_RELICS } from "../data/relics";
import { getStage } from "../data/stages";
import { session } from "../state/session";
import { Button } from "../ui/Button";
import { COLOR, FONT } from "../ui/theme";

const ROLE_LABEL: Record<string, string> = {
  attacker: "공격",
  tank: "방어",
  support: "지원",
};

/** 렐릭 3명을 골라 파티를 짠다. 고른 순서가 곧 진형 — 첫 번째가 전방이다. */
export class PartyScene extends Phaser.Scene {
  private picked: string[] = [];
  private cards = new Map<string, { box: Phaser.GameObjects.Rectangle; order: Phaser.GameObjects.Text }>();
  private startButton!: Button;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("party");
  }

  create(): void {
    setDebugScene("party");
    this.picked = [];
    this.cards.clear();

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    const stage = getStage(session.selectedStageId ?? "1-1");
    this.add
      .text(cx, 130, `${stage.id}  ${stage.name}`, {
        fontFamily: FONT,
        fontSize: "48px",
        color: COLOR.ink,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 190, "렐릭 3명을 편성한다 — 먼저 고른 순서가 전방이다", {
        fontFamily: FONT,
        fontSize: "26px",
        color: COLOR.inkDim,
      })
      .setOrigin(0.5);

    // 렐릭 카드 2열 배치.
    const cardW = 460;
    const cardH = 240;
    const startY = 340;
    PLAYABLE_RELICS.forEach((relic, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = cx + (col === 0 ? -(cardW / 2 + 14) : cardW / 2 + 14);
      const y = startY + row * (cardH + 24) + cardH / 2;

      const box = this.add
        .rectangle(x, y, cardW, cardH, COLOR.panel)
        .setStrokeStyle(3, COLOR.panelEdge)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(x - cardW / 2 + 24, y - cardH / 2 + 24, relic.name, {
          fontFamily: FONT,
          fontSize: "38px",
          color: COLOR.ink,
        })
        .setOrigin(0, 0);
      this.add
        .text(x + cardW / 2 - 24, y - cardH / 2 + 32, ROLE_LABEL[relic.role], {
          fontFamily: FONT,
          fontSize: "24px",
          color: COLOR.accentText,
        })
        .setOrigin(1, 0);
      this.add
        .text(x - cardW / 2 + 24, y - cardH / 2 + 78, relic.origin, {
          fontFamily: FONT,
          fontSize: "22px",
          color: COLOR.inkDim,
        })
        .setOrigin(0, 0);
      this.add
        .text(
          x - cardW / 2 + 24,
          y - cardH / 2 + 124,
          `HP ${relic.stats.hp}   공 ${relic.stats.atk}   방 ${relic.stats.def}`,
          { fontFamily: FONT, fontSize: "24px", color: COLOR.ink },
        )
        .setOrigin(0, 0);
      this.add
        .text(x - cardW / 2 + 24, y - cardH / 2 + 168, `패시브 · ${relic.passive.name}`, {
          fontFamily: FONT,
          fontSize: "22px",
          color: COLOR.inkDim,
        })
        .setOrigin(0, 0);

      // 편성 순서(전방/후방)를 카드 오른쪽 아래에 표시한다.
      const order = this.add
        .text(x + cardW / 2 - 24, y + cardH / 2 - 24, "", {
          fontFamily: FONT,
          fontSize: "26px",
          color: COLOR.accentText,
        })
        .setOrigin(1, 1);

      box.on("pointerdown", () => this.toggle(relic.id));
      this.cards.set(relic.id, { box, order });
    });

    this.hint = this.add
      .text(cx, BASE_HEIGHT - 300, "", {
        fontFamily: FONT,
        fontSize: "26px",
        color: COLOR.inkDim,
      })
      .setOrigin(0.5);

    this.startButton = new Button(this, cx + 170, BASE_HEIGHT - 180, {
      width: 380,
      height: 110,
      label: "전투 시작",
      fontSize: 36,
      onClick: () => {
        if (this.picked.length !== 3) return;
        session.party = [...this.picked];
        this.scene.start("battle");
      },
    });

    new Button(this, cx - 250, BASE_HEIGHT - 180, {
      width: 240,
      height: 110,
      label: "돌아가기",
      fontSize: 28,
      onClick: () => this.scene.start("stageMap"),
    });

    this.refresh();
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
      card.box.setStrokeStyle(3, chosen ? COLOR.accent : COLOR.panelEdge);
      card.box.setFillStyle(chosen ? COLOR.panelEdge : COLOR.panel);
      card.order.setText(chosen ? (at === 0 ? "전방" : `후방 ${at}`) : "");
    }
    this.startButton.setEnabled(this.picked.length === 3);
    this.hint.setText(
      this.picked.length === 3 ? "편성 완료" : `${3 - this.picked.length}명 더 골라야 한다`,
    );
  }
}
